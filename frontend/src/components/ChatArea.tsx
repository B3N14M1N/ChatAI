import { useState } from "react";
import type { FC, FormEvent } from "react";
import type { Message } from "../types";
import ChatInput from './ChatInput';

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
  return (
    <section className="chat-area" style={{ position: 'relative', height: '100%' }}>
      {/* Messages container with bottom padding for input */}
      <div
        className="messages"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          paddingBottom: `${inputHeight}px`, overflowY: 'auto'
        }}
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
