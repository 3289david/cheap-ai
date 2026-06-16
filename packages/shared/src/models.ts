export const POPULAR_MODELS = [
  { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', tier: 'pro' },
  { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5', tier: 'hobby' },
  { id: 'anthropic/claude-opus-4-5', name: 'Claude Opus 4.5', tier: 'pro' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', tier: 'pro' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', tier: 'hobby' },
  { id: 'openai/o3-mini', name: 'o3 Mini', tier: 'pro' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', tier: 'hobby' },
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', tier: 'pro' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tier: 'hobby' },
  { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3', tier: 'free' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', tier: 'free' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large', tier: 'hobby' },
  { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', tier: 'free' },
] as const;

export type ModelId = typeof POPULAR_MODELS[number]['id'];

export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5';
export const FREE_MODEL = 'deepseek/deepseek-chat-v3-0324';
export const FAST_MODEL = 'anthropic/claude-haiku-4-5';
