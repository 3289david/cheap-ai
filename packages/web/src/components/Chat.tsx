import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Trash2, ChevronDown, Loader2, Terminal, FileText, Wrench } from 'lucide-react';
import { useStore } from '../store';
import { getSocket } from '../lib/socket';
import { v4 as uuid } from 'uuid';
import { POPULAR_MODELS } from '@cheap-ai/shared';

export default function Chat() {
  const {
    apiUrl, activeProjectId, projects,
    conversations, activeConversationId,
    addMessage, updateMessage, clearConversation,
    selectedModel, setSelectedModel,
    isAgentThinking, setAgentThinking,
    agentStreamingText, appendStreamingText, clearStreamingText,
  } = useStore();

  const [input, setInput] = useState('');
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socket = getSocket(apiUrl);

  const project = projects.find(p => p.id === activeProjectId);
  const messages = conversations[activeConversationId] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentStreamingText]);

  useEffect(() => {
    const onText = ({ text }: { text: string }) => {
      appendStreamingText(text);
      if (streamingMsgId) {
        updateMessage(activeConversationId, streamingMsgId, {
          content: (useStore.getState().agentStreamingText),
          streaming: true,
        });
      }
    };

    const onToolStart = ({ name, input: toolInput }: { name: string; input: Record<string, unknown> }) => {
      addMessage(activeConversationId, {
        role: 'tool',
        content: formatToolInput(name, toolInput),
        toolName: name,
        toolInput,
      });
    };

    const onToolEnd = ({ name, result }: { name: string; result: string }) => {
      const msgs = useStore.getState().conversations[activeConversationId] || [];
      const toolMsg = [...msgs].reverse().find(m => m.role === 'tool' && m.toolName === name && !m.toolOutput);
      if (toolMsg) {
        updateMessage(activeConversationId, toolMsg.id, { toolOutput: result });
      }
    };

    const onDone = ({ message }: { message: string }) => {
      setAgentThinking(false);
      if (streamingMsgId) {
        updateMessage(activeConversationId, streamingMsgId, {
          content: message || useStore.getState().agentStreamingText,
          streaming: false,
        });
      }
      clearStreamingText();
      setStreamingMsgId(null);
    };

    const onError = ({ error }: { error: string }) => {
      setAgentThinking(false);
      clearStreamingText();
      setStreamingMsgId(null);
      addMessage(activeConversationId, {
        role: 'assistant',
        content: `Error: ${error}`,
      });
    };

    socket.on('agent:text', onText);
    socket.on('agent:tool_start', onToolStart);
    socket.on('agent:tool_end', onToolEnd);
    socket.on('agent:done', onDone);
    socket.on('agent:error', onError);

    return () => {
      socket.off('agent:text', onText);
      socket.off('agent:tool_start', onToolStart);
      socket.off('agent:tool_end', onToolEnd);
      socket.off('agent:done', onDone);
      socket.off('agent:error', onError);
    };
  }, [socket, streamingMsgId, activeConversationId]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isAgentThinking || !activeProjectId) return;

    setInput('');
    clearStreamingText();

    addMessage(activeConversationId, { role: 'user', content: text });

    const msgId = addMessage(activeConversationId, { role: 'assistant', content: '', streaming: true });
    setStreamingMsgId(msgId);
    setAgentThinking(true);

    socket.emit('agent:message', {
      projectId: activeProjectId,
      projectPath: project?.path || '',
      conversationId: activeConversationId,
      message: text,
      model: selectedModel,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatToolInput(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case 'read_file': return `Read: ${input.path}`;
      case 'write_file': return `Write: ${input.path}`;
      case 'edit_file': return `Edit: ${input.path}`;
      case 'execute_command': return `Run: ${input.command}`;
      case 'list_files': return `List: ${input.path || '.'}`;
      case 'search_files': return `Search: "${input.pattern}"`;
      case 'remember': return `Remember: "${String(input.content || '').slice(0, 60)}"`;
      case 'web_fetch': return `Fetch: ${input.url}`;
      default: return `${name}(${JSON.stringify(input).slice(0, 80)})`;
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary border-l border-bg-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bg-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-primary">AI Agent</span>
          {isAgentThinking && (
            <Loader2 size={12} className="animate-spin text-accent-blue" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="text-[11px] bg-bg-tertiary text-text-secondary border border-bg-border rounded px-1 py-0.5 focus:outline-none max-w-[120px]"
          >
            {POPULAR_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button
            onClick={() => clearConversation(activeConversationId)}
            className="p-1 hover:bg-bg-hover rounded text-text-muted hover:text-text-primary transition-colors"
            title="Clear chat"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-text-muted text-xs text-center pt-4">
              {project ? `Working on: ${project.name}` : 'Select a project to start'}
            </p>
            {project && (
              <div className="grid gap-1.5">
                {[
                  'Show me the project structure',
                  'Fix any bugs you find',
                  'Add error handling',
                  'Write tests for the main functions',
                ].map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                    className="text-left text-xs px-3 py-2 bg-bg-tertiary hover:bg-bg-hover rounded border border-bg-border transition-colors text-text-secondary"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isAgentThinking && !streamingMsgId && (
          <div className="flex gap-2">
            <div className="bg-bg-tertiary rounded-lg px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full bg-accent-blue typing-dot`} style={{ animationDelay: `${i * 0.16}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-bg-border p-3">
        <div className={`flex items-end gap-2 bg-bg-tertiary rounded-lg border ${isAgentThinking ? 'border-accent-blue/50' : 'border-bg-border'} transition-colors p-2`}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeProjectId ? 'Ask AI anything...' : 'Select a project first'}
            disabled={!activeProjectId}
            rows={1}
            className="flex-1 bg-transparent text-text-primary text-sm resize-none focus:outline-none placeholder:text-text-muted max-h-32 min-h-[1.5rem]"
            style={{ lineHeight: '1.5rem' }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isAgentThinking || !activeProjectId}
            className="p-1.5 rounded-md bg-accent-blue text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-1 text-center">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ReturnType<typeof useStore.getState>['conversations'][string][number] }) {
  const [collapsed, setCollapsed] = useState(false);

  if (msg.role === 'tool') {
    return (
      <div className="flex gap-2">
        <div className="flex-1 bg-bg-tertiary border border-bg-border rounded-lg overflow-hidden">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-bg-hover transition-colors"
          >
            <Wrench size={12} className="text-accent-yellow flex-shrink-0" />
            <span className="text-xs text-text-secondary flex-1 text-left truncate">{msg.content}</span>
            <ChevronDown size={12} className={`text-text-muted transition-transform flex-shrink-0 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          {!collapsed && msg.toolOutput && (
            <div className="px-3 pb-2 border-t border-bg-border">
              <pre className="text-[11px] text-text-secondary mt-1.5 overflow-auto max-h-32 whitespace-pre-wrap">
                {msg.toolOutput.slice(0, 1000)}{msg.toolOutput.length > 1000 ? '\n...(truncated)' : ''}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-accent-blue/20 border border-accent-blue/30 rounded-lg px-3 py-2">
          <p className="text-sm text-text-primary whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="flex-1 min-w-0">
        <div className="chat-message text-sm text-text-primary">
          {msg.streaming && !msg.content ? (
            <Loader2 size={14} className="animate-spin text-accent-blue" />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content || ''}
            </ReactMarkdown>
          )}
          {msg.streaming && msg.content && (
            <span className="inline-block w-1.5 h-4 bg-accent-blue ml-0.5 animate-pulse align-text-bottom" />
          )}
        </div>
      </div>
    </div>
  );
}
