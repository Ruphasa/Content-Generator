"use client";

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Bot } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DNAData } from './ClientLayout';

interface SidecarChatbotProps {
  dnaData: DNAData;
  isReady: boolean;
  activeModal?: string | null;
  onApplySuggestion?: (updates: Partial<DNAData>) => void;
}

export default function SidecarChatbot({ dnaData, isReady, activeModal, onApplySuggestion }: SidecarChatbotProps) {
  
  const { messages, sendMessage, status } = useChat({
    messages: [
      {
        id: '1',
        role: 'assistant',
        content: "Halo! Saya adalah Venturo Pro AI Copilot. Saya bisa membantu Anda merumuskan Ide Campaign, mencari Slogan, atau memikirkan Konsep Konten berdasarkan Brand DNA Anda."
      }
    ] as any
  });

  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize logic
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ 
      role: 'user', 
      content: JSON.stringify({
        text: input,
        dnaState: dnaData
      })
    } as any);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e as any);
    }
  };

  const isLoading = status === 'submitted' || status === 'streaming';

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [lastProactiveModal, setLastProactiveModal] = useState<string | null>(null);

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
    if (!activeModal || activeModal === lastProactiveModal) return;
    
    // Timer 2 seconds for on-focus triggers or modal opens
    const timer = setTimeout(() => {
      setLastProactiveModal(activeModal);
      
      let contextName = activeModal;
      let isField = false;
      if (activeModal.startsWith('field_')) {
        contextName = activeModal.replace('field_', '');
        isField = true;
      }

      const instruction = isField 
        ? `__PROACTIVE__ User sedang meninjau isian pada field [${contextName}].
Aturan:
1. Jika field tersebut KOSONG, berikan rekomendasi ide yang bagus.
2. Jika field tersebut SUDAH ADA ISINYA (exist), berikan komentar singkat (apresiasi/analisis) mengenai isian tersebut, LALU berikan saran/opsi LAIN YANG BERBEDA sebagai alternatif (jangan memberikan rekomendasi yang nilainya persis sama dengan yang sudah ada!).`
        : `__PROACTIVE__ User sedang membuka pengaturan ${contextName}. Berikan 1 paragraf singkat (maksimal 3 kalimat) saran profesional terkait bagian ini berdasarkan data brand saat ini. Jangan bertanya balik, cukup beri insight.`;

      sendMessage({
        role: 'user',
        content: JSON.stringify({
          text: instruction,
          dnaState: dnaData
        })
      } as any);
    }, 2000);

    return () => clearTimeout(timer);
  }, [activeModal, lastProactiveModal, sendMessage]);

  const visibleMessages = messages.filter(msg => {
    const rawText = (msg as any).text || (msg as any).content || msg.parts?.map((p:any) => p.type === 'text' ? p.text : '').join('') || '';
    let textToCheck = rawText;
    try { const p = JSON.parse(rawText); if(p.text) textToCheck = p.text; } catch(e){}
    return !(msg.role === 'user' && textToCheck.includes('__PROACTIVE__'));
  });

  return (
    <div className="flex flex-col h-full glass bg-gradient-to-b from-[var(--venturo-teal)]/30 via-white/70 to-white/70 border border-white/50 rounded-3xl overflow-hidden shadow-2xl relative">
      
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b border-white/30 backdrop-blur-md z-20 relative">
        <div className="w-10 h-10 rounded-full bg-[var(--venturo-teal)]/20 flex items-center justify-center backdrop-blur-sm shadow-inner relative z-10">
          <Bot className="w-6 h-6 text-[var(--venturo-teal)]" />
        </div>
        <div>
          <h2 className="font-semibold text-lg leading-tight text-gray-800">AI Copilot</h2>
          <p className="text-xs text-gray-500">Selalu siap membantu idemu</p>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-hide"
      >
        <AnimatePresence initial={false}>
          {visibleMessages.map((msg) => {
            const rawMsgText = (msg as any).text || (msg as any).content || msg.parts?.map((p: any) => p.type === 'text' ? p.text : '').join('') || '';
            let msgText = rawMsgText;
            if (msg.role === 'user') {
              try {
                const parsed = JSON.parse(rawMsgText);
                if (parsed.text) msgText = parsed.text;
              } catch(e) {}
            }
            let suggestion = null;
            
            const match = rawMsgText.match(/\[SUGGESTION_JSON\]([\s\S]*?)\[\/SUGGESTION_JSON\]/);
            if (match) {
              try {
                suggestion = JSON.parse(match[1]);
                msgText = rawMsgText.replace(/\[SUGGESTION_JSON\][\s\S]*?\[\/SUGGESTION_JSON\]/, '').trim();
              } catch (e) {
                console.error("Failed to parse suggestion JSON", e);
              }
            }

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
                  <div className="p-3 rounded-2xl rounded-tl-sm bg-white/40 backdrop-blur-lg border border-white/50 text-sm text-gray-800 shadow-xl leading-relaxed relative flex flex-col gap-3">
                    <div>{msgText}</div>
                    
                    {suggestion && suggestion.type === 'suggestion' && suggestion.options && (
                      <div className="flex flex-col gap-2 mt-1">
                        {suggestion.field === 'colors' && suggestion.options.map((opt: any, idx: number) => (
                          <div 
                            key={idx} 
                            onClick={() => onApplySuggestion?.({ primaryColor: opt.primaryColor, secondaryColor: opt.secondaryColor })}
                            className="flex items-center gap-3 p-2 bg-white/50 border border-gray-100 rounded-xl cursor-pointer hover:bg-white hover:border-[var(--venturo-teal)]/50 transition-all group active:scale-95"
                          >
                            <div className="flex -space-x-2">
                              <div className="w-6 h-6 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: opt.primaryColor }} />
                              {opt.secondaryColor && (
                                <div className="w-6 h-6 rounded-full shadow-sm ring-2 ring-white" style={{ backgroundColor: opt.secondaryColor }} />
                              )}
                            </div>
                            <span className="text-xs font-medium text-gray-600 group-hover:text-[var(--venturo-teal)] transition-colors">{opt.label}</span>
                          </div>
                        ))}

                        {suggestion.field === 'font' && suggestion.options.map((opt: any, idx: number) => (
                          <div 
                            key={idx} 
                            onClick={() => onApplySuggestion?.({ primaryFont: opt.fontFamily })}
                            className="flex flex-col gap-1 p-2 bg-white/50 border border-gray-100 rounded-xl cursor-pointer hover:bg-white hover:border-[var(--venturo-teal)]/50 transition-all group active:scale-95"
                          >
                            <span className="text-xs font-medium text-gray-600 group-hover:text-[var(--venturo-teal)] transition-colors">{opt.label}</span>
                            <span className="text-lg" style={{ fontFamily: opt.fontFamily }}>Aa Bb Cc</span>
                          </div>
                        ))}

                        {suggestion.field === 'text' && suggestion.options.map((opt: any, idx: number) => (
                          <div 
                            key={idx} 
                            onClick={() => onApplySuggestion?.({ [suggestion.targetField || 'brandOverview']: opt.text })}
                            className="flex flex-col gap-1 p-2 bg-white/50 border border-gray-100 rounded-xl cursor-pointer hover:bg-white hover:border-[var(--venturo-teal)]/50 transition-all group active:scale-95"
                          >
                            <span className="text-xs font-medium text-gray-400">{opt.label}</span>
                            <span className="text-xs text-gray-700 italic">"{opt.text}"</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="backdrop-blur-lg bg-gradient-to-br from-[var(--venturo-teal)]/60 to-[var(--venturo-dark)]/60 border border-white/40 text-white p-3 rounded-2xl rounded-tr-sm max-w-[85%] text-sm shadow-xl leading-relaxed">
                  {msgText}
                </div>
              )}
            </motion.div>
          )})}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex justify-start"
            >
              <div className="flex gap-2 max-w-[85%]">
                <div className="w-6 h-6 rounded-full bg-[var(--venturo-teal)]/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-3 h-3 text-[var(--venturo-teal)] animate-pulse" />
                </div>
                <div className="p-3 rounded-2xl rounded-tl-sm bg-white/40 backdrop-blur-lg border border-white/50 text-sm text-gray-800 shadow-xl flex gap-1 items-center h-10">
                  <div className="w-1.5 h-1.5 bg-[var(--venturo-teal)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-[var(--venturo-teal)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-[var(--venturo-teal)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Input Area */}
      <div className="p-4 bg-gradient-to-t from-white via-white/80 to-white/30 backdrop-blur-xl border-t border-white/40 z-20 relative">
        <div className="absolute top-0 left-0 w-full h-8 -mt-8 bg-gradient-to-t from-white/30 to-transparent pointer-events-none" />
        <form onSubmit={handleFormSubmit} className="flex gap-2 relative items-end">
          <textarea
            ref={textareaRef}
            value={input || ''}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            disabled={!isReady || isLoading}
            placeholder={isReady ? "Tanya rekomendasi font, tone..." : "Isi DNA untuk mulai..."}
            rows={1}
            className="flex-1 bg-white/50 backdrop-blur-sm border border-white/60 rounded-3xl py-3 pl-5 pr-12 text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)]/50 focus:border-white/80 transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.03)] resize-none custom-scrollbar max-h-[120px]"
          />
          <button 
            type="submit"
            disabled={!(input || '').trim() || !isReady || isLoading}
            className="absolute right-1 bottom-1.5 w-10 h-10 rounded-full bg-[var(--venturo-teal)] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--venturo-dark)] transition-colors shadow-sm"
          >
            <Send className="w-4 h-4 ml-1" />
          </button>
        </form>
      </div>

    </div>
  );
}
