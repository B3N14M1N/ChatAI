export interface Conversation { id: number; title: string; created_at: string; }
export interface Message {
  id: number;
  conversation_id: number;
  sender: string;
  text: string;
  created_at: string;
  metadata?: string;
  // Usage metrics
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  model?: string;
  price?: number;
  // Attached files
  attachments?: Array<{
    id: number;
    filename: string;
    content_type?: string;
  }>;
}
