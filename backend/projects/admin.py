from django.contrib import admin

from .models import Activity, Comment, Project, Task


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "status", "due_date", "updated_at")
    list_filter = ("status",)
    search_fields = ("name",)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "status", "priority", "assignee", "due_date")
    list_filter = ("status", "priority")
    search_fields = ("title",)


admin.site.register(Comment)


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "message", "organization")
    readonly_fields = [f.name for f in Activity._meta.fields]
