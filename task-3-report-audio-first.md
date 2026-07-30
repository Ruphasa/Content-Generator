# Task 3 Report: Audio-First Architecture

## What was implemented
1. Modified `src/lib/google/director.ts`:
   - Added an optional parameter `srtTranscript: string = ''` to `generateTimeline`.
   - Updated the Gemini prompt to inject the SRT transcript so the AI Director can align clip cuts with spoken sentences.
2. Modified `src/app/actions/generate.ts`:
   - Moved the `Stage 3: Subtitles (Whisper & ASS generation)` block up to execute *before* `generateTimeline` is called (specifically before the `if (useBRollPath)` block).
   - Extracted the generated `srtContent` into the outer scope.
   - Passed `srtContent` as the 3rd argument to `generateTimeline`. If STT fails or is skipped, `srtContent` remains an empty string, which acts as a graceful fallback.

## What was tested and test results
- Verified that types match across function signatures.
- Evaluated `generate.ts` restructuring to ensure all variables (e.g. `voicePath`, `comfy`) are available at the new execution position.
- Ran typecheck using `bun x tsc --noEmit`. No errors found in the modified files.
- All code logic changes conform to the brief strictly.

## Files changed
- `src/lib/google/director.ts`
- `src/app/actions/generate.ts`

## Self-review findings
- The `generateTimeline` parameter signature modification and prompt adjustments were correctly made.
- Moving the Subtitle/Whisper generation before the `useBRollPath` block correctly makes the STT text available for `generateTimeline`.
- Fallbacks are maintained since `srtContent` initializes to `''` and passes correctly even on Whisper failure.
- Checked if `assPath` generation behavior changes: No, it behaves the same, since it only relies on `srtContent` and `voicePath` which are already available.

## Any issues or concerns
- None. The modification cleanly achieves the Audio-First alignment.

## Critical Issue Fix Report
- **Issue**: `srtTranscript` was injected directly without truncation.
- **Fix**: Implemented `const safeSrt = srtTranscript.slice(0, 4000);` in `src/lib/google/director.ts` to prevent token limit errors.
- **Verification**: Typecheck passed via `bun tsc --noEmit`.
