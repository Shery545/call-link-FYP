# backend/main.py
import os
import json
import asyncio
import websockets
import logging
import sys
from fastapi import WebSocket, FastAPI, Depends, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database import init_db, get_db, Order

# --- CONFIGURATION ---
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger("GEMINI_CHATBOT")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") 
HOST = "generativelanguage.googleapis.com"
MODEL_ID = "models/gemini-2.5-flash-native-audio-preview-12-2025"
WS_URL = f"wss://{HOST}/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={GOOGLE_API_KEY}"

@app.on_event("startup")
def on_startup():
    init_db()
# //gfgf
def save_order(item: str, quantity: int, price: float):
    try:
        db = next(get_db())
        new_order = Order(item=item, quantity=quantity, price=price, status="pending")
        db.add(new_order)
        db.commit()
        logger.info(f"✅ DATABASE SAVED: {quantity}x {item} for ${price}")
        db.close()
    except Exception as e:
        logger.error(f"❌ DB ERROR: {e}")

TOOL_DEFINITIONS = [{
    "function_declarations": [{
        "name": "place_order",
        "description": "Save order to database",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "item": {"type": "STRING"},
                "quantity": {"type": "INTEGER"},
                "price": {"type": "NUMBER"}
            },
            "required": ["item", "quantity", "price"]
        }
    }]
}]

class GeminiChatbot:
    def __init__(self):
        self.ws = None      
        self.client_ws = None 

    async def run(self, websocket: WebSocket):
        self.client_ws = websocket
        
        # --- ROBUST MENU LOADING (Context Injection) ---
        menu_text = "Menu not available."
        try:
            if os.path.exists("menu.json"):
                with open("menu.json", "r") as f:
                    menu_data = json.load(f)
                    # Convert JSON to a clean string format for the AI
                    menu_text = json.dumps(menu_data, indent=2)
            else:
                logger.warning("⚠️ menu.json file missing! AI will not know prices.")
        except Exception as e:
            logger.error(f"❌ Error reading menu: {e}")

        try:
            # 1. Connect to Gemini with Keep-Alive (Ping every 20s)
            async with websockets.connect(
                WS_URL, 
                additional_headers={"Content-Type": "application/json"},
                open_timeout=30,
                ping_interval=20, 
                ping_timeout=10
            ) as gemini_ws:
                self.ws = gemini_ws
                logger.info("✅ Connected to Gemini")

                # 2. Send Setup (With Strict Prompt & Menu)
                await gemini_ws.send(json.dumps({
                    "setup": {
                        "model": MODEL_ID,
                        "tools": TOOL_DEFINITIONS,
                        "generationConfig": {
                            "responseModalities": ["AUDIO"],
                            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Charon"}}}
                        },
                        "systemInstruction": {
                            "parts": [{"text": f"""
                            You are a friendly and efficient Pakistani waiter.
                            
                            **MENU DATABASE (STRICTLY FOLLOW THIS):**
                            {menu_text}

                            **INSTRUCTIONS:**
                            1. Speak in a natural mix of **English + Roman Urdu**.
                            2. You can ONLY sell items listed in the MENU DATABASE above.
                            3. If an item is not in the list, politely say it is unavailable.
                            4. Confirm the exact price from the menu before calling the 'place_order' tool.
                            5. Once confirmed, call the 'place_order' tool immediately.
                            """}]
                        }
                    }
                }))

                # 3. Define Tasks
                async def browser_to_gemini():
                    try:
                        async for message in self.client_ws.iter_text():
                            data = json.loads(message)
                            if data.get("type") == "audio":
                                await self.ws.send(json.dumps({
                                    "realtimeInput": {"mediaChunks": [{"mimeType": "audio/pcm", "data": data["audio"]}]}
                                }))
                    except Exception as e:
                        logger.warning(f"Browser Disconnected: {e}")
                        raise # Force the other loop to close

                async def gemini_to_browser():
                    try:
                        async for msg in self.ws:
                            response = json.loads(msg)
                            
                            if "toolCall" in response:
                                for fc in response["toolCall"]["functionCalls"]:
                                    if fc["name"] == "place_order":
                                        args = fc["args"]
                                        save_order(args["item"], int(args["quantity"]), float(args["price"]))
                                        await self.ws.send(json.dumps({
                                            "toolResponse": {
                                                "functionResponses": [{
                                                    "name": "place_order",
                                                    "id": fc["id"],
                                                    "response": {"result": {"status": "success"}}
                                                }]
                                            }
                                        }))

                            if "serverContent" in response:
                                parts = response["serverContent"].get("modelTurn", {}).get("parts", [])
                                for part in parts:
                                    if "inlineData" in part:
                                        await self.client_ws.send_json({
                                            "type": "audio",
                                            "data": part["inlineData"]["data"]
                                        })
                    except Exception as e:
                        logger.error(f"Gemini Disconnected: {e}")
                        raise # Force the other loop to close

                # 4. Run Both. If ONE fails, STOP the other immediately.
                done, pending = await asyncio.wait(
                    [asyncio.create_task(browser_to_gemini()), asyncio.create_task(gemini_to_browser())],
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                # Cancel whatever is left running
                for task in pending:
                    task.cancel()

        except Exception as e:
            logger.error(f"❌ Session Ended: {e}")
            await self.client_ws.close()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    chatbot = GeminiChatbot()
    await chatbot.run(websocket)

@app.get("/orders")
def get_orders(db: Session = Depends(get_db)):
    return db.query(Order).order_by(Order.created_at.desc()).all()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)