import re
import json

text = """
I have successfully captured all required details for Shahryar's order: Spicy chicken, with the name and address now confirmed. I'm moving forward to create the internal JSON order based on the understood specifications. The internal JSON will be: {"item": "Spicy chicken", "quantity": 1, "price": 350, "name": "Shahryar", "address": "Railway Road 63/1"}. I will now present this back to the user for final confirmation.

Some other talking...
Then I need to confirm:
I have successfully gathered all necessary details to complete the Spicy Chicken order for Shahryar at Railway Road 63/1. The item costs 350. Now, I'm generating the JSON string required to finalize it, and will then confirm it in Roman Urdu and English.
"""

def extract(text_buffer):
    pattern = re.compile(r"\{[^{}]*\"item\"[^{}]*\"address\"[^{}]*\}", re.IGNORECASE | re.DOTALL)
    matches = pattern.finditer(text_buffer)
    last_valid = None
    for match in matches:
        try:
            parsed = json.loads(match.group(0))
            if "item" in parsed and "address" in parsed:
                last_valid = parsed
        except Exception:
            pass
    return last_valid

print("Best:", extract(text))

