from django.conf import settings
from django.db import models


class Organization(models.Model):
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_organizations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, through="Membership", related_name="organizations")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Membership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["organization", "user"], name="unique_org_membership")]
        ordering = ["joined_at"]

    def __str__(self):
        return f"{self.user} @ {self.organization} ({self.role})"


class Team(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="teams", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["organization", "name"], name="unique_team_name_per_org")]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.organization})"
