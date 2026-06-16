import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { api } from '../lib/api';
import type { AdminUser, AdminStats, Provider, Invite, UsageRow } from '../lib/api';

// ─── Icons ───────────────────────────────────────────────────────────────────

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const icons = {
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  providers: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  invites: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
  usage: 'M18 20V10 M12 20V4 M6 20v-6',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8',
  ban: 'M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636',
  check: 'M20 6L9 17l-5-5',
  trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  plus: 'M12 5v14 M5 12h14',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 0 2 2v1',
  back: 'M19 12H5 M12 19l-7-7 7-7',
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Badge({ text, color }: { text: string; color: 'green' | 'red' | 'yellow' | 'blue' | 'gray' }) {
  const colors = {
    green: 'bg-[#3fb950]/15 text-[#3fb950] border-[#3fb950]/20',
    red: 'bg-[#f85149]/15 text-[#f85149] border-[#f85149]/20',
    yellow: 'bg-[#d29922]/15 text-[#d29922] border-[#d29922]/20',
    blue: 'bg-[#58a6ff]/15 text-[#58a6ff] border-[#58a6ff]/20',
    gray: 'bg-[#30363d]/50 text-[#7d8590] border-[#30363d]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[color]}`}>
      {text}
    </span>
  );
}

function Btn({
  children, onClick, variant = 'default', size = 'md', disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'danger' | 'ghost' | 'primary';
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const variants = {
    default: 'bg-[#21262d] border-[#30363d] text-[#e6edf3] hover:bg-[#30363d]',
    danger: 'bg-[#f85149]/10 border-[#f85149]/30 text-[#f85149] hover:bg-[#f85149]/20',
    ghost: 'bg-transparent border-transparent text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d]',
    primary: 'bg-[#238636] border-[#2ea043] text-white hover:bg-[#2ea043]',
  };
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-1.5 text-sm' };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = 'text', className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-1.5 text-sm text-[#e6edf3] placeholder:text-[#484f58] focus:outline-none focus:border-[#58a6ff] ${className}`}
    />
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
          <h3 className="font-semibold text-[#e6edf3]">{title}</h3>
          <button onClick={onClose} className="text-[#7d8590] hover:text-[#e6edf3]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Sidebar Nav ──────────────────────────────────────────────────────────────

const navItems = [
  { path: '/admin', label: 'Overview', icon: icons.zap, exact: true },
  { path: '/admin/users', label: 'Users', icon: icons.users },
  { path: '/admin/providers', label: 'AI Providers', icon: icons.providers },
  { path: '/admin/invites', label: 'Invites', icon: icons.invites },
  { path: '/admin/usage', label: 'Usage', icon: icons.usage },
  { path: '/admin/settings', label: 'Settings', icon: icons.settings },
];

function AdminNav() {
  const location = useLocation();
  const { user } = useStore();

  return (
    <aside className="w-48 bg-[#0d1117] border-r border-[#30363d] flex flex-col">
      <div className="p-4 border-b border-[#30363d]">
        <Link to="/app" className="flex items-center gap-2 text-[#58a6ff] hover:text-[#79c0ff] transition-colors text-sm">
          <Icon d={icons.back} size={14} />
          Back to IDE
        </Link>
      </div>
      <div className="p-3 border-b border-[#30363d]">
        <p className="text-xs text-[#7d8590] mb-0.5">Admin Panel</p>
        <p className="text-sm font-medium text-[#e6edf3]">{user?.username}</p>
        <Badge text={user?.role || 'admin'} color="blue" />
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(item => {
          const active = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path) && item.path !== '/admin';
          const isActive = item.exact ? location.pathname === '/admin' : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-[#21262d] text-[#e6edf3]'
                  : 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#161b22]'
              }`}
            >
              <Icon d={item.icon} size={15} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function Overview() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => { api.admin.stats().then(setStats).catch(() => {}); }, []);

  const cards = stats ? [
    { label: 'Total Users', value: stats.users, color: 'text-[#58a6ff]' },
    { label: 'Projects', value: stats.projects, color: 'text-[#3fb950]' },
    { label: 'Conversations', value: stats.conversations, color: 'text-[#d29922]' },
    { label: 'Active Deploys', value: stats.activeDeployments, color: 'text-[#f78166]' },
    { label: 'AI Providers', value: stats.enabledProviders, color: 'text-[#a5d6ff]' },
    { label: 'Messages Today', value: stats.messagesToday, color: 'text-[#7ee787]' },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-[#e6edf3]">Overview</h2>
      <div className="grid grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
            <p className="text-xs text-[#7d8590] mb-1">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {stats?.recentUsers && stats.recentUsers.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#30363d]">
            <h3 className="text-sm font-semibold text-[#e6edf3]">Recent Users</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#7d8590] text-xs border-b border-[#30363d]">
                <th className="px-4 py-2 text-left font-medium">Username</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentUsers.slice(0, 8).map(u => (
                <tr key={u.id} className="border-b border-[#21262d] last:border-0">
                  <td className="px-4 py-2 text-[#e6edf3]">{u.username}</td>
                  <td className="px-4 py-2">
                    <Badge
                      text={u.role}
                      color={u.role === 'super_admin' ? 'red' : u.role === 'admin' ? 'yellow' : 'gray'}
                    />
                  </td>
                  <td className="px-4 py-2 text-[#7d8590]">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────

function Users() {
  const { user: currentUser } = useStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState('');
  const [showBanModal, setShowBanModal] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.admin.users({ q: search || undefined }).then(setUsers).catch(() => {});
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function ban() {
    if (!selected) return;
    await api.admin.banUser(selected.id, banReason);
    setMsg(`Banned ${selected.username}`);
    setShowBanModal(false);
    load();
  }

  async function unban(u: AdminUser) {
    await api.admin.unbanUser(u.id);
    setMsg(`Unbanned ${u.username}`);
    load();
  }

  async function setRole(u: AdminUser, role: string) {
    await api.admin.setRole(u.id, role);
    load();
  }

  async function setPlan(u: AdminUser, plan: string) {
    await api.admin.setPlan(u.id, plan);
    load();
  }

  async function del(u: AdminUser) {
    if (!confirm(`Delete user ${u.username}? This cannot be undone.`)) return;
    await api.admin.deleteUser(u.id);
    load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#e6edf3]">Users</h2>
        <div className="w-64">
          <Input value={search} onChange={v => setSearch(v)} placeholder="Search users..." />
        </div>
      </div>

      {msg && <p className="text-[#3fb950] text-sm">{msg}</p>}

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#7d8590] text-xs border-b border-[#30363d]">
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Rate Limits</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-[#21262d] last:border-0 hover:bg-[#21262d]/30">
                <td className="px-4 py-3">
                  <p className="text-[#e6edf3] font-medium">{u.username}</p>
                  <p className="text-[#7d8590] text-xs">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  {currentUser?.role === 'super_admin' && u.id !== currentUser.id ? (
                    <select
                      value={u.role}
                      onChange={e => setRole(u, e.target.value)}
                      className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 text-xs text-[#e6edf3]"
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  ) : (
                    <Badge
                      text={u.role}
                      color={u.role === 'super_admin' ? 'red' : u.role === 'admin' ? 'yellow' : 'gray'}
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.plan}
                    onChange={e => setPlan(u, e.target.value)}
                    className="bg-[#0d1117] border border-[#30363d] rounded px-2 py-0.5 text-xs text-[#e6edf3]"
                  >
                    <option value="free">free</option>
                    <option value="hobby">hobby</option>
                    <option value="pro">pro</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  {u.banned ? (
                    <Badge text="banned" color="red" />
                  ) : (
                    <Badge text="active" color="green" />
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#7d8590]">
                  {u.rate_limit_hour != null ? `${u.rate_limit_hour}/hr` : 'global'} ·{' '}
                  {u.rate_limit_day != null ? `${u.rate_limit_day}/day` : 'global'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {u.id !== currentUser?.id && (
                      u.banned ? (
                        <Btn size="sm" variant="ghost" onClick={() => unban(u)}>
                          <Icon d={icons.check} size={12} /> Unban
                        </Btn>
                      ) : (
                        <Btn size="sm" variant="danger" onClick={() => { setSelected(u); setBanReason(''); setShowBanModal(true); }}>
                          <Icon d={icons.ban} size={12} /> Ban
                        </Btn>
                      )
                    )}
                    {currentUser?.role === 'super_admin' && u.id !== currentUser?.id && (
                      <Btn size="sm" variant="danger" onClick={() => del(u)}>
                        <Icon d={icons.trash} size={12} />
                      </Btn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showBanModal && selected && (
        <Modal title={`Ban ${selected.username}`} onClose={() => setShowBanModal(false)}>
          <div className="space-y-3">
            <Input value={banReason} onChange={setBanReason} placeholder="Reason (optional)" />
            <div className="flex gap-2 justify-end">
              <Btn variant="ghost" onClick={() => setShowBanModal(false)}>Cancel</Btn>
              <Btn variant="danger" onClick={ban}>Ban User</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── AI Providers ─────────────────────────────────────────────────────────────

const PROVIDER_TYPES = ['openrouter', 'openai', 'anthropic', 'gemini', 'ollama', 'custom'] as const;
type ProviderType = typeof PROVIDER_TYPES[number];

const PROVIDER_DEFAULTS: Record<ProviderType, { base_url: string; placeholder: string }> = {
  openrouter: { base_url: 'https://openrouter.ai/api/v1', placeholder: 'sk-or-v1-...' },
  openai: { base_url: 'https://api.openai.com/v1', placeholder: 'sk-...' },
  anthropic: { base_url: '', placeholder: 'sk-ant-...' },
  gemini: { base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', placeholder: 'AI...' },
  ollama: { base_url: 'http://localhost:11434/v1', placeholder: 'none required' },
  custom: { base_url: '', placeholder: 'your API key' },
};

function Providers() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'openrouter' as ProviderType, base_url: '', api_key: '', models: '' });
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [saving, setSaving] = useState(false);

  const load = () => api.admin.providers().then(setProviders).catch(() => {});
  useEffect(() => { load(); }, []);

  async function add() {
    setSaving(true);
    try {
      const defaults = PROVIDER_DEFAULTS[form.type];
      await api.admin.createProvider({
        ...form,
        base_url: form.base_url || defaults.base_url,
        models: form.models ? JSON.stringify(form.models.split(',').map(s => s.trim()).filter(Boolean)) : '[]',
      });
      setShowAdd(false);
      setForm({ name: '', type: 'openrouter', base_url: '', api_key: '', models: '' });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function test(p: Provider) {
    const r = await api.admin.testProvider(p.id);
    setTestResult(prev => ({ ...prev, [p.id]: { ok: r.ok, msg: r.message || r.error || '' } }));
  }

  async function toggleEnabled(p: Provider) {
    await api.admin.updateProvider(p.id, { is_enabled: p.is_enabled ? 0 : 1 });
    load();
  }

  async function setDefault(p: Provider) {
    await api.admin.updateProvider(p.id, { is_default: 1 });
    load();
  }

  async function del(p: Provider) {
    if (!confirm(`Delete provider "${p.name}"?`)) return;
    await api.admin.deleteProvider(p.id);
    load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#e6edf3]">AI Providers</h2>
        <Btn variant="primary" onClick={() => setShowAdd(true)}>
          <Icon d={icons.plus} size={14} /> Add Provider
        </Btn>
      </div>

      <p className="text-sm text-[#7d8590]">
        Configure your own AI provider API keys. These are used by all users through the server.
      </p>

      <div className="space-y-3">
        {providers.map(p => {
          const result = testResult[p.id];
          return (
            <div key={p.id} className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[#e6edf3]">{p.name}</p>
                    <Badge text={p.type} color="blue" />
                    {p.is_default ? <Badge text="default" color="green" /> : null}
                    {!p.is_enabled ? <Badge text="disabled" color="gray" /> : null}
                  </div>
                  {p.base_url && <p className="text-xs text-[#7d8590] mt-0.5 font-mono">{p.base_url}</p>}
                  {result && (
                    <p className={`text-xs mt-1 ${result.ok ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                      {result.ok ? 'Connected' : 'Failed'}{result.msg ? ` — ${result.msg}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Btn size="sm" variant="ghost" onClick={() => test(p)}>Test</Btn>
                  {!p.is_default && <Btn size="sm" variant="ghost" onClick={() => setDefault(p)}>Set Default</Btn>}
                  <Btn size="sm" variant="ghost" onClick={() => toggleEnabled(p)}>
                    {p.is_enabled ? 'Disable' : 'Enable'}
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => del(p)}>
                    <Icon d={icons.trash} size={12} />
                  </Btn>
                </div>
              </div>
            </div>
          );
        })}
        {providers.length === 0 && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center">
            <p className="text-[#7d8590] text-sm">No providers configured. Add one to get started.</p>
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="Add AI Provider" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#7d8590] mb-1 block">Provider Name</label>
              <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="My OpenRouter" />
            </div>
            <div>
              <label className="text-xs text-[#7d8590] mb-1 block">Type</label>
              <select
                value={form.type}
                onChange={e => {
                  const t = e.target.value as ProviderType;
                  setForm(f => ({ ...f, type: t, base_url: PROVIDER_DEFAULTS[t].base_url }));
                }}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-1.5 text-sm text-[#e6edf3]"
              >
                {PROVIDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#7d8590] mb-1 block">Base URL</label>
              <Input
                value={form.base_url}
                onChange={v => setForm(f => ({ ...f, base_url: v }))}
                placeholder={PROVIDER_DEFAULTS[form.type].base_url || 'https://...'}
              />
            </div>
            <div>
              <label className="text-xs text-[#7d8590] mb-1 block">API Key</label>
              <Input
                type="password"
                value={form.api_key}
                onChange={v => setForm(f => ({ ...f, api_key: v }))}
                placeholder={PROVIDER_DEFAULTS[form.type].placeholder}
              />
            </div>
            <div>
              <label className="text-xs text-[#7d8590] mb-1 block">Models (comma-separated, optional)</label>
              <Input
                value={form.models}
                onChange={v => setForm(f => ({ ...f, models: v }))}
                placeholder="gpt-4o, claude-3-5-sonnet-20241022"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={add} disabled={saving || !form.name || !form.api_key}>
                {saving ? 'Adding...' : 'Add Provider'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Invites ──────────────────────────────────────────────────────────────────

function Invites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [form, setForm] = useState({ role: 'member', max_uses: '1', expires_in_days: '7' });
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => api.admin.invites().then(setInvites).catch(() => {});
  useEffect(() => { load(); }, []);

  async function create() {
    await api.admin.createInvite({
      role: form.role,
      max_uses: parseInt(form.max_uses) || 1,
      expires_in_days: parseInt(form.expires_in_days) || 7,
    });
    load();
  }

  async function del(token: string) {
    await api.admin.deleteInvite(token);
    load();
  }

  function copy(token: string) {
    const url = `${window.location.origin}/register?invite=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-[#e6edf3]">Invite Links</h2>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-[#e6edf3]">Create Invite</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-[#7d8590] mb-1 block">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1.5 text-sm text-[#e6edf3]"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#7d8590] mb-1 block">Max uses</label>
            <Input value={form.max_uses} onChange={v => setForm(f => ({ ...f, max_uses: v }))} type="number" />
          </div>
          <div>
            <label className="text-xs text-[#7d8590] mb-1 block">Expires (days)</label>
            <Input value={form.expires_in_days} onChange={v => setForm(f => ({ ...f, expires_in_days: v }))} type="number" />
          </div>
        </div>
        <div className="flex justify-end">
          <Btn variant="primary" onClick={create}>
            <Icon d={icons.plus} size={14} /> Generate Link
          </Btn>
        </div>
      </div>

      <div className="space-y-2">
        {invites.map(inv => {
          const url = `${window.location.origin}/register?invite=${inv.token}`;
          return (
            <div key={inv.token} className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-mono text-[#58a6ff] truncate">{url}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-[#7d8590]">
                  <Badge text={inv.role} color="gray" />
                  <span>{inv.uses}/{inv.max_uses ?? '∞'} uses</span>
                  {inv.expires_at && <span>Expires {new Date(inv.expires_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Btn size="sm" variant="ghost" onClick={() => copy(inv.token)}>
                  <Icon d={icons.copy} size={12} />
                  {copied === inv.token ? 'Copied!' : 'Copy'}
                </Btn>
                <Btn size="sm" variant="danger" onClick={() => del(inv.token)}>
                  <Icon d={icons.trash} size={12} />
                </Btn>
              </div>
            </div>
          );
        })}
        {invites.length === 0 && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center">
            <p className="text-[#7d8590] text-sm">No active invite links.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Usage ────────────────────────────────────────────────────────────────────

function Usage() {
  const [rows, setRows] = useState<UsageRow[]>([]);

  useEffect(() => { api.admin.usage().then(setRows).catch(() => {}); }, []);

  const max = rows[0]?.total || 1;

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-[#e6edf3]">Usage (Last 30 Days)</h2>
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#7d8590] text-xs border-b border-[#30363d]">
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Messages</th>
              <th className="px-4 py-3 text-left font-medium w-48">Volume</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="border-b border-[#21262d] last:border-0">
                <td className="px-4 py-3 text-[#7d8590]">{i + 1}</td>
                <td className="px-4 py-3">
                  <p className="text-[#e6edf3] font-medium">{row.username}</p>
                  <p className="text-[#7d8590] text-xs">{row.email}</p>
                </td>
                <td className="px-4 py-3 text-[#e6edf3] font-mono">{row.total}</td>
                <td className="px-4 py-3">
                  <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#58a6ff] rounded-full"
                      style={{ width: `${(row.total / max) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-8 text-center text-[#7d8590] text-sm">No usage data yet.</div>
        )}
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.admin.settings().then(setSettings).catch(() => {}); }, []);

  async function save() {
    await api.admin.updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function set(key: string, value: string) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  const fields: Array<{ key: string; label: string; description: string; type: 'text' | 'number' | 'toggle' }> = [
    { key: 'site_name', label: 'Site Name', description: 'Shown in the UI and browser tab', type: 'text' },
    { key: 'global_rate_limit_hour', label: 'Rate Limit / Hour', description: 'Default AI messages per user per hour', type: 'number' },
    { key: 'global_rate_limit_day', label: 'Rate Limit / Day', description: 'Default AI messages per user per day', type: 'number' },
    { key: 'registration_enabled', label: 'Open Registration', description: 'Allow new users to pair CLI and join', type: 'toggle' },
    { key: 'require_invite', label: 'Require Invite', description: 'Users must have an invite link to join', type: 'toggle' },
    { key: 'max_projects_per_user', label: 'Max Projects / User', description: 'Leave blank for unlimited', type: 'number' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-[#e6edf3]">Settings</h2>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden divide-y divide-[#30363d]">
        {fields.map(field => (
          <div key={field.key} className="px-4 py-4 flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-[#e6edf3]">{field.label}</p>
              <p className="text-xs text-[#7d8590]">{field.description}</p>
            </div>
            <div className="flex-shrink-0 w-48">
              {field.type === 'toggle' ? (
                <button
                  onClick={() => set(field.key, settings[field.key] === 'true' ? 'false' : 'true')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings[field.key] === 'true' ? 'bg-[#238636]' : 'bg-[#30363d]'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings[field.key] === 'true' ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              ) : (
                <Input
                  value={settings[field.key] || ''}
                  onChange={v => set(field.key, v)}
                  type={field.type}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Btn variant="primary" onClick={save}>Save Settings</Btn>
        {saved && <span className="text-[#3fb950] text-sm">Saved.</span>}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Admin() {
  return (
    <div className="flex h-screen bg-[#0d1117] text-[#e6edf3] overflow-hidden">
      <AdminNav />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="users" element={<Users />} />
          <Route path="providers" element={<Providers />} />
          <Route path="invites" element={<Invites />} />
          <Route path="usage" element={<Usage />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
