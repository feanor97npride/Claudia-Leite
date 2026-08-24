import type { Objetivo, ObjetivoId } from '../types';

export const OBJETIVOS: Objetivo[] = [
  {
    id: 'diagnostico',
    name: 'Diagnóstico',
    entregaLabel: 'Entrega 1',
    periodStart: '2026-08-01',
    periodEnd: '2026-10-31',
    periodLabel: 'ago/2026 a out/2026',
    totalWeeks: 12,
  },
  {
    id: 'governanca',
    name: 'Governança',
    entregaLabel: 'Entrega 2',
    periodStart: '2026-11-01',
    periodEnd: '2027-01-31',
    periodLabel: 'nov/2026 a jan/2027',
    totalWeeks: 12,
  },
  {
    id: 'operacao',
    name: 'Operação',
    entregaLabel: 'Entrega 3',
    periodStart: '2027-02-01',
    periodEnd: '2027-04-30',
    periodLabel: 'fev/2027 a abr/2027',
    totalWeeks: 12,
  },
  {
    id: 'estrategia_futura',
    name: 'Estratégia Futura',
    entregaLabel: 'Entrega 4',
    periodStart: '2027-05-01',
    periodEnd: '2027-07-31',
    periodLabel: 'mai/2027 a jul/2027',
    totalWeeks: 12,
  },
];

/** Roadmap "Estruturação da Área de Sistemas" — pre-mapped planned activities per objetivo. */
export const SEED_ATIVIDADES: Record<ObjetivoId, string[]> = {
  diagnostico: [
    'Inventário Corporativo de Aplicações',
    'Diagnóstico AS-IS',
    'Matriz RACI',
    'Business Owners e Application Owners definidos',
    'Definição de business owners e aproximação do negócio',
    'Plano de Redução do Shadow IT',
  ],
  governanca: [
    'Mapa de Sistemas (Atualização)',
    'Plano de ação TO-BE',
    'Mapa de Integrações',
    'Catálogo Corporativo ITSM',
    'Modelo de Governança de Aplicações',
    'BIA e classificação de criticidade',
    'Governança de Aplicações',
    'Processos de Incidentes, Problemas, Mudanças e Releases',
    'SLAs, OLAs e KPIs',
    'Homologação de novas soluções',
  ],
  operacao: [
    'Diagramas de Arquitetura',
    'Desenho do fluxo de processos',
    'Dashboards Executivos e Operacionais',
    'Modelo de Monitoramento e Observabilidade',
  ],
  estrategia_futura: [
    'Roadmap de Evolução (12–24 meses)',
    'Plano de Modernização das Aplicações',
    'Plano de captação de novos negócios',
    'Estratégia de Cloud, IA e Automação',
    'Plano Estratégico de Sistemas',
  ],
};
