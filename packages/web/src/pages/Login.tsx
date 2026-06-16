import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { api } from '../lib/api';

function IconZap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  );
}

export default function Pair({ register: _unused }: { register?: boolean }) {
  const navigate = useNavigate();
  const { setAuth, token } = useStore();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [siteName, setSiteName] = useState('cheap-ai');
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (token) { navigate('/app', { replace: true }); return; }
    api.info().then(i => setSiteName(i.siteName)).catch(() => {});
    refs.current[0]?.focus();
  }, []);

  function handleDigit(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];

    if (value.length > 1) {
      // Pasted a full code
      const pasted = value.replace(/\D/g, '').slice(0, 6).split('');
      pasted.forEach((d, i) => { if (i < 6) newDigits[i] = d; });
      setDigits(newDigits);
      const next = Math.min(pasted.length, 5);
      refs.current[next]?.focus();
      if (pasted.length === 6) submitCode(newDigits.join(''));
      return;
    }

    newDigits[index] = value;
    setDigits(newDigits);
    if (value && index < 5) refs.current[index + 1]?.focus();
    if (newDigits.every(d => d !== '')) submitCode(newDigits.join(''));
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus();
  }

  async function submitCode(code: string) {
    setLoading(true);
    setError('');
    const apiUrl = useStore.getState().apiUrl;

    // Try normal pair confirm first, then recovery confirm
    for (const endpoint of [
      `${apiUrl}/api/pair/confirm/${code}`,
      `${apiUrl}/api/pair/recovery/confirm/${code}`,
    ]) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json() as {
          token?: string;
          user?: Parameters<typeof setAuth>[1];
          error?: string;
        };

        if (res.ok && data.token) {
          setAuth(data.token, data.user!);
          navigate('/app', { replace: true });
          return;
        }
      } catch {}
    }

    setError('Invalid or expired code');
    setDigits(['', '', '', '', '', '']);
    setTimeout(() => refs.current[0]?.focus(), 50);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-2 mb-10">
          <span className="text-[#58a6ff]"><IconZap /></span>
          <span className="font-bold text-lg tracking-tight text-[#e6edf3]">{siteName}</span>
        </Link>

        {/* Icon */}
        <div className="flex justify-center mb-6 text-[#3fb950]">
          <IconTerminal />
        </div>

        <h1 className="text-2xl font-bold mb-2 text-[#e6edf3]">Pair your CLI</h1>
        <p className="text-[#7d8590] text-sm mb-8 leading-relaxed">
          Run <code className="text-[#58a6ff] bg-[#161b22] px-1.5 py-0.5 rounded text-xs font-mono">cheap web</code> in your terminal, then enter the 6-digit code shown.
        </p>

        {/* Code input */}
        <div className="flex justify-center gap-2 mb-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { refs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={loading}
              className={`w-11 h-14 text-center text-2xl font-bold font-mono rounded-lg border transition-all focus:outline-none
                ${error ? 'border-[#f85149] bg-[#f85149]/5' : d ? 'border-[#58a6ff] bg-[#58a6ff]/5' : 'border-[#30363d] bg-[#161b22]'}
                text-[#e6edf3] focus:border-[#58a6ff] disabled:opacity-50`}
            />
          ))}
        </div>

        {error && (
          <p className="text-[#f85149] text-sm mb-4 flex items-center justify-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </p>
        )}

        {loading && (
          <p className="text-[#7d8590] text-sm">Verifying code...</p>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-[#161b22] border border-[#30363d] rounded-xl p-4 text-left">
          <p className="text-xs font-semibold text-[#7d8590] uppercase tracking-wider mb-3">How to connect</p>
          <div className="space-y-2">
            {[
              { step: '1', text: 'Open your terminal in your project directory' },
              { step: '2', text: <>Run <code className="text-[#58a6ff] font-mono text-xs bg-[#0d1117] px-1 rounded">cheap web</code></> },
              { step: '3', text: 'Enter the 6-digit code shown in your terminal' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#21262d] text-[#7d8590] text-xs flex items-center justify-center font-mono">{step}</span>
                <span className="text-sm text-[#7d8590]">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-xs text-[#484f58]">
          <Link to="/" className="hover:text-[#7d8590] transition-colors">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
