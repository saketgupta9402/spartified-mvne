import requests
import json

def test_quick_chat():
    print("Testing backend chatbot with current model...")
    url = "http://localhost:8000/chat"
    payload = {
        "query": "hello",
        "history": [],
        "language": "en-US"
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Chat successful!")
            print(f"Response: {response.text[:100]}...")
        else:
            print(f"Chat failed with status {response.status_code}")
            print(f"Error detail: {response.text}")
    except Exception as e:
        print(f"Failed to connect or timed out: {e}")

if __name__ == "__main__":
    test_quick_chat()
