import React, { useState, useEffect, type FormEvent } from "react";
import axios from "axios";
import "./App.css";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import type { Conversation, Message } from "./types";

const App: React.FC = () => {
  // State variables for conversations, messages, and UI
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // Fetch conversations on component mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await axios.get<Conversation[]>('/api/conversations/');
        setConversations(res.data);
        if (res.data.length) selectConversation(res.data[0]);
      } catch (err) {
        console.error(err);
      }
    };
    loadConversations();
  }, []);

  // Select and load messages for a conversation
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

  // Create a new conversation and select it
  const createConversation = async () => {
    const title = window.prompt('Conversation title:');
    if (!title) return;
    try {
      const res = await axios.post<number>('/api/conversations/', { title });
      const newId = res.data;
      // refresh list
      const listRes = await axios.get<Conversation[]>('/api/conversations/');
      setConversations(listRes.data);
      const newConv = listRes.data.find(c => c.id === newId);
      if (newConv) selectConversation(newConv);
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
        onSelect={selectConversation}
        onCreate={createConversation}
        onDelete={deleteConversation}
        collapsed={collapsed}
        onToggle={() => setCollapsed(p => !p)}
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
