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
    const trimmed = inputText.trim();
    // If only attachments and no text, send a placeholder listing files
    const hasFiles = attachments.length > 0;
    const text = trimmed || (hasFiles ? `[Files attached: ${attachments.map(f => f.name).join(', ')}]` : '');
    if (!text || loading) return;
    await handleSend(text, selectedModel, attachments);
    // reset input and attachments
    setInputText('');
    setAttachments([]);
    // Clear file input to allow re-adding
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      // Reset input value so the same file can be reselected
      e.target.value = '';
    }
  };
  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // If no attachments remain, clear the file input
      if (updated.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return updated;
    });
  };
  return (
    <form className="input-container" onSubmit={onSubmit}>
      {/* Attachments preview */}
      {attachments.length > 0 && (() => {
        const nameCounts: Record<string, number> = {};
        return (
          <div className="attachments">
            {attachments.map((file, idx) => {
              nameCounts[file.name] = (nameCounts[file.name] || 0) + 1;
              const displayName = nameCounts[file.name] > 1
                ? `${file.name} (${nameCounts[file.name]})`
                : file.name;
              return (
                <div key={idx} className="attachment-item">
                  <span>{displayName}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="remove-attach-btn"
                  >
                    <FaTimes />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })()}
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
