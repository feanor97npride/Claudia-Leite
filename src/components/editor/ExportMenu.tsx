import { useRef, useState } from 'react';
import type { Atividade, Objetivo } from '../../types';
import { exportTimelineAsExcel, exportTimelineAsSnapshot } from '../../lib/export';

interface Props {
  objetivos: Objetivo[];
  atividades: Atividade[];
  timelineRef?: React.RefObject<HTMLElement | null>;
}

export default function ExportMenu({ objetivos, atividades, timelineRef }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleExportExcel() {
    setIsExporting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await exportTimelineAsExcel(objetivos, atividades, `roadmap_${today}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  }

  async function handleExportSnapshot() {
    setIsExporting(true);
    try {
      if (!timelineRef?.current) {
        console.error('Timeline ref not available for snapshot');
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      await exportTimelineAsSnapshot(timelineRef, `roadmap_${today}.png`);
    } catch (err) {
      console.error('Erro ao exportar snapshot:', err);
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {isExporting ? 'Exportando...' : 'Exportar'}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="w-full px-4 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer border-b border-slate-100"
          >
            <div className="font-medium">Exportar como Excel</div>
            <div className="text-xs text-slate-500">Planilha com resumo e detalhes</div>
          </button>
          <button
            type="button"
            onClick={handleExportSnapshot}
            disabled={isExporting || !timelineRef}
            className="w-full px-4 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <div className="font-medium">Exportar como Snapshot</div>
            <div className="text-xs text-slate-500">Imagem PNG da timeline</div>
          </button>
        </div>
      )}
    </div>
  );
}
