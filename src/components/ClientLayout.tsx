"use client";

import React, { useState, useEffect } from 'react';
import DNAForm from './DNAForm';
import BusinessDetailsForm from './BusinessDetailsForm';
import SidecarChatbot from './SidecarChatbot';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Beaker, Search, Folder, PanelLeftClose, MoreVertical, User, LayoutDashboard, LayoutTemplate } from 'lucide-react';

export type DNAData = {
  // Brand Overview
  brandName: string;
  tagline: string;
  brandOverview: string;
  visi: string;
  misi: string;
  targetAudience: string;
  keyVocabulary: string;
  bannedContent: string;
  standardCTA: string;
  tone: string;
  visualStyle: string;
  typography: string;
  primaryColor: string;
  secondaryColor: string;
  hashtagStyle: string;
  assets: File[];

  // Business Details
  location: string;
  businessHours: string;
  socialLinks: string;
  testimonials: string;
  phoneNumber: string;
  keywords: string;
  callToActionLinks: string;
};

export default function ClientLayout() {
  const router = useRouter();
  const supabase = createClient();

  const [dnaData, setDnaData] = useState<DNAData>({
    brandName: '', tagline: '', brandOverview: '', visi: '', misi: '', targetAudience: '',
    keyVocabulary: '', bannedContent: '', standardCTA: '', tone: '', visualStyle: '', typography: '',
    primaryColor: '', secondaryColor: '', hashtagStyle: '', assets: [],
    location: '', businessHours: '', socialLinks: '', testimonials: '', phoneNumber: '', keywords: '', callToActionLinks: ''
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');
  const [activeModal, setActiveModal] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('dna_form_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDnaData(prev => ({ ...prev, ...parsed, assets: [] }));
      } catch (e) {
        console.error('Failed to parse saved DNA state');
      }
    }
  }, []);

  useEffect(() => {
    const { assets, ...dataToSave } = dnaData;
    localStorage.setItem('dna_form_state', JSON.stringify(dataToSave));
  }, [dnaData]);

  const updateDNA = (field: keyof DNAData, value: any) => {
    setDnaData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateVideo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const uploadedUrls: string[] = [];
      if (dnaData.assets && dnaData.assets.length > 0) {
        alert("Mengunggah video aset ke Supabase Storage...");
        for (const file of dnaData.assets) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${session.user.id}/${fileName}`;

          const { data, error } = await supabase.storage.from('assets').upload(filePath, file);

          if (error) {
            console.error("Error uploading file:", error);
            if (error.message.includes('bucket not found')) {
              alert("PERINGATAN: Bucket 'assets' belum dibuat di Supabase Dashboard.");
              return;
            }
          } else if (data) {
            const { data: publicUrlData } = supabase.storage.from('assets').getPublicUrl(filePath);
            uploadedUrls.push(publicUrlData.publicUrl);
          }
        }
      }

      const finalPayload = {
        ...dnaData,
        assets: uploadedUrls,
        userId: session.user.id
      };

      console.log("Payload yang akan dikirim ke Worker:", finalPayload);
      alert("Berhasil! Data DNA dan Video siap dikirim ke AI Worker: " + JSON.stringify(finalPayload, null, 2));

    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan sistem saat mencoba memproses video.");
    }
  };

  const isFormValid = dnaData.brandName.trim() !== '';

  const navItems = [
    { name: 'Business DNA', icon: LayoutDashboard, active: true },
    { name: 'Assets', icon: Folder },
    { name: 'Content', icon: LayoutTemplate },
  ];

  return (
    <div className="flex w-full h-full overflow-hidden relative">

      {/* GLOBAL TOP HEADER (User Profile & Menu) - Absolute positioned to not push layout */}
      <div className="absolute top-0 right-0 w-full h-16 flex items-center justify-end px-6 z-20 pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <button className="p-2 text-gray-500 hover:text-gray-800 transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 pl-3 pr-1 py-1 bg-white/50 border border-white/60 rounded-full hover:bg-white/70 transition-all shadow-sm">
            <span className="text-xs font-semibold text-gray-700">Guest User</span>
            <div className="w-8 h-8 rounded-full bg-[var(--venturo-teal)] flex items-center justify-center text-white">
              <User className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>

      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 h-full flex-shrink-0 pr-4 flex flex-col pt-4 z-30">
        <div className="mb-6 flex items-center justify-between pl-4">
          <div className="flex items-center gap-2">
            <Beaker className="w-6 h-6 text-[var(--venturo-teal)]" />
            <h2 className="text-xl font-bold tracking-tight text-gray-800">Venturo Pro</h2>
          </div>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 w-full">
          {navItems.map((item, idx) => (
            <button
              key={idx}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${item.active
                  ? 'bg-[var(--venturo-teal)]/20 text-[var(--venturo-dark)] font-semibold glass'
                  : 'text-gray-600 hover:bg-white/40 font-medium'
                }`}
            >
              {item.icon && <item.icon className="w-4 h-4" />}
              {item.name}
            </button>
          ))}
        </nav>
      </aside>

      {/* 2. CENTER CONTENT (Brand Card Layout) */}
      <main className="flex-1 h-full flex flex-col px-4 min-w-0 pt-8 pb-4 relative z-10">
        <header className="text-center mb-6">
          <h1 className="font-serif text-4xl italic text-gray-900 mb-2">Your Business DNA</h1>
          <p className="text-gray-500 text-sm">Unlock the power to generate product photos, marketing campaigns, a website, and more</p>
        </header>

        {/* Tabs */}
        <div className="flex gap-2 mx-auto w-full max-w-5xl mb-0 relative top-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 px-6 rounded-t-2xl font-medium text-sm transition-all ${activeTab === 'overview'
                ? 'bg-white/60 backdrop-blur-md shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] text-gray-800 border-t border-l border-r border-white/40'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'
              }`}
          >
            Brand Overview
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-3 px-6 rounded-t-2xl font-medium text-sm transition-all ${activeTab === 'details'
                ? 'bg-white/60 backdrop-blur-md shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] text-gray-800 border-t border-l border-r border-white/40'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'
              }`}
          >
            Business Details
          </button>
        </div>

        {/* Content Container (The Glass Card) */}
        <div className="flex-1 w-full max-w-5xl mx-auto glass rounded-2xl rounded-t-none flex flex-col overflow-hidden shadow-xl border-t-0 relative">

          <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pb-24">
            {activeTab === 'overview' ? (
              <DNAForm data={dnaData} onChange={updateDNA} onModalChange={setActiveModal} />
            ) : (
              <BusinessDetailsForm data={dnaData} onChange={updateDNA} />
            )}
          </div>

          {/* Floating Action Buttons with Fade */}
          <div className="absolute bottom-0 left-0 w-full pt-12 pb-6 px-6 bg-gradient-to-t from-white via-white/80 to-transparent flex justify-center gap-4 pointer-events-none">
            <button className="pointer-events-auto px-8 py-2.5 rounded-full bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm transition-colors shadow-lg">
              Reset
            </button>
            <button
              onClick={handleCreateVideo}
              disabled={!isFormValid}
              className={`pointer-events-auto px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition-all hover:scale-105 active:scale-95 ${isFormValid
                  ? 'bg-gradient-to-r from-[var(--venturo-teal)] to-[var(--venturo-dark)] text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
              Create Content
            </button>
          </div>
        </div>
      </main>

      {/* 3. RIGHT SIDEBAR (Chatbot) */}
      <aside className="w-[340px] h-full flex-shrink-0 pl-4 pt-16 pb-4 relative z-30">
        <SidecarChatbot
          dnaData={dnaData}
          isReady={true}
          activeModal={activeModal}
        />
      </aside>

    </div>
  );
}
