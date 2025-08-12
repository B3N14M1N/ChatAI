import json
from app.services.chat_utils import ModelUsage, determine_tools
from openai import OpenAI
from app.rag.tools import recommend_books, get_books_summaries
from app.models.schemas import BookRecommendationInput, BooksSummariesInput

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
        "name": "get_books_summaries",
        "description": "Get full summaries for one or more book titles. Provide a list of book titles.",
        "parameters": BooksSummariesInput.schema(),
    },
]

tool_functions = {
    "recommend_books": lambda args: recommend_books(**BookRecommendationInput(**args).dict()),
    "get_books_summaries": lambda args: get_books_summaries(**BooksSummariesInput(**args).dict()),
}


def summarize_tool_output(model: str, tool_name: str, tool_result, arguments=None) -> str:
    user_prompt = ""
    system_prompt= ""
    if tool_name == "recommend_books":
        book_list = "\n".join(
            [f"- *{b.title}* by {b.author}: {b.short_summary}" for b in tool_result]
        )
        system_prompt = "Convert the following list of book recommendations into a natural response for the user. Do not mention this request."
        user_prompt = f"{book_list}"

    elif tool_name == "get_books_summaries":
        # tool_result is a list of summaries, get titles from arguments
        titles = arguments.get("titles", []) if arguments else []
        book_summaries = "\n".join(
            [f"- *{title}*: {summary}" for title, summary in zip(titles, tool_result)]
        )
        system_prompt = "Rephrase the following list of book summaries (can be multiple or just one) into a natural response for the user. Do not mention this request."
        user_prompt = f"{book_summaries}"

    # Use OpenAI to generate response
    response = client.responses.create(
        model=model,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )

    # Extract plain string from structured output
    for item in response.output:
        if hasattr(item, "content"):
            for content in item.content:
                if hasattr(content, "text"):
                    return content.text

    # fallback
    return "[No output text returned]"


def dispatch_tool_call(model: str, prompt: str, context: str):
    model_tools = determine_tools(model)
    model_tools.extend(tools)
    response = client.responses.create(
        model=model,
        input=prompt,
        tools=model_tools,
        tool_choice="auto"
    )

    tool_call = response.output[0]
    print(f"Tool_call structure: {tool_call}")
    tool_called = False

    # Handle different response structures
    if hasattr(tool_call, 'function'):
        function_name = tool_call.function.name
        arguments = json.loads(tool_call.function.arguments)
        tool_called = True
    elif hasattr(tool_call, 'name'):
        function_name = tool_call.name
        arguments = json.loads(tool_call.arguments)
        tool_called = True
    else:
        # Log the actual structure for debugging
        print(f"Unexpected tool_call structure: {tool_call}")

    if tool_called:
        # Get raw structured result
        tool_result = tool_functions[function_name](arguments)
        # Rephrase using the model itself
        natural_reply = summarize_tool_output(model, function_name, tool_result, arguments)
    else:
        natural_reply = response.output_text
        natural_reply += "\n\n### Fallback Generated Response"

    usage = ModelUsage(response.usage)
    return natural_reply, usage
