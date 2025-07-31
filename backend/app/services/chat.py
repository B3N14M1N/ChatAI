from typing import List, Optional
from openai import OpenAI
from app.services.pricing import calculate_price, get_available_models
from app.core.schemas import MessageCreate, MessageOut, ConversationCreate
from app.services.file_processor import extract_text_from_file
from app.core.crud import (
    get_cached_conversation_context,
    set_conversation_context,
    append_to_conversation_context,
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
        for f in files:
            raw = await f.read()
            # Reset file pointer for content extraction
            f.file.seek(0)
            content = await extract_text_from_file(f)
            file_contents.append((f.filename, raw, f.content_type))
            prompt += f"\nContents of {f.filename}:\n{content}"

    # Get cached conversation context
    context: str = await get_cached_conversation_context(conversation_id)

    # Build full prompt including context
    full_prompt = f"{context}\nuser prompt: {prompt}" if context else prompt

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

    # Compute price via pricing service
    price = calculate_price(
        model,
        usage.input_tokens,
        usage.output_tokens,
        usage.input_tokens_details.cached_tokens
    )

    # Persist user message and update cache
    user_msg_id = await add_message(MessageCreate(
        conversation_id=conversation_id,
        sender="user",
        text=original_text,
        metadata=metadata
    ))
    await append_to_conversation_context(conversation_id, "user", original_text)

    # Persist attachments linked to user message
    for filename, raw, ctype in file_contents:
        await add_attachment(user_msg_id, filename, raw, ctype)

    # Save AI reply with usage metrics and model
    assistant_msg_id = await add_message(MessageCreate(
        conversation_id=conversation_id,
        sender="assistant",
        text=ai_reply,
        metadata=metadata,
        prompt_tokens=usage.input_tokens,
        completion_tokens=usage.output_tokens,
        total_tokens=usage.total_tokens,
        model=model,
        price=price
    ))
    await append_to_conversation_context(conversation_id, "assistant", ai_reply)

    # Summarize context when too long
    cached = await get_cached_conversation_context(conversation_id)
    if len(cached) > 2000:
        # generate summary
        summary_prompt = f"Summarize the key points of this conversation in a concise bullet list:\n{cached}"
        summary_resp = client.responses.create(model=model, input=summary_prompt)
        summary_text = summary_resp.output_text.strip()
        # reset cache with summary and recent messages
        new_context = summary_text + f"\nuser: {original_text}\nassistant: {ai_reply}"
        await set_conversation_context(conversation_id, new_context)

    # Attachments already saved for user message above

    # Assuming the last added message is the assistant's reply, fetch it to return a complete MessageOut
    return await get_last_message(conversation_id, "assistant")