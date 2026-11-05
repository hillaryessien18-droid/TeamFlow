from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, OuterRef, Subquery
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from projects.activity import log_activity
from projects.models import Task

from .models import Membership, Organization, Team
from .permissions import Role, query_int, require_role, user_organization_ids
from .serializers import MembershipCreateSerializer, MembershipSerializer, OrganizationSerializer, TeamSerializer

User = get_user_model()


class OrganizationViewSet(viewsets.ModelViewSet):
    """Organizations the current user belongs to. Creating one makes you its owner."""

    serializer_class = OrganizationSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Organization.objects.none()
        user = self.request.user
        my_role = Membership.objects.filter(organization=OuterRef("pk"), user=user).values("role")[:1]
        return (
            Organization.objects.filter(pk__in=user_organization_ids(user))
            .annotate(
                my_role=Subquery(my_role),
                member_count=Count("memberships", distinct=True),
                project_count=Count("projects", distinct=True),
            )
            .order_by("name")
        )

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        organization = serializer.save(created_by=user)
        Membership.objects.create(organization=organization, user=user, role=Role.OWNER)
        log_activity(organization, user, "created", f'created the organization "{organization.name}"')

    def perform_update(self, serializer):
        require_role(self.request.user, serializer.instance.pk, Role.ADMIN)
        organization = serializer.save()
        log_activity(organization, self.request.user, "updated", "updated organization settings")

    def perform_destroy(self, instance):
        require_role(self.request.user, instance.pk, Role.OWNER)
        instance.delete()


class MembershipViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Members of an organization and their roles.

    - Admins and owners can add people (by the email they registered with) and change roles.
    - Only owners can grant the owner role or modify/remove another owner.
    - Anyone can leave, except the last remaining owner.
    """

    serializer_class = MembershipSerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Membership.objects.none()
        qs = Membership.objects.filter(organization__in=user_organization_ids(self.request.user)).select_related("user")
        organization_id = query_int(self.request, "organization")
        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        return qs.order_by("joined_at")

    @extend_schema(request=MembershipCreateSerializer, responses={201: MembershipSerializer})
    def create(self, request, *args, **kwargs):
        serializer = MembershipCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        organization = data["organization"]

        actor_role = require_role(request.user, organization.pk, Role.ADMIN)
        if data["role"] == Role.OWNER and actor_role != Role.OWNER:
            raise PermissionDenied("Only owners can add another owner.")

        invitee = User.objects.filter(email__iexact=data["email"], is_active=True).first()
        if invitee is None:
            raise ValidationError({"email": "No TeamFlow account uses this email. Ask them to sign up first."})
        if Membership.objects.filter(organization=organization, user=invitee).exists():
            raise ValidationError({"email": "This person is already a member."})

        membership = Membership.objects.create(organization=organization, user=invitee, role=data["role"])
        log_activity(organization, request.user, "member_added", f"added {invitee.full_name} as {data['role']}")
        return Response(MembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        membership = self.get_object()
        actor_role = require_role(request.user, membership.organization_id, Role.ADMIN)

        new_role = request.data.get("role")
        if new_role not in Role.values:
            raise ValidationError({"role": f"Must be one of: {', '.join(Role.values)}."})
        if Role.OWNER in (membership.role, new_role) and actor_role != Role.OWNER:
            raise PermissionDenied("Only owners can grant or change the owner role.")
        if membership.role == Role.OWNER and new_role != Role.OWNER:
            self._ensure_not_last_owner(membership)

        membership.role = new_role
        membership.save(update_fields=["role"])
        log_activity(
            membership.organization,
            request.user,
            "role_changed",
            f"changed {membership.user.full_name}'s role to {new_role}",
        )
        return Response(MembershipSerializer(membership).data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        membership = self.get_object()
        organization = membership.organization
        leaving = membership.user_id == request.user.pk

        if not leaving:
            actor_role = require_role(request.user, organization.pk, Role.ADMIN)
            if membership.role == Role.OWNER and actor_role != Role.OWNER:
                raise PermissionDenied("Only owners can remove another owner.")
        if membership.role == Role.OWNER:
            self._ensure_not_last_owner(membership)

        user = membership.user
        Task.objects.filter(project__organization=organization, assignee=user).update(assignee=None)
        for team in Team.objects.filter(organization=organization, members=user):
            team.members.remove(user)
        membership.delete()

        message = "left the organization" if leaving else f"removed {user.full_name} from the organization"
        log_activity(organization, request.user, "member_removed", message)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _ensure_not_last_owner(membership):
        owners = Membership.objects.filter(organization_id=membership.organization_id, role=Role.OWNER)
        if owners.count() <= 1:
            raise ValidationError({"detail": "An organization must keep at least one owner."})


class TeamViewSet(viewsets.ModelViewSet):
    """Teams group members inside an organization. Admins and owners manage them."""

    serializer_class = TeamSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Team.objects.none()
        qs = Team.objects.filter(organization__in=user_organization_ids(self.request.user)).prefetch_related("members")
        organization_id = query_int(self.request, "organization")
        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        return qs.order_by("name")

    def perform_create(self, serializer):
        organization = serializer.validated_data["organization"]
        require_role(self.request.user, organization.pk, Role.ADMIN)
        team = serializer.save()
        log_activity(organization, self.request.user, "team_created", f'created the team "{team.name}"')

    def perform_update(self, serializer):
        require_role(self.request.user, serializer.instance.organization_id, Role.ADMIN)
        team = serializer.save()
        log_activity(team.organization, self.request.user, "team_updated", f'updated the team "{team.name}"')

    def perform_destroy(self, instance):
        require_role(self.request.user, instance.organization_id, Role.ADMIN)
        log_activity(instance.organization, self.request.user, "team_deleted", f'deleted the team "{instance.name}"')
        instance.delete()
