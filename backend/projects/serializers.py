from rest_framework import serializers

from accounts.serializers import UserSerializer
from organizations.models import Membership

from .models import Activity, Comment, Project, Task


class ProjectSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True, default=None)
    task_count = serializers.SerializerMethodField()
    completed_count = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "organization",
            "team",
            "team_name",
            "name",
            "description",
            "status",
            "due_date",
            "created_by",
            "created_at",
            "updated_at",
            "task_count",
            "completed_count",
            "progress",
        ]
        # Status changes go through the archive/unarchive actions so they are logged explicitly.
        read_only_fields = ["id", "status", "created_by", "created_at", "updated_at"]

    def get_task_count(self, obj) -> int:
        if hasattr(obj, "task_count"):
            return obj.task_count
        return obj.tasks.count()

    def get_completed_count(self, obj) -> int:
        if hasattr(obj, "completed_count"):
            return obj.completed_count
        return obj.tasks.filter(status=Task.Status.COMPLETED).count()

    def get_progress(self, obj) -> int:
        total = self.get_task_count(obj)
        return round(self.get_completed_count(obj) * 100 / total) if total else 0

    def validate(self, attrs):
        if self.instance and "organization" in attrs and attrs["organization"] != self.instance.organization:
            raise serializers.ValidationError({"organization": "A project cannot be moved to another organization."})
        organization = self.instance.organization if self.instance else attrs.get("organization")
        team = attrs.get("team")
        if team and team.organization_id != organization.pk:
            raise serializers.ValidationError({"team": "Team must belong to the project's organization."})
        return attrs


class TaskSerializer(serializers.ModelSerializer):
    assignee_detail = UserSerializer(source="assignee", read_only=True)
    created_by = UserSerializer(read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    comment_count = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "project",
            "project_name",
            "title",
            "description",
            "status",
            "priority",
            "assignee",
            "assignee_detail",
            "due_date",
            "position",
            "created_by",
            "created_at",
            "updated_at",
            "completed_at",
            "comment_count",
            "is_overdue",
        ]
        read_only_fields = ["id", "position", "created_by", "created_at", "updated_at", "completed_at"]

    def get_comment_count(self, obj) -> int:
        if hasattr(obj, "comment_count"):
            return obj.comment_count
        return obj.comments.count()

    def validate_title(self, value):
        if not value.strip():
            raise serializers.ValidationError("Title cannot be blank.")
        return value.strip()

    def validate(self, attrs):
        if self.instance and "project" in attrs and attrs["project"] != self.instance.project:
            raise serializers.ValidationError({"project": "A task cannot be moved to another project."})
        project = self.instance.project if self.instance else attrs.get("project")
        assignee = attrs.get("assignee")
        if assignee and not Membership.objects.filter(organization_id=project.organization_id, user=assignee).exists():
            raise serializers.ValidationError({"assignee": "Assignee must be a member of this organization."})
        return attrs


class TaskMoveSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Task.Status.choices)
    position = serializers.IntegerField(min_value=0)


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "task", "author", "body", "created_at", "updated_at"]
        read_only_fields = ["id", "author", "created_at", "updated_at"]

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError("Comment cannot be empty.")
        return value.strip()

    def validate(self, attrs):
        if self.instance and "task" in attrs and attrs["task"] != self.instance.task:
            raise serializers.ValidationError({"task": "A comment cannot be moved to another task."})
        return attrs


class ActivitySerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True, default=None)
    task_title = serializers.CharField(source="task.title", read_only=True, default=None)

    class Meta:
        model = Activity
        fields = [
            "id",
            "organization",
            "project",
            "project_name",
            "task",
            "task_title",
            "actor",
            "verb",
            "message",
            "created_at",
        ]
