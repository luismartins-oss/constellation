# Constellation

Contexto de projeto para agentes de IA. Guarda "estrelas" (unidades de
conhecimento) versionadas em `.constellation/`, entrega um índice barato +
conteúdo sob demanda (economia de token) e visualiza tudo como um grafo.

## Instalação

```bash
npm install -g constellation
# ou, sem instalar:
npx constellation <comando>
```

## Uso

```bash
constellation init "meu-projeto"     # cria .constellation/
constellation open                   # índice barato (início de sessão)
constellation show <id> [--links]    # conteúdo completo de uma estrela
constellation query <termo>          # busca (--type/--constellation/--tag)
constellation list                   # lista estrelas
echo "corpo md" | constellation save --id x --type gotcha --title "T" --summary "uma linha"
constellation rm <id>
constellation sync                   # regenera index.md + constellation.json
constellation view                   # abre o grafo no browser
```

## Integração com agentes

Copie `skill/claude-md-snippet.md` para o `CLAUDE.md` do projeto, ou instale a
skill em `skill/SKILL.md`. Ela ensina o agente a abrir o contexto no início e a
salvar o que aprende.

## Modelo de dados

Cada estrela é um markdown em `.constellation/stars/<tipo>/<id>.md` com
frontmatter (`id`, `type`, `constellation`, `title`, `summary`, `tags`, `links`,
`updated`). `index.md` e `constellation.json` são gerados por `sync` — não edite
na mão.
