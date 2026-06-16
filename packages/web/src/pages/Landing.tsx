import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const GITHUB_URL = 'https://github.com/your-org/cheap-ai';

function IconTerminal() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  );
}

function IconCode() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}

function IconServer() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  );
}

function IconBrain() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconGitHub() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

const FEATURES = [
  {
    icon: <IconTerminal />,
    title: 'CLI-First Agent',
    desc: 'Run cheap in any project directory. The AI reads files, writes code, runs commands, and remembers your project across sessions.',
  },
  {
    icon: <IconCode />,
    title: 'Browser IDE',
    desc: 'Monaco editor, file tree, real terminal over WebSocket, and AI chat panel — all in the browser, no install required.',
  },
  {
    icon: <IconServer />,
    title: 'Self-Hosted on Your VPS',
    desc: 'One docker compose up and you own everything. Your code, your data, your infrastructure. No vendor lock-in.',
  },
  {
    icon: <IconBrain />,
    title: 'Persistent Memory',
    desc: 'The AI remembers your project architecture, preferences, and past decisions across every session.',
  },
  {
    icon: <IconZap />,
    title: 'Any AI Model',
    desc: 'Bring your own keys. Use Claude, GPT-4o, Gemini, DeepSeek, Llama, Mistral, or any OpenAI-compatible endpoint.',
  },
  {
    icon: <IconShield />,
    title: 'Team Admin Panel',
    desc: 'Manage users, set rate limits, configure providers, issue invite links, and ban bad actors — all in /admin.',
  },
];

const CODE_DEMO = `$ cheap
 cheap-ai v0.1.0  |  project: my-api  |  model: claude-sonnet-4-5

  You › add JWT auth to the Express app

  AI › Reading src/index.ts...
       Reading src/routes/users.ts...

  Writing src/middleware/auth.ts
  Writing src/routes/auth.ts
  Editing src/index.ts

  Done. JWT auth added:
  - POST /auth/register
  - POST /auth/login
  - GET  /me (protected)

  Run: npm install jsonwebtoken bcryptjs

  You › /memory

  Project Memory:
  [architecture] Express + TypeScript REST API
  [feature]      JWT auth using HS256, 30-day tokens
  [preference]   Keep middleware in src/middleware/`;

export default function Landing() {
  const [siteName, setSiteName] = useState('cheap-ai');

  useEffect(() => {
    api.info().then(info => setSiteName(info.siteName)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] font-sans">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 border-b border-[#30363d] bg-[#0d1117]/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span className="font-bold text-sm tracking-tight">{siteName}</span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[#7d8590] hover:text-[#e6edf3] text-sm transition-colors"
          >
            <IconGitHub />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <Link
            to="/login"
            className="text-sm text-[#7d8590] hover:text-[#e6edf3] transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="text-sm px-3 py-1.5 bg-[#58a6ff] text-[#0d1117] font-semibold rounded-md hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#30363d] text-xs text-[#7d8590] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
          Self-hosted, open source
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 max-w-3xl mx-auto leading-tight">
          AI coding agent that runs{' '}
          <span className="text-[#58a6ff]">on your server</span>
        </h1>

        <p className="text-lg text-[#7d8590] max-w-2xl mx-auto mb-10">
          CLI-first. Browser IDE. One API key for your whole team.
          Deploy Docker containers with a single command.
          Your code never leaves your VPS.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Link
            to="/register"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#58a6ff] text-[#0d1117] font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Start free
            <IconArrow />
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-3 border border-[#30363d] rounded-lg text-[#e6edf3] hover:bg-[#21262d] transition-colors font-medium"
          >
            <IconGitHub />
            View on GitHub
          </a>
        </div>

        {/* Terminal demo */}
        <div className="max-w-3xl mx-auto rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden text-left shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#30363d]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#f85149]" />
              <div className="w-3 h-3 rounded-full bg-[#d29922]" />
              <div className="w-3 h-3 rounded-full bg-[#3fb950]" />
            </div>
            <span className="text-xs text-[#7d8590] ml-2 font-mono">bash</span>
          </div>
          <pre className="p-5 text-sm font-mono text-[#e6edf3] overflow-x-auto whitespace-pre leading-6">
            <span className="text-[#7d8590]">{CODE_DEMO}</span>
          </pre>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-[#30363d]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">Everything you need</h2>
          <p className="text-[#7d8590] text-center mb-12">One platform, full control</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-xl border border-[#30363d] bg-[#161b22] p-5">
                <div className="w-9 h-9 rounded-lg bg-[#58a6ff]/10 text-[#58a6ff] flex items-center justify-center mb-3">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-[#7d8590] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BYOK section */}
      <section className="py-20 px-6 border-t border-[#30363d]">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-[#58a6ff] text-xs font-semibold tracking-widest uppercase mb-3">Multi-Provider</div>
              <h2 className="text-3xl font-bold mb-4">Your keys. Any model.</h2>
              <p className="text-[#7d8590] mb-6">
                Connect your own API keys for any provider. One admin configures it once — the whole team uses it. No per-user key management.
              </p>
              <ul className="space-y-2">
                {['OpenAI (direct)', 'Anthropic (direct)', 'Google Gemini', 'OpenRouter (all models)', 'Ollama (local)', 'Any OpenAI-compatible API'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <span className="text-[#3fb950]"><IconCheck /></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 font-mono text-sm">
              <div className="text-[#7d8590] text-xs mb-3">Admin panel — AI Providers</div>
              {[
                { name: 'Anthropic Direct', type: 'anthropic', status: 'default' },
                { name: 'OpenAI GPT-4o', type: 'openai', status: 'enabled' },
                { name: 'Gemini 2.0 Flash', type: 'gemini', status: 'enabled' },
                { name: 'Ollama Local', type: 'ollama', status: 'enabled' },
              ].map(p => (
                <div key={p.name} className="flex items-center justify-between py-2 border-b border-[#30363d] last:border-0">
                  <div>
                    <div className="text-[#e6edf3] text-xs">{p.name}</div>
                    <div className="text-[#7d8590] text-[11px]">{p.type}</div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${p.status === 'default' ? 'bg-[#58a6ff]/20 text-[#58a6ff]' : 'bg-[#3fb950]/20 text-[#3fb950]'}`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team section */}
      <section className="py-20 px-6 border-t border-[#30363d]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-[#58a6ff] text-xs font-semibold tracking-widest uppercase mb-3">Team Features</div>
          <h2 className="text-3xl font-bold mb-4">One server, your whole team</h2>
          <p className="text-[#7d8590] mb-12 max-w-xl mx-auto">
            Deploy once. Invite your team. Everyone gets the same AI power with configurable rate limits per user.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 text-left">
            {[
              { icon: <IconUsers />, title: 'Invite Links', desc: 'Generate one-time or limited-use invite links with role pre-assigned.' },
              { icon: <IconShield />, title: 'Role-Based Access', desc: 'Member, Admin, Super Admin. Admins configure providers and rate limits.' },
              { icon: <IconTerminal />, title: 'CLI Auth', desc: 'cheap login --server https://your.server connects the CLI to your team server.' },
            ].map(item => (
              <div key={item.title} className="rounded-xl border border-[#30363d] bg-[#161b22] p-5">
                <div className="text-[#58a6ff] mb-2">{item.icon}</div>
                <div className="font-semibold text-sm mb-1">{item.title}</div>
                <div className="text-[#7d8590] text-sm">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-[#30363d]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to own your AI stack?</h2>
          <p className="text-[#7d8590] mb-8">Deploy to your VPS in under 5 minutes.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/register"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#58a6ff] text-[#0d1117] font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              Get started free
              <IconArrow />
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-6 py-3 border border-[#30363d] rounded-lg hover:bg-[#21262d] transition-colors"
            >
              <IconGitHub />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#30363d] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span className="text-sm font-semibold">{siteName}</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-[#7d8590]">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#e6edf3] transition-colors">GitHub</a>
            <Link to="/login" className="hover:text-[#e6edf3] transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-[#e6edf3] transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
