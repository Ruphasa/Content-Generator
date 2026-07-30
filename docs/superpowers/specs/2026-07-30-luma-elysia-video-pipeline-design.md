# Daily Video Generation Pipeline Design

## 1. Overview
Migrate from local scraper-based video generation to a fully automated API-driven architecture. The new system separates Frontend and Backend, uses PostgreSQL, and relies on Luma API for video rendering and Google Cloud services for audio.

## 2. Architecture Split
- **Frontend (FE):** Next.js (App Router). Pure UI.
- **Backend (BE):** Bun + ElysiaJS. Handles API, queue, and heavy logic.
- **Database:** PostgreSQL managed via Drizzle ORM (replacing Supabase).

## 3. Video Pipeline Flow
1. **Director (LLM):** Gemini 2.5 Flash acts as director. Splits narrative into TTS text, generates timestamps, and creates visual prompts for Luma.
2. **Audio (Voice & BGM):**
   - VO: Google Cloud TTS (Chirp).
   - BGM: Google Lyria (MusicFX API). *Note: Lyria is very cheap (~$0.04 - $0.08 per song).*
3. **Video (Visuals):**
   - Luma API (Pro Tier $90/mo) generates b-roll clips (12-18 clips per video).
4. **Stitching & Burn:**
   - FFmpeg runs inside a Docker container (with strict RAM/CPU limits).
   - FFmpeg stitches Luma clips, TTS audio, Lyria BGM, and burns `.ass` dynamic subtitles (with timestamps from Gemini).
5. **Storage:** Final MP4 uploaded to cloud storage / target platform.

## 4. Existing Code Deprecation
- The existing local Puppeteer/Playwright scraper logic for video generation will be completely removed. History is preserved in Git.

## 5. Deployment Constraints
- **Docker:** FFmpeg must be isolated in a Docker container to prevent memory leaks and server crashes during heavy encoding.
