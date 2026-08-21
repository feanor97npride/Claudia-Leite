import { useState } from 'react';
import { getProfile, saveProfile, setCurrentUserId, slugifyUser } from '../lib/storage';
import type { UserProfile } from '../types';

interface Props {
  onLogin: (profile: UserProfile) => void;
}

export default function Login({ onLogin }: Props) {
  const [name, setName] = useState('');
  const [area, setArea] = useState('Sistemas (TI)');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Informe seu nome para continuar.');
      return;
    }
    const userId = slugifyUser(trimmed);
    if (!userId) {
      setError('Nome inválido.');
      return;
    }
    const existing = getProfile(userId);
    const profile: UserProfile = existing ?? {
      userId,
      displayName: trimmed,
      area: area.trim() || 'Sistemas (TI)',
      responsible: trimmed,
    };
    saveProfile(profile);
    setCurrentUserId(userId);
    onLogin(profile);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
            SR
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Status Report Semanal</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Acompanhamento de atividades da área de Sistemas (TI). Seus relatórios ficam salvos neste navegador.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Seu nome</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Marcos Silva"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Área</label>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
