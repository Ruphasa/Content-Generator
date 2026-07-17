"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Image as ImageIcon, Type, Palette, Hash, Target, AlignLeft, Search, Check, X, Compass } from 'lucide-react';
import { DNAData } from './ClientLayout';

interface DNAFormProps {
  data: DNAData;
  onChange: (field: keyof DNAData, value: any) => void;
  onModalChange?: (modalName: string | null) => void;
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

export default function DNAForm({ data, onChange, onModalChange }: DNAFormProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [fontSearch, setFontSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data.typography) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${data.typography.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      return () => {
        try { document.head.removeChild(link); } catch(e){}
      };
    }
  }, [data.typography]);

  const setModal = (modalName: string | null) => {
    setActiveModal(modalName);
    if (onModalChange) {
       onModalChange(modalName);
    }
  };

  const closeModal = () => setModal(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
      if (file) onChange('assets', [file]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = Array.from(e.target.files).find(f => f.type.startsWith('image/'));
      if (file) onChange('assets', [file]);
    }
  };

  const BentoBox = ({ title, icon: Icon, onClick, children, colSpan = 1, rowSpan = 1, className = "" }: any) => (
    <motion.div 
      whileHover={{ scale: 0.98, y: -4 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={`glass bg-white/70 hover:bg-white/95 cursor-pointer rounded-3xl p-6 border border-white/60 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col relative overflow-hidden group ${colSpan === 2 ? 'md:col-span-2' : ''} ${rowSpan === 2 ? 'md:row-span-2' : ''} ${className}`}
    >
      <div className="flex items-center gap-3 mb-4 text-gray-400 group-hover:text-[var(--venturo-teal)] transition-colors">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-bold uppercase tracking-widest">{title}</span>
      </div>
      <div className="flex-1 flex flex-col w-full h-full">
        {children}
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col gap-6 w-full h-full text-gray-800 pb-10">
      
      <motion.div 
        whileHover={{ scale: 0.99 }}
        onClick={() => setModal('brandName')}
        className="w-full flex flex-col gap-2 border-b border-gray-200/50 pb-8 cursor-pointer group px-2"
      >
        <h1 className="text-5xl font-serif text-gray-900 group-hover:text-[var(--venturo-teal)] transition-colors tracking-tight">
          {data.brandName || "Enter Brand Name..."}
        </h1>
        <p className="text-2xl font-light text-gray-500 italic group-hover:text-gray-600 transition-colors">
          {data.tagline || "Slogan / Tagline..."}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <BentoBox title="Logo" icon={ImageIcon} onClick={() => fileInputRef.current?.click()} className="group/logo text-center">
           <div 
             onDragOver={(e) => e.preventDefault()}
             onDrop={handleFileDrop}
             className="flex-1 flex items-center justify-center w-full h-full min-h-[120px]"
           >
             {data.assets && data.assets.length > 0 ? (
                <div className="w-full h-full relative rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shadow-inner group-hover/logo:scale-105 transition-transform duration-500 flex items-center justify-center p-2">
                  <img src={URL.createObjectURL(data.assets[0])} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-md" />
                </div>
             ) : (
                <div className="flex flex-col items-center justify-center opacity-50 group-hover/logo:opacity-100 transition-opacity">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3 group-hover/logo:bg-[var(--venturo-teal)]/10 transition-colors">
                    <UploadCloud className="w-7 h-7 text-gray-400 group-hover/logo:text-[var(--venturo-teal)]" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Upload Logo</p>
                </div>
             )}
             <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
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
           <div className="flex flex-1 flex-col justify-center items-center h-full w-full bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-2xl border border-gray-100">
             <div className="text-6xl text-gray-800 tracking-tighter" style={{ fontFamily: data.typography || 'inherit' }}>Aa</div>
             <div className="text-sm font-medium mt-3 bg-white px-3 py-1 rounded-full shadow-sm text-gray-600">{data.typography || "Pilih Font"}</div>
           </div>
        </BentoBox>

        <BentoBox title="Brand Story" icon={AlignLeft} onClick={() => setModal('overview')} colSpan={2}>
           {data.brandOverview ? (
             <p className="text-gray-700 text-base leading-relaxed line-clamp-4 font-serif">{data.brandOverview}</p>
           ) : (
             <div className="flex h-full items-center">
               <p className="text-gray-400 text-sm italic">Ceritakan kisah di balik brand Anda di sini...</p>
             </div>
           )}
        </BentoBox>

        <BentoBox title="Visi & Misi" icon={Compass} onClick={() => setModal('visiMisi')}>
           <div className="flex flex-col gap-4 h-full">
             <div className="bg-[var(--venturo-teal)]/5 p-4 rounded-2xl border border-[var(--venturo-teal)]/10 flex-1 flex flex-col justify-center">
               <span className="text-[10px] font-black text-[var(--venturo-teal)] uppercase mb-1 tracking-widest">Visi</span>
               <p className="text-xs text-gray-700 font-medium line-clamp-2">{data.visi || "Belum ada visi..."}</p>
             </div>
             <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex-1 flex flex-col justify-center">
               <span className="text-[10px] font-black text-gray-400 uppercase mb-1 tracking-widest">Misi</span>
               <p className="text-xs text-gray-600 font-medium line-clamp-2">{data.misi || "Belum ada misi..."}</p>
             </div>
           </div>
        </BentoBox>

        <BentoBox title="Tone & Audience" icon={Target} onClick={() => setModal('tone')}>
           <div className="space-y-5 flex flex-col h-full justify-center">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Audience</span>
                <p className="text-lg font-bold text-gray-800 leading-tight">{data.targetAudience || "Semua Kalangan"}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Tone</span>
                <div className="flex flex-wrap gap-2">
                  {(data.tone || "Profesional").split(',').map((t, i) => (
                    <span key={i} className="px-3 py-1 bg-[var(--venturo-teal)]/10 text-[var(--venturo-teal)] font-semibold rounded-full text-xs shadow-sm border border-[var(--venturo-teal)]/20">{t.trim()}</span>
                  ))}
                </div>
              </div>
           </div>
        </BentoBox>

        <BentoBox title="Content Strategy" icon={Hash} onClick={() => setModal('contentStrategy')} colSpan={2}>
          <div className="grid grid-cols-2 gap-6 h-full">
             <div className="flex flex-col justify-center space-y-4">
               <div>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Key Vocabulary</span>
                 <p className="text-sm text-gray-800 font-medium leading-relaxed line-clamp-2">{data.keyVocabulary || "Kata kunci positif..."}</p>
               </div>
               <div>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Banned Content</span>
                 <p className="text-sm text-red-500 font-medium leading-relaxed line-clamp-1">{data.bannedContent || "Tidak ada..."}</p>
               </div>
             </div>
             <div className="flex flex-col justify-center space-y-4">
               <div>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Standard CTA</span>
                 <div className="bg-gray-900 text-white p-3 rounded-xl inline-block text-sm font-semibold shadow-lg">
                   {data.standardCTA || "Link in bio"}
                 </div>
               </div>
               <div>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Hashtags</span>
                 <p className="text-sm text-[var(--venturo-teal)] font-medium">{data.hashtagStyle || "#Brand"}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto p-1 pb-4 custom-scrollbar">
            {POPULAR_FONTS.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())).map(font => {
              const isSelected = data.typography === font;
              return (
                <motion.div 
                  key={font}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onChange('typography', font)}
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

      <ModalWrapper title="Brand Story" isOpen={activeModal === 'overview'} onClose={closeModal}>
        <div className="space-y-4">
          <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Tell Us About Your Brand</label>
          <textarea value={data.brandOverview} onChange={e => onChange('brandOverview', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:outline-none focus:bg-white focus:border-[var(--venturo-teal)] transition-all min-h-[200px] resize-y text-base font-serif leading-relaxed shadow-inner" placeholder="Ceritakan sejarah, produk, layanan, dan nilai unik yang Anda tawarkan..." />
        </div>
      </ModalWrapper>

      <ModalWrapper title="Visi & Misi" isOpen={activeModal === 'visiMisi'} onClose={closeModal}>
        <div className="grid grid-cols-1 gap-6">
          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide text-[var(--venturo-teal)]">Visi (Vision)</label>
            <textarea value={data.visi} onChange={e => onChange('visi', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:outline-none focus:bg-white focus:border-[var(--venturo-teal)] transition-all min-h-[120px] resize-none text-base shadow-inner" placeholder="Kemana arah brand Anda di masa depan?..." />
          </div>
          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide text-gray-500">Misi (Mission)</label>
            <textarea value={data.misi} onChange={e => onChange('misi', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:outline-none focus:bg-white focus:border-gray-400 transition-all min-h-[120px] resize-none text-base shadow-inner" placeholder="Bagaimana cara Anda mencapai visi tersebut?..." />
          </div>
        </div>
      </ModalWrapper>

      <ModalWrapper title="Audience & Tone of Voice" isOpen={activeModal === 'tone'} onClose={closeModal}>
        <div className="space-y-6">
          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Target Audience</label>
            <input type="text" value={data.targetAudience} onChange={e => onChange('targetAudience', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:outline-none focus:bg-white focus:border-[var(--venturo-teal)] transition-all text-base shadow-inner" placeholder="Contoh: Profesional Muda usia 25-35..." />
          </div>
          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Tone of Voice</label>
            <input type="text" value={data.tone} onChange={e => onChange('tone', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:outline-none focus:bg-white focus:border-[var(--venturo-teal)] transition-all text-base shadow-inner" placeholder="Contoh: Profesional, Casual, Friendly (pisahkan koma)" />
            <p className="text-xs text-gray-400 mt-2 ml-1">Ini akan menentukan gaya bahasa AI saat meng-generate konten Anda.</p>
          </div>
        </div>
      </ModalWrapper>

      <ModalWrapper title="Content Strategy" isOpen={activeModal === 'contentStrategy'} onClose={closeModal}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group">
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Key Vocabulary</label>
              <textarea value={data.keyVocabulary} onChange={e => onChange('keyVocabulary', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-[var(--venturo-teal)]/5 border-2 border-[var(--venturo-teal)]/20 focus:outline-none focus:bg-white focus:border-[var(--venturo-teal)] transition-all min-h-[120px] resize-none text-sm shadow-inner" placeholder="Kata-kata andalan yang harus sering muncul..." />
            </div>
            <div className="group">
              <label className="block text-sm font-bold text-red-700 mb-2 uppercase tracking-wide">Banned Content</label>
              <textarea value={data.bannedContent} onChange={e => onChange('bannedContent', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-red-50 border-2 border-red-100 focus:outline-none focus:bg-white focus:border-red-400 transition-all min-h-[120px] resize-none text-sm shadow-inner" placeholder="Kata/topik tabu yang dilarang muncul..." />
            </div>
          </div>
          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Standard Call-To-Action (CTA)</label>
            <input type="text" value={data.standardCTA} onChange={e => onChange('standardCTA', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:outline-none focus:bg-white focus:border-[var(--venturo-teal)] transition-all text-sm shadow-inner" placeholder="Contoh: Kunjungi link di bio kami sekarang!" />
          </div>
          <div className="group">
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Hashtag Style</label>
            <input type="text" value={data.hashtagStyle} onChange={e => onChange('hashtagStyle', e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:outline-none focus:bg-white focus:border-[var(--venturo-teal)] transition-all text-sm shadow-inner" placeholder="Contoh: #Venturo #Innovation (3-5 tags)" />
          </div>
        </div>
      </ModalWrapper>

    </div>
  );
}
