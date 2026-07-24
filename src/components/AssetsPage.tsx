"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Folder, UploadCloud, Plus, ArrowLeft, Trash2, File as FileIcon, X, ExternalLink } from 'lucide-react';
import type { AssetFolder } from './ClientLayout';

interface AssetsPageProps {
  globalAssets: File[];
  setGlobalAssets: React.Dispatch<React.SetStateAction<File[]>>;
  assetFolders: AssetFolder[];
  setAssetFolders: React.Dispatch<React.SetStateAction<AssetFolder[]>>;
}

export default function AssetsPage({ globalAssets, setGlobalAssets, assetFolders, setAssetFolders }: AssetsPageProps) {
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolder = () => {
    setIsCreateModalOpen(true);
    setNewFolderName('');
  };

  const confirmCreateFolder = () => {
    if (newFolderName.trim() !== "") {
      const newFolder: AssetFolder = {
        id: Date.now().toString(),
        name: newFolderName.trim(),
        files: []
      };
      setAssetFolders([...assetFolders, newFolder]);
    }
    setIsCreateModalOpen(false);
    setNewFolderName('');
  };

  const handleDeleteFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteFolder = () => {
    if (folderToDelete) {
      setAssetFolders(folders => folders.filter(f => f.id !== folderToDelete));
      setFolderToDelete(null);
    }
    setIsDeleteModalOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      if (activeFolderId) {
        setAssetFolders(folders => 
          folders.map(f => f.id === activeFolderId ? { ...f, files: [...f.files, ...filesArray] } : f)
        );
      } else {
        setGlobalAssets(prev => [...prev, ...filesArray]);
      }
    }
  };

  const activeFolder = activeFolderId ? assetFolders.find(f => f.id === activeFolderId) : null;
  const currentFiles = activeFolder ? activeFolder.files : globalAssets;
  const currentRemoteUrls = activeFolder ? (activeFolder.remoteUrls || []) : [];

  return (
    <div className="flex flex-col gap-6 w-full min-h-full text-gray-800 pb-10 px-2 pt-2">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full flex flex-col gap-2 border-b border-gray-200/50 pb-6"
      >
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-tight">
              {activeFolder ? `Folder: ${activeFolder.name}` : 'Brand Assets'}
            </h1>
            <p className="text-sm font-light text-gray-500 italic mt-1">
              {activeFolder 
                ? 'Aset khusus untuk rancangan konten ini.'
                : 'Kelola aset global dan folder-folder aset spesifik.'}
            </p>
          </div>
          
          {!activeFolderId ? (
            <button 
              onClick={handleCreateFolder}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--venturo-teal)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--venturo-dark)] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Folder Baru
            </button>
          ) : (
            <button 
              onClick={() => setActiveFolderId(null)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
          )}
        </div>
      </motion.div>

      {/* Folders List (Only shown on Global View) */}
      {!activeFolderId && assetFolders.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
          <h3 className="font-bold text-gray-700 text-sm">Asset Folders</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {assetFolders.map(folder => (
              <div 
                key={folder.id}
                onClick={() => setActiveFolderId(folder.id)}
                className="group flex flex-col bg-white border border-gray-200 hover:border-[var(--venturo-teal)] rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[var(--venturo-teal)]/10 group-hover:text-[var(--venturo-teal)] transition-colors mb-3">
                  <Folder className="w-5 h-5 fill-current opacity-20" />
                </div>
                <h4 className="font-semibold text-gray-800 truncate pr-6">{folder.name}</h4>
                <p className="text-xs text-gray-500">{(folder.files?.length || 0) + (folder.remoteUrls?.length || 0)} files</p>
                
                <button 
                  onClick={(e) => handleDeleteFolder(folder.id, e)}
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Upload Area for Current Context */}
      <div className="flex flex-col gap-3 mt-4">
        <h3 className="font-bold text-gray-700 text-sm">
          {activeFolder ? 'Files in Folder' : 'Global Assets'}
        </h3>
        <label className="w-full glass bg-white/70 hover:bg-white/95 rounded-2xl p-6 border border-white/60 border-dashed hover:border-[var(--venturo-teal)] shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 cursor-pointer group min-h-[160px]">
          <input type="file" multiple className="hidden" onChange={handleFileUpload} />
          <div className="w-12 h-12 rounded-full bg-[var(--venturo-teal)]/10 text-[var(--venturo-teal)] flex items-center justify-center group-hover:scale-110 transition-transform">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-gray-800 text-sm">Upload Aset {activeFolder ? 'ke Folder Ini' : 'Global'}</h3>
            <p className="text-xs text-gray-500 mt-1">Klik atau tarik file ke area ini</p>
          </div>
        </label>
      </div>

      {/* File List */}
      {currentFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
          {currentFiles.map((file, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="w-8 h-8 flex-shrink-0 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center">
                <FileIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700 truncate">{file.name}</p>
                <p className="text-[10px] text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Remote Urls List */}
      {currentRemoteUrls.length > 0 && (
        <div className="flex flex-col gap-3 mt-4">
          <h3 className="font-bold text-gray-700 text-sm">Remote Assets (Google Drive)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {currentRemoteUrls.map((remote, idx) => (
              <a 
                key={`remote-${idx}`} 
                href={remote.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-[var(--venturo-teal)] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 flex-shrink-0 bg-[var(--venturo-teal)]/10 text-[var(--venturo-teal)] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate group-hover:text-[var(--venturo-teal)] transition-colors">{remote.filename || `Remote Asset ${idx + 1}`}</p>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1">Open in Drive <ExternalLink className="w-3 h-3" /></p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 flex flex-col gap-4"
          >
            <h3 className="text-xl font-bold text-gray-900">Nama Folder Baru</h3>

            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Masukkan nama folder..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--venturo-teal)] transition-all text-gray-800"
              autoFocus
            />

            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewFolderName('');
                }}
                className="px-5 py-2.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmCreateFolder}
                disabled={newFolderName.trim() === ''}
                className="px-5 py-2.5 rounded-xl font-bold bg-[var(--venturo-teal)] text-white shadow-lg hover:bg-[var(--venturo-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Buat Folder
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && folderToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 flex flex-col gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                <X className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Hapus Folder?</h3>
                <p className="text-sm text-gray-500">
                  Apakah Anda yakin ingin menghapus folder <strong>{`"${assetFolders.find(f => f.id === folderToDelete)?.name}"`}</strong> beserta semua isinya? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setFolderToDelete(null);
                }}
                className="px-5 py-2.5 rounded-xl font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteFolder}
                className="px-5 py-2.5 rounded-xl font-bold bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
              >
                Hapus
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
