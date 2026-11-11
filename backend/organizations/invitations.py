"""Adding people to organizations, directly or through emailed invitations."""
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from notifications.services import notify, send_email_later
from projects.activity import log_activity

from .models import Membership


def add_member(organization, actor, user, role):
    """Add an existing account to the organization and let them know."""
    membership = Membership.objects.create(organization=organization, user=user, role=role)
    log_activity(organization, actor, "member_added", f"added {user.full_name} as {role}")
    notify(
        [user],
        actor=actor,
        verb="member_added",
        message=f'added you to "{organization.name}" as {Membership.Role(role).label}',
        organization=organization,
        link="/",
    )
    return membership

def invitation_link(invitation):
    return f"{settings.FRONTEND_URL}/invite/{invitation.token}"


def send_invitation_email(invitation):
    inviter = invitation.invited_by.full_name if invitation.invited_by else "Someone"
    send_email_later(
        invitation.email,
        f'{inviter} invited you to join "{invitation.organization.name}" on TeamFlow',
        (
            f"Hi,\n\n{inviter} invited you to join \"{invitation.organization.name}\" on TeamFlow "
            f"as {Membership.Role(invitation.role).label}.\n\n"
            f"Accept the invitation here:\n{invitation_link(invitation)}\n\n"
            f"This link expires on {invitation.expires_at:%B %d, %Y}. "
            "If you weren't expecting it, you can ignore this email."
        ),
    )


@transaction.atomic
def accept_invitation(invitation, user):
    """Turn a pending invitation into a membership. Returns the membership (existing or new)."""
    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=["accepted_at"])
    membership = Membership.objects.filter(organization=invitation.organization, user=user).first()
    if membership:
        return membership
    membership = Membership.objects.create(organization=invitation.organization, user=user, role=invitation.role)
    log_activity(invitation.organization, user, "member_joined", f"joined the organization as {invitation.role}")
    notify(
        [invitation.invited_by],
        actor=user,
        verb="invitation_accepted",
        message=f'accepted your invitation to "{invitation.organization.name}"',
        organization=invitation.organization,
        link="/team",
    )
    return membership
