import { useState, useRef } from 'react';
import { Search, Loader2, Database, MessageSquare } from 'lucide-react';
import { api } from '../lib/api.ts';

interface Message {
  id:      string;
  role:    'user' | 'assistant';
  content: string;
  sources?: Array<{ threatId: string; sourceIp: string; attackType: string; relevance: number }>;
  mode?:   string;
}

export function RAGQuery() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id:      'welcome',
      role:    'assistant',
      content: 'Ask me anything about your threat history. Try: "Has 185.234.219.47 attacked us before?" or "Show me all SQL injection attacks this week."',
    },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter(m => !m.id.startsWith('err-'))
        .map(m => ({ role: m.role, content: m.content }));

      const result = await api.logs.query(q, history);
      const aiMsg: Message = {
        id:      `ai-${Date.now()}`,
        role:    'assistant',
        content: result.answer,
        sources: result.sources as Message['sources'],
        mode:    result.mode,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id:      `err-${Date.now()}`,
        role:    'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Query failed'}`,
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div>
        <h1 className="text-2xl font-bold font-display text-on-surface tracking-tight">Log Intelligence</h1>
        <p className="text-on-surface-variant text-sm mt-1 font-mono uppercase tracking-wider text-[11px] flex items-center gap-2">
          Natural language queries over threat matrices
          <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-glow">
            <Database className="w-3 h-3" /> RAG · PHASE 5
          </span>
        </p>
      </div>

      {/* Chat */}
      <div className="flex-1 glass-panel rounded-xl flex flex-col relative" style={{ minHeight: 480 }}>
        {/* Subtle top edge highlight */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? '' : 'space-y-2'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 bg-gradient-to-br from-primary to-primary-container rounded flex items-center justify-center shadow-glow">
                      <MessageSquare className="w-3 h-3 text-background" />
                    </div>
                    <span className="text-[10px] font-bold text-on-surface-variant font-mono uppercase tracking-widest">HawkEye Node</span>
                    {msg.mode && (
                      <span className="text-[9px] font-bold bg-secondary/10 border border-secondary/20 text-secondary px-1.5 py-0.5 rounded font-mono uppercase shadow-glow-secondary flex items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary mr-1 animate-pulse" />
                        {msg.mode}
                      </span>
                    )}
                  </div>
                )}
                <div className={`px-5 py-3.5 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-background font-medium rounded-br-sm shadow-glow'
                    : 'bg-surface-lowest/60 border border-outline-variant/30 text-on-surface rounded-bl-sm font-mono text-[13px] backdrop-blur-md'
                }`}>
                  {msg.content}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <p className="text-[9px] text-on-surface-variant font-bold font-mono uppercase tracking-[0.2em]">Validated Sources</p>
                    {msg.sources.map(s => (
                      <div key={s.threatId} className="flex items-center gap-3 bg-surface-lowest/40 border border-outline-variant/20 rounded-lg px-4 py-2 hover:border-outline-variant/50 transition-colors cursor-default">
                        <span className="font-mono text-[11px] font-semibold text-error shadow-glow-error">{s.sourceIp}</span>
                        <span className="text-outline-variant text-xs">•</span>
                        <span className="text-[11px] text-on-surface truncate max-w-[200px]">{s.attackType}</span>
                        <span className="ml-auto text-[9px] font-bold font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          {Math.round(s.relevance * 100)}% Match
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-lowest/60 border border-outline-variant/30 rounded-xl rounded-bl-sm px-5 py-3.5 flex items-center gap-3 font-mono text-xs text-primary backdrop-blur-md shadow-glow-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Interrogating threat matrices…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-outline-variant/30 p-5 bg-surface-lowest/40 backdrop-blur-md flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Initialize query protocol…"
            className="flex-1 bg-surface-lowest/50 border border-outline-variant/30 rounded-lg px-4 py-2.5 text-on-surface font-mono text-sm outline-none focus:border-primary/50 transition-colors placeholder-on-surface-variant/30 focus:shadow-glow"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-background rounded-lg text-[11px] font-bold font-mono tracking-widest uppercase hover:bg-primary-container disabled:opacity-40 transition-colors shadow-glow"
          >
            <Search className="w-3.5 h-3.5" />
            Engage
          </button>
        </div>
      </div>

      {/* Suggested queries */}
      <div className="flex flex-wrap gap-2.5">
        {[
          'Has 185.234.219.47 attacked before?',
          'Show all SQL injection attacks',
          'Which origins have highest volume?',
          'Recent brute force on /admin',
        ].map(q => (
          <button
            key={q}
            onClick={() => { setInput(q); }}
            className="text-[10px] font-mono tracking-wide px-3 py-1.5 bg-surface-lowest/50 border border-outline-variant/30 rounded-full text-on-surface-variant hover:border-primary/50 hover:text-primary transition-colors hover:shadow-glow backdrop-blur-sm"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
