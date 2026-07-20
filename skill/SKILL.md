---
name: constellation
description: Use no início de cada sessão para carregar o contexto do projeto de forma barata, e sempre que aprender algo durável (decisão, gotcha, mapa de código, how-to) para salvá-lo como um dossiê. Requer a CLI `constellation` instalada e uma pasta `.constellation/` no projeto.
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

## Ao aprender algo durável — salve um DOSSIÊ (não um resumo)

Uma estrela = um fato, guardado com **profundidade**. Não salve um parágrafo
solto: escreva o corpo em **seções markdown**, aponte os **arquivos** relevantes
(`--files`) e as **referências** (`--refs`). O objetivo é que outra sessão resolva
o assunto **sem reabrir o código**.

Seções recomendadas no corpo (use as que fizerem sentido):

- `## Contexto` — o que aconteceu / onde importa.
- `## Por quê` — a decisão e o raciocínio (o que o código não conta).
- `## Como` — passos concretos para fazer/reproduzir/corrigir (com trecho de
  código quando ajudar).
- `## Gotchas` — armadilhas, limites, o que quebra.

O corpo vai via **stdin**; os metadados via flags. Exemplo completo:

```bash
cat <<'MD' | constellation save --id asyncpg-in-limit --type gotcha \
    --title "IN grande estoura os binds do asyncpg" \
    --summary "WHERE col IN (lista grande) passa de 32.767 binds; use = ANY(array)." \
    --constellation "banco de dados" --tags "db,asyncpg" \
    --files "app/finance/aportes/repo.py,app/db/query_helpers.py" \
    --refs "Incidente #4821,asyncpg/issues/1247" \
    --links "wallets-cache,backend-aportes"
## Contexto
Dashboard de risco vinha vazio para carteiras grandes; a causa era um
WHERE id IN (...) com milhares de itens.

## Por quê
asyncpg tem teto de 32.767 parâmetros por statement.

## Como
Trocar IN (lista) por = ANY($1::int[]), passando a lista como um único array:

    await conn.fetch("... WHERE id = ANY($1::int[])", ids)

## Gotchas
O erro é silencioso: a query só volta vazia, sem estourar exceção.
MD
```

Tipos: `code-map` (onde as coisas moram), `decision` (o porquê),
`gotcha` (armadilha/workaround), `doc` (como rodar/deploy, links).

## O que salvar

- Mapa do código, decisões e seus porquês, gotchas, how-tos e referências.
- Sempre com **contexto + porquê**, os **arquivos** (`--files`) e, quando houver,
  **referências** (`--refs`: tickets, PRs, links).

## O que NÃO salvar

- O que o código/git já conta (estrutura óbvia, histórico de commits).
- O que só importa nesta conversa.
- Segredos/credenciais.

## Regras

- `summary` é uma linha (é o que aparece no índice); o **detalhe** vai no corpo.
- Liste em `--files` os caminhos que a pessoa precisa abrir; assim o `query`
  também acha a estrela por nome de arquivo.
- Conecte estrelas relacionadas com `[[id]]` no corpo ou `--links`.
- Ao terminar/mudar algo, atualize a estrela relevante (`save` com o mesmo `--id`).
- `constellation view` abre a carta celeste no browser quando o humano quiser ver.
