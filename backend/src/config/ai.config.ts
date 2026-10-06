import { registerAs } from '@nestjs/config';

/** OpenRouter credentials and the model used for each stage of the voice loop. */
export default registerAs('ai', () => ({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  models: {
    chat: process.env.OPENROUTER_CHAT_MODEL ?? 'deepseek/deepseek-v4-flash',
    transcription:
      process.env.OPENROUTER_STT_MODEL ?? 'openai/whisper-large-v3-turbo',
    speech: process.env.OPENROUTER_TTS_MODEL ?? 'hexgrad/kokoro-82m',
  },
}));
