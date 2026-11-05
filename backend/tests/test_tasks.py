import datetime

from projects.models import Activity, Comment, Task


def test_member_creates_and_assigns_task(client_for, org_setup, project):
    res = client_for(org_setup["member"]).post(
        "/api/tasks/",
        {
            "project": project.pk,
            "title": "  Write copy  ",
            "description": "Homepage hero",
            "priority": "high",
            "due_date": "2030-01-15",
            "assignee": org_setup["admin"].pk,
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.data["title"] == "Write copy"
    assert res.data["status"] == "todo"
    assert res.data["assignee_detail"]["full_name"] == "Adam Admin"
    assert Activity.objects.filter(task_id=res.data["id"], verb="task_created").exists()


def test_cannot_assign_to_non_member(client_for, org_setup, project):
    res = client_for(org_setup["member"]).post(
        "/api/tasks/", {"project": project.pk, "title": "x", "assignee": org_setup["outsider"].pk}, format="json"
    )
    assert res.status_code == 400 and "assignee" in res.data


def test_outsider_cannot_create_task(client_for, org_setup, project):
    res = client_for(org_setup["outsider"]).post("/api/tasks/", {"project": project.pk, "title": "x"}, format="json")
    assert res.status_code == 404


def test_archived_project_is_read_only(client_for, org_setup, project, make_task):
    task = make_task()
    project.status = "archived"
    project.save()
    client = client_for(org_setup["owner"])
    assert client.post("/api/tasks/", {"project": project.pk, "title": "x"}, format="json").status_code == 400
    assert client.patch(f"/api/tasks/{task.pk}/", {"title": "y"}, format="json").status_code == 400
    assert client.get(f"/api/tasks/?project={project.pk}").status_code == 200


def test_status_change_sets_completed_at_and_logs(client_for, org_setup, make_task):
    task = make_task()
    client = client_for(org_setup["member"])
    res = client.patch(f"/api/tasks/{task.pk}/", {"status": "completed"}, format="json")
    assert res.data["completed_at"] is not None
    assert Activity.objects.filter(task=task, verb="task_moved").exists()

    res = client.patch(f"/api/tasks/{task.pk}/", {"status": "in_progress"}, format="json")
    assert res.data["completed_at"] is None


def test_update_logs_assignment_and_field_changes(client_for, org_setup, make_task):
    task = make_task(title="Ship")
    client_for(org_setup["member"]).patch(
        f"/api/tasks/{task.pk}/",
        {"assignee": org_setup["member"].pk, "priority": "urgent", "due_date": "2030-02-01"},
        format="json",
    )
    messages = list(Activity.objects.filter(task=task).values_list("message", flat=True))
    assert any("assigned" in m and "Mia Member" in m for m in messages)
    assert any("priority to Urgent" in m and "deadline" in m for m in messages)


def test_move_reorders_columns(client_for, org_setup, make_task):
    a = make_task(title="A", position=0)
    b = make_task(title="B", position=1)
    c = make_task(title="C", position=2)
    d = make_task(title="D", status="in_progress", position=0)
    client = client_for(org_setup["member"])

    res = client.post(f"/api/tasks/{c.pk}/move/", {"status": "todo", "position": 0}, format="json")
    assert res.status_code == 200
    todo = list(Task.objects.filter(status="todo").order_by("position").values_list("title", flat=True))
    assert todo == ["C", "A", "B"]

    client.post(f"/api/tasks/{a.pk}/move/", {"status": "in_progress", "position": 99}, format="json")
    assert list(Task.objects.filter(status="todo").order_by("position").values_list("title", "position")) == [
        ("C", 0),
        ("B", 1),
    ]
    assert list(Task.objects.filter(status="in_progress").order_by("position").values_list("title", "position")) == [
        ("D", 0),
        ("A", 1),
    ]
    assert d.pk and b.pk


def test_delete_requires_admin_or_creator(client_for, org_setup, make_task):
    owners_task = make_task(created_by=org_setup["owner"])
    my_task = make_task(created_by=org_setup["member"])
    member = client_for(org_setup["member"])
    assert member.delete(f"/api/tasks/{owners_task.pk}/").status_code == 403
    assert member.delete(f"/api/tasks/{my_task.pk}/").status_code == 204
    assert client_for(org_setup["admin"]).delete(f"/api/tasks/{owners_task.pk}/").status_code == 204


def test_filters_and_overdue_flag(client_for, org_setup, make_task):
    make_task(title="Mine", assignee=org_setup["member"], due_date=datetime.date(2000, 1, 1))
    make_task(title="Theirs", assignee=org_setup["admin"], priority="low")
    client = client_for(org_setup["member"])
    mine = client.get("/api/tasks/?assignee=me").data
    assert [t["title"] for t in mine] == ["Mine"]
    assert mine[0]["is_overdue"] is True
    assert [t["title"] for t in client.get("/api/tasks/?priority=low").data] == ["Theirs"]
    assert client.get("/api/tasks/?project=abc").status_code == 400


def test_comments_permissions(client_for, org_setup, make_task):
    task = make_task()
    member = client_for(org_setup["member"])
    res = member.post("/api/comments/", {"task": task.pk, "body": "Looks good"}, format="json")
    assert res.status_code == 201
    comment_id = res.data["id"]
    assert member.post("/api/comments/", {"task": task.pk, "body": "   "}, format="json").status_code == 400

    assert client_for(org_setup["admin"]).patch(f"/api/comments/{comment_id}/", {"body": "edit"}, format="json").status_code == 403
    assert member.patch(f"/api/comments/{comment_id}/", {"body": "Edited"}, format="json").data["body"] == "Edited"

    other = client_for(org_setup["owner"]).post("/api/comments/", {"task": task.pk, "body": "Owner note"}, format="json")
    assert member.delete(f"/api/comments/{other.data['id']}/").status_code == 403
    assert client_for(org_setup["admin"]).delete(f"/api/comments/{comment_id}/").status_code == 204
    assert Comment.objects.count() == 1

    assert client_for(org_setup["outsider"]).get(f"/api/comments/?task={task.pk}").data == []
    assert member.get(f"/api/tasks/{task.pk}/").data["comment_count"] == 1


def test_activity_feed_is_scoped(client_for, org_setup, project):
    client_for(org_setup["member"]).post("/api/tasks/", {"project": project.pk, "title": "Logged"}, format="json")
    feed = client_for(org_setup["member"]).get(f"/api/activity/?project={project.pk}").data
    assert feed[0]["verb"] == "task_created"
    assert feed[0]["actor"]["full_name"] == "Mia Member"
    assert client_for(org_setup["outsider"]).get("/api/activity/").data == []


def test_dashboard(client_for, org_setup, project, make_task):
    make_task(status="completed")
    make_task(status="todo", assignee=org_setup["member"], priority="urgent")
    make_task(status="in_progress", due_date=datetime.date(2000, 1, 1))
    client = client_for(org_setup["member"])

    res = client.get(f"/api/dashboard/?organization={org_setup['org'].pk}")
    assert res.status_code == 200
    data = res.data
    assert data["role"] == "member"
    assert data["member_count"] == 3
    assert data["tasks"] == {"total": 3, "todo": 1, "in_progress": 1, "completed": 1, "overdue": 1, "completion_rate": 33}
    assert data["open_by_priority"]["urgent"] == 1
    assert data["project_progress"][0]["progress"] == 33
    assert len(data["my_tasks"]) == 1

    assert client.get("/api/dashboard/").status_code == 400
    assert client_for(org_setup["outsider"]).get(f"/api/dashboard/?organization={org_setup['org'].pk}").status_code == 404
