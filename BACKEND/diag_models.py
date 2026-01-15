import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
if not api_key:
    with open("models.txt", "w") as f:
        f.write("GOOGLE_GEMINI_API_KEY not found")
else:
    genai.configure(api_key=api_key)
    try:
        models = [m.name for m in genai.list_models()]
        with open("models.txt", "w") as f:
            f.write("\n".join(models))
    except Exception as e:
        with open("models.txt", "w") as f:
            f.write(f"Error listing models: {e}")
