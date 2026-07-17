"use client";

import React from 'react';
import { Pencil } from 'lucide-react';
import { DNAData } from './ClientLayout';

interface BusinessDetailsFormProps {
  data: DNAData;
  onChange: (field: keyof DNAData, value: any) => void;
}

export default function BusinessDetailsForm({ data, onChange }: BusinessDetailsFormProps) {
  
  const fields: { key: keyof DNAData; label: string; placeholder: string }[] = [
    { key: 'location', label: 'Location', placeholder: 'Alamat lengkap...' },
    { key: 'phoneNumber', label: 'Phone Number', placeholder: '+62 812...' },
    { key: 'businessHours', label: 'Business Hours', placeholder: 'Senin - Jumat (09:00 - 17:00)' },
    { key: 'keywords', label: 'Keywords', placeholder: 'Tech, Software, Digital...' },
    { key: 'socialLinks', label: 'Social Links', placeholder: 'Instagram, LinkedIn, dll' },
    { key: 'callToActionLinks', label: 'Call-to-Action Links', placeholder: 'https://wa.me/...' },
    { key: 'testimonials', label: 'Testimonials', placeholder: 'Kutipan review pelanggan...' },
  ];

  return (
    <div className="flex flex-col gap-6 w-full h-full text-gray-800">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field, idx) => (
          <div 
            key={idx} 
            className={`glass bg-white/40 border border-white/50 rounded-xl p-4 flex items-center relative transition-all focus-within:ring-2 focus-within:ring-[var(--venturo-teal)] ${
              field.key === 'testimonials' ? 'md:col-span-2' : ''
            }`}
          >
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                {field.label}
              </label>
              <input 
                type="text"
                value={data[field.key] as string}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full bg-transparent border-none outline-none text-sm font-medium text-gray-700 placeholder:text-gray-400 placeholder:font-normal"
              />
            </div>
            <div className="w-8 h-8 rounded-full bg-[var(--venturo-teal)]/10 flex items-center justify-center text-[var(--venturo-teal)] absolute right-4 cursor-pointer hover:bg-[var(--venturo-teal)]/20 transition-colors">
              <Pencil className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>
      
    </div>
  );
}
