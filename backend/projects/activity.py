def log_activity(organization, actor, verb, message, project=None, task=None):
    from .models import Activity

    return Activity.objects.create(
        organization=organization,
        actor=actor,
        verb=verb,
        message=message[:500],
        project=project,
        task=task,
    )
