## Constellation (memória de projeto)

Este projeto usa Constellation. **No início:** rode `constellation open` e leia o
índice; puxe detalhes com `constellation show <id>` / `constellation query <termo>`
em vez de explorar o repo.

**Ao aprender algo durável** (decisão, gotcha, mapa de código, how-to): salve um
**dossiê**, não um resumo. O corpo (markdown via stdin) deve ter seções
`## Contexto`, `## Por quê`, `## Como`, `## Gotchas`, e aponte os arquivos e
referências:

```
constellation save --id <id> --type <code-map|decision|gotcha|doc> \
  --title <t> --summary <uma-linha> [--constellation <cluster>] \
  [--tags a,b] [--files caminho1,caminho2] [--refs ticket,link] [--links x,y]
```

Uma estrela = um fato; conecte com `[[id]]`. `--files` também faz a estrela ser
encontrada por nome de arquivo no `query`.
