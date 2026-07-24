# Workspace Rules for AI Video Content Generator

## Project Overview
This project is a Next.js (App Router) based web application that serves as the interactive frontend for the AI Video Content Generator. It utilizes a "Flexible Sidecar UX" (Pomeli-style) where users fill out a dynamic DNA form on the left while interacting with a real-time AI Chatbot on the right.

## Architecture & Conventions
1. **Framework:** Next.js with React 19 and Tailwind CSS.
2. **Package Manager:** Bun.
3. **Styling:** Venturo Teal (`#009BAD` and `#006D79`) paired with Glassmorphism (semi-transparent backgrounds and backdrop-blur).
4. **State Management:** The Chatbot reacts to changes in the DNA Form state. Do not use a rigid step-by-step form.
5. **Component Libraries:** Framer Motion for micro-animations, Lucide React for icons.
6. **Backend:** Supabase for auth/storage.
7. **Video & Audio Generation Pipeline (0 API Cost):** 
   - Uses a Local Browser Automation Scraper (Puppeteer/Playwright) to drive Dreamina's Canvas UI (Video) and Suno AI (Audio).
   - Cloudflare Workers AI is used for fast, free T2I generation.
   - We use `headless: false` with off-screen positioning to bypass Bot/WAF protections (ByteDance & Cloudflare).
8. **Spreadsheet Integration:** Google Sheets API for one-click sync of Brand DNA, Visual Guides, and Assets.

## Agent Guidelines
- Always prioritize a premium UI/UX feel over basic forms.
- Use `framer-motion` to animate elements entering or leaving the DOM.
- Maintain the Sidecar UX paradigm where the Chatbot assists contextually based on what the user selects in the form.
- Use `@supabase/ssr` for Supabase authentication and server/browser clients.
- DNA Form state is persisted in `localStorage` (`dna_form_state`) to prevent data loss when redirecting to login.
- **AI Integration:** Use Vercel AI SDK (`ai` and `@ai-sdk/groq`) for streaming chat responses. Inject DNA Form state dynamically into the `useChat` hook body to give the AI context.
- **Storage:** Use Supabase Storage (e.g. `footages` bucket) to handle raw video uploads before passing them to the worker.
- **UI States:** Ensure hover states and gradients align with the premium glassmorphism theme (e.g. global hover pencils).
- **Context Mapping:** Pass `dnaState` correctly to the LLM backend so AI suggestions are always context-aware.
- **Visual Guide (Content Planner):** Support a detailed form (Hook, Validasi, Insight, CTA, dll) to route multi-video generation.
- **Asset Management:** Support Global Assets (always available) and specific Asset Folders (per campaign/video).
- **Typography:** The app uses a dual-font system (`primaryFont` and `secondaryFont`).
- **Proactive AI:** The chatbot triggers conditionally on field focus. If the field is empty, it recommends options; if it has a value, it comments on it and provides *different* alternative suggestions (never repeating the existing input).
- **Spreadsheet Sync:** Use `src/app/actions/sync.ts` for client-side actions that interact with Google Sheets API. Always handle errors gracefully with toast notifications.
