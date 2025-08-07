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
      {/* Timestamp above (user only) */}
      {msg.sender === "user" && (
        <div className="timestamp">{timeLabel}</div>
      )}
      <div className="bubble">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {msg.text}
        </ReactMarkdown>
        {/* Render user attachments in footer */}
        {msg.attachments && msg.attachments.length > 0 && msg.sender === 'user' && (
          <div className="bubble-footer attachments-footer">
            {(() => {
              const nameCounts: Record<string, number> = {};
              return msg.attachments.map(att => {
                nameCounts[att.filename] = (nameCounts[att.filename] || 0) + 1;
                const displayName = nameCounts[att.filename] > 1
                  ? `${att.filename} (${nameCounts[att.filename]})`
                  : att.filename;
                return (
                  <a
                    key={att.id}
                    href={`/api/attachments/${att.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="attachment-link"
                  >
                    {displayName}
                  </a>
                );
              });
            })()}
          </div>
        )}
        {msg.sender === "assistant" && (
          <div className="bubble-footer">
            <div className="metrics">
              {msg.total_tokens != null && <span>Tokens: {msg.total_tokens}</span>}
              {msg.price != null && <span>Price: ${msg.price.toFixed(6)}</span>}
              {msg.model && <span>Model: {msg.model}</span>}
            </div>
          </div>
        )}
      </div>
      {/* Timestamp below (assistant only) */}
      {msg.sender === "assistant" && (
        <div className="timestamp">{timeLabel}</div>
      )}
    </div>
  );
};

export default MessageBubble;
