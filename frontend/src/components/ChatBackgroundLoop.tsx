import React, { useEffect, useMemo, useRef, useState } from 'react';
import './ChatBackgroundLoop.css';

type LoopMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: React.ReactNode;
};

const sample: LoopMessage[] = [
  { id: 1, role: 'user', text: (
    <>Hey, can you summarize this long article and highlight the top three takeaways?<br />
    Keep it concise but clear, and add 1–2 actionable tips.</>
  ) },
  { id: 2, role: 'assistant', text: (
    <>
      Absolutely. Key takeaways:
      <ul>
        <li>Centralize theme tokens for consistency and faster iteration.</li>
        <li>Prefer GPU-friendly animations (opacity/transform).</li>
        <li>Prioritize accessible contrast on translucent surfaces.</li>
      </ul>
      Tips: start small, validate contrast early.
    </>
  ) },
  { id: 3, role: 'user', text: 'What are pitfalls when using translucent surfaces over dynamic content like chat threads?' },
  { id: 4, role: 'assistant', text: 'Watch out for readability issues from bleed‑through; add overlays, tune blur, and ensure strong text contrast + spacing.' },
  { id: 5, role: 'user', text: 'Sketch a lightweight auth approach that can scale later.' },
  { id: 6, role: 'assistant', text: (
    <>
      Minimal plan:
      <ul>
        <li>JWT access + rotating refresh tokens.</li>
        <li>bcrypt for password hashing, unique email index.</li>
        <li>Scope data by <code>user_id</code>, add <code>role</code> for admin gating.</li>
      </ul>
    </>
  ) },
  { id: 7, role: 'user', text: 'Any example to present usage metrics readable yet on-brand?' },
  { id: 8, role: 'assistant', text: 'Transparent header with a crisp bottom border, totals row with top border, slightly bolder type, no solid fills to keep the glass vibe.' },
  { id: 9, role: 'user', text: 'Provide a tiny code sample for a glass card using variables.' },
  { id: 10, role: 'assistant', text: (
    <>
      .card {'{'} background: var(--glass-bg); border: 1px solid var(--glass-border); box-shadow: var(--glass-shadow); border-radius: 16px; {'}'}
    </>
  ) },
  { id: 11, role: 'user', text: 'What about performance on low-end devices? Practical tips only.' },
  { id: 12, role: 'assistant', text: 'Reduce blur and shadow radii, limit repaint areas, cache layers, test with CPU throttling.' },
  { id: 13, role: 'user', text: 'If I want the sidebar to collapse on mobile, what pattern works best?' },
  { id: 14, role: 'assistant', text: 'Overlay modal + body scroll lock; accessible toggle; avoid label shift by absolutely positioning the label near the icon.' },
  { id: 15, role: 'user', text: 'Make the scrollbar more visible without breaking the look.' },
  { id: 16, role: 'assistant', text: 'Use theme variables for thumb, add a hover with slightly higher opacity, and keep the radius consistent.' },
  { id: 17, role: 'user', text: (
    <>Here is a slightly longer message to vary rhythm. It spans multiple sentences and helps the background feel alive without being distracting.</>
  ) },
  { id: 18, role: 'assistant', text: 'Loop jumps usually mean content height !== animation distance. Duplicate once; animate exactly 50% for a seamless loop.' },
  { id: 19, role: 'user', text: (
    <>Could you list pros/cons of backdrop-filter quickly?<ul><li>Pro: Beautiful glass effect.</li><li>Pro: Simple to apply.</li><li>Con: Can be expensive over large areas.</li><li>Con: Varies by browser performance.</li></ul></>
  ) },
  { id: 20, role: 'assistant', text: 'Agree. Keep blur localized where possible and layer subtle overlays to maintain legibility.' },
  { id: 21, role: 'user', text: 'Short.' },
  { id: 22, role: 'assistant', text: 'Longer response to balance short prompts and produce a more natural cadence in the scrolling background.' },
];

type Batch = { id: number; user?: LoopMessage; assistant?: LoopMessage; stage: 'user' | 'typing' | 'assistant' };

const ChatBackgroundLoop: React.FC = () => {
  // Build strict user+assistant pairs for batching
  const pairs = useMemo(() => {
    const out: Array<{ user: LoopMessage; assistant: LoopMessage }> = [];
    for (let i = 0; i < sample.length - 1; i++) {
      const u = sample[i];
      const a = sample[i + 1];
      if (u.role === 'user' && a.role === 'assistant') {
        out.push({ user: u, assistant: a });
        i++; // advance past assistant we consumed
      }
    }
    // Fallback: if none found, synthesize with the first two messages if available
    if (out.length === 0 && sample.length >= 2) {
      const u = sample.find(m => m.role === 'user') ?? sample[0];
      const a = sample.find(m => m.role === 'assistant') ?? sample[1];
      out.push({ user: u, assistant: a });
    }
    return out;
  }, []);

  // Rendered batches, bottom-anchored; oldest at start, newest at end
  const [rendered, setRendered] = useState<Batch[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const batchRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Helper: enqueue a specific pair as a new Batch at bottom
  const enqueuePair = (pair: { user: LoopMessage; assistant: LoopMessage }) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setRendered(prev => [...prev, { id, user: pair.user, assistant: pair.assistant, stage: 'user' }]);
    return id;
  };

  // Drive the staged flow sequentially: user -> typing -> assistant, then next pair
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion.matches) {
      setRendered(prev => prev.length ? prev : [
        { id: 1, user: pairs[0]?.user, assistant: pairs[0]?.assistant, stage: 'assistant' },
        { id: 2, user: pairs[(1) % pairs.length]?.user, assistant: pairs[(1) % pairs.length]?.assistant, stage: 'assistant' },
      ]);
      return;
    }

  // No pairs to show; bail
  if (pairs.length === 0) return;

  let timers: number[] = [];
    let running = true;

    const runSequence = (index: number) => {
      if (!running) return;
      const pair = pairs[index % pairs.length];
      const id = enqueuePair(pair);
      const typingStart = 250 + Math.random() * 250; // 250–500ms
      const responseDelay = 900 + Math.random() * 600; // 900–1500ms after typing
      const dwell = 700 + Math.random() * 500; // 700–1200ms before next user

      // Show typing after short moment
      const t1 = window.setTimeout(() => {
        setRendered(prev => prev.map(b => (b.id === id ? { ...b, stage: 'typing' } : b)));
      }, typingStart);
      timers.push(t1);

      // Reveal assistant after responseDelay
      const t2 = window.setTimeout(() => {
        setRendered(prev => prev.map(b => (b.id === id ? { ...b, stage: 'assistant' } : b)));
      }, typingStart + responseDelay);
      timers.push(t2);

      // After dwell, start next pair
      const t3 = window.setTimeout(() => runSequence(index + 1), typingStart + responseDelay + dwell);
      timers.push(t3);
    };

  // Defer initial start; if StrictMode cleans up the first run, this gets canceled
  const t0 = window.setTimeout(() => runSequence(0), 0);
  timers.push(t0);
    return () => {
      running = false;
      timers.forEach(t => clearTimeout(t));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodically drop batches that scrolled out of view at the top (FIFO)
  useEffect(() => {
    const interval = window.setInterval(() => {
      const container = containerRef.current;
      if (!container || rendered.length === 0) return;
      const first = rendered[0];
      const node = batchRefs.current.get(first.id);
      if (!node) return;
      const cRect = container.getBoundingClientRect();
      const nRect = node.getBoundingClientRect();
      if (nRect.bottom < cRect.top) {
        setRendered(prev => prev.slice(1));
      }
    }, 400);
    return () => clearInterval(interval);
  }, [rendered]);

  return (
    <div className="bg-loop" aria-hidden="true" ref={containerRef}>
      <div className="bg-loop-track">
        {rendered.map((b) => (
          <div
            key={b.id}
            className="batch"
            ref={(el) => {
              if (el) batchRefs.current.set(b.id, el);
              else batchRefs.current.delete(b.id);
            }}
          >
            {b.user && (
              <div className="message user">
                <div className="timestamp">now</div>
                <div className="bubble">{b.user.text}</div>
              </div>
            )}
            {b.stage === 'typing' && (
              <div className="message assistant">
                <div className="bubble typing">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
                <div className="timestamp">typing…</div>
              </div>
            )}
            {b.stage === 'assistant' && b.assistant && (
              <div className="message assistant">
                <div className="bubble">{b.assistant.text}</div>
                <div className="timestamp">now</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatBackgroundLoop;
