export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string | MessageContent[];
  tool_call_id?: string;
}

export interface MessageContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
  tool_use_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  language?: string;
  framework?: string;
  created_at: string;
  updated_at: string;
  status: 'idle' | 'running' | 'deployed' | 'error';
  deploy_url?: string;
  port?: number;
}

export interface AgentTask {
  id: string;
  project_id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  description: string;
  result?: string;
  created_at: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  modified?: string;
}

export interface DeployConfig {
  type: 'docker' | 'static' | 'node' | 'python';
  port?: number;
  env?: Record<string, string>;
  build_cmd?: string;
  start_cmd?: string;
  subdomain?: string;
}

export interface ChatSession {
  id: string;
  project_id: string;
  messages: Message[];
  created_at: string;
}

export type AgentRole = 'general' | 'frontend' | 'backend' | 'devops' | 'security';

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
}

export interface StreamChunk {
  type: 'text' | 'tool_start' | 'tool_end' | 'done' | 'error';
  content?: string;
  tool?: {
    name: string;
    input?: Record<string, unknown>;
    output?: string;
    error?: string;
  };
}
