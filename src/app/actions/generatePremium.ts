'use server';

import type { GenerateContentInput } from '@/app/actions/generate';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generatePremiumAction(input: GenerateContentInput) {
  await new Promise((r) => setTimeout(r, 3000));
  return {
    success: true,
    message:
      'Video Premium (Veo + Cloud TTS) berhasil dibuat! (Mode Mock)',
    videoUrl: null,
  };
}
