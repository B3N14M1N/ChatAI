from typing import List
from openai import OpenAI
from app.core.schemas import MessageCreate, MessageOut
from app.services.crud import (
    get_conversation_context,
    get_last_message,
    add_message
)

client = OpenAI()

async def chat_call(
    prompt: str,
    conversation_id: int,
    model: str = "gpt-4.1",
    metadata: str = None
) -> MessageOut:
    # Get conversation context (all previous messages)
    context: str = await get_conversation_context(conversation_id)
    
    full_prompt = f"{context}\n{"user"}: {prompt}" if context else prompt

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