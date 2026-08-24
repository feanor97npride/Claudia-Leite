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
- Login simples por nome para separar os relatórios de cada usuário.

## Persistência de dados

Os dados são salvos no `localStorage` do navegador, namespaced por usuário
(identificado pelo nome informado no login). Isso significa que:

- Os relatórios não se perdem ao fechar a aba ou o navegador.
- Cada usuário só vê os relatórios salvos com o próprio nome, no mesmo
  navegador/dispositivo.
- Os dados **não sincronizam entre dispositivos ou navegadores diferentes**,
  pois não há backend/banco de dados nesta versão. Para isso, seria
  necessário adicionar um serviço de autenticação e uma API/banco de dados.

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
