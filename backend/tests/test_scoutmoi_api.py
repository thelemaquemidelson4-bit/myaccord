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


# ---------- Messaging: TEXT + IMAGE (iteration 2) ----------
# 1x1 transparent PNG data URI (tiny, valid base64)
TINY_PNG_DATA_URI = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def test_send_text_only_message(base_url, session):
    r = session.post(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        json={"text": "Bonjour texte seul"},
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 200, r.text
    msg = r.json()["message"]
    assert msg["text"] == "Bonjour texte seul"
    assert msg.get("image") is None
    assert msg["conversation_id"] == state["conv_id"]
    assert "message_id" in msg and "created_at" in msg


def test_send_image_only_message(base_url, session):
    r = session.post(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        json={"image": TINY_PNG_DATA_URI},
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 200, r.text
    msg = r.json()["message"]
    assert msg.get("text") is None
    assert msg["image"] == TINY_PNG_DATA_URI


def test_send_empty_message_400(base_url, session):
    r = session.post(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        json={},
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 400
    assert "vide" in r.json().get("detail", "").lower()


def test_send_both_null_message_400(base_url, session):
    r = session.post(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        json={"text": None, "image": None},
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 400


def test_get_messages_include_image_field(base_url, session):
    r = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 200
    msgs = r.json()["messages"]
    # Every message must expose text and image keys (either value or None)
    for m in msgs:
        assert "text" in m
        assert "image" in m
    # At least one image-only message present (from previous test)
    img_msgs = [m for m in msgs if m.get("image")]
    assert len(img_msgs) >= 1
    assert any(m.get("image") == TINY_PNG_DATA_URI for m in img_msgs)


def test_conversations_last_message_photo_preview(base_url, session):
    # Send another image-only as the *last* message
    r0 = session.post(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        json={"image": TINY_PNG_DATA_URI},
        headers=_hdr(state["player_token"]),
    )
    assert r0.status_code == 200
    # Now list conversations and check preview
    r = session.get(f"{base_url}/api/conversations", headers=_hdr(state["player_token"]))
    assert r.status_code == 200
    convs = r.json()["conversations"]
    target = next((c for c in convs if c["conversation_id"] == state["conv_id"]), None)
    assert target is not None
    assert target["last_message"] == "📷 Photo"


def test_conversations_last_message_text_preview(base_url, session):
    # After sending a text message, preview should equal text
    text = "Regression preview text"
    r0 = session.post(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        json={"text": text},
        headers=_hdr(state["recruiter_token"]),
    )
    assert r0.status_code == 200
    r = session.get(f"{base_url}/api/conversations", headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 200
    convs = r.json()["conversations"]
    target = next((c for c in convs if c["conversation_id"] == state["conv_id"]), None)
    assert target is not None
    assert target["last_message"] == text


def test_non_participant_cannot_post_message(base_url, session):
    email = f"TEST_outpost_{uuid.uuid4().hex[:6]}@t.com"
    reg = session.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Outsider2", "role": "player"
    })
    tok = reg.json()["token"]
    r = session.post(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        json={"text": "hack"},
        headers=_hdr(tok),
    )
    assert r.status_code == 404


def test_send_message_to_unknown_conversation_404(base_url, session):
    r = session.post(
        f"{base_url}/api/conversations/conv_doesnotexist/messages",
        json={"text": "hi"},
        headers=_hdr(state["player_token"]),
    )
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


# ---------- Iteration 3: Presence, Read Receipts, Pagination ----------
def test_presence_endpoint_updates_last_seen(base_url, session):
    r = session.post(f"{base_url}/api/presence", headers=_hdr(state["player_token"]))
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}
    # Verify last_seen is updated -> other side sees us online in /conversations
    r2 = session.get(f"{base_url}/api/conversations", headers=_hdr(state["recruiter_token"]))
    assert r2.status_code == 200
    convs = r2.json()["conversations"]
    target = next((c for c in convs if c["conversation_id"] == state["conv_id"]), None)
    assert target is not None
    assert target["other"] is not None
    assert target["other"]["user_id"] == state["player_id"]
    assert target["other"]["online"] is True
    assert target["other"]["last_seen"]  # ISO string


def test_presence_requires_auth(base_url, session):
    r = session.post(f"{base_url}/api/presence")
    assert r.status_code == 401


def test_conversations_include_unread_count(base_url, session):
    # Ensure recruiter has an unread by sending 2 messages from player
    for txt in ("unread-1 " + uuid.uuid4().hex[:6], "unread-2 " + uuid.uuid4().hex[:6]):
        r = session.post(
            f"{base_url}/api/conversations/{state['conv_id']}/messages",
            json={"text": txt}, headers=_hdr(state["player_token"]),
        )
        assert r.status_code == 200
    # Recruiter has NOT read yet (in this test) - but earlier tests may have. So we
    # verify the count is >=2 (at least the two we just sent) OR read receipt kicks
    # in after GET messages. We haven't called GET as recruiter after these sends.
    r = session.get(f"{base_url}/api/conversations", headers=_hdr(state["recruiter_token"]))
    assert r.status_code == 200
    target = next((c for c in r.json()["conversations"] if c["conversation_id"] == state["conv_id"]), None)
    assert target is not None
    assert "unread" in target
    assert isinstance(target["unread"], int)
    assert target["unread"] >= 2, f"Expected unread>=2, got {target['unread']}"


def test_get_messages_marks_conversation_as_read(base_url, session):
    # Recruiter reads the conversation -> their unread should go to 0
    r = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 200
    body = r.json()
    assert "messages" in body and "has_more" in body and "other" in body
    # Now list conversations for recruiter -> unread should be 0
    r2 = session.get(f"{base_url}/api/conversations", headers=_hdr(state["recruiter_token"]))
    target = next((c for c in r2.json()["conversations"] if c["conversation_id"] == state["conv_id"]), None)
    assert target is not None
    assert target["unread"] == 0
    # Recruiter presence refreshed by GET messages -> player sees recruiter online
    r3 = session.get(f"{base_url}/api/conversations", headers=_hdr(state["player_token"]))
    tgt = next((c for c in r3.json()["conversations"] if c["conversation_id"] == state["conv_id"]), None)
    assert tgt is not None and tgt["other"]["online"] is True


def test_read_receipts_other_last_read(base_url, session):
    # Recruiter just read (previous test). Player fetches messages -> other_last_read
    # should be set (recruiter's read timestamp).
    r = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 200
    body = r.json()
    assert "other_last_read" in body
    assert body["other_last_read"] is not None, "Recruiter has read; player should see other_last_read"
    # Should be parseable ISO
    from datetime import datetime
    dt = datetime.fromisoformat(body["other_last_read"])
    assert dt is not None


def test_pagination_limit_and_has_more(base_url, session):
    # Add several messages to guarantee > limit
    for i in range(6):
        session.post(
            f"{base_url}/api/conversations/{state['conv_id']}/messages",
            json={"text": f"pag-{i}-{uuid.uuid4().hex[:4]}"},
            headers=_hdr(state["player_token"]),
        )
    # Fetch latest 3
    r = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages?limit=3",
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["messages"]) == 3
    assert body["has_more"] is True
    # Messages must be in ascending chronological order
    created = [m["created_at"] for m in body["messages"]]
    assert created == sorted(created)
    state["latest_first_created_at"] = body["messages"][0]["created_at"]
    state["latest_last_created_at"] = body["messages"][-1]["created_at"]


def test_pagination_before_returns_older(base_url, session):
    before_ts = state["latest_first_created_at"]
    r = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages"
        f"?before={before_ts}&limit=5",
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["messages"]) >= 1
    # All returned must be strictly before the timestamp
    for m in body["messages"]:
        assert m["created_at"] < before_ts
    # Chronological ascending
    created = [m["created_at"] for m in body["messages"]]
    assert created == sorted(created)
    assert isinstance(body["has_more"], bool)


def test_pagination_after_returns_only_new_messages(base_url, session):
    # Use a wall-clock timestamp as the boundary: nothing should be created "in
    # the future" between our tests.
    from datetime import datetime, timezone
    after_ts = datetime.now(timezone.utc).isoformat()
    r = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages?after={after_ts}",
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 200
    assert r.json()["messages"] == [], f"Expected no messages after {after_ts}, got {r.json()['messages']}"

    # Now send a new message (with image) as recruiter and poll with the same after_ts
    r_send = session.post(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        json={"image": TINY_PNG_DATA_URI, "text": "polled-new"},
        headers=_hdr(state["recruiter_token"]),
    )
    assert r_send.status_code == 200
    time.sleep(0.05)
    r2 = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages?after={after_ts}",
        headers=_hdr(state["player_token"]),
    )
    assert r2.status_code == 200
    new_msgs = r2.json()["messages"]
    assert len(new_msgs) >= 1
    # Every returned message must be strictly after the timestamp (no resend of old messages/images)
    for m in new_msgs:
        assert m["created_at"] > after_ts
    # The image we just sent should be present (polling should include images posted after)
    assert any(m.get("image") == TINY_PNG_DATA_URI and m.get("text") == "polled-new" for m in new_msgs)

    # Now send a new message from recruiter (contains image) and poll with after
    r_send = session.post(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        json={"image": TINY_PNG_DATA_URI, "text": "polled-new"},
        headers=_hdr(state["recruiter_token"]),
    )
    assert r_send.status_code == 200
    time.sleep(0.05)
    r2 = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages?after={after_ts}",
        headers=_hdr(state["player_token"]),
    )
    assert r2.status_code == 200
    new_msgs = r2.json()["messages"]
    assert len(new_msgs) >= 1
    # Every returned message must be strictly after the timestamp (no resend of old image)
    for m in new_msgs:
        assert m["created_at"] > after_ts
    # The image we just sent should be present in the new batch (polling should include images posted after)
    assert any(m.get("image") == TINY_PNG_DATA_URI and m.get("text") == "polled-new" for m in new_msgs)


def test_get_messages_non_participant_404(base_url, session):
    email = f"TEST_np_{uuid.uuid4().hex[:6]}@t.com"
    reg = session.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "NP", "role": "player"
    })
    tok = reg.json()["token"]
    r = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages",
        headers=_hdr(tok),
    )
    assert r.status_code == 404


def test_get_messages_unknown_conversation_404(base_url, session):
    r = session.get(
        f"{base_url}/api/conversations/conv_doesnotexist/messages",
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 404


def test_get_messages_response_shape(base_url, session):
    r = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages?limit=5",
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 200
    body = r.json()
    # Response shape as documented
    for key in ("messages", "other", "other_last_read", "has_more"):
        assert key in body, f"Missing key {key}"
    other = body["other"]
    assert other is not None
    for key in ("user_id", "name", "role", "last_seen", "online"):
        assert key in other, f"'other' missing key {key}"
    assert isinstance(other["online"], bool)


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

# ---------- Iteration 4: Offer edit/delete + Application status workflow ----------
def test_iter4_update_offer_owner_partial(base_url, session):
    """PUT /api/offers/{id} by owner - partial update only touches provided fields."""
    payload = {"title": "TEST Attaquant recherché (updated)", "location": "Marseille"}
    r = session.put(
        f"{base_url}/api/offers/{state['offer_id']}", json=payload,
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 200, r.text
    offer = r.json()["offer"]
    assert offer["title"] == "TEST Attaquant recherché (updated)"
    assert offer["location"] == "Marseille"
    # untouched fields preserved
    assert offer["sport"] == "Football"
    assert offer["position"] == "Attaquant"
    # verify via GET
    g = session.get(f"{base_url}/api/offers/{state['offer_id']}", headers=_hdr(state["player_token"]))
    assert g.status_code == 200
    assert g.json()["offer"]["title"] == "TEST Attaquant recherché (updated)"
    assert g.json()["offer"]["location"] == "Marseille"


def test_iter4_update_offer_non_owner_recruiter_403(base_url, session):
    """PUT by another recruiter -> 403."""
    email = f"TEST_recr2_{uuid.uuid4().hex[:6]}@t.com"
    reg = session.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Other Coach", "role": "recruiter"
    })
    assert reg.status_code == 200
    tok2 = reg.json()["token"]
    state["recruiter2_token"] = tok2
    state["recruiter2_id"] = reg.json()["user"]["user_id"]
    r = session.put(
        f"{base_url}/api/offers/{state['offer_id']}", json={"title": "hijack"},
        headers=_hdr(tok2),
    )
    assert r.status_code == 403


def test_iter4_update_offer_by_player_403(base_url, session):
    r = session.put(
        f"{base_url}/api/offers/{state['offer_id']}", json={"title": "hijack"},
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 403


def test_iter4_update_offer_unknown_404(base_url, session):
    r = session.put(
        f"{base_url}/api/offers/offer_doesnotexist", json={"title": "x"},
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 404


# ---- Application status workflow (use existing application before delete) ----
def _fetch_application_id(base_url, session):
    r = session.get(f"{base_url}/api/applications/mine", headers=_hdr(state["player_token"]))
    assert r.status_code == 200
    apps = r.json()["applications"]
    app = next((a for a in apps if a["offer_id"] == state["offer_id"]), None)
    assert app is not None, "expected application from earlier test"
    return app["application_id"]


def test_iter4_update_application_status_accepted_posts_notification(base_url, session):
    app_id = _fetch_application_id(base_url, session)
    state["application_id"] = app_id
    r = session.put(
        f"{base_url}/api/applications/{app_id}/status",
        json={"status": "accepted"},
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 200, r.text
    assert r.json()["application"]["status"] == "accepted"
    # Notification must appear in athlete<->recruiter conversation
    m = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages?limit=50",
        headers=_hdr(state["player_token"]),
    )
    assert m.status_code == 200
    msgs = m.json()["messages"]
    assert any(
        (msg.get("text") or "").startswith("✅") and "acceptée" in (msg.get("text") or "")
        for msg in msgs
    ), "expected an accepted-notification message from recruiter"
    # athlete sees updated status via /applications/mine
    mine = session.get(f"{base_url}/api/applications/mine", headers=_hdr(state["player_token"]))
    assert mine.status_code == 200
    my_app = next(a for a in mine.json()["applications"] if a["application_id"] == app_id)
    assert my_app["status"] == "accepted"


def test_iter4_update_application_status_rejected_posts_notification(base_url, session):
    app_id = state["application_id"]
    r = session.put(
        f"{base_url}/api/applications/{app_id}/status",
        json={"status": "rejected"},
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 200
    assert r.json()["application"]["status"] == "rejected"
    m = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages?limit=50",
        headers=_hdr(state["player_token"]),
    )
    assert m.status_code == 200
    msgs = m.json()["messages"]
    assert any(
        (msg.get("text") or "").startswith("❌") and "retenue" in (msg.get("text") or "")
        for msg in msgs
    ), "expected a rejected-notification message"


def test_iter4_update_application_status_pending_no_notification(base_url, session):
    app_id = state["application_id"]
    # Snapshot current msg count
    before = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages?limit=100",
        headers=_hdr(state["player_token"]),
    )
    before_texts = [m.get("text") for m in before.json()["messages"]]
    r = session.put(
        f"{base_url}/api/applications/{app_id}/status",
        json={"status": "pending"},
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 200
    assert r.json()["application"]["status"] == "pending"
    after = session.get(
        f"{base_url}/api/conversations/{state['conv_id']}/messages?limit=100",
        headers=_hdr(state["player_token"]),
    )
    after_texts = [m.get("text") for m in after.json()["messages"]]
    # No new ✅/❌ notification should be appended for 'pending'
    new_texts = after_texts[len(before_texts):]
    assert not any((t or "").startswith(("✅", "❌")) for t in new_texts)


def test_iter4_update_application_status_invalid_400(base_url, session):
    r = session.put(
        f"{base_url}/api/applications/{state['application_id']}/status",
        json={"status": "maybe"},
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 400


def test_iter4_update_application_status_non_owner_recruiter_403(base_url, session):
    r = session.put(
        f"{base_url}/api/applications/{state['application_id']}/status",
        json={"status": "accepted"},
        headers=_hdr(state["recruiter2_token"]),
    )
    assert r.status_code == 403


def test_iter4_update_application_status_by_athlete_403(base_url, session):
    r = session.put(
        f"{base_url}/api/applications/{state['application_id']}/status",
        json={"status": "accepted"},
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 403


def test_iter4_update_application_status_unknown_404(base_url, session):
    r = session.put(
        f"{base_url}/api/applications/app_doesnotexist/status",
        json={"status": "accepted"},
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 404


# ---- Delete offer (do last: cascades applications) ----
def test_iter4_delete_offer_non_owner_403(base_url, session):
    r = session.delete(
        f"{base_url}/api/offers/{state['offer_id']}",
        headers=_hdr(state["recruiter2_token"]),
    )
    assert r.status_code == 403


def test_iter4_delete_offer_by_player_403(base_url, session):
    r = session.delete(
        f"{base_url}/api/offers/{state['offer_id']}",
        headers=_hdr(state["player_token"]),
    )
    assert r.status_code == 403


def test_iter4_delete_offer_unknown_404(base_url, session):
    r = session.delete(
        f"{base_url}/api/offers/offer_doesnotexist",
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 404


def test_iter4_delete_offer_owner_cascades_applications(base_url, session):
    app_id = state["application_id"]
    r = session.delete(
        f"{base_url}/api/offers/{state['offer_id']}",
        headers=_hdr(state["recruiter_token"]),
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}
    # Subsequent GET -> 404
    g = session.get(f"{base_url}/api/offers/{state['offer_id']}", headers=_hdr(state["player_token"]))
    assert g.status_code == 404
    # Applications for that offer are gone -> updating status now 404
    s = session.put(
        f"{base_url}/api/applications/{app_id}/status",
        json={"status": "accepted"},
        headers=_hdr(state["recruiter_token"]),
    )
    assert s.status_code == 404
    # /applications/mine no longer contains this offer
    mine = session.get(f"{base_url}/api/applications/mine", headers=_hdr(state["player_token"]))
    assert mine.status_code == 200
    assert not any(a["application_id"] == app_id for a in mine.json()["applications"])

