import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { isolateUserAccount } from '../../services/roleService';

interface IsolateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  institutionId: string;
  userEmail: string;
  onSuccess: () => void;
}

export const IsolateUserModal: React.FC<IsolateUserModalProps> = ({ 
  isOpen, onClose, userId, institutionId, userEmail, onSuccess 
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIsolate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== userEmail) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      await isolateUserAccount(userId, institutionId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.payload?.message || err.message || 'Failed to isolate account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop Lock */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isSubmitting ? onClose : undefined}
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
          />
          
          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 shrink-0">
              <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-6 h-6"/>
                <h2 className="text-lg font-semibold tracking-tight">Isolate User Account</h2>
              </div>
              <button 
                onClick={onClose} 
                disabled={isSubmitting}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-zinc-500"/>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                You are about to cryptographically isolate this user. This will instantly revoke all active sessions and block further access. This action is logged for compliance.
              </p>

              {error && (
                <div className="p-3 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleIsolate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Type <span className="font-bold text-zinc-900 dark:text-white select-all">{userEmail}</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-zinc-900 dark:text-white transition-all disabled:opacity-50"
                    placeholder={userEmail}
                  />
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={confirmText !== userEmail || isSubmitting}
                    className="flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50 disabled:hover:bg-rose-600 min-w-[140px]"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : 'Confirm Isolation'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
