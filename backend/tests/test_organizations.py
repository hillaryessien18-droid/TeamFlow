from organizations.models import Membership, Organization, Team
from projects.models import Activity


def test_creating_an_organization_makes_creator_owner(client_for, make_user):
    user = make_user()
    res = client_for(user).post("/api/organizations/", {"name": "Startup"}, format="json")
    assert res.status_code == 201
    assert res.data["my_role"] == "owner"
    assert Membership.objects.get(organization_id=res.data["id"], user=user).role == "owner"
    assert Activity.objects.filter(organization_id=res.data["id"], verb="created").exists()


def test_list_only_shows_my_organizations(client_for, org_setup, make_user):
    Organization.objects.create(name="Other")
    res = client_for(org_setup["member"]).get("/api/organizations/")
    assert [o["name"] for o in res.data] == ["Acme"]
    assert res.data[0]["member_count"] == 3
    assert res.data[0]["my_role"] == "member"


def test_outsider_gets_404(client_for, org_setup):
    res = client_for(org_setup["outsider"]).get(f"/api/organizations/{org_setup['org'].pk}/")
    assert res.status_code == 404


def test_only_admins_can_edit_and_only_owners_can_delete(client_for, org_setup):
    url = f"/api/organizations/{org_setup['org'].pk}/"
    assert client_for(org_setup["member"]).patch(url, {"name": "X"}, format="json").status_code == 403
    assert client_for(org_setup["admin"]).patch(url, {"name": "Acme Inc"}, format="json").status_code == 200
    assert client_for(org_setup["admin"]).delete(url).status_code == 403
    assert client_for(org_setup["owner"]).delete(url).status_code == 204


def test_admin_can_add_member_but_not_owner(client_for, org_setup, make_user):
    newbie = make_user(email="newbie@example.com")
    org = org_setup["org"]
    admin = client_for(org_setup["admin"])

    res = admin.post("/api/memberships/", {"organization": org.pk, "email": "NEWBIE@example.com"}, format="json")
    assert res.status_code == 201
    assert res.data["role"] == "member"
    assert Membership.objects.filter(organization=org, user=newbie).exists()

    other = make_user()
    res = admin.post("/api/memberships/", {"organization": org.pk, "email": other.email, "role": "owner"}, format="json")
    assert res.status_code == 403


def test_member_cannot_add_people(client_for, org_setup, make_user):
    other = make_user()
    res = client_for(org_setup["member"]).post(
        "/api/memberships/", {"organization": org_setup["org"].pk, "email": other.email}, format="json"
    )
    assert res.status_code == 403


def test_adding_unknown_or_existing_user_fails(client_for, org_setup):
    client = client_for(org_setup["owner"])
    org = org_setup["org"].pk
    assert client.post("/api/memberships/", {"organization": org, "email": "nobody@x.com"}, format="json").status_code == 400
    dup = client.post("/api/memberships/", {"organization": org, "email": org_setup["member"].email}, format="json")
    assert dup.status_code == 400


def test_role_changes_respect_hierarchy(client_for, org_setup):
    org = org_setup["org"]
    member_m = Membership.objects.get(organization=org, user=org_setup["member"])
    owner_m = Membership.objects.get(organization=org, user=org_setup["owner"])

    admin = client_for(org_setup["admin"])
    assert admin.patch(f"/api/memberships/{member_m.pk}/", {"role": "admin"}, format="json").status_code == 200
    assert admin.patch(f"/api/memberships/{member_m.pk}/", {"role": "owner"}, format="json").status_code == 403
    assert admin.patch(f"/api/memberships/{owner_m.pk}/", {"role": "member"}, format="json").status_code == 403
    assert admin.patch(f"/api/memberships/{member_m.pk}/", {"role": "boss"}, format="json").status_code == 400

    owner = client_for(org_setup["owner"])
    # The only owner can't demote themselves...
    assert owner.patch(f"/api/memberships/{owner_m.pk}/", {"role": "admin"}, format="json").status_code == 400
    # ...but can once someone else is an owner.
    assert owner.patch(f"/api/memberships/{member_m.pk}/", {"role": "owner"}, format="json").status_code == 200
    assert owner.patch(f"/api/memberships/{owner_m.pk}/", {"role": "admin"}, format="json").status_code == 200


def test_last_owner_cannot_leave_but_member_can(client_for, org_setup):
    org = org_setup["org"]
    owner_m = Membership.objects.get(organization=org, user=org_setup["owner"])
    member_m = Membership.objects.get(organization=org, user=org_setup["member"])
    assert client_for(org_setup["owner"]).delete(f"/api/memberships/{owner_m.pk}/").status_code == 400
    assert client_for(org_setup["member"]).delete(f"/api/memberships/{member_m.pk}/").status_code == 204


def test_removing_member_unassigns_their_tasks(client_for, org_setup, make_task):
    task = make_task(assignee=org_setup["member"])
    member_m = Membership.objects.get(organization=org_setup["org"], user=org_setup["member"])
    assert client_for(org_setup["admin"]).delete(f"/api/memberships/{member_m.pk}/").status_code == 204
    task.refresh_from_db()
    assert task.assignee is None


def test_team_crud_and_member_validation(client_for, org_setup):
    org = org_setup["org"]
    admin = client_for(org_setup["admin"])
    res = admin.post(
        "/api/teams/",
        {"organization": org.pk, "name": "Design", "member_ids": [org_setup["member"].pk]},
        format="json",
    )
    assert res.status_code == 201
    assert [m["full_name"] for m in res.data["members"]] == ["Mia Member"]

    bad = admin.post(
        "/api/teams/",
        {"organization": org.pk, "name": "Ops", "member_ids": [org_setup["outsider"].pk]},
        format="json",
    )
    assert bad.status_code == 400

    team_id = res.data["id"]
    assert client_for(org_setup["member"]).delete(f"/api/teams/{team_id}/").status_code == 403
    assert admin.delete(f"/api/teams/{team_id}/").status_code == 204
    assert not Team.objects.exists()
