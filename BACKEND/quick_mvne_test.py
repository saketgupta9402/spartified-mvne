import requests
import json

def test_queries(queries):
    url = "http://localhost:8001/chat"
    for query in queries:
        print(f"\n--- Testing Query: {query} ---")
        payload = {
            "query": query,
            "history": [],
        }
        try:
            response = requests.post(url, json=payload, timeout=20)
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"Success! Returned {len(data) if isinstance(data, list) else 1} items.")
                    if isinstance(data, list) and len(data) > 0:
                        print(f"Sample data: {data[0]}")
                except:
                    print(f"Returned non-JSON response: {response.text[:200]}...")
            else:
                print(f"Failed with status {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_queries([
        "Total cost trend for all MVNOs",
        "Retail accounts linked to Transatel Wholesale Plan",
        "Monthly data usage for Vodafone in Jan 2025"
    ])
