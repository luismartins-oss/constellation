#!/usr/bin/env node

// src/cli/index.ts
import { Command } from "commander";

// src/cli/handlers.ts
import fs3 from "fs";
import process2 from "process";

// src/core/store.ts
import fs from "fs";
import path2 from "path";

// src/core/paths.ts
import path from "path";
var ROOT_DIR = ".constellation";
var ALL_TYPES = ["code-map", "decision", "gotcha", "doc"];
var TYPE_TO_DIR = {
  "code-map": "code-map",
  "decision": "decisions",
  "gotcha": "gotchas",
  "doc": "docs"
};
function starFilePath(root, type, id) {
  return path.join(root, "stars", TYPE_TO_DIR[type], `${id}.md`);
}
function indexPath(root) {
  return path.join(root, "index.md");
}
function graphPath(root) {
  return path.join(root, "constellation.json");
}
function configPath(root) {
  return path.join(root, "config.json");
}

// src/core/star.ts
import matter from "gray-matter";
var WIKILINK_RE = /\[\[([a-z0-9][a-z0-9-]*)\]\]/g;
var ID_RE = /^[a-z0-9][a-z0-9-]*$/;
function extractWikilinks(body) {
  const out = [];
  for (const m of body.matchAll(WIKILINK_RE)) out.push(m[1]);
  return out;
}
function resolvedLinks(star) {
  const set = /* @__PURE__ */ new Set([...star.links, ...extractWikilinks(star.body)]);
  set.delete(star.id);
  return [...set].sort();
}
function parseStar(raw) {
  const { data, content } = matter(raw);
  const type = data.type;
  if (!ALL_TYPES.includes(type)) {
    throw new Error(`estrela inv\xE1lida: type "${data.type}" n\xE3o \xE9 um de ${ALL_TYPES.join(", ")}`);
  }
  if (!data.id) throw new Error("estrela inv\xE1lida: falta id");
  const id = String(data.id);
  if (!ID_RE.test(id)) {
    throw new Error(`estrela inv\xE1lida: id "${id}" deve casar ${String(ID_RE)} (min\xFAsculas, n\xFAmeros e h\xEDfens)`);
  }
  return {
    id,
    type,
    constellation: String(data.constellation ?? "geral"),
    title: String(data.title ?? data.id),
    summary: String(data.summary ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    links: Array.isArray(data.links) ? data.links.map(String) : [],
    // js-yaml parseia `updated: 2026-07-17` (sem aspas) como Date; normalizar p/ ISO YYYY-MM-DD.
    updated: data.updated instanceof Date ? data.updated.toISOString().slice(0, 10) : String(data.updated ?? ""),
    body: content.trim()
  };
}
function serializeStar(star) {
  const fm = {
    id: star.id,
    type: star.type,
    constellation: star.constellation,
    title: star.title,
    summary: star.summary,
    tags: star.tags,
    links: star.links,
    updated: star.updated
  };
  return matter.stringify(`${star.body}
`, fm);
}

// src/core/store.ts
function findRoot(cwd) {
  let dir = path2.resolve(cwd);
  for (; ; ) {
    const candidate = path2.join(dir, ROOT_DIR);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    const parent = path2.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function initStore(cwd, project) {
  const root = path2.join(path2.resolve(cwd), ROOT_DIR);
  for (const t of ALL_TYPES) {
    fs.mkdirSync(path2.join(root, "stars", TYPE_TO_DIR[t]), { recursive: true });
  }
  const cfg = { project, schema: 1 };
  fs.writeFileSync(configPath(root), JSON.stringify(cfg, null, 2) + "\n");
  return root;
}
function readConfig(root) {
  return JSON.parse(fs.readFileSync(configPath(root), "utf8"));
}
function readAllStars(root) {
  const stars = [];
  for (const t of ALL_TYPES) {
    const dir = path2.join(root, "stars", TYPE_TO_DIR[t]);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const file = path2.join(dir, f);
      try {
        stars.push(parseStar(fs.readFileSync(file, "utf8")));
      } catch (err) {
        console.warn(`constellation: ignorando estrela inv\xE1lida ${file}: ${err.message}`);
      }
    }
  }
  stars.sort((a, b) => a.id.localeCompare(b.id));
  return stars;
}
function readStar(root, id) {
  return readAllStars(root).find((s) => s.id === id) ?? null;
}
function writeStar(root, star) {
  for (const t of ALL_TYPES) {
    const p = starFilePath(root, t, star.id);
    if (t !== star.type && fs.existsSync(p)) fs.rmSync(p);
  }
  fs.writeFileSync(starFilePath(root, star.type, star.id), serializeStar(star));
}
function removeStar(root, id) {
  const found = readStar(root, id);
  if (!found) return false;
  fs.rmSync(starFilePath(root, found.type, found.id));
  return true;
}

// src/core/build.ts
import fs2 from "fs";
function buildIndexMarkdown(project, stars) {
  const byCluster = /* @__PURE__ */ new Map();
  for (const s of stars) {
    const arr = byCluster.get(s.constellation) ?? [];
    arr.push(s);
    byCluster.set(s.constellation, arr);
  }
  const lines = [`# Constellation \u2014 ${project}`, ""];
  for (const cluster of [...byCluster.keys()].sort()) {
    lines.push(`## ${cluster}`, "");
    for (const s of byCluster.get(cluster)) {
      lines.push(`- [${s.id}] (${s.type}) ${s.summary}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
function buildGraph(project, stars) {
  const ids = new Set(stars.map((s) => s.id));
  const edges = [];
  for (const s of stars) {
    for (const target of resolvedLinks(s)) {
      if (ids.has(target)) edges.push({ source: s.id, target });
    }
  }
  return {
    project,
    nodes: stars.map((s) => ({
      id: s.id,
      type: s.type,
      constellation: s.constellation,
      title: s.title,
      summary: s.summary,
      tags: s.tags
    })),
    edges
  };
}
function sync(root) {
  const project = readConfig(root).project;
  const stars = readAllStars(root);
  fs2.writeFileSync(indexPath(root), buildIndexMarkdown(project, stars));
  fs2.writeFileSync(graphPath(root), JSON.stringify(buildGraph(project, stars), null, 2) + "\n");
}

// src/core/query.ts
function matchesFilter(s, f) {
  if (f.type && s.type !== f.type) return false;
  if (f.constellation && s.constellation !== f.constellation) return false;
  if (f.tag && !s.tags.includes(f.tag)) return false;
  return true;
}
function listStars(stars, filter = {}) {
  return stars.filter((s) => matchesFilter(s, filter));
}
function queryStars(stars, term, filter = {}) {
  const q = term.toLowerCase();
  return stars.filter((s) => {
    if (!matchesFilter(s, filter)) return false;
    const hay = [s.id, s.title, s.summary, s.body, s.tags.join(" ")].join("\n").toLowerCase();
    return hay.includes(q);
  });
}

// src/cli/handlers.ts
function requireRoot() {
  const root = findRoot(process2.cwd());
  if (!root) {
    console.error("nenhum .constellation encontrado. rode `constellation init <projeto>` primeiro.");
    process2.exit(1);
  }
  return root;
}
function splitList(v) {
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}
function today() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function readStdin() {
  return new Promise((resolve) => {
    if (process2.stdin.isTTY) return resolve("");
    let data = "";
    process2.stdin.setEncoding("utf8");
    process2.stdin.on("data", (c) => data += c);
    process2.stdin.on("end", () => resolve(data));
  });
}
function cmdInit(project) {
  if (findRoot(process2.cwd())) {
    console.error(".constellation j\xE1 existe aqui (ou acima). Nada a fazer.");
    process2.exit(1);
  }
  const root = initStore(process2.cwd(), project);
  sync(root);
  console.log(`constellation criada em ${root}`);
}
async function cmdSave(opts) {
  if (!ID_RE.test(opts.id)) {
    console.error(`id inv\xE1lido: "${opts.id}" \u2014 use apenas min\xFAsculas, n\xFAmeros e h\xEDfens (ex: backend-aportes).`);
    process2.exit(1);
  }
  if (!ALL_TYPES.includes(opts.type)) {
    console.error(`type inv\xE1lido: "${opts.type}" \u2014 use um de: ${ALL_TYPES.join(", ")}.`);
    process2.exit(1);
  }
  const root = requireRoot();
  const body = await readStdin();
  const star = {
    id: opts.id,
    type: opts.type,
    title: opts.title,
    summary: opts.summary,
    constellation: opts.constellation ?? "geral",
    tags: splitList(opts.tags),
    links: splitList(opts.links),
    updated: opts.updated ?? today(),
    body: body.trim()
  };
  writeStar(root, star);
  sync(root);
  console.log(`estrela salva: ${star.id}`);
}
function cmdOpen() {
  const root = requireRoot();
  process2.stdout.write(fs3.readFileSync(indexPath(root), "utf8"));
}
function cmdSync() {
  const root = requireRoot();
  sync(root);
  console.log("\xEDndice e grafo regenerados");
}
function printStar(s) {
  console.log(`# ${s.title}  [${s.id}]`);
  console.log(`type: ${s.type} \xB7 constellation: ${s.constellation} \xB7 tags: ${s.tags.join(", ")}`);
  console.log("");
  console.log(s.body);
}
function printSummaries(stars) {
  if (stars.length === 0) {
    console.log("(nenhuma estrela)");
    return;
  }
  for (const s of stars) console.log(`[${s.id}] (${s.type}/${s.constellation}) ${s.summary}`);
}
function cmdShow(id, withLinks) {
  const root = requireRoot();
  const star = readStar(root, id);
  if (!star) {
    console.error(`estrela n\xE3o encontrada: ${id}`);
    process2.exit(1);
  }
  printStar(star);
  if (withLinks) {
    for (const linkId of resolvedLinks(star)) {
      const n = readStar(root, linkId);
      if (n) {
        console.log("\n---\n");
        printStar(n);
      }
    }
  }
}
function cmdQuery(term, filter) {
  const root = requireRoot();
  printSummaries(queryStars(readAllStars(root), term, filter));
}
function cmdList(filter) {
  const root = requireRoot();
  printSummaries(listStars(readAllStars(root), filter));
}
function cmdRm(id) {
  const root = requireRoot();
  if (!removeStar(root, id)) {
    console.error(`estrela n\xE3o encontrada: ${id}`);
    process2.exit(1);
  }
  sync(root);
  console.log(`estrela removida: ${id}`);
}

// src/cli/view.ts
import process3 from "process";

// src/viz/server.ts
import http from "http";
import fs4 from "fs";
import path3 from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
var dirname = path3.dirname(fileURLToPath(import.meta.url));
function sendFile(res, file, type) {
  fs4.readFile(file, (err, buf) => {
    if (err) {
      res.statusCode = 404;
      res.end("n\xE3o encontrado");
      return;
    }
    res.setHeader("Content-Type", type);
    res.end(buf);
  });
}
function startServer(root, port) {
  const webDir = path3.join(dirname, "web");
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/") return sendFile(res, path3.join(webDir, "index.html"), "text/html; charset=utf-8");
      if (url.pathname === "/app.js") return sendFile(res, path3.join(webDir, "app.js"), "text/javascript");
      if (url.pathname === "/data") return sendFile(res, graphPath(root), "application/json");
      if (url.pathname.startsWith("/star/")) {
        const id = decodeURIComponent(url.pathname.slice("/star/".length));
        const star = readStar(root, id);
        if (!star) {
          res.statusCode = 404;
          res.end("n\xE3o encontrada");
          return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(await marked.parse(star.body));
        return;
      }
      res.statusCode = 404;
      res.end("n\xE3o encontrado");
    } catch (err) {
      res.statusCode = 500;
      res.end(`erro interno: ${err.message}`);
    }
  });
  return new Promise((resolve) => {
    server.listen(port, () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({ url: `http://localhost:${actualPort}`, close: () => server.close() });
    });
  });
}

// src/cli/view.ts
async function cmdView(port) {
  const root = findRoot(process3.cwd());
  if (!root) {
    console.error("nenhum .constellation encontrado. rode `constellation init <projeto>`.");
    process3.exit(1);
  }
  const { url } = await startServer(root, port);
  console.log(`Constellation aberta em ${url} (Ctrl+C pra sair)`);
}

// src/cli/index.ts
var program = new Command();
program.name("constellation").description("Contexto de projeto para agentes de IA").version("0.1.0");
program.command("init").argument("<project>", "nome do projeto").action(cmdInit);
program.command("save").description("cria/atualiza uma estrela (corpo markdown via stdin)").requiredOption("--id <id>").requiredOption("--type <type>", "code-map | decision | gotcha | doc").requiredOption("--title <title>").requiredOption("--summary <summary>", "uma linha").option("--constellation <cluster>").option("--tags <list>", "separadas por v\xEDrgula").option("--links <list>", "ids separados por v\xEDrgula").option("--updated <date>", "YYYY-MM-DD").action((opts) => cmdSave(opts));
program.command("open").description("imprime o \xEDndice barato").action(cmdOpen);
program.command("sync").description("regenera index.md e constellation.json").action(cmdSync);
program.command("show").argument("<id>").option("--links", "incluir estrelas vizinhas").action((id, opts) => cmdShow(id, Boolean(opts.links)));
program.command("query").argument("<term>").option("--type <type>").option("--constellation <cluster>").option("--tag <tag>").action((term, opts) => cmdQuery(term, opts));
program.command("list").option("--type <type>").option("--constellation <cluster>").option("--tag <tag>").action((opts) => cmdList(opts));
program.command("rm").argument("<id>").action(cmdRm);
program.command("view").description("abre o grafo no browser").option("--port <port>", "porta", "4747").action((opts) => cmdView(Number(opts.port)));
program.parseAsync().catch((err) => {
  console.error(`erro: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
