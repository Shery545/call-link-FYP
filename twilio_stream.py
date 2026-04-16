import json
import base64
import asyncio
import logging
import audioop
import os
from fastapi import APIRouter, WebSocket, Request
from fastapi.responses import PlainTextResponse

logger = logging.getLogger("TWILIO_STREAM")

# Twilio Environment variables (Used if needed for outbound logic or verification)
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")

twilio_router = APIRouter()

# Twilio Media Stream formats:
# Incoming (Twilio -> Backend): 8kHz, Mono, 8-bit, ulaw base64 encoded
# Outgoing (Backend -> Twilio): 8kHz, Mono, 8-bit, ulaw base64 encoded
# 
# Gemini natively consumes PCM. We default to 16kHz for input.
# Gemini 2.5 voice models output 24kHz PCM for output.

def mulaw_to_pcm16(base64_audio: str) -> str:
    """Convert incoming Twilio audio (8kHz µ-law) to PCM (16kHz)."""
    # 1. Decode base64 
    audio_data = base64.b64decode(base64_audio)
    # 2. µ-law to PCM 16-bit (still 8000Hz)
    pcm_data = audioop.ulaw2lin(audio_data, 2)
    # 3. Resample 8000Hz -> 16000Hz (Width=2, Channels=1)
    resampled, _ = audioop.ratecv(pcm_data, 2, 1, 8000, 16000, None)
    # 4. Return as base64 string
    return base64.b64encode(resampled).decode("utf-8")

def pcm16_to_mulaw(base64_audio: str) -> str:
    """Convert outgoing Gemini audio (24kHz PCM) to Twilio format (8kHz µ-law)."""
    # 1. Decode base64 PCM stream
    pcm_data = base64.b64decode(base64_audio)
    # 2. Resample 24000Hz -> 8000Hz
    resampled, _ = audioop.ratecv(pcm_data, 2, 1, 24000, 8000, None)
    # 3. Convert PCM 16-bit to µ-law
    ulaw_data = audioop.lin2ulaw(resampled, 2)
    # 4. Return base64 for Twilio
    return base64.b64encode(ulaw_data).decode("utf-8")


class TwilioWebSocketAdapter:
    """
    An adapter that mimics the standard FastAPI WebSocket behavior that `GeminiChatbot` 
    expects from the browser, but internally translates logic for Twilio Media Streams.
    """
    def __init__(self, twilio_ws: WebSocket):
        self.twilio_ws = twilio_ws
        self.stream_sid = None

    async def accept(self):
        # Already accepted in twilio_stream endpoint
        pass

    async def close(self):
        try:
            await self.twilio_ws.close()
        except:
            pass

    async def iter_text(self):
        """Intercepts Twilio incoming messages and feeds them as fake browser messages to Gemini."""
        async for message in self.twilio_ws.iter_text():
            data = json.loads(message)
            event = data.get("event")
            
            if event == "start":
                self.stream_sid = data["start"]["streamSid"]
                logger.info(f"🎤 Twilio Stream started: {self.stream_sid}")
            elif event == "media":
                twilio_b64 = data["media"]["payload"]
                try:
                    # Convert to PCM16
                    pcm_b64 = mulaw_to_pcm16(twilio_b64)
                    
                    # GeminiChatbot expects: {"type": "audio", "audio": "base64..."}
                    yield json.dumps({"type": "audio", "audio": pcm_b64})
                except Exception as e:
                    logger.error(f"❌ Error converting incoming audio: {e}")
            elif event == "stop":
                logger.info(f"🛑 Twilio Stream stopped: {self.stream_sid}")
                break

    async def send_json(self, data: dict):
        """Intercepts outgoing messages from Gemini and feeds them to Twilio as Media stream events."""
        if data.get("type") == "audio" and self.stream_sid:
            pcm_b64 = data.get("data")
            if pcm_b64:
                try:
                    # Convert PCM back to ulaw
                    twilio_b64 = pcm16_to_mulaw(pcm_b64)
                    
                    # Twilio requires this JSON structure
                    msg = {
                        "event": "media",
                        "streamSid": self.stream_sid,
                        "media": {"payload": twilio_b64}
                    }
                    await self.twilio_ws.send_json(msg)
                except Exception as e:
                    logger.error(f"❌ Error converting outgoing audio: {e}")


@twilio_router.post("/twilio-voice")
async def twilio_voice(request: Request):
    """
    Receives incoming webhook from Twilio when a call is dialed.
    Returns TwiML that establishes a WebSocket media stream.
    """
    host = request.headers.get("host", request.url.netloc)
    
    # Infer if we're behind a secure proxy (like ngrok) or native HTTPS
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    ws_protocol = "wss" if "https" in forwarded_proto else "ws"
    
    stream_url = f"{ws_protocol}://{host}/twilio-stream"
    logger.info(f"📞 Incoming Twilio Call, connecting Stream URL: {stream_url}")
    
    twiml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{stream_url}" />
    </Connect>
</Response>'''
    
    return PlainTextResponse(twiml, media_type="text/xml")


@twilio_router.websocket("/twilio-stream")
async def twilio_stream(websocket: WebSocket):
    """
    The WebSocket endpoint that Twilio connects to for bi-directional audio streaming.
    """
    await websocket.accept()
    
    # Only import here to prevent circular dependencies with main.py
    from main import GeminiChatbot 
    
    adapter = TwilioWebSocketAdapter(websocket)
    chatbot = GeminiChatbot()
    
    logger.info("Starting Gemini session for Twilio Call...")
    # This invokes existing pipeline, completely oblivious it's talking to Twilio!
    await chatbot.run(adapter)
