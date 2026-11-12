import { Shield, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import ModalShell from '@/components/ModalShell';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SecurityModal({ isOpen, onClose }: SecurityModalProps) {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setStatus('idle');
    setErrorMsg('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 6) {
      setStatus('error');
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus('error');
      setErrorMsg('New passwords do not match.');
      return;
    }

    setStatus('loading');
    try {
      await updatePassword(auth.currentUser!, newPassword);
      setStatus('success');
      setTimeout(() => handleClose(), 2000);
    } catch (err: unknown) {
      setStatus('error');
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/requires-recent-login') {
        setErrorMsg('For security, please log out and log back in before changing your password.');
      } else {
        setErrorMsg('Could not update password. Please try again.');
      }
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title="Security"
      icon={<Shield size={20} className="text-neon-green" />}
    >
      {/* Account info */}
      <div className="bg-dark-card2 rounded-xl border border-dark-border p-3 mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-neon-green/10 flex items-center justify-center">
          <Lock size={18} className="text-neon-green" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Account Protection</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
      </div>

      {status === 'success' ? (
        <div className="text-center py-8 animate-scale-in">
          <div className="w-16 h-16 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={40} className="text-neon-green" />
          </div>
          <h3 className="font-display text-xl font-bold text-white mb-1">Password Updated</h3>
          <p className="text-sm text-gray-400">Your password has been changed successfully.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 font-semibold block mb-1.5">Current Password</label>
            <div className="flex items-center bg-dark-card2 rounded-xl border border-dark-border px-3 py-3">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="bg-transparent text-white text-sm w-full outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 font-semibold block mb-1.5">New Password</label>
            <div className="flex items-center bg-dark-card2 rounded-xl border border-dark-border px-3 py-3">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="bg-transparent text-white text-sm w-full outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 font-semibold block mb-1.5">Confirm New Password</label>
            <div className="flex items-center bg-dark-card2 rounded-xl border border-dark-border px-3 py-3">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="bg-transparent text-white text-sm w-full outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="text-gray-500 hover:text-white transition-colors ml-2"
              >
                {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {status === 'error' && errorMsg && (
            <p className="text-xs text-neon-red font-semibold">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-neon-green text-dark-bg font-bold py-3 rounded-xl transition-all active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 disabled:cursor-not-allowed neon-green-glow"
          >
            {status === 'loading' ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}
    </ModalShell>
  );
}
