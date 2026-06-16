import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutPanelLeft, MessageSquare, Terminal, Settings, Zap, LogOut, Shield, User } from 'lucide-react';
import { useStore } from '../store';

interface Props {
  onSetup: () => void;
}

export default function TopBar({ onSetup }: Props) {
  const {
    toggleSidebar, toggleChat, toggleTerminal,
    showSidebar, showChat, showTerminal,
    activeProjectId, projects,
    user, clearAuth,
  } = useStore();

  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const project = projects.find(p => p.id === activeProjectId);

  function logout() {
    clearAuth();
    navigate('/login');
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div className="flex items-center h-10 bg-bg-secondary border-b border-bg-border px-3 gap-2 flex-shrink-0 relative">
      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-3">
        <Zap size={16} className="text-accent-yellow" />
        <span className="font-bold text-sm tracking-tight text-text-primary">cheap-ai</span>
      </div>

      {/* Project name */}
      {project && (
        <span className="text-text-secondary text-xs px-2 py-0.5 bg-bg-tertiary rounded border border-bg-border">
          {project.name}
        </span>
      )}

      <div className="flex-1" />

      {/* Panel toggles */}
      <button
        onClick={toggleSidebar}
        className={`p-1.5 rounded hover:bg-bg-hover transition-colors ${showSidebar ? 'text-accent-blue' : 'text-text-secondary'}`}
        title="Toggle Explorer"
      >
        <LayoutPanelLeft size={15} />
      </button>

      <button
        onClick={toggleTerminal}
        className={`p-1.5 rounded hover:bg-bg-hover transition-colors ${showTerminal ? 'text-accent-blue' : 'text-text-secondary'}`}
        title="Toggle Terminal"
      >
        <Terminal size={15} />
      </button>

      <button
        onClick={toggleChat}
        className={`p-1.5 rounded hover:bg-bg-hover transition-colors ${showChat ? 'text-accent-blue' : 'text-text-secondary'}`}
        title="Toggle AI Chat"
      >
        <MessageSquare size={15} />
      </button>

      <div className="w-px h-4 bg-bg-border mx-1" />

      <button
        onClick={onSetup}
        className="p-1.5 rounded hover:bg-bg-hover transition-colors text-text-secondary"
        title="Settings"
      >
        <Settings size={15} />
      </button>

      {isAdmin && (
        <Link
          to="/admin"
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-bg-hover transition-colors text-text-secondary hover:text-accent-blue text-xs"
          title="Admin Panel"
        >
          <Shield size={14} />
          <span className="hidden sm:inline">Admin</span>
        </Link>
      )}

      {/* User menu */}
      <div className="relative ml-1">
        <button
          onClick={() => setShowUserMenu(v => !v)}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-bg-hover transition-colors text-text-secondary"
        >
          <User size={14} />
          <span className="text-xs">{user?.username || 'user'}</span>
        </button>

        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
            <div className="absolute right-0 top-8 z-20 w-44 bg-bg-secondary border border-bg-border rounded-lg shadow-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-bg-border">
                <p className="text-xs font-medium text-text-primary">{user?.username}</p>
                <p className="text-[10px] text-text-muted capitalize">{user?.role?.replace('_', ' ')} · {user?.plan}</p>
              </div>

              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Shield size={13} />
                  Admin Panel
                </Link>
              )}

              <button
                onClick={logout}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-accent-red hover:bg-bg-hover transition-colors"
              >
                <LogOut size={13} />
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
