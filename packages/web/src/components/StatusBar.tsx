import { useStore } from '../store';
import { Wifi, WifiOff, GitBranch } from 'lucide-react';

interface Props {
  serverOk: boolean | null;
}

export default function StatusBar({ serverOk }: Props) {
  const { activeProjectId, projects, selectedModel, tabs, activeTabId } = useStore();
  const project = projects.find(p => p.id === activeProjectId);
  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="flex items-center h-6 bg-accent-blue/90 px-3 gap-3 flex-shrink-0">
      {/* Server status */}
      <div className="flex items-center gap-1 text-white/80">
        {serverOk === null ? (
          <div className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
        ) : serverOk ? (
          <Wifi size={11} />
        ) : (
          <WifiOff size={11} className="text-red-300" />
        )}
        <span className="text-[11px]">{serverOk ? 'connected' : serverOk === null ? 'connecting...' : 'offline'}</span>
      </div>

      <div className="flex-1" />

      {/* Active file */}
      {activeTab && (
        <span className="text-[11px] text-white/70 truncate max-w-48">{activeTab.path}</span>
      )}

      {/* Model */}
      <span className="text-[11px] text-white/70 truncate max-w-32">{selectedModel.split('/').pop()}</span>
    </div>
  );
}
