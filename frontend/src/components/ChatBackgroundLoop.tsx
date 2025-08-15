import React, { useEffect, useMemo, useRef, useState } from 'react';
import './ChatBackgroundLoop.css';

type LoopMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: React.ReactNode;
};

const sample: LoopMessage[] = [
  { id: 1, role: 'user', text: (
    <>
      I skimmed a long article — can you condense it into the top three takeaways?
      Please add one quick, practical action I can ship today.
    </>
  ) },
  { id: 2, role: 'assistant', text: (
    <>
      TL;DR:
      <ol>
        <li>Centralize tokens for theme consistency.</li>
        <li>Favor transform/opacity for smooth animations.</li>
        <li>Increase contrast on translucent layers.</li>
      </ol>
      Quick action: run an a11y contrast check on your primary card and fix the worst offender.
    </>
  )},

  { id: 3, role: 'user', text: 'Why can text look fuzzy over a blurred background?' },
  { id: 4, role: 'assistant', text: 'Because blur and low contrast let background colors bleed through — add a subtle overlay and slightly bolder type to compensate.' },

  { id: 5, role: 'user', text: (
    <>
      Quick checklist:
      <ul>
        <li>signup</li>
        <li>hash</li>
        <li>store</li>
        <li>jwt</li>
        <li>refresh</li>
        <li>verify</li>
        <li>roles</li>
        <li>limits</li>
        <li>logs</li>
        <li>monitor</li>
      </ul>
    </>
  ) },
  { id: 6, role: 'assistant', text: (
    <>
      Minimal auth plan:
      <ul>
        <li>Signup: email + password (hash with bcrypt).</li>
        <li>Issue JWT access + refresh tokens.</li>
        <li>Protect routes; store minimal user metadata.</li>
      </ul>
      Later: rotate refresh tokens and add email verification.
    </>
  )},

  { id: 7, role: 'user', text: (
    <>
      Playful idea: imagine a thread with a couple of quick voice changes.
      Start with a short curious question.
      Then add a reflective aside that looks like someone quoted a book line.
      Finally, finish with a tiny meme wink.
    </>
  )},
  { id: 8, role: 'assistant', text: (
    <>
      Nice — small, recognizable references are perfect. Examples:
      <ul>
        <li>Star Wars nods: "May the Force be with you" style phrasing.</li>
        <li>Internet meme wink: classic bait-and-switch (you know the one).</li>
        <li>Short booky lines paraphrased for flavor.</li>
      </ul>
    </>
  )},

  { id: 9, role: 'user', text: 'Show a tiny CSS snippet for a glass card, please.' },
  { id: 10, role: 'assistant', text: (
    <>
      <code>.card {'{'} background: rgba(255,255,255,0.06); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.08); border-radius:12px; {'}'}</code>
    </>
  )},

  { id: 11, role: 'user', text: (
    <>
      On low-end devices you should:
      <br />
      1) Reduce heavy effects (large backdrop-filter blur values slow rendering).
      <br />
      2) Avoid painting massive shadows and big fixed overlays that force repaints.
      <br />
      3) Prefer GPU-composited transforms and cache layers where possible.
    </>
  ) },
  { id: 12, role: 'assistant', text: (
    <>
      1) Reduce blur radius
      <br />
      2) Prefer opacity/transform
      <br />
      3) Limit large painted areas
    </>
  )},

  { id: 13, role: 'user', text: 'Throw in a short meme reference — something cheeky but tiny.' },
  { id: 14, role: 'assistant', text: (
    <>
      Classic internet energy: "rickroll (classic bait)" — keep it short so people smile, not sing along.
    </>
  )},

  { id: 15, role: 'user', text: (
    <>I need a how-to that sounds like documentation — a few steps and a tiny checklist would help.</>
  )},
  { id: 16, role: 'assistant', text: (
    <>
      How to ship a small UI theme update:
      <ol>
        <li>Audit components that use hardcoded colors.</li>
        <li>Extract CSS variables into a central file.</li>
        <li>Provide dark/light tokens and a switcher with localStorage persistence.</li>
      </ol>
      Test: toggle themes and run the contrast report.
    </>
  )},

  { id: 17, role: 'user', text: 'Sidebar on mobile — overlay or push? Pros/cons in one line.' },
  { id: 18, role: 'assistant', text: 'Overlay is usually best for small screens: it prevents layout shift and lets you lock body scroll.' },

  { id: 19, role: 'user', text: (
    <>Add a cinematic paraphrase — something short and uplifting, not the exact quote.</>
  )},
  { id: 20, role: 'assistant', text: 'Paraphrase example: an encouraging send-off like "Go with the force in your code" — short and thematic.' },

  { id: 21, role: 'user', text: (
    <>
      Example request: give a multi-line response with these points —
      <ul>
        <li>explain why spacing matters in layout and when to normalize it for components</li>
        <li>show how tokens improve theme swapping and reduce duplication in stylesheets</li>
        <li>provide a tiny snippet demonstrating a compact button rule to copy</li>
      </ul>
    </>
  )},
  { id: 22, role: 'assistant', text: (
    <>
      Quick checklist:
      <ul>
        <li>Normalize spacing</li>
        <li>Use tokens for colors</li>
        <li>Test on small screens</li>
      </ul>
      Example:
      <pre><code>{`button { padding: 8px 12px; border-radius: 10px; }`}</code></pre>
    </>
  )},

  { id: 23, role: 'user', text: 'One-liner — make it short and different.' },
  { id: 24, role: 'assistant', text: 'Short but helpful — you got it.' },

  { id: 25, role: 'user', text: (
    <>
      Final notes:
    <ul>
      <li>reflect — review what worked and what didn’t</li>
      <li>repeat — practice the process for consistency</li>
      <li>refine — tweak details for better results</li>
      <li>ship — deliver improvements, even if small</li>
      <li>iterate — keep evolving with each cycle</li>
      <li>learn — capture insights for next time</li>
      <li>share — communicate progress and lessons</li>
      <li>celebrate — acknowledge milestones, no matter the size</li>
    </ul>
    </>
  ) },
  { id: 26, role: 'assistant', text: 'Paraphrased booky line: "Small consistent steps beat occasional huge leaps."' },
];

type Batch = { id: number; user?: LoopMessage; assistant?: LoopMessage; stage: 'user' | 'typing' | 'assistant' };

const ChatBackgroundLoop: React.FC = () => {
  // Helpers: build explicit user/assistant pairs and shuffle
  const buildPairs = (msgs: LoopMessage[]) => {
    const out: Array<{ user: LoopMessage; assistant: LoopMessage }> = [];
    for (let i = 0; i < msgs.length - 1; i++) {
      const u = msgs[i];
      const a = msgs[i + 1];
      if (u.role === 'user' && a.role === 'assistant') {
        out.push({ user: u, assistant: a });
        i++; // skip consumed assistant
      }
    }
    // fallback: pair first user/assistant found
    if (out.length === 0 && msgs.length >= 2) {
      const u = msgs.find(m => m.role === 'user') ?? msgs[0];
      const a = msgs.find(m => m.role === 'assistant') ?? msgs[1];
      out.push({ user: u, assistant: a });
    }
    return out;
  };

  const shuffleArray = <T,>(arr: T[]) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  // Rendered batches, bottom-anchored; oldest at start, newest at end
  const [rendered, setRendered] = useState<Batch[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const batchRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // build and shuffle pairs synchronously so the main loop starts with the final order
  const pairs = useMemo(() => {
    const p = buildPairs(sample);
    return p.length > 1 ? shuffleArray(p) : p;
  }, []);

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
  // restart when pairs change (we shuffle on mount)
  }, [pairs]);

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
