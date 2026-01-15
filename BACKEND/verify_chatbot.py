import requests
import json

def test_chat(query):
    print(f"\n" + "="*50)
    print(f"Testing query: {query}")
    url = "http://localhost:8000/chat"
    payload = {
        "query": query,
        "history": [],
        "language": "en-US"
    }
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            try:
                # Some responses might be lists (data), some might be streaming strings
                content_type = response.headers.get('Content-Type', '')
                if 'application/json' in content_type:
                    data = response.json()
                    print("Response is JSON (Data Table):")
                    if isinstance(data, list):
                        print(f"Returned {len(data)} rows.")
                        if len(data) > 0:
                            print("First row keys:", data[0].keys())
                            print("Sample row:", json.dumps(data[0], indent=2))
                    else:
                        print(json.dumps(data, indent=2))
                else:
                    print("Response is Text/Stream (Analysis/Message):")
                    # Collect stream
                    text = ""
                    for chunk in response.iter_content(chunk_size=1024):
                        if chunk:
                            text += chunk.decode('utf-8')
                    print(text[:500] + "..." if len(text) > 500 else text)
            except Exception as e:
                print(f"Error parsing response: {e}")
                print(f"Raw response text: {response.text[:200]}...")
        else:
            print(f"Server error: {response.status_code}")
            print(f"Detail: {response.text}")
    except requests.exceptions.Timeout:
        print("Request timed out.")
    except Exception as e:
        print(f"Failed to connect to backend: {e}")

if __name__ == "__main__":
    # Test MVNE queries
    test_chat("Show me the wholesale billing summary for 2025-01")
    test_chat("What are the wholesale plans for Vodafone Wholesale?")
    test_chat("List all wholesale billing records for last month")
