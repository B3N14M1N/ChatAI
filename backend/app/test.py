from openai import OpenAI

# Initialize the OpenAI client
client = OpenAI()

while 1:
    prompt = input("Enter a prompt (or 'exit' to quit): ")
    if prompt.lower() == "exit":
        break
    # Make a request to the OpenAI API
    response = client.responses.create(
        model="gpt-4.1",
        tools=[{"type": "web_search_preview"}],
        input=prompt
    )
    print("\n\nResponse from OpenAI:")
    # Print the response
    print(response.output_text, "\n\n")
