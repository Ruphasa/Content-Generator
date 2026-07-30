# Claude Configuration for AI Video Content Generator

## Project Overview
Venturo Pro AI Content Generator is a Next.js (App Router) application with a flexible sidecar UX (Pomeli-style) where users interact with a dynamic DNA form on the left and a real-time AI Chatbot on the right.

## Tech Stack
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Package Manager:** Bun
- **Styling:** Venturo Teal (`#009BAD` and `#006D79`) with Glassmorphism
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **AI:** Vercel AI SDK + Groq
- **Backend:** Supabase (Auth, Storage, Database)
- **Spreadsheet Integration:** Google Sheets API
- **AI Content Pipeline (local ComfyUI + Cloudflare, no 3rd-party video APIs):**
  - **AI Director:** Gemini 2.5 Flash (via `@google/genai`)
  - **T2I Generation:** Cloudflare Workers AI (`src/lib/cloudflare/image.ts`) — produces the opening still frame. Deliberately NOT moved to ComfyUI.
  - **Video Generation:** Stable Video Diffusion (image-to-video) on a local ComfyUI instance
  - **BGM Generation:** ACE-Step on the same local ComfyUI instance
  - **Narration TTS:** VoxCPM2 on the same local ComfyUI instance (custom node pack)
  - **Subtitles:** Whisper on the same local ComfyUI instance, emitting an `.srt` (custom node pack)
  - **Post-processing:** Server-side FFmpeg via `fluent-ffmpeg` (`src/lib/ffmpeg/dynamic_editor.ts`) — Ken Burns, sidechain audio ducking, burned-in styled subtitles. Not plain concatenation.

  **VRAM (8GB target):** ComfyUI graphs are queued and awaited **one at a time**, never
  in parallel, so a single checkpoint is resident at a time and ComfyUI can swap models
  RAM → VRAM in turn. Firing them concurrently will OOM the card.

  **Browser automation is gone.** The Suno (Playwright) and Dreamina (Puppeteer)
  scrapers and their API routes were deleted; do not reintroduce them. Edge TTS and
  FFmpeg WASM are likewise no longer the pipeline's TTS/stitching path.

## Key Features
1. **Flexible Sidecar UX** - Non-linear DNA form + AI Chatbot
2. **Visual Guide (Content Planner)** - Per-video planning parameters
3. **Advanced Asset Management** - Global Assets + Video-Specific Folders
4. **Proactive AI Copilot** - Contextual suggestions on field focus
5. **Spreadsheet Sync** - One-click data sync from Google Sheets
6. **Custom Toast System** - Glassmorphism notifications (no native alerts)
7. **Local AI Video Generation Pipeline** - One server action drives Cloudflare T2I, four sequential ComfyUI workflows, and a server-side FFmpeg edit. Runs against a local GPU; not serverless.

## Architecture

### State Management
- **DNA Data:** `DNAData` type in `ClientLayout.tsx`
  - Brand Overview fields (brandName, tagline, brandOverview, etc.)
  - Business Details fields (location, businessHours, socialLinks, etc.)
  - Persisted in `localStorage` as `dna_form_state`
  
- **Visual Guide:** `VisualGuideData` type
  - Content planning fields (konten, referensi, goal, etc.)
  - Persisted in `localStorage` as `visual_guide_state`
  
- **Assets:** 
  - `globalAssets: File[]`
  - `assetFolders: AssetFolder[]`
  - Persisted in `localStorage` as `asset_folders_state`

### Component Structure
```
src/
├── components/
│   ├── ClientLayout.tsx          # Main layout, state container
│   ├── DNAForm.tsx                # Brand Overview form
│   ├── BusinessDetailsForm.tsx    # Business details form
│   ├── VisualGuidePage.tsx        # Content planner form
│   ├── AssetsPage.tsx             # Asset management
│   ├── SidecarChatbot.tsx         # AI chat interface
│   ├── Toast.tsx                  # Notification system
│   └── ...
├── lib/
│   ├── cloudflare/
│   │   └── image.ts               # Cloudflare Workers AI T2I (opening frame)
│   ├── comfyui/
│   │   ├── client.ts              # ComfyUI HTTP client: queue, poll /history, /view, /upload
│   │   └── workflows.ts           # API-format graph builders (SVD, ACE-Step, VoxCPM2, Whisper)
│   ├── ffmpeg/
│   │   ├── dynamic_editor.ts      # Ken Burns + audio ducking + burned-in subtitles
│   │   └── stitcher.ts            # Legacy multi-scene concatenation helper
│   ├── google/
│   │   ├── sheets.ts              # Google Sheets API client
│   │   └── drive.ts               # Google Drive download helper
│   └── supabase/
│       ├── client.ts              # Browser Supabase client
│       └── server.ts              # Server Supabase client
├── app/
│   ├── actions/
│   │   ├── sync.ts                # Spreadsheet sync actions
│   │   └── generate.ts            # Video pipeline orchestrator (Cloudflare -> ComfyUI -> FFmpeg)
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts           # AI chat endpoint
│   │   └── generate/
│   │       ├── route.ts           # Orchestrator API (SSE)
│   │       ├── director/          # Gemini 2.5 Flash Editing Plan
│   │       ├── tts/               # Legacy Edge TTS route (superseded by ComfyUI VoxCPM2)
│   │       ├── bgm/               # Legacy BGM route, currently a mock (superseded by ComfyUI ACE-Step)
│   │       └── stitch/            # Server-side FFmpeg multi-scene stitching
│   └── ...
└── pages/
    ├── login/page.tsx
    ├── register/page.tsx
    └── ...
```

## Google Sheets Integration

### Setup
1. Service account JSON key in `.env.local` as `GOOGLE_SERVICE_ACCOUNT_KEY`
2. Spreadsheet structure:
   - **BrandProfile** sheet: Vertical parsing (Column A = key, Column B = value)
   - **VisualGuideline** sheet: Vertical parsing (Column A = key, Column B = value)
   - **Assets** sheet: Column A = folder name, Column C = filename (Keterangan), Column D = file URL (Link Download)

### Usage
- Click Global Sync Button in the top header
- Enter Spreadsheet ID when prompted
- Data from 3 sheets is pulled concurrently

### Actions
- `syncAll(spreadsheetId)` -> Handles BrandProfile, VisualGuideline, and Assets together.

### Actions
- `syncDNAForm(spreadsheetId)` → Returns `DNAData`
- `syncVisualGuide(spreadsheetId)` → Returns `VisualGuideData`
- `syncAssets(spreadsheetId)` → Returns `AssetFolder[]`

## Notification System

### Toast Component (`Toast.tsx`)
- Overlay centered notifications
- Glassmorphism: semi-transparent white, backdrop-blur
- Variants: success (green), error (red), info (blue), warning (orange)
- Auto-dismiss after 4 seconds
- Framer Motion animations
- Supports stacking multiple toasts

### Usage
```typescript
import { showSuccess, showError, showInfo, showWarning } from '@/components/Toast';

showSuccess("Data berhasil disinkronkan!");
showError("Gagal mengambil data");
showInfo("Mengunggah aset...");
showWarning("Peringatan: Bucket belum dibuat");
```

### Replaced Alerts
- `alert()` → `showError()` / `showSuccess()` / `showInfo()`
- `confirm()` → Custom confirmation modal
- `prompt()` → Custom input modal

## Field Mappings

### Vertical Parsing (Column A -> Key, Column B -> Value)
- BrandProfile uses keys like: `brandname`, `tagline`, `toneofvoice`, `targetaudience`, `typography`, `hashtags`, dll.
- VisualGuideline uses keys like: `konten`, `referensi`, `hook`, `validasi`, `action (cta)`, dll.

### Assets Sheet
- **Column A (1):** Folder name (Folder)
- **Column C (3):** Keterangan (Filename) — falls back to Column B when C is empty
- **Column D (4):** Google Drive URL (Link Download)
- *Note:* If the sheet has data rows but no URL in Column D, `syncAssets` returns `success: false` naming the expected column rather than silently reporting "0 aset".
- *Note:* Files are NOT downloaded during sync. Only the Google Drive URLs are stored in state; they are fetched later, server-side, by whichever FFmpeg stage needs the bytes.

## Styling Guidelines
- **Colors:** Venturo Teal (`#009BAD`), Venturo Dark (`#006D79`)
- **Glassmorphism:** `bg-white/70 backdrop-blur-xl border-white/50`
- **Borders:** White/40 with subtle transparency
- **Shadows:** `shadow-xl` for depth
- **Typography:** Dual-font system (primaryFont + secondaryFont)
- **Animations:** Framer Motion with spring physics

## Best Practices
1. Always use `localStorage` for persistence
2. Use toast notifications instead of native alerts
3. Use custom modals instead of `prompt()`/`confirm()`
4. Handle errors gracefully with toast notifications
5. Map spreadsheet columns correctly (case-sensitive)
6. Always provide fallback values for empty cells
7. Use glassmorphism consistently for premium feel
8. Animate all interactive elements

## Error Handling
- Try/catch blocks around all async operations
- User-friendly error messages in Indonesian
- Console logging for debugging
- Graceful fallbacks for missing data

## Notes
- All alerts have been replaced with custom toast system
- Spreadsheet sync uses server actions for security
- Google Sheets API uses service account authentication
- File downloads use direct URLs (public or service-account-accessible)
