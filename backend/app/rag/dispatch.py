from openai import OpenAI
import json
from app.rag.tools import recommend_books, get_book_summary, BookRecommendationInput, BookSummaryInput

client = OpenAI()

tools = [
    {
        "type": "function",
        "function": {
            "name": "recommend_books",
            "description": "Recommend books by genre",
            "parameters": BookRecommendationInput.schema(),
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_book_summary",
            "description": "Get full book summary by title",
            "parameters": BookSummaryInput.schema(),
        },
    },
]

tool_functions = {
    "recommend_books": lambda args: recommend_books(**BookRecommendationInput(**json.loads(args)).dict()),
    "get_book_summary": lambda args: get_book_summary(**BookSummaryInput(**json.loads(args)).dict()),
}

def contains_book_query(user_input: str) -> bool:
    keywords = ["book", "recommend", "genre", "summary", "novel"]
    return any(k in user_input.lower() for k in keywords)

def dispatch_tool_call(model: str, prompt: str):
    if not contains_book_query(prompt):
        return None

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        tools=tools,
        tool_choice="auto"
    )

    tool_call = response.choices[0].message.tool_calls[0]
    function_name = tool_call.function.name
    arguments = tool_call.function.arguments
    return tool_functions[function_name](arguments)
