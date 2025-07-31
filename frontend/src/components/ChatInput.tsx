import { useRef, useState, useEffect, type FormEvent } from "react";
import { FaPaperPlane } from 'react-icons/fa';
import type { FC } from "react";
import './ChatInput.css';

interface ChatInputProps {
  loading: boolean;
  // handleSend accepts the current text and sends it
  handleSend: (text: string) => Promise<void>;
  onHeightChange: (height: number) => void;
  minHeight?: number;
}

const ChatInput: FC<ChatInputProps> = ({ loading, handleSend, onHeightChange, minHeight = 80 }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputText, setInputText] = useState<string>('');
  const [inputHeight, setLocalHeight] = useState<number>(minHeight);
  const heightTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!textareaRef.current) return;
    // reset height to measure content
    textareaRef.current.style.height = 'auto';
    const contentHeight = textareaRef.current.scrollHeight;
    const maxHeight = window.innerHeight / 3;
    const newHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));
    setLocalHeight(newHeight);
    // Debounce height callback to parent
    if (heightTimeout.current) {
      clearTimeout(heightTimeout.current);
    }
    heightTimeout.current = window.setTimeout(() => onHeightChange(newHeight), 100);
    textareaRef.current.style.height = `${newHeight}px`;
  }, [inputText, minHeight, onHeightChange]);

  // helper for sending current text
  const sendText = async () => {
    const text = inputText.trim();
    if (!text || loading) return;
    await handleSend(text);
    setInputText('');
  };
  // submit via form
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void sendText();
  };
  return (
    <form className="input-container" onSubmit={onSubmit}>
      <div className="input-tools">{/* future attachments */}</div>
      <textarea
        ref={textareaRef}
        className="chat-textarea"
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        placeholder="Type your message..."
        disabled={loading}
        style={{ height: `${inputHeight}px` }}
        onKeyDown={e => {
          // on desktop, Enter sends message; Shift+Enter newline
          if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
            e.preventDefault();
            void sendText();
          }
        }}
      />
      <button
        type="submit"
        className="send-btn"
        disabled={loading || !inputText.trim()}
        aria-label="Send message"
      >
        <FaPaperPlane size={32} />
      </button>
    </form>
  );
};

export default ChatInput;
