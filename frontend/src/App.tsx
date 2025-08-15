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
  // Sync selection or new-chat when idParam changes
  useEffect(() => {
    if (conversations.length === 0) return;
    // if no idParam, redirect to new conversation
    if (!searchParams.has('id')) {
      setSearchParams({ id: 'new', collapsed: collapsed.toString() }, { replace: true });
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
      setSearchParams({ id: conv.id.toString(), collapsed: collapsed.toString() }, { replace: true });
    }
    selectConversation(conv);
  }, [conversations, idParam, collapsed]);

  // Start a blank chat, will create on first message
  const createConversation = () => {
    setSearchParams({ id: 'new', collapsed: collapsed.toString() });
  };

  // Rename a conversation
  const renameConversation = async (id: number, newTitle: string) => {
    try {
      await axios.put(`/api/conversations/${id}/rename`, null, { params: { new_title: newTitle } });
      const listRes = await axios.get<Conversation[]>('/api/conversations/');
      setConversations(listRes.data);
      // if renaming current, update selectedConv
      if (selectedConv?.id === id) {
        const updated = listRes.data.find(c => c.id === id) || null;
        setSelectedConv(updated);
      }
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
      const res = await axios.post<{
        conversation_id: number;
        request_message_id: number;
        response_message_id: number;
        answer: string;
      }>('/api/chat/', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // On first message, select the new conversation
      let convId = selectedConv?.id || res.data.conversation_id;
      if (!selectedConv) {
        const listRes = await axios.get<Conversation[]>('/api/conversations/');
        setConversations(listRes.data);
        const newConv = listRes.data.find(c => c.id === res.data.conversation_id);
        if (newConv) {
          setSelectedConv(newConv);
          setSearchParams({ id: newConv.id.toString(), collapsed: collapsed.toString() });
          convId = newConv.id;
        }
      }
      // Reload full conversation messages to include attachments
      if (convId != null) {
        const msgsRes = await axios.get<{ conversation_id: number; messages: Message[] }>(
          `/api/conversations/${convId}/messages`
        );
        setMessages(msgsRes.data.messages);
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
          onSelect={conv => setSearchParams({ id: conv.id.toString(), collapsed: collapsed.toString() })}
          onCreate={createConversation}
          onDelete={deleteConversation}
          onRename={renameConversation}
          collapsed={collapsed}
          onToggle={toggleCollapsed}
        />
        <ChatArea
          key={selectedConv?.id ?? 'new'}
          messages={messages}
          loading={loading}
          handleSend={handleSend}
        />
      </div>
  );
};
export default App;
