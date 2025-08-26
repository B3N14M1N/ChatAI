import React, { useState, useEffect } from "react";
import { apiFetch, fetchJson } from "./lib/api";
import "./App.css";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import ChatPane from "./components/ChatPane.tsx";
import FloatingChatBubble from "./components/FloatingChatBubble.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import LibraryPage from "./pages/LibraryPage.tsx";
import type { Conversation, Message } from "./types";
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const idParam = searchParams.get('id');

  // Persist sidebar collapsed state in localStorage to avoid polluting history
  const COLLAPSE_KEY = 'sidebar.collapsed';
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      return raw === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next.toString()); } catch {}
      return next;
    });
  };

  // State variables for conversations, messages, and UI
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showFloatingChat, setShowFloatingChat] = useState<boolean>(true);
  const [chatMinimized, setChatMinimized] = useState<boolean>(() => {
    try { return localStorage.getItem('chat.floating.minimized') === 'true'; } catch { return false; }
  });
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem('chat.floating.bubble.pos');
      if (raw) {
        const p = JSON.parse(raw) as { x: number; y: number };
        const vw = window.innerWidth, vh = window.innerHeight; const bw = 64, bh = 64; const margin = 8;
        return { x: Math.max(margin, Math.min(vw - bw - margin, p.x)), y: Math.max(margin, Math.min(vh - bh - margin, p.y)) };
      }
    } catch {}
    // Default to top-right corner with a small margin
    const margin = 16;
    const bw = 64;
    return { x: Math.max(margin, window.innerWidth - bw - margin), y: margin };
  });

  // Persist minimized and bubble position
  useEffect(() => {
    try { localStorage.setItem('chat.floating.minimized', chatMinimized ? 'true' : 'false'); } catch {}
  }, [chatMinimized]);
  useEffect(() => {
    try { localStorage.setItem('chat.floating.bubble.pos', JSON.stringify(bubblePos)); } catch {}
  }, [bubblePos]);

  // Function to select and load messages for a conversation
  async function selectConversation(conv: Conversation): Promise<void> {
    setSelectedConv(conv);
    // clear input is managed by ChatInput locally
    try {
      const res = await fetchJson<{ conversation_id: number; messages: Message[] }>(
        `/conversations/${conv.id}/messages`
      );
      setMessages(res.messages);
    } catch (err) {
      console.error(err);
    }
  }

  // Load conversations on mount
  useEffect(() => {
    const loadConvos = async () => {
      try {
  const res = await fetchJson<Conversation[]>("/conversations/");
  setConversations(res);
      } catch (error) {
        console.error(error);
      }
    };
    loadConvos();
  }, []);

  // Note: Do not auto-redirect away from /account. Selecting a conversation triggers
  // an explicit navigate('/') with the id, handled in onSelect above.
  // Sync selection or new-chat when idParam changes
  useEffect(() => {
    // Don't manage chat selection when on the Library page,
    // to avoid clobbering query params like `select`.
    if (location.pathname.startsWith('/library')) return;
    if (conversations.length === 0) return;
    // if no idParam, redirect to new conversation
    if (!searchParams.has('id')) {
      setSearchParams({ id: 'new' }, { replace: true });
      return;
    }
    // new conversation mode: clear selection
    if (idParam === 'new') {
      setSelectedConv(null);
      setMessages([]);
      return;
    }
    // load existing conversation
    const targetId = parseInt(idParam!, 10);
    const conv = conversations.find(c => c.id === targetId) || conversations[0];
    // ensure URL id matches selected
    if (conv.id.toString() !== idParam) {
      setSearchParams({ id: conv.id.toString() }, { replace: true });
    }
    selectConversation(conv);
  }, [conversations, idParam, collapsed, location.pathname]);

  // Start a blank chat, will create on first message
  const createConversation = () => {
    navigate({ pathname: '/', search: '?id=new' });
  };

  // Start a new conversation but keep/use the floating chat (don't navigate away)
  const startNewFloatingConversation = () => {
    try {
      // set query to new to make App effect clear selection
      setSearchParams({ id: 'new' });
    } catch {}
    setSelectedConv(null);
    setMessages([]);
    setShowFloatingChat(true);
    setChatMinimized(false);
  };

  // Rename a conversation
  const renameConversation = async (id: number, newTitle: string) => {
    try {
  await apiFetch(`/conversations/${id}/rename?new_title=${encodeURIComponent(newTitle)}`, { method: 'PUT' });
  const listRes = await fetchJson<Conversation[]>("/conversations/");
  setConversations(listRes);
      // if renaming current, update selectedConv
      if (selectedConv?.id === id) {
  const updated = listRes.find((c: Conversation) => c.id === id) || null;
        setSelectedConv(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };
  // Delete a conversation
  const deleteConversation = async (id: number) => {
    try {
  await apiFetch(`/conversations/${id}`, { method: 'DELETE' });
      if (selectedConv?.id === id) {
        setSelectedConv(null);
        setMessages([]);
      }
      const listRes = await fetchJson<Conversation[]>("/conversations/");
      setConversations(listRes);
      // switch to first
      if (selectedConv?.id === id && listRes.length) {
        const firstId = listRes[0].id.toString();
        setSearchParams({ id: firstId });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send a chat message; handle new and existing conversations, with optional files
  const handleSend = async (text: string, model: string, files?: File[]) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Optimistic UI: display user message
    const userMsg: Message = {
      id: Date.now(),
      conversation_id: selectedConv?.id ?? 0,
      request_id: null, // Explicitly set to null for user messages
      text: trimmed,
      created_at: new Date().toISOString(),
      // show attachments immediately (temporary structure for display)
      attachments: files?.map((file, idx) => ({ 
        id: Date.now() + idx, 
        message_id: Date.now(),
        filename: file.name,
        content_type: file.type || 'application/octet-stream'
      }))
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      // Build multipart form data
      const form = new FormData();
      // Only include conversation_id when replying to an existing conversation
      if (selectedConv?.id != null) {
        form.append('conversation_id', selectedConv.id.toString());
      }
      // Remove the sender parameter - it's now determined by request_id
      form.append('text', trimmed);
      form.append('model', model);
      // append files
      if (files && files.length) {
        files.forEach(file => form.append('files', file, file.name));
      }
  const res = await apiFetch('/chat/', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  const data: { conversation_id: number; request_message_id: number; response_message_id?: number | null; answer?: string | null } = await res.json();
      // On first message, select the new conversation
      let convId = selectedConv?.id || data.conversation_id;
      if (!selectedConv) {
        const listRes = await fetchJson<Conversation[]>("/conversations/");
        setConversations(listRes);
  const newConv = listRes.find((c: Conversation) => c.id === data.conversation_id);
        if (newConv) {
          setSelectedConv(newConv);
          setSearchParams({ id: newConv.id.toString() });
          convId = newConv.id;
        }
      }
  // Reload full conversation messages to include attachments and reflect ignored flags
      if (convId != null) {
        const msgsRes = await fetchJson<{ conversation_id: number; messages: Message[] }>(
          `/conversations/${convId}/messages`
        );
        setMessages(msgsRes.messages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Ensure floating chat is shown when navigating to /library (fix for missing bubble after docking)
  useEffect(() => {
    if (location.pathname.startsWith('/library')) {
      setShowFloatingChat(true);
  // On Library, keep chat minimized so content stays in focus
  setChatMinimized(true);
    }
  }, [location.pathname]);

  return (
      <div className="app-container">
        <Sidebar
          conversations={conversations}
          selectedId={selectedConv?.id ?? null}
          onSelect={conv => {
            navigate({ pathname: '/', search: `?id=${conv.id}` });
          }}
          onCreate={createConversation}
          onDelete={deleteConversation}
          onRename={renameConversation}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          onAccount={() => navigate('/account')}
          onLibrary={() => navigate({ pathname: '/library', search: selectedConv ? `?id=${selectedConv.id}` : location.search })}
        />

  {/* Right-side content area router: show ProfilePage when on /account, otherwise chat */}
  {location.pathname.startsWith('/account') ? (
          // Account: hide chat completely
          <ProfilePage />
        ) : location.pathname.startsWith('/library') ? (
          // Library: show page and a minimized floating chat
          <>
            <LibraryPage />
            {/* Separate bubble appears only when chat is minimized (and floating visible) */}
      {showFloatingChat && chatMinimized && (
              <FloatingChatBubble
                pos={bubblePos}
                setPos={setBubblePos}
                onRestore={() => setChatMinimized(false)}
              />
            )}
            {showFloatingChat && !chatMinimized && (
              <ChatPane
                floatingDefault={true}
                enableFloatingToggle={true}
                hideHeaderWhenDocked={false}
                title={selectedConv ? `Chat • ${selectedConv.title ?? selectedConv.id}` : 'Chat'}
                initialSize={{ w: 420, h: 340 }}
        initialPos={{ x: Math.max(16, window.innerWidth - 460), y: 80 }}
                minimized={false}
                onRequestMinimize={() => setChatMinimized(true)}
                onRequestRestore={() => setChatMinimized(false)}
                onRequestDock={() => {
                  const id = selectedConv?.id ?? (searchParams.get('id') ?? 'new');
                  setShowFloatingChat(false);
                  setChatMinimized(false);
                  navigate({ pathname: '/', search: `?id=${id}` });
                }}
                onRequestClear={() => startNewFloatingConversation()}
              >
                <ChatArea
                  key={selectedConv?.id ?? 'new'}
                  messages={messages}
                  loading={loading}
                  handleSend={handleSend}
                />
              </ChatPane>
            )}
          </>
        ) : (
          // Default chat view: docked fullscreen chat, no floating toggle
          <ChatPane enableFloatingToggle={false} onRequestClear={() => startNewFloatingConversation()}>
            <ChatArea
              key={selectedConv?.id ?? 'new'}
              messages={messages}
              loading={loading}
              handleSend={handleSend}
            />
          </ChatPane>
        )}
      </div>
  );
};
export default App;

// Ensure floating chat is shown when navigating to /library (fix for missing bubble after docking)
// This runs outside the component body so it picks up location changes via history; keep minimal.
// NOTE: we intentionally call this here as a micro fix;
try {
  // noop - keep file-level safe for module hot reload
} catch {}
