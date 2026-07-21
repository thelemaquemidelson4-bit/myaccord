"""Iteration 5: WebRTC additions — /api/lives and /api/calls endpoints.

These tests build their OWN player/recruiter/offer/application/conversation
so ordering with the main regression file does not matter.
"""
import uuid
import pytest
import requests


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def ctx(base_url):
    """Bootstrap two users + one conversation to exercise lives/calls."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    p_email = f"TEST_iter5_p_{uuid.uuid4().hex[:8]}@t.com"
    r_email = f"TEST_iter5_r_{uuid.uuid4().hex[:8]}@t.com"
    rp = s.post(f"{base_url}/api/auth/register", json={
        "email": p_email, "password": "pass1234", "name": "Iter5 Player", "role": "player"
    })
    assert rp.status_code == 200, rp.text
    rr = s.post(f"{base_url}/api/auth/register", json={
        "email": r_email, "password": "pass1234", "name": "Iter5 Coach", "role": "recruiter"
    })
    assert rr.status_code == 200, rr.text
    p_tok = rp.json()["token"]
    r_tok = rr.json()["token"]
    p_id = rp.json()["user"]["user_id"]
    r_id = rr.json()["user"]["user_id"]

    # Recruiter posts an offer, player applies -> creates conversation
    off = s.post(f"{base_url}/api/offers", json={
        "title": "TEST iter5 offer", "sport": "Football", "description": "d"
    }, headers=_hdr(r_tok))
    assert off.status_code == 200
    offer_id = off.json()["offer"]["offer_id"]
    ap = s.post(f"{base_url}/api/applications", json={
        "offer_id": offer_id, "message": "hello iter5"
    }, headers=_hdr(p_tok))
    assert ap.status_code == 200
    conv_id = ap.json()["conversation_id"]

    return {
        "s": s, "base_url": base_url,
        "p_tok": p_tok, "r_tok": r_tok,
        "p_id": p_id, "r_id": r_id,
        "conv_id": conv_id, "offer_id": offer_id,
    }


# ---------- /api/lives ----------
class TestLives:
    def test_lives_requires_auth(self, ctx):
        r = ctx["s"].get(f"{ctx['base_url']}/api/lives")
        assert r.status_code == 401

    def test_start_live_video(self, ctx):
        r = ctx["s"].post(f"{ctx['base_url']}/api/lives/start", json={
            "title": "TEST iter5 direct vidéo", "media": "video",
        }, headers=_hdr(ctx["r_tok"]))
        assert r.status_code == 200, r.text
        lv = r.json()["live"]
        assert lv["media"] == "video"
        assert lv["status"] == "live"
        assert lv["host_id"] == ctx["r_id"]
        assert lv["title"] == "TEST iter5 direct vidéo"
        assert "room_id" in lv and lv["room_id"] == lv["live_id"]
        ctx["live_id"] = lv["live_id"]

    def test_start_live_audio_default_title(self, ctx):
        # Empty title -> server derives default from user name
        r = ctx["s"].post(f"{ctx['base_url']}/api/lives/start", json={
            "title": "", "media": "audio",
        }, headers=_hdr(ctx["p_tok"]))
        assert r.status_code == 200, r.text
        lv = r.json()["live"]
        assert lv["media"] == "audio"
        assert lv["title"].startswith("Direct de ")
        ctx["live_id_audio"] = lv["live_id"]

    def test_list_lives_contains_started(self, ctx):
        r = ctx["s"].get(f"{ctx['base_url']}/api/lives", headers=_hdr(ctx["p_tok"]))
        assert r.status_code == 200
        lives = r.json()["lives"]
        ids = {lv["live_id"] for lv in lives}
        assert ctx["live_id"] in ids
        assert ctx["live_id_audio"] in ids
        # viewers key present + is int
        for lv in lives:
            assert "viewers" in lv and isinstance(lv["viewers"], int)
            assert lv["viewers"] >= 0
            assert lv["status"] == "live"

    def test_get_live_detail(self, ctx):
        r = ctx["s"].get(f"{ctx['base_url']}/api/lives/{ctx['live_id']}", headers=_hdr(ctx["p_tok"]))
        assert r.status_code == 200
        assert r.json()["live"]["live_id"] == ctx["live_id"]

    def test_get_live_unknown_404(self, ctx):
        r = ctx["s"].get(f"{ctx['base_url']}/api/lives/live_doesnotexist", headers=_hdr(ctx["p_tok"]))
        assert r.status_code == 404

    def test_end_live_non_host_403(self, ctx):
        # Player tries to end recruiter's live -> 403
        r = ctx["s"].post(f"{ctx['base_url']}/api/lives/{ctx['live_id']}/end", headers=_hdr(ctx["p_tok"]))
        assert r.status_code == 403

    def test_end_live_host_ok(self, ctx):
        r = ctx["s"].post(f"{ctx['base_url']}/api/lives/{ctx['live_id']}/end", headers=_hdr(ctx["r_tok"]))
        assert r.status_code == 200
        assert r.json() == {"ok": True}
        # Ended live should no longer appear in GET /lives (only 'live' status listed)
        r2 = ctx["s"].get(f"{ctx['base_url']}/api/lives", headers=_hdr(ctx["p_tok"]))
        ids = {lv["live_id"] for lv in r2.json()["lives"]}
        assert ctx["live_id"] not in ids

    def test_end_live_unknown_404(self, ctx):
        r = ctx["s"].post(f"{ctx['base_url']}/api/lives/live_doesnotexist/end", headers=_hdr(ctx["r_tok"]))
        assert r.status_code == 404


# ---------- /api/calls ----------
class TestCalls:
    def test_calls_requires_auth(self, ctx):
        r = ctx["s"].post(f"{ctx['base_url']}/api/calls/start", json={
            "conversation_id": ctx["conv_id"], "media": "video"
        })
        assert r.status_code == 401

    def test_start_call_video_posts_invite_message(self, ctx):
        # Snapshot count of messages
        before = ctx["s"].get(f"{ctx['base_url']}/api/conversations/{ctx['conv_id']}/messages?limit=100",
                              headers=_hdr(ctx["p_tok"]))
        before_count = len(before.json()["messages"])

        r = ctx["s"].post(f"{ctx['base_url']}/api/calls/start", json={
            "conversation_id": ctx["conv_id"], "media": "video"
        }, headers=_hdr(ctx["r_tok"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["media"] == "video"
        assert isinstance(data["room_id"], str) and data["room_id"].startswith("call_")
        ctx["room_id_video"] = data["room_id"]

        # Verify a new message with a `call` payload landed in the conversation
        after = ctx["s"].get(f"{ctx['base_url']}/api/conversations/{ctx['conv_id']}/messages?limit=100",
                             headers=_hdr(ctx["p_tok"]))
        msgs = after.json()["messages"]
        assert len(msgs) == before_count + 1
        last = msgs[-1]
        assert last["sender_id"] == ctx["r_id"]
        assert last.get("call") is not None, f"expected call payload, got {last}"
        call = last["call"]
        assert call["media"] == "video"
        assert call["room_id"] == data["room_id"]
        assert call["caller_id"] == ctx["r_id"]
        assert call["status"] == "ringing"
        # Human-readable text should be present too
        assert "📞" in (last.get("text") or "")

        # Conversation preview should now reflect the call
        convs = ctx["s"].get(f"{ctx['base_url']}/api/conversations", headers=_hdr(ctx["p_tok"]))
        tgt = next(c for c in convs.json()["conversations"] if c["conversation_id"] == ctx["conv_id"])
        assert tgt["last_message"] in ("📞 Appel vidéo",)

    def test_start_call_audio(self, ctx):
        r = ctx["s"].post(f"{ctx['base_url']}/api/calls/start", json={
            "conversation_id": ctx["conv_id"], "media": "audio"
        }, headers=_hdr(ctx["p_tok"]))
        assert r.status_code == 200
        assert r.json()["media"] == "audio"
        # Preview flips to audio
        convs = ctx["s"].get(f"{ctx['base_url']}/api/conversations", headers=_hdr(ctx["r_tok"]))
        tgt = next(c for c in convs.json()["conversations"] if c["conversation_id"] == ctx["conv_id"])
        assert tgt["last_message"] == "📞 Appel audio"

    def test_start_call_unknown_conversation_404(self, ctx):
        r = ctx["s"].post(f"{ctx['base_url']}/api/calls/start", json={
            "conversation_id": "conv_doesnotexist", "media": "video"
        }, headers=_hdr(ctx["r_tok"]))
        assert r.status_code == 404

    def test_start_call_non_participant_404(self, ctx):
        # An outsider cannot start a call on a conversation they are not in
        s2 = requests.Session()
        s2.headers.update({"Content-Type": "application/json"})
        email = f"TEST_iter5_out_{uuid.uuid4().hex[:6]}@t.com"
        rr = s2.post(f"{ctx['base_url']}/api/auth/register", json={
            "email": email, "password": "pass1234", "name": "Out5", "role": "player"
        })
        assert rr.status_code == 200
        tok = rr.json()["token"]
        r = s2.post(f"{ctx['base_url']}/api/calls/start", json={
            "conversation_id": ctx["conv_id"], "media": "video"
        }, headers=_hdr(tok))
        assert r.status_code == 404

    def test_messages_expose_call_field(self, ctx):
        """Regression: GET messages must include the `call` key for all messages."""
        r = ctx["s"].get(f"{ctx['base_url']}/api/conversations/{ctx['conv_id']}/messages?limit=100",
                         headers=_hdr(ctx["p_tok"]))
        assert r.status_code == 200
        for m in r.json()["messages"]:
            assert "call" in m  # None for plain msgs, dict for call-invites
