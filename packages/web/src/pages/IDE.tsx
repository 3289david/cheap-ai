import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useStore } from '../store';
import { api } from '../lib/api';
import Sidebar from '../components/Sidebar';
import Editor from '../components/Editor';
import Chat from '../components/Chat';
import TerminalPanel from '../components/Terminal';
import TopBar from '../components/TopBar';
import StatusBar from '../components/StatusBar';
import SetupModal from '../components/SetupModal';

export default function IDE() {
  const {
    showSidebar, showChat, showTerminal,
    activeProjectId, apiUrl, token,
    setProjects, setActiveProject,
  } = useStore();

  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    api.health()
      .then(() => {
        setServerOk(true);
        return api.projects.list();
      })
      .then((projects) => {
        setProjects(projects);
        if (!activeProjectId && projects.length > 0) {
          setActiveProject(projects[0].id);
        }
      })
      .catch(() => setServerOk(false));
  }, [apiUrl, token]);

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-[#e6edf3] select-none overflow-hidden">
      <TopBar onSetup={() => setShowSetup(true)} />

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {showSidebar && (
            <>
              <Panel defaultSize={18} minSize={12} maxSize={35}>
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="w-px bg-[#30363d] hover:bg-[#58a6ff] transition-colors cursor-col-resize" />
            </>
          )}

          <Panel defaultSize={showChat ? 55 : 82}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={showTerminal ? 70 : 100} minSize={30}>
                <Editor />
              </Panel>
              {showTerminal && (
                <>
                  <PanelResizeHandle className="h-px bg-[#30363d] hover:bg-[#58a6ff] transition-colors cursor-row-resize" />
                  <Panel defaultSize={30} minSize={10} maxSize={60}>
                    <TerminalPanel />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {showChat && (
            <>
              <PanelResizeHandle className="w-px bg-[#30363d] hover:bg-[#58a6ff] transition-colors cursor-col-resize" />
              <Panel defaultSize={27} minSize={20} maxSize={50}>
                <Chat />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <StatusBar serverOk={serverOk} />
      {showSetup && <SetupModal onClose={() => setShowSetup(false)} />}
    </div>
  );
}
