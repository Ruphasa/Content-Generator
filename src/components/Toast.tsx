"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

const toasts = [] as Toast[];
let idCounter = 0;

export function showSuccess(message: string) {
  const id = `toast-${idCounter++}`;
  toasts.push({ id, message, variant: 'success' });
  return id;
}

export function showError(message: string) {
  const id = `toast-${idCounter++}`;
  toasts.push({ id, message, variant: 'error' });
  return id;
}

export function showInfo(message: string) {
  const id = `toast-${idCounter++}`;
  toasts.push({ id, message, variant: 'info' });
  return id;
}

export function showWarning(message: string) {
  const id = `toast-${idCounter++}`;
  toasts.push({ id, message, variant: 'warning' });
  return id;
}

export default function ToastContainer({ toasts: initialToasts, onClose }: ToastProps) {
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    initialToasts.forEach((toast) => {
      const timeout = setTimeout(() => {
        onClose(toast.id);
      }, 4000);

      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [initialToasts, onClose]);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
  };

  const colors = {
    success: 'bg-white/90 border-[var(--venturo-teal)] text-gray-800',
    error: 'bg-white/90 border-red-500 text-gray-800',
    info: 'bg-white/90 border-blue-500 text-gray-800',
    warning: 'bg-white/90 border-orange-500 text-gray-800',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <AnimatePresence>
        {initialToasts.map((toast) => {
          const Icon = icons[toast.variant];
          const colorClass = colors[toast.variant];

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`pointer-events-auto max-w-md w-full mx-4 ${colorClass} backdrop-blur-xl rounded-3xl shadow-2xl border p-5 relative overflow-hidden`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 ${toast.variant === 'success' ? 'text-[var(--venturo-teal)]' : toast.variant === 'error' ? 'text-red-500' : toast.variant === 'info' ? 'text-blue-500' : 'text-orange-500'}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 pr-8">
                  <p className="font-medium text-sm leading-relaxed">{toast.message}</p>
                </div>
                <button
                  onClick={() => onClose(toast.id)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className={`absolute bottom-0 left-0 h-1 ${toast.variant === 'success' ? 'bg-[var(--venturo-teal)]' : toast.variant === 'error' ? 'bg-red-500' : toast.variant === 'info' ? 'bg-blue-500' : 'bg-orange-500'}`} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
