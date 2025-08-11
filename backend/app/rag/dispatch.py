import json
from app.services.chat_utils import ModelUsage
from openai import OpenAI
from app.rag.tools import (
    recommend_books,
    get_book_summary,
    BookRecommendationInput,
    BookSummaryInput,
)

client = OpenAI()

tools = [
    {
        "type": "function",
        "name": "recommend_books",
        "description": "Recommend books by genre",
        "parameters": BookRecommendationInput.schema(),
    },
    {
        "type": "function",
        "name": "get_book_summary",
        "description": "Get full book summary by title",
        "parameters": BookSummaryInput.schema(),
    },
]

tool_functions = {
    "recommend_books": lambda args: recommend_books(**BookRecommendationInput(**args).dict()),
    "get_book_summary": lambda args: get_book_summary(**BookSummaryInput(**args).dict()),
}


def contains_book_query(user_input: str) -> bool:
    keywords = ["book", "recommend", "genre", "summary", "novel"]
    return any(k in user_input.lower() for k in keywords)


def summarize_tool_output(model: str, tool_name: str, tool_result) -> str:
    prompt = ""

    if tool_name == "recommend_books":
        # Format as natural language
        book_list = "\n".join(
            [f"- *{b.title}* by {b.author}: {b.short_summary}" for b in tool_result]
        )
        prompt = (
            "Convert the following list of book recommendations into a natural response for the user:\n"
            f"{book_list}"
        )

    elif tool_name == "get_book_summary":
        # Probably already clean, but you can polish it
        prompt = (
            f"Rephrase the following book summary into a friendly user-facing answer:\n{tool_result}"
        )

    # Use OpenAI to generate response
    response = client.responses.create(
        model=model,
        input=prompt
    )

    # Extract plain string from structured output
    for item in response.output:
        if hasattr(item, "content"):
            for content in item.content:
                if hasattr(content, "text"):
                    return content.text

    # fallback
    return "[No output text returned]"


def dispatch_tool_call(model: str, prompt: str):
    if not contains_book_query(prompt):
        return None, None

    response = client.responses.create(
        model=model,
        input=prompt,
        tools=tools,
        tool_choice="auto"
    )

    tool_call = response.output[0]
    function_name = tool_call.name
    arguments = json.loads(tool_call.arguments)

    # Get raw structured result
    tool_result = tool_functions[function_name](arguments)

    # 🔁 Rephrase using the model itself
    natural_reply = summarize_tool_output(model, function_name, tool_result)

    usage = ModelUsage(response.usage)
    return natural_reply, usage
