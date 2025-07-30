import React, { useRef, useState, useEffect } from "react";
import { FaPaperPlane } from 'react-icons/fa';
import type { FC, FormEvent } from "react";

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  loading: boolean;
  handleSend: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onHeightChange: (height: number) => void;
  minHeight?: number;
}

const ChatInput: FC<ChatInputProps> = ({
  inputText,
  setInputText,
  loading,
  handleSend,
  onHeightChange,
  minHeight = 80
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputHeight, setLocalHeight] = useState<number>(minHeight);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    startYRef.current = e.clientY;
    startHeightRef.current = inputHeight;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const dy = startYRef.current - e.clientY;
    const newH = Math.min(
      Math.max(startHeightRef.current + dy, minHeight),
      window.innerHeight / 2
    );
    setLocalHeight(newH);
    onHeightChange(newH);
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (textareaRef.current) {
      // temporarily reset height to measure content
      textareaRef.current.style.height = 'auto';
      const contentH = textareaRef.current.scrollHeight;
      const clamped = Math.min(
        Math.max(contentH, minHeight),
        window.innerHeight / 2
      );
      const finalH = Math.max(inputHeight, clamped);
      setLocalHeight(finalH);
      onHeightChange(finalH);
      // remove inline height so textarea CSS (height:100%) fills container
      textareaRef.current.style.height = '';
    }
  }, [inputText]);

  return (
    <>
      <div
        className="divider"
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          bottom: `${inputHeight}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '75%',
          height: '4px',
          cursor: 'ns-resize',
          zIndex: 2
        }}
      />
      <form
        className="input-area"
        onSubmit={handleSend}
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '75%',
          height: `${inputHeight}px`,
          display: 'flex',
          alignItems: 'stretch',
          zIndex: 1
        }}
      >
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
          style={{
            flex: 1,
            height: '100%',
            boxSizing: 'border-box',
            padding: '0.5rem',
            resize: 'none',
            overflowY: 'auto',
            marginRight: '60px'
          }}
        />
        <button
          type="submit"
          className="btn btn-primary send-btn"
          disabled={loading || !inputText.trim()}
          aria-label="Send message"
        >
          <FaPaperPlane size={32} />
        </button>
      </form>
    </>
  );
};

export default ChatInput;
