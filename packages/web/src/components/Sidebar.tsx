import { useState, useEffect } from 'react';
import {
  Folder, FolderOpen, File, ChevronRight, ChevronDown,
  Plus, RefreshCw, Search, Brain, Rocket, Trash2,
  FolderPlus, FilePlus,
} from 'lucide-react';
import { useStore } from '../store';
import { api } from '../lib/api';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  children?: FileItem[];
  expanded?: boolean;
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go', rb: 'ruby', java: 'java',
  cpp: 'cpp', c: 'c', cs: 'csharp', php: 'php', swift: 'swift',
  kt: 'kotlin', md: 'markdown', json: 'json', yaml: 'yaml', yml: 'yaml',
  html: 'html', css: 'css', scss: 'scss', sql: 'sql', sh: 'shell',
  toml: 'toml', xml: 'xml', graphql: 'graphql',
};

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'plaintext';
}

const FILE_ICONS: Record<string, string> = {
  'package.json': '📦', 'tsconfig.json': '🔷', '.env': '🔑', '.gitignore': '🚫',
  'Dockerfile': '🐳', 'docker-compose.yml': '🐳', 'README.md': '📖',
  'vite.config.ts': '⚡', 'next.config.js': '▲', 'tailwind.config.js': '🎨',
};

function FileIcon({ name, type }: { name: string; type: string }) {
  if (type === 'directory') return null;
  if (FILE_ICONS[name]) return <span className="text-xs mr-1">{FILE_ICONS[name]}</span>;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = {
    ts: 'text-blue-400', tsx: 'text-blue-300', js: 'text-yellow-400',
    py: 'text-green-400', rs: 'text-orange-400', go: 'text-cyan-400',
    json: 'text-yellow-300', md: 'text-gray-300', css: 'text-pink-400',
    html: 'text-orange-300', sh: 'text-green-300',
  };
  return <File size={13} className={`mr-1 flex-shrink-0 ${colors[ext] || 'text-text-secondary'}`} />;
}

export default function Sidebar() {
  const { activeProjectId, projects, openTab, activePanel, setActivePanel, memories, setMemories, removeMemory } = useStore();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ file: string; line: number; content: string }>>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);

  const project = projects.find(p => p.id === activeProjectId);

  useEffect(() => {
    if (activeProjectId && activePanel === 'explorer') {
      loadFiles();
    }
  }, [activeProjectId, activePanel]);

  useEffect(() => {
    if (activeProjectId && activePanel === 'memory') {
      loadMemory();
    }
  }, [activeProjectId, activePanel]);

  async function loadFiles() {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const res = await api.files.list(activeProjectId);
      if (res.items) setFiles(res.items as FileItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadMemory() {
    if (!activeProjectId) return;
    const mems = await api.memory.list(activeProjectId);
    setMemories(activeProjectId, mems);
  }

  async function openFile(item: FileItem) {
    if (item.type === 'directory') return;
    if (!activeProjectId) return;
    try {
      const res = await api.files.read(activeProjectId, item.path);
      openTab({
        path: item.path,
        name: item.name,
        content: res.content,
        modified: false,
        language: getLanguage(item.name),
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleDir(item: FileItem) {
    if (!activeProjectId) return;
    if (!item.expanded) {
      const res = await api.files.list(activeProjectId, item.path);
      item.children = res.items as FileItem[];
      item.expanded = true;
    } else {
      item.expanded = false;
    }
    setFiles([...files]);
  }

  async function doSearch() {
    if (!activeProjectId || !searchQuery.trim()) return;
    const results = await api.files.search(activeProjectId, searchQuery);
    setSearchResults(results);
  }

  async function createProject() {
    if (!newProjectName.trim()) return;
    const proj = await api.projects.create({ name: newProjectName.trim() });
    const all = await api.projects.list();
    useStore.getState().setProjects(all);
    useStore.getState().setActiveProject(proj.id);
    setNewProjectName('');
    setShowNewProject(false);
  }

  const projectMemories = activeProjectId ? (memories[activeProjectId] || []) : [];

  return (
    <div className="flex flex-col h-full bg-bg-secondary border-r border-bg-border">
      {/* Panel tabs */}
      <div className="flex border-b border-bg-border">
        {[
          { id: 'explorer', icon: <Folder size={14} />, label: 'Files' },
          { id: 'search', icon: <Search size={14} />, label: 'Search' },
          { id: 'memory', icon: <Brain size={14} />, label: 'Memory' },
          { id: 'deploy', icon: <Rocket size={14} />, label: 'Deploy' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id as typeof activePanel)}
            className={`flex items-center gap-1 px-2 py-2 text-xs transition-colors flex-1 justify-center ${
              activePanel === tab.id
                ? 'text-accent-blue border-b-2 border-accent-blue bg-bg-tertiary'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Explorer */}
      {activePanel === 'explorer' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-bg-border">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {project?.name || 'No Project'}
            </span>
            <div className="flex gap-1">
              <button onClick={loadFiles} className="p-1 hover:bg-bg-hover rounded text-text-secondary" title="Refresh">
                <RefreshCw size={12} />
              </button>
              <button onClick={() => setShowNewProject(!showNewProject)} className="p-1 hover:bg-bg-hover rounded text-text-secondary" title="New Project">
                <Plus size={12} />
              </button>
            </div>
          </div>

          {showNewProject && (
            <div className="flex gap-1 p-2 border-b border-bg-border">
              <input
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createProject()}
                placeholder="Project name"
                className="flex-1 bg-bg-tertiary text-text-primary text-xs px-2 py-1 rounded border border-bg-border focus:outline-none focus:border-accent-blue"
                autoFocus
              />
              <button onClick={createProject} className="text-xs px-2 py-1 bg-accent-blue text-white rounded">OK</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              <div className="text-text-muted text-xs p-3">Loading...</div>
            ) : files.length === 0 ? (
              <div className="text-text-muted text-xs p-3">
                {activeProjectId ? 'No files yet. Ask AI to create some!' : 'Select a project'}
              </div>
            ) : (
              <FileTree items={files} depth={0} onOpen={openFile} onToggle={toggleDir} />
            )}
          </div>
        </div>
      )}

      {/* Search */}
      {activePanel === 'search' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-2 border-b border-bg-border">
            <div className="flex gap-1">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Search files..."
                className="flex-1 bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 rounded border border-bg-border focus:outline-none focus:border-accent-blue"
              />
              <button onClick={doSearch} className="px-2 py-1 text-xs bg-accent-blue text-white rounded">Go</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {searchResults.map((r, i) => (
              <button
                key={i}
                className="w-full text-left px-3 py-1.5 hover:bg-bg-hover border-b border-bg-border/50"
                onClick={() => activeProjectId && api.files.read(activeProjectId, r.file).then(res =>
                  openTab({ path: r.file, name: r.file.split('/').pop()!, content: res.content, modified: false, language: getLanguage(r.file) })
                )}
              >
                <div className="text-xs text-accent-blue truncate">{r.file}:{r.line}</div>
                <div className="text-xs text-text-secondary truncate">{r.content}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Memory */}
      {activePanel === 'memory' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-bg-border">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Project Memory</span>
            <button
              onClick={() => activeProjectId && api.memory.deleteAll(activeProjectId).then(loadMemory)}
              className="text-xs text-accent-red hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {projectMemories.length === 0 ? (
              <p className="text-text-muted text-xs p-2">No memories yet. The AI remembers important facts automatically.</p>
            ) : (
              projectMemories.map(mem => (
                <div key={mem.id} className="bg-bg-tertiary rounded p-2 group flex items-start gap-1">
                  <div className="flex-1">
                    <span className="text-[10px] text-accent-yellow px-1 rounded bg-accent-yellow/10">{mem.category}</span>
                    <p className="text-xs text-text-primary mt-0.5">{mem.content}</p>
                  </div>
                  <button
                    onClick={() => activeProjectId && api.memory.delete(activeProjectId, mem.id).then(loadMemory)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-red transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Deploy */}
      {activePanel === 'deploy' && (
        <DeployPanel projectId={activeProjectId} />
      )}
    </div>
  );
}

function FileTree({ items, depth, onOpen, onToggle }: {
  items: FileItem[];
  depth: number;
  onOpen: (item: FileItem) => void;
  onToggle: (item: FileItem) => void;
}) {
  return (
    <>
      {items.map(item => (
        <div key={item.path}>
          <button
            className="w-full flex items-center text-xs py-0.5 px-2 hover:bg-bg-hover text-text-primary file-tree-item"
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            onClick={() => item.type === 'directory' ? onToggle(item) : onOpen(item)}
          >
            {item.type === 'directory' ? (
              <>
                {item.expanded ? <ChevronDown size={12} className="mr-1 text-text-secondary flex-shrink-0" /> : <ChevronRight size={12} className="mr-1 text-text-secondary flex-shrink-0" />}
                {item.expanded ? <FolderOpen size={13} className="mr-1 text-accent-yellow flex-shrink-0" /> : <Folder size={13} className="mr-1 text-accent-yellow flex-shrink-0" />}
              </>
            ) : (
              <>
                <span className="w-4 flex-shrink-0" />
                <FileIcon name={item.name} type={item.type} />
              </>
            )}
            <span className="truncate">{item.name}</span>
          </button>
          {item.expanded && item.children && (
            <FileTree items={item.children} depth={depth + 1} onOpen={onOpen} onToggle={onToggle} />
          )}
        </div>
      ))}
    </>
  );
}

function DeployPanel({ projectId }: { projectId: string | null }) {
  const [deployments, setDeployments] = useState<Array<{ id: string; status: string; url?: string; type: string; created_at: string }>>([]);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (projectId) {
      api.deploy.list(projectId).then(setDeployments).catch(() => {});
    }
  }, [projectId]);

  async function deploy() {
    if (!projectId) return;
    setDeploying(true);
    try {
      const result = await api.deploy.deploy(projectId, {});
      setDeployments(d => [{ id: result.deployId, status: result.status, type: 'auto', created_at: new Date().toISOString() }, ...d]);
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="p-2 border-b border-bg-border">
        <button
          onClick={deploy}
          disabled={!projectId || deploying}
          className="w-full py-1.5 text-xs bg-accent-green text-black font-semibold rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {deploying ? 'Deploying...' : '🚀 Deploy Project'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {deployments.map(d => (
          <div key={d.id} className="bg-bg-tertiary rounded p-2">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${
                d.status === 'running' ? 'text-accent-green' :
                d.status === 'building' ? 'text-accent-yellow' :
                d.status === 'failed' ? 'text-accent-red' : 'text-text-secondary'
              }`}>
                {d.status}
              </span>
              <span className="text-[10px] text-text-muted">{d.type}</span>
            </div>
            {d.url && (
              <a href={d.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-accent-blue hover:underline truncate block">
                {d.url}
              </a>
            )}
            <div className="text-[10px] text-text-muted mt-1">{new Date(d.created_at).toLocaleString()}</div>
          </div>
        ))}
        {deployments.length === 0 && (
          <p className="text-text-muted text-xs">No deployments yet.</p>
        )}
      </div>
    </div>
  );
}
