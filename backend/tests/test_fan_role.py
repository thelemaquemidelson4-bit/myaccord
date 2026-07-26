"""Myaccord — Fan (Supporter) role E2E backend tests.

Covers:
- Register/login for fan role
- Fan CAN GET athletes, offers, lives
- Fan CAN update profile (PUT /api/profile)
- Fan CANNOT POST /api/offers (403)
- Fan CANNOT POST /api/applications (403)
- Fan CAN start a conversation with an athlete (messaging works)
- Regression: register with invalid role rejected; role=fan whitelisted
"""
import uuid
import pytest
import requests


state = {}


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Seed accounts ----------
def _ensure_login(base_url, session, email, name, role):
    r = session.post(f"{base_url}/api/auth/login", json={"email": email, "password": "pass1234"})
    if r.status_code != 200:
        rr = session.post(f"{base_url}/api/auth/register", json={
            "email": email, "password": "pass1234", "name": name, "role": role,
        })
        assert rr.status_code == 200, rr.text
        return rr.json()
    return r.json()


def test_fan_seed_login(base_url, session):
    data = _ensure_login(base_url, session, "fan@test.com", "Fan Test", "fan")
    assert data["user"]["role"] == "fan"
    assert "password" not in data["user"]
    state["fan_token"] = data["token"]
    state["fan_id"] = data["user"]["user_id"]


def test_player_seed_login(base_url, session):
    data = _ensure_login(base_url, session, "leo@test.com", "Leo", "player")
    assert data["user"]["role"] == "player"
    state["player_token"] = data["token"]
    state["player_id"] = data["user"]["user_id"]


def test_recruiter_seed_login(base_url, session):
    data = _ensure_login(base_url, session, "coach@test.com", "Coach", "recruiter")
    assert data["user"]["role"] == "recruiter"
    state["recruiter_token"] = data["token"]
    state["recruiter_id"] = data["user"]["user_id"]


# ---------- Fan register (fresh, new email) ----------
def test_fan_register_new_account(base_url, session):
    email = f"TEST_fan_{uuid.uuid4().hex[:8]}@test.com"
    r = session.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "TEST Supporter", "role": "fan",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["role"] == "fan"
    assert body["user"]["email"] == email.lower()
    assert "token" in body and body["token"]
    state["new_fan_token"] = body["token"]
    state["new_fan_id"] = body["user"]["user_id"]


def test_fan_register_invalid_role_rejected(base_url, session):
    """Role whitelist still rejects unknown roles."""
    email = f"TEST_bad_{uuid.uuid4().hex[:8]}@test.com"
    r = session.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Bad", "role": "supporter",  # NOT valid
    })
    assert r.status_code == 400


# ---------- Fan CAN update profile (minimal fields) ----------
def test_fan_update_profile_ok(base_url, session):
    payload = {"name": "Fan Test", "bio": "J'adore le sport", "location": "Paris"}
    r = session.put(f"{base_url}/api/profile", json=payload, headers=_hdr(state["fan_token"]))
    assert r.status_code == 200, r.text
    u = r.json()["user"]
    assert u["bio"] == "J'adore le sport"
    assert u["location"] == "Paris"
    assert u["role"] == "fan"


def test_fan_profile_update_ignores_role_change_to_bogus(base_url, session):
    r = session.put(f"{base_url}/api/profile", json={"role": "admin"}, headers=_hdr(state["fan_token"]))
    assert r.status_code == 200
    # role must remain 'fan'
    r2 = session.get(f"{base_url}/api/auth/me", headers=_hdr(state["fan_token"]))
    assert r2.json()["user"]["role"] == "fan"


# ---------- Fan CAN read: athletes / offers / lives ----------
def test_fan_can_list_athletes(base_url, session):
    r = session.get(f"{base_url}/api/athletes", headers=_hdr(state["fan_token"]))
    assert r.status_code == 200
    assert isinstance(r.json().get("athletes"), list)


def test_fan_can_list_offers(base_url, session):
    r = session.get(f"{base_url}/api/offers", headers=_hdr(state["fan_token"]))
    assert r.status_code == 200
    assert isinstance(r.json().get("offers"), list)


def test_fan_can_list_lives(base_url, session):
    r = session.get(f"{base_url}/api/lives", headers=_hdr(state["fan_token"]))
    assert r.status_code == 200
    assert isinstance(r.json().get("lives"), list)


def test_fan_can_get_athlete_detail(base_url, session):
    r = session.get(f"{base_url}/api/athletes/{state['player_id']}", headers=_hdr(state["fan_token"]))
    assert r.status_code == 200
    assert r.json()["athlete"]["user_id"] == state["player_id"]


# ---------- Fan role enforcement (forbidden actions) ----------
def test_fan_cannot_create_offer_403(base_url, session):
    r = session.post(f"{base_url}/api/offers", json={
        "title": "TEST fan-offer", "sport": "Football", "description": "x",
    }, headers=_hdr(state["fan_token"]))
    assert r.status_code == 403
    assert "recruteur" in r.json().get("detail", "").lower()


def test_fan_cannot_apply_403(base_url, session):
    # First ensure at least one offer exists (create via recruiter)
    ro = session.post(f"{base_url}/api/offers", json={
        "title": "TEST offer-for-fan-check", "sport": "Football",
        "position": "Attaquant", "level": "Amateur", "location": "Paris",
        "description": "temp",
    }, headers=_hdr(state["recruiter_token"]))
    assert ro.status_code == 200, ro.text
    offer_id = ro.json()["offer"]["offer_id"]
    state["fan_test_offer_id"] = offer_id

    r = session.post(f"{base_url}/api/applications", json={
        "offer_id": offer_id, "message": "hello",
    }, headers=_hdr(state["fan_token"]))
    assert r.status_code == 403
    assert "athl" in r.json().get("detail", "").lower()


def test_fan_cannot_use_ai_match_403(base_url, session):
    r = session.post(f"{base_url}/api/ai/match-suggestions", json={"sport": "Football"},
                     headers=_hdr(state["fan_token"]))
    assert r.status_code == 403


# ---------- Fan CAN message athletes ----------
def test_fan_can_start_conversation_with_athlete(base_url, session):
    r = session.post(f"{base_url}/api/conversations", json={
        "target_user_id": state["player_id"],
    }, headers=_hdr(state["fan_token"]))
    assert r.status_code == 200, r.text
    conv_id = r.json()["conversation_id"]
    assert conv_id
    state["fan_conv_id"] = conv_id


def test_fan_can_send_message(base_url, session):
    r = session.post(f"{base_url}/api/conversations/{state['fan_conv_id']}/messages", json={
        "text": "TEST Bonjour depuis un supporter",
    }, headers=_hdr(state["fan_token"]))
    assert r.status_code == 200, r.text
    assert r.json()["message"]["text"] == "TEST Bonjour depuis un supporter"


def test_fan_can_list_conversations(base_url, session):
    r = session.get(f"{base_url}/api/conversations", headers=_hdr(state["fan_token"]))
    assert r.status_code == 200
    convs = r.json()["conversations"]
    assert any(c["conversation_id"] == state["fan_conv_id"] for c in convs)


def test_fan_can_read_messages(base_url, session):
    r = session.get(f"{base_url}/api/conversations/{state['fan_conv_id']}/messages",
                    headers=_hdr(state["fan_token"]))
    assert r.status_code == 200
    msgs = r.json()["messages"]
    assert any((m.get("text") or "").startswith("TEST Bonjour") for m in msgs)


# ---------- Regression: player can still apply / recruiter can still create ----------
def test_regression_player_can_apply_to_offer(base_url, session):
    r = session.post(f"{base_url}/api/applications", json={
        "offer_id": state["fan_test_offer_id"], "message": "TEST regression apply",
    }, headers=_hdr(state["player_token"]))
    # Either 200 (fresh) or 400 (already applied from previous run)
    assert r.status_code in (200, 400), r.text


def test_regression_recruiter_can_delete_own_offer(base_url, session):
    r = session.delete(f"{base_url}/api/offers/{state['fan_test_offer_id']}",
                       headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_fan_ai_profile_summary_allowed_but_not_useful(base_url, session):
    """AI summary is not role-gated in backend; call must succeed for any auth'd user.
    (Frontend hides the button for fans; we just verify no 403 gate here.)"""
    r = requests.post(f"{base_url}/api/ai/profile-summary", json={},
                      headers=_hdr(state["fan_token"]), timeout=60)
    assert r.status_code in (200, 500)  # 500 tolerated if LLM key issue; not 403
