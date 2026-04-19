import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, ShoppingBag, Send, MessageSquare } from 'lucide-react';
import { AudioStreamPlayer } from '../utils/audioPlayer';

const menuData = [
  {
    "category": "Main Course",
    "items": [
      { "name": "Cheeseburger", "price": 200, "description": "Classic beef patty with cheese and fresh lettuce" },
      { "name": "Cheese sandwich", "price": 250, "description": "Grilled sandwich loaded with melted cheese" },
      { "name": "Chicken burgers", "price": 300, "description": "Juicy chicken patty with special sauce" },
      { "name": "Spicy chicken", "price": 350, "description": "Fried chicken with a spicy kick" },
      { "name": "Hot dog", "price": 350, "description": "Grilled sausage in a soft bun with mustard" }
    ]
  },
  {
    "category": "Appetizers",
    "items": [
      { "name": "Fruit Salad", "price": 100, "description": "Fresh seasonal fruits mix" },
      { "name": "Cocktails", "price": 200, "description": "Refreshing mixed drinks" },
      { "name": "Nuggets", "price": 300, "description": "Crispy golden chicken nuggets" },
      { "name": "Sandwich", "price": 100, "description": "Light snack sandwich" },
      { "name": "French Fries", "price": 250, "description": "Crispy salted potato fries" }
    ]
  },
  {
    "category": "Beverages",
    "items": [
      { "name": "Milk Shake", "price": 50, "description": "Creamy vanilla or chocolate shake" },
      { "name": "Iced Tea", "price": 60, "description": "Chilled lemon infused tea" },
      { "name": "Orange Juice", "price": 70, "description": "Freshly squeezed orange juice" },
      { "name": "Lemon Tea", "price": 20, "description": "Hot tea with a twist of lemon" },
      { "name": "Coffee", "price": 90, "description": "Hot brewed coffee" }
    ]
  }
];

const CustomerView = () => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("Tap microphone to order");
  const [aiResponse, setAiResponse] = useState("");
  const [chatText, setChatText] = useState("");
  
  // Refs for Audio
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const playerRef = useRef(new AudioStreamPlayer());

  // 1. Start Connection
  const startConnection = async () => {
    setStatus("Connecting...");
    
    // Connect to Python Backend (works both locally and on Railway)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    websocketRef.current = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

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
  const handleSendChat = (e) => {
    e.preventDefault();
    if (websocketRef.current?.readyState === WebSocket.OPEN && chatText.trim() !== "") {
      websocketRef.current.send(JSON.stringify({
        type: "text",
        text: chatText
      }));
      setChatText(""); // clear input box after sending
      setStatus("Message sent, waiting for reply...");
    } else if (websocketRef.current?.readyState !== WebSocket.OPEN) {
      setStatus("Please connect the microphone first to establish session.");
    }
  };

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
        
        {/* LEFT SIDE: Menu List */}
        <div className="bg-white/60 backdrop-blur-lg p-6 rounded-3xl shadow-xl shadow-orange-900/5 border border-white/60 overflow-y-auto h-[500px] custom-scrollbar">
          <div className="mb-6 flex justify-between items-end border-b border-orange-200 pb-4 sticky top-0 bg-white/80 backdrop-blur-md pt-2 z-10">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Original Menu</h2>
            <span className="text-sm font-medium text-orange-600 bg-orange-100 px-3 py-1 rounded-full">Prices in Rs.</span>
          </div>
          
          <div className="space-y-6">
            {menuData.map((category, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-widest bg-indigo-50/50 block py-2 px-3 rounded-md">
                  {category.category}
                </h3>
                <div className="flex flex-col gap-2">
                  {category.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex justify-between items-center group hover:bg-white/50 p-3 rounded-xl transition-colors border border-transparent hover:border-orange-100">
                      <div className="flex-1 pr-4">
                        <h4 className="text-slate-800 font-bold group-hover:text-orange-600 transition-colors">{item.name}</h4>
                        <p className="text-xs text-slate-500 leading-snug mt-1">{item.description}</p>
                      </div>
                      <div className="font-extrabold text-slate-700 group-hover:text-orange-600 whitespace-nowrap bg-slate-100 group-hover:bg-orange-50 px-3 py-1 rounded-lg transition-colors shadow-sm border border-slate-200">
                        Rs. {item.price}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE: Voice & Chat Controls */}
        <div className="flex flex-col bg-white/70 backdrop-blur-xl p-8 rounded-3xl shadow-2xl shadow-indigo-900/5 border border-white/60 relative overflow-hidden h-full min-h-[500px]">
          
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 bg-orange-300 rounded-full mix-blend-multiply filter blur-[60px] opacity-40 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-64 h-64 bg-indigo-300 rounded-full mix-blend-multiply filter blur-[60px] opacity-40 animate-pulse delay-1000"></div>

          <div className="z-10 flex flex-col items-center mb-8 text-center pt-4">
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Ready to Order?</h2>
            <p className="text-slate-500 font-medium tracking-wide text-sm uppercase">Speak or type with our AI agent</p>
          </div>
          
          <div className="z-10 flex-1 flex flex-col justify-center items-center gap-6">
            {/* Voice Control Button */}
            <button
              onClick={isListening ? stopConnection : startConnection}
              className={`p-10 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 group ${
                isListening ? "bg-red-500 shadow-red-500/40 animate-pulse" : "bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/40 hover:shadow-orange-600/50"
              }`}
            >
              {isListening ? <MicOff size={56} className="text-white"/> : <Mic size={56} className="text-white group-hover:animate-bounce"/>}
            </button>

            {/* Status Pill */}
            <div className="bg-slate-100/90 backdrop-blur-sm px-6 py-3 rounded-full text-sm font-semibold text-slate-600 shadow-inner border border-slate-200 uppercase tracking-wider">
               {status}
            </div>

            {/* AI Notification Bubble */}
            {aiResponse && (
              <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-300 bg-gradient-to-r from-green-50 to-emerald-50 backdrop-blur-sm text-green-700 px-6 py-4 rounded-xl border border-green-200/60 shadow-lg shadow-green-900/5 font-semibold flex items-center justify-center gap-2">
                <span className="text-xl">✨</span> {aiResponse}
              </div>
            )}
          </div>

          {/* Text Chat Input Segment */}
          <form onSubmit={handleSendChat} className="z-10 mt-auto pt-6 w-full flex items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MessageSquare size={20} className="text-slate-400" />
              </div>
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Prefer to type your order?"
                className="w-full pl-12 pr-4 py-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all placeholder:text-slate-400 text-slate-700"
              />
            </div>
            <button
              type="submit"
              disabled={!chatText.trim()}
              className="p-4 bg-indigo-600 text-white rounded-2xl shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={24} />
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default CustomerView;