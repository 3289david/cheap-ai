import { useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { X, Circle } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../lib/api';

export default function Editor() {
  const { tabs, activeTabId, setActiveTab, closeTab, updateTabContent, markTabSaved, activeProjectId } = useStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const activeTab = tabs.find(t => t.id === activeTabId);

  async function saveTab(tabId: string, content: string) {
    const tab = useStore.getState().tabs.find(t => t.id === tabId);
    if (!tab || !activeProjectId) return;
    try {
      await api.files.write(activeProjectId, tab.path, content);
      markTabSaved(tabId);
    } catch (e) {
      console.error('Save failed:', e);
    }
  }

  function handleChange(value: string | undefined) {
    if (!activeTabId || value === undefined) return;
    updateTabContent(activeTabId, value);

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTab(activeTabId, value);
    }, 1000);
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Tabs */}
      <div className="flex items-center bg-bg-secondary border-b border-bg-border overflow-x-auto flex-shrink-0 scrollbar-none">
        {tabs.length === 0 ? (
          <div className="flex items-center justify-center w-full h-9 text-xs text-text-muted">
            Open a file to start editing
          </div>
        ) : (
          tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 h-9 text-xs whitespace-nowrap border-r border-bg-border group transition-colors flex-shrink-0 ${
                tab.id === activeTabId
                  ? 'bg-bg-primary text-text-primary border-t-2 border-t-accent-blue'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              {tab.modified && (
                <Circle size={6} className="fill-accent-yellow text-accent-yellow flex-shrink-0" />
              )}
              <span>{tab.name}</span>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="opacity-0 group-hover:opacity-100 hover:bg-bg-active rounded p-0.5 transition-opacity ml-0.5"
              >
                <X size={11} />
              </span>
            </button>
          ))
        )}
      </div>

      {/* Editor */}
      {activeTab ? (
        <div className="flex-1 overflow-hidden">
          <MonacoEditor
            height="100%"
            language={activeTab.language || 'plaintext'}
            value={activeTab.content}
            onChange={handleChange}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              fontLigatures: true,
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'off',
              automaticLayout: true,
              tabSize: 2,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              suggest: { preview: true },
              smoothScrolling: true,
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 8 },
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
          <div className="text-6xl mb-4 opacity-20">⚡</div>
          <p className="text-sm font-medium mb-1">cheap-ai</p>
          <p className="text-xs">Open a file from the Explorer or ask AI to create one</p>
        </div>
      )}

      {/* File path breadcrumb */}
      {activeTab && (
        <div className="flex items-center px-3 h-6 border-t border-bg-border bg-bg-secondary flex-shrink-0">
          <span className="text-[11px] text-text-muted truncate">
            {activeTab.path}
          </span>
          {activeTab.language && (
            <span className="ml-auto text-[11px] text-text-muted capitalize">
              {activeTab.language}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
