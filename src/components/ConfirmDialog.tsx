import { useEffect } from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Bloco 2: confirmation modal for destructive/high-impact actions (e.g.
 *  deleting an activity) — reduces accidental data loss without adding
 *  friction to non-destructive actions. Closes on Esc, like the other
 *  modals in the app. */
export default function ConfirmDialog({ title, message, confirmLabel = 'Remover', onConfirm, onCancel }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/50 flex items-center justify-center px-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-900 mb-1">{title}</h2>
        <p className="text-sm text-slate-500 mb-5">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 transition-colors"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 border border-slate-300 rounded-lg px-4 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
