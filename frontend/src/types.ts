export interface Conversation { 
  id: number; 
  title: string; 
  summary?: string;
  created_at: string; 
}

export interface UsageMetrics {
  input_tokens?: number;
  output_tokens?: number;
  cached_tokens?: number;
  model?: string;
  price?: number;
}

export interface Attachment {
  id: number;
  message_id: number;
  filename: string;
  content_type: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  request_id?: number | null; // null for user messages, set for assistant responses
  text?: string;
  summary?: string;
  created_at: string;
  // Usage metrics (flattened for compatibility)
  input_tokens?: number;
  output_tokens?: number;
  cached_tokens?: number;
  model?: string;
  price?: number;
  // Attached files
  attachments?: Attachment[];
  
  // Computed properties that match our Pydantic schema
  sender?: "user" | "assistant"; // This will be computed from request_id
  display_text?: string; // This will be computed from summary/text
}

// Helper function to determine sender from message
export function getSender(message: Message): "user" | "assistant" {
  return message.request_id == null || message.request_id === undefined ? "user" : "assistant";
}

// Helper function to get display text from message
export function getDisplayText(message: Message): string {
  // Always prefer the full text over summary for display
  return message.text || message.summary || "";
}
