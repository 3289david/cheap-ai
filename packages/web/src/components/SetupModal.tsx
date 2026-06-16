import { useState } from 'react';
import { X, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../lib/api';

interface Props {
  onClose: () => void;
}

export default function SetupModal({ onClose }: Props) {
  const { apiUrl, setApiUrl } = useStore();
  const [serverUrl, setServerUrl] = useState(apiUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      setApiUrl(serverUrl);
      await api.health();
      setTestResult('ok');
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  }

  function save() {
    setApiUrl(serverUrl);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary border border-bg-border rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Server URL */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1.5">
              Server URL
            </label>
            <div className="flex gap-2">
              <input
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                placeholder="http://localhost:3000"
                className="flex-1 bg-bg-tertiary text-text-primary text-sm px-3 py-2 rounded-lg border border-bg-border focus:outline-none focus:border-accent-blue"
              />
              <button
                onClick={testConnection}
                disabled={testing}
                className="px-3 py-2 text-xs bg-bg-tertiary hover:bg-bg-hover border border-bg-border rounded-lg text-text-primary transition-colors disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
            </div>
            {testResult === 'ok' && (
              <p className="flex items-center gap-1 text-xs text-accent-green mt-1.5">
                <CheckCircle size={12} /> Connected!
              </p>
            )}
            {testResult === 'fail' && (
              <p className="flex items-center gap-1 text-xs text-accent-red mt-1.5">
                <AlertCircle size={12} /> Connection failed. Is the server running?
              </p>
            )}
          </div>

          {/* Setup instructions */}
          <div className="bg-bg-tertiary rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-text-primary">Quick Setup on VPS</p>
            <pre className="text-[11px] text-text-secondary overflow-auto">
{`# 1. Clone and install
git clone <repo> cheap-ai && cd cheap-ai
pnpm install

# 2. Configure
cp .env.example .env
nano .env  # add OPENROUTER_API_KEY

# 3. Build and run
pnpm build
pnpm start  # starts on :3000`}
            </pre>
          </div>

          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span>Get API key:</span>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-accent-blue hover:underline"
            >
              openrouter.ai/keys <ExternalLink size={10} />
            </a>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-bg-border">
          <button onClick={onClose} className="px-4 py-2 text-xs text-text-secondary hover:text-text-primary transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            className="px-4 py-2 text-xs bg-accent-blue text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
