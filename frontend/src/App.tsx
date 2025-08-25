import React, { useState, useEffect } from "react";
import { apiFetch, fetchJson } from "./lib/api";
import "./App.css";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import ChatPane from "./components/ChatPane.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
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
  }, [conversations, idParam, collapsed]);

  // Start a blank chat, will create on first message
  const createConversation = () => {
    navigate({ pathname: '/', search: '?id=new' });
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
        />

  {/* Right-side content area router: show ProfilePage when on /account, otherwise chat */}
  {location.pathname.startsWith('/account') ? (
          <ProfilePage />
        ) : (
          <ChatPane enableFloatingToggle={false}>
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
