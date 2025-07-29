from openai import OpenAI

client = OpenAI()

def chat_call(prompt: str) -> str:
    """ 
    Function to call the OpenAI API with a given prompt.
    """

    # Make a request to the OpenAI API
    response = client.responses.create(
        model="gpt-4.1",
        tools=[{"type": "web_search_preview"}],
        input=prompt
    )
    
    return response.output_text