"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Image as ImageIcon, Type, Palette, PenTool, Hash, Target, AlignLeft, Search, Check, X } from 'lucide-react';
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

export default function DNAForm({ data, onChange, onModalChange }: DNAFormProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [fontSearch, setFontSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamically load selected font
  useEffect(() => {
    if (data.typography) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${data.typography.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
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
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'));
      onChange('assets', [...data.assets, ...newFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'));
      onChange('assets', [...data.assets, ...newFiles]);
    }
  };

  const BentoBox = ({ title, icon: Icon, onClick, children, colSpan = 1, rowSpan = 1 }: any) => (
    <motion.div 
      whileHover={{ scale: 0.98, y: -2 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={`glass bg-white/60 hover:bg-white/80 cursor-pointer rounded-2xl p-5 border border-white/50 shadow-sm transition-colors flex flex-col relative overflow-hidden group ${colSpan === 2 ? 'md:col-span-2' : ''} ${rowSpan === 2 ? 'md:row-span-2' : ''}`}
    >
      <div className="flex items-center gap-2 mb-3 text-gray-500 group-hover:text-[var(--venturo-teal)] transition-colors">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </motion.div>
  );

  const ModalWrapper = ({ title, children, isOpen }: any) => (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeModal}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="bg-white/90 backdrop-blur-xl border border-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white/50">
              <h3 className="font-bold text-gray-800">{title}</h3>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {children}
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button onClick={closeModal} className="px-6 py-2 bg-[var(--venturo-teal)] hover:bg-[var(--venturo-dark)] text-white rounded-full font-medium transition-colors text-sm shadow-md">
                Simpan & Tutup
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="flex flex-col gap-6 w-full h-full text-gray-800 pb-10">
      
      {/* HEADER: BRAND NAME & TAGLINE */}
      <motion.div 
        whileHover={{ scale: 0.99 }}
        onClick={() => setModal('brandName')}
        className="w-full flex flex-col gap-2 border-b border-gray-200/50 pb-6 cursor-pointer group"
      >
        <h1 className="text-5xl font-serif text-gray-900 group-hover:text-[var(--venturo-teal)] transition-colors">
          {data.brandName || "Enter Brand Name..."}
        </h1>
        <p className="text-2xl font-light text-gray-500 italic">
          {data.tagline || "Slogan / Tagline..."}
        </p>
      </motion.div>

      {/* BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Visual & Typography */}
        <BentoBox title="Visual Identity" icon={Palette} onClick={() => setModal('visual')} rowSpan={2}>
          <div className="flex flex-col h-full gap-4 justify-center">
            {/* Font Preview */}
            <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
               <div className="text-3xl mb-1 text-gray-800" style={{ fontFamily: data.typography || 'inherit' }}>Aa</div>
               <div className="text-xs text-gray-400 mb-2 font-mono">{data.typography || "No Font Selected"}</div>
               <div className="text-sm text-gray-600 truncate" style={{ fontFamily: data.typography || 'inherit' }}>The quick brown fox jumps over the lazy dog</div>
            </div>
            {/* Color Swatches */}
            <div className="flex items-center justify-around mt-2">
               <div className="flex flex-col items-center gap-1">
                 <div className="w-12 h-12 rounded-full shadow-inner border-2 border-white" style={{ backgroundColor: data.primaryColor || '#009BAD' }}></div>
                 <span className="text-[10px] text-gray-400 font-mono uppercase">{data.primaryColor || '#009BAD'}</span>
               </div>
               <div className="flex flex-col items-center gap-1">
                 <div className="w-12 h-12 rounded-full shadow-inner border-2 border-white" style={{ backgroundColor: data.secondaryColor || '#FFFFFF' }}></div>
                 <span className="text-[10px] text-gray-400 font-mono uppercase">{data.secondaryColor || '#FFFFFF'}</span>
               </div>
            </div>
          </div>
        </BentoBox>

        {/* Brand Overview */}
        <BentoBox title="Brand Overview" icon={AlignLeft} onClick={() => setModal('overview')} colSpan={2}>
           {data.brandOverview ? (
             <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">{data.brandOverview}</p>
           ) : (
             <p className="text-gray-400 text-sm italic">Ceritakan secara singkat tentang brand Anda...</p>
           )}
           
           <div className="mt-4 grid grid-cols-2 gap-4">
             <div className="bg-[var(--venturo-teal)]/5 p-3 rounded-lg border border-[var(--venturo-teal)]/10">
               <span className="text-[10px] font-bold text-[var(--venturo-teal)] uppercase mb-1 block">Visi</span>
               <p className="text-xs text-gray-600 italic line-clamp-2">&quot;{data.visi || "..."}&quot;</p>
             </div>
             <div className="bg-[var(--venturo-teal)]/5 p-3 rounded-lg border border-[var(--venturo-teal)]/10">
               <span className="text-[10px] font-bold text-[var(--venturo-teal)] uppercase mb-1 block">Misi</span>
               <p className="text-xs text-gray-600 italic line-clamp-2">&quot;{data.misi || "..."}&quot;</p>
             </div>
           </div>
        </BentoBox>

        {/* Tone & Voice */}
        <BentoBox title="Tone & Audience" icon={Target} onClick={() => setModal('tone')}>
           <div className="space-y-3">
              <div>
                <span className="text-[10px] text-gray-400 block mb-1">Target Audience</span>
                <p className="text-sm font-medium text-gray-800">{data.targetAudience || "Semua kalangan"}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block mb-1">Tone of Voice</span>
                <div className="flex flex-wrap gap-1">
                  {(data.tone || "Profesional").split(',').map((t, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">{t.trim()}</span>
                  ))}
                </div>
              </div>
           </div>
        </BentoBox>

        {/* Content Strategy */}
        <BentoBox title="Content Strategy" icon={Hash} onClick={() => setModal('contentStrategy')}>
          <div className="space-y-3">
             <div>
               <span className="text-[10px] text-gray-400 block mb-1">Key Vocabulary</span>
               <p className="text-xs text-[var(--venturo-teal)] font-medium line-clamp-1">{data.keyVocabulary || "Kata kunci positif..."}</p>
             </div>
             <div>
               <span className="text-[10px] text-gray-400 block mb-1">Standard CTA</span>
               <p className="text-xs text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-100 truncate">{data.standardCTA || "Link in bio..."}</p>
             </div>
          </div>
        </BentoBox>

        {/* Assets (Keeping it 2 columns wide) */}
        <BentoBox title="Logo & Assets" icon={ImageIcon} onClick={() => fileInputRef.current?.click()} colSpan={2}>
           <div 
             onDragOver={(e) => e.preventDefault()}
             onDrop={handleFileDrop}
             className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 hover:border-[var(--venturo-teal)] hover:bg-[var(--venturo-teal)]/5 transition-all rounded-xl"
           >
             {data.assets.length > 0 ? (
               <div className="text-center flex gap-4 overflow-x-auto max-w-full pb-2">
                 {data.assets.map((file, idx) => (
                   <div key={idx} className="w-16 h-16 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center flex-shrink-0 relative group overflow-hidden">
                     {file.type.startsWith('image/') ? (
                       <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover rounded-lg" />
                     ) : (
                       <span className="text-[10px] font-bold text-gray-400">VIDEO</span>
                     )}
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-center opacity-60">
                 <UploadCloud className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                 <p className="text-sm font-medium">Drag & drop assets here</p>
                 <p className="text-xs mt-1">or click to browse</p>
               </div>
             )}
             <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="video/*,image/*" className="hidden" />
           </div>
        </BentoBox>
      </div>

      {/* --- MODALS --- */}
      
      {/* Brand Name Modal */}
      <ModalWrapper title="Brand Identity" isOpen={activeModal === 'brandName'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name</label>
            <input type="text" value={data.brandName} onChange={e => onChange('brandName', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)]" placeholder="Contoh: Venturo Pro" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tagline / Slogan</label>
            <input type="text" value={data.tagline} onChange={e => onChange('tagline', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)]" placeholder="Contoh: Unlock your potential" />
          </div>
        </div>
      </ModalWrapper>

      {/* Visual Identity Modal (Colors & Fonts) */}
      <ModalWrapper title="Visual Identity & Typography" isOpen={activeModal === 'visual'}>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Pilih Google Font</label>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Cari font..." 
                value={fontSearch}
                onChange={e => setFontSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-hide">
              {POPULAR_FONTS.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())).map(font => (
                <div 
                  key={font}
                  onClick={() => onChange('typography', font)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${data.typography === font ? 'border-[var(--venturo-teal)] bg-[var(--venturo-teal)]/5' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                >
                  {/* Note: In a real app we'd load all preview fonts, but standard fonts work well for now */}
                  <span className="text-sm font-medium">{font}</span>
                  {data.typography === font && <Check className="w-4 h-4 text-[var(--venturo-teal)]" />}
                </div>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={data.primaryColor || '#009BAD'} onChange={e => onChange('primaryColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                <input type="text" value={data.primaryColor} onChange={e => onChange('primaryColor', e.target.value)} placeholder="#009BAD" className="flex-1 px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 uppercase font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={data.secondaryColor || '#ffffff'} onChange={e => onChange('secondaryColor', e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                <input type="text" value={data.secondaryColor} onChange={e => onChange('secondaryColor', e.target.value)} placeholder="#FFFFFF" className="flex-1 px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 uppercase font-mono" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visual Prompt Keywords</label>
            <textarea value={data.visualStyle} onChange={e => onChange('visualStyle', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] h-20 resize-none text-sm" placeholder="Contoh: Cinematic, minimal, bright lighting..." />
          </div>
        </div>
      </ModalWrapper>

      {/* Brand Overview Modal */}
      <ModalWrapper title="Brand Overview & Core Values" isOpen={activeModal === 'overview'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand Overview</label>
            <textarea value={data.brandOverview} onChange={e => onChange('brandOverview', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] h-24 resize-none text-sm" placeholder="Deskripsikan bisnis Anda secara menyeluruh..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visi</label>
              <textarea value={data.visi} onChange={e => onChange('visi', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] h-20 resize-none text-sm" placeholder="Visi perusahaan..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Misi</label>
              <textarea value={data.misi} onChange={e => onChange('misi', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] h-20 resize-none text-sm" placeholder="Misi perusahaan..." />
            </div>
          </div>
        </div>
      </ModalWrapper>

      {/* Tone Modal */}
      <ModalWrapper title="Audience & Tone" isOpen={activeModal === 'tone'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
            <input type="text" value={data.targetAudience} onChange={e => onChange('targetAudience', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] text-sm" placeholder="Contoh: Gen Z, Profesional Muda..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tone of Voice</label>
            <input type="text" value={data.tone} onChange={e => onChange('tone', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] text-sm" placeholder="Contoh: Profesional, Casual, Friendly (pisahkan dengan koma)" />
          </div>
        </div>
      </ModalWrapper>

      {/* Content Strategy Modal */}
      <ModalWrapper title="Content Strategy" isOpen={activeModal === 'contentStrategy'}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key Vocabulary</label>
              <textarea value={data.keyVocabulary} onChange={e => onChange('keyVocabulary', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] h-20 resize-none text-sm" placeholder="Kata-kata yang sering digunakan..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banned Content</label>
              <textarea value={data.bannedContent} onChange={e => onChange('bannedContent', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] h-20 resize-none text-sm" placeholder="Kata/Topik yang dilarang..." />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Standard CTA</label>
            <input type="text" value={data.standardCTA} onChange={e => onChange('standardCTA', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] text-sm" placeholder="Contoh: Link in bio, Kunjungi website kami..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hashtag Style</label>
            <input type="text" value={data.hashtagStyle} onChange={e => onChange('hashtagStyle', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] text-sm" placeholder="Contoh: #Venturo #Tech #Innovation" />
          </div>
        </div>
      </ModalWrapper>

    </div>
  );
}
