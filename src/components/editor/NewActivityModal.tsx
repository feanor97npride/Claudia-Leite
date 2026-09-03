import { useState } from 'react';
import type { Objetivo, ObjetivoId } from '../../types';
import { nextWeekStartISO } from '../../utils/date';

interface Props {
  objetivos: Objetivo[];
  defaultObjetivoId: ObjetivoId;
  onClose: () => void;
  onCreate: (objetivoId: ObjetivoId, name: string, plannedStart: string, plannedEnd: string) => Promise<void>;
}

/** "+ Nova Atividade" (Timeline toolbar) — reuses the same
 *  createExtraAtividadeApi already used by the Editor's "Adicionar
 *  atividade extra", just with the planned start/end set up front instead
 *  of left undefined, since here the whole point is to place it on the
 *  Timeline right away. */
export default function NewActivityModal({ objetivos, defaultObjetivoId, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [objetivoId, setObjetivoId] = useState<ObjetivoId>(defaultObjetivoId);
  const objetivo = objetivos.find((o) => o.id === objetivoId) ?? objetivos[0];
  const [plannedStart, setPlannedStart] = useState(objetivo.periodStart);
  const [plannedEnd, setPlannedEnd] = useState(nextWeekStartISO(objetivo.periodStart));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleObjetivoChange(id: ObjetivoId) {
    setObjetivoId(id);
    const o = objetivos.find((x) => x.id === id);
    if (o) {
      setPlannedStart(o.periodStart);
      setPlannedEnd(nextWeekStartISO(o.periodStart));
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    if (!(plannedStart < plannedEnd)) {
      setError('A data de início deve ser anterior à data de fim.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreate(objetivoId, name.trim(), plannedStart, plannedEnd);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a atividade.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} role="presentation" />
      <div role="dialog" aria-modal="true" aria-label="Nova atividade" className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Nova atividade</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer">
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Nome da atividade</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Levantamento de requisitos"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Objetivo</label>
            <select
              value={objetivoId}
              onChange={(e) => handleObjetivoChange(e.target.value as ObjetivoId)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white"
            >
              {objetivos.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.entregaLabel})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Prazo início</label>
              <input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Prazo fim</label>
              <input
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex items-center gap-2 mt-5">
          <button
            type="button"
            disabled={!name.trim() || saving}
            onClick={() => void handleCreate()}
            className="flex-1 text-sm font-medium bg-slate-900 text-white rounded-lg py-2.5 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {saving ? 'Adicionando…' : 'Adicionar atividade'}
          </button>
          <button type="button" onClick={onClose} className="text-sm font-medium border border-slate-200 rounded-lg px-4 py-2.5 text-slate-600 hover:border-slate-300 cursor-pointer">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
