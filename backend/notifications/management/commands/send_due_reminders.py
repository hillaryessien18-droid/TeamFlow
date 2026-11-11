from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from notifications.models import Notification
from notifications.services import notify
from projects.models import Project, Task


class Command(BaseCommand):
    help = "Remind assignees about open tasks due today or tomorrow. Run once a day, e.g. from a cron job."

    def handle(self, *args, **options):
        today = timezone.localdate()
        tasks = (
            Task.objects.filter(
                due_date__in=[today, today + timedelta(days=1)],
                assignee__isnull=False,
                project__status=Project.Status.ACTIVE,
            )
            .exclude(status=Task.Status.COMPLETED)
            .select_related("assignee", "project__organization")
        )

        sent = 0
        for task in tasks:
            # Safe to run more than once a day: each task is reminded at most once per day.
            if Notification.objects.filter(
                recipient=task.assignee, task=task, verb="task_due", created_at__date=today
            ).exists():
                continue
            when = "today" if task.due_date == today else "tomorrow"
            notify(
                [task.assignee],
                actor=None,
                verb="task_due",
                message=f'reminds you that "{task.title}" is due {when}',
                organization=task.project.organization,
                task=task,
                email_subject=f'Due {when}: "{task.title}"',
            )
            sent += 1
        self.stdout.write(self.style.SUCCESS(f"Sent {sent} due-date reminder(s)."))
