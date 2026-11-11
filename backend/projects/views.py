from datetime import timedelta

from django.db import transaction
from django.db.models import Count, F, Max, Q
from django.http import FileResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.services import notify

from organizations.models import Membership
from organizations.permissions import ROLE_RANK, Role, query_int, require_role, user_organization_ids

from .activity import log_activity
from .models import Activity, Attachment, Comment, Label, Project, Task
from .serializers import (
    ActivitySerializer,
    AttachmentSerializer,
    CommentSerializer,
    LabelSerializer,
    ProjectSerializer,
    SearchResultSerializer,
    TaskMoveSerializer,
    TaskSerializer,
)

STATUS_LABELS = dict(Task.Status.choices)


def annotate_progress(queryset):
    return queryset.annotate(
        task_count=Count("tasks", distinct=True),
        completed_count=Count("tasks", filter=Q(tasks__status=Task.Status.COMPLETED), distinct=True),
    )


def filter_by_due(queryset, due):
    today = timezone.localdate()
    open_tasks = queryset.exclude(status=Task.Status.COMPLETED)
    if due == "overdue":
        return open_tasks.filter(due_date__lt=today)
    if due == "today":
        return queryset.filter(due_date=today)
    if due == "week":
        return queryset.filter(due_date__gte=today, due_date__lte=today + timedelta(days=7))
    if due == "none":
        return queryset.filter(due_date__isnull=True)
    return queryset


def ensure_project_writable(project):
    if project.is_archived:
        raise ValidationError({"detail": "This project is archived. Unarchive it to make changes."})


def apply_status(task, new_status):
    """Set the status and keep completed_at in sync with it."""
    task.status = new_status
    if new_status == Task.Status.COMPLETED:
        task.completed_at = task.completed_at or timezone.now()
    else:
        task.completed_at = None


def with_task_details(queryset):
    return (
        queryset.select_related("project", "assignee", "created_by")
        .prefetch_related("labels")
        .annotate(
            comment_count=Count("comments", distinct=True),
            attachment_count=Count("attachments", distinct=True),
        )
    )


def notify_assignee(task, actor):
    notify(
        [task.assignee],
        actor=actor,
        verb="task_assigned",
        message=f'assigned you to "{task.title}" in {task.project.name}',
        organization=task.project.organization,
        task=task,
    )


def notify_completed(task, actor):
    notify(
        [task.created_by],
        actor=actor,
        verb="task_completed",
        message=f'completed "{task.title}" in {task.project.name}',
        organization=task.project.organization,
        task=task,
    )


def renumber_column(project_id, task_status):
    for index, task in enumerate(Task.objects.filter(project_id=project_id, status=task_status).order_by("position", "id")):
        if task.position != index:
            Task.objects.filter(pk=task.pk).update(position=index)


class ProjectViewSet(viewsets.ModelViewSet):
    """Projects belong to an organization. Members can view them; admins and owners manage them.

    Filters: ?organization=<id>&status=active|archived&search=<text>
    """

    serializer_class = ProjectSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Project.objects.none()
        qs = Project.objects.filter(organization__in=user_organization_ids(self.request.user)).select_related(
            "team", "created_by"
        )
        organization_id = query_int(self.request, "organization")
        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        project_status = self.request.query_params.get("status")
        if project_status in Project.Status.values:
            qs = qs.filter(status=project_status)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))
        return annotate_progress(qs).order_by("-updated_at")

    def perform_create(self, serializer):
        organization = serializer.validated_data["organization"]
        require_role(self.request.user, organization.pk, Role.ADMIN)
        project = serializer.save(created_by=self.request.user)
        log_activity(organization, self.request.user, "project_created", f'created the project "{project.name}"', project)

    def perform_update(self, serializer):
        require_role(self.request.user, serializer.instance.organization_id, Role.ADMIN)
        project = serializer.save()
        log_activity(project.organization, self.request.user, "project_updated", f'updated the project "{project.name}"', project)

    def perform_destroy(self, instance):
        require_role(self.request.user, instance.organization_id, Role.ADMIN)
        log_activity(instance.organization, self.request.user, "project_deleted", f'deleted the project "{instance.name}"')
        instance.delete()

    def _set_status(self, request, new_status, verb, verb_text):
        project = self.get_object()
        require_role(request.user, project.organization_id, Role.ADMIN)
        if project.status != new_status:
            project.status = new_status
            project.save(update_fields=["status", "updated_at"])
            log_activity(project.organization, request.user, verb, f'{verb_text} the project "{project.name}"', project)
        return Response(self.get_serializer(annotate_progress(Project.objects.filter(pk=project.pk)).get()).data)

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        return self._set_status(request, Project.Status.ARCHIVED, "project_archived", "archived")

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        return self._set_status(request, Project.Status.ACTIVE, "project_unarchived", "restored")


class TaskViewSet(viewsets.ModelViewSet):
    """Tasks on a project's Kanban board.

    Any organization member can create and edit tasks on active projects.
    Deleting a task requires admin/owner, or being the task's creator.
    Filters: ?project=<id>&organization=<id>&assignee=<id|me|none>&status=&priority=&label=<id>
             &due=overdue|today|week|none&search=<text>
    """

    serializer_class = TaskSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Task.objects.none()
        qs = with_task_details(Task.objects.filter(project__organization__in=user_organization_ids(self.request.user)))
        params = self.request.query_params
        project_id = query_int(self.request, "project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        organization_id = query_int(self.request, "organization")
        if organization_id:
            qs = qs.filter(project__organization_id=organization_id)
        assignee = params.get("assignee")
        if assignee == "me":
            qs = qs.filter(assignee=self.request.user)
        elif assignee == "none":
            qs = qs.filter(assignee__isnull=True)
        elif assignee:
            qs = qs.filter(assignee_id=query_int(self.request, "assignee"))
        if params.get("status") in Task.Status.values:
            qs = qs.filter(status=params["status"])
        if params.get("priority") in Task.Priority.values:
            qs = qs.filter(priority=params["priority"])
        label_id = query_int(self.request, "label")
        if label_id:
            qs = qs.filter(labels__id=label_id)
        qs = filter_by_due(qs, params.get("due"))
        search = params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        return qs.order_by("status", "position", "id")

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]
        require_role(self.request.user, project.organization_id, Role.MEMBER)
        ensure_project_writable(project)

        task_status = serializer.validated_data.get("status", Task.Status.TODO)
        last = Task.objects.filter(project=project, status=task_status).aggregate(m=Max("position"))["m"]
        task = serializer.save(
            created_by=self.request.user,
            position=0 if last is None else last + 1,
            completed_at=timezone.now() if task_status == Task.Status.COMPLETED else None,
        )
        message = f'created the task "{task.title}"'
        if task.assignee:
            message += f" and assigned it to {task.assignee.full_name}"
            notify_assignee(task, self.request.user)
        log_activity(project.organization, self.request.user, "task_created", message, project, task)

    @transaction.atomic
    def perform_update(self, serializer):
        task = serializer.instance
        require_role(self.request.user, task.project.organization_id, Role.MEMBER)
        ensure_project_writable(task.project)

        before = {
            "status": task.status,
            "assignee": task.assignee,
            "priority": task.priority,
            "due_date": task.due_date,
            "title": task.title,
            "description": task.description,
            "labels": set(task.labels.values_list("pk", flat=True)),
        }
        data = serializer.validated_data
        extra = {}
        if "status" in data and data["status"] != task.status:
            apply_status(task, data["status"])
            last = Task.objects.filter(project=task.project, status=data["status"]).aggregate(m=Max("position"))["m"]
            extra = {"completed_at": task.completed_at, "position": 0 if last is None else last + 1}
        task = serializer.save(**extra)
        if before["status"] != task.status:
            renumber_column(task.project_id, before["status"])

        self._log_changes(task, before)

    def _log_changes(self, task, before):
        user = self.request.user
        org, project = task.project.organization, task.project
        changes = []
        if before["status"] != task.status:
            log_activity(
                org, user, "task_moved",
                f'moved "{task.title}" from {STATUS_LABELS[before["status"]]} to {STATUS_LABELS[task.status]}',
                project, task,
            )
        if before["status"] != task.status and task.status == Task.Status.COMPLETED:
            notify_completed(task, user)
        if before["assignee"] != task.assignee:
            if task.assignee:
                log_activity(org, user, "task_assigned", f'assigned "{task.title}" to {task.assignee.full_name}', project, task)
                notify_assignee(task, user)
            else:
                log_activity(org, user, "task_unassigned", f'unassigned "{task.title}"', project, task)
        if before["priority"] != task.priority:
            changes.append(f"priority to {task.get_priority_display()}")
        if before["due_date"] != task.due_date:
            changes.append(f"deadline to {task.due_date}" if task.due_date else "removed the deadline")
        if before["title"] != task.title:
            changes.append("title")
        if before["description"] != task.description:
            changes.append("description")
        if before["labels"] != set(task.labels.values_list("pk", flat=True)):
            changes.append("labels")
        if changes:
            log_activity(org, user, "task_updated", f'updated "{task.title}": {", ".join(changes)}', project, task)

    def perform_destroy(self, instance):
        role = require_role(self.request.user, instance.project.organization_id, Role.MEMBER)
        if ROLE_RANK[role] < ROLE_RANK[Role.ADMIN] and instance.created_by_id != self.request.user.pk:
            raise PermissionDenied("Only admins, owners, or the task's creator can delete this task.")
        ensure_project_writable(instance.project)
        project, task_status = instance.project, instance.status
        log_activity(project.organization, self.request.user, "task_deleted", f'deleted the task "{instance.title}"', project)
        instance.delete()
        renumber_column(project.pk, task_status)

    @extend_schema(request=TaskMoveSerializer, responses=TaskSerializer)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def move(self, request, pk=None):
        """Drag-and-drop: move a task to `status` at `position` (0-based) and reorder both columns."""
        task = self.get_object()
        require_role(request.user, task.project.organization_id, Role.MEMBER)
        ensure_project_writable(task.project)
        serializer = TaskMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        old_status = task.status

        column = list(
            Task.objects.select_for_update()
            .filter(project=task.project, status=new_status)
            .exclude(pk=task.pk)
            .order_by("position", "id")
        )
        position = min(serializer.validated_data["position"], len(column))
        column.insert(position, task)

        apply_status(task, new_status)
        task.position = position
        task.save(update_fields=["status", "position", "completed_at", "updated_at"])
        for index, other in enumerate(column):
            if other.pk != task.pk and other.position != index:
                Task.objects.filter(pk=other.pk).update(position=index)
        if old_status != new_status:
            renumber_column(task.project_id, old_status)
            log_activity(
                task.project.organization, request.user, "task_moved",
                f'moved "{task.title}" from {STATUS_LABELS[old_status]} to {STATUS_LABELS[new_status]}',
                task.project, task,
            )
            if new_status == Task.Status.COMPLETED:
                notify_completed(task, request.user)
        return Response(self.get_serializer(self.get_queryset().get(pk=task.pk)).data)


class CommentViewSet(viewsets.ModelViewSet):
    """Discussion on a task. Authors edit their own comments; admins/owners can delete any."""

    serializer_class = CommentSerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Comment.objects.none()
        qs = Comment.objects.filter(task__project__organization__in=user_organization_ids(self.request.user))
        task_id = query_int(self.request, "task")
        if task_id:
            qs = qs.filter(task_id=task_id)
        return qs.select_related("author").order_by("created_at")

    def perform_create(self, serializer):
        task = serializer.validated_data["task"]
        require_role(self.request.user, task.project.organization_id, Role.MEMBER)
        ensure_project_writable(task.project)
        comment = serializer.save(author=self.request.user)
        log_activity(task.project.organization, self.request.user, "commented", f'commented on "{task.title}"', task.project, task)
        participants = [task.assignee, task.created_by, *(c.author for c in task.comments.exclude(pk=comment.pk).select_related("author"))]
        preview = comment.body if len(comment.body) <= 120 else comment.body[:117] + "..."
        notify(
            participants,
            actor=self.request.user,
            verb="commented",
            message=f'commented on "{task.title}": {preview}',
            organization=task.project.organization,
            task=task,
        )

    def perform_update(self, serializer):
        if serializer.instance.author_id != self.request.user.pk:
            raise PermissionDenied("You can only edit your own comments.")
        serializer.save()

    def perform_destroy(self, instance):
        organization_id = instance.task.project.organization_id
        if instance.author_id != self.request.user.pk:
            require_role(self.request.user, organization_id, Role.ADMIN)
        instance.delete()


class LabelViewSet(viewsets.ModelViewSet):
    """Organization-wide task labels. Members can create labels; admins and owners rename or delete them.

    Filters: ?organization=<id>
    """

    serializer_class = LabelSerializer
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Label.objects.none()
        qs = Label.objects.filter(organization__in=user_organization_ids(self.request.user))
        organization_id = query_int(self.request, "organization")
        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        return qs.order_by("name")

    def perform_create(self, serializer):
        require_role(self.request.user, serializer.validated_data["organization"].pk, Role.MEMBER)
        serializer.save()

    def perform_update(self, serializer):
        require_role(self.request.user, serializer.instance.organization_id, Role.ADMIN)
        serializer.save()

    def perform_destroy(self, instance):
        require_role(self.request.user, instance.organization_id, Role.ADMIN)
        instance.delete()


class AttachmentViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """Files attached to tasks. Upload with multipart/form-data (`task`, `file`).

    Members can upload to active projects; the uploader or an admin/owner can delete.
    Filters: ?task=<id>
    """

    serializer_class = AttachmentSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Attachment.objects.none()
        qs = Attachment.objects.filter(
            task__project__organization__in=user_organization_ids(self.request.user)
        ).select_related("uploaded_by", "task__project")
        task_id = query_int(self.request, "task")
        if task_id:
            qs = qs.filter(task_id=task_id)
        return qs.order_by("-created_at", "-id")

    def perform_create(self, serializer):
        task = serializer.validated_data["task"]
        require_role(self.request.user, task.project.organization_id, Role.MEMBER)
        ensure_project_writable(task.project)
        upload = serializer.validated_data["file"]
        attachment = serializer.save(
            uploaded_by=self.request.user,
            name=upload.name[:255],
            size=upload.size,
            content_type=(getattr(upload, "content_type", "") or "")[:120],
        )
        log_activity(
            task.project.organization, self.request.user, "attached",
            f'attached "{attachment.name}" to "{task.title}"', task.project, task,
        )

    def perform_destroy(self, instance):
        project = instance.task.project
        if instance.uploaded_by_id != self.request.user.pk:
            require_role(self.request.user, project.organization_id, Role.ADMIN)
        ensure_project_writable(project)
        log_activity(
            project.organization, self.request.user, "attachment_deleted",
            f'removed the attachment "{instance.name}" from "{instance.task.title}"', project, instance.task,
        )
        instance.file.delete(save=False)
        instance.delete()

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        attachment = self.get_object()
        try:
            handle = attachment.file.open("rb")
        except FileNotFoundError:
            raise ValidationError({"detail": "This file is no longer available."})
        return FileResponse(
            handle,
            as_attachment=True,
            filename=attachment.name,
            content_type=attachment.content_type or "application/octet-stream",
        )


class SearchView(APIView):
    """Search projects and tasks in one organization: ?organization=<id>&q=<text> (at least 2 characters)."""

    @extend_schema(
        parameters=[
            OpenApiParameter("organization", OpenApiTypes.INT, required=True),
            OpenApiParameter("q", OpenApiTypes.STR, required=True),
        ],
        responses=SearchResultSerializer,
    )
    def get(self, request):
        organization_id = query_int(request, "organization")
        if not organization_id:
            raise ValidationError({"organization": "This query parameter is required."})
        require_role(request.user, organization_id)
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response({"projects": [], "tasks": []})

        projects = annotate_progress(
            Project.objects.filter(organization_id=organization_id)
            .filter(Q(name__icontains=query) | Q(description__icontains=query))
            .select_related("team", "created_by")
        ).order_by("status", "-updated_at")[:10]
        task_ids = (
            Task.objects.filter(project__organization_id=organization_id)
            .filter(Q(title__icontains=query) | Q(description__icontains=query) | Q(labels__name__icontains=query))
            .values("pk")
        )
        tasks = with_task_details(Task.objects.filter(pk__in=task_ids)).order_by("-updated_at")[:25]
        return Response(
            {
                "projects": ProjectSerializer(projects, many=True).data,
                "tasks": TaskSerializer(tasks, many=True).data,
            }
        )


class ActivityViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Read-only activity history. Filters: ?organization=&project=&task=&limit= (max 200)."""

    serializer_class = ActivitySerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Activity.objects.none()
        qs = Activity.objects.filter(organization__in=user_organization_ids(self.request.user)).select_related(
            "actor", "project", "task"
        )
        for param in ("organization", "project", "task"):
            value = query_int(self.request, param)
            if value:
                qs = qs.filter(**{f"{param}_id": value})
        limit = min(query_int(self.request, "limit") or 50, 200)
        return qs.order_by("-created_at", "-id")[:limit]


class DashboardView(APIView):
    """Aggregated progress for one organization: ?organization=<id>."""

    @extend_schema(
        parameters=[OpenApiParameter("organization", OpenApiTypes.INT, required=True)],
        responses=OpenApiTypes.OBJECT,
    )
    def get(self, request):
        organization_id = query_int(request, "organization")
        if not organization_id:
            raise ValidationError({"organization": "This query parameter is required."})
        role = require_role(request.user, organization_id)
        today = timezone.localdate()

        projects = Project.objects.filter(organization_id=organization_id)
        active_projects = annotate_progress(projects.filter(status=Project.Status.ACTIVE)).select_related(
            "team", "created_by"
        )
        tasks = Task.objects.filter(project__organization_id=organization_id, project__status=Project.Status.ACTIVE)
        open_tasks = tasks.exclude(status=Task.Status.COMPLETED)

        counts = dict(tasks.order_by().values_list("status").annotate(c=Count("id")).values_list("status", "c"))
        total = sum(counts.values())
        completed = counts.get(Task.Status.COMPLETED, 0)
        priority_counts = dict(open_tasks.order_by().values_list("priority").annotate(c=Count("id")).values_list("priority", "c"))

        my_tasks = (
            with_task_details(open_tasks.filter(assignee=request.user))
            .order_by(F("due_date").asc(nulls_last=True), "-created_at")[:8]
        )
        recent = (
            Activity.objects.filter(organization_id=organization_id)
            .select_related("actor", "project", "task")
            .order_by("-created_at", "-id")[:10]
        )

        return Response(
            {
                "role": role,
                "member_count": Membership.objects.filter(organization_id=organization_id).count(),
                "projects": {
                    "total": projects.count(),
                    "active": projects.filter(status=Project.Status.ACTIVE).count(),
                    "archived": projects.filter(status=Project.Status.ARCHIVED).count(),
                },
                "tasks": {
                    "total": total,
                    "todo": counts.get(Task.Status.TODO, 0),
                    "in_progress": counts.get(Task.Status.IN_PROGRESS, 0),
                    "completed": completed,
                    "overdue": open_tasks.filter(due_date__lt=today).count(),
                    "completion_rate": round(completed * 100 / total) if total else 0,
                },
                "open_by_priority": {p: priority_counts.get(p, 0) for p in Task.Priority.values},
                "project_progress": ProjectSerializer(active_projects.order_by("-updated_at"), many=True).data,
                "my_tasks": TaskSerializer(my_tasks, many=True).data,
                "recent_activity": ActivitySerializer(recent, many=True).data,
            }
        )
