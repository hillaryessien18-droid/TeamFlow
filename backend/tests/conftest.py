import itertools

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.models import User
from organizations.models import Membership, Organization
from projects.models import Project, Task

_counter = itertools.count()


@pytest.fixture(autouse=True)
def _isolate(db, settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    cache.clear()  # reset throttle counters between tests


@pytest.fixture
def make_user():
    def _make(email=None, password="S3cure-pass!", full_name="Test User"):
        email = email or f"user{next(_counter)}@example.com"
        return User.objects.create_user(email=email, password=password, full_name=full_name)

    return _make


@pytest.fixture
def client_for():
    def _client(user=None):
        client = APIClient()
        if user is not None:
            client.force_authenticate(user)
        return client

    return _client


@pytest.fixture
def org_setup(make_user):
    """An organization with one user per role plus an outsider."""
    owner = make_user(full_name="Olivia Owner")
    admin = make_user(full_name="Adam Admin")
    member = make_user(full_name="Mia Member")
    outsider = make_user(full_name="Oscar Outsider")
    org = Organization.objects.create(name="Acme", created_by=owner)
    Membership.objects.create(organization=org, user=owner, role="owner")
    Membership.objects.create(organization=org, user=admin, role="admin")
    Membership.objects.create(organization=org, user=member, role="member")
    return {"org": org, "owner": owner, "admin": admin, "member": member, "outsider": outsider}


@pytest.fixture
def project(org_setup):
    return Project.objects.create(organization=org_setup["org"], name="Website", created_by=org_setup["owner"])


@pytest.fixture
def make_task(project, org_setup):
    def _make(**kwargs):
        defaults = {"project": project, "title": "Task", "created_by": org_setup["owner"]}
        defaults.update(kwargs)
        return Task.objects.create(**defaults)

    return _make
