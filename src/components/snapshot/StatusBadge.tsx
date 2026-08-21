import type { ProjectStatus } from '../../types';
import { STATUS_META } from '../../types';

export default function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
      style={{ backgroundColor: meta.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
      {meta.label}
    </span>
  );
}
