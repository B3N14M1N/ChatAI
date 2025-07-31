import { useRef, useState, useEffect, type FormEvent } from "react";
import { FaPaperPlane, FaPaperclip, FaTimes } from 'react-icons/fa';
import type { FC } from "react";
import './ChatInput.css';

interface ChatInputProps {
  loading: boolean;
  // handleSend accepts the current text and sends it
  handleSend: (text: string, model: string, files?: File[]) => Promise<void>;
  onHeightChange: (height: number) => void;
  minHeight?: number;
}

const ChatInput: FC<ChatInputProps> = ({ loading, handleSend, onHeightChange, minHeight = 80 }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  // Fetch available models on mount
  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        const list = Object.keys(data);
        setModels(list);
        if (list.length) setSelectedModel(list[0]);
      })
      .catch(console.error);
  }, []);

  // helper for sending current text
  const sendText = async () => {
    const text = inputText.trim();
    if (!text || loading) return;
    await handleSend(text, selectedModel, attachments);
    // reset input and attachments
    setInputText('');
    setAttachments([]);
  };
  // submit via form
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void sendText();
  };
  // handle file selection
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  return (
    <form className="input-container" onSubmit={onSubmit}>
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="attachments">
          {attachments.map((file, idx) => (
            <div key={idx} className="attachment-item">
              <span>{file.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="remove-attach-btn"
              >
                <FaTimes />
              </button>
            </div>
          ))}
        </div>
      )}
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
      {/* Footer with attachment, model select and send */}
      <div className="input-footer">
        <div className="left-controls">
          <button
            type="button"
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach files"
          >
            <FaPaperclip />
          </button>
          <select
            className="model-select"
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            disabled={loading || models.length === 0}
          >
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="send-btn"
          disabled={loading || !inputText.trim()}
          aria-label="Send message"
        >
          <FaPaperPlane size={20} />
        </button>
        <input
          type="file"
          multiple
          hidden
          ref={fileInputRef}
          accept=".txt,.md,.csv,.pdf,.docx"
          onChange={onFileChange}
        />
      </div>
    </form>
  );
};

export default ChatInput;
