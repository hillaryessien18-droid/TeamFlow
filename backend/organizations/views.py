from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, OuterRef, Subquery
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from projects.activity import log_activity
from projects.models import Task

from .invitations import accept_invitation, add_member, send_invitation_email
from .models import Invitation, Membership, Organization, Team, default_invitation_expiry
from .permissions import Role, query_int, require_role, user_organization_ids
from .serializers import (
    InvitationCreateSerializer,
    InvitationPreviewSerializer,
    InvitationResultSerializer,
    InvitationSerializer,
    InvitationTokenSerializer,
    MembershipCreateSerializer,
    MembershipSerializer,
    OrganizationSerializer,
    TeamSerializer,
)

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

        membership = add_member(organization, request.user, invitee, data["role"])
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


class InvitationViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Invite people by email. Admins and owners manage their organizations' invitations.

    Inviting an email that already has an account adds that person immediately; anyone else
    gets an emailed link and joins when they accept it or sign up with that email.
    Lists pending invitations only. Filters: ?organization=<id>.
    """

    serializer_class = InvitationSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Invitation.objects.none()
        managed = Membership.objects.filter(user=self.request.user, role__in=[Role.ADMIN, Role.OWNER]).values(
            "organization_id"
        )
        qs = Invitation.objects.filter(organization__in=managed, accepted_at__isnull=True).select_related(
            "invited_by", "organization"
        )
        organization_id = query_int(self.request, "organization")
        if organization_id:
            qs = qs.filter(organization_id=organization_id)
        return qs.order_by("-created_at")

    @extend_schema(request=InvitationCreateSerializer, responses={201: InvitationResultSerializer})
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = InvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        organization, email, role = data["organization"], data["email"], data["role"]

        actor_role = require_role(request.user, organization.pk, Role.ADMIN)
        if role == Role.OWNER and actor_role != Role.OWNER:
            raise PermissionDenied("Only owners can invite another owner.")

        existing = User.objects.filter(email__iexact=email, is_active=True).first()
        if existing:
            if Membership.objects.filter(organization=organization, user=existing).exists():
                raise ValidationError({"email": "This person is already a member."})
            membership = add_member(organization, request.user, existing, role)
            return Response(
                {"status": "added", "membership": MembershipSerializer(membership).data},
                status=status.HTTP_201_CREATED,
            )

        invitation = Invitation.objects.filter(
            organization=organization, email__iexact=email, accepted_at__isnull=True
        ).first()
        if invitation:
            invitation.role = role
            invitation.invited_by = request.user
            invitation.expires_at = default_invitation_expiry()
            invitation.save(update_fields=["role", "invited_by", "expires_at"])
        else:
            invitation = Invitation.objects.create(
                organization=organization, email=email, role=role, invited_by=request.user
            )
        send_invitation_email(invitation)
        log_activity(organization, request.user, "member_invited", f"invited {email} as {role}")
        return Response(
            {"status": "invited", "invitation": InvitationSerializer(invitation).data},
            status=status.HTTP_201_CREATED,
        )

    def perform_destroy(self, instance):
        log_activity(
            instance.organization, self.request.user, "invitation_revoked", f"revoked the invitation for {instance.email}"
        )
        instance.delete()

    @extend_schema(request=None)
    @action(detail=True, methods=["post"])
    def resend(self, request, pk=None):
        invitation = self.get_object()
        invitation.expires_at = default_invitation_expiry()
        invitation.save(update_fields=["expires_at"])
        send_invitation_email(invitation)
        return Response(InvitationSerializer(invitation).data)

    @extend_schema(
        parameters=[OpenApiParameter("token", OpenApiTypes.STR, required=True)],
        responses=InvitationPreviewSerializer,
    )
    @action(detail=False, methods=["get"], permission_classes=[AllowAny], authentication_classes=[])
    def lookup(self, request):
        """Public: describe an invitation link so the invite page can show it before signing in."""
        invitation = self._by_token(request.query_params.get("token"))
        if invitation.accepted_at:
            invite_status = "accepted"
        elif invitation.is_expired:
            invite_status = "expired"
        else:
            invite_status = "pending"
        return Response(
            {
                "organization_name": invitation.organization.name,
                "email": invitation.email,
                "role": invitation.role,
                "invited_by": invitation.invited_by.full_name if invitation.invited_by else None,
                "status": invite_status,
                "account_exists": User.objects.filter(email__iexact=invitation.email).exists(),
            }
        )

    @extend_schema(request=InvitationTokenSerializer, responses=MembershipSerializer)
    @action(detail=False, methods=["post"])
    def accept(self, request):
        serializer = InvitationTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = self._by_token(serializer.validated_data["token"])
        if invitation.accepted_at:
            raise ValidationError({"detail": "This invitation has already been used."})
        if invitation.is_expired:
            raise ValidationError({"detail": "This invitation has expired. Ask for a new one."})
        if invitation.email.lower() != request.user.email.lower():
            raise PermissionDenied(
                f"This invitation was sent to {invitation.email}. Log in with that account to accept it."
            )
        return Response(MembershipSerializer(accept_invitation(invitation, request.user)).data)

    @staticmethod
    def _by_token(token):
        invitation = None
        if token:
            invitation = Invitation.objects.filter(token=token).select_related("organization", "invited_by").first()
        if invitation is None:
            raise NotFound("This invitation link is invalid.")
        return invitation
