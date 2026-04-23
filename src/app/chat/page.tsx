"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "清风徐来，施主请坐。今日上山，可是为了赏看这山中云雾？" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const newMessages = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      
      if (data.status === "success") {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev, 
        { role: "assistant", content: "（高人端起茶杯，似乎走神了，请稍后再试）" }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#F9F6F0] text-[#333333] font-serif relative">
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')] pointer-events-none fixed"></div>

      <div className="z-10 w-full max-w-3xl px-6 flex flex-col h-screen">
        {/* Header */}
        <div className="py-6 flex items-center justify-between border-b border-gray-300">
          <Link href="/" className="text-gray-500 hover:text-black tracking-widest text-sm transition-colors">
            ← 返璞归真
          </Link>
          <span className="tracking-[0.2em] font-light text-[#2C2C2C]">竹林听风</span>
          <div className="w-16"></div> {/* Spacer for alignment */}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto py-8 space-y-8 scrollbar-hide">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} animate-fade-in`}
            >
              <div 
                className={`max-w-[80%] px-6 py-4 leading-relaxed tracking-wider ${
                  msg.role === "user" 
                    ? "bg-[#2C2C2C] text-white" 
                    : "bg-white bg-opacity-60 border border-gray-300 text-gray-800"
                }`}
              >
                {msg.content}
              </div>
              <span className="text-xs text-gray-400 mt-2 tracking-widest">
                {msg.role === "user" ? "施主" : "高人"}
              </span>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex flex-col items-start animate-fade-in">
              <div className="max-w-[80%] px-6 py-4 bg-white bg-opacity-60 border border-gray-300 text-gray-800 flex space-x-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Input Area */}
        <div className="py-6 border-t border-gray-300">
          <form onSubmit={handleSubmit} className="flex space-x-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="品茶论道..."
              className="flex-1 bg-transparent border-b border-gray-400 focus:border-gray-800 outline-none px-2 py-2 text-lg tracking-wider placeholder:text-gray-400 transition-colors"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="px-8 py-2 border border-gray-400 text-gray-600 hover:text-black hover:border-black disabled:opacity-30 transition-colors tracking-widest"
            >
              奉茶
            </button>
          </form>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}
