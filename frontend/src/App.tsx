import React, { useState, useEffect, type FormEvent } from "react";
import axios from "axios";
import "./App.css";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import type { Conversation, Message } from "./types";
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

const App: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const collapsed = searchParams.get('collapsed') === 'true';
  const toggleCollapsed = () => {
    const next = (!collapsed).toString();
    setSearchParams({ ...Object.fromEntries(searchParams), collapsed: next });
  };

  // State variables for conversations, messages, and UI
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Load conversations and select based on URL or default
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await axios.get<Conversation[]>('/api/conversations/');
        setConversations(res.data);
        if (params.id) {
          const convId = parseInt(params.id, 10);
          const conv = res.data.find(c => c.id === convId);
          if (conv) {
            selectConversation(conv);
            return;
          }
        }
        // no valid URL param, select first
        if (res.data.length) {
          const first = res.data[0];
          navigate(`/conversation/${first.id}${collapsed ? '?collapsed=true' : ''}`, { replace: true });
          selectConversation(first);
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadConversations();
  }, [params.id, collapsed]);

  // Load messages for a conversation
  const selectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    setInputText("");
    try {
      const res = await axios.get<{ conversation_id: number; messages: Message[] }>(
        `/api/conversations/${conv.id}/messages`
      );
      setMessages(res.data.messages);
    } catch (err) {
      console.error(err);
    }
  };

  // Create and navigate to new conversation
  const createConversation = async () => {
    const title = window.prompt('Conversation title:');
    if (!title) return;
    try {
      const res = await axios.post<number>('/api/conversations/', { title });
      const newId = res.data;
      // refresh and navigate
      const listRes = await axios.get<Conversation[]>('/api/conversations/');
      setConversations(listRes.data);
      navigate(`/conversation/${newId}${collapsed ? '?collapsed=true' : ''}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete conversation and adjust URL
  const deleteConversation = async (id: number) => {
    try {
      await axios.delete(`/api/conversations/${id}`);
      if (selectedConv?.id === id) {
        setSelectedConv(null);
        setMessages([]);
      }
      const listRes = await axios.get<Conversation[]>('/api/conversations/');
      setConversations(listRes.data);
      // navigate to first or root
      if (selectedConv?.id === id && listRes.data.length) {
        navigate(`/conversation/${listRes.data[0].id}${collapsed ? '?collapsed=true' : ''}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send a chat message
  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConv) return;
    // Optimistic UI: display user message immediately
    const userText = inputText;
    const userMsg: Message = {
      id: Date.now(),
      conversation_id: selectedConv.id,
      sender: "user",
      text: userText,
      created_at: new Date().toISOString(),
      metadata: 'pending',
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
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
        onSelect={conv => navigate(`/conversation/${conv.id}${collapsed ? '?collapsed=true' : ''}`)}
        onCreate={createConversation}
        onDelete={deleteConversation}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
      />
      {selectedConv && (
        <ChatArea
          key={selectedConv.id}
          messages={messages}
          inputText={inputText}
          setInputText={setInputText}
          loading={loading}
          handleSend={handleSend}
        />
      )}
    </div>
  );
};
export default App;
