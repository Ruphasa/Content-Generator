"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import DNAForm from './DNAForm';
import BusinessDetailsForm from './BusinessDetailsForm';
import ContentPage from './ContentPage';
import VisualGuidePage from './VisualGuidePage';
import AssetsPage from './AssetsPage';
import SidecarChatbot from './SidecarChatbot';
import ToastContainer, { showSuccess, showError, showInfo } from './Toast';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Beaker, Folder, PanelLeftClose, PanelLeftOpen, User, LayoutDashboard, LayoutTemplate, FileVideo, RefreshCw } from 'lucide-react';
import { syncAll } from '@/app/actions/sync';

export type AssetFolder = {
  id: string;
  name: string;
  files: File[];
  remoteUrls?: { url: string; filename?: string }[];
};

export type VisualGuideData = {
  konten: string;
  referensi: string;
  goal: string;
  videoStyle: string;
  sound: string;
  caption: string;
  visualFocus: string;
  hook: string;
  validasi: string;
  insight: string;
  actionCta: string;
};

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
  primaryFont: string;
  secondaryFont: string;
  primaryColor: string;
  secondaryColor: string;
  hashtagStyle: string;
  logoBase64?: string;

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
    keyVocabulary: '', bannedContent: '', standardCTA: '', tone: '', visualStyle: '', primaryFont: '', secondaryFont: '',
    primaryColor: '', secondaryColor: '', hashtagStyle: '',
    location: '', businessHours: '', socialLinks: '', testimonials: '', phoneNumber: '', keywords: '', callToActionLinks: ''
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');
  const [activePage, setActivePage] = useState<'dna' | 'assets' | 'visual' | 'content'>('dna');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [session, setSession] = useState<any>(null);

  const [globalAssets, setGlobalAssets] = useState<File[]>([]);
  const [assetFolders, setAssetFolders] = useState<AssetFolder[]>([]);
  const [visualGuide, setVisualGuide] = useState<VisualGuideData>({
    konten: '', referensi: '', goal: '', videoStyle: '', sound: '', caption: '', visualFocus: '', hook: '', validasi: '', insight: '', actionCta: ''
  });

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  
  const [generateProgress, setGenerateProgress] = useState<{ progress: number, message: string } | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState('');
  const toastIdsRef: React.MutableRefObject<string[]> = { current: [] };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const navItems = [
    { id: 'dna', name: 'Business DNA', icon: LayoutDashboard },
    { id: 'assets', name: 'Assets', icon: Folder },
    { id: 'visual', name: 'Visual Guide', icon: FileVideo },
    { id: 'content', name: 'Content', icon: LayoutTemplate },
  ];

  useEffect(() => {
    const saved = localStorage.getItem('dna_form_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDnaData(prev => ({ ...prev, ...parsed }));
      } catch (e) {}
    }
    const savedGuide = localStorage.getItem('visual_guide_state');
    if (savedGuide) {
      try { setVisualGuide(JSON.parse(savedGuide)); } catch (e) {}
    }
    const savedFolders = localStorage.getItem('asset_folders_state');
    if (savedFolders) {
        try { setAssetFolders(JSON.parse(savedFolders).map((f: any) => ({ ...f, files: [] }))); } catch (e) {}
    }
    const savedSpreadsheetId = localStorage.getItem('global_spreadsheet_id');
    if (savedSpreadsheetId) {
      setSpreadsheetIdInput(savedSpreadsheetId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem('dna_form_state', JSON.stringify(dnaData));
  }, [dnaData]);

  useEffect(() => {
    localStorage.setItem('visual_guide_state', JSON.stringify(visualGuide));
  }, [visualGuide]);

  useEffect(() => {
    localStorage.setItem('asset_folders_state', JSON.stringify(assetFolders.map(f => ({ ...f, files: [] }))));
  }, [assetFolders]);

  const updateDNA = (field: keyof DNAData, value: any) => {
    setDnaData(prev => ({ ...prev, [field]: value }));
  };

  const updateMultipleDNA = (updates: Partial<DNAData>) => {
    setDnaData(prev => ({ ...prev, ...updates }));
  };

  const handleGenerateClick = () => {
    // Validasi DNA Form
    if (!dnaData.brandName) {
      showError("Mohon lengkapi Business DNA (minimal Brand Name) sebelum membuat konten.");
      return;
    }
    // Validasi Visual Guide
    if (!visualGuide.konten) {
      showError("Mohon isi kolom 'Konten' di tab Visual Guide.");
      return;
    }
    setIsGenerateModalOpen(true);
  };

    const handleConfirmGenerate = async () => {
    setIsGenerateModalOpen(false);
    setActivePage('content'); // <--- Redirect ke Content Page
    setGenerateProgress({ progress: 5, message: "Menyiapkan sistem..." }); // Initial state
    setGeneratedVideoUrl(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'anonymous_user';

      const uploadedGlobalUrls: string[] = [];
      const uploadedFolderUrls: string[] = [];
      
      const uploadFiles = async (files: File[], targetArray: string[], folderPath: string) => {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${userId}/${folderPath}/${fileName}`;

          const { data, error } = await supabase.storage.from('assets').upload(filePath, file);

          if (error) {
            console.error("Error uploading file:", error);
            if (error.message.includes('bucket not found')) {
              showInfo("PERINGATAN: Bucket 'assets' belum dibuat di Supabase Dashboard.");
            }
          } else if (data) {
            const { data: publicUrlData } = supabase.storage.from('assets').getPublicUrl(filePath);
            targetArray.push(publicUrlData.publicUrl);
          }
        }
      };

      if (globalAssets.length > 0 || selectedFolderId) {
        setGenerateProgress({ progress: 10, message: "Mengunggah aset ke Supabase Storage..." });
        await uploadFiles(globalAssets, uploadedGlobalUrls, 'global');
        
        if (selectedFolderId) {
          const folder = assetFolders.find(f => f.id === selectedFolderId);
          if (folder && folder.files.length > 0) {
            await uploadFiles(folder.files, uploadedFolderUrls, `folder_${folder.id}`);
          }
        }
      }

      const allAssetUrls = [...uploadedGlobalUrls, ...uploadedFolderUrls];
      const hasFootage = allAssetUrls.length > 0;
      let url: string = '';

      if (!hasFootage) {
        // === FLOW A: NO FOOTAGE AVAILABLE ===
        // This flow previously generated video from scratch via the Dreamina browser-automation
        // pipeline (src/lib/dreamina), which has been removed as part of the migration to a local
        // ComfyUI pipeline. AI video generation without footage is unavailable until that pipeline
        // lands (see docs/superpowers/plans/2026-07-28-comfyui-local-pipeline.md).
        throw new Error("Generasi video AI tanpa footage belum tersedia (menunggu integrasi ComfyUI). Silakan unggah aset/footage terlebih dahulu.");
      } else {
        // === FLOW B: FOOTAGE AVAILABLE ===
        // 1. Director Phase 1 (Scripting)
        setGenerateProgress({ progress: 15, message: "Fase 1/5: Menulis naskah narasi utama..." });
        const scriptRes = await fetch('/api/generate/director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'script_only', dna: dnaData, visualGuide })
        }).then(r => r.json());

        if (!scriptRes.success) throw new Error(scriptRes.error || "Gagal membuat naskah.");

        // 2. TTS Gen & Extract Duration
        setGenerateProgress({ progress: 35, message: "Fase 2/5: Generasi suara TTS & ukur durasi pasti..." });
        const ttsRes = await fetch('/api/generate/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: scriptRes.narration, voice: "id-ID-AndikaNeural" })
        }).then(r => r.json());

        if (!ttsRes.success) throw new Error(ttsRes.error || "Gagal membuat TTS.");

        const ttsDuration = ttsRes.duration || 10.0;

        // 3. Director Phase 2 (Multimodal Scene Planning to match ttsDuration)
        setGenerateProgress({ progress: 55, message: `Fase 3/5: Menyusun & memotong adegan video (target ${ttsDuration.toFixed(1)}s)...` });
        const sceneRes = await fetch('/api/generate/director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'scene_planning',
            dna: dnaData,
            visualGuide,
            assetUrls: allAssetUrls,
            targetDuration: ttsDuration
          })
        }).then(r => r.json());

        if (!sceneRes.success) throw new Error(sceneRes.error || "Gagal merancang potongan adegan.");

        // Check if any filler video is needed
        const needsFiller = sceneRes.scenes?.some((s: any) => s.type === 'generated');
        if (needsFiller) {
          // AI filler-video generation previously used the Dreamina browser-automation pipeline,
          // which has been removed as part of the migration to a local ComfyUI pipeline. Scenes
          // requiring generated filler footage cannot be fulfilled until that pipeline lands.
          throw new Error("Generasi video filler AI belum tersedia (menunggu integrasi ComfyUI). Pastikan aset footage mencukupi durasi target.");
        }

        // 4. BGM Gen
        setGenerateProgress({ progress: 75, message: "Membuat musik BGM..." });
        const bgmRes = await fetch('/api/generate/bgm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: scriptRes.bgmPrompt })
        }).then(r => r.json());

        if (!bgmRes.success) throw new Error(bgmRes.error || "Gagal membuat BGM.");

        // 5. Stitching
        setGenerateProgress({ progress: 90, message: "Menjahit potongan video aset & audio (FFmpeg)..." });
        const stitchRes = await fetch('/api/generate/stitch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ttsBase64: ttsRes.audioBase64,
            bgmBase64: bgmRes.audioBase64,
            srtContent: ttsRes.srtContent,
            scenes: sceneRes.scenes,
            generatedVideoUrl: null
          })
        }).then(r => r.json());

        if (!stitchRes.success) throw new Error(stitchRes.error || "Gagal menjahit video.");
        url = stitchRes.videoUrl;
      }

      setGeneratedVideoUrl(url);
      setGenerateProgress(null);
      showSuccess("Video berhasil dibuat!");

    } catch (err: any) {
      console.error(err);
      showError(err.message || "Terjadi kesalahan sistem saat memproses video.");
      // Tampilkan error di dalam card progress!
      setGenerateProgress({ progress: 100, message: err.message || "Terjadi kesalahan", isError: true } as any);
    }
  };

  const handleSyncAll = async () => {
    if (!spreadsheetIdInput) {
      showError("Mohon masukkan Spreadsheet ID");
      return;
    }
    localStorage.setItem('global_spreadsheet_id', spreadsheetIdInput);
    setIsSyncingAll(true);
    try {
      const result = await syncAll(spreadsheetIdInput);
      if (result.success && result.data) {
        showSuccess(result.message);
        if (result.data.dnaData) updateMultipleDNA(result.data.dnaData);
        if (result.data.visualGuide) setVisualGuide(prev => ({ ...prev, ...result.data.visualGuide }));
        if (result.data.folders) setAssetFolders(result.data.folders);
        setIsSpreadsheetModalOpen(false);
      } else {
        showError(result.message);
      }
    } catch (error: any) {
      console.error(error);
      showError(error.message || "Gagal melakukan Global Sync");
    } finally {
      setIsSyncingAll(false);
    }
  };

  const openSyncModal = (action?: 'dna' | 'visual' | 'assets' | 'all') => {
    setIsSpreadsheetModalOpen(true);
  };

  const isFormValid = dnaData.brandName.trim() !== '';

  return (
    <div className="flex w-full h-full overflow-hidden relative">



      {/* 1. LEFT SIDEBAR */}
      <aside className={`h-full flex-shrink-0 flex flex-col pt-4 z-30 transition-all duration-300 ${isSidebarOpen ? 'w-64 pr-4' : 'w-20 px-2 items-center'}`}>
        <div className={`mb-6 flex items-center ${isSidebarOpen ? 'justify-between pl-4' : 'justify-center w-full h-8'} relative group/sidebarToggle`}>
          {isSidebarOpen ? (
            <div className="flex items-center">
              <img src="/logo/venturo-logo.png" alt="Venturo Pro" className="h-8 w-auto object-contain" />
            </div>
          ) : (
            <img src="/logo/logo-single.png" alt="Venturo" className="w-6 h-6 group-hover/sidebarToggle:opacity-0 transition-opacity absolute object-contain" />
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`text-gray-400 hover:text-[var(--venturo-teal)] transition-all ${!isSidebarOpen ? 'absolute opacity-0 group-hover/sidebarToggle:opacity-100 scale-75 group-hover/sidebarToggle:scale-100' : ''}`}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-6 h-6" />}
          </button>
        </div>

        <nav className="flex flex-col gap-1 w-full">
          {navItems.map((item, idx) => (
            <button
              key={idx}
              title={!isSidebarOpen ? item.name : undefined}
              onClick={() => setActivePage(item.id as any)}
              className={`flex items-center rounded-lg transition-all ${
                  isSidebarOpen 
                    ? 'w-full gap-3 px-4 py-2.5 text-sm' 
                    : 'w-12 h-12 justify-center mx-auto'
                } ${activePage === item.id
                  ? 'bg-[var(--venturo-teal)]/20 text-[var(--venturo-dark)] font-semibold glass'
                  : 'text-gray-600 hover:bg-white/40 font-medium'
                }`}
            >
              {item.icon && <item.icon className={isSidebarOpen ? "w-4 h-4" : "w-5 h-5"} />}
              {isSidebarOpen && item.name}
            </button>
          ))}
        </nav>
      </aside>

      {/* 2. CENTER CONTENT (Brand Card Layout) */}
      <main className="flex-1 h-full flex flex-col px-4 min-w-0 pt-8 pb-4 relative z-10">
        
        {/* User Profile & Global Sync */}
        <div className="absolute top-6 right-6 flex items-center gap-4 z-20">
          <button
            onClick={() => openSyncModal('all')}
            className="flex items-center gap-2 px-4 py-1.5 bg-[var(--venturo-teal)]/10 border border-[var(--venturo-teal)]/30 rounded-full hover:bg-[var(--venturo-teal)]/20 transition-all shadow-sm group"
          >
            <RefreshCw className="w-4 h-4 text-[var(--venturo-teal)] group-hover:rotate-180 transition-transform duration-500" />
            <span className="text-xs font-semibold text-[var(--venturo-teal)]">Global Sync</span>
          </button>
          {session ? (
            <button 
              onClick={async () => { await supabase.auth.signOut(); }}
              title="Logout"
              className="flex items-center gap-2 pl-3 pr-1 py-1 bg-white/50 border border-white/60 rounded-full hover:bg-white/70 transition-all shadow-sm group"
            >
              <span className="text-xs font-semibold text-gray-700 truncate max-w-[120px]">{session.user?.email || 'User'}</span>
              <div className="w-8 h-8 rounded-full bg-[var(--venturo-teal)] flex items-center justify-center text-white group-hover:bg-red-500 transition-colors">
                <User className="w-4 h-4" />
              </div>
            </button>
          ) : (
            <button 
              onClick={() => router.push('/login')}
              className="flex items-center gap-2 pl-3 pr-1 py-1 bg-white/50 border border-[var(--venturo-teal)]/30 rounded-full hover:bg-white/70 hover:border-[var(--venturo-teal)] transition-all shadow-sm group"
            >
              <span className="text-xs font-semibold text-[var(--venturo-teal)]">Login</span>
              <div className="w-8 h-8 rounded-full bg-[var(--venturo-teal)]/10 group-hover:bg-[var(--venturo-teal)] flex items-center justify-center text-[var(--venturo-teal)] group-hover:text-white transition-colors">
                <User className="w-4 h-4" />
              </div>
            </button>
          )}
        </div>

        <header className="text-center mb-6 mt-4">
          <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Your Business DNA</h1>
          <p className="text-gray-500 text-sm">Unlock the power to generate product photos, marketing campaigns, a website, and more</p>
        </header>

        {activePage === 'dna' && (
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
        )}

        {/* Content Container (The Glass Card) */}
        <div className={`flex-1 w-full max-w-5xl mx-auto glass rounded-3xl ${activePage === 'dna' ? 'rounded-t-none border-t-0 top-0' : 'mt-4'} flex flex-col overflow-hidden shadow-2xl shadow-[var(--venturo-teal)]/20 relative transition-all duration-300`}>

          <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
            {activePage === 'dna' && (
              <>
                 {activeTab === 'overview' ? (
                  <DNAForm data={dnaData} onChange={updateDNA} onModalChange={setActiveModal} onOpenSyncModal={openSyncModal} />
                ) : (
                  <BusinessDetailsForm data={dnaData} onChange={updateDNA} />
                )}
                <div className="h-40 w-full flex-shrink-0" />
              </>
            )}
            {activePage === 'visual' && <VisualGuidePage data={visualGuide} onChange={(d) => setVisualGuide(d)} onOpenSyncModal={openSyncModal} />}
            {activePage === 'assets' && (
              <AssetsPage 
                globalAssets={globalAssets} 
                setGlobalAssets={setGlobalAssets}
                assetFolders={assetFolders}
                setAssetFolders={setAssetFolders}
              />
            )}
            {activePage === 'content' && <ContentPage progress={generateProgress} videoUrl={generatedVideoUrl} />}
          </div>

          {/* Floating Action Buttons with Fade */}
          <div className="absolute bottom-0 left-0 w-full pt-12 pb-6 px-6 bg-gradient-to-t from-[var(--venturo-teal)]/30 via-[var(--venturo-teal)]/10 to-transparent flex justify-center gap-4 pointer-events-none">
            {activePage !== 'content' && (
              <>
                <button className="pointer-events-auto px-8 py-2.5 rounded-full bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm transition-colors shadow-lg">
                  Reset
                </button>
                <button
                  onClick={handleGenerateClick}
                  disabled={!isFormValid}
                  className={`pointer-events-auto px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition-all hover:scale-105 active:scale-95 ${isFormValid
                      ? 'bg-gradient-to-r from-[var(--venturo-teal)] to-[var(--venturo-dark)] text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  Generate Content
                </button>
              </>
            )}
          </div>
        </div>

        {/* Generate Modal */}
        {isGenerateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 flex flex-col gap-4">
              <h3 className="text-xl font-bold text-gray-900">Pilih Aset untuk Konten Ini</h3>
              <p className="text-sm text-gray-500">
                Pilih folder tambahan untuk konten ini. Jika tidak memilih folder, akan menggunakan aset global saja.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Folder Cards */}
                {assetFolders.map(f => (
                  <div 
                    key={f.id}
                    onClick={() => setSelectedFolderId(selectedFolderId === f.id ? '' : f.id)}
                    className="group flex flex-col items-center justify-center p-6 cursor-pointer transition-transform hover:scale-105"
                  >
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-colors ${
                      selectedFolderId === f.id 
                        ? 'bg-[var(--venturo-teal)]/20' 
                        : 'bg-[var(--venturo-teal)]/10'
                    }`}>
                      <Folder className={`w-8 h-8 fill-current transition-opacity ${
                        selectedFolderId === f.id ? 'opacity-100' : 'opacity-60'
                      }`} />
                    </div>
                    <h4 className={`font-semibold text-center ${
                      selectedFolderId === f.id ? 'text-[var(--venturo-teal)]' : 'text-gray-600'
                    }`}>{f.name}</h4>
                    <p className="text-xs text-gray-500 mt-1 text-center">{(f.files?.length || 0) + (f.remoteUrls?.length || 0)} files</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button 
                  onClick={() => setIsGenerateModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleConfirmGenerate}
                  className="px-5 py-2.5 rounded-xl font-bold bg-[var(--venturo-teal)] text-white shadow-lg hover:bg-[var(--venturo-dark)] transition-colors flex items-center gap-2"
                >
                  Kirim ke AI Auto
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. RIGHT PANEL (AI CHATBOT) */}
      <aside className="w-[380px] h-full flex-shrink-0 pt-4 z-20">
        <SidecarChatbot 
          dnaData={dnaData} 
          isReady={true} 
          activeModal={activeModal} 
          onApplySuggestion={updateMultipleDNA}
        />
      </aside>

      {/* Toast Container */}
      <ToastContainer toasts={[]} onClose={(id) => {
        const index = toastIdsRef.current.indexOf(id);
        if (index > -1) {
          toastIdsRef.current.splice(index, 1);
        }
      }} />

      {/* Sync Spreadsheet Modal */}
      {isSpreadsheetModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 flex flex-col gap-4"
          >
            <h3 className="text-xl font-bold text-gray-900">
              Global Sync
            </h3>
            <p className="text-sm text-gray-500">
              Masukkan Spreadsheet ID untuk menarik Brand DNA, Visual Guide, dan Assets sekaligus.
            </p>

            <input
              type="text"
              value={spreadsheetIdInput}
              onChange={(e) => setSpreadsheetIdInput(e.target.value)}
              placeholder="Paste Spreadsheet ID here..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] transition-all text-gray-800"
            />

            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setIsSpreadsheetModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                className="px-5 py-2.5 rounded-xl font-bold bg-[var(--venturo-teal)] text-white shadow-lg hover:bg-[var(--venturo-dark)] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSyncingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync All Data
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
