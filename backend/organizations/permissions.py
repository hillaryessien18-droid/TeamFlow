"""Role-based access helpers shared by every organization-scoped endpoint.

Roles are ranked owner > admin > member. Non-members get a 404 rather than a 403
so the API never confirms that an organization they can't see exists.
"""
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from .models import Membership

Role = Membership.Role

ROLE_RANK = {Role.MEMBER: 1, Role.ADMIN: 2, Role.OWNER: 3}


def get_role(user, organization_id):
    return (
        Membership.objects.filter(user=user, organization_id=organization_id).values_list("role", flat=True).first()
    )


def require_role(user, organization_id, minimum=Role.MEMBER):
    """Return the user's role in the organization, or raise if it is below `minimum`."""
    role = get_role(user, organization_id)
    if role is None:
        raise NotFound("Organization not found.")
    if ROLE_RANK[role] < ROLE_RANK[minimum]:
        raise PermissionDenied(f"This action requires the {Role(minimum).label} role or higher.")
    return role


def user_organization_ids(user):
    return Membership.objects.filter(user=user).values("organization_id")


def query_int(request, name):
    """Read an optional integer query parameter, rejecting junk with a 400."""
    value = request.query_params.get(name)
    if value in (None, ""):
        return None
    try:
        return int(value)
    except ValueError:
        raise ValidationError({name: "Must be an integer."})
