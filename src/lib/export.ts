import { utils, write } from 'xlsx';
import type { Atividade, Objetivo } from '../types';

export async function exportTimelineAsExcel(
  objetivos: Objetivo[],
  atividades: Atividade[],
  filename: string = 'timeline.xlsx',
): Promise<void> {
  const workbook = utils.book_new();

  // Sheet 1: Resumo por Objetivo
  const resumoData = objetivos.map((obj) => {
    const atividadesDoObjetivo = atividades.filter((a) => a.objetivoId === obj.id);
    const concluidas = atividadesDoObjetivo.filter((a) => a.status === 'done').length;
    const emAndamento = atividadesDoObjetivo.filter((a) => a.status === 'in_progress').length;
    const planejadas = atividadesDoObjetivo.filter((a) => a.status === 'planned').length;

    const progressoPorcentagem = Math.round(
      (atividadesDoObjetivo.reduce((sum, a) => sum + a.progresso, 0) / Math.max(atividadesDoObjetivo.length, 1)) * 100,
    );

    return {
      Objetivo: obj.name,
      Entrega: obj.entregaLabel,
      'Período': `${obj.periodStart} a ${obj.periodEnd}`,
      'Semanas': obj.totalWeeks,
      'Concluídas': concluidas,
      'Em andamento': emAndamento,
      'Planejadas': planejadas,
      'Total': atividadesDoObjetivo.length,
      'Progresso (%)': progressoPorcentagem,
    };
  });

  const resumoSheet = utils.json_to_sheet(resumoData);
  utils.book_append_sheet(workbook, resumoSheet, 'Resumo');

  // Sheet 2: Detalhes de Atividades
  const detalhesData = atividades.map((atividade) => {
    const objetivo = objetivos.find((o) => o.id === atividade.objetivoId);
    return {
      Objetivo: objetivo?.name || 'N/A',
      Entrega: objetivo?.entregaLabel || 'N/A',
      Atividade: atividade.name,
      Status: atividade.status === 'done' ? 'Concluída' : atividade.status === 'in_progress' ? 'Em andamento' : 'Planejada',
      Tipo: atividade.kind === 'extra' ? 'Extra' : 'Planejada',
      Progresso: atividade.progresso,
      'Data início planejada': atividade.plannedStart || '-',
      'Data fim planejada': atividade.plannedEnd || '-',
      'Data conclusão real': atividade.completedAt || '-',
      'Responsável (RACI)': atividade.raciAccountableName || '-',
      'Executor': atividade.raciResponsibleName || '-',
      Descrição: atividade.note || '-',
    };
  });

  const detalhesSheet = utils.json_to_sheet(detalhesData);
  utils.book_append_sheet(workbook, detalhesSheet, 'Atividades');

  // Configurar larguras de coluna
  const colWidths = { Resumo: 20, Atividades: [18, 18, 25, 15, 12, 12, 20, 20, 20, 20, 20, 30] };
  resumoSheet['!cols'] = [{ wch: colWidths.Resumo }];
  detalhesSheet['!cols'] = colWidths.Atividades.map((w) => ({ wch: w }));

  // Gerar e fazer download do arquivo
  write(workbook, { bookType: 'xlsx', type: 'array' });
  const excelData = write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export async function exportTimelineAsSnapshot(
  elementRef: React.RefObject<HTMLElement | null>,
  filename: string = 'timeline-snapshot.png',
): Promise<void> {
  if (!elementRef.current) throw new Error('Element not found for snapshot');

  // Dynamic import para evitar incluir html2canvas-pro desnecessariamente
  const { default: html2canvas } = await import('html2canvas-pro');

  const canvas = await html2canvas(elementRef.current, {
    backgroundColor: '#ffffff',
    scale: 2,
    logging: false,
    useCORS: true,
    allowTaint: true,
  });

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
