export interface Conversation { id: number; title: string; created_at: string; }
export interface Message { id: number; conversation_id: number; sender: string; text: string; created_at: string; metadata?: string; }
