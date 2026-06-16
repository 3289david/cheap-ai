import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: 'super_admin' | 'admin' | 'member';
  plan: string;
}

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  content: string;
  modified: boolean;
  language?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  streaming?: boolean;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  status?: string;
  deploy_url?: string;
}

interface AppState {
  apiUrl: string;
  token: string | null;
  user: AuthUser | null;

  projects: Project[];
  activeProjectId: string | null;

  tabs: EditorTab[];
  activeTabId: string | null;

  conversations: Record<string, ChatMessage[]>;
  activeConversationId: string;
  selectedModel: string;
  selectedProviderId: string | null;
  isAgentThinking: boolean;
  agentStreamingText: string;

  showSidebar: boolean;
  showChat: boolean;
  showTerminal: boolean;
  activePanel: 'explorer' | 'search' | 'memory' | 'deploy';

  memories: Record<string, Array<{ id: number; category: string; content: string; created_at: string }>>;

  setApiUrl: (url: string) => void;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;

  setProjects: (projects: Project[]) => void;
  setActiveProject: (id: string | null) => void;

  openTab: (tab: Omit<EditorTab, 'id'>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  markTabSaved: (id: string) => void;

  addMessage: (convId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (convId: string, id: string, update: Partial<ChatMessage>) => void;
  clearConversation: (convId: string) => void;

  setSelectedModel: (model: string) => void;
  setSelectedProvider: (id: string | null) => void;
  setAgentThinking: (thinking: boolean) => void;
  appendStreamingText: (text: string) => void;
  clearStreamingText: () => void;

  toggleSidebar: () => void;
  toggleChat: () => void;
  toggleTerminal: () => void;
  setActivePanel: (panel: AppState['activePanel']) => void;

  setMemories: (projectId: string, memories: AppState['memories'][string]) => void;
  removeMemory: (projectId: string, memoryId: number) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      apiUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      token: null,
      user: null,

      projects: [],
      activeProjectId: null,

      tabs: [],
      activeTabId: null,

      conversations: {},
      activeConversationId: 'default',
      selectedModel: 'anthropic/claude-sonnet-4-5',
      selectedProviderId: null,
      isAgentThinking: false,
      agentStreamingText: '',

      showSidebar: true,
      showChat: true,
      showTerminal: true,
      activePanel: 'explorer',
      memories: {},

      setApiUrl: (url) => set({ apiUrl: url }),
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),

      setProjects: (projects) => set({ projects }),
      setActiveProject: (id) => set({ activeProjectId: id, activeConversationId: id || 'default' }),

      openTab: (tab) => {
        const { tabs } = get();
        const existing = tabs.find(t => t.path === tab.path);
        if (existing) { set({ activeTabId: existing.id }); return; }
        const id = `tab_${Date.now()}`;
        set({ tabs: [...tabs, { ...tab, id }], activeTabId: id });
      },

      closeTab: (id) => {
        const { tabs, activeTabId } = get();
        const newTabs = tabs.filter(t => t.id !== id);
        let newActive = activeTabId;
        if (activeTabId === id) {
          const idx = tabs.findIndex(t => t.id === id);
          newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.id || null;
        }
        set({ tabs: newTabs, activeTabId: newActive });
      },

      setActiveTab: (id) => set({ activeTabId: id }),
      updateTabContent: (id, content) => set(state => ({
        tabs: state.tabs.map(t => t.id === id ? { ...t, content, modified: true } : t),
      })),
      markTabSaved: (id) => set(state => ({
        tabs: state.tabs.map(t => t.id === id ? { ...t, modified: false } : t),
      })),

      addMessage: (convId, msg) => {
        const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        set(state => ({
          conversations: {
            ...state.conversations,
            [convId]: [...(state.conversations[convId] || []), { ...msg, id, timestamp: new Date() }],
          },
        }));
        return id;
      },

      updateMessage: (convId, id, update) => set(state => ({
        conversations: {
          ...state.conversations,
          [convId]: (state.conversations[convId] || []).map(m => m.id === id ? { ...m, ...update } : m),
        },
      })),

      clearConversation: (convId) => set(state => ({
        conversations: { ...state.conversations, [convId]: [] },
      })),

      setSelectedModel: (model) => set({ selectedModel: model }),
      setSelectedProvider: (id) => set({ selectedProviderId: id }),
      setAgentThinking: (thinking) => set({ isAgentThinking: thinking }),
      appendStreamingText: (text) => set(state => ({ agentStreamingText: state.agentStreamingText + text })),
      clearStreamingText: () => set({ agentStreamingText: '' }),

      toggleSidebar: () => set(state => ({ showSidebar: !state.showSidebar })),
      toggleChat: () => set(state => ({ showChat: !state.showChat })),
      toggleTerminal: () => set(state => ({ showTerminal: !state.showTerminal })),
      setActivePanel: (panel) => set({ activePanel: panel }),

      setMemories: (projectId, memories) => set(state => ({
        memories: { ...state.memories, [projectId]: memories },
      })),

      removeMemory: (projectId, memoryId) => set(state => ({
        memories: {
          ...state.memories,
          [projectId]: (state.memories[projectId] || []).filter(m => m.id !== memoryId),
        },
      })),
    }),
    {
      name: 'cheap-ai-storage',
      partialize: (state) => ({
        apiUrl: state.apiUrl,
        token: state.token,
        user: state.user,
        selectedModel: state.selectedModel,
        selectedProviderId: state.selectedProviderId,
        activeProjectId: state.activeProjectId,
        conversations: state.conversations,
        showSidebar: state.showSidebar,
        showChat: state.showChat,
        showTerminal: state.showTerminal,
      }),
    },
  ),
);
