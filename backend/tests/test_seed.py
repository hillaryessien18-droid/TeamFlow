from django.core.management import call_command

from organizations.models import Membership, Organization
from projects.models import Project, Task


def test_seed_demo_is_idempotent_and_resettable():
    call_command("seed_demo")
    call_command("seed_demo")  # second run is a no-op
    org = Organization.objects.get(name="Acme Studio")
    assert set(Membership.objects.filter(organization=org).values_list("role", flat=True)) == {"owner", "admin", "member"}
    assert Project.objects.filter(organization=org, status="archived").count() == 1
    task_count = Task.objects.filter(project__organization=org).count()
    assert task_count > 0

    call_command("seed_demo", reset=True)
    assert Organization.objects.filter(name="Acme Studio").count() == 1
    assert Task.objects.filter(project__organization__name="Acme Studio").count() == task_count
