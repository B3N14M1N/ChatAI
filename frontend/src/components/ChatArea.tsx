import { useState, useEffect, useRef } from "react";
import type { FC, FormEvent } from "react";
import type { Message } from "../types";
import ChatInput from './ChatInput';
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
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);
  return (
    <section className="chat-area">
      {/* Messages container with bottom padding for input */}
      <div
        className="messages"
        ref={messagesRef}
        style={{ paddingBottom: `${inputHeight}px` }}
      >
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="timestamp">
              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="bubble">{msg.text}</div>
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
