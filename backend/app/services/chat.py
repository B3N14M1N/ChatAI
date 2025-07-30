from typing import List, Optional
from openai import OpenAI
from app.core.schemas import MessageCreate, MessageOut, ConversationCreate
from app.core.crud import (
    get_conversation_context,
    get_last_message,
    add_message,
    create_conversation
)

client = OpenAI()

async def generate_conversation_title(
    prompt: str,
    model: str = "gpt-4.1"
) -> str:
    """
    Generate a concise title for the conversation based on the first user prompt.
    """
    # Use OpenAI to create a title
    title_prompt = f"Generate a short, descriptive title for the following conversation topic: {prompt}"
    resp = client.responses.create(
        model=model,
        tools=[],
        input=title_prompt
    )
    return resp.output_text.strip()

async def chat_call(
    prompt: str,
    conversation_id: int = None,
    model: str = "gpt-4.1",
    metadata: str = None
) -> MessageOut:
    # If new conversation, generate title and create record
    if conversation_id is None:
        # Title based on first prompt
        title = await generate_conversation_title(prompt, model)
        conversation_id = await create_conversation(ConversationCreate(title=title))
    # Get conversation context (all previous messages)
    context: str = await get_conversation_context(conversation_id)
    # Build full prompt including context
    full_prompt = f"{context}\nuser: {prompt}" if context else prompt

    # Call OpenAI API with selected model
    response = client.responses.create(
        model=model,
        tools=[{"type": "web_search_preview"}],
        input=full_prompt
    )
    ai_reply = response.output_text

    # Save user message
    await add_message(MessageCreate(
        conversation_id=conversation_id,
        sender="user",
        text=prompt,
        metadata=metadata
    ))
    # Save AI reply
    await add_message(MessageCreate(
        conversation_id=conversation_id,
        sender="assistant",
        text=ai_reply,
        metadata=None
    ))

    # Assuming the last added message is the assistant's reply, fetch it to return a complete MessageOut
    return await get_last_message(conversation_id, "assistant")