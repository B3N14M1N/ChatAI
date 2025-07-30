import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import type { Conversation, Message } from "./types";
import { useSearchParams } from 'react-router-dom';

const App: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const idParam = searchParams.get('id');
  const collapsed = searchParams.get('collapsed') === 'true';
  const toggleCollapsed = () => {
    setSearchParams({
      id: idParam ?? '',
      collapsed: (!collapsed).toString(),
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
      const res = await axios.get<{ conversation_id: number; messages: Message[] }>(
        `/api/conversations/${conv.id}/messages`
      );
      setMessages(res.data.messages);
    } catch (err) {
      console.error(err);
    }
  }

  // Load conversations on mount
  useEffect(() => {
    const loadConvos = async () => {
      try {
        const res = await axios.get<Conversation[]>('/api/conversations/');
        setConversations(res.data);
      } catch (error) {
        console.error(error);
      }
    };
    loadConvos();
  }, []);
  // Sync selection when conv list or idParam changes
  useEffect(() => {
    if (conversations.length === 0) return;
    const targetId = idParam ? parseInt(idParam, 10) : conversations[0].id;
    const conv = conversations.find(c => c.id === targetId) || conversations[0];
    // ensure URL has id
    if (conv.id.toString() !== idParam) {
      setSearchParams({ id: conv.id.toString(), collapsed: collapsed.toString() }, { replace: true });
    }
    selectConversation(conv);
  }, [conversations, idParam, collapsed]);

  // Create a new conversation
  const createConversation = async () => {
    const title = window.prompt('Conversation title:');
    if (!title) return;
    try {
      const res = await axios.post<number>('/api/conversations/', { title });
      const newId = res.data;
      // refresh and navigate
      const listRes = await axios.get<Conversation[]>('/api/conversations/');
      setConversations(listRes.data);
      setSearchParams({ id: newId.toString(), collapsed: collapsed.toString() });
    } catch (err) {
      console.error(err);
    }
  };

  // Delete a conversation
  const deleteConversation = async (id: number) => {
    try {
      await axios.delete(`/api/conversations/${id}`);
      if (selectedConv?.id === id) {
        setSelectedConv(null);
        setMessages([]);
      }
      const listRes = await axios.get<Conversation[]>('/api/conversations/');
      setConversations(listRes.data);
      // switch to first
      if (selectedConv?.id === id && listRes.data.length) {
        const firstId = listRes.data[0].id.toString();
        setSearchParams({ id: firstId, collapsed: collapsed.toString() });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send a chat message
  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !selectedConv) return;
    // Optimistic UI: display user message immediately
    const userText = trimmed;
    const userMsg: Message = {
      id: Date.now(),
      conversation_id: selectedConv.id,
      sender: "user",
      text: userText,
      created_at: new Date().toISOString(),
      metadata: 'pending',
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await axios.post<Message>('/api/chat/', {
        conversation_id: selectedConv!.id,
        sender: 'user',
        text: userText,
        metadata: null,
        model: 'gpt-4.1',
      });
      setMessages(prev => [...prev, res.data]);
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
        onSelect={conv => setSearchParams({ id: conv.id.toString(), collapsed: collapsed.toString() })}
        onCreate={createConversation}
        onDelete={deleteConversation}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
      />
      {selectedConv && (
        <ChatArea
          key={selectedConv.id}
          messages={messages}
          loading={loading}
          handleSend={handleSend}
        />
      )}
    </div>
  );
};
export default App;
