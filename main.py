# backend/main.py
import os
import json
import asyncio
import websockets
import logging
import sys
import re
from fastapi import WebSocket, FastAPI, Depends, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database import init_db, get_db, Order, CallLog
from database import init_db, get_db, Order, CallLog

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

def save_order(item: str, quantity: int, price: float, customer_name: str, address: str):
    try:
        db = next(get_db())
        new_order = Order(item=item, quantity=quantity, price=price, status="pending", customer_name=customer_name, address=address)
        db.add(new_order)
        db.commit()
        logger.info(f"✅ DATABASE SAVED: {quantity}x {item} for Rs.{price} (Customer: {customer_name}, Address: {address})")
        db.close()
    except Exception as e:
        logger.error(f"❌ DB ERROR: {e}")



TOOL_DEFINITIONS = []

class GeminiChatbot:
    def __init__(self):
        self.ws = None      
        self.client_ws = None 
        self.order_placed = False 

    async def run(self, websocket: WebSocket):
        self.client_ws = websocket
        
        # --- ROBUST MENU LOADING ---
        menu_text = "Menu not available."
        try:
            if os.path.exists("menu.json"):
                with open("menu.json", "r") as f:
                    menu_data = json.load(f)
                    menu_text = json.dumps(menu_data, indent=2)
            else:
                logger.warning("⚠️ menu.json file missing! AI will not know prices.")
        except Exception as e:
            logger.error(f"❌ Error reading menu: {e}")

        try:
            # 1. Connect to Gemini with Keep-Alive
            async with websockets.connect(
                WS_URL, 
                additional_headers={"Content-Type": "application/json"},
                open_timeout=30,
                ping_interval=20, 
                ping_timeout=10
            ) as gemini_ws:
                self.ws = gemini_ws
                logger.info("✅ Connected to Gemini")

                # 2. Send Setup
                await gemini_ws.send(json.dumps({
                    "setup": {
                        "model": MODEL_ID,
                        "generationConfig": {
                            "responseModalities": ["AUDIO"],
                            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Charon"}}}
                        },
                        "systemInstruction": {
                            "parts": [{"text": f"""
                            You are a friendly and efficient Pakistani waiter.
                            Your VERY FIRST sentence MUST be: "Salam, me Call-Link AI agent huin, kese hain ap?"
                            - You must say this EXACT phrase immediately when the connection opens.
                            
                            **MENU DATABASE (STRICTLY FOLLOW THIS):**
                            {menu_text}

                            **INSTRUCTIONS:**
                            1. Speak in a natural mix of **English + Roman Urdu**.
                            2. You can ONLY sell items listed in the MENU DATABASE above.
                            3. If an item is not in the list, politely say it is unavailable.
                            4. Answer questions about ingredients or price.
                            
                            **CRITICAL ORDERING RULES:**
                            5. IMPORTANT: Before confirming the order, YOU MUST ASK FOR THE CUSTOMER'S NAME AND DELIVERY ADDRESS.
                            6. Once you have the customer's name and address, you MUST verbally confirm the full order back to the customer word for word. Say exactly:
                               "Theek hai! Order confirm ho gaya. [CUSTOMER NAME], aapka [QUANTITY]x [ITEM] Rs.[PRICE] ka, deliver hoga [ADDRESS] pe."
                               Replace the brackets with the actual values from the conversation.
                            7. IN THE EXACT SAME RESPONSE as your verbal confirmation, you MUST write the following JSON in your text output on a single line:
                               [NEW_ORDER]: {{"item": "<item>", "quantity": <number>, "price": <number>, "name": "<customer name>", "address": "<delivery address>"}}
                            8. The JSON values must be the REAL values from the conversation. DO NOT wait for the next turn. Output it immediately!
                            9. Only output [NEW_ORDER] once, after the order is 100% confirmed with name and address.
                            """}]
                        }
                    }
                }))

                async def browser_to_gemini():
                    try:
                        async for message in self.client_ws.iter_text():
                            data = json.loads(message)
                            if data.get("type") == "audio":
                                await self.ws.send(json.dumps({
                                    "realtimeInput": {"mediaChunks": [{"mimeType": "audio/pcm;rate=16000", "data": data["audio"]}]}
                                }))
                            elif data.get("type") == "text":
                                await self.ws.send(json.dumps({
                                    "clientContent": {
                                        "turns": [{"role": "user", "parts": [{"text": data["text"]}]}],
                                        "turnComplete": True
                                    }
                                }))
                    except Exception as e:
                        logger.warning(f"Browser Disconnected: {e}")
                        raise 

                async def gemini_to_browser():
                    assistant_text_buffer = ""
                    full_conversation_history = ""
                    try:
                        async for msg in self.ws:
                            response = json.loads(msg)

                            if "setupComplete" in response:
                                logger.info("✅ Setup complete, sending initial greeting trigger...")
                                await self.ws.send(json.dumps({
                                    "clientContent": {
                                        "turns": [{"role": "user", "parts": [{"text": "hello"}]}],
                                        "turnComplete": True
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
                                    if "text" in part:
                                        assistant_text_buffer += part["text"]
                                        full_conversation_history += part["text"] + "\n"
                                        
                                if response["serverContent"].get("turnComplete"):
                                    logger.info(f"AI Text Reply: {assistant_text_buffer}")
                                    
                                    if not self.order_placed:
                                        order_data = None
                                        
                                        # Method 1: Look for explicit [NEW_ORDER]: {"..."} marker (most reliable)
                                        new_order_pattern = re.compile(r"\[NEW_ORDER\]:\s*(\{[^{}]*\})", re.IGNORECASE | re.DOTALL)
                                        new_order_match = new_order_pattern.search(assistant_text_buffer)
                                        if new_order_match:
                                            try:
                                                order_data = json.loads(new_order_match.group(1))
                                                logger.info(f"✅ Extracted order via [NEW_ORDER] marker: {order_data}")
                                            except Exception as e:
                                                logger.error(f"Failed to parse [NEW_ORDER] JSON: {e}")
                                        
                                        # Method 2: Generic JSON with item+address in the buffer
                                        if not order_data:
                                            json_pattern = re.compile(r"\{[^{}]*\"item\"[^{}]*\"address\"[^{}]*\}", re.IGNORECASE | re.DOTALL)
                                            json_match = json_pattern.search(assistant_text_buffer)
                                            if json_match:
                                                try:
                                                    order_data = json.loads(json_match.group(0))
                                                    logger.info(f"✅ Extracted order via generic regex: {order_data}")
                                                except:
                                                    pass
                                        # Method 3: Extract directly from the verbal confirmation phrase
                                        if not order_data:
                                            spoken_pattern = re.compile(r"Order confirm ho gaya\.\s*([^,]+),\s*aapka\s*(\d+)x\s*(.+?)\s*Rs\.?(\d+(?:\.\d+)?)\s*ka,\s*deliver hoga\s*(.+?)\s*pe", re.IGNORECASE)
                                            spoken_match = spoken_pattern.search(assistant_text_buffer)
                                            if spoken_match:
                                                order_data = {
                                                    "name": spoken_match.group(1).strip(),
                                                    "quantity": int(spoken_match.group(2)),
                                                    "item": spoken_match.group(3).strip(),
                                                    "price": float(spoken_match.group(4)),
                                                    "address": spoken_match.group(5).strip()
                                                }
                                                logger.info(f"✅ Extracted order via verbal confirmation regex: {order_data}")
                                        # Validate and save if we successfully extracted order data
                                        if order_data and "item" in order_data and order_data["item"] != "Unknown":
                                            name = str(order_data.get("name", "Unknown")).strip()
                                            address = str(order_data.get("address", "Unknown")).strip()
                                            
                                            # STRICT VALIDATION: Only save if Name and Address are fully provided
                                            if name.lower() != "unknown" and address.lower() != "unknown" and len(name) > 1 and len(address) > 1:
                                                qty = int(order_data.get("quantity", 1))
                                                pr = float(order_data.get("price", 0.0))
                                                save_order(order_data.get("item"), qty, pr, name, address)
                                                self.order_placed = True
                                                logger.info("✅ Order successfully validated and placed!")
                                                try:
                                                    await self.client_ws.send_json({"toolResponse": "Order placed successfully!", "type": "tool"})
                                                except:
                                                    pass
                                            
                                    assistant_text_buffer = ""
                    except Exception as e:
                        logger.error(f"Gemini Disconnected: {e}")
                        raise 

                # 4. Run Both
                done, pending = await asyncio.wait(
                    [asyncio.create_task(browser_to_gemini()), asyncio.create_task(gemini_to_browser())],
                    return_when=asyncio.FIRST_COMPLETED
                )
                
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

@app.get("/calls")
def get_calls(db: Session = Depends(get_db)):
    return db.query(CallLog).order_by(CallLog.start_time.desc()).all()

@app.put("/orders/{order_id}/complete")
def complete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if order:
        order.status = "completed"
        db.commit()
        return {"status": "success"}
    return {"status": "error", "message": "Order not found"}

# Import and attach Twilio Media Streams Router
from twilio_stream import twilio_router
app.include_router(twilio_router)

# Serve built React frontend (must be LAST — after all API routes)
import os
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if not os.path.exists(frontend_dist):
        return {"error": "Frontend not built"}
    file_path = os.path.join(frontend_dist, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)