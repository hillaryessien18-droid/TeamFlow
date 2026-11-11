from django.conf import settings
from django.db import models


class Notification(models.Model):
    """Something a user should know about: an assignment, a comment, an accepted invitation…"""

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, null=True, blank=True, related_name="notifications"
    )
    project = models.ForeignKey("projects.Project", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    task = models.ForeignKey("projects.Task", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    verb = models.CharField(max_length=40)
    message = models.CharField(max_length=500)
    # Frontend path to open when the notification is clicked, e.g. "/projects/3?task=12".
    link = models.CharField(max_length=300, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["recipient", "read_at"])]

    def __str__(self):
        return f"To {self.recipient}: {self.message}"
