import re
import json

text1 = """I have successfully captured all required details for Shahryar's order: Spicy chicken, with the name and address now confirmed. I'm moving forward to create the internal JSON order based on the understood specifications. The internal JSON will be: {"item": "Spicy chicken", "quantity": 1, "price": 350, "name": "Shahryar", "address": "Railway Road 63/1"}. I will now present this back to the user for final confirmation."""
text2 = """The internal JSON will be:
```json
{
  "item": "Spicy chicken",
  "quantity": 1,
  "price": 350,
  "name": "Shahryar",
  "address": "Railway Road 63/1"
}
```"""

def extract(text_buffer):
    pattern = re.compile(r"\{[^{}]*\"item\"[^{}]*\"name\"[^{}]*\}", re.IGNORECASE | re.DOTALL)
    match = pattern.search(text_buffer)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception as e:
            print("JSON parse error:", e)
    return None

print("1:", extract(text1))
print("2:", extract(text2))

