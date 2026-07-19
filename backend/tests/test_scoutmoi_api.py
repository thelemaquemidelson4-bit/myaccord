"""ScoutMoi backend integration tests - runs against public URL."""
import time
import uuid
import pytest
import requests


# ---- Module-level shared state ----
state = {}


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_root_health(base_url, session):
    r = session.get(f"{base_url}/api/")
    assert r.status_code == 200
    assert "ScoutMoi" in r.json().get("message", "")


# ---------- Auth: register / login / me / seed accounts ----------
def test_register_new_player(base_url, session):
    email = f"TEST_player_{uuid.uuid4().hex[:8]}@test.com"
    r = session.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Test Leo", "role": "player"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["role"] == "player"
    assert "password" not in data["user"]
    state["player_token"] = data["token"]
    state["player_id"] = data["user"]["user_id"]
    state["player_email"] = email


def test_register_new_recruiter(base_url, session):
    email = f"TEST_recruiter_{uuid.uuid4().hex[:8]}@test.com"
    r = session.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Test Coach", "role": "recruiter"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    state["recruiter_token"] = data["token"]
    state["recruiter_id"] = data["user"]["user_id"]
    state["recruiter_email"] = email


def test_register_duplicate_email(base_url, session):
    r = session.post(f"{base_url}/api/auth/register", json={
        "email": state["player_email"], "password": "pass1234", "name": "Dup", "role": "player"
    })
    assert r.status_code == 400


def test_register_invalid_role(base_url, session):
    r = session.post(f"{base_url}/api/auth/register", json={
        "email": f"TEST_bad_{uuid.uuid4().hex[:6]}@t.com", "password": "pass1234", "name": "X", "role": "admin"
    })
    assert r.status_code == 400


def test_login_seed_player(base_url, session):
    # Ensure seed account exists; register if needed
    r = session.post(f"{base_url}/api/auth/login", json={"email": "leo@test.com", "password": "pass1234"})
    if r.status_code != 200:
        session.post(f"{base_url}/api/auth/register", json={
            "email": "leo@test.com", "password": "pass1234", "name": "Leo", "role": "player"
        })
        r = session.post(f"{base_url}/api/auth/login", json={"email": "leo@test.com", "password": "pass1234"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "player"


def test_login_seed_recruiter(base_url, session):
    r = session.post(f"{base_url}/api/auth/login", json={"email": "coach@test.com", "password": "pass1234"})
    if r.status_code != 200:
        session.post(f"{base_url}/api/auth/register", json={
            "email": "coach@test.com", "password": "pass1234", "name": "Coach", "role": "recruiter"
        })
        r = session.post(f"{base_url}/api/auth/login", json={"email": "coach@test.com", "password": "pass1234"})
    assert r.status_code == 200, r.text


def test_login_bad_password(base_url, session):
    r = session.post(f"{base_url}/api/auth/login", json={"email": state["player_email"], "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_auth(base_url, session):
    r = session.get(f"{base_url}/api/auth/me")
    assert r.status_code == 401


def test_me_returns_user(base_url, session):
    r = session.get(f"{base_url}/api/auth/me", headers=_hdr(state["player_token"]))
    assert r.status_code == 200
    assert r.json()["user"]["user_id"] == state["player_id"]


# ---------- Profile ----------
def test_update_player_profile(base_url, session):
    payload = {
        "name": "Test Leo", "bio": "Attaquant rapide", "location": "Paris",
        "sport": "Football", "position": "Attaquant", "level": "Amateur",
        "age": 22, "gender": "M", "height": 180, "weight": 75,
        "stats": {"buts": 12, "matchs": 20}
    }
    r = session.put(f"{base_url}/api/profile", json=payload, headers=_hdr(state["player_token"]))
    assert r.status_code == 200, r.text
    # verify GET reflects update
    r2 = session.get(f"{base_url}/api/auth/me", headers=_hdr(state["player_token"]))
    u = r2.json()["user"]
    assert u["sport"] == "Football"
    assert u["position"] == "Attaquant"
    assert u["stats"]["buts"] == 12


def test_update_recruiter_profile(base_url, session):
    r = session.put(f"{base_url}/api/profile", json={
        "club_name": "AS Test", "location": "Lyon", "bio": "Club de test"
    }, headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 200


def test_list_athletes_and_filter(base_url, session):
    r = session.get(f"{base_url}/api/athletes", headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 200
    athletes = r.json()["athletes"]
    assert any(a["user_id"] == state["player_id"] for a in athletes)
    # filter by sport
    r2 = session.get(f"{base_url}/api/athletes?sport=Football", headers=_hdr(state["recruiter_token"]))
    assert r2.status_code == 200
    assert all(a.get("sport") == "Football" for a in r2.json()["athletes"])


def test_get_athlete_detail(base_url, session):
    r = session.get(f"{base_url}/api/athletes/{state['player_id']}", headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 200
    assert r.json()["athlete"]["user_id"] == state["player_id"]


def test_get_athlete_not_found(base_url, session):
    r = session.get(f"{base_url}/api/athletes/user_doesnotexist", headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 404


# ---------- Offers ----------
def test_create_offer_recruiter(base_url, session):
    r = session.post(f"{base_url}/api/offers", json={
        "title": "TEST Attaquant recherché", "sport": "Football",
        "position": "Attaquant", "level": "Amateur", "location": "Lyon",
        "description": "Nous recrutons un attaquant."
    }, headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 200, r.text
    offer = r.json()["offer"]
    assert offer["title"].startswith("TEST")
    state["offer_id"] = offer["offer_id"]


def test_player_cannot_create_offer(base_url, session):
    r = session.post(f"{base_url}/api/offers", json={
        "title": "X", "sport": "Football", "description": "d"
    }, headers=_hdr(state["player_token"]))
    assert r.status_code == 403


def test_list_offers_and_filter(base_url, session):
    r = session.get(f"{base_url}/api/offers", headers=_hdr(state["player_token"]))
    assert r.status_code == 200
    assert any(o["offer_id"] == state["offer_id"] for o in r.json()["offers"])
    r2 = session.get(f"{base_url}/api/offers?sport=Football&location=Lyon", headers=_hdr(state["player_token"]))
    assert r2.status_code == 200


def test_offers_mine(base_url, session):
    r = session.get(f"{base_url}/api/offers/mine", headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 200
    assert any(o["offer_id"] == state["offer_id"] for o in r.json()["offers"])


def test_get_offer_detail(base_url, session):
    r = session.get(f"{base_url}/api/offers/{state['offer_id']}", headers=_hdr(state["player_token"]))
    assert r.status_code == 200


# ---------- Applications ----------
def test_player_applies_creates_conversation(base_url, session):
    r = session.post(f"{base_url}/api/applications", json={
        "offer_id": state["offer_id"], "message": "Bonjour, je suis motivé."
    }, headers=_hdr(state["player_token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["application"]["offer_id"] == state["offer_id"]
    assert "conversation_id" in data
    state["conv_id"] = data["conversation_id"]


def test_duplicate_application_blocked(base_url, session):
    r = session.post(f"{base_url}/api/applications", json={"offer_id": state["offer_id"]}, headers=_hdr(state["player_token"]))
    assert r.status_code == 400


def test_recruiter_cannot_apply(base_url, session):
    r = session.post(f"{base_url}/api/applications", json={"offer_id": state["offer_id"]}, headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 403


def test_applications_mine(base_url, session):
    r = session.get(f"{base_url}/api/applications/mine", headers=_hdr(state["player_token"]))
    assert r.status_code == 200
    assert any(a["offer_id"] == state["offer_id"] for a in r.json()["applications"])


def test_offer_applications_for_recruiter(base_url, session):
    r = session.get(f"{base_url}/api/offers/{state['offer_id']}/applications", headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 200
    apps = r.json()["applications"]
    assert len(apps) >= 1
    assert apps[0]["athlete"] is not None


# ---------- Messaging ----------
def test_list_conversations(base_url, session):
    r = session.get(f"{base_url}/api/conversations", headers=_hdr(state["player_token"]))
    assert r.status_code == 200
    convs = r.json()["conversations"]
    assert any(c["conversation_id"] == state["conv_id"] for c in convs)


def test_get_messages_intro(base_url, session):
    r = session.get(f"{base_url}/api/conversations/{state['conv_id']}/messages", headers=_hdr(state["player_token"]))
    assert r.status_code == 200
    assert len(r.json()["messages"]) >= 1


def test_send_message_recruiter_reply(base_url, session):
    r = session.post(f"{base_url}/api/conversations/{state['conv_id']}/messages",
                     json={"text": "Merci pour votre candidature."},
                     headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 200
    assert r.json()["message"]["text"] == "Merci pour votre candidature."


def test_get_messages_forbidden_for_outsider(base_url, session):
    # Register a new user, ensure they cannot fetch this conversation
    email = f"TEST_out_{uuid.uuid4().hex[:6]}@t.com"
    rr = session.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Outsider", "role": "player"
    })
    tok = rr.json()["token"]
    r = session.get(f"{base_url}/api/conversations/{state['conv_id']}/messages", headers=_hdr(tok))
    assert r.status_code == 404


def test_start_conversation_endpoint(base_url, session):
    r = session.post(f"{base_url}/api/conversations",
                     json={"target_user_id": state["recruiter_id"]},
                     headers=_hdr(state["player_token"]))
    assert r.status_code == 200
    # Should return existing conversation id (idempotent)
    assert r.json()["conversation_id"] == state["conv_id"]


# ---------- AI ----------
def test_ai_profile_summary(base_url, session):
    r = requests.post(f"{base_url}/api/ai/profile-summary", json={}, headers=_hdr(state["player_token"]), timeout=60)
    assert r.status_code == 200, r.text
    summary = r.json()["summary"]
    assert isinstance(summary, str) and len(summary) > 20
    state["summary"] = summary


def test_ai_match_suggestions_recruiter(base_url, session):
    r = requests.post(f"{base_url}/api/ai/match-suggestions",
                      json={"sport": "Football", "position": "Attaquant", "level": "Amateur"},
                      headers=_hdr(state["recruiter_token"]), timeout=90)
    assert r.status_code == 200, r.text
    sug = r.json()["suggestions"]
    assert isinstance(sug, list)
    # Player we created should exist in candidates (may or may not be in top ranked)
    assert len(sug) >= 1


def test_ai_match_forbidden_for_player(base_url, session):
    r = requests.post(f"{base_url}/api/ai/match-suggestions", json={"sport": "Football"},
                      headers=_hdr(state["player_token"]), timeout=30)
    assert r.status_code == 403


# ---------- Logout ----------
def test_logout_invalidates_session(base_url, session):
    # Use the outsider approach: create dedicated user, login, logout, then me must 401
    email = f"TEST_lo_{uuid.uuid4().hex[:6]}@t.com"
    reg = session.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "LO", "role": "player"
    })
    tok = reg.json()["token"]
    r_ok = session.get(f"{base_url}/api/auth/me", headers=_hdr(tok))
    assert r_ok.status_code == 200
    r_out = session.post(f"{base_url}/api/auth/logout", headers=_hdr(tok))
    assert r_out.status_code == 200
    r_after = session.get(f"{base_url}/api/auth/me", headers=_hdr(tok))
    assert r_after.status_code == 401
