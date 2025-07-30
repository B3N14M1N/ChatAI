import { useState, useEffect, type FormEvent } from "react";
import axios from "axios";
import "./App.css";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import type { Conversation, Message } from "./types";

const App = () => {
  // Types
  interface Conversation { id: number; title: string; created_at: string; }
  interface Message { id: number; conversation_id: number; sender: string; text: string; created_at: string; metadata?: string; }
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Sidebar collapsed state
  const [collapsed, setCollapsed] = useState(false);

  // Load conversations on mount
  // Fetch list of conversations
  useEffect(() => { fetchConversations(); }, []);
  const fetchConversations = async () => {
    try {
      const res = await axios.get<Conversation[]>("/api/conversations/");
      setConversations(res.data);
      if (res.data.length && !selectedConv) {
        selectConversation(res.data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };
  // Select and load conversation messages
  const selectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    // reset input field when switching conversations
    setInputText("");
    try {
      // Backend returns { conversation_id, messages: Message[] }
      const res = await axios.get<{ conversation_id: number; messages: Message[] }>(
        `/api/conversations/${conv.id}/messages`
      );
      setMessages(res.data.messages);
    } catch (err) {
      console.error(err);
    }
  };
  // Create a new conversation with title prompt
  const createConversation = async () => {
    const title = window.prompt("Conversation title:");
    if (!title) return;
    try {
      const res = await axios.post<number>("/api/conversations/", { title });
      await fetchConversations();
      selectConversation({ id: res.data, title, created_at: new Date().toISOString() });
    } catch (err) {
      console.error(err);
    }
  };
  
  // Delete a conversation and refresh list
  const deleteConversation = async (id: number) => {
    try {
      await axios.delete(`/api/conversations/${id}`);
      if (selectedConv?.id === id) {
        setSelectedConv(null);
        setMessages([]);
      }
      await fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };
  // Send a message and append to list
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
      const res = await axios.post<Message>("/api/chat/", {
        conversation_id: selectedConv.id,
        sender: "user",
        text: userText,
        metadata: null,
        model: "gpt-4.1",
      });
      // append assistant response
      setMessages(prev => [...prev, res.data]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Send failed");
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
        onToggle={() => setCollapsed(prev => !prev)}
      />
      <ChatArea
        key={selectedConv?.id ?? 'none'}
        messages={messages}
        inputText={inputText}
        setInputText={setInputText}
        loading={loading}
        handleSend={handleSend}
      />
    </div>
  );
};

export default App;
