from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import uuid
import bcrypt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ----------------------------- Helpers -----------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


async def create_session(user_id: str) -> str:
    token = uuid.uuid4().hex + uuid.uuid4().hex
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc().isoformat(),
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(),
    })
    return token


def public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    if not u:
        return u
    u.pop("_id", None)
    u.pop("password", None)
    return u


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session invalide")
    exp = session.get("expires_at")
    try:
        exp_dt = datetime.fromisoformat(exp) if isinstance(exp, str) else exp
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        if exp_dt < now_utc():
            raise HTTPException(status_code=401, detail="Session expirée")
    except HTTPException:
        raise
    except Exception:
        pass
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    user.pop("password", None)
    return user


ONLINE_WINDOW = 45  # seconds


def is_online(last_seen) -> bool:
    if not last_seen:
        return False
    try:
        dt = datetime.fromisoformat(last_seen) if isinstance(last_seen, str) else last_seen
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (now_utc() - dt).total_seconds() < ONLINE_WINDOW
    except Exception:
        return False


async def touch_presence(user_id: str):
    await db.users.update_one({"user_id": user_id}, {"$set": {"last_seen": now_utc().isoformat()}})


# ----------------------------- Models -----------------------------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # "player" | "recruiter"


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionInput(BaseModel):
    session_token: str
    role: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    photo: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    # athlete
    sport: Optional[str] = None
    position: Optional[str] = None
    level: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    height: Optional[int] = None
    weight: Optional[int] = None
    stats: Optional[Dict[str, Any]] = None
    videos: Optional[List[str]] = None
    # recruiter / club
    club_name: Optional[str] = None


class OfferInput(BaseModel):
    title: str
    sport: str
    position: Optional[str] = None
    level: Optional[str] = None
    location: Optional[str] = None
    description: str
    image: Optional[str] = None


class ApplicationInput(BaseModel):
    offer_id: str
    message: Optional[str] = None


class OfferUpdate(BaseModel):
    title: Optional[str] = None
    sport: Optional[str] = None
    position: Optional[str] = None
    level: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None


class ApplicationStatusInput(BaseModel):
    status: str  # "accepted" | "rejected" | "pending"


class ConversationInput(BaseModel):
    target_user_id: str


class MessageInput(BaseModel):
    text: Optional[str] = None
    image: Optional[str] = None


class AISummaryInput(BaseModel):
    user_id: Optional[str] = None


class AIMatchInput(BaseModel):
    sport: Optional[str] = None
    position: Optional[str] = None
    level: Optional[str] = None
    offer_id: Optional[str] = None


# ----------------------------- Auth Routes -----------------------------
@api_router.post("/auth/register")
async def register(inp: RegisterInput):
    existing = await db.users.find_one({"email": inp.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    if inp.role not in ("player", "recruiter"):
        raise HTTPException(status_code=400, detail="Rôle invalide")
    user_id = new_id("user")
    doc = {
        "user_id": user_id,
        "email": inp.email.lower(),
        "password": hash_password(inp.password),
        "name": inp.name,
        "role": inp.role,
        "photo": None,
        "bio": None,
        "location": None,
        "sport": None,
        "position": None,
        "level": None,
        "age": None,
        "gender": None,
        "height": None,
        "weight": None,
        "stats": {},
        "videos": [],
        "club_name": None,
        "ai_summary": None,
        "auth_provider": "email",
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    token = await create_session(user_id)
    return {"token": token, "user": public_user(doc)}


@api_router.post("/auth/login")
async def login(inp: LoginInput):
    user = await db.users.find_one({"email": inp.email.lower()})
    if not user or not user.get("password") or not verify_password(inp.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = await create_session(user["user_id"])
    return {"token": token, "user": public_user(user)}


@api_router.post("/auth/google/session")
async def google_session(inp: GoogleSessionInput):
    async with httpx.AsyncClient(timeout=20) as hc:
        resp = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": inp.session_token},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Échec de la connexion Google")
    data = resp.json()
    email = data.get("email", "").lower()
    if not email:
        raise HTTPException(status_code=401, detail="Email Google introuvable")
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = new_id("user")
        doc = {
            "user_id": user_id,
            "email": email,
            "password": None,
            "name": data.get("name") or email.split("@")[0],
            "role": inp.role if inp.role in ("player", "recruiter") else None,
            "photo": data.get("picture"),
            "bio": None, "location": None, "sport": None, "position": None,
            "level": None, "age": None, "gender": None, "height": None,
            "weight": None, "stats": {}, "videos": [], "club_name": None,
            "ai_summary": None, "auth_provider": "google",
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(doc)
        user = doc
    elif inp.role and not user.get("role"):
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": inp.role}})
        user["role"] = inp.role
    token = await create_session(user["user_id"])
    return {"token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return {"user": user}


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ----------------------------- Profile Routes -----------------------------
@api_router.put("/profile")
async def update_profile(inp: ProfileUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    updates = {k: v for k, v in inp.dict().items() if v is not None}
    if "role" in updates and updates["role"] not in ("player", "recruiter"):
        updates.pop("role")
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password": 0})
    return {"user": updated}


@api_router.get("/athletes")
async def list_athletes(
    sport: Optional[str] = None, position: Optional[str] = None,
    level: Optional[str] = None, location: Optional[str] = None,
    gender: Optional[str] = None, q: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user),
):
    query: Dict[str, Any] = {"role": "player"}
    if sport:
        query["sport"] = sport
    if position:
        query["position"] = position
    if level:
        query["level"] = level
    if gender:
        query["gender"] = gender
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    athletes = await db.users.find(query, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(200)
    return {"athletes": athletes}


@api_router.get("/athletes/{user_id}")
async def get_athlete(user_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    a = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Profil introuvable")
    return {"athlete": a}


# ----------------------------- Offer Routes -----------------------------
@api_router.post("/offers")
async def create_offer(inp: OfferInput, user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Réservé aux recruteurs")
    offer_id = new_id("offer")
    doc = {
        "offer_id": offer_id,
        "recruiter_id": user["user_id"],
        "recruiter_name": user.get("name"),
        "club_name": user.get("club_name") or user.get("name"),
        "recruiter_photo": user.get("photo"),
        "title": inp.title,
        "sport": inp.sport,
        "position": inp.position,
        "level": inp.level,
        "location": inp.location,
        "description": inp.description,
        "image": inp.image,
        "created_at": now_utc().isoformat(),
    }
    await db.offers.insert_one(doc)
    doc.pop("_id", None)
    return {"offer": doc}


@api_router.get("/offers")
async def list_offers(
    sport: Optional[str] = None, level: Optional[str] = None,
    location: Optional[str] = None, q: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if sport:
        query["sport"] = sport
    if level:
        query["level"] = level
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if q:
        query["title"] = {"$regex": q, "$options": "i"}
    offers = await db.offers.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"offers": offers}


@api_router.get("/offers/mine")
async def my_offers(user: Dict[str, Any] = Depends(get_current_user)):
    offers = await db.offers.find({"recruiter_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"offers": offers}


@api_router.get("/offers/{offer_id}")
async def get_offer(offer_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    o = await db.offers.find_one({"offer_id": offer_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    return {"offer": o}


@api_router.put("/offers/{offer_id}")
async def update_offer(offer_id: str, inp: OfferUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    o = await db.offers.find_one({"offer_id": offer_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    if o["recruiter_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Action non autorisée")
    updates = {k: v for k, v in inp.dict().items() if v is not None}
    if updates:
        await db.offers.update_one({"offer_id": offer_id}, {"$set": updates})
    updated = await db.offers.find_one({"offer_id": offer_id}, {"_id": 0})
    return {"offer": updated}


@api_router.delete("/offers/{offer_id}")
async def delete_offer(offer_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    o = await db.offers.find_one({"offer_id": offer_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    if o["recruiter_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Action non autorisée")
    await db.offers.delete_one({"offer_id": offer_id})
    await db.applications.delete_many({"offer_id": offer_id})
    return {"ok": True}


@api_router.get("/offers/{offer_id}/applications")
async def offer_applications(offer_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    apps = await db.applications.find({"offer_id": offer_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for a in apps:
        athlete = await db.users.find_one({"user_id": a["athlete_id"]}, {"_id": 0, "password": 0})
        a["athlete"] = athlete
    return {"applications": apps}


# ----------------------------- Applications -----------------------------
async def get_or_create_conversation(user_a: str, user_b: str) -> Dict[str, Any]:
    conv = await db.conversations.find_one(
        {"participants": {"$all": [user_a, user_b]}}, {"_id": 0}
    )
    if conv:
        return conv
    conv = {
        "conversation_id": new_id("conv"),
        "participants": [user_a, user_b],
        "last_message": None,
        "last_at": now_utc().isoformat(),
        "created_at": now_utc().isoformat(),
    }
    await db.conversations.insert_one(dict(conv))
    return conv


@api_router.post("/applications")
async def apply(inp: ApplicationInput, user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "player":
        raise HTTPException(status_code=403, detail="Réservé aux athlètes")
    offer = await db.offers.find_one({"offer_id": inp.offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offre introuvable")
    existing = await db.applications.find_one({"offer_id": inp.offer_id, "athlete_id": user["user_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà postulé à cette offre")
    app_id = new_id("app")
    doc = {
        "application_id": app_id,
        "offer_id": inp.offer_id,
        "offer_title": offer.get("title"),
        "athlete_id": user["user_id"],
        "athlete_name": user.get("name"),
        "recruiter_id": offer.get("recruiter_id"),
        "message": inp.message,
        "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    await db.applications.insert_one(doc)
    # start a conversation with recruiter
    conv = await get_or_create_conversation(user["user_id"], offer["recruiter_id"])
    intro = inp.message or f"Bonjour, je suis intéressé(e) par l'offre « {offer.get('title')} »."
    await post_message_internal(conv["conversation_id"], user["user_id"], intro)
    doc.pop("_id", None)
    return {"application": doc, "conversation_id": conv["conversation_id"]}


@api_router.get("/applications/mine")
async def my_applications(user: Dict[str, Any] = Depends(get_current_user)):
    apps = await db.applications.find({"athlete_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"applications": apps}


@api_router.put("/applications/{application_id}/status")
async def update_application_status(application_id: str, inp: ApplicationStatusInput, user: Dict[str, Any] = Depends(get_current_user)):
    if inp.status not in ("accepted", "rejected", "pending"):
        raise HTTPException(status_code=400, detail="Statut invalide")
    appdoc = await db.applications.find_one({"application_id": application_id}, {"_id": 0})
    if not appdoc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")
    if appdoc["recruiter_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Action non autorisée")
    await db.applications.update_one({"application_id": application_id}, {"$set": {"status": inp.status}})
    # Notify the athlete through their conversation.
    if inp.status in ("accepted", "rejected"):
        conv = await get_or_create_conversation(appdoc["recruiter_id"], appdoc["athlete_id"])
        if inp.status == "accepted":
            note = f"✅ Votre candidature pour « {appdoc.get('offer_title')} » a été acceptée !"
        else:
            note = f"❌ Votre candidature pour « {appdoc.get('offer_title')} » n'a pas été retenue."
        await post_message_internal(conv["conversation_id"], user["user_id"], note)
    updated = await db.applications.find_one({"application_id": application_id}, {"_id": 0})
    return {"application": updated}


# ----------------------------- Messaging -----------------------------
async def post_message_internal(conversation_id: str, sender_id: str, text: Optional[str] = None, image: Optional[str] = None) -> Dict[str, Any]:
    msg = {
        "message_id": new_id("msg"),
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "text": text,
        "image": image,
        "created_at": now_utc().isoformat(),
    }
    await db.messages.insert_one(dict(msg))
    preview = "📷 Photo" if image and not text else (text or "")
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {"last_message": preview, "last_at": now_utc().isoformat()}},
    )
    await touch_presence(sender_id)
    return msg


@api_router.post("/presence")
async def presence(user: Dict[str, Any] = Depends(get_current_user)):
    await touch_presence(user["user_id"])
    return {"ok": True}


@api_router.post("/conversations")
async def start_conversation(inp: ConversationInput, user: Dict[str, Any] = Depends(get_current_user)):
    target = await db.users.find_one({"user_id": inp.target_user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    conv = await get_or_create_conversation(user["user_id"], inp.target_user_id)
    return {"conversation_id": conv["conversation_id"]}


@api_router.get("/conversations")
async def list_conversations(user: Dict[str, Any] = Depends(get_current_user)):
    convs = await db.conversations.find({"participants": user["user_id"]}, {"_id": 0}).sort("last_at", -1).to_list(200)
    result = []
    for c in convs:
        other_id = next((p for p in c["participants"] if p != user["user_id"]), None)
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "password": 0}) if other_id else None
        my_read = (c.get("reads") or {}).get(user["user_id"])
        unread_q: Dict[str, Any] = {"conversation_id": c["conversation_id"], "sender_id": other_id}
        if my_read:
            unread_q["created_at"] = {"$gt": my_read}
        unread = await db.messages.count_documents(unread_q) if other_id else 0
        result.append({
            "conversation_id": c["conversation_id"],
            "last_message": c.get("last_message"),
            "last_at": c.get("last_at"),
            "unread": unread,
            "other": {
                "user_id": other.get("user_id"),
                "name": other.get("name"),
                "photo": other.get("photo"),
                "role": other.get("role"),
                "club_name": other.get("club_name"),
                "last_seen": other.get("last_seen"),
                "online": is_online(other.get("last_seen")),
            } if other else None,
        })
    return {"conversations": result}


@api_router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    after: Optional[str] = Query(None),
    before: Optional[str] = Query(None),
    limit: int = Query(30, ge=1, le=100),
    user: Dict[str, Any] = Depends(get_current_user),
):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or user["user_id"] not in conv["participants"]:
        raise HTTPException(status_code=404, detail="Conversation introuvable")
    other_id = next((p for p in conv["participants"] if p != user["user_id"]), None)

    # Mark this conversation as read by the current user + refresh presence.
    now_iso = now_utc().isoformat()
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {f"reads.{user['user_id']}": now_iso}},
    )
    await touch_presence(user["user_id"])

    base: Dict[str, Any] = {"conversation_id": conversation_id}
    has_more = False
    if after:
        q = {**base, "created_at": {"$gt": after}}
        msgs = await db.messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)
    elif before:
        q = {**base, "created_at": {"$lt": before}}
        docs = await db.messages.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
        docs.reverse()
        msgs = docs
        if msgs:
            older = await db.messages.count_documents({**base, "created_at": {"$lt": msgs[0]["created_at"]}})
            has_more = older > 0
    else:
        docs = await db.messages.find(base, {"_id": 0}).sort("created_at", -1).to_list(limit)
        docs.reverse()
        msgs = docs
        total = await db.messages.count_documents(base)
        has_more = total > len(msgs)

    other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "password": 0}) if other_id else None
    other_out = {
        "user_id": other.get("user_id"),
        "name": other.get("name"),
        "photo": other.get("photo"),
        "role": other.get("role"),
        "club_name": other.get("club_name"),
        "last_seen": other.get("last_seen"),
        "online": is_online(other.get("last_seen")),
    } if other else None
    other_last_read = (conv.get("reads") or {}).get(other_id) if other_id else None
    return {"messages": msgs, "other": other_out, "other_last_read": other_last_read, "has_more": has_more}


@api_router.post("/conversations/{conversation_id}/messages")
async def send_message_route(conversation_id: str, inp: MessageInput, user: Dict[str, Any] = Depends(get_current_user)):
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or user["user_id"] not in conv["participants"]:
        raise HTTPException(status_code=404, detail="Conversation introuvable")
    if not inp.text and not inp.image:
        raise HTTPException(status_code=400, detail="Message vide")
    msg = await post_message_internal(conversation_id, user["user_id"], inp.text, inp.image)
    msg.pop("_id", None)
    return {"message": msg}


# ----------------------------- AI Routes -----------------------------
async def run_llm(system_message: str, prompt: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=new_id("ai"),
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-6")
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp if isinstance(resp, str) else str(resp)


@api_router.post("/ai/profile-summary")
async def ai_profile_summary(inp: AISummaryInput, user: Dict[str, Any] = Depends(get_current_user)):
    target_id = inp.user_id or user["user_id"]
    athlete = await db.users.find_one({"user_id": target_id}, {"_id": 0, "password": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Profil introuvable")
    data = {
        "nom": athlete.get("name"),
        "sport": athlete.get("sport"),
        "poste": athlete.get("position"),
        "niveau": athlete.get("level"),
        "age": athlete.get("age"),
        "taille_cm": athlete.get("height"),
        "poids_kg": athlete.get("weight"),
        "localisation": athlete.get("location"),
        "stats": athlete.get("stats"),
        "bio": athlete.get("bio"),
    }
    prompt = (
        "Rédige un résumé professionnel et percutant (3-4 phrases, en français) mettant en valeur "
        "ce profil d'athlète pour des recruteurs sportifs. Sois concret, dynamique et positif. "
        "Ne mets pas de titre, uniquement le paragraphe.\n\nDonnées du joueur:\n"
        + json.dumps(data, ensure_ascii=False, indent=2)
    )
    try:
        summary = await run_llm("Tu es un scout sportif expert qui rédige des présentations de joueurs.", prompt)
    except Exception as e:
        logger.error(f"AI summary error: {e}")
        raise HTTPException(status_code=500, detail="Échec de la génération IA")
    summary = summary.strip()
    if inp.user_id is None or inp.user_id == user["user_id"]:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"ai_summary": summary}})
    return {"summary": summary}


@api_router.post("/ai/match-suggestions")
async def ai_match_suggestions(inp: AIMatchInput, user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Réservé aux recruteurs")
    sport = inp.sport
    position = inp.position
    level = inp.level
    if inp.offer_id:
        offer = await db.offers.find_one({"offer_id": inp.offer_id}, {"_id": 0})
        if offer:
            sport = sport or offer.get("sport")
            position = position or offer.get("position")
            level = level or offer.get("level")
    query: Dict[str, Any] = {"role": "player"}
    if sport:
        query["sport"] = sport
    candidates = await db.users.find(query, {"_id": 0, "password": 0}).to_list(20)
    if not candidates:
        return {"suggestions": []}
    compact = [{
        "user_id": c["user_id"], "nom": c.get("name"), "sport": c.get("sport"),
        "poste": c.get("position"), "niveau": c.get("level"), "age": c.get("age"),
        "localisation": c.get("location"), "stats": c.get("stats"),
    } for c in candidates]
    prompt = (
        f"Besoin du recruteur: sport={sport}, poste={position}, niveau={level}.\n"
        "Voici une liste de joueurs candidats (JSON). Sélectionne les 5 meilleurs correspondants. "
        "Réponds UNIQUEMENT avec un tableau JSON valide d'objets de la forme "
        '{"user_id": "...", "reason": "raison courte en français"}. '
        "Aucun texte hors du JSON.\n\nCandidats:\n"
        + json.dumps(compact, ensure_ascii=False)
    )
    try:
        raw = await run_llm("Tu es un scout sportif qui évalue et classe des joueurs.", prompt)
    except Exception as e:
        logger.error(f"AI match error: {e}")
        raise HTTPException(status_code=500, detail="Échec de la suggestion IA")
    ranked = []
    try:
        txt = raw.strip()
        start = txt.find("[")
        end = txt.rfind("]")
        if start != -1 and end != -1:
            txt = txt[start:end + 1]
        parsed = json.loads(txt)
        by_id = {c["user_id"]: c for c in candidates}
        for item in parsed:
            cid = item.get("user_id")
            if cid in by_id:
                athlete = by_id[cid]
                athlete["ai_reason"] = item.get("reason")
                ranked.append(athlete)
    except Exception as e:
        logger.error(f"AI parse error: {e}")
        ranked = candidates[:5]
    return {"suggestions": ranked}


# ----------------------------- Startup -----------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")


@api_router.get("/")
async def root():
    return {"message": "ScoutMoi API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
