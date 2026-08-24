import { useEffect, useMemo, useRef, useState } from 'react';
import type { Atividade, AtividadePatch, AuthedUser, Objetivo, ObjetivoId, Report, UserProfile } from './types';
import { ROLE_META } from './types';
import { deleteReport, getReports, saveReport } from './lib/storage';
import { blankReport, duplicateForNextWeek } from './lib/factory';
import { buildRoadmapSnapshot } from './lib/roadmap';
import {
  createExtraAtividadeApi,
  deleteExtraAtividadeApi,
  fetchAtividades,
  fetchObjetivos,
  fetchTotalReplanCount,
  updateAtividadeApi,
  updateObjetivoApi,
} from './lib/api';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import Login from './components/Login';
import ChangePasswordModal from './components/ChangePasswordModal';
import ReportEditor from './components/editor/ReportEditor';
import SnapshotView from './components/snapshot/SnapshotView';
import HistoryPanel from './components/history/HistoryPanel';

type View = 'editor' | 'snapshot';

function deriveProfile(user: AuthedUser): UserProfile {
  return { userId: user.id, displayName: user.displayName, area: 'Sistemas (TI)', responsible: user.displayName };
}

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { showToast } = useToast();

  const [reports, setReports] = useState<Report[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [replanCount, setReplanCount] = useState(0);
  const [roadmapLoading, setRoadmapLoading] = useState(true);
  const [draft, setDraft] = useState<Report | null>(null);
  const [view, setView] = useState<View>('editor');
  const [exporting, setExporting] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const snapshotRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    const profile = deriveProfile(user);
    const existing = getReports(user.id);
    setReports(existing);
    if (existing.length > 0) {
      setDraft(existing[0]);
    } else {
      const fresh = blankReport(profile);
      saveReport(fresh);
      setDraft(fresh);
      setReports([fresh]);
    }

    setRoadmapLoading(true);
    Promise.all([fetchObjetivos(), fetchAtividades(), fetchTotalReplanCount()])
      .then(([objs, atvs, replans]) => {
        setObjetivos(objs);
        setAtividades(atvs);
        setReplanCount(replans);
      })
      .catch((err) => showToast(err instanceof Error ? err.message : 'Não foi possível carregar o roadmap.', 'error'))
      .finally(() => setRoadmapLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.mustChangePassword]);

  async function handleLogout() {
    await logout();
    setReports([]);
    setObjetivos([]);
    setAtividades([]);
    setReplanCount(0);
    setDraft(null);
    setView('editor');
  }

  async function handleUpdateObjetivo(id: ObjetivoId, patch: Partial<Objetivo>) {
    const updated = await updateObjetivoApi(id, patch);
    setObjetivos((prev) => prev.map((o) => (o.id === id ? updated : o)));
    if (patch.periodStart || patch.periodEnd) fetchTotalReplanCount().then(setReplanCount);
  }

  async function handleUpdateAtividade(id: string, patch: AtividadePatch) {
    const updated = await updateAtividadeApi(id, patch);
    setAtividades((prev) => prev.map((a) => (a.id === id ? updated : a)));
    if (patch.reason) fetchTotalReplanCount().then(setReplanCount);
  }

  async function handleAddExtraAtividade(objetivoId: ObjetivoId, name: string) {
    const created = await createExtraAtividadeApi(objetivoId, name);
    setAtividades((prev) => [...prev, created]);
  }

  async function handleRemoveExtraAtividade(id: string) {
    await deleteExtraAtividadeApi(id);
    setAtividades((prev) => prev.filter((a) => a.id !== id));
  }

  function updateDraft(next: Report) {
    const touched = { ...next, updatedAt: new Date().toISOString() };
    setDraft(touched);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveReport(touched);
      setReports((prev) => {
        const idx = prev.findIndex((r) => r.id === touched.id);
        const copy = [...prev];
        if (idx >= 0) copy[idx] = touched;
        else copy.unshift(touched);
        return copy.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
      });
    }, 400);
  }

  function handleGenerateSnapshot() {
    if (!draft || !user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const withSnapshot = { ...draft, roadmapSnapshot: buildRoadmapSnapshot(atividades, draft.weekStart, objetivos) };
    saveReport(withSnapshot);
    setDraft(withSnapshot);
    setReports(getReports(user.id));
    setView('snapshot');
  }

  function handleNewWeek() {
    if (!user) return;
    const base = draft ?? reports[0];
    const fresh = base ? duplicateForNextWeek(base) : blankReport(deriveProfile(user));
    saveReport(fresh);
    setReports(getReports(user.id));
    setDraft(fresh);
    setView('editor');
  }

  function handleViewReport(report: Report) {
    setDraft(report);
    setView('snapshot');
  }

  function handleDuplicateReport(report: Report) {
    const fresh = duplicateForNextWeek(report);
    saveReport(fresh);
    if (user) setReports(getReports(user.id));
    setDraft(fresh);
    setView('editor');
  }

  function handleDeleteReport(report: Report) {
    if (!user) return;
    deleteReport(user.id, report.id);
    const remaining = getReports(user.id);
    setReports(remaining);
    if (draft?.id === report.id) {
      setDraft(remaining[0] ?? null);
      setView('editor');
    }
  }

  async function handleExport(kind: 'pdf' | 'png') {
    if (!snapshotRef.current || !draft) return;
    setExporting(true);
    try {
      const { exportNodeAsPDF, exportNodeAsPNG } = await import('./utils/export');
      const fileName = `status-report_${draft.weekStart}`;
      if (kind === 'pdf') await exportNodeAsPDF(snapshotRef.current, `${fileName}.pdf`);
      else await exportNodeAsPNG(snapshotRef.current, `${fileName}.png`);
    } finally {
      setExporting(false);
    }
  }

  const editorDisabled = useMemo(() => view === 'snapshot', [view]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-400">Carregando…</div>;
  }

  if (!user) {
    return <Login />;
  }

  if (user.mustChangePassword) {
    return <ChangePasswordModal />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 no-print">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              SR
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 leading-none">Status Report Semanal</h1>
              <p className="text-[11px] text-slate-400">Sistemas (TI)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">
              Olá, {user.displayName}{' '}
              <span className="text-slate-400">
                ({ROLE_META[user.role].label})
              </span>
            </span>
            <button
              onClick={() => setShowChangePassword(true)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50"
            >
              Trocar senha
            </button>
            <button
              onClick={() => void handleLogout()}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-4 no-print flex-wrap gap-2">
            <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white">
              <button
                onClick={() => setView('editor')}
                className={`px-4 py-1.5 text-sm font-medium ${
                  view === 'editor' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Editor
              </button>
              <button
                onClick={() => draft && setView('snapshot')}
                className={`px-4 py-1.5 text-sm font-medium ${
                  view === 'snapshot' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Snapshot
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleNewWeek}
                className="text-sm font-medium text-slate-600 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-white bg-white"
              >
                + Nova semana
              </button>
              {view === 'editor' ? (
                <button
                  onClick={handleGenerateSnapshot}
                  className="text-sm font-medium bg-slate-900 text-white rounded-lg px-4 py-1.5 hover:bg-slate-800"
                >
                  Gerar snapshot
                </button>
              ) : (
                <>
                  <button
                    disabled={exporting}
                    onClick={() => handleExport('png')}
                    className="text-sm font-medium border border-slate-300 bg-white rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Exportar PNG
                  </button>
                  <button
                    disabled={exporting}
                    onClick={() => handleExport('pdf')}
                    className="text-sm font-medium bg-slate-900 text-white rounded-lg px-3 py-1.5 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {exporting ? 'Exportando…' : 'Exportar PDF'}
                  </button>
                </>
              )}
            </div>
          </div>

          {view === 'editor' && draft && (
            <fieldset disabled={editorDisabled}>
              {roadmapLoading ? (
                <p className="text-sm text-slate-400 italic mb-4">Carregando roadmap…</p>
              ) : (
                <ReportEditor
                  report={draft}
                  onChange={updateDraft}
                  atividades={atividades}
                  objetivos={objetivos}
                  roadmapReadOnly={user.role === 'viewer'}
                  replanCount={replanCount}
                  onUpdateObjetivo={handleUpdateObjetivo}
                  onUpdateAtividade={handleUpdateAtividade}
                  onAddExtraAtividade={handleAddExtraAtividade}
                  onRemoveExtraAtividade={handleRemoveExtraAtividade}
                />
              )}
            </fieldset>
          )}

          {view === 'snapshot' && draft && (
            <div className="overflow-x-auto pb-8">
              <SnapshotView ref={snapshotRef} report={draft} atividades={atividades} objetivos={objetivos} />
            </div>
          )}
        </div>

        <aside className="no-print">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Histórico de relatórios
          </h2>
          <HistoryPanel
            reports={reports}
            activeReportId={draft?.id ?? null}
            onView={handleViewReport}
            onDuplicate={handleDuplicateReport}
            onDelete={handleDeleteReport}
          />
        </aside>
      </main>

      <footer className="no-print border-t border-slate-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 text-center text-[11px] text-slate-400">
          Status Report Semanal · v{__APP_VERSION__}
        </div>
      </footer>
    </div>
  );
}
