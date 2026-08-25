# Status Report Semanal — Sistemas (TI)

Aplicação web para gerar um status report semanal em formato "one pager" para
acompanhamento das atividades da área de Sistemas (TI).

## Funcionalidades

- Formulário para registrar cabeçalho (área, período, responsável), resumo
  executivo, projetos/atividades, indicadores gerais, destaques e pontos de
  atenção.
- Projetos são dinâmicos (adicionar/remover) e cada um tem status com
  indicador tipo semáforo (No prazo / Atenção / Atrasado), % de conclusão,
  próximos passos e riscos/bloqueios.
- As seções **Entregas da semana** e **Avanços para a semana seguinte**
  recebem destaque visual em cada projeto — são o foco principal do report.
- **Roadmap por Objetivos (Quarters)** — acompanhamento do roadmap "Estruturação
  da Área de Sistemas": 4 objetivos (Diagnóstico, Governança, Operação,
  Estratégia Futura), cada um com uma lista de atividades pré-cadastradas. O
  progresso (%) de cada objetivo é calculado automaticamente a partir das
  atividades planejadas concluídas; atividades extras (fora do planejamento
  original) podem ser adicionadas livremente, aparecem marcadas com a tag
  "Extra" e não contam para o progresso. O snapshot semanal mostra, por
  objetivo, a semana atual do quarter, o progresso e as atividades (planejadas
  e extras) concluídas naquela semana especificamente — esses números ficam
  congelados no momento em que o snapshot é gerado, então relatórios antigos
  no histórico não mudam se o roadmap for atualizado depois.
- Cada objetivo pode ser editado (botão "✎ Editar" no card): nome, rótulo da
  entrega, e a data de início/fim (o total de semanas e "Semana X de Y" são
  recalculados automaticamente a partir do range). Atividades planejadas
  também podem ser renomeadas, e qualquer atividade aceita uma anotação livre
  opcional. O vínculo atividade→objetivo é sempre por ID interno, então
  renomear nunca quebra o cálculo de progresso nem o histórico já gerado.
- Campo livre de **Próximos Passos** por relatório, independente de projetos ou
  objetivos específicos — anotação da equipe/responsável a cada semana.
- Cada atividade aceita uma data de início e fim planejadas; ao concluí-la, o
  sistema calcula o **% de adiantamento/atraso** (positivo = concluída antes
  do prazo, negativo = depois), mostrado com indicação visual (verde/vermelho/
  neutro) na própria linha da atividade. Atividades sem essas datas mostram
  "sem dados de prazo" e ficam fora do cálculo. Cada objetivo exibe também o
  "Adiantamento médio do quarter" — média das atividades planejadas concluídas
  (extras não contam, mesma regra do progresso %) — ou "sem dados" enquanto
  nenhuma tiver sido concluída com prazo preenchido. A data de conclusão real
  é preenchida automaticamente ao marcar como concluída, mas pode ser ajustada
  manualmente (com aviso, sem bloquear, se for definida no futuro).
- No snapshot, o rótulo de cada entrega (ex: "ENTREGA 1") exibe também o
  período do objetivo ao lado (ex: "ENTREGA 1 · ago/2026 a out/2026").
- Botão "Gerar snapshot" produz a visualização formatada em um único quadro,
  com largura fixa e altura que cresce naturalmente conforme a quantidade de
  projetos/texto — os itens nunca são espremidos para caber num tamanho fixo.
- Exportação como **PNG** ou **PDF** (via `html2canvas-pro` + `jsPDF`),
  sempre na mesma proporção do conteúdo renderizado.
- Logotipo da empresa (ORIGEM) fixado no canto inferior direito do snapshot.
- Histórico: cada semana gerada fica salva e pode ser reaberta ou duplicada
  como ponto de partida para a semana seguinte (os avanços antecipados viram
  as entregas da nova semana).
- Login com e-mail/senha (autenticado no servidor); os relatórios semanais
  continuam separados por usuário.

## Persistência de dados

O relatório semanal (projetos, entregas, indicadores, texto livre) continua
salvo no `localStorage` do navegador, namespaced por usuário — isso não
mudou. Os **relatórios não sincronizam entre dispositivos/navegadores**,
por não terem backend próprio nesta versão.

O **Roadmap por Objetivos/Atividades**, por outro lado, agora vive num banco
Postgres real (ver seção seguinte) — é dado compartilhado entre todos os
usuários, com controle de acesso e trilha de auditoria de verdade.

## Backend: autenticação, roles e governança do roadmap

O roadmap (Objetivos/Atividades) passou a ser dado autoritativo no
**servidor** (Postgres + funções serverless em `/api`), não mais no
navegador — é a única forma de validar permissões de verdade (nunca
confiando só em esconder botões no front-end) e manter uma trilha de
auditoria que o próprio usuário não possa editar.

**Implementado nesta fase:**
- Login com e-mail/senha (hash com `bcryptjs`, nunca texto plano); sessão
  guardada no banco (não JWT — ver o comentário em `server/auth.ts` com a
  justificativa completa), revogável a qualquer momento.
- Dois papéis: **Admin** (leitura e escrita) e **Visualizador** (somente
  leitura) — toda ação de escrita é validada no servidor (`server/roadmap.ts`),
  não apenas escondida na interface.
- Usuário Admin padrão criado automaticamente (`npm run db:seed-admin`),
  com senha temporária impressa uma única vez no console e troca de senha
  sinalizada (`mustChangePassword`).
- Trilha de auditoria (`audit_log`): toda edição de Objetivo/Atividade grava
  campo alterado, valor anterior/novo, classificação (escopo/prazo/status) e
  o usuário responsável (ou "sistema automatizado").
- Gestão de mudanças: alterar uma data planejada já definida exige um motivo
  ("Motivo da mudança"); o "Nº de replanejamentos" conta só replanejamentos
  reais, não a definição inicial da data.
- Versionamento do range de datas de um Objetivo — a versão anterior fica
  preservada em `objetivo_versions`, nunca sobrescrita silenciosamente.
- Campos RACI descritivos por atividade (Responsável/Executor), independentes
  da role de acesso ao sistema.

**Front-end integrado à API:**
- Tela de login (e-mail/senha) e troca de senha obrigatória no primeiro
  acesso (ou voluntária, a qualquer momento, pelo botão "Trocar senha" no
  cabeçalho) — nenhuma senha, hash ou não, chega a trafegar de volta do
  servidor em nenhuma resposta.
- `RoadmapEditor`/`App.tsx` carregam e gravam Objetivos/Atividades pela API
  (`src/lib/api.ts`), não mais do `localStorage`; erros e sucessos aparecem
  como toasts (`ToastContext`), e cada ação de salvar mostra estado de
  carregamento.
- Para o papel **Visualizador**, todos os controles de edição/exclusão do
  roadmap são ocultados na interface (além do bloqueio no servidor) — a tela
  mostra os mesmos dados em modo somente-leitura.
- Campos RACI (Responsável/Executor) e o motivo de replanejamento aparecem
  no modo de edição do Objetivo/Atividade, com a mesma validação do servidor
  replicada no cliente para feedback imediato antes do round-trip de rede.
- Painel **"Histórico de Alterações"** (botão "🕘 Histórico" em cada Objetivo
  e em cada Atividade) — mostra a trilha de auditoria completa daquele item
  (campo, valor anterior/novo, classificação, motivo quando houver, usuário e
  data), visível para Admin e Visualizador, já que é um artefato de
  governança e não uma superfície de edição. Fecha com Esc ou clicando fora.
- Bloco **"Indicadores de Governança"** no editor do relatório: % de
  atividades planejadas concluídas no prazo/adiantadas/atrasadas, contagem
  de atividades extras e o adiantamento médio geral — reaproveita os mesmos
  cálculos já usados por objetivo. (O "Nº de replanejamentos" continua
  disponível por Objetivo/Atividade no painel "Histórico de Alterações",
  só não aparece mais agregado neste bloco.)
- Modal de **confirmação** antes de excluir uma atividade extra (ação
  destrutiva), com Esc/clique-fora para cancelar.
- Paleta de cores/tons (`Tone`, `TONE_META`, `ROLE_META` em `src/types.ts`,
  ao lado de `STATUS_META`/`ACTIVITY_STATUS_META` já existentes) como
  constantes únicas reutilizadas por `RoadmapEditor`, `GovernanceIndicators`
  e o cabeçalho, em vez de cada componente decidir sua própria cor.
- Passe de acessibilidade nos formulários do roadmap/relatório: `aria-label`
  em todo select/input sem `<label>` visível (status, datas planejadas,
  campos RACI, nome de projeto/atividade), `aria-pressed` nos botões de
  status tipo semáforo, e navegação por teclado (Tab/Enter/Esc) já cobre os
  modais e o formulário de nova atividade extra.
- Empty states revisados para serem orientativos (ex: "nenhuma atividade
  cadastrada — adicione uma atividade extra abaixo para começar").

**Ainda não feito** (próximos passos de UX, menor prioridade): revisão
formal de contraste de cor (WCAG) e responsividade em telas mobile/tablet,
e uma estrutura de roles mais extensível (hoje um enum fixo `admin`/`viewer`,
funcional mas não desenhado para adicionar um 3º papel facilmente).

### Configuração

```bash
cp .env.example .env.local   # edite DATABASE_URL com seu Postgres
npm run db:migrate           # cria as tabelas (só aditivo — nunca apaga nada)
npm run db:seed-admin        # cria o admin padrão, se ainda não existir
npm run dev                  # a própria Vite dev server já serve /api
```

Em produção (Vercel), defina `DATABASE_URL` em Project Settings → Environment
Variables apontando para o seu Postgres hospedado, e rode
`npm run db:migrate` (e, na primeira vez, `npm run db:seed-admin`) uma vez
apontando para esse mesmo banco antes/depois do primeiro deploy. As rotas em
`/api/*.ts` são detectadas automaticamente pela Vercel como funções
serverless — não é necessário `vercel.json`.

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`.

## Build de produção

```bash
npm run build
npm run preview
```

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- html2canvas-pro + jsPDF (exportação PNG/PDF)
- Backend: funções serverless (`/api`) + Postgres (`pg`) + `bcryptjs`, servidas
  localmente pela própria Vite dev server via um plugin em `vite.config.ts`
