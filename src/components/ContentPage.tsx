"use client";

import React from 'react';
import { motion } from 'framer-motion';

export default function ContentPage({ progress, videoUrl }: { progress?: { progress: number, message: string, isError?: boolean } | null, videoUrl?: string | null }) {
  // Temporary hardcoded source
  const tempVideos: string[] = [];
  
  // Combine props and hardcoded data
  const allVideos = videoUrl && !tempVideos.includes(videoUrl) ? [videoUrl, ...tempVideos] : tempVideos;

  return (
    <div className="flex flex-col gap-8 w-full min-h-full text-gray-800 pb-12 px-6 pt-6">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full flex flex-col gap-2 border-b border-gray-200/50 pb-8"
      >
        <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-tight">
          Generated Content
        </h1>
        <p className="text-sm font-light text-gray-500 italic mt-1">
          Hasil video AI Anda akan muncul di sini.
        </p>
      </motion.div>

      <div className="flex-1 w-full relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start justify-start content-start">
          
          {progress && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full aspect-square rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 flex flex-col items-center justify-center relative p-8 bg-black/5 backdrop-blur-3xl"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-gray-100/40 to-white/20 animate-pulse pointer-events-none" />
              
              {progress.isError ? (
                <div className="text-center z-10 relative">
                  <h3 className="text-lg font-bold text-red-900/80 mb-2">Generasi Gagal</h3>
                  <p className="text-sm text-red-600/80 font-medium">
                    {progress.message}
                  </p>
                </div>
              ) : (
                <div className="text-center z-10 relative w-full flex flex-col gap-2">
                  <motion.div 
                    key={progress.message}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-base text-gray-800/90 font-medium tracking-wide"
                  >
                    {progress.message}
                  </motion.div>
                  <div className="text-xs font-bold text-gray-400/80 tracking-widest">{Math.round(progress.progress)}%</div>
                </div>
              )}
            </motion.div>
          )}

          {allVideos.map((vid, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="w-full aspect-square bg-gray-900 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-black/5 relative group hover:shadow-[0_12px_40px_rgb(0,0,0,0.12)] transition-shadow duration-300"
            >
              <video 
                src={vid} 
                controls 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </motion.div>
          ))}

          {!progress && allVideos.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full aspect-square bg-gray-50/50 rounded-3xl border border-gray-200/50 flex flex-col items-center justify-center p-8 shadow-sm backdrop-blur-sm"
            >
              <h3 className="text-sm font-medium text-gray-400 tracking-wider">
                Belum Ada Content
              </h3>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
