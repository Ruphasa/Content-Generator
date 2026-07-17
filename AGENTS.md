# Workspace Rules for AI Video Content Generator

## Project Overview
This project is a Next.js (App Router) based web application that serves as the interactive frontend for the AI Video Content Generator. It utilizes a "Flexible Sidecar UX" (Pomeli-style) where users fill out a dynamic DNA form on the left while interacting with a real-time AI Chatbot on the right.

## Architecture & Conventions
1. **Framework:** Next.js with React 19 and Tailwind CSS.
2. **Package Manager:** Bun.
3. **Styling:** Venturo Teal (`#009BAD` and `#006D79`) paired with Glassmorphism (semi-transparent backgrounds and backdrop-blur).
4. **State Management:** The Chatbot reacts to changes in the DNA Form state. Do not use a rigid step-by-step form.
5. **Component Libraries:** Framer Motion for micro-animations, Lucide React for icons.
6. **Backend:** Will eventually integrate with Supabase for auth/storage and Python/C++ workers for video generation (TTS, BGM, Stitching).

## Agent Guidelines
- Always prioritize a premium UI/UX feel over basic forms.
- Use `framer-motion` to animate elements entering or leaving the DOM.
- Maintain the Sidecar UX paradigm where the Chatbot assists contextually based on what the user selects in the form.
- Use `@supabase/ssr` for Supabase authentication and server/browser clients.
- DNA Form state is persisted in `localStorage` (`dna_form_state`) to prevent data loss when redirecting to login.
- **AI Integration:** Use Vercel AI SDK (`ai` and `@ai-sdk/groq`) for streaming chat responses. Inject DNA Form state dynamically into the `useChat` hook body to give the AI context.
- **Storage:** Use Supabase Storage (e.g. `footages` bucket) to handle raw video uploads before passing them to the worker.
