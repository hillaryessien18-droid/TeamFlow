"""Create in-app notifications and send the matching emails.

Emails go out after the surrounding transaction commits, and a mail failure never
breaks the request that triggered it.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from .models import Notification

logger = logging.getLogger(__name__)


def task_link(task):
    return f"/projects/{task.project_id}?task={task.pk}"


def send_email_later(recipient_email, subject, body):
    def _send():
        try:
            send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [recipient_email])
        except Exception:  # Mail outages must not break the API.
            logger.exception("Failed to send email to %s", recipient_email)

    transaction.on_commit(_send)


def notify(recipients, *, actor, verb, message, organization=None, task=None, link="", email_subject=None):
    """Notify each recipient, skipping the actor, inactive users and duplicates.

    `message` is written to follow the actor's name, e.g. 'assigned you to "Fix login"'.
    """
    project = task.project if task is not None else None
    if task is not None and not link:
        link = task_link(task)
    actor_name = actor.full_name if actor else "TeamFlow"
    seen = set()
    created = []
    for user in recipients:
        if user is None or user.pk in seen or (actor and user.pk == actor.pk) or not user.is_active:
            continue
        seen.add(user.pk)
        created.append(
            Notification.objects.create(
                recipient=user,
                actor=actor,
                organization=organization,
                project=project,
                task=task,
                verb=verb,
                message=message[:500],
                link=link,
            )
        )
        if user.email_notifications:
            url = f"{settings.FRONTEND_URL}{link}"
            send_email_later(
                user.email,
                (email_subject or f"{actor_name} {message}")[:150],
                f"Hi {user.full_name},\n\n{actor_name} {message}.\n\nOpen it in TeamFlow:\n{url}\n\n"
                "You can turn off email notifications on your TeamFlow profile page.",
            )
    return created
