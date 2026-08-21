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
- Botão "Gerar snapshot" produz a visualização formatada em um único quadro
  no formato **16:9**, com o conteúdo ajustado automaticamente para caber
  nesse formato independentemente da quantidade de projetos/texto.
- Exportação como **PNG** ou **PDF** (via `html2canvas-pro` + `jsPDF`),
  sempre no formato 16:9.
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
