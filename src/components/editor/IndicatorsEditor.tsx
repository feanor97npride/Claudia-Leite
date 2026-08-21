import type { Indicator } from '../../types';
import { newId } from '../../lib/storage';

interface Props {
  indicators: Indicator[];
  onChange: (indicators: Indicator[]) => void;
}

export default function IndicatorsEditor({ indicators, onChange }: Props) {
  function update(id: string, patch: Partial<Indicator>) {
    onChange(indicators.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function add() {
    onChange([...indicators, { id: newId(), label: '', value: '' }]);
  }

  function remove(id: string) {
    onChange(indicators.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-2">
      {indicators.map((ind) => (
        <div key={ind.id} className="flex gap-2 items-center">
          <input
            value={ind.label}
            onChange={(e) => update(ind.id, { label: e.target.value })}
            placeholder="Indicador (ex: SLA)"
            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
          <input
            value={ind.value}
            onChange={(e) => update(ind.id, { value: e.target.value })}
            placeholder="Valor (ex: 98%)"
            className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
          <button
            type="button"
            onClick={() => remove(ind.id)}
            className="text-slate-400 hover:text-red-600 text-xs px-2"
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
      >
        + Adicionar indicador
      </button>
    </div>
  );
}
