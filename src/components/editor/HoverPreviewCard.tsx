import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Atividade, Objetivo } from '../../types';
import { ACTIVITY_STATUS_META, TONE_META } from '../../types';
import { computeAheadBehindPercent } from '../../lib/roadmap';
import { formatShortDate } from '../../utils/date';

interface Props {
  atividade: Atividade;
  objetivo: Objetivo;
  /** Viewport-relative rect of the hovered/tapped item, used to position
   *  this card next to it without going off-screen. */
  anchorRect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpen: () => void;
}

const MARGIN = 8;
const CARD_WIDTH = 260;

/**
 * Lightweight hover/tap preview for a Timeline activity — shown after a
 * short delay (see RoadmapTimeline), positioned next to the item and
 * flipped to stay on-screen. Deliberately a two-pass render: mounts
 * invisible at a rough position, measures its own real size once laid
 * out, then flips/clamps and fades in — avoids guessing the card's height
 * up front (note/RACI make it variable) while still animating smoothly.
 */
export default function HoverPreviewCard({ atividade, objetivo, anchorRect, onMouseEnter, onMouseLeave, onOpen }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Opacity/scale are controlled entirely by Tailwind classes below (tied to
  // `visible`) — never put opacity in this inline style object, since an
  // inline style always wins over a class at the same property.
  const [style, setStyle] = useState<CSSProperties>({
    position: 'fixed',
    top: anchorRect.bottom + MARGIN,
    left: anchorRect.left,
    width: CARD_WIDTH,
  });
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const cardHeight = el.offsetHeight;

    let top = anchorRect.bottom + MARGIN;
    if (top + cardHeight > window.innerHeight - MARGIN) {
      const above = anchorRect.top - cardHeight - MARGIN;
      top = above >= MARGIN ? above : Math.max(MARGIN, window.innerHeight - cardHeight - MARGIN);
    }

    let left = anchorRect.left;
    if (left + CARD_WIDTH > window.innerWidth - MARGIN) {
      left = window.innerWidth - CARD_WIDTH - MARGIN;
    }
    if (left < MARGIN) left = MARGIN;

    setStyle({ position: 'fixed', top, left, width: CARD_WIDTH });
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorRect]);

  const meta = ACTIVITY_STATUS_META[atividade.status];
  const aheadPct = computeAheadBehindPercent(atividade);

  return (
    <div
      ref={cardRef}
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`z-40 rounded-xl bg-white border border-slate-200 shadow-lg p-3 text-xs transition-all duration-150 ease-out ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={style}
    >
      <p className="font-semibold text-slate-900 leading-snug mb-0.5">{atividade.name || 'Atividade sem nome'}</p>
      <p className="text-slate-400 mb-2">
        {objetivo.entregaLabel} — {objetivo.name}
      </p>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
          {meta.label}
        </span>
        {atividade.kind === 'extra' && (
          <span className="text-[9px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 rounded px-1.5 py-0.5">
            Extra
          </span>
        )}
        {aheadPct !== null && (
          <span
            className={`text-[9px] font-semibold rounded px-1.5 py-0.5 ${
              TONE_META[aheadPct > 0 ? 'good' : aheadPct < 0 ? 'bad' : 'neutral'].text
            } ${TONE_META[aheadPct > 0 ? 'good' : aheadPct < 0 ? 'bad' : 'neutral'].bg}`}
          >
            {aheadPct > 0 ? `+${aheadPct}%` : `${aheadPct}%`}
          </span>
        )}
      </div>

      {atividade.plannedStart && atividade.plannedEnd && (
        <p className="text-slate-500 mb-1">
          {formatShortDate(atividade.plannedStart)} — {formatShortDate(atividade.plannedEnd)}
        </p>
      )}
      {(atividade.raciAccountableName?.trim() || atividade.raciResponsibleName?.trim()) && (
        <p className="text-slate-500 mb-1">
          {atividade.raciAccountableName?.trim() && <>Resp.: {atividade.raciAccountableName}</>}
          {atividade.raciAccountableName?.trim() && atividade.raciResponsibleName?.trim() && ' · '}
          {atividade.raciResponsibleName?.trim() && <>Exec.: {atividade.raciResponsibleName}</>}
        </p>
      )}
      {atividade.note?.trim() && <p className="text-slate-400 italic mb-1 line-clamp-2">{atividade.note}</p>}

      <button
        type="button"
        onClick={onOpen}
        className="mt-1 text-[11px] font-semibold text-slate-900 hover:text-slate-600 transition-colors"
      >
        Ver detalhes →
      </button>
    </div>
  );
}
