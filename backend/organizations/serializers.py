from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import Membership, Organization, Team
from .permissions import get_role

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    my_role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ["id", "name", "description", "created_at", "my_role", "member_count", "project_count"]
        read_only_fields = ["id", "created_at"]

    # The list view annotates these; fall back to queries for freshly created objects.
    def get_my_role(self, obj) -> str | None:
        if hasattr(obj, "my_role"):
            return obj.my_role
        return get_role(self.context["request"].user, obj.pk)

    def get_member_count(self, obj) -> int:
        if hasattr(obj, "member_count"):
            return obj.member_count
        return obj.memberships.count()

    def get_project_count(self, obj) -> int:
        if hasattr(obj, "project_count"):
            return obj.project_count
        return obj.projects.count()


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "organization", "user", "role", "joined_at"]
        read_only_fields = ["id", "organization", "user", "joined_at"]


class MembershipCreateSerializer(serializers.Serializer):
    organization = serializers.PrimaryKeyRelatedField(queryset=Organization.objects.all())
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=Membership.Role.choices, default=Membership.Role.MEMBER)


class TeamSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, required=False, source="members", queryset=User.objects.all()
    )

    class Meta:
        model = Team
        fields = ["id", "organization", "name", "description", "members", "member_ids", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        organization = self.instance.organization if self.instance else attrs.get("organization")
        if self.instance and "organization" in attrs and attrs["organization"] != self.instance.organization:
            raise serializers.ValidationError({"organization": "A team cannot be moved to another organization."})

        name = attrs.get("name")
        if name:
            clash = Team.objects.filter(organization=organization, name__iexact=name)
            if self.instance:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                raise serializers.ValidationError({"name": "A team with this name already exists."})

        members = attrs.get("members")
        if members:
            member_ids = set(
                Membership.objects.filter(organization=organization, user__in=members).values_list("user_id", flat=True)
            )
            outsiders = [u.email for u in members if u.pk not in member_ids]
            if outsiders:
                raise serializers.ValidationError(
                    {"member_ids": f"Not members of this organization: {', '.join(outsiders)}"}
                )
        return attrs
