from django.contrib import admin

from .models import Invitation, Membership, Organization, Team


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "created_by", "created_at")
    search_fields = ("name",)
    inlines = [MembershipInline]


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "created_at")
    filter_horizontal = ("members",)


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "organization", "role", "invited_by", "expires_at", "accepted_at")
    readonly_fields = ("token",)
