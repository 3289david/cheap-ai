import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getDb, getSetting } from '../db.js';
import { AGENT_TOOLS } from '@cheap-ai/shared';

export interface Provider {
  id: string;
  name: string;
  type: 'openrouter' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';
  base_url: string | null;
  api_key: string | null;
  is_default: number;
  is_enabled: number;
  models: string;
  config: string;
}

export function getProviders(): Provider[] {
  return getDb().prepare('SELECT * FROM ai_providers WHERE is_enabled = 1 ORDER BY is_default DESC, name ASC').all() as Provider[];
}

export function getDefaultProvider(): Provider | null {
  const providers = getProviders();
  if (providers.length > 0) return providers[0];

  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey) {
    return {
      id: 'env-openrouter',
      name: 'OpenRouter (env)',
      type: 'openrouter',
      base_url: 'https://openrouter.ai/api/v1',
      api_key: envKey,
      is_default: 1,
      is_enabled: 1,
      models: '[]',
      config: '{}',
    };
  }

  return null;
}

export function getProviderById(id: string): Provider | null {
  if (id === 'env-openrouter') return getDefaultProvider();
  return getDb().prepare('SELECT * FROM ai_providers WHERE id = ?').get(id) as Provider | null;
}

function buildOpenAIClient(provider: Provider): OpenAI {
  const baseURL = provider.base_url || getBaseUrl(provider.type);
  const apiKey = provider.api_key || 'no-key';

  const headers: Record<string, string> = {
    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
    'X-Title': getSetting('site_name', 'cheap-ai'),
  };

  return new OpenAI({ apiKey, baseURL, defaultHeaders: headers });
}

function getBaseUrl(type: string): string {
  switch (type) {
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    case 'openai': return 'https://api.openai.com/v1';
    case 'gemini': return 'https://generativelanguage.googleapis.com/v1beta/openai';
    case 'ollama': return 'http://localhost:11434/v1';
    default: return 'https://openrouter.ai/api/v1';
  }
}

export interface StreamOptions {
  provider: Provider;
  model: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  systemPrompt?: string;
  onText?: (text: string) => void;
  onToolStart?: (name: string, input: Record<string, unknown>) => void;
  onToolEnd?: (name: string, result: string) => void;
  executeTool?: (name: string, input: Record<string, unknown>) => Promise<string>;
  useTools?: boolean;
}

export async function runAgentWithProvider(opts: StreamOptions): Promise<OpenAI.ChatCompletionMessageParam[]> {
  const { provider, model } = opts;

  if (provider.type === 'anthropic') {
    return runAnthropicAgent(opts);
  }

  return runOpenAICompatibleAgent(opts);
}

async function runOpenAICompatibleAgent(opts: StreamOptions): Promise<OpenAI.ChatCompletionMessageParam[]> {
  const client = buildOpenAIClient(opts.provider);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    ...(opts.systemPrompt ? [{ role: 'system' as const, content: opts.systemPrompt }] : []),
    ...opts.messages,
  ];

  const tools = opts.useTools !== false ? AGENT_TOOLS as OpenAI.ChatCompletionTool[] : undefined;
  const maxIter = 20;

  for (let i = 0; i < maxIter; i++) {
    const stream = await client.chat.completions.create({
      model: opts.model,
      messages,
      tools,
      tool_choice: tools ? 'auto' : undefined,
      stream: true,
    });

    let currentText = '';
    const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        currentText += delta.content;
        opts.onText?.(delta.content);
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            while (toolCalls.length <= tc.index) {
              toolCalls.push({ id: '', type: 'function', function: { name: '', arguments: '' } });
            }
            if (tc.id) toolCalls[tc.index].id = tc.id;
            if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }

      const finish = chunk.choices[0]?.finish_reason;

      if (finish === 'stop') {
        messages.push({ role: 'assistant', content: currentText });
        return messages.slice(opts.systemPrompt ? 1 : 0);
      }

      if (finish === 'tool_calls') {
        messages.push({ role: 'assistant', content: currentText || null, tool_calls: toolCalls });

        for (const tc of toolCalls) {
          let input: Record<string, unknown> = {};
          try { input = JSON.parse(tc.function.arguments || '{}'); } catch {}

          opts.onToolStart?.(tc.function.name, input);
          const result = opts.executeTool ? await opts.executeTool(tc.function.name, input) : 'Tool not available';
          opts.onToolEnd?.(tc.function.name, result);

          messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
        break;
      }
    }
  }

  return messages.slice(opts.systemPrompt ? 1 : 0);
}

async function runAnthropicAgent(opts: StreamOptions): Promise<OpenAI.ChatCompletionMessageParam[]> {
  const apiKey = opts.provider.api_key;
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const client = new Anthropic({
    apiKey,
    baseURL: opts.provider.base_url || undefined,
  });

  const anthropicMessages: Anthropic.MessageParam[] = opts.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })) as Anthropic.MessageParam[];

  const tools: Anthropic.Tool[] = (AGENT_TOOLS).map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters as Anthropic.Tool['input_schema'],
  }));

  const maxIter = 20;
  const allMessages = [...opts.messages];

  for (let i = 0; i < maxIter; i++) {
    const stream = client.messages.stream({
      model: opts.model,
      max_tokens: 8096,
      system: opts.systemPrompt,
      messages: anthropicMessages,
      tools: opts.useTools !== false ? tools : undefined,
    });

    let currentText = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          currentText += event.delta.text;
          opts.onText?.(event.delta.text);
        }
      }
    }

    const response = await stream.finalMessage();

    if (response.stop_reason === 'end_turn') {
      allMessages.push({ role: 'assistant', content: currentText });
      anthropicMessages.push({ role: 'assistant', content: currentText });
      break;
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      anthropicMessages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        const input = block.input as Record<string, unknown>;
        opts.onToolStart?.(block.name, input);
        const result = opts.executeTool ? await opts.executeTool(block.name, input) : 'Tool not available';
        opts.onToolEnd?.(block.name, result);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }

      anthropicMessages.push({ role: 'user', content: toolResults });
      break;
    }

    break;
  }

  return allMessages;
}

export function buildSystemPrompt(memories: Array<{ category: string; content: string }>): string {
  const base = `You are cheap-ai — a powerful AI coding agent. You have full access to the user's project files and can execute shell commands. You are a senior developer helping the user build, fix, and deploy software.

Be concise, action-oriented, and proactive. Use tools without asking for permission. Read files before editing them.`;

  if (memories.length === 0) return base;
  const memText = memories.map(m => `[${m.category}] ${m.content}`).join('\n');
  return `${base}\n\n## Project Memory\n${memText}`;
}
