from typing import List, Optional
from openai import OpenAI

from app.models.schemas import MessageIntent, ContextStrategy, MessageOut
from app.core.crud import get_messages_for_conversation
from app.services.chat_utils import generate_message_summary

client = OpenAI()


async def classify_intent(message: str) -> MessageIntent:
    """Classify the user's intent to determine context needs"""
    
    # Quick keyword-based classification for common cases
    message_lower = message.lower()
    
    # Book-related keywords
    book_keywords = ["recommend", "suggestion", "book", "author", "genre", "read", "novel", "fiction"]
    summary_keywords = ["summary", "summarize", "about", "plot", "what is"]
    
    # Context-dependent keywords
    context_keywords = ["it", "that", "we discussed", "you said", "earlier", "before", "previous", 
                       "what did", "continue", "follow up", "also", "additionally"]
    
    # New topic keywords
    new_topic_keywords = ["let's talk about", "change topic", "new question", "different subject"]
    
    if any(keyword in message_lower for keyword in new_topic_keywords):
        return MessageIntent.NEW_TOPIC
    
    if any(keyword in message_lower for keyword in context_keywords):
        return MessageIntent.CONTEXT_DEPENDENT
    
    if any(keyword in message_lower for keyword in book_keywords):
        if any(keyword in message_lower for keyword in summary_keywords):
            return MessageIntent.BOOK_SUMMARY
        else:
            return MessageIntent.BOOK_RECOMMENDATION
    
    # For ambiguous cases, use OpenAI classification
    if len(message) > 100 or any(word in message_lower for word in ["help", "explain", "what", "how"]):
        return await _ai_classify_intent(message)
    
    # Default to general chat for simple messages
    return MessageIntent.GENERAL_CHAT


async def _ai_classify_intent(message: str) -> MessageIntent:
    """Use OpenAI for complex intent classification"""
    
    classification_prompt = f"""
    Classify this message into one of these categories:
    - book_recommendation: User wants book suggestions
    - book_summary: User wants summaries of specific books
    - general_chat: Standalone question/chat (no previous context needed)
    - context_dependent: References previous conversation
    - new_topic: Starting a completely new discussion
    
    Message: "{message}"
    
    Return only the category name.
    """
    
    try:
        response = client.responses.create(
            model="gpt-4o-mini",  # Fast, cheap model for classification
            input=classification_prompt,
            max_tokens=20
        )
        
        intent_str = response.output_text.strip().lower()
        
        # Map to enum
        intent_mapping = {
            "book_recommendation": MessageIntent.BOOK_RECOMMENDATION,
            "book_summary": MessageIntent.BOOK_SUMMARY,
            "general_chat": MessageIntent.GENERAL_CHAT,
            "context_dependent": MessageIntent.CONTEXT_DEPENDENT,
            "new_topic": MessageIntent.NEW_TOPIC
        }
        
        return intent_mapping.get(intent_str, MessageIntent.CONTEXT_DEPENDENT)
        
    except Exception as e:
        print(f"Error in AI intent classification: {e}")
        # Fallback to context-dependent for safety
        return MessageIntent.CONTEXT_DEPENDENT


def determine_context_strategy(intent: MessageIntent, conversation_length: int = 0) -> ContextStrategy:
    """Determine how much context to include based on intent and conversation length"""
    
    strategy_map = {
        MessageIntent.BOOK_RECOMMENDATION: ContextStrategy.NONE,
        MessageIntent.BOOK_SUMMARY: ContextStrategy.NONE,
        MessageIntent.GENERAL_CHAT: ContextStrategy.NONE,
        MessageIntent.NEW_TOPIC: ContextStrategy.NONE,
        MessageIntent.CONTEXT_DEPENDENT: ContextStrategy.RECENT
    }
    
    base_strategy = strategy_map[intent]
    
    # Upgrade strategy for long conversations
    if base_strategy == ContextStrategy.RECENT and conversation_length > 20:
        return ContextStrategy.SUMMARY
    
    return base_strategy


async def get_contextual_messages(
    conversation_id: int, 
    strategy: ContextStrategy,
    current_message: str = ""
) -> str:
    """Get the appropriate amount of context based on strategy.
    
    Reuses existing CRUD functions to get messages.
    """
    
    if strategy == ContextStrategy.NONE:
        return ""
    
    # Reuse existing function to get all messages
    conversation_data = await get_messages_for_conversation(conversation_id)
    messages = conversation_data.messages
    
    if not messages:
        return ""
    
    if strategy == ContextStrategy.RECENT:
        # Last 6 messages (3 user + 3 assistant pairs max)
        recent_messages = messages[-6:] if len(messages) > 6 else messages
        context = _format_messages_for_context(recent_messages)
        return f"Recent conversation:\n{context}\n\n"
    
    elif strategy == ContextStrategy.SUMMARY:
        # Use existing summary functionality for long conversations
        if len(messages) > 15:
            # Get a few recent messages plus summary of older ones
            recent_messages = messages[-4:]  # Last 2 exchanges
            older_messages = messages[:-4]
            
            # Create summary of older messages
            older_context = _format_messages_for_context(older_messages)
            summary = await _summarize_conversation_context(older_context)
            
            recent_context = _format_messages_for_context(recent_messages)
            
            return f"Conversation summary: {summary}\n\nRecent messages:\n{recent_context}\n\n"
        else:
            # Fall back to recent for shorter conversations
            return await get_contextual_messages(conversation_id, ContextStrategy.RECENT, current_message)
    
    elif strategy == ContextStrategy.FULL:
        # Full context (existing behavior)
        context = _format_messages_for_context(messages)
        return f"Full conversation:\n{context}\n\n"
    
    return ""


def _format_messages_for_context(messages: List[MessageOut]) -> str:
    """Format messages for context inclusion.
    
    Reuses the display_text property from MessageOut schema.
    """
    return "\n".join([
        f"{'User' if msg.sender.value == 'user' else 'Assistant'}: {msg.display_text}"
        for msg in messages
    ])


async def _summarize_conversation_context(conversation_text: str) -> str:
    """Create a summary of conversation context.
    
    Reuses existing summarization approach from chat_utils.
    """
    
    if len(conversation_text) < 200:
        return conversation_text
    
    summary_prompt = f"""
    Summarize this conversation in 2-3 sentences, focusing on:
    - Main topics discussed
    - Any decisions or conclusions reached
    - Current context the user might be referring to
    
    Conversation:
    {conversation_text}
    """
    
    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            input=summary_prompt,
            max_output_tokens=100
        )
        
        return response.output_text.strip()
        
    except Exception as e:
        print(f"Error generating conversation summary: {e}")
        # Fallback to truncated original text
        return conversation_text[:300] + "..." if len(conversation_text) > 300 else conversation_text


async def smart_context_handler(
    message: str,
    conversation_id: int
) -> tuple[str, MessageIntent, ContextStrategy]:
    """
    Main entry point for smart context management.
    
    Returns:
        tuple: (context_string, detected_intent, strategy_used)
    """
    
    # Get conversation length for strategy determination
    conversation_data = await get_messages_for_conversation(conversation_id)
    conversation_length = len(conversation_data.messages)
    
    # Classify intent
    intent = await classify_intent(message)
    
    # Determine strategy
    strategy = determine_context_strategy(intent, conversation_length)
    
    # Get appropriate context
    context = await get_contextual_messages(conversation_id, strategy, message)
    
    return context, intent, strategy
