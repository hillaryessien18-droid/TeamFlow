from projects.models import Activity, Project


def test_admin_creates_project_member_cannot(client_for, org_setup):
    org = org_setup["org"].pk
    res = client_for(org_setup["admin"]).post(
        "/api/projects/", {"organization": org, "name": "Launch", "description": "Q3 launch"}, format="json"
    )
    assert res.status_code == 201
    assert res.data["status"] == "active" and res.data["progress"] == 0

    res = client_for(org_setup["member"]).post("/api/projects/", {"organization": org, "name": "Nope"}, format="json")
    assert res.status_code == 403


def test_outsider_cannot_create_or_see_projects(client_for, org_setup, project):
    outsider = client_for(org_setup["outsider"])
    assert outsider.post("/api/projects/", {"organization": org_setup["org"].pk, "name": "x"}, format="json").status_code == 404
    assert outsider.get("/api/projects/").data == []
    assert outsider.get(f"/api/projects/{project.pk}/").status_code == 404


def test_progress_is_computed_from_completed_tasks(client_for, org_setup, project, make_task):
    make_task(status="completed")
    make_task(status="todo")
    make_task(status="in_progress")
    make_task(status="completed")
    res = client_for(org_setup["member"]).get(f"/api/projects/?organization={org_setup['org'].pk}")
    assert res.data[0]["task_count"] == 4
    assert res.data[0]["completed_count"] == 2
    assert res.data[0]["progress"] == 50


def test_edit_archive_unarchive_delete(client_for, org_setup, project):
    admin = client_for(org_setup["admin"])
    member = client_for(org_setup["member"])
    url = f"/api/projects/{project.pk}/"

    assert member.patch(url, {"name": "Hack"}, format="json").status_code == 403
    assert admin.patch(url, {"name": "Website v2"}, format="json").data["name"] == "Website v2"

    assert member.post(f"{url}archive/").status_code == 403
    assert admin.post(f"{url}archive/").data["status"] == "archived"
    assert member.get("/api/projects/?status=archived").data[0]["id"] == project.pk
    assert member.get("/api/projects/?status=active").data == []
    assert admin.post(f"{url}unarchive/").data["status"] == "active"

    assert admin.delete(url).status_code == 204
    assert not Project.objects.exists()
    # History survives deletion of the project.
    assert Activity.objects.filter(verb="project_deleted").exists()


def test_team_must_belong_to_same_org(client_for, org_setup, project):
    from organizations.models import Organization, Team

    foreign_team = Team.objects.create(organization=Organization.objects.create(name="Other"), name="Spies")
    res = client_for(org_setup["admin"]).patch(f"/api/projects/{project.pk}/", {"team": foreign_team.pk}, format="json")
    assert res.status_code == 400


def test_search_filter(client_for, org_setup, project):
    Project.objects.create(organization=org_setup["org"], name="Mobile app")
    res = client_for(org_setup["member"]).get("/api/projects/?search=mobile")
    assert [p["name"] for p in res.data] == ["Mobile app"]
