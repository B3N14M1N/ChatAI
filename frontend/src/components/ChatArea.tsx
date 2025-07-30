import { useState, useEffect, useRef } from "react";
import type { FC, FormEvent } from "react";
import type { Message } from "../types";
import ChatInput from './ChatInput';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ChatArea.css';

interface ChatAreaProps {
  messages: Message[];
  inputText: string;
  setInputText: (text: string) => void;
  loading: boolean;
  handleSend: (e: FormEvent<HTMLFormElement>) => Promise<void>;
}

const ChatArea: FC<ChatAreaProps> = ({ messages, inputText, setInputText, loading, handleSend }) => {
  // Height reserved by input component for message padding
  const [inputHeight, setInputHeight] = useState<number>(80);
  // Ref to messages container for auto-scroll
  const messagesRef = useRef<HTMLDivElement>(null);
  // Scroll to bottom on messages change
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);
  return (
    <section className="chat-area">
      {/* Messages container with bottom padding for input */}
      <div
        className="messages"
        ref={messagesRef}
        style={{ paddingBottom: `${inputHeight + 16}px` }}
      >
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="timestamp">
              {msg.metadata === 'pending'
                ? 'now'
                : new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            </div>
            <div className="bubble">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>  
                {msg.text}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
      {/* Input component handles divider and form */}
      <ChatInput
        inputText={inputText}
        setInputText={setInputText}
        loading={loading}
        handleSend={handleSend}
        onHeightChange={setInputHeight}
      />
    </section>
  );
};

export default ChatArea;
