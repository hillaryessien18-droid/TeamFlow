from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone

from notifications.models import Notification
from organizations.models import Invitation, Membership, Organization
from projects.models import Attachment, Label, Project


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def run_on_commit(django_capture_on_commit_callbacks):
    """Emails are sent after commit; tests run inside a transaction, so run the callbacks explicitly."""
    return lambda: django_capture_on_commit_callbacks(execute=True)


# --- Labels -------------------------------------------------------------------------------------


def test_member_creates_label_but_only_admin_deletes(client_for, org_setup):
    org = org_setup["org"]
    res = client_for(org_setup["member"]).post("/api/labels/", {"organization": org.pk, "name": "Bug", "color": "red"})
    assert res.status_code == 201
    label_id = res.data["id"]

    dup = client_for(org_setup["admin"]).post("/api/labels/", {"organization": org.pk, "name": "bug"})
    assert dup.status_code == 400

    assert client_for(org_setup["member"]).delete(f"/api/labels/{label_id}/").status_code == 403
    assert client_for(org_setup["admin"]).delete(f"/api/labels/{label_id}/").status_code == 204


def test_outsider_cannot_see_labels(client_for, org_setup):
    Label.objects.create(organization=org_setup["org"], name="Bug")
    res = client_for(org_setup["outsider"]).get("/api/labels/", {"organization": org_setup["org"].pk})
    assert res.data == []


def test_task_labels_must_belong_to_the_organization(client_for, org_setup, project, make_user):
    mine = Label.objects.create(organization=org_setup["org"], name="Design")
    other_org = Organization.objects.create(name="Other")
    foreign = Label.objects.create(organization=other_org, name="Foreign")
    client = client_for(org_setup["member"])

    ok = client.post("/api/tasks/", {"project": project.pk, "title": "Logo", "label_ids": [mine.pk]}, format="json")
    assert ok.status_code == 201
    assert [label["name"] for label in ok.data["labels"]] == ["Design"]

    bad = client.post("/api/tasks/", {"project": project.pk, "title": "X", "label_ids": [foreign.pk]}, format="json")
    assert bad.status_code == 400
    assert "label_ids" in bad.data


def test_task_filters(client_for, org_setup, make_task):
    today = timezone.localdate()
    bug = Label.objects.create(organization=org_setup["org"], name="Bug")
    overdue = make_task(title="Late report", due_date=today - timedelta(days=2))
    due_today = make_task(title="Standup notes", due_date=today, assignee=org_setup["member"])
    make_task(title="Someday", due_date=None)
    overdue.labels.add(bug)
    client = client_for(org_setup["member"])

    def titles(**params):
        return {t["title"] for t in client.get("/api/tasks/", params).data}

    assert titles(label=bug.pk) == {"Late report"}
    assert titles(due="overdue") == {"Late report"}
    assert titles(due="today") == {"Standup notes"}
    assert titles(due="none") == {"Someday"}
    assert titles(assignee="none") == {"Late report", "Someday"}
    assert titles(search="report") == {"Late report"}
    assert due_today.title in titles(due="week")


# --- Search -------------------------------------------------------------------------------------


def test_search_finds_projects_and_tasks_by_text_and_label(client_for, org_setup, project, make_task):
    make_task(title="Fix checkout bug")
    tagged = make_task(title="Polish header")
    tagged.labels.add(Label.objects.create(organization=org_setup["org"], name="Frontend"))
    Project.objects.create(organization=org_setup["org"], name="Checkout revamp")

    res = client_for(org_setup["member"]).get("/api/search/", {"organization": org_setup["org"].pk, "q": "checkout"})
    assert res.status_code == 200
    assert [p["name"] for p in res.data["projects"]] == ["Checkout revamp"]
    assert [t["title"] for t in res.data["tasks"]] == ["Fix checkout bug"]

    by_label = client_for(org_setup["member"]).get("/api/search/", {"organization": org_setup["org"].pk, "q": "front"})
    assert [t["title"] for t in by_label.data["tasks"]] == ["Polish header"]


def test_search_requires_membership_and_ignores_short_queries(client_for, org_setup):
    org = org_setup["org"].pk
    assert client_for(org_setup["outsider"]).get("/api/search/", {"organization": org, "q": "web"}).status_code == 404
    short = client_for(org_setup["member"]).get("/api/search/", {"organization": org, "q": "w"})
    assert short.data == {"projects": [], "tasks": []}


# --- Attachments --------------------------------------------------------------------------------


def upload(client, task, name="notes.txt", content=b"hello"):
    file = SimpleUploadedFile(name, content, content_type="text/plain")
    return client.post("/api/attachments/", {"task": task.pk, "file": file}, format="multipart")


def test_upload_list_download_and_delete_attachment(client_for, org_setup, make_task):
    task = make_task()
    member = client_for(org_setup["member"])

    res = upload(member, task)
    assert res.status_code == 201
    assert res.data["name"] == "notes.txt"
    assert res.data["size"] == 5

    listed = member.get("/api/attachments/", {"task": task.pk})
    assert [a["name"] for a in listed.data] == ["notes.txt"]
    assert member.get(f"/api/tasks/{task.pk}/").data["attachment_count"] == 1

    download = member.get(f"/api/attachments/{res.data['id']}/download/")
    assert download.status_code == 200
    assert b"".join(download.streaming_content) == b"hello"
    assert "notes.txt" in download["Content-Disposition"]

    assert member.delete(f"/api/attachments/{res.data['id']}/").status_code == 204
    assert not Attachment.objects.exists()


def test_only_uploader_or_admin_deletes_attachments(client_for, org_setup, make_task):
    task = make_task()
    attachment_id = upload(client_for(org_setup["member"]), task).data["id"]
    other = Membership.objects.create(organization=org_setup["org"], user=org_setup["outsider"], role="member").user

    assert client_for(other).delete(f"/api/attachments/{attachment_id}/").status_code == 403
    assert client_for(org_setup["admin"]).delete(f"/api/attachments/{attachment_id}/").status_code == 204


def test_attachment_size_limit_and_outsiders(client_for, org_setup, make_task, settings):
    settings.MAX_ATTACHMENT_MB = 1
    task = make_task()
    too_big = upload(client_for(org_setup["member"]), task, content=b"x" * (1024 * 1024 + 1))
    assert too_big.status_code == 400

    outsider = upload(client_for(org_setup["outsider"]), task)
    assert outsider.status_code == 404  # non-members never learn the organization exists


def test_cannot_attach_to_archived_project(client_for, org_setup, make_task, project):
    task = make_task()
    project.status = Project.Status.ARCHIVED
    project.save()
    assert upload(client_for(org_setup["member"]), task).status_code == 400


# --- Invitations --------------------------------------------------------------------------------


def test_inviting_existing_account_adds_them_and_notifies(client_for, org_setup, run_on_commit):
    outsider = org_setup["outsider"]
    with run_on_commit():
        res = client_for(org_setup["admin"]).post(
            "/api/invitations/", {"organization": org_setup["org"].pk, "email": outsider.email.upper()}
        )
    assert res.status_code == 201
    assert res.data["status"] == "added"
    assert Membership.objects.filter(organization=org_setup["org"], user=outsider).exists()
    assert Notification.objects.filter(recipient=outsider, verb="member_added").exists()
    assert mail.outbox[0].to == [outsider.email]


def test_inviting_new_email_requires_emailed_token_after_signup(client_for, org_setup, run_on_commit):
    org = org_setup["org"]
    with run_on_commit():
        res = client_for(org_setup["admin"]).post(
            "/api/invitations/", {"organization": org.pk, "email": "New.Person@example.com", "role": "admin"}
        )
    assert res.status_code == 201
    assert res.data["status"] == "invited"
    invitation = Invitation.objects.get()
    assert invitation.email == "new.person@example.com"
    assert mail.outbox[0].to == ["new.person@example.com"]
    assert f"/invite/{invitation.token}" in mail.outbox[0].body

    preview = client_for().get("/api/invitations/lookup/", {"token": invitation.token})
    assert preview.status_code == 200
    assert preview.data["organization_name"] == "Acme"
    assert preview.data["status"] == "pending"
    assert preview.data["account_exists"] is False

    signup = client_for().post(
        "/api/auth/register/", {"email": "new.person@example.com", "full_name": "New Person", "password": "S3cure-pass!"}
    )
    assert signup.status_code == 201
    assert not Membership.objects.filter(organization=org, user__email="new.person@example.com").exists()
    invitation.refresh_from_db()
    assert invitation.accepted_at is None

    user = get_user_model().objects.get(email="new.person@example.com")
    accepted = client_for(user).post("/api/invitations/accept/", {"token": invitation.token})
    assert accepted.status_code == 200
    membership = Membership.objects.get(organization=org, user=user)
    assert membership.role == "admin"
    invitation.refresh_from_db()
    assert invitation.accepted_at is not None
    assert Notification.objects.filter(recipient=org_setup["admin"], verb="invitation_accepted").exists()


def test_accepting_requires_the_invited_email(client_for, org_setup, make_user):
    invitation = Invitation.objects.create(organization=org_setup["org"], email="right@example.com", invited_by=org_setup["owner"])
    wrong = make_user(email="wrong@example.com")
    right = make_user(email="right@example.com")

    assert client_for(wrong).post("/api/invitations/accept/", {"token": invitation.token}).status_code == 403
    res = client_for(right).post("/api/invitations/accept/", {"token": invitation.token})
    assert res.status_code == 200
    assert Membership.objects.filter(organization=org_setup["org"], user=right).exists()
    again = client_for(right).post("/api/invitations/accept/", {"token": invitation.token})
    assert again.status_code == 400


def test_expired_invitations_cannot_be_accepted(client_for, org_setup, make_user):
    invitation = Invitation.objects.create(
        organization=org_setup["org"],
        email="late@example.com",
        expires_at=timezone.now() - timedelta(days=1),
    )
    user = make_user(email="late@example.com")
    assert client_for(user).post("/api/invitations/accept/", {"token": invitation.token}).status_code == 400
    assert client_for().get("/api/invitations/lookup/", {"token": invitation.token}).data["status"] == "expired"
    assert client_for().get("/api/invitations/lookup/", {"token": "nope"}).status_code == 404


def test_invitation_permissions(client_for, org_setup):
    org = org_setup["org"].pk
    member = client_for(org_setup["member"])
    assert member.post("/api/invitations/", {"organization": org, "email": "x@example.com"}).status_code == 403
    admin = client_for(org_setup["admin"])
    owner_invite = admin.post("/api/invitations/", {"organization": org, "email": "x@example.com", "role": "owner"})
    assert owner_invite.status_code == 403

    admin.post("/api/invitations/", {"organization": org, "email": "x@example.com"})
    assert member.get("/api/invitations/", {"organization": org}).data == []
    pending = admin.get("/api/invitations/", {"organization": org}).data
    assert [i["email"] for i in pending] == ["x@example.com"]

    assert admin.post(f"/api/invitations/{pending[0]['id']}/resend/").status_code == 200
    assert admin.delete(f"/api/invitations/{pending[0]['id']}/").status_code == 204
    assert not Invitation.objects.exists()


def test_reinviting_the_same_email_reuses_the_invitation(client_for, org_setup):
    admin = client_for(org_setup["admin"])
    org = org_setup["org"].pk
    admin.post("/api/invitations/", {"organization": org, "email": "x@example.com"})
    admin.post("/api/invitations/", {"organization": org, "email": "x@example.com", "role": "admin"})
    assert Invitation.objects.get().role == "admin"


# --- Notifications ------------------------------------------------------------------------------


def test_assigning_a_task_notifies_and_emails_the_assignee(client_for, org_setup, project, run_on_commit):
    member = org_setup["member"]
    with run_on_commit():
        res = client_for(org_setup["owner"]).post(
            "/api/tasks/", {"project": project.pk, "title": "Write docs", "assignee": member.pk}
        )
    assert res.status_code == 201
    note = Notification.objects.get(recipient=member)
    assert note.verb == "task_assigned"
    assert note.link == f"/projects/{project.pk}?task={res.data['id']}"
    assert mail.outbox[0].to == [member.email]
    assert "Write docs" in mail.outbox[0].subject


def test_no_notification_for_assigning_yourself_or_when_email_is_off(client_for, org_setup, make_task, run_on_commit):
    member = org_setup["member"]
    task = make_task()
    client_for(member).patch(f"/api/tasks/{task.pk}/", {"assignee": member.pk})
    assert not Notification.objects.exists()

    member.email_notifications = False
    member.save()
    other = make_task(title="Other")
    with run_on_commit():
        client_for(org_setup["owner"]).patch(f"/api/tasks/{other.pk}/", {"assignee": member.pk})
    assert Notification.objects.filter(recipient=member).count() == 1
    assert mail.outbox == []


def test_comment_notifies_assignee_creator_and_other_commenters(client_for, org_setup, make_task):
    task = make_task(assignee=org_setup["member"])  # created by the owner
    client_for(org_setup["admin"]).post("/api/comments/", {"task": task.pk, "body": "First!"})
    recipients = set(Notification.objects.values_list("recipient__full_name", flat=True))
    assert recipients == {"Mia Member", "Olivia Owner"}

    Notification.objects.all().delete()
    client_for(org_setup["member"]).post("/api/comments/", {"task": task.pk, "body": "On it"})
    recipients = set(Notification.objects.values_list("recipient__full_name", flat=True))
    assert recipients == {"Olivia Owner", "Adam Admin"}


def test_completing_a_task_notifies_its_creator(client_for, org_setup, make_task):
    task = make_task()
    client_for(org_setup["member"]).post(f"/api/tasks/{task.pk}/move/", {"status": "completed", "position": 0})
    assert Notification.objects.get().recipient == org_setup["owner"]


def test_notification_inbox(client_for, org_setup, make_user):
    member = org_setup["member"]
    for i in range(3):
        Notification.objects.create(recipient=member, verb="x", message=f"note {i}")
    someone_else = Notification.objects.create(recipient=org_setup["owner"], verb="x", message="private")
    client = client_for(member)

    assert client.get("/api/notifications/unread-count/").data == {"unread": 3}
    listed = client.get("/api/notifications/").data
    assert [n["message"] for n in listed] == ["note 2", "note 1", "note 0"]

    first = listed[0]["id"]
    assert client.post(f"/api/notifications/{first}/read/").data["is_read"] is True
    assert client.get("/api/notifications/", {"unread": "true"}).data[0]["message"] == "note 1"
    assert client.post(f"/api/notifications/{someone_else.pk}/read/").status_code == 404

    client.post("/api/notifications/read-all/")
    assert client.get("/api/notifications/unread-count/").data == {"unread": 0}


def test_profile_exposes_email_preference(client_for, org_setup):
    client = client_for(org_setup["member"])
    assert client.get("/api/auth/me/").data["email_notifications"] is True
    assert client.patch("/api/auth/me/", {"email_notifications": False}).data["email_notifications"] is False
    # Other members never see the preference.
    task_member = client.get("/api/memberships/", {"organization": org_setup["org"].pk}).data[0]["user"]
    assert "email_notifications" not in task_member


def test_due_reminders_are_sent_once_per_day(org_setup, make_task):
    today = timezone.localdate()
    make_task(title="Due today", due_date=today, assignee=org_setup["member"])
    make_task(title="Due tomorrow", due_date=today + timedelta(days=1), assignee=org_setup["member"])
    make_task(title="Next week", due_date=today + timedelta(days=7), assignee=org_setup["member"])
    make_task(title="Done", due_date=today, assignee=org_setup["member"], status="completed")

    call_command("send_due_reminders")
    call_command("send_due_reminders")
    messages = sorted(Notification.objects.values_list("message", flat=True))
    assert len(messages) == 2
    assert "due today" in messages[0] or "due today" in messages[1]
