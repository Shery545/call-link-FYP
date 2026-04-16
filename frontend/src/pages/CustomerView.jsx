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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-slate-50 to-indigo-50 flex flex-col items-center p-6 font-sans selection:bg-orange-200">
      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-8 bg-white/40 backdrop-blur-md px-6 py-4 rounded-2xl shadow-sm border border-white/50">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-orange-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3 tracking-tight">
          <ShoppingBag className="text-orange-500" /> 
          Call-Link Agent
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        
        {/* LEFT SIDE: Menu Image */}
        <div className="bg-white/60 backdrop-blur-lg p-2 rounded-3xl shadow-xl shadow-orange-900/5 border border-white/60 transform transition-all hover:scale-[1.01] duration-500 overflow-hidden group">
          {/* This src points to public/menu.jpg */}
          <div className="relative overflow-hidden rounded-2xl w-full h-[500px]">
             <img 
               src="/menu.jpg" 
               alt="Restaurant Menu" 
               className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
             />
             <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-6">
               <span className="text-white font-bold text-lg tracking-wide shadow-sm">Premium Menu Overview</span>
             </div>
          </div>
        </div>

        {/* RIGHT SIDE: Voice Controls */}
        <div className="flex flex-col justify-center items-center bg-white/70 backdrop-blur-xl p-8 rounded-3xl shadow-2xl shadow-indigo-900/5 border border-white/60 text-center space-y-10 relative overflow-hidden">
          
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000"></div>

          <div className="z-10">
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Ready to Order?</h2>
            <p className="text-slate-500 font-medium tracking-wide text-sm uppercase">Tap to speak with our AI agent</p>
          </div>
          
          <button
            onClick={isListening ? stopConnection : startConnection}
            className={`z-10 p-10 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 group ${
              isListening ? "bg-red-500 shadow-red-500/40 animate-pulse" : "bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/40 hover:shadow-orange-600/50"
            }`}
          >
            {isListening ? <MicOff size={56} className="text-white"/> : <Mic size={56} className="text-white group-hover:animate-bounce"/>}
          </button>

          <div className="z-10 bg-slate-100/80 backdrop-blur-sm px-6 py-3 rounded-full text-lg font-medium text-slate-700 shadow-inner border border-slate-200/50">
             {status}
          </div>
          
          {aiResponse && (
            <div className="z-10 w-full animate-in slide-in-from-bottom-4 fade-in duration-300 bg-green-50 backdrop-blur-sm text-green-700 px-6 py-4 rounded-xl border border-green-200/60 shadow-lg shadow-green-900/5 font-semibold flex items-center justify-center gap-2">
              <span className="text-xl">✨</span> {aiResponse}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerView;