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
  "Extra" e não contam para o progresso. Uma atividade extra fica visível no
  editor só na semana em que foi criada — não migra para as semanas
  seguintes (evita que o Roadmap acumule itens pontuais de semanas antigas);
  ela continua existindo no banco/auditoria/snapshots antigos, só some da
  tela ao vivo depois que a semana passa. O snapshot semanal mostra, por
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

O relatório semanal (projetos, entregas, indicadores, texto livre) e o
**Roadmap por Objetivos/Atividades** vivem os dois num banco Postgres real
(ver seção seguinte). O relatório semanal é privado por usuário — cada
usuário só vê e edita seu próprio histórico, do mesmo jeito que já era com
`localStorage` — mas agora **sincroniza entre dispositivos/navegadores/abas
anônimas**, em vez de ficar preso a um único navegador.

Migração: relatórios salvos antes desta versão (só em `localStorage`) são
recuperados automaticamente na primeira vez que o app carrega sem nenhum
relatório no servidor para aquele usuário — ele lê o que ainda está no
`localStorage` daquele navegador específico e envia para o banco (toast "N
relatório(s) recuperado(s) do navegador para o servidor"). Isso só resgata o
que sobrou no navegador que você tiver aberto no momento da migração; um
relatório cujo navegador não foi mais aberto desde então não pode ser
recuperado.

## Backend: autenticação, roles e governança do roadmap

O roadmap (Objetivos/Atividades) passou a ser dado autoritativo no
**servidor** (Postgres + funções serverless em `/api`), não mais no
navegador — é a única forma de validar permissões de verdade (nunca
confiando só em esconder botões no front-end) e manter uma trilha de
auditoria que o próprio usuário não possa editar.

> **Limite de funções serverless (plano Hobby da Vercel):** cada arquivo em
> `/api` vira uma Serverless Function separada, e a Vercel limita o plano
> Hobby a 12 por deployment — passar disso falha o deploy inteiro com um
> erro genérico "Deployment has failed", sem apontar a causa (foi o que
> aconteceu ao adicionar `/api/reports`). Por isso as 4 rotas de auth
> (`login`/`logout`/`me`/`change-password`) estão num único
> `api/auth/[action].ts`, e `reports` (GET/POST/DELETE) num único
> `api/reports.ts` — várias operações por arquivo, roteadas por método
> HTTP (e no caso de auth, pelo segmento dinâmico da URL), em vez de um
> arquivo por operação. Ao adicionar uma rota nova, prefira estender um
> arquivo existente a criar um novo; se for mesmo necessário um arquivo
> novo, rode `find api -name "*.ts" | wc -l` antes de commitar.

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
- Relatório semanal (`reports`, `server/reports.ts`): `id`/`user_id`/
  `week_start` como colunas, o restante do relatório (projetos, indicadores,
  textos, snapshot congelado do roadmap) em `data jsonb` — evita alterar o
  schema a cada campo novo do relatório. Sempre filtrado por `user_id` da
  sessão autenticada; o `userId` que o cliente manda no corpo é ignorado.
  Sem role própria: qualquer usuário autenticado (Admin ou Visualizador) lê e
  escreve só o seu próprio histórico, do mesmo jeito que já era com
  `localStorage`.

**Front-end integrado à API:**
- Tela de login (e-mail/senha) e troca de senha obrigatória no primeiro
  acesso (ou voluntária, a qualquer momento, pelo botão "Trocar senha" no
  cabeçalho) — nenhuma senha, hash ou não, chega a trafegar de volta do
  servidor em nenhuma resposta.
- `RoadmapEditor`/`App.tsx` carregam e gravam Objetivos/Atividades pela API
  (`src/lib/api.ts`), não mais do `localStorage`; erros e sucessos aparecem
  como toasts (`ToastContext`), e cada ação de salvar mostra estado de
  carregamento.
- `App.tsx` carrega/grava o histórico de relatórios pela API
  (`GET`/`POST /api/reports`, `DELETE /api/reports?id=...` — os três
  métodos compartilham um único arquivo de rota, ver nota sobre o limite de
  funções serverless acima) em vez do `localStorage` — autosave (debounce
  de 400ms), "+ Nova semana", "Gerar snapshot", "Duplicar p/ próx. semana"
  e "Excluir" persistem no servidor. `src/lib/storage.ts` (`localStorage`)
  só é lido uma vez, na migração automática descrita acima.
- Se `GET /api/reports` falhar (ex: a tabela `reports` ainda não existe
  porque a migration não rodou naquele ambiente), o Editor mostra um aviso
  de erro com botão "Tentar novamente" em vez de uma tela em branco — o
  card de histórico também troca "Nenhum relatório salvo ainda" por "Não
  foi possível carregar." nesse caso, para não parecer que o histórico
  simplesmente sumiu.
- Para o papel **Visualizador**, todos os controles de edição/exclusão do
  roadmap são ocultados na interface (além do bloqueio no servidor) — a tela
  mostra os mesmos dados em modo somente-leitura.
- Campos RACI (Responsável/Executor) e o motivo de replanejamento aparecem
  no modo de edição do Objetivo/Atividade, com a mesma validação do servidor
  replicada no cliente para feedback imediato antes do round-trip de rede.
- Uma Atividade pode ser reatribuída a outro Objetivo: no modo de edição do
  Objetivo, o seletor **"Entrega"** em cada atividade lista os 4 objetivos —
  ao trocar e salvar, a atividade passa a aparecer no card do novo objetivo
  (`PATCH /api/atividades/:id` com `objetivoId`, restrito a Admin, auditado
  como qualquer outro campo, registrando o Objetivo antigo e o novo em
  "Histórico de Alterações"). Usado para reorganizar itens entre
  Governança/Operação sem editar o banco diretamente.
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
- Botão flutuante **"Voltar ao topo"** (`BackToTopButton`), canto inferior
  direito — só aparece depois de rolar mais de 300px, some de novo perto do
  topo, scroll suave até `y=0`. Global (funciona em qualquer aba), oculto na
  exportação/impressão (`no-print`).
- Aba própria **"Roadmap Timeline"** (ao lado de Editor/Snapshot): um Gantt
  gerado ao vivo a partir dos períodos dos Objetivos e das datas planejadas
  das Atividades — serve de referência do roadmap proposto (equivalente ao
  Gantt gerado no início do projeto), mas sempre em sincronia com o dado
  real, ao contrário de uma imagem estática. Só entram no gráfico atividades
  com início e fim planejados definidos (sem inventar datas para o que
  ainda não foi planejado); respeita o mesmo week-scoping das atividades
  extras — atividades extras entram no gráfico normalmente desde que
  tenham um "Prazo" definido no Editor (não há distinção entre planejadas e
  extras nesse filtro), e ganham uma tag roxa **"Extra"** ao lado do nome
  para diferenciá-las das planejadas. As atividades são agrupadas por macro
  objetivo (Diagnóstico,
  Governança, Operação, Estratégia Futura), cada grupo com uma linha de
  cabeçalho colorida (mesma cor das barras do Gantt) mostrando o nome do
  objetivo ao qual aquelas atividades pertencem. Botão "⤢ Tela cheia" no
  canto do bloco expande o gráfico via Fullscreen API do navegador (sem
  bordas de card, ocupando a tela toda) — útil quando o roadmap tem muitas
  atividades/meses e fica apertado no layout normal; "⤡ Sair da tela cheia"
  ou Esc voltam ao normal. Clicar numa barra (ou no nome da atividade)
  abre um painel (`AtividadeDetailModal`) com status, prazo planejado,
  RACI e anotação; o botão **"Editar no Editor"** troca para a aba Editor,
  rola até o card do Objetivo correspondente, já abre em modo de edição e
  destaca brevemente a linha daquela atividade (`focusAtividade` em
  `App.tsx`, propagado por `ReportEditor`/`RoadmapEditor`) — não é uma
  segunda cópia editável, é o mesmo formulário do Editor.
- Hierarquia visual entre concluídas e não concluídas, tanto no Timeline
  quanto no Editor: atividades concluídas ganham um ✓ verde e texto em
  negrito. Transições usam `transition-colors duration-200` para não
  trocar abruptamente ao mudar o status. Sem dark mode: o app não tem
  suporte a tema escuro em nenhuma tela ainda, então esse ponto não se
  aplica por ora.
- **Fase 1 do redesign da Timeline** — paleta de status com contraste
  acessível (WCAG AA) e linha do "hoje", substituindo o esquema anterior
  (cor do objetivo + "tint" para não concluída) por um esquema baseado em
  **status**, já que a cor do objetivo continua identificável pelo
  cabeçalho colorido de cada grupo:
  - `TIMELINE_STATUS_META` (`src/types.ts`) define 4 estados visuais —
    🟢 **Concluído** (`#15803d` sólido, texto branco), 🔵 **Em andamento**
    (`#1d4ed8` sólido + uma textura sutil de hachura diagonal via
    `repeating-linear-gradient`, texto branco), ⚪ **Não iniciado**
    (contorno cinza-claro `#94a3b8` sobre fundo branco, texto
    `#334155`) e 🔴 **Atrasado** (`#b91c1c` sólido, texto branco). Cada
    par foi checado à mão (luminância relativa/fórmula do WCAG, mesmo
    método já usado nos tokens `OBJETIVO_COLOR`) para garantir ≥4.5:1 —
    inclusive a variante com hachura, testada no tom mais claro que a
    listra branca semitransparente produz, não só na cor base sólida.
  - "Atrasado" não existe como valor nativo de `ActivityStatus` (que só
    tem `planned`/`in_progress`/`done`) — é **derivado** em
    `timelineVisualStatus()` (`src/lib/roadmap.ts`): não concluída E
    `plannedEnd` no passado. Reaproveitado pelo `RoadmapTimeline`, pelo
    `HoverPreviewCard` e pelo `AtividadeDetailModal`, para o status
    mostrado ser sempre consistente entre a barra, o preview de hover e o
    modal de detalhes.
  - Uma bolinha colorida ao lado do nome da atividade (mesma cor do
    status) reforça a leitura mesmo antes de olhar a barra; ⚠ aparece
    junto ao nome/barra quando atrasada.
  - Linha vertical tracejada vermelha marcando a data de **hoje** sobre o
    grid do Gantt, atravessando todas as linhas de atividades. Como as
    colunas de mês usam `minmax(56px, 1fr)` (largura variável, não fixa),
    a posição em pixels é **medida do DOM já renderizado** (mesma ideia
    de duas passadas do `HoverPreviewCard`: mede a coluna do mês
    correspondente via `getBoundingClientRect`, soma a fração do dia
    dentro do mês) em vez de calculada a partir de uma largura suposta —
    um `ResizeObserver` no grid recalcula a posição a cada mudança de
    layout (resize da janela, entrar/sair da tela cheia). Não aparece
    quando a data de hoje cai fora do intervalo de meses exibido.
- **Fase 2 do redesign da Timeline** — estrutura e navegação para roadmaps
  grandes (pré-requisito: Fase 1). Tudo em `RoadmapTimeline.tsx`:
  - **Categorias colapsáveis**: cada cabeçalho de grupo (macro objetivo) é
    agora um botão com ▾/▸ — clicar recolhe/expande as atividades daquele
    grupo, mas o cabeçalho (com o contador de progresso, ver abaixo)
    continua visível, então recolher um grupo não esconde seu resumo.
  - **Filtros por categoria, responsável e status** — chips no topo do
    bloco, um grupo de chips por dimensão. Dentro de uma dimensão as
    seleções são combinadas com OU (ex.: "Concluído" + "Atrasado" mostra
    as duas); entre dimensões é E (categoria E status E responsável).
    Nenhum chip selecionado numa dimensão = sem filtro nela. O chip de
    Status reaproveita as cores/rótulos de `TIMELINE_STATUS_META` (Fase 1);
    o de Responsável é montado dinamicamente a partir dos nomes RACI
    (Accountable e Responsible, os dois contam como "responsável")
    realmente usados nas atividades elegíveis — some sozinho se nenhuma
    atividade tiver RACI preenchido. Botão "Limpar filtros" aparece só
    quando algum filtro está ativo. Uma combinação sem resultado mostra
    "Nenhuma atividade corresponde aos filtros selecionados" (distinto da
    mensagem "nenhuma atividade com prazo definido ainda", que só aparece
    quando não há dado nenhum, filtro nenhum aplicado).
  - **Contador de progresso por categoria**: cada cabeçalho de grupo mostra
    "X/Y concluídas — Z%" (ex.: "Diagnóstico Revisado: 1/6 concluídas —
    17%"), reaproveitando `computeObjetivoProgress` — os mesmos números já
    usados no card do Objetivo na aba Editor, não um recorte dos filtros
    ativos (o contador reflete o objetivo inteiro mesmo com filtro
    aplicado, para servir de resumo estável independente do que está
    filtrado no momento).
  - O indicador automático de atraso (🔴, Fase 1) segue valendo aqui sem
    mudança — é a mesma derivação (`timelineVisualStatus`), agora também
    disponível como opção do filtro de Status.
- Preview em hover (`HoverPreviewCard`) ao passar o mouse sobre uma
  atividade na Timeline (nome ou barra): aparece depois de 250ms parado
  (evita disparo acidental ao passar o mouse rápido), some depois de
  150ms sem estar sobre o item nem sobre o próprio card — mover o mouse
  de um para o outro conta como "ainda em cima", não pisca. Mostra nome
  completo, objetivo, status (já com a paleta/rótulo de 4 estados acima,
  incluindo "Atrasado"), prazo, RACI, anotação e adiantamento (se
  concluída); botão **"Ver detalhes →"** abre o mesmo
  `AtividadeDetailModal` do clique direto. Posicionamento em duas
  passadas: renderiza invisível, mede a altura real do card (varia com
  RACI/nota), só então decide se fica abaixo ou vira para cima do item,
  e limita para nunca vazar da tela — testado forçando uma viewport
  baixa para confirmar a virada. Em telas touch (`matchMedia('(hover:
  none)')`, mais confiável que checar `ontouchstart`), hover não existe:
  o primeiro toque mostra o preview, o segundo toque no mesmo item abre
  o modal completo, e tocar fora fecha — comportamento verificado com
  Playwright emulando um contexto touch. Fade + leve scale na entrada/
  saída (`transition-all duration-150`).
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
