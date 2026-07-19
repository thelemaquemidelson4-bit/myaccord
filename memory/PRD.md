# ScoutMoi — PRD

## Original Problem Statement
"Créer une application de recrutement des joueurs sportifs de toutes catégories de sports." A mobile app connecting athletes and recruiters/clubs across all sports (French UI).

## Architecture
- Frontend: Expo Router (React Native), dark "Dark-First Utility" theme (Signal Red #FF453A), Barlow Condensed + Manrope fonts, bottom tabs.
- Backend: FastAPI + MongoDB (motor). Session-token auth (Bearer) for both email/password (bcrypt) and Emergent Google OAuth.
- AI: Emergent LLM key (Claude Sonnet 4.6) for profile summaries + recruiter match suggestions.

## User Personas
1. Athlète (player) — builds profile (sport, poste, niveau, stats, bio, photo), browses club offers, applies, chats.
2. Recruteur/Club — browses athlete profiles, uses AI match suggestions, publishes offers, reviews applications, contacts athletes.

## Core Requirements (static)
- Dual-role onboarding + auth (email/password JWT-style session + Google).
- Player profiles with stats & AI summary.
- Recruitment offers with filters (sport/position/level/location).
- Search & filters for athletes/offers.
- Messaging between the two sides.
- Applications / match (apply -> auto conversation).

## Implemented (2026-06-19)
- Auth: register/login/me/logout, Google OAuth flow (frontend + backend session-data verification).
- Profile edit (shared ProfileForm), photo picker (expo-image-picker, permission handling), complete-profile onboarding step.
- Home feed (role-based: offers for players, athlete cards for recruiters) with sport chip filter + pull-to-refresh.
- Search screen with filters + results.
- Offer creation (recruiter), offer detail with applications list, apply flow.
- Athlete detail with stats + AI summary + Contacter.
- Messaging: conversation list, chat with polling, optimistic send.
- AI: profile-summary + match-suggestions endpoints (Claude Sonnet).
- Backend tested: 34/34 pytest passing. Frontend core flows verified.

## Backlog
- P1: Notifications of new applications/messages (in-app); offer edit/delete; application accept/reject status.
- P1: Video highlights upload for athletes (currently field exists, no UI upload).
- P2: Advanced filters (age range, gender in search UI), favorites/shortlist for recruiters.
- P2: Web image rendering of remote hero fallback (cosmetic on web preview only).

## Next Tasks
- LIVE features (build-only, WebRTC): 1:1 audio call, 1:1 video call, live broadcast (1-to-many). Require react-native-webrtc + backend WebSocket signaling + STUN/TURN, and a development build (do NOT work in Expo Go / web preview).
- Add offer management (edit/delete) and application status workflow.
- Message pagination + image size limits.

## Changelog
- 2026-06-19: Renommage en "Intake" + logo intégré (écrans, icône, splash). Thème bleu & blanc clair translucide.
- 2026-06-19 (iter 2): Messagerie enrichie — texte temps quasi-réel (polling 2s) + envoi de photos (galerie + caméra, base64), aperçu image plein écran, permissions gérées. Backend 43/43 tests.
- 2026-06-19 (iter 3): Chat — indicateur "En ligne" (point vert, fenêtre 45s + heartbeat 20s), accusés de lecture ("Vu"/"Envoyé"), badges non-lus, pagination (limit/before/after → polling léger sans re-télécharger les images). Backend 54/54 tests.
- 2026-06-19 (iter 4): Gestion des offres (édition PUT /offers/{id}, suppression DELETE avec cascade des candidatures) + workflow de candidatures (accept/refus/pending, notification auto dans le chat, statuts colorés côté athlète). Idempotence des notifications. Backend 69/69 tests.
