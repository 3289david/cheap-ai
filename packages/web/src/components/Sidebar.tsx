import { useState, useEffect, useRef } from 'react';
import {
  Folder, FolderOpen, File, ChevronRight, ChevronDown,
  Plus, RefreshCw, Search, Brain, Rocket, Trash2,
  FilePlus, FolderPlus,
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

function FileIcon({ name, type }: { name: string; type: string }) {
  if (type === 'directory') return null;
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
  const { activeProjectId, projects, openTab, activePanel, setActivePanel, memories, setMemories } = useStore();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ file: string; line: number; content: string }>>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState<'file' | 'folder' | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileItem } | null>(null);
  const newFileRef = useRef<HTMLInputElement>(null);

  const project = projects.find(p => p.id === activeProjectId);

  useEffect(() => {
    if (activeProjectId && activePanel === 'explorer') loadFiles();
  }, [activeProjectId, activePanel]);

  useEffect(() => {
    if (activeProjectId && activePanel === 'memory') loadMemory();
  }, [activeProjectId, activePanel]);

  useEffect(() => {
    if (showNewFile) setTimeout(() => newFileRef.current?.focus(), 50);
  }, [showNewFile]);

  // Dismiss context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

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

  async function createNewFile() {
    if (!activeProjectId || !newFileName.trim()) return;
    const name = newFileName.trim();
    try {
      if (showNewFile === 'file') {
        await api.files.write(activeProjectId, name, '');
        // Open the newly created file
        openTab({ path: name, name: name.split('/').pop()!, content: '', modified: false, language: getLanguage(name) });
      } else {
        await fetch(`${useStore.getState().apiUrl}/api/files/${activeProjectId}/directory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useStore.getState().token}` },
          body: JSON.stringify({ path: name }),
        });
      }
      setNewFileName('');
      setShowNewFile(null);
      loadFiles();
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteFile(item: FileItem) {
    if (!activeProjectId) return;
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.files.delete(activeProjectId, item.path);
      loadFiles();
    } catch (e) {
      console.error(e);
    }
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
    <div className="flex flex-col h-full bg-bg-secondary border-r border-bg-border" onClick={() => setContextMenu(null)}>
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
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider truncate">
              {project?.name || 'No Project'}
            </span>
            <div className="flex gap-0.5 flex-shrink-0">
              <button onClick={() => setShowNewFile('file')} className="p-1 hover:bg-bg-hover rounded text-text-secondary" title="New file">
                <FilePlus size={12} />
              </button>
              <button onClick={() => setShowNewFile('folder')} className="p-1 hover:bg-bg-hover rounded text-text-secondary" title="New folder">
                <FolderPlus size={12} />
              </button>
              <button onClick={loadFiles} className="p-1 hover:bg-bg-hover rounded text-text-secondary" title="Refresh">
                <RefreshCw size={12} />
              </button>
              <button onClick={() => setShowNewProject(!showNewProject)} className="p-1 hover:bg-bg-hover rounded text-text-secondary" title="New project">
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* New file/folder input */}
          {showNewFile && (
            <div className="flex gap-1 p-2 border-b border-bg-border bg-bg-tertiary">
              <input
                ref={newFileRef}
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createNewFile(); if (e.key === 'Escape') { setShowNewFile(null); setNewFileName(''); } }}
                placeholder={showNewFile === 'file' ? 'filename.ts' : 'folder-name'}
                className="flex-1 bg-bg-primary text-text-primary text-xs px-2 py-1 rounded border border-accent-blue focus:outline-none"
              />
              <button onClick={createNewFile} className="text-xs px-2 py-1 bg-accent-blue text-white rounded">OK</button>
              <button onClick={() => { setShowNewFile(null); setNewFileName(''); }} className="text-xs px-2 py-1 text-text-secondary hover:text-text-primary">✕</button>
            </div>
          )}

          {/* New project input */}
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
            {!activeProjectId ? (
              <div className="text-text-muted text-xs p-3">Select or create a project to start.</div>
            ) : loading ? (
              <div className="text-text-muted text-xs p-3">Loading...</div>
            ) : files.length === 0 ? (
              <div className="text-text-muted text-xs p-3">No files yet. Create one above or ask AI!</div>
            ) : (
              <FileTree
                items={files}
                depth={0}
                onOpen={openFile}
                onToggle={toggleDir}
                onContextMenu={(e, item) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item }); }}
              />
            )}
          </div>

          {/* Context menu */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-bg-secondary border border-bg-border rounded-lg shadow-xl py-1 min-w-32"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => { openFile(contextMenu.item); setContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover"
                disabled={contextMenu.item.type === 'directory'}
              >
                Open
              </button>
              <button
                onClick={() => { deleteFile(contextMenu.item); setContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-xs text-accent-red hover:bg-bg-hover"
              >
                Delete
              </button>
            </div>
          )}
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
            {searchResults.length === 0 ? (
              <p className="text-text-muted text-xs p-3">Type a query and press Enter or Go.</p>
            ) : (
              searchResults.map((r, i) => (
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
              ))
            )}
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
              <p className="text-text-muted text-xs p-2">No memories yet. The AI saves important facts automatically.</p>
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
      {activePanel === 'deploy' && <DeployPanel projectId={activeProjectId} />}
    </div>
  );
}

function FileTree({ items, depth, onOpen, onToggle, onContextMenu }: {
  items: FileItem[];
  depth: number;
  onOpen: (item: FileItem) => void;
  onToggle: (item: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
}) {
  return (
    <>
      {items.map(item => (
        <div key={item.path}>
          <button
            className="w-full flex items-center text-xs py-0.5 px-2 hover:bg-bg-hover text-text-primary file-tree-item group"
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            onClick={() => item.type === 'directory' ? onToggle(item) : onOpen(item)}
            onContextMenu={e => onContextMenu(e, item)}
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
            <span className="truncate flex-1 text-left">{item.name}</span>
          </button>
          {item.expanded && item.children && (
            <FileTree items={item.children} depth={depth + 1} onOpen={onOpen} onToggle={onToggle} onContextMenu={onContextMenu} />
          )}
        </div>
      ))}
    </>
  );
}

function DeployPanel({ projectId }: { projectId: string | null }) {
  const [deployments, setDeployments] = useState<Array<{ id: string; status: string; url?: string; type: string; created_at: string }>>([]);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (projectId) {
      api.deploy.list(projectId).then(setDeployments).catch(() => {});
    }
  }, [projectId]);

  // Poll status of any building deployments
  useEffect(() => {
    const building = deployments.filter(d => d.status === 'building');
    if (building.length === 0) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      if (!projectId) return;
      const updated = await api.deploy.list(projectId).catch(() => null);
      if (updated) {
        setDeployments(updated);
        const stillBuilding = updated.filter((d: typeof deployments[0]) => d.status === 'building');
        if (stillBuilding.length === 0 && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }, 3000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [deployments, projectId]);

  async function deploy() {
    if (!projectId) return;
    setDeploying(true);
    setError('');
    try {
      const result = await api.deploy.deploy(projectId, {});
      setDeployments(d => [{ id: result.deployId, status: result.status, type: 'auto', created_at: new Date().toISOString() }, ...d]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  }

  async function stopDeploy(id: string) {
    await api.deploy.stop(id);
    if (projectId) api.deploy.list(projectId).then(setDeployments).catch(() => {});
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="p-2 border-b border-bg-border space-y-1">
        <button
          onClick={deploy}
          disabled={!projectId || deploying}
          className="w-full py-1.5 text-xs bg-accent-green text-black font-semibold rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {deploying ? 'Submitting...' : 'Deploy Project'}
        </button>
        {error && <p className="text-xs text-accent-red">{error}</p>}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {deployments.map(d => (
          <div key={d.id} className="bg-bg-tertiary rounded p-2">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${
                d.status === 'running' ? 'text-accent-green' :
                d.status === 'building' ? 'text-accent-yellow animate-pulse' :
                d.status === 'failed' ? 'text-accent-red' : 'text-text-secondary'
              }`}>
                {d.status === 'building' ? 'Building...' : d.status}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-text-muted">{d.type}</span>
                {d.status === 'running' && (
                  <button onClick={() => stopDeploy(d.id)} className="text-[10px] text-accent-red hover:underline ml-1">Stop</button>
                )}
              </div>
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
        {deployments.length === 0 && projectId && (
          <p className="text-text-muted text-xs">No deployments yet. Click Deploy to start.</p>
        )}
        {!projectId && (
          <p className="text-text-muted text-xs">Select a project to deploy.</p>
        )}
      </div>
    </div>
  );
}
