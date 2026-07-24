import { createGroq } from '@ai-sdk/groq';

export const customGroq = createGroq({
  apiKey: process.env.LLM_API_KEY,
});
