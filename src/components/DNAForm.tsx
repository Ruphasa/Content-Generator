"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Image as ImageIcon, Type, Palette, Hash, Target, AlignLeft, Search, Check, X, Compass, Pencil, RefreshCw } from 'lucide-react';
import { DNAData } from './ClientLayout';
import { showSuccess, showError } from './Toast';

interface DNAFormProps {
  data: DNAData;
  onChange: (field: keyof DNAData, value: any) => void;
  onModalChange?: (modalName: string | null) => void;
  onOpenSyncModal?: (action?: 'dna' | 'visual' | 'assets' | 'all') => void;
}

const POPULAR_FONTS = [
  "Inter", "Roboto", "Montserrat", "Playfair Display", 
  "Lora", "Oswald", "Poppins", "Lato", "Merriweather",
  "Nunito", "Raleway", "Ubuntu", "Rubik", "Work Sans", "Outfit"
];

const ModalWrapper = ({ title, children, isOpen, onClose, premium = false }: any) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={e => e.stopPropagation()}
          className={`bg-white/90 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] ${premium ? 'bg-gradient-to-br from-white/90 to-gray-50/90' : ''}`}
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
            <h3 className="font-bold text-xl text-gray-800 tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100/50 rounded-full transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-8 overflow-y-auto custom-scrollbar">
            {children}
          </div>
          <div className="p-6 border-t border-gray-200/50 bg-gray-50/30 flex justify-end">
            <button onClick={onClose} className="px-8 py-3 bg-gradient-to-r from-[var(--venturo-teal)] to-[var(--venturo-dark)] hover:opacity-90 text-white rounded-full font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              Simpan & Selesai
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const BentoBox = ({ title, icon: Icon, onClick, children, colSpan = 1, rowSpan = 1, className = "" }: any) => (
  <motion.div 
    whileHover={{ scale: 0.98, y: -4 }}
    whileTap={onClick ? { scale: 0.96 } : undefined}
    onClick={onClick}
    className={`glass bg-white/70 hover:bg-white/95 ${onClick ? 'cursor-pointer' : 'cursor-text'} rounded-3xl p-6 border border-white/60 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col relative overflow-hidden group focus-within:ring-2 focus-within:ring-[var(--venturo-teal)] focus-within:border-transparent ${colSpan === 2 ? 'md:col-span-2' : ''} ${rowSpan === 2 ? 'md:row-span-2' : ''} ${className}`}
  >
    <div className="flex items-center justify-between w-full mb-4">
      <div className="flex items-center gap-3 text-gray-400 group-hover:text-[var(--venturo-teal)] transition-colors">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-bold uppercase tracking-widest">{title}</span>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--venturo-teal)]/10 p-2 rounded-full text-[var(--venturo-teal)] hover:bg-[var(--venturo-teal)]/20">
        <Pencil className="w-4 h-4" />
      </div>
    </div>
    <div className="flex-1 flex flex-col w-full h-full relative z-10 pb-2">
      {children}
    </div>
  </motion.div>
);

export default function DNAForm({ data, onChange, onModalChange, onOpenSyncModal }: DNAFormProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [fontSearch, setFontSearch] = useState('');
  const [activeFontTab, setActiveFontTab] = useState<'primary' | 'secondary'>('primary');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadFont = (fontName: string) => {
      if (!fontName) return;
      const id = `font-${fontName.replace(/ /g, '-')}`;
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
    };
    loadFont(data.primaryFont);
    loadFont(data.secondaryFont);
  }, [data.primaryFont, data.secondaryFont]);

  const setModal = (modalName: string | null) => {
    setActiveModal(modalName);
    if (onModalChange) {
       onModalChange(modalName);
    }
  };

  const handleFieldFocus = (fieldName: string, value: string) => {
    if (onModalChange) {
      onModalChange(`field_${fieldName}`);
    }
  };

  const closeModal = () => setModal(null);


  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
      if (file) {
        const base64 = await fileToBase64(file);
        onChange('logoBase64', base64);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = Array.from(e.target.files).find(f => f.type.startsWith('image/'));
      if (file) {
        const base64 = await fileToBase64(file);
        onChange('logoBase64', base64);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-gray-800 pb-10">
      
      <motion.div 
        whileHover={{ scale: 0.99 }}
        onClick={() => setModal('brandName')}
        className="w-full flex flex-col gap-2 border-b border-gray-200/50 pb-8 cursor-pointer group px-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-5xl font-serif text-gray-900 group-hover:text-[var(--venturo-teal)] transition-colors tracking-tight">
              {data.brandName || "Enter Brand Name..."}
            </h1>
            <p className="text-2xl font-light text-gray-500 italic group-hover:text-gray-600 transition-colors">
              {data.tagline || "Slogan / Tagline..."}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <BentoBox title="Logo" icon={ImageIcon} onClick={() => setModal('logo')} className="group/logo text-center">
           <div className="flex-1 flex items-center justify-center w-full h-full min-h-[120px]">
             {data.logoBase64 ? (
                <div className="w-full h-full relative rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shadow-inner group-hover/logo:scale-105 transition-transform duration-500 flex items-center justify-center p-2">
                  <img src={data.logoBase64} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-md" />
                </div>
             ) : (
                <div className="flex flex-col items-center justify-center opacity-50 group-hover/logo:opacity-100 transition-opacity">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3 group-hover/logo:bg-[var(--venturo-teal)]/10 transition-colors">
                    <ImageIcon className="w-7 h-7 text-gray-400 group-hover/logo:text-[var(--venturo-teal)]" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">View Logo</p>
                </div>
             )}
           </div>
        </BentoBox>

        <BentoBox title="Colors" icon={Palette} onClick={() => setModal('colors')}>
           <div className="flex flex-1 items-center justify-center gap-6 mt-2">
             <div className="flex flex-col items-center gap-2 group/c1">
               <div className="w-16 h-16 rounded-full shadow-lg border-4 border-white group-hover/c1:scale-110 transition-transform" style={{ backgroundColor: data.primaryColor || '#009BAD' }}></div>
               <span className="text-[10px] text-gray-400 font-mono uppercase font-bold">{data.primaryColor || '#009BAD'}</span>
             </div>
             <div className="flex flex-col items-center gap-2 group/c2">
               <div className="w-16 h-16 rounded-full shadow-lg border-4 border-white group-hover/c2:scale-110 transition-transform" style={{ backgroundColor: data.secondaryColor || '#FFFFFF' }}></div>
               <span className="text-[10px] text-gray-400 font-mono uppercase font-bold">{data.secondaryColor || '#FFFFFF'}</span>
             </div>
           </div>
        </BentoBox>

        <BentoBox title="Typography" icon={Type} onClick={() => setModal('typography')}>
           <div className="flex flex-1 items-center justify-center gap-4 mt-2">
             <div className="flex-1 flex flex-col items-center gap-1 justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl border border-gray-100 p-2">
               <div className="text-3xl text-gray-800 tracking-tighter" style={{ fontFamily: data.primaryFont || 'inherit' }}>Aa</div>
               <div className="text-[10px] font-medium mt-1 bg-white px-2 py-0.5 rounded-full shadow-sm text-gray-600 truncate max-w-full">{data.primaryFont || "Primary"}</div>
             </div>
             <div className="flex-1 flex flex-col items-center gap-1 justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl border border-gray-100 p-2">
               <div className="text-3xl text-gray-800 tracking-tighter" style={{ fontFamily: data.secondaryFont || 'inherit' }}>Aa</div>
              <div className="text-[10px] font-medium mt-1 bg-white px-2 py-0.5 rounded-full shadow-sm text-gray-600 truncate max-w-full">{data.secondaryFont || "Secondary"}</div>
             </div>
           </div>
        </BentoBox>

        <BentoBox title="Brand Story" icon={AlignLeft} colSpan={1} className="min-h-[280px]">
           <div className="flex flex-col h-full">
             <textarea 
               value={data.brandOverview || ''} 
               onChange={e => onChange('brandOverview', e.target.value)} 
               onFocus={() => handleFieldFocus('Brand Story', data.brandOverview)}
               maxLength={250}
               className="w-full h-full flex-1 resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 text-sm text-gray-800 font-medium leading-relaxed custom-scrollbar"
               placeholder="Ceritakan sejarah atau apa yang membuat brand Anda unik (Maks 250 karakter)..."
             />
             <div className="text-right text-[10px] text-gray-400 mt-2">
               {(data.brandOverview || '').length}/250
             </div>
           </div>
        </BentoBox>

        <BentoBox title="Visi & Misi" icon={Compass} colSpan={2} className="min-h-[280px]">
           <div className="flex gap-4 h-full">
             <div className="bg-[var(--venturo-teal)]/5 p-4 rounded-2xl border border-[var(--venturo-teal)]/10 flex-1 flex flex-col justify-start">
               <span className="text-[10px] font-black text-[var(--venturo-teal)] uppercase mb-2 tracking-widest">Visi</span>
               <textarea 
                 value={data.visi || ''}
                 onChange={e => onChange('visi', e.target.value)}
                 onFocus={() => handleFieldFocus('Visi', data.visi)}
                 placeholder="Belum ada visi..."
                 className="w-full h-full flex-1 resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 text-sm text-gray-700 font-medium custom-scrollbar"
               />
             </div>
             <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex-1 flex flex-col justify-start">
               <span className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Misi</span>
               <textarea 
                 value={data.misi || ''}
                 onChange={e => onChange('misi', e.target.value)}
                 onFocus={() => handleFieldFocus('Misi', data.misi)}
                 placeholder="Belum ada misi..."
                 className="w-full h-full flex-1 resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 text-sm text-gray-600 font-medium custom-scrollbar"
               />
             </div>
           </div>
        </BentoBox>

        <BentoBox title="Tone & Audience" icon={Target} className="min-h-[360px]">
           <div className="space-y-6 flex flex-col justify-center h-full">
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Audience</span>
                <textarea 
                  value={data.targetAudience || ''}
                  onChange={e => onChange('targetAudience', e.target.value)}
                  onFocus={() => handleFieldFocus('Audience', data.targetAudience)}
                  placeholder="Semua Kalangan"
                  className="w-full h-full flex-1 resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 text-sm font-bold text-gray-800 leading-tight custom-scrollbar"
                />
              </div>
              <div className="flex-1 flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Tone (pisahkan koma)</span>
                <textarea 
                  value={data.tone || ''}
                  onChange={e => onChange('tone', e.target.value)}
                  onFocus={() => handleFieldFocus('Tone', data.tone)}
                  placeholder="Profesional, Santai..."
                  className="w-full h-full flex-1 resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 text-sm text-gray-700 custom-scrollbar"
                />
              </div>
           </div>
        </BentoBox>

        <BentoBox title="Content Strategy" icon={Hash} colSpan={2} className="min-h-[360px]">
          <div className="grid grid-cols-2 gap-6 h-full">
             <div className="flex flex-col justify-center space-y-6 h-full">
               <div className="flex-1 flex flex-col">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Key Vocabulary</span>
                 <textarea 
                   value={data.keyVocabulary || ''}
                   onChange={e => onChange('keyVocabulary', e.target.value)}
                   onFocus={() => handleFieldFocus('Key Vocabulary', data.keyVocabulary)}
                   placeholder="Kata-kata kunci..."
                   className="w-full h-full flex-1 resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 text-sm text-gray-700 custom-scrollbar"
                 />
               </div>
               <div className="flex-1 flex flex-col">
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Banned Content</span>
                 <textarea 
                   value={data.bannedContent || ''}
                   onChange={e => onChange('bannedContent', e.target.value)}
                   onFocus={() => handleFieldFocus('Banned Content', data.bannedContent)}
                   placeholder="Hal yang harus dihindari..."
                   className="w-full h-full flex-1 resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 text-sm text-gray-700 custom-scrollbar"
                 />
               </div>
             </div>
             <div className="flex flex-col justify-center space-y-6 h-full">
                <div className="flex-1 flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Standard CTA</span>
                  <textarea 
                    value={data.standardCTA || ''}
                    onChange={e => onChange('standardCTA', e.target.value)}
                    onFocus={() => handleFieldFocus('Standard CTA', data.standardCTA)}
                    placeholder="Link in bio"
                    className="w-full h-full flex-1 resize-none bg-gray-900 text-white p-3 rounded-xl text-sm font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] custom-scrollbar"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Hashtags</span>
                  <textarea 
                    value={data.hashtagStyle || ''}
                    onChange={e => onChange('hashtagStyle', e.target.value)}
                    onFocus={() => handleFieldFocus('Hashtags', data.hashtagStyle)}
                    placeholder="#Brand"
                    className="w-full h-full flex-1 resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 text-sm font-bold text-[var(--venturo-teal)] tracking-wide custom-scrollbar"
                  />
                </div>
             </div>
          </div>
        </BentoBox>

      </div>

      <ModalWrapper title="Brand Identity" isOpen={activeModal === 'brandName'} onClose={closeModal}>
        <div className="space-y-6">
          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Brand Name</label>
            <input type="text" value={data.brandName} onChange={e => onChange('brandName', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:outline-none focus:bg-white focus:border-[var(--venturo-teal)] transition-all text-lg font-semibold shadow-inner" placeholder="Contoh: Venturo Pro" />
          </div>
          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Tagline / Slogan</label>
            <input type="text" value={data.tagline} onChange={e => onChange('tagline', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:outline-none focus:bg-white focus:border-[var(--venturo-teal)] transition-all text-lg font-medium shadow-inner" placeholder="Contoh: Unlock your potential" />
          </div>
        </div>
      </ModalWrapper>

      <ModalWrapper title="Brand Colors" isOpen={activeModal === 'colors'} onClose={closeModal} premium>
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center group">
            <label className="block text-sm font-black text-gray-400 mb-6 uppercase tracking-widest">Primary Color</label>
            <div className="relative w-32 h-32 mb-6">
              <input type="color" value={data.primaryColor || '#009BAD'} onChange={e => onChange('primaryColor', e.target.value)} className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10" />
              <div className="w-full h-full rounded-full shadow-2xl border-4 border-white transform group-hover:scale-105 transition-transform duration-300" style={{ backgroundColor: data.primaryColor || '#009BAD' }}></div>
              <div className="absolute inset-0 rounded-full ring-1 ring-black/5 pointer-events-none"></div>
            </div>
            <div className="relative w-full">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={data.primaryColor || ''} onChange={e => onChange('primaryColor', e.target.value)} placeholder="009BAD" className="w-full pl-10 pr-4 py-3 text-center text-lg rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[var(--venturo-teal)] focus:bg-white transition-all uppercase font-mono font-bold text-gray-700" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center group">
            <label className="block text-sm font-black text-gray-400 mb-6 uppercase tracking-widest">Secondary Color</label>
            <div className="relative w-32 h-32 mb-6">
              <input type="color" value={data.secondaryColor || '#FFFFFF'} onChange={e => onChange('secondaryColor', e.target.value)} className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10" />
              <div className="w-full h-full rounded-full shadow-2xl border-4 border-gray-50 transform group-hover:scale-105 transition-transform duration-300" style={{ backgroundColor: data.secondaryColor || '#FFFFFF' }}></div>
              <div className="absolute inset-0 rounded-full ring-1 ring-black/5 pointer-events-none"></div>
            </div>
            <div className="relative w-full">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={data.secondaryColor || ''} onChange={e => onChange('secondaryColor', e.target.value)} placeholder="FFFFFF" className="w-full pl-10 pr-4 py-3 text-center text-lg rounded-2xl bg-gray-50 border-2 border-transparent focus:border-[var(--venturo-teal)] focus:bg-white transition-all uppercase font-mono font-bold text-gray-700" />
            </div>
          </div>

          <div className="col-span-2 mt-2">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider pl-2">Visual Prompt Style (Opsional)</label>
            <input type="text" value={data.visualStyle || ''} onChange={e => onChange('visualStyle', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] text-sm shadow-sm" placeholder="Contoh: Cinematic, minimal, bright lighting..." />
          </div>
        </div>
      </ModalWrapper>

      <ModalWrapper title="Typography Collection" isOpen={activeModal === 'typography'} onClose={closeModal} premium>
        <div className="space-y-6">
          <div className="flex gap-4">
            <div 
              onClick={() => setActiveFontTab('primary')}
              className={`flex-1 p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-center ${
                activeFontTab === 'primary' ? 'border-[var(--venturo-teal)] bg-white shadow-md' : 'border-transparent bg-gray-100/50 hover:bg-gray-100'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${activeFontTab === 'primary' ? 'text-[var(--venturo-teal)]' : 'text-gray-400'}`}>Primary Font</span>
              <div className="flex items-center gap-4">
                <span className="text-4xl text-gray-800 tracking-tighter leading-none" style={{ fontFamily: data.primaryFont || 'inherit' }}>Aa</span>
                <span className="font-semibold text-gray-700">{data.primaryFont || 'Select Font'}</span>
              </div>
            </div>
            
            <div 
              onClick={() => setActiveFontTab('secondary')}
              className={`flex-1 p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-center ${
                activeFontTab === 'secondary' ? 'border-[var(--venturo-teal)] bg-white shadow-md' : 'border-transparent bg-gray-100/50 hover:bg-gray-100'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${activeFontTab === 'secondary' ? 'text-[var(--venturo-teal)]' : 'text-gray-400'}`}>Secondary Font</span>
              <div className="flex items-center gap-4">
                <span className="text-4xl text-gray-800 tracking-tighter leading-none" style={{ fontFamily: data.secondaryFont || 'inherit' }}>Aa</span>
                <span className="font-semibold text-gray-700">{data.secondaryFont || 'Select Font'}</span>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search beautiful fonts..." 
              value={fontSearch}
              onChange={e => setFontSearch(e.target.value)}
              className="w-full pl-12 pr-6 py-4 text-lg rounded-2xl bg-white border-2 border-transparent focus:border-[var(--venturo-teal)] shadow-sm focus:shadow-md outline-none transition-all font-medium text-gray-700 placeholder:text-gray-300"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[340px] overflow-y-auto p-1 pb-4 custom-scrollbar">
            {POPULAR_FONTS.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())).map(font => {
              const isSelected = activeFontTab === 'primary' ? data.primaryFont === font : data.secondaryFont === font;
              return (
                <motion.div 
                  key={font}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onChange(activeFontTab === 'primary' ? 'primaryFont' : 'secondaryFont', font)}
                  className={`p-6 rounded-3xl cursor-pointer transition-all flex flex-col relative overflow-hidden ${isSelected ? 'bg-gradient-to-br from-[var(--venturo-teal)] to-[var(--venturo-dark)] text-white shadow-xl shadow-teal-500/20' : 'bg-white border border-gray-100 hover:border-gray-300 hover:shadow-lg text-gray-800'}`}
                >
                  <div className="absolute -right-4 -bottom-4 text-9xl opacity-[0.03] pointer-events-none font-bold" style={{ fontFamily: font }}>Aa</div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-sm font-bold uppercase tracking-wider ${isSelected ? 'text-teal-100' : 'text-gray-400'}`}>{font}</span>
                    {isSelected && <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-md"><Check className="w-4 h-4 text-white" /></div>}
                  </div>
                  
                  <div className="text-4xl mb-2" style={{ fontFamily: font }}>Aa Bb</div>
                  <div className={`text-sm truncate opacity-80`} style={{ fontFamily: font }}>The quick brown fox jumps...</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </ModalWrapper>

      <ModalWrapper title="Logo Assets" isOpen={activeModal === 'logo'} onClose={closeModal}>
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center w-full min-h-[300px] border-2 border-dashed border-[var(--venturo-teal)]/50 rounded-3xl bg-gray-50/50 hover:bg-gray-50 cursor-pointer transition-colors group"
        >
          {data.logoBase64 ? (
            <div className="w-full h-full relative p-6 flex flex-col items-center justify-center gap-4">
              <img src={data.logoBase64} alt="Logo" className="max-w-[200px] max-h-[200px] object-contain drop-shadow-md" />
              <p className="text-sm text-gray-500 font-medium group-hover:text-[var(--venturo-teal)] transition-colors">Click or drag to replace logo</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity p-8">
              <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:bg-[var(--venturo-teal)]/10 transition-colors">
                <UploadCloud className="w-10 h-10 text-gray-400 group-hover:text-[var(--venturo-teal)]" />
              </div>
              <p className="text-lg font-bold text-gray-700 mb-2">Upload your logo</p>
              <p className="text-sm text-gray-400 text-center max-w-sm">Drag and drop your logo here, or click to browse files. Recommended format: PNG or SVG with transparent background.</p>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
        </div>
      </ModalWrapper>

    </div>
  );
}
