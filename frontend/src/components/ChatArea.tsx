import { useState, useEffect, useRef, type FC } from "react";
import type { Message } from "../types";
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import './ChatArea.css';

interface ChatAreaProps {
  messages: Message[];
  loading: boolean;
  // now supports model selection
  handleSend: (text: string, model: string) => Promise<void>;
}

const ChatArea: FC<ChatAreaProps> = ({ messages, loading, handleSend }) => {
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
        style={{ paddingBottom: `${inputHeight + 100}px` }}
      >
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {/* Show thinking bubble when loading */}
        {loading && (
          <div className="message assistant">
            <div className="bubble thinking-bubble">
              <div className="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Input component handles divider and form */}
      <ChatInput
        loading={loading}
        handleSend={handleSend}
        onHeightChange={setInputHeight}
      />
    </section>
  );
};

export default ChatArea;
