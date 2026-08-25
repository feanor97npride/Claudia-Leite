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
- Aba própria **"Roadmap Timeline"** (ao lado de Editor/Snapshot): um Gantt
  gerado ao vivo a partir dos períodos dos Objetivos e das datas planejadas
  das Atividades — serve de referência do roadmap proposto (equivalente ao
  Gantt gerado no início do projeto), mas sempre em sincronia com o dado
  real, ao contrário de uma imagem estática. Só entram no gráfico atividades
  com início e fim planejados definidos (sem inventar datas para o que
  ainda não foi planejado); respeita o mesmo week-scoping das atividades
  extras. As atividades são agrupadas por macro objetivo (Diagnóstico,
  Governança, Operação, Estratégia Futura), cada grupo com uma linha de
  cabeçalho colorida (mesma cor das barras do Gantt) mostrando o nome do
  objetivo ao qual aquelas atividades pertencem.
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
