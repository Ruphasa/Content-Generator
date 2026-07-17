"use client";

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Bot } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { DNAData } from './ClientLayout';

interface SidecarChatbotProps {
  dnaData: DNAData;
  isReady: boolean;
  activeModal?: string | null;
}

export default function SidecarChatbot({ dnaData, isReady, activeModal }: SidecarChatbotProps) {
  
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: {
        dnaState: dnaData,
      }
    }),
    messages: [
      {
        id: '1',
        role: 'assistant',
        parts: [{ type: 'text', text: "Halo! Saya adalah Venturo Pro AI Copilot. Saya bisa membantu Anda merumuskan Ide Campaign, mencari Slogan, atau memikirkan Konsep Konten berdasarkan Brand DNA Anda." }]
      }
    ] as any
  });

  const [input, setInput] = useState('');
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };
  
  const isLoading = status === 'submitted' || status === 'streaming';

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // DWELL-TIME PROACTIVE AI
  useEffect(() => {
    if (!activeModal) return;
    
    // Timer 4 seconds
    const timer = setTimeout(() => {
      // Pastikan pesan terakhir BUKAN dari proactive trigger untuk menghindari loop
      const lastMessage = messages[messages.length - 1];
      const lastText = lastMessage?.parts?.map(p => p.type === 'text' ? p.text : '').join('') || '';
      if (!lastText.includes('__PROACTIVE__')) {
        sendMessage({
          role: 'user',
          content: `__PROACTIVE__ User sedang membuka pengaturan ${activeModal}. Berikan 1 paragraf singkat (maksimal 3 kalimat) saran profesional terkait bagian ini berdasarkan data brand saat ini. Jangan bertanya balik, cukup beri insight.`
        } as any);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [activeModal, sendMessage, messages]);

  const visibleMessages = messages.filter(msg => {
    const text = msg.parts?.map(p => p.type === 'text' ? p.text : '').join('') || '';
    return !(msg.role === 'user' && text.includes('__PROACTIVE__'));
  });

  return (
    <div className="flex flex-col h-full glass bg-white/40 border border-white/50 rounded-3xl overflow-hidden shadow-2xl relative">
      
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b border-white/40 bg-[var(--venturo-teal)] text-white">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-lg leading-tight">AI Copilot</h2>
          <p className="text-xs text-white/80">Selalu siap membantu idemu</p>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide"
      >
        <AnimatePresence initial={false}>
          {visibleMessages.map((msg) => {
            const msgText = msg.parts?.map(p => p.type === 'text' ? p.text : '').join('') || '';
            return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' ? (
                <div className="flex gap-2 max-w-[85%]">
                  <div className="w-6 h-6 rounded-full bg-[var(--venturo-teal)]/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="w-3 h-3 text-[var(--venturo-teal)]" />
                  </div>
                  <div className="p-3 rounded-2xl rounded-tl-sm bg-white/70 backdrop-blur-md border border-white/80 text-sm text-gray-800 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.1)] leading-relaxed relative">
                    {msgText}
                  </div>
                </div>
              ) : (
                <div className="glass bg-gradient-to-br from-[var(--venturo-teal)]/80 to-[var(--venturo-dark)]/80 border border-white/30 text-white p-4 rounded-2xl rounded-tr-sm max-w-[85%] text-sm shadow-md leading-relaxed">
                  {msgText}
                </div>
              )}
            </motion.div>
          )})}
        </AnimatePresence>
      </div>

      {/* Footer / Input Area */}
      <div className="p-4 bg-white/60 backdrop-blur-md border-t border-white/40">
        <form onSubmit={handleSubmit} className="flex gap-2 relative">
          <input
            type="text"
            value={input || ''}
            onChange={handleInputChange}
            disabled={!isReady || isLoading}
            placeholder={isReady ? "Tanya rekomendasi font, tone..." : "Isi DNA untuk mulai..."}
            className="flex-1 bg-white border border-gray-200 rounded-full py-3 px-5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)]/50 focus:border-transparent transition-all shadow-inner"
          />
          <button 
            type="submit"
            disabled={!(input || '').trim() || !isReady || isLoading}
            className="absolute right-1 top-1 w-10 h-10 rounded-full bg-[var(--venturo-teal)] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--venturo-dark)] transition-colors shadow-sm"
          >
            <Send className="w-4 h-4 ml-1" />
          </button>
        </form>
      </div>

    </div>
  );
}
