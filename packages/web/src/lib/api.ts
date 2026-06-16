import { useStore } from '../store';

function getBase(): string {
  return useStore.getState().apiUrl || window.location.origin;
}

function getHeaders(): Record<string, string> {
  const token = useStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${getBase()}${path}`, {
    headers: { ...getHeaders(), ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    if (res.status === 401) {
      useStore.getState().clearAuth();
      window.location.href = '/login';
    }
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    register: (data: { email: string; username: string; password: string; inviteToken?: string }) =>
      request<{ token: string; user: AuthUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (email: string, password: string) =>
      request<{ token: string; user: AuthUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => request<AuthUser & { rateLimits: RateLimits; cliTokenCount: number }>('/api/auth/me'),
    cliTokens: () => request<CliToken[]>('/api/auth/cli-tokens'),
    createCliToken: (name?: string) => request<{ token: string; name: string }>('/api/auth/cli-token', { method: 'POST', body: JSON.stringify({ name }) }),
    deleteCliToken: (token: string) => request<{ ok: boolean }>(`/api/auth/cli-token/${token}`, { method: 'DELETE' }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  },

  admin: {
    stats: () => request<AdminStats>('/api/admin/stats'),
    users: (params?: { q?: string; role?: string; banned?: string }) =>
      request<AdminUser[]>(`/api/admin/users${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ''}`),
    getUser: (id: string) => request<AdminUser>(`/api/admin/users/${id}`),
    banUser: (id: string, reason?: string) => request<{ ok: boolean }>(`/api/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) }),
    unbanUser: (id: string) => request<{ ok: boolean }>(`/api/admin/users/${id}/unban`, { method: 'POST' }),
    setRole: (id: string, role: string) => request<{ ok: boolean }>(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    setPlan: (id: string, plan: string) => request<{ ok: boolean }>(`/api/admin/users/${id}/plan`, { method: 'PATCH', body: JSON.stringify({ plan }) }),
    setRateLimits: (id: string, limits: { rate_limit_hour?: number | null; rate_limit_day?: number | null }) =>
      request<{ ok: boolean }>(`/api/admin/users/${id}/rate-limits`, { method: 'PATCH', body: JSON.stringify(limits) }),
    resetPassword: (id: string, newPassword: string) =>
      request<{ ok: boolean }>(`/api/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
    deleteUser: (id: string) => request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),

    providers: () => request<Provider[]>('/api/admin/providers'),
    createProvider: (data: Partial<Provider> & { name: string; type: string }) =>
      request<{ id: string }>('/api/admin/providers', { method: 'POST', body: JSON.stringify(data) }),
    updateProvider: (id: string, data: Partial<Provider>) =>
      request<{ ok: boolean }>(`/api/admin/providers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteProvider: (id: string) => request<{ ok: boolean }>(`/api/admin/providers/${id}`, { method: 'DELETE' }),
    testProvider: (id: string) => request<{ ok: boolean; message?: string; error?: string }>(`/api/admin/providers/${id}/test`, { method: 'POST' }),

    settings: () => request<Record<string, string>>('/api/admin/settings'),
    updateSettings: (data: Record<string, string>) =>
      request<{ ok: boolean }>('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(data) }),

    invites: () => request<Invite[]>('/api/admin/invites'),
    createInvite: (data: { role?: string; max_uses?: number; expires_in_days?: number }) =>
      request<Invite>('/api/admin/invites', { method: 'POST', body: JSON.stringify(data) }),
    deleteInvite: (token: string) => request<{ ok: boolean }>(`/api/admin/invites/${token}`, { method: 'DELETE' }),

    usage: () => request<UsageRow[]>('/api/admin/usage'),
  },

  projects: {
    list: () => request<Project[]>('/api/projects'),
    create: (data: { name: string; description?: string }) =>
      request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request<Project>(`/api/projects/${id}`),
    update: (id: string, data: Partial<Project>) =>
      request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string, deleteFiles = false) =>
      request<{ ok: boolean }>(`/api/projects/${id}?deleteFiles=${deleteFiles}`, { method: 'DELETE' }),
  },

  files: {
    list: (projectId: string, path = '') =>
      request<FileListResponse>(`/api/files/${projectId}?path=${encodeURIComponent(path)}`),
    read: (projectId: string, path: string) =>
      request<{ content: string; path: string }>(`/api/files/${projectId}/content?path=${encodeURIComponent(path)}`),
    write: (projectId: string, path: string, content: string) =>
      request<{ ok: boolean }>(`/api/files/${projectId}/content`, { method: 'PUT', body: JSON.stringify({ path, content }) }),
    delete: (projectId: string, path: string) =>
      request<{ ok: boolean }>(`/api/files/${projectId}/content?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
    search: (projectId: string, query: string) =>
      request<SearchResult[]>(`/api/files/${projectId}/search?q=${encodeURIComponent(query)}`),
  },

  memory: {
    list: (projectId: string) => request<MemoryItem[]>(`/api/projects/${projectId}/memory`),
    add: (projectId: string, content: string, category = 'general') =>
      request<MemoryItem>(`/api/projects/${projectId}/memory`, { method: 'POST', body: JSON.stringify({ content, category }) }),
    deleteAll: (projectId: string) => request<{ ok: boolean }>(`/api/projects/${projectId}/memory`, { method: 'DELETE' }),
    delete: (projectId: string, memoryId: number) =>
      request<{ ok: boolean }>(`/api/projects/${projectId}/memory/${memoryId}`, { method: 'DELETE' }),
  },

  deploy: {
    list: (projectId: string) => request<Deployment[]>(`/api/deploy/project/${projectId}`),
    deploy: (projectId: string, opts: { type?: string; port?: number }) =>
      request<{ deployId: string; status: string; port: number }>(`/api/deploy/project/${projectId}`, { method: 'POST', body: JSON.stringify(opts) }),
    stop: (deployId: string) => request<{ ok: boolean }>(`/api/deploy/${deployId}/stop`, { method: 'POST' }),
  },

  models: {
    popular: () => request<Array<{ id: string; name: string; tier: string }>>('/api/models/popular'),
  },

  health: () => request<{ status: string }>('/api/health'),
  info: () => request<ServerInfo>('/api/info'),
};

// Types
export interface AuthUser { id: string; email: string; username: string; role: string; plan: string; banned?: boolean; }
export interface RateLimits { hour: { used: number; limit: number; remaining: number }; day: { used: number; limit: number; remaining: number }; }
export interface CliToken { token: string; name: string; last_used: string | null; created_at: string; }
export interface AdminStats { users: number; projects: number; conversations: number; activeDeployments: number; enabledProviders: number; messagesToday: number; recentUsers: AdminUser[]; }
export interface AdminUser { id: string; username: string; email: string; role: string; plan: string; banned: number; ban_reason?: string; rate_limit_hour?: number; rate_limit_day?: number; created_at: string; last_seen?: string; }
export interface Provider { id: string; name: string; type: string; base_url?: string; api_key?: string; is_default: number; is_enabled: number; models: string; config: string; }
export interface Invite { token: string; role: string; uses: number; max_uses?: number; expires_at?: string; created_at: string; }
export interface UsageRow { id: string; username: string; email: string; total: number; }
export interface Project { id: string; name: string; path: string; description?: string; status?: string; deploy_url?: string; }
export interface FileListResponse { type: 'file' | 'directory'; path: string; content?: string; items?: Array<{ name: string; type: 'file' | 'directory'; path: string; size?: number; }>; }
export interface SearchResult { file: string; line: number; content: string; }
export interface MemoryItem { id: number; category: string; content: string; created_at: string; }
export interface Deployment { id: string; project_id: string; status: string; type: string; url?: string; port?: number; created_at: string; }
export interface ServerInfo { version: string; siteName: string; hasApiKey: boolean; defaultModel: string; providers: Array<{ id: string; name: string; type: string; models: string[] }>; registrationEnabled: boolean; requireInvite: boolean; networkUrl?: string; localUrl?: string; }
