import OpenAI from 'openai';
import type { ToolDefinition } from './shared.js';

export function createOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
      'X-Title': process.env.SITE_NAME || 'cheap-ai',
    },
  });
}

export interface StreamOptions {
  model: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  tools?: ToolDefinition[];
  systemPrompt?: string;
  onText?: (text: string) => void;
  onToolStart?: (name: string, input: Record<string, unknown>) => void;
  onToolEnd?: (name: string, result: string) => void;
  executeTool?: (name: string, input: Record<string, unknown>) => Promise<string>;
}

export async function runAgentLoop(
  client: OpenAI,
  opts: StreamOptions,
): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    ...(opts.systemPrompt
      ? [{ role: 'system' as const, content: opts.systemPrompt }]
      : []),
    ...opts.messages,
  ];

  let fullResponse = '';
  const maxIterations = 20;

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.chat.completions.create({
      model: opts.model,
      messages,
      tools: opts.tools as OpenAI.ChatCompletionTool[],
      tool_choice: opts.tools ? 'auto' : undefined,
      stream: true,
    });

    let currentText = '';
    const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];
    let currentToolCall: {
      id: string;
      name: string;
      args: string;
    } | null = null;

    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        currentText += delta.content;
        fullResponse += delta.content;
        opts.onText?.(delta.content);
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            if (!currentToolCall || toolCalls.length <= tc.index) {
              currentToolCall = {
                id: tc.id || `call_${Date.now()}`,
                name: tc.function?.name || '',
                args: '',
              };
              toolCalls.push({
                id: currentToolCall.id,
                type: 'function',
                function: { name: currentToolCall.name, arguments: '' },
              });
            }
            if (tc.function?.name) {
              toolCalls[tc.index].function.name = tc.function.name;
              if (currentToolCall) currentToolCall.name = tc.function.name;
            }
            if (tc.function?.arguments) {
              toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
            if (tc.id) {
              toolCalls[tc.index].id = tc.id;
            }
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        messages.push({ role: 'assistant', content: currentText });
        return fullResponse;
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        messages.push({
          role: 'assistant',
          content: currentText || null,
          tool_calls: toolCalls,
        });

        const toolResults: OpenAI.ChatCompletionToolMessageParam[] = [];

        for (const tc of toolCalls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(tc.function.arguments || '{}');
          } catch {
            input = {};
          }

          opts.onToolStart?.(tc.function.name, input);

          let result = '';
          if (opts.executeTool) {
            try {
              result = await opts.executeTool(tc.function.name, input);
            } catch (err) {
              result = `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
          }

          opts.onToolEnd?.(tc.function.name, result);

          toolResults.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result,
          });
        }

        messages.push(...toolResults);
        break;
      }
    }
  }

  return fullResponse;
}

export async function fetchModels(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  const data = await res.json() as { data: Array<{ id: string; name: string }> };
  return data.data || [];
}
