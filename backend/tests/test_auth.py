import re

from django.core import mail


def test_register_returns_user_and_tokens(client_for):
    res = client_for().post(
        "/api/auth/register/",
        {"email": "New@Example.com", "full_name": "New Person", "password": "Very-secret-123"},
        format="json",
    )
    assert res.status_code == 201
    assert res.data["user"]["email"] == "new@example.com"
    assert res.data["access"]
    assert res.data["refresh"]


def test_register_rejects_duplicate_email_and_weak_password(client_for, make_user):
    make_user(email="taken@example.com")
    res = client_for().post(
        "/api/auth/register/",
        {"email": "TAKEN@example.com", "full_name": "X", "password": "Very-secret-123"},
        format="json",
    )
    assert res.status_code == 400
    assert "email" in res.data

    res = client_for().post(
        "/api/auth/register/", {"email": "a@example.com", "full_name": "A", "password": "123"}, format="json"
    )
    assert res.status_code == 400


def test_login_is_case_insensitive_and_rejects_bad_password(client_for, make_user):
    make_user(email="jane@example.com", password="Correct-horse-1")
    ok = client_for().post("/api/auth/login/", {"email": "JANE@example.com", "password": "Correct-horse-1"}, format="json")
    assert ok.status_code == 200
    assert ok.data["user"]["email"] == "jane@example.com"

    bad = client_for().post("/api/auth/login/", {"email": "jane@example.com", "password": "nope"}, format="json")
    assert bad.status_code == 401


def test_protected_endpoint_requires_token(client_for):
    assert client_for().get("/api/auth/me/").status_code == 401


def test_me_with_jwt_and_profile_update(client_for, make_user):
    make_user(email="me@example.com", password="Correct-horse-1")
    tokens = client_for().post(
        "/api/auth/login/", {"email": "me@example.com", "password": "Correct-horse-1"}, format="json"
    ).data
    client = client_for()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert client.get("/api/auth/me/").data["email"] == "me@example.com"
    res = client.patch("/api/auth/me/", {"full_name": "Renamed"}, format="json")
    assert res.data["full_name"] == "Renamed"


def test_logout_blacklists_refresh_token(client_for, make_user):
    user = make_user(email="out@example.com", password="Correct-horse-1")
    tokens = client_for().post(
        "/api/auth/login/", {"email": "out@example.com", "password": "Correct-horse-1"}, format="json"
    ).data
    res = client_for(user).post("/api/auth/logout/", {"refresh": tokens["refresh"]}, format="json")
    assert res.status_code == 204

    refresh = client_for().post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json")
    assert refresh.status_code == 401


def test_password_reset_flow(client_for, make_user):
    make_user(email="forgot@example.com", password="Old-password-1")
    res = client_for().post("/api/auth/password-reset/", {"email": "forgot@example.com"}, format="json")
    assert res.status_code == 200
    assert len(mail.outbox) == 1

    uid, token = re.search(r"uid=([\w-]+)&token=([\w-]+)", mail.outbox[0].body).groups()
    res = client_for().post(
        "/api/auth/password-reset/confirm/",
        {"uid": uid, "token": token, "new_password": "Brand-new-pass-9"},
        format="json",
    )
    assert res.status_code == 200

    login = client_for().post(
        "/api/auth/login/", {"email": "forgot@example.com", "password": "Brand-new-pass-9"}, format="json"
    )
    assert login.status_code == 200

    # Token is single-use: the password hash changed, so the same link is now invalid.
    reuse = client_for().post(
        "/api/auth/password-reset/confirm/",
        {"uid": uid, "token": token, "new_password": "Another-pass-77"},
        format="json",
    )
    assert reuse.status_code == 400


def test_password_reset_does_not_reveal_unknown_email(client_for):
    res = client_for().post("/api/auth/password-reset/", {"email": "ghost@example.com"}, format="json")
    assert res.status_code == 200
    assert len(mail.outbox) == 0


def test_change_password(client_for, make_user):
    user = make_user(password="Old-password-1")
    client = client_for(user)
    wrong = client.post(
        "/api/auth/change-password/", {"current_password": "x", "new_password": "New-password-22"}, format="json"
    )
    assert wrong.status_code == 400
    ok = client.post(
        "/api/auth/change-password/",
        {"current_password": "Old-password-1", "new_password": "New-password-22"},
        format="json",
    )
    assert ok.status_code == 200
    user.refresh_from_db()
    assert user.check_password("New-password-22")
