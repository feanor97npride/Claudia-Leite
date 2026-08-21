import type { ProjectStatus } from '../../types';
import { STATUS_META } from '../../types';
import { IconAlert, IconCheck, IconClock } from './icons';

const ICONS = { check: IconCheck, alert: IconAlert, clock: IconClock };

export default function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = STATUS_META[status];
  const Icon = ICONS[meta.icon];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: meta.color }}
    >
      <Icon className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  );
}
