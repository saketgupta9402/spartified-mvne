import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
key = os.getenv("OPENAI_API_KEY")
print(f"OPENAI_API_KEY prefix: {key[:10] if key else 'NONE'}")

if key and not key.startswith("xx"):
    try:
        client = OpenAI(api_key=key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "say hello"}]
        )
        print(f"OpenAI test successful: {response.choices[0].message.content}")
    except Exception as e:
        print(f"OpenAI test failed: {e}")
else:
    print("Invalid key format (still has 'xx' or is None)")
