"""
Minimal Python client demonstrating the memorystore REST API.

Usage (memorystore must be running on localhost:8787):
  python examples/python-client.py

Requires: requests
  pip install requests
"""
import json
import requests


def main():
    base = "http://localhost:8787"

    r = requests.post(
        f"{base}/memories",
        json={"text": "I like espresso in the morning"},
    )
    r.raise_for_status()
    print("stored:", r.json())

    r = requests.get(
        f"{base}/memories",
        params={"q": "what coffee do I drink?", "k": 3},
    )
    r.raise_for_status()
    print("recalled:")
    print(json.dumps(r.json(), indent=2))


if __name__ == "__main__":
    main()
