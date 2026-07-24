"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileVideo, HelpCircle, RefreshCw } from 'lucide-react';
import type { VisualGuideData } from './ClientLayout';
import { showSuccess, showError } from './Toast';

interface VisualGuidePageProps {
  data: VisualGuideData;
  onChange: (data: VisualGuideData) => void;
  onOpenSyncModal?: (action?: 'dna' | 'visual' | 'assets' | 'all') => void;
}

export default function VisualGuidePage({ data, onChange, onOpenSyncModal }: VisualGuidePageProps) {
  const updateField = (field: keyof VisualGuideData, value: string) => {
    onChange({ ...data, [field]: value });
  };


  const fields = [
    { id: 'konten', label: 'Konten', type: 'textarea', placeholder: 'Deskripsikan konten yang ingin dibuat (Misal: Video promo diskon lebaran)', required: true },
    { id: 'referensi', label: 'Referensi', type: 'textarea', placeholder: 'Link atau penjelasan referensi video' },
    { id: 'goal', label: 'Goal', type: 'text', placeholder: 'Tujuan video (Awareness, Sales, dll)' },
    { id: 'videoStyle', label: 'Video Style', type: 'text', placeholder: 'Misal: Cinematic, Vlog, Motion Graphics' },
    { id: 'sound', label: 'Sound', type: 'text', placeholder: 'Musik / BGM / Voice Over yang diinginkan' },
    { id: 'caption', label: 'Caption', type: 'textarea', placeholder: 'Ide caption untuk postingan' },
    { id: 'visualFocus', label: 'Visual Focus', type: 'text', placeholder: 'Fokus visual (Produk, Wajah Talent, dll)' },
    { id: 'hook', label: 'Hook', type: 'textarea', placeholder: '3 detik pertama yang menangkap perhatian' },
    { id: 'validasi', label: 'Validasi', type: 'textarea', placeholder: 'Adegan validasi (Misal: Close-up dari belakang model)' },
    { id: 'insight', label: 'Insight', type: 'textarea', placeholder: 'Pesan utama atau wawasan yang disampaikan' },
    { id: 'actionCta', label: 'Action (CTA)', type: 'textarea', placeholder: 'Call to Action di akhir video' },
  ];

  return (
    <div className="flex flex-col gap-6 w-full min-h-full text-gray-800 pb-10 px-2 pt-2">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full flex flex-col gap-2 border-b border-gray-200/50 pb-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--venturo-teal)]/10 flex items-center justify-center text-[var(--venturo-teal)]">
              <FileVideo className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-tight">
                Visual Guide
              </h1>
              <p className="text-sm font-light text-gray-500 italic mt-1">
                Rancang strategi dan arahan spesifik untuk 1 video yang akan dibuat.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        {fields.map((field, idx) => (
          <motion.div 
            key={field.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`flex flex-col gap-2 ${field.type === 'textarea' ? 'md:col-span-2' : ''}`}
          >
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                value={data[field.id as keyof VisualGuideData]}
                onChange={(e) => updateField(field.id as keyof VisualGuideData, e.target.value)}
                placeholder={field.placeholder}
                className="w-full min-h-[100px] p-4 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)]/50 transition-all text-sm resize-y"
              />
            ) : (
              <input
                type="text"
                value={data[field.id as keyof VisualGuideData]}
                onChange={(e) => updateField(field.id as keyof VisualGuideData, e.target.value)}
                placeholder={field.placeholder}
                className="w-full p-4 rounded-xl border border-gray-200 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)]/50 transition-all text-sm"
              />
            )}
          </motion.div>
        ))}
      </div>

    </div>
  );
}
