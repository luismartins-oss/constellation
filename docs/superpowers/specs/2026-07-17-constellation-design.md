# Constellation — Design

**Data:** 2026-07-17
**Status:** Aprovado (design), pronto para plano de implementação

## Problema

Agentes de IA reexploram o mesmo projeto a cada sessão: leem os mesmos
arquivos, redescobrem as mesmas decisões, tropeçam nos mesmos gotchas. Isso
queima token e tempo. Falta um lugar durável, por projeto, onde o
conhecimento útil fique guardado — e que o agente consulte de forma barata em
vez de reexplorar.

## Objetivo

Uma lib chamada **Constellation** que:

1. Guarda o contexto do projeto como uma constelação de "estrelas" (unidades
   de conhecimento) versionadas no git.
2. Economiza token: o agente abre a sessão lendo um **índice barato** e só
   carrega o conteúdo completo **sob demanda**, em vez de explorar o repo.
3. É alimentada **pela própria IA**, guiada por uma skill/instrução, sempre
   que aprende algo durável.
4. Oferece uma **visualização** (grafo navegável) para quando o usuário quer
   ver a constelação.

## Decisões tomadas na fase de brainstorming

| Tema | Decisão |
|---|---|
| Integração | CLI + convenção de arquivos (`.constellation/`), versionável no git |
| Tipos de estrela | code-map, decision, gotcha, doc |
| Captura | A IA decide e salva, guiada por uma skill/instrução |
| Abertura | Índice barato + carregar sob demanda (padrão do `MEMORY.md`) |
| Visualização | Explorador local, grafo force-directed, read-only |
| Stack | Node/TypeScript, distribuído via npm/npx |
| Formato | 1 markdown por estrela + índice/grafo **gerados** |
| Conexões | Wikilinks `[[slug]]` + agrupamento por "constelação" nomeada |

## Arquitetura

### Layout de `.constellation/` (dentro do projeto do usuário)

```
.constellation/
  stars/
    code-map/     backend-aportes.md
    decisions/    asyncpg-id-in.md
    gotchas/      windows-schannel.md
    docs/         deploy.md
  index.md            # GERADO — índice barato (1 linha por estrela)
  constellation.json  # GERADO — grafo (nós + arestas) p/ viz e queries
  config.json         # nome do projeto, versão do schema
```

- Pastas organizadas por **tipo** (estável). "Constelação" (cluster) é um
  campo do frontmatter, não uma pasta — desacopla agrupamento (muda) de
  armazenamento (estável).
- Mapa `type` (frontmatter, singular) → pasta: `code-map`→`code-map/`,
  `decision`→`decisions/`, `gotcha`→`gotchas/`, `doc`→`docs/`.
- `index.md` e `constellation.json` são **artefatos gerados**, nunca editados
  na mão, reconstruídos a partir dos `stars/*.md`. Fonte da verdade = os
  markdowns (git-diffáveis, legíveis).

### Formato de uma estrela

```markdown
---
id: backend-aportes
type: code-map                 # code-map | decision | gotcha | doc
constellation: aportes         # cluster nomeado (subsistema)
title: Backend de aportes/diagrama
summary: Aportes/diagrama ficam em bb-backend-python (app/finance/aportes), não no v2.
tags: [backend, aportes]
links: [asyncpg-id-in]         # [[slug]] no corpo também viram links
updated: 2026-07-17
---

Detalhe completo em markdown. Referencia outras estrelas com [[asyncpg-id-in]].
Isto é o que `constellation show backend-aportes` devolve.
```

Chaves da economia de token:
- **`summary`** (1 linha) é o que aparece no `index.md` → o agente lê o índice
  inteiro baratinho no início.
- **corpo completo** só é carregado sob demanda via `show`/`query`.

### Componentes (repo da lib)

```
constellation/
  package.json          # bin: "constellation"
  src/
    cli/                # comandos (open, show, save, query, view, …)
    core/               # modelo: parse/serialize estrela, build index+grafo, query
    viz/                # server + app web do grafo
  skill/                # skill do Claude Code + snippet de CLAUDE.md
  test/                 # testes do core
```

- **`core/`**: puro e testável isolado. Dado um conjunto de `.md` →
  parse/serialize de estrela, build de `index.md` + `constellation.json`,
  resolução de links `[[…]]`, e query textual/tag. Nenhuma dependência de
  CLI/viz.
- **`cli/`**: casca fina sobre o `core/`.
- **`viz/`**: server local + app web; consome `constellation.json`.

## CLI

| Comando | Pra quê |
|---|---|
| `constellation init` | Cria `.constellation/` + config. |
| `constellation open` | Imprime o `index.md` (contexto barato no início da sessão). |
| `constellation show <id>` | Imprime o corpo completo de 1 estrela (`--links` puxa as vizinhas). |
| `constellation query <termo>` | Busca por texto/tag → lista **summaries** que batem. |
| `constellation save` | Cria/atualiza estrela. Flags `--type --constellation --title --summary --links`; corpo via **stdin**. Regenera índice sozinho. |
| `constellation list` | Lista estrelas (filtra por `--type` / `--constellation` / `--tag`). |
| `constellation rm <id>` | Remove uma estrela. |
| `constellation sync` | Regenera `index.md` + `constellation.json` (automático após save/rm; existe pra edição manual). |
| `constellation view` | Sobe server local e abre o grafo no browser. |

Detalhe: `save` lê o **corpo via stdin** (não como argumento) — jeito limpo do
agente mandar markdown multi-linha sem quebrar escaping.

## A skill (adoção pelo agente)

Entregue em dois formatos: uma **skill do Claude Code** (`skill/`) e um
**trecho de CLAUDE.md** colável em qualquer agente. Ela instrui:

1. **No início:** rodar `constellation open`, ler o índice, e puxar
   `show`/`query` **em vez de explorar o repo**. (Esse é o ganho de token.)
2. **Ao aprender algo durável** (decisão, gotcha, mapa de código, how-to):
   `constellation save …`. Com regras de qualidade de *o que salvar* / *o que
   não salvar* (não salvar o que código/git já conta; uma estrela = um fato;
   linkar com `[[…]]`).
3. **Ao terminar algo:** atualizar a estrela relevante.

## Visualização (`constellation view`)

- Server local leve (Node) lê `constellation.json` e serve uma página única.
- Grafo **force-directed**: cada estrela é um nó; **cor = tipo**; nós agrupados
  visualmente por **constelação**; linhas = `[[links]]`.
- Clica num nó → painel lateral renderiza o markdown da estrela.
- Filtros por tipo/constelação/tag e busca. **Read-only** no v1.
- Self-contained: lib de grafo empacotada (ex.: `react-force-graph` /
  `cytoscape`), sem CDN externo.

## Escopo do v1 (YAGNI) — fora de propósito

- Edição/curadoria pela UI → v2
- Arestas tipadas (relation: explica/depende/substitui) → v2
- Auto-captura via hooks → a captura é dirigida pela IA
- Busca semântica/embeddings → v1 é busca textual + tags
- Constellation global multi-projeto → v1 é por projeto
- Detecção automática de obsolescência → v2

## Critérios de sucesso

- Um agente consegue: `init` → `save` várias estrelas → `open` devolve um
  índice compacto → `show`/`query` devolvem conteúdo/summaries corretos.
- `index.md` e `constellation.json` sempre reconstroem 1:1 a partir dos
  `stars/*.md` (idempotente).
- Links `[[slug]]` e a lista `links:` do frontmatter viram arestas no grafo.
- `constellation view` abre um grafo navegável, colorido por tipo, agrupado
  por constelação, com o markdown renderizável ao clicar.
- `core/` coberto por testes (parse, serialize, build de índice, query, links).
