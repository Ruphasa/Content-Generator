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
- **AI Content Pipeline (100% Free & Zero VRAM):**
  - **AI Director:** Gemini 2.5 Flash (via `@google/genai`)
  - **BGM Generation:** Suno AI via Local Browser Automation (Playwright driving suno.com/create to bypass WAF)
  - **Narration TTS:** Edge TTS (`edge-tts-universal`, `id-ID-AndikaNeural`)
  - **T2I Generation:** Cloudflare Workers AI (Fast & Free Image generation for initial frames)
  - **Video Generation:** Dreamina Seedance 2.0 via Local Browser Automation (Puppeteer driving the Canvas UI to bypass WAF, avoiding 3rd party APIs).
  - **Video Stitching:** FFmpeg WASM (Browser-side stitching, zero server cost)

## Key Features
1. **Flexible Sidecar UX** - Non-linear DNA form + AI Chatbot
2. **Visual Guide (Content Planner)** - Per-video planning parameters
3. **Advanced Asset Management** - Global Assets + Video-Specific Folders
4. **Proactive AI Copilot** - Contextual suggestions on field focus
5. **Spreadsheet Sync** - One-click data sync from Google Sheets
6. **Custom Toast System** - Glassmorphism notifications (no native alerts)
7. **Free Unlimited AI Video Generation Pipeline** - 100% Serverless, Vercel-ready, utilizing FFmpeg WASM and Gemini API free tier.

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
│   ├── google/
│   │   ├── sheets.ts              # Google Sheets API client
│   │   └── drive.ts               # Google Drive download helper
│   └── supabase/
│       ├── client.ts              # Browser Supabase client
│       └── server.ts              # Server Supabase client
├── app/
│   ├── actions/
│   │   └── sync.ts                # Spreadsheet sync actions
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts           # AI chat endpoint
│   │   └── generate/
│   │       ├── route.ts           # Orchestrator API (SSE)
│   │       ├── director/          # Gemini 2.5 Flash Editing Plan
│   │       ├── tts/               # Edge TTS (Andika/Gadis)
│   │       ├── bgm/               # Lyria 3 Clip (BGM Generator)
│   │       └── video-gen/         # Gemini Omni Flash (T2V Fallback)
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
   - **Assets** sheet: Column A = folder name, Column B = file URLs, Column C = filename

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
- **Column 1:** Folder name (Folder)
- **Column 2:** Google Drive URL
- **Column 3:** Keterangan (Filename)
- *Note:* Files are NOT downloaded directly via Next.js to bypass Vercel limits. We store the Google Drive URLs in state, and FFmpeg WASM will download them directly in the browser during the stitching process.

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
