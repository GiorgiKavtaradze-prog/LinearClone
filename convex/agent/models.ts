import { openai } from "@ai-sdk/openai";

export const CHAT_MODEL_ID = "gpt-5.4-mini";

export const EMBEDDING_MODEL_ID = "text-embedding-3-small";

export const chatModel = openai.chat(CHAT_MODEL_ID);

export const embeddingModel = openai.embedding(EMBEDDING_MODEL_ID);

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export const AI_NOT_CONFIGURED_MESSAGE =
  "The AI agent is not configured yet: the OPENAI_API_KEY environment variable is missing on the Convex deployment.";

export function assertAiConfigured(): void {
  if (!isAiConfigured()) {
    throw new Error(AI_NOT_CONFIGURED_MESSAGE);
  }
}
