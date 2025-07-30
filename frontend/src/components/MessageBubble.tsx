import type { FC } from "react";
import type { Message } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./MessageBubble.css";

interface MessageBubbleProps {
  msg: Message;
}

const MessageBubble: FC<MessageBubbleProps> = ({ msg }) => {
  // Display timestamp above for assistant, below for user
  const timeLabel = msg.metadata === "pending"
    ? "now"
    : new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`message ${msg.sender}`}>
      {/* User timestamp above */}
      {msg.sender === "user" && (
        <div className="timestamp">{timeLabel}</div>
      )}
      <div className="bubble">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>  
          {msg.text}
        </ReactMarkdown>
      </div>
      {/* Assistant timestamp below */}
      {msg.sender === "assistant" && (
        <div className="timestamp">{timeLabel}</div>
      )}
    </div>
  );
};

export default MessageBubble;
