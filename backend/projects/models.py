from django.conf import settings
from django.db import models
from django.utils import timezone

from organizations.models import Organization, Team


class Project(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="projects")
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name="projects")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    due_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_projects"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["organization", "status"])]

    def __str__(self):
        return self.name

    @property
    def is_archived(self):
        return self.status == self.Status.ARCHIVED


class Label(models.Model):
    """A colored tag (e.g. "bug", "design") shared by every project in an organization."""

    class Color(models.TextChoices):
        SLATE = "slate", "Slate"
        RED = "red", "Red"
        ORANGE = "orange", "Orange"
        AMBER = "amber", "Amber"
        EMERALD = "emerald", "Emerald"
        SKY = "sky", "Sky"
        VIOLET = "violet", "Violet"
        ROSE = "rose", "Rose"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="labels")
    name = models.CharField(max_length=40)
    color = models.CharField(max_length=10, choices=Color.choices, default=Color.SLATE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["organization", "name"], name="unique_label_name_per_org")]

    def __str__(self):
        return self.name


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "To Do"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TODO)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_tasks"
    )
    due_date = models.DateField(null=True, blank=True)
    labels = models.ManyToManyField(Label, related_name="tasks", blank=True)
    position = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_tasks"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["status", "position", "id"]
        indexes = [
            models.Index(fields=["project", "status", "position"]),
            models.Index(fields=["assignee", "status"]),
        ]

    def __str__(self):
        return self.title

    @property
    def is_overdue(self):
        return bool(self.due_date and self.status != self.Status.COMPLETED and self.due_date < timezone.localdate())


class Comment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments")
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.author} on {self.task}"


class Attachment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="attachments/%Y/%m/")
    name = models.CharField(max_length=255)
    size = models.PositiveBigIntegerField()
    content_type = models.CharField(max_length=120, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="attachments"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.name


class Activity(models.Model):
    """An append-only audit trail. Links are SET_NULL so history survives deletions."""

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="activities")
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name="activities")
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="activities")
    verb = models.CharField(max_length=40)
    message = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name_plural = "activities"
        indexes = [models.Index(fields=["organization", "-created_at"])]

    def __str__(self):
        return f"{self.actor} {self.message}"
