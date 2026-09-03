import { useState } from 'react';
import { changePasswordRequest } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Props {
  /** Present only for a voluntary password change; omitted for the forced
   *  first-login case (Bloco 0.2.1), which has no dismiss action. */
  onClose?: () => void;
}

/**
 * Bloco 0.2.1: shown whenever the authenticated user's mustChangePassword
 * flag is set (always true right after the seeded-admin's first login, or
 * for any user an Admin just created) — no dismiss action in that case,
 * since a temporary/assigned password must be replaced before the account
 * is used. Also reused for a voluntary password change from the header,
 * where `onClose` lets the user back out.
 */
export default function ChangePasswordModal({ onClose }: Props) {
  const { refresh } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      await changePasswordRequest(currentPassword, newPassword);
      showToast('Senha alterada com sucesso.');
      await refresh();
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">
          {onClose ? 'Trocar senha' : 'Troca de senha obrigatória'}
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          {onClose
            ? 'Defina uma nova senha para sua conta.'
            : 'Sua senha é temporária. Defina uma nova senha para continuar usando o sistema.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="cp-current" className="block text-xs font-medium text-slate-600 mb-1">
              Senha atual
            </label>
            <input
              id="cp-current"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
          <div>
            <label htmlFor="cp-new" className="block text-xs font-medium text-slate-600 mb-1">
              Nova senha (mín. 8 caracteres)
            </label>
            <input
              id="cp-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
          <div>
            <label htmlFor="cp-confirm" className="block text-xs font-medium text-slate-600 mb-1">
              Confirmar nova senha
            </label>
            <input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Salvando…' : 'Trocar senha'}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 border border-slate-300 rounded-lg px-4 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
