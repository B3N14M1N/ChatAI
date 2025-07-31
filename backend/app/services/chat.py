from typing import List, Optional
from openai import OpenAI
from app.services.pricing import calculate_price, get_available_models
from app.core.schemas import MessageCreate, MessageOut, ConversationCreate
from app.core.crud import (
    get_conversation_context,
    get_last_message,
    add_message,
    create_conversation,
    add_attachment
)

client = OpenAI()

async def generate_conversation_title(
    prompt: str,
    model: str = "gpt-4.1-nano"
) -> str:
    """
    Generate a very short and concise title for the conversation based on the first user prompt.
    """
    # Use OpenAI to create a title
    title_prompt = f"Generate a very short and concise title for the following conversation topic: {prompt}"
    resp = client.responses.create(
        model=model,
        input=title_prompt
    )
    return resp.output_text.strip()

async def chat_call(
    text: str,
    files: List = None,
    conversation_id: Optional[int] = None,
    model: str = "gpt-4.1",
    metadata: Optional[str] = None
) -> MessageOut:
    # If new conversation, generate title and create record
    if conversation_id is None:
        # Title based on first prompt text
        title = await generate_conversation_title(text, model)
        conversation_id = await create_conversation(ConversationCreate(title=title))
    # Build prompt with context and extract file content
    original_text = text
    prompt = text
    file_contents = []  # List[tuple(filename, bytes, content_type)]
    if files:
        from app.services.file_processor import extract_text_from_file
        for f in files:
            raw = await f.read()
            file_contents.append((f.filename, raw, f.content_type))
            content = await extract_text_from_file(f)
            prompt += f"\nContents of {f.filename}:\n{content}"

    # Get conversation context (all previous messages)
    context: str = await get_conversation_context(conversation_id)
    # Build full prompt including context
    full_prompt = f"{context}\nuser: {prompt}" if context else prompt

    # Determine tools based on model capabilities
    pricing_data = get_available_models()
    caps = pricing_data.get(model, {}).get("capabilities", [])
    tools = [{"type": cap} for cap in caps]
    # Call OpenAI API with selected model and, if any, appropriate tools
    call_args = {"model": model, "input": full_prompt}
    if tools:
        call_args["tools"] = tools
    response = client.responses.create(**call_args)
    ai_reply = response.output_text

    # Extract usage metrics from response
    usage = response.usage
    # New API fields: input_tokens, output_tokens, total_tokens
    input_tokens = getattr(usage, "input_tokens", 0) or 0
    # Some usage objects include cached token counts
    cached_input_tokens = 0
    if getattr(usage, "input_tokens_details", None):
        cached_input_tokens = getattr(usage.input_tokens_details, "cached_tokens", 0) or 0
    output_tokens = getattr(usage, "output_tokens", 0) or 0
    total_tokens = getattr(usage, "total_tokens", 0) or 0
    # Compute price via pricing service
    price = calculate_price(model, input_tokens, output_tokens, cached_input_tokens)

    # Persist user message
    user_msg_id = await add_message(MessageCreate(
        conversation_id=conversation_id,
        sender="user",
        text=original_text,
        metadata=metadata
    ))
    # Persist attachments linked to user message
    for filename, raw, ctype in file_contents:
        await add_attachment(user_msg_id, filename, raw, ctype)

    # Save AI reply with usage metrics and model
    await add_message(MessageCreate(
        conversation_id=conversation_id,
        sender="assistant",
        text=ai_reply,
        metadata=None,
        prompt_tokens=input_tokens,
        completion_tokens=output_tokens,
        total_tokens=total_tokens,
        model=model,
        price=price
    ))

    # Attachments already saved for user message above

    # Assuming the last added message is the assistant's reply, fetch it to return a complete MessageOut
    return await get_last_message(conversation_id, "assistant")