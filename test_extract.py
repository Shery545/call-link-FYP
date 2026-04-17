import asyncio
import os
from dotenv import load_dotenv
import aiohttp
import json

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

async def extract_order_via_llm(text_buffer: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GOOGLE_API_KEY}"
    payload = {
        "contents": [{
            "parts": [{"text": f"Extract the customer order details from the following complete context. If a piece of information is completely missing, do NOT hallucinate placeholders. Use the exact word 'Unknown' for text, and 0 for numbers. Text: {text_buffer}"}]
        }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
              "type": "OBJECT",
              "properties": {
                "item": {"type": "STRING"},
                "quantity": {"type": "INTEGER"},
                "price": {"type": "NUMBER"},
                "name": {"type": "STRING"},
                "address": {"type": "STRING"}
              },
              "required": ["item", "quantity", "price", "name", "address"]
            }
        }
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                print(resp.status)
                if resp.status == 200:
                    data = await resp.json()
                    print(data)
                    text_resp = data["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(text_resp)
                else:
                    print(await resp.text())
        return None
    except Exception as e:
        print(f"Failed: {e}")
        return None

async def main():
    text = "I have successfully captured all required details for Shahryar's order: Spicy chicken, with the name and address now confirmed. I'm moving forward to create the internal JSON order based on the understood specifications. The internal JSON will be: {\"item\": \"Spicy chicken\", \"quantity\": 1, \"price\": 350, \"name\": \"Shahryar\", \"address\": \"Railway Road 63/1\"}. I will now present this back to the user for final confirmation."
    res = await extract_order_via_llm(text)
    print("Result:", res)

asyncio.run(main())
