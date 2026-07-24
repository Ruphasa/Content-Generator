# Venturo Pro AI Content Generator

An interactive, Next.js-based web application that streamlines the process of generating AI content (Videos, Websites, Campaigns). 

## Features (Exist)
- **Flexible Sidecar UX (Pomeli-style):** A modern, non-linear form for inputting comprehensive brand identity (DNA Form) alongside a context-aware AI Chatbot.
- **Visual Guide (Content Planner):** Detailed per-video planning parameters (Hook, Validasi, Insight, Action/CTA, Visual Focus) for multi-video generation routing.
- **Advanced Asset Management:** Supports Global Assets and Video-Specific Asset Folders. Users are prompted to assign a folder when generating content.
- **Proactive AI Copilot:** The Chatbot reads user focus and conditionally triggers to provide *alternative* suggestions based on the field being edited (if exist, analyzes then suggests distinct options; if empty, recommends options).
- **Dual-Typography & UI Layout:** Select Primary & Secondary fonts visually. The Bento Grid UI intelligently scales input fields (Brand Story vs Visi Misi).
- **Glassmorphism UI:** Premium styling featuring Venturo's signature Teal (`#009BAD`) with sleek frosted-glass effects.
- **Spreadsheet Sync Integration:** One-click sync of Brand DNA, Visual Guides, and Assets from Google Sheets with auto-fill functionality.
- **Custom Notification System:** Glassmorphism toast notifications replacing native browser alerts.
- **Dynamic Font & Color Injection:** The Chatbot provides clickable styling suggestions that instantly update the form.

- **Phase 5: Generative AI Video Pipeline:**
  - **AI Director:** Gemini 2.5 Flash for multimodal scene planning
  - **BGM Generator:** Lyria 3 Clip for custom 30s background music
  - **Narration:** Edge TTS for high-quality Indonesian voice-overs
  - **Video Generation (Dreamina):** Dreamina Seedance 2.0 Fast via local `jimeng-api` Docker service (0 cost, high quality 9:16 vertical video)
  - **In-Browser Video Stitching:** FFmpeg WASM for zero-cost, zero-server video assembly and overlays
- **Full Authentication Flow:** Supabase Auth-based login and session persistence across forms.

## Dreamina AI Video Generation Setup

### 1. Run Local `jimeng-api` Docker Service
```bash
docker run -d \
  --name jimeng-api \
  -p 5100:5100 \
  --restart unless-stopped \
  ghcr.io/iptag/jimeng-api:latest
```

### 2. Configure Environment Variables in `.env.local`
```env
JIMENG_API_BASE_URL=http://localhost:5100
DREAMINA_SESSION_ID=sg-YOUR_SESSION_ID
DREAMINA_VIDEO_MODEL=jimeng-video-seedance-2.0-fast
```
*Note: Prefix `sg-` is used for Singapore region accounts.*

## Walkthroughs
- **[Latest Walkthrough (UI Revamps & AI Feedback)](file:///C:/Users/ASUS/.gemini/antigravity-ide/brain/05b1ce53-6437-4b4b-82f9-b6710cd07e2f/walkthrough.md)**: Details the dual-font implementation, Brand Story scrolling fixes, layout scaling, and corrected contextual LLM prompts.

## Tech Stack
- [Next.js](https://nextjs.org/) (App Router)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Vercel AI SDK](https://sdk.vercel.ai/), [Groq](https://groq.com/) (LLM Chatbot) & [Google AI Studio](https://aistudio.google.com/) (Gemini & Lyria 3)
- [Edge TTS](https://github.com/rany2/edge-tts) & [FFmpeg WASM](https://ffmpegwasm.netlify.app/)
- [Supabase](https://supabase.com/) (Auth & Storage)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Bun](https://bun.sh/)

## Getting Started

First, install dependencies:

```bash
bun install
```

Run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Spreadsheet Sync Guide

### Setup
1. **Google Sheets API Setup**
   - Create a Google Cloud project at [console.cloud.google.com](https://console.cloud.google.com)
   - Enable Google Sheets API and Drive API
   - Create a service account key (JSON format) and save it as `clean-avatar-476113-j3-9b345434f178.json` in the project root
   - Set the `GOOGLE_SERVICE_ACCOUNT_KEY` environment variable in `.env.local`

2. **Create Your Spreadsheet**
   - Create a Google Sheet with the following tabs:
     - **BrandProfile**: Row 2 contains DNA data (brandName, tagline, brandOverview, visi, misi, targetAudience, keyVocabulary, bannedContent, standardCTA, tone, visualStyle, primaryColor, secondaryColor, hashtagStyle)
     - **VisualGuideline**: Row 2 contains visual guide data (konten, referensi, goal, videoStyle, sound, caption, visualFocus, hook, validasi, insight, actionCta)
     - **Assets**: Row 1 = headers, Row 2+ = folder data (Column 1 = folder name, remaining columns = file URLs)

3. **Enable Sharing**
   - Share the spreadsheet with your service account email (found in the JSON key)

### Usage
- **Sync Brand DNA**: Click the refresh icon in the Brand Overview header
- **Sync Visual Guide**: Click the refresh icon in the Visual Guide header
- **Sync Assets**: Click the refresh icon in the Assets page header
- Enter your Spreadsheet ID (the part between `/d/` and `/edit` in the URL) when prompted
- Data will be auto-filled from the spreadsheet
