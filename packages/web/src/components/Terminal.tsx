import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { X, Plus, Terminal as TermIcon } from 'lucide-react';
import 'xterm/css/xterm.css';
import { getSocket } from '../lib/socket';
import { useStore } from '../store';

interface TermTab {
  id: string;
  termId: string | null;
  xterm: XTerm;
  fitAddon: FitAddon;
  label: string;
}

export default function TerminalPanel() {
  const { apiUrl, activeProjectId, projects } = useStore();
  const [tabs, setTabs] = useState<TermTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const tabIdCounter = useRef(0);

  const project = projects.find(p => p.id === activeProjectId);
  const socket = getSocket(apiUrl);

  useEffect(() => {
    socket.on('terminal:created', ({ termId }: { termId: string }) => {
      setTabs(prev => prev.map(t => t.termId === null ? { ...t, termId } : t));
    });

    socket.on('terminal:data', ({ termId, data }: { termId: string; data: string }) => {
      const tab = tabs.find(t => t.termId === termId);
      tab?.xterm.write(data);
    });

    socket.on('terminal:exit', ({ termId }: { termId: string }) => {
      const tab = tabs.find(t => t.termId === termId);
      if (tab) {
        tab.xterm.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
      }
    });

    return () => {
      socket.off('terminal:created');
      socket.off('terminal:data');
      socket.off('terminal:exit');
    };
  }, [socket, tabs]);

  useEffect(() => {
    if (tabs.length === 0) {
      createTerminal();
    }
  }, []);

  useEffect(() => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    const el = containerRefs.current.get(tab.id);
    if (!el) return;

    if (!tab.xterm.element) {
      tab.xterm.open(el);
      tab.xterm.loadAddon(tab.fitAddon);
      tab.fitAddon.fit();

      const resizeObs = new ResizeObserver(() => {
        try { tab.fitAddon.fit(); } catch {}
      });
      resizeObs.observe(el);
    }

    tab.fitAddon.fit();
    tab.xterm.focus();
  }, [activeTabId, tabs]);

  function createTerminal() {
    const id = `tab_${++tabIdCounter.current}`;
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#0d1117', brightBlack: '#484f58',
        red: '#f85149', brightRed: '#f85149',
        green: '#3fb950', brightGreen: '#3fb950',
        yellow: '#d29922', brightYellow: '#d29922',
        blue: '#58a6ff', brightBlue: '#79c0ff',
        magenta: '#bc8cff', brightMagenta: '#bc8cff',
        cyan: '#39c5cf', brightCyan: '#56d4dd',
        white: '#b1bac4', brightWhite: '#e6edf3',
      },
      allowTransparency: false,
      scrollback: 5000,
    });

    xterm.loadAddon(new WebLinksAddon());

    const fitAddon = new FitAddon();

    const newTab: TermTab = { id, termId: null, xterm, fitAddon, label: `bash ${tabIdCounter.current}` };

    xterm.onData((data) => {
      if (newTab.termId) {
        socket.emit('terminal:input', { termId: newTab.termId, data });
      }
    });

    xterm.onResize(({ cols, rows }) => {
      if (newTab.termId) {
        socket.emit('terminal:resize', { termId: newTab.termId, cols, rows });
      }
    });

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(id);

    socket.emit('terminal:create', {
      projectId: activeProjectId,
      projectPath: project?.path || '',
    });
  }

  function closeTab(tabId: string) {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.termId) {
      socket.emit('terminal:kill', { termId: tab.termId });
    }
    tab?.xterm.dispose();
    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && next.length > 0) {
        setActiveTabId(next[next.length - 1].id);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Tabs */}
      <div className="flex items-center h-8 bg-bg-secondary border-b border-bg-border flex-shrink-0 px-1 gap-0.5">
        <TermIcon size={12} className="text-text-muted mx-1.5" />
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`flex items-center gap-1 px-2.5 h-6 text-xs rounded group transition-colors ${
              tab.id === activeTabId
                ? 'bg-bg-primary text-text-primary'
                : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <span>{tab.label}</span>
            <span
              role="button"
              onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
              className="opacity-0 group-hover:opacity-100 hover:text-accent-red transition-opacity"
            >
              <X size={10} />
            </span>
          </button>
        ))}
        <button
          onClick={createTerminal}
          className="p-1 hover:bg-bg-hover rounded text-text-muted hover:text-text-primary transition-colors ml-auto"
          title="New terminal"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Terminal containers */}
      <div className="flex-1 relative overflow-hidden">
        {tabs.map(tab => (
          <div
            key={tab.id}
            ref={el => { if (el) containerRefs.current.set(tab.id, el); }}
            className="absolute inset-0 p-1"
            style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
          />
        ))}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-muted text-xs">
            Click + to open a terminal
          </div>
        )}
      </div>
    </div>
  );
}
