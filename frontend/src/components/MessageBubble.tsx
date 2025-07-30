import type { FC } from "react";
import type { Message } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./MessageBubble.css";

interface MessageBubbleProps {
  msg: Message;
}

const MessageBubble: FC<MessageBubbleProps> = ({ msg }) => {
  return (
    <div className={`message ${msg.sender}`}>
      <div className="timestamp">
        {msg.metadata === "pending"
          ? "now"
          : new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      </div>
      <div className="bubble">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>  
          {msg.text}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MessageBubble;
