import type { FC } from "react";
import type { Conversation } from "../types";
import { FaTrash } from 'react-icons/fa';
import "./ConversationItem.css";

interface ConversationItemProps {
  conv: Conversation;
  selected: boolean;
  onSelect: (conv: Conversation) => void;
  onDelete: (id: number) => void;
}

const ConversationItem: FC<ConversationItemProps> = ({ conv, selected, onSelect, onDelete }) => (
  <li
    className={`conversation-item${selected ? ' selected' : ''}`}
    onClick={() => onSelect(conv)}
  >
    <span className="conv-title">{conv.title}</span>
    <button
      className="delete-conv-btn"
      onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
      aria-label="Delete conversation"
    >
      <FaTrash />
    </button>
  </li>
);

export default ConversationItem;
