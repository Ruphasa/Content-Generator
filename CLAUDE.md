# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js (App Router) web application designed for creating AI-generated videos through a conversational, flexible interface (Pomeli-style). Users interact with a dynamic DNA form alongside a context-aware AI Chatbot.

## Commands

```bash
bun dev          # Run development server
bun run build    # Build for production
bun run lint     # Run ESLint
```

## Architecture

- **Frontend:** Next.js App Router, Tailwind CSS, Framer Motion.
- **Styling:** Glassmorphism UI with Venturo Teal brand colors (`#009BAD`).
- **Core Concept:** Split-view layout (Left: DNA Form, Right: AI Chatbot Assistant). The Chatbot reacts dynamically to the user's input in the form.

## Key conventions & gotchas
- Do not build rigid, step-by-step wizard forms. The form must be flexible and allow users to fill fields in any order.
- The Chatbot acts as a "Copilot" monitoring the form state and offering suggestions.
- The "Create Video" button requires authentication. If the user is unauthenticated, they will be redirected to `/login`.
- DNA Form state is persisted in `localStorage` to prevent data loss when redirecting to login.
- Use `@supabase/ssr` for Supabase authentication. The API keys are stored in `.env.local`.
- Use `bun` for all package management tasks.
- **AI Integration:** Uses Vercel AI SDK (`useChat`, `streamText`) hooked up to Groq (Qwen/Llama). The form state is injected into the AI's context dynamically.
- **Storage:** Uses Supabase Storage for handling footage uploads before submitting to the Pop AI worker.
