import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { api } from '../lib/api';
import type { ServerInfo } from '../lib/api';
import { Wifi, WifiOff, Share2, Copy, Check } from 'lucide-react';

interface Props {
  serverOk: boolean | null;
}

export default function StatusBar({ serverOk }: Props) {
  const { activeProjectId, projects, selectedModel, tabs, activeTabId } = useStore();
  const project = projects.find(p => p.id === activeProjectId);
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    api.info().then(setInfo).catch(() => {});
  }, []);

  function copyLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative flex items-center h-6 bg-accent-blue/90 px-3 gap-3 flex-shrink-0 select-none">
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

      {/* Network share button */}
      {info?.networkUrl && serverOk && (
        <div className="relative">
          <button
            onClick={() => setShowShare(v => !v)}
            className="flex items-center gap-1 text-white/70 hover:text-white transition-colors text-[11px]"
            title="Share link for local network"
          >
            <Share2 size={11} />
            <span className="hidden sm:inline">Share</span>
          </button>

          {showShare && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowShare(false)} />
              <div className="absolute bottom-7 left-0 z-20 bg-[#161b22] border border-[#30363d] rounded-xl shadow-xl p-4 w-72 space-y-3">
                <p className="text-xs font-semibold text-[#e6edf3]">Share with your team</p>
                <p className="text-xs text-[#7d8590]">Anyone on the same network can open this URL and pair their CLI.</p>

                <div>
                  <p className="text-[10px] text-[#7d8590] mb-1">Local (this machine)</p>
                  <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5">
                    <span className="text-xs font-mono text-[#58a6ff] flex-1 truncate">{info.localUrl}</span>
                    <button onClick={() => copyLink(info.localUrl!)} className="text-[#7d8590] hover:text-[#e6edf3] flex-shrink-0">
                      {copied ? <Check size={12} className="text-[#3fb950]" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-[#7d8590] mb-1">Network (share this)</p>
                  <div className="flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5">
                    <span className="text-xs font-mono text-[#3fb950] flex-1 truncate">{info.networkUrl}</span>
                    <button onClick={() => copyLink(info.networkUrl!)} className="text-[#7d8590] hover:text-[#e6edf3] flex-shrink-0">
                      {copied ? <Check size={12} className="text-[#3fb950]" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-[#484f58]">
                  Teammates run <code className="text-[#58a6ff]">cheap web --server {info.networkUrl}</code> to pair.
                </p>
              </div>
            </>
          )}
        </div>
      )}

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
