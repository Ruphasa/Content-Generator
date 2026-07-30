# Task 1 Report: Add Audio Duration Probing to FFmpeg Utils

## Overview
Implemented `probeDuration(filePath: string): Promise<number>` in `src/lib/ffmpeg/probe.ts` to probe the exact duration of audio files using `fluent-ffmpeg` (`ffprobe`).

## Implementation Details
- **Function**: `probeDuration(filePath: string): Promise<number>`
- **Behavior**: Uses `ffmpeg.ffprobe` to read `metadata?.format?.duration`. If `ffprobe` encounters an error, or if the duration is invalid/not finite or `<= 0`, it throws `Error('Gagal membaca durasi file audio.')`.
- **Location**: Added export in `src/lib/ffmpeg/probe.ts`.

## Verification & Testing
- Added unit tests in `src/lib/ffmpeg/probe.test.ts`:
  1. Valid media file probing (`dummy.mp4`) -> returns numeric duration `> 0`.
  2. Non-existent / invalid file probing -> throws `Error('Gagal membaca durasi file audio.')`.
- Ran unit tests with Bun (`bun test src/lib/ffmpeg/probe.test.ts`):
  - Results: 2/2 tests passed, output pristine.
- Ran type checking (`bun run tsc --noEmit`):
  - Results: Passed with exit code 0.

## Files Changed
- `src/lib/ffmpeg/probe.ts` (modified)
- `src/lib/ffmpeg/probe.test.ts` (created)

## Self-Review Findings
- Completeness: All task brief requirements implemented.
- Quality: Clean TypeScript implementation following existing project patterns in `probe.ts`.
- Discipline: Followed minimal design without unnecessary dependencies or side effects.

## Commit Details
- Commit: `b3c8645` (`feat(ffmpeg): add audio duration probing utility probeDuration`)
