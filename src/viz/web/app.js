"use strict";

/* Constellation — carta celeste. Lê /data (grafo) e /star/:id (markdown). */

const TYPES = {
  "code-map": { label: "mapa",    glyph: "disc" },
  "decision": { label: "decisão", glyph: "diamond" },
  "gotcha":   { label: "gotcha",  glyph: "star" },
  "doc":      { label: "doc",     glyph: "ring" },
};
const FALLBACK = { label: "estrela", glyph: "disc" };
const typeInfo = (t) => TYPES[t] || FALLBACK;
const INK = "#1b2432";
const PAPER = "#e9edf2";

const canvas = document.getElementById("sky"), ctx = canvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let W = 0, H = 0, DPR = 1;
let nodes = [], edges = [], galaxies = [], galInfo = {}, nodeById = {}, nodeData = {};
const cam = { x: 0, y: 0, zoom: 0.66 };
const b0 = { minx: -300, miny: -300, maxx: 300, maxy: 300 };
let hovered = null, selected = null, RING = 430;

let seed = 20260720;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

async function init() {
  let graph;
  try { graph = await (await fetch("/data")).json(); }
  catch (e) { graph = { project: "", nodes: [], edges: [] }; }

  document.title = graph.project ? `Constellation — ${graph.project}` : "Constellation";
  document.getElementById("brandSub").textContent = graph.project ? "carta celeste · " + graph.project : "carta celeste";
  graph.nodes.forEach(n => { nodeData[n.id] = n; });

  const seen = {};
  graph.nodes.forEach(n => { const g = n.constellation || "geral"; if (!seen[g]) { seen[g] = 1; galaxies.push(g); } });

  const eset = {};
  graph.edges.forEach(e => {
    if (!nodeData[e.source] || !nodeData[e.target]) return;
    const k = e.source < e.target ? e.source + "|" + e.target : e.target + "|" + e.source;
    if (eset[k]) return; eset[k] = 1; edges.push({ a: e.source, b: e.target });
  });
  const degree = {};
  graph.nodes.forEach(n => (degree[n.id] = 0));
  edges.forEach(e => { degree[e.a]++; degree[e.b]++; });

  nodes = graph.nodes.map(n => ({ id: n.id, g: n.constellation || "geral", type: n.type, x: 0, y: 0, vx: 0, vy: 0, r: 3.4 + Math.min(degree[n.id] || 0, 6) * 1.15 }));
  nodes.forEach(n => (nodeById[n.id] = n));

  document.getElementById("legend").innerHTML = Object.values(TYPES).map(v => `<span class="item">${typeSvg(v.glyph)} ${v.label}</span>`).join("");
  document.getElementById("telemetry").innerHTML = `<b>${nodes.length}</b> estrelas &nbsp;·&nbsp; <b>${edges.length}</b> conexões &nbsp;·&nbsp; <b>${galaxies.length}</b> constelações`;

  if (nodes.length === 0) { document.getElementById("empty").classList.add("show"); }
  else { layout(); }
  resize();
  requestAnimationFrame(draw);
}

function layout() {
  const galAnchor = {};
  galaxies.forEach((g, i) => { const a = (i / galaxies.length) * Math.PI * 2 - Math.PI / 2; galAnchor[g] = { x: Math.cos(a) * RING, y: Math.sin(a) * RING }; });
  if (galaxies.length === 1) galAnchor[galaxies[0]] = { x: 0, y: 0 };
  nodes.forEach(n => { const a = galAnchor[n.g]; n.x = a.x + (rnd() - 0.5) * 150; n.y = a.y + (rnd() - 0.5) * 150; });

  const IT = 440;
  for (let it = 0; it < IT; it++) {
    const cool = 1 - it / IT;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 0.01) { dx = rnd() - 0.5; dy = rnd() - 0.5; d2 = 0.01; }
      const s = (a.g === b.g ? 2400 : 5000) / d2, d = Math.sqrt(d2);
      a.vx += dx / d * s; a.vy += dy / d * s; b.vx -= dx / d * s; b.vy -= dy / d * s;
    }
    edges.forEach(e => { const a = nodeById[e.a], b = nodeById[e.b]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1; const rest = a.g === b.g ? 78 : 230, f = (d - rest) * 0.02; a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f; });
    nodes.forEach(n => { const a = galAnchor[n.g]; n.vx += (a.x - n.x) * 0.012; n.vy += (a.y - n.y) * 0.012; });
    nodes.forEach(n => { n.x += n.vx * 0.16 * cool; n.y += n.vy * 0.16 * cool; n.vx *= 0.82; n.vy *= 0.82; });
  }

  b0.minx = b0.miny = 1e9; b0.maxx = b0.maxy = -1e9;
  nodes.forEach(n => { b0.minx = Math.min(b0.minx, n.x); b0.maxx = Math.max(b0.maxx, n.x); b0.miny = Math.min(b0.miny, n.y); b0.maxy = Math.max(b0.maxy, n.y); });
  cam.x = (b0.minx + b0.maxx) / 2; cam.y = (b0.miny + b0.maxy) / 2;
  galaxies.forEach(g => { const m = nodes.filter(n => n.g === g); let cx = 0, cy = 0; m.forEach(n => { cx += n.x; cy += n.y; }); cx /= m.length; cy /= m.length; let rad = 50; m.forEach(n => rad = Math.max(rad, Math.hypot(n.x - cx, n.y - cy))); galInfo[g] = { cx, cy, r: rad }; });
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR; canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!resize.done && nodes.length) { const gw = b0.maxx - b0.minx + 300, gh = b0.maxy - b0.miny + 300; cam.zoom = Math.min(W / gw, H / gh, 0.85); resize.done = true; }
}
addEventListener("resize", resize);

function w2s(x, y) { return { x: (x - cam.x) * cam.zoom + W / 2, y: (y - cam.y) * cam.zoom + H / 2 }; }
function s2w(x, y) { return { x: (x - W / 2) / cam.zoom + cam.x, y: (y - H / 2) / cam.zoom + cam.y }; }

function glyph(g, x, y, r, soft) {
  ctx.beginPath();
  if (g === "disc") { ctx.arc(x, y, r, 0, 7); fillStroke(soft, false); }
  else if (g === "ring") { ctx.arc(x, y, r, 0, 7); fillStroke(soft, true); }
  else if (g === "diamond") { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); fillStroke(soft, false); }
  else { const R = r * 1.35, ir = r * 0.42; for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4 - Math.PI / 2, rad = i % 2 ? ir : R, px = x + Math.cos(ang) * rad, py = y + Math.sin(ang) * rad; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); fillStroke(soft, false); }
}
function fillStroke(soft, open) {
  if (open) { ctx.lineWidth = 1.4; ctx.strokeStyle = soft ? "rgba(27,36,50,0.28)" : INK; ctx.stroke(); }
  else { ctx.fillStyle = soft ? "rgba(27,36,50,0.28)" : INK; ctx.fill(); }
}

function draw() {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);

  const cc = w2s((b0.minx + b0.maxx) / 2, (b0.miny + b0.maxy) / 2);
  ctx.strokeStyle = "rgba(27,36,50,0.05)"; ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cc.x, cc.y, (RING * 0.55 * i / 3) * cam.zoom, 0, 7); ctx.stroke(); }

  const neigh = new Set();
  if (hovered) { neigh.add(hovered.id); edges.forEach(e => { if (e.a === hovered.id) neigh.add(e.b); if (e.b === hovered.id) neigh.add(e.a); }); }

  for (const e of edges) {
    const a = nodeById[e.a], b = nodeById[e.b], pa = w2s(a.x, a.y), pb = w2s(b.x, b.y);
    const inc = hovered && (e.a === hovered.id || e.b === hovered.id);
    ctx.strokeStyle = inc ? "rgba(138,109,59,0.85)" : (hovered ? "rgba(27,36,50,0.05)" : "rgba(27,36,50,0.16)");
    ctx.lineWidth = inc ? 1.3 : 0.7;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }

  for (const n of nodes) {
    const p = w2s(n.x, n.y), t = typeInfo(n.type), dim = hovered && !neigh.has(n.id);
    const isSel = selected && selected.id === n.id, isHov = hovered && hovered.id === n.id;
    const rr = (n.r * cam.zoom) * ((isHov || isSel) ? 1.5 : 1);
    if (isSel || isHov) { ctx.beginPath(); ctx.arc(p.x, p.y, rr + 6, 0, 7); ctx.strokeStyle = "rgba(138,109,59,0.9)"; ctx.lineWidth = 1.2; ctx.stroke(); }
    glyph(t.glyph, p.x, p.y, Math.max(rr, 2.2), dim);
  }

  ctx.textAlign = "center";
  const serif = getComputedStyle(document.body).getPropertyValue("--serif");
  for (const g of galaxies) {
    const gi = galInfo[g]; if (!gi) continue;
    const c = w2s(gi.cx, gi.cy - gi.r - 26 / cam.zoom);
    ctx.font = "italic 600 " + Math.max(12, 15 * Math.min(cam.zoom * 1.4, 1.35)) + "px " + serif;
    ctx.fillStyle = hovered ? "rgba(27,36,50,0.3)" : "rgba(27,36,50,0.62)";
    ctx.fillText(g, c.x, c.y);
  }
  requestAnimationFrame(draw);
}

/* ---- interação ---- */
function pick(mx, my) { let best = null, bd = 1e9; for (const n of nodes) { const p = w2s(n.x, n.y), rr = Math.max(n.r * cam.zoom + 9, 13), d = Math.hypot(p.x - mx, p.y - my); if (d < rr && d < bd) { bd = d; best = n; } } return best; }
let drag = false, moved = false, last = null;
canvas.addEventListener("mousedown", e => { drag = true; moved = false; last = { x: e.clientX, y: e.clientY }; canvas.classList.add("dragging"); });
addEventListener("mouseup", () => { drag = false; canvas.classList.remove("dragging"); });
addEventListener("mousemove", e => { if (drag) { const dx = e.clientX - last.x, dy = e.clientY - last.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; cam.x -= dx / cam.zoom; cam.y -= dy / cam.zoom; last = { x: e.clientX, y: e.clientY }; } else { const h = pick(e.clientX, e.clientY); hovered = h; canvas.style.cursor = h ? "pointer" : "grab"; } });
canvas.addEventListener("wheel", e => { e.preventDefault(); const b = s2w(e.clientX, e.clientY); cam.zoom = Math.max(0.25, Math.min(3, cam.zoom * Math.exp(-e.deltaY * 0.0012))); const a = s2w(e.clientX, e.clientY); cam.x += b.x - a.x; cam.y += b.y - a.y; }, { passive: false });
canvas.addEventListener("click", e => { if (moved) return; const n = pick(e.clientX, e.clientY); n ? openPanel(n.id) : closePanel(); });

/* ---- glifos em SVG (legenda + painel) ---- */
function typeSvg(g) {
  if (g === "disc") return `<svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="${INK}"/></svg>`;
  if (g === "ring") return `<svg width="12" height="12"><circle cx="6" cy="6" r="3.6" fill="none" stroke="${INK}" stroke-width="1.4"/></svg>`;
  if (g === "diamond") return `<svg width="12" height="12"><path d="M6 1.5 L10.5 6 L6 10.5 L1.5 6 Z" fill="${INK}"/></svg>`;
  return `<svg width="13" height="13"><path d="M6.5 0 L7.7 5.3 L13 6.5 L7.7 7.7 L6.5 13 L5.3 7.7 L0 6.5 L5.3 5.3 Z" fill="${INK}"/></svg>`;
}

/* ---- painel: dossiê ---- */
const panel = document.getElementById("panel");
async function openPanel(id) {
  const s = nodeData[id]; if (!s) return; selected = nodeById[id];
  const t = typeInfo(s.type);
  document.getElementById("pId").textContent = s.id;
  document.getElementById("pTitle").textContent = s.title || s.id;
  document.getElementById("pSummary").textContent = s.summary || "";
  document.getElementById("pMeta").innerHTML = `<span class="type">${typeSvg(t.glyph)} ${t.label}</span><span class="gal">${esc(s.constellation || "geral")}</span>`;

  const body = document.getElementById("pBody");
  let head = "";
  if (s.files && s.files.length) head += `<div class="sec"><div class="lbl">Arquivos</div><div class="files">${s.files.map(f => `<span class="f">${esc(f)}</span>`).join("")}</div></div>`;
  body.innerHTML = head + `<div class="sec"><div class="prose" id="pProse"><p style="color:var(--ink-soft)">carregando…</p></div></div>`;
  panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");

  let html = "";
  try { const r = await fetch("/star/" + encodeURIComponent(id)); html = r.ok ? await r.text() : ""; }
  catch (e) { html = ""; }
  html = html.replace(/\[\[([a-z0-9][a-z0-9-]*)\]\]/g, (m, wid) => nodeData[wid] ? `<span class="wl" data-go="${wid}">${wid}</span>` : m);
  const prose = document.getElementById("pProse");
  if (prose) prose.innerHTML = html || "<p style=\"color:var(--ink-soft)\">(sem conteúdo)</p>";
  if (s.refs && s.refs.length) body.insertAdjacentHTML("beforeend", `<div class="sec"><div class="lbl">Referências</div><div class="refs">${s.refs.map(r => `<span class="r">${esc(r)}</span>`).join("")}</div></div>`);

  const near = edges.filter(e => e.a === id || e.b === id).map(e => e.a === id ? e.b : e.a);
  const le = document.getElementById("pLinks");
  if (near.length) { le.style.display = ""; le.innerHTML = '<div class="lbl">Conexões</div>' + near.map(nid => { const ns = nodeData[nid]; return `<div class="lstar" data-go="${nid}">${typeSvg(typeInfo(ns.type).glyph)}<span class="t">${esc(ns.title || nid)}</span><span class="g">${esc(ns.constellation || "")}</span></div>`; }).join(""); }
  else le.style.display = "none";
}
function closePanel() { panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true"); selected = null; }
document.getElementById("pClose").addEventListener("click", closePanel);
document.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });
panel.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (g) openPanel(g.getAttribute("data-go")); });

init();
