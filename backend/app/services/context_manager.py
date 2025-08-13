from typing import List, Optional
from openai import OpenAI

from app.models.schemas import MessageIntent, ContextStrategy, MessageOut
from app.services.chat_utils import generate_message_summary

client = OpenAI()


async def classify_intent(message: str, conversation_id: int) -> MessageIntent:
    """Classify the user's intent to determine context needs.
    
    Uses AI classification with recent conversation context for accurate intent detection
    across multiple languages.
    """
    
    # Always use AI classification with context for accuracy and language support
    return await _ai_classify_intent_with_context(message, conversation_id)


async def _ai_classify_intent_with_context(message: str, conversation_id: int) -> MessageIntent:
    """Use OpenAI for complex intent classification with recent conversation context"""
    
    # Get recent context (last user and assistant message)
    try:
        from app.core.crud import get_last_user_message, get_last_assistant_message
        
        # Get last exchange for context
        last_user_msg = await get_last_user_message(conversation_id)
        last_assistant_msg = await get_last_assistant_message(conversation_id)
        
        context_info = ""
        if last_user_msg and last_assistant_msg:
            # Use summary if available, otherwise use text
            user_text = last_user_msg.summary or last_user_msg.text
            assistant_text = last_assistant_msg.summary or last_assistant_msg.text
            context_info = f"\nRecent conversation:\nUser: {user_text}\nAssistant: {assistant_text}\n"
        
        classification_prompt = f"""
        You are a multilingual intent classifier. Determine if this message needs previous conversation context to be understood properly.
        
        Categories:
        - needs_context: User references something from previous conversation (like "yes", "tell me more", "what about that book", "continue", etc.) OR asks follow-up questions
        - no_context: Standalone question or request that can be understood without previous conversation
        
        {context_info}
        Current message: "{message}"
        
        Guidelines:
        - Consider the language of the message (English, Spanish, French, etc.)
        - Short affirmative responses (yes/si/oui/ja, please/por favor/s'il vous plaît, tell me more, etc.) usually need context
        - References to "it", "that", "the book we discussed", etc. need context
        - New standalone questions about books, weather, etc. don't need context
        - If in doubt and there's recent conversation, lean towards needs_context
        
        Return only: needs_context OR no_context
        """
        
        response = client.responses.create(
            model="gpt-4o-mini",  # Fast, cheap model for classification
            input=classification_prompt,
            max_output_tokens=20
        )
        
        intent_str = response.output_text.strip().lower()
        print(f"AI Classification with context - Input: '{message}', Context: {bool(context_info)}, Result: '{intent_str}'")
        
        # Map to enum
        intent_mapping = {
            "needs_context": MessageIntent.NEEDS_CONTEXT,
            "no_context": MessageIntent.NO_CONTEXT,
        }
        
        return intent_mapping.get(intent_str, MessageIntent.NEEDS_CONTEXT)
        
    except Exception as e:
        print(f"Error in AI intent classification with context: {e}")
        # Fallback to needs_context for safety
        return MessageIntent.NEEDS_CONTEXT


def determine_context_strategy(intent: MessageIntent, conversation_length: int = 0) -> ContextStrategy:
    """Determine how much context to include based on intent"""
    
    # Simple mapping: either include context or don't
    if intent == MessageIntent.NEEDS_CONTEXT:
        return ContextStrategy.RECENT
    else:
        return ContextStrategy.NONE


async def get_contextual_messages(
    conversation_id: int, 
    strategy: ContextStrategy
) -> str:
    """Get the appropriate amount of context based on strategy."""
    
    if strategy == ContextStrategy.NONE:
        return ""
    
    # For RECENT strategy, get last few messages using db summary method
    from app.core.db import db_handler
    message_summaries = await db_handler.get_conversation_summary(conversation_id)
    
    if not message_summaries:
        return ""
    
    context = _format_summaries_for_context(message_summaries)
    return f"Recent conversation:\n{context}\n\n"


def _format_summaries_for_context(messages) -> str:
    """Format message summaries for context inclusion.
    
    Works with MessageSummary objects from get_conversation_summary.
    """
    return "\n".join([
        f"{'User' if msg.sender.value == 'user' else 'Assistant'}: {msg.text}"
        for msg in messages
    ])


async def smart_context_handler(
    message: str,
    conversation_id: int
) -> tuple[str, MessageIntent, ContextStrategy]:
    """
    Main entry point for smart context management.
    
    Returns:
        tuple: (context_string, detected_intent, strategy_used)
    """
    
    # Get conversation length for strategy determination using db method
    from app.core.db import db_handler
    message_summaries = await db_handler.get_conversation_summary(conversation_id)
    conversation_length = len(message_summaries)
    
    # Classify intent with conversation context
    intent = await classify_intent(message, conversation_id)
    
    # Determine strategy
    strategy = determine_context_strategy(intent, conversation_length)
    
    # Get appropriate context
    context = await get_contextual_messages(conversation_id, strategy)
    
    return context, intent, strategy
