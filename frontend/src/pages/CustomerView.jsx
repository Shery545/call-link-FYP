import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, ShoppingBag } from 'lucide-react';
import { AudioStreamPlayer } from '../utils/audioPlayer';

const CustomerView = () => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("Tap microphone to order");
  const [aiResponse, setAiResponse] = useState("");
  
  // Refs for Audio
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const playerRef = useRef(new AudioStreamPlayer());

  // 1. Start Connection
  const startConnection = async () => {
    setStatus("Connecting...");
    
    // Connect to Python Backend
    websocketRef.current = new WebSocket("ws://localhost:8000/ws");

    websocketRef.current.onopen = () => {
      setStatus("Listening... Speak now!");
      setIsListening(true);
      startMicrophone();
    };

    websocketRef.current.onmessage = async (event) => {
      const response = JSON.parse(event.data);

      // Play Audio from AI
      if (response.type === "audio") {
        playerRef.current.add16BitPCM(response.data);
      }
      
      // Show Success Message
      if (response.toolResponse) {
        setAiResponse("✅ Order placed successfully!");
        setTimeout(() => setAiResponse(""), 3000);
      }
    };

    websocketRef.current.onclose = () => {
      setStatus("Disconnected");
      setIsListening(false);
      stopMicrophone();
    };
  };

  // 2. Microphone Logic
  const startMicrophone = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true } });
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = floatTo16BitPCM(inputData);
          const base64String = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
          
          websocketRef.current.send(JSON.stringify({
            type: "audio",
            audio: base64String
          }));
        }
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (err) {
      console.error("Mic Error:", err);
      setStatus("Microphone Error (Allow Permissions)");
    }
  };

  const stopConnection = () => {
    websocketRef.current?.close();
    stopMicrophone();
    setIsListening(false);
    setStatus("Tap microphone to order");
  };

  const stopMicrophone = () => {
    sourceRef.current?.disconnect();
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
  };

  // Helper: Convert Audio format
  const floatTo16BitPCM = (input) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingBag className="text-orange-500" /> 
          Smart Waiter
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        
        {/* LEFT SIDE: Menu Image */}
        <div className="bg-white p-4 rounded-2xl shadow-lg">
          {/* This src points to public/menu.jpg */}
          <img 
            src="/menu.jpg" 
            alt="Restaurant Menu" 
            className="rounded-xl w-full h-[500px] object-cover" 
          />
        </div>

        {/* RIGHT SIDE: Voice Controls */}
        <div className="flex flex-col justify-center items-center bg-white p-8 rounded-2xl shadow-lg text-center space-y-8">
          <h2 className="text-2xl font-semibold text-gray-700">Ready to Order?</h2>
          
          <button
            onClick={isListening ? stopConnection : startConnection}
            className={`p-8 rounded-full shadow-2xl transition-all transform hover:scale-105 ${
              isListening ? "bg-red-500 animate-pulse" : "bg-orange-500"
            }`}
          >
            {isListening ? <MicOff size={48} color="white"/> : <Mic size={48} color="white"/>}
          </button>

          <div className="text-lg font-medium text-gray-600">{status}</div>
          
          {aiResponse && (
            <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg border border-green-200">
              {aiResponse}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerView;