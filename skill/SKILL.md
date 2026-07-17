---
name: constellation
description: Use no início de cada sessão para carregar o contexto do projeto de forma barata, e sempre que aprender algo durável (decisão, gotcha, mapa de código, how-to) para salvá-lo. Requer a CLI `constellation` instalada e uma pasta `.constellation/` no projeto.
---

# Constellation

Memória de projeto versionada para agentes. Em vez de reexplorar o repo,
consulte a constelação; ao aprender algo durável, salve.

## No início da sessão

1. Rode `constellation open` e leia o índice (1 linha por estrela).
2. Só puxe o conteúdo completo do que for relevante:
   - `constellation show <id>` (use `--links` para trazer as estrelas vizinhas)
   - `constellation query <termo> [--type --constellation --tag]`
3. **Prefira isso a explorar o repo.** É o que economiza token.

## Ao aprender algo durável — salve

Uma estrela = um fato. Salve com o corpo markdown via stdin:

```bash
printf '%s' "Corpo em markdown, pode citar outras estrelas com [[outro-id]]." \
  | constellation save --id asyncpg-in-limit --type gotcha \
      --title "IN grande estoura binds do asyncpg" \
      --summary "WHERE col IN (lista grande) passa de 32767 binds; use id_in() (= ANY array)." \
      --constellation db --tags "db,asyncpg" --links "dashboard-risco"
```

Tipos: `code-map` (onde as coisas moram), `decision` (o porquê),
`gotcha` (armadilha/workaround), `doc` (como rodar/deploy, links).

## O que salvar

- Mapa do código, decisões e seus porquês, gotchas, how-tos e referências.

## O que NÃO salvar

- O que o código/git já conta (estrutura óbvia, histórico de commits).
- O que só importa nesta conversa.
- Segredos/credenciais.

## Regras

- `summary` é uma linha (é o que aparece no índice).
- Conecte estrelas relacionadas com `[[id]]` no corpo ou `--links`.
- Ao terminar algo, atualize a estrela relevante (`save` com o mesmo `--id`).
- `constellation view` abre o grafo no browser quando o humano quiser ver.
