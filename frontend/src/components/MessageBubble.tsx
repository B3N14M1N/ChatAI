import type { FC } from "react";
import type { Message } from "../types";
import { getSender, getDisplayText } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MetricsDisplay from "./MetricsDisplay";
import "./MessageBubble.css";

interface MessageBubbleProps {
  msg: Message;
}

const MessageBubble: FC<MessageBubbleProps> = ({ msg }) => {
  const sender = getSender(msg);
  const displayText = getDisplayText(msg);

  // Check if this is a pending message (optimistic UI)
  const isPending = msg.created_at === "pending" ||
    !msg.created_at ||
    (msg.id && msg.id > Date.now() - 5000); // Recent IDs are likely pending

  // Display timestamp above for assistant, below for user
  const timeLabel = isPending
    ? "now"
    : new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const ignored = msg.ignored === 1 || msg.ignored === (true as unknown as number);
  return (
    <div className={`message ${sender} ${ignored ? 'ignored' : ''}`}>
      {/* Timestamp above (user only) */}
      {sender === "user" && (
        <div className="timestamp">{timeLabel}</div>
      )}
  <div className="bubble">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {displayText}
        </ReactMarkdown>
        {/* Render user attachments in footer */}
        {msg.attachments && msg.attachments.length > 0 && sender === 'user' && (
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
        {sender === "assistant" && (
          <div className="bubble-footer">
            <MetricsDisplay message={msg} />
          </div>
        )}
      </div>
      {/* Timestamp below (assistant only) */}
      {sender === "assistant" && (
        <div className="timestamp">{timeLabel}</div>
      )}
    </div>
  );
};

export default MessageBubble;
