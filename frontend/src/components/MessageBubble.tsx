import type { FC } from "react";
import type { Message } from "../types";
import { getSender, getDisplayText } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MetricsDisplay from "./MetricsDisplay";
import "./MessageBubble.css";
import { useNavigate, useSearchParams } from "react-router-dom";

interface MessageBubbleProps {
  msg: Message;
}

const MessageBubble: FC<MessageBubbleProps> = ({ msg }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children, ...props }) => {
              const h = href || "";
              if (h.startsWith("/library?")) {
                const url = new URL(h, window.location.origin);
                const title = url.searchParams.get("select") || "";
                return (
                  <a
                    {...props}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      // Preserve chat id in query if present
                      const currentId = searchParams.get("id");
                      const qs = new URLSearchParams();
                      if (currentId) qs.set("id", currentId);
                      qs.set("select", title);
                      navigate({ pathname: "/library", search: `?${qs.toString()}` });
                    }}
                  >
                    {children}
                  </a>
                );
              }
              // default link
              return <a href={h} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
            },
          }}
        >
          {displayText}
        </ReactMarkdown>
        {/* Subtle system note for ignored user messages */}
        {ignored && sender === 'user' && (
          <div className="bubble-footer system-note">
            This message was removed by the system
          </div>
        )}
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
