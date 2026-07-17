"use strict";

/* Constellation — star-map renderer. Lê /data (grafo) e /star/:id (markdown). */

const TYPES = {
  "code-map": { color: "#5fb8ff", label: "mapa" },
  "decision": { color: "#ffce6b", label: "decisão" },
  "gotcha":   { color: "#ff6b8a", label: "gotcha" },
  "doc":      { color: "#7de0c4", label: "doc" },
};
const FALLBACK = { color: "#9aa6d0", label: "estrela" };
const typeInfo = (t) => TYPES[t] || FALLBACK;

const canvas = document.getElementById("sky");
const ctx = canvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let W = 0, H = 0, DPR = 1;
let nodes = [], edges = [], galaxies = [], galInfo = {}, nodeById = {}, nodeData = {};
const cam = { x: 0, y: 0, zoom: 0.62 };
const bounds = { minx: -300, miny: -300, maxx: 300, maxy: 300 };
let hovered = null, selected = null, t0 = null, ready = false;

let seed = 20260717;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

/* ---------------------------------------------------------- background --- */
const bgStars = [];
for (let i = 0; i < 320; i++) {
  bgStars.push({ x: (rnd() - 0.5) * 2600, y: (rnd() - 0.5) * 2000, r: rnd() * 1.3 + 0.2, tw: rnd() * Math.PI * 2, sp: 0.6 + rnd() * 1.6, par: 0.35 + rnd() * 0.4 });
}

/* ---------------------------------------------------------------- init --- */
async function init() {
  let graph;
  try { graph = await (await fetch("/data")).json(); }
  catch (e) { graph = { project: "", nodes: [], edges: [] }; }

  document.title = graph.project ? `Constellation — ${graph.project}` : "Constellation";
  document.getElementById("brandSub").textContent = graph.project ? "mapa estelar · " + graph.project : "mapa estelar";

  graph.nodes.forEach(n => { nodeData[n.id] = n; });

  // galaxies (clusters by constellation)
  const seen = {};
  graph.nodes.forEach(n => { const g = n.constellation || "geral"; if (!seen[g]) { seen[g] = true; galaxies.push(g); } });
  const galaxyHue = {};
  galaxies.forEach((g, i) => { galaxyHue[g] = (28 + i * 137.5) % 360; });

  // dedup undirected edges among existing nodes
  const eset = {};
  graph.edges.forEach(e => {
    if (!nodeData[e.source] || !nodeData[e.target]) return;
    const k = e.source < e.target ? e.source + "|" + e.target : e.target + "|" + e.source;
    if (eset[k]) return; eset[k] = true;
    edges.push({ a: e.source, b: e.target });
  });
  const degree = {};
  graph.nodes.forEach(n => (degree[n.id] = 0));
  edges.forEach(e => { degree[e.a]++; degree[e.b]++; });

  nodes = graph.nodes.map(n => ({
    id: n.id, g: n.constellation || "geral", type: n.type,
    x: 0, y: 0, vx: 0, vy: 0,
    r: 4.5 + Math.min(degree[n.id] || 0, 6) * 1.9,
    phase: (n.id.charCodeAt(0) + n.id.length * 7) % 100 / 100 * Math.PI * 2,
    hue: galaxyHue[n.constellation || "geral"],
  }));
  nodes.forEach(n => (nodeById[n.id] = n));

  document.getElementById("legend").innerHTML = Object.entries(TYPES).map(([k, v]) =>
    `<span class="item"><span class="dot" style="background:${v.color};box-shadow:0 0 8px ${v.color}"></span>${v.label}</span>`).join("");
  document.getElementById("telemetry").innerHTML =
    `<b>${nodes.length}</b> estrelas &nbsp;·&nbsp; <b>${edges.length}</b> conexões &nbsp;·&nbsp; <b>${galaxies.length}</b> galáxias`;

  if (nodes.length === 0) { document.getElementById("empty").classList.add("show"); }
  else { layout(galaxyHue); }

  ready = true;
  resize();
  requestAnimationFrame(draw);
}

/* ------------------------------------------------------------- layout ---- */
function layout(galaxyHue) {
  const RING = 470;
  const galAnchor = {};
  galaxies.forEach((g, i) => {
    const a = (i / galaxies.length) * Math.PI * 2 - Math.PI / 2;
    galAnchor[g] = { x: Math.cos(a) * RING, y: Math.sin(a) * RING };
  });
  if (galaxies.length === 1) galAnchor[galaxies[0]] = { x: 0, y: 0 };
  nodes.forEach(n => { const a = galAnchor[n.g]; n.x = a.x + (rnd() - 0.5) * 160; n.y = a.y + (rnd() - 0.5) * 160; });

  const iterations = 420;
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = rnd() - 0.5; dy = rnd() - 0.5; d2 = 0.01; }
        const strength = (a.g === b.g ? 2600 : 5200) / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * strength; a.vy += (dy / d) * strength;
        b.vx -= (dx / d) * strength; b.vy -= (dy / d) * strength;
      }
    }
    edges.forEach(e => {
      const a = nodeById[e.a], b = nodeById[e.b];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const rest = a.g === b.g ? 84 : 240;
      const f = (d - rest) * 0.02;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    });
    nodes.forEach(n => { const a = galAnchor[n.g]; n.vx += (a.x - n.x) * 0.012; n.vy += (a.y - n.y) * 0.012; });
    nodes.forEach(n => { n.x += n.vx * 0.16 * cool; n.y += n.vy * 0.16 * cool; n.vx *= 0.82; n.vy *= 0.82; });
  }

  bounds.minx = bounds.miny = 1e9; bounds.maxx = bounds.maxy = -1e9;
  nodes.forEach(n => {
    bounds.minx = Math.min(bounds.minx, n.x); bounds.maxx = Math.max(bounds.maxx, n.x);
    bounds.miny = Math.min(bounds.miny, n.y); bounds.maxy = Math.max(bounds.maxy, n.y);
  });
  cam.x = (bounds.minx + bounds.maxx) / 2; cam.y = (bounds.miny + bounds.maxy) / 2;

  galaxies.forEach(g => {
    const members = nodes.filter(n => n.g === g);
    let cx = 0, cy = 0; members.forEach(n => { cx += n.x; cy += n.y; }); cx /= members.length; cy /= members.length;
    let rad = 60; members.forEach(n => { rad = Math.max(rad, Math.hypot(n.x - cx, n.y - cy)); });
    galInfo[g] = { cx, cy, r: rad + 70, hue: galaxyHue[g] };
  });
}

/* --------------------------------------------------------------- view ---- */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!resize.done && nodes.length) {
    const gw = (bounds.maxx - bounds.minx) + 320, gh = (bounds.maxy - bounds.miny) + 320;
    cam.zoom = Math.min(W / gw, H / gh, 0.9); resize.done = true;
  }
}
window.addEventListener("resize", () => { if (ready) resize(); });

function w2s(x, y) { return { x: (x - cam.x) * cam.zoom + W / 2, y: (y - cam.y) * cam.zoom + H / 2 }; }
function s2w(x, y) { return { x: (x - W / 2) / cam.zoom + cam.x, y: (y - H / 2) / cam.zoom + cam.y }; }

/* --------------------------------------------------------------- draw ---- */
function draw(ts) {
  if (t0 === null) t0 = ts;
  const time = reduceMotion ? 0 : (ts - t0) / 1000;

  const bg = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.85);
  bg.addColorStop(0, "#0c1226"); bg.addColorStop(0.55, "#070a17"); bg.addColorStop(1, "#04050b");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.save();
  for (const s of bgStars) {
    const sx = (s.x - cam.x * s.par) * cam.zoom + W / 2;
    const sy = (s.y - cam.y * s.par) * cam.zoom + H / 2;
    if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
    const tw = reduceMotion ? 0.7 : 0.5 + 0.5 * Math.sin(time * s.sp + s.tw);
    ctx.globalAlpha = 0.15 + tw * 0.5; ctx.fillStyle = "#cdd8ff";
    ctx.beginPath(); ctx.arc(sx, sy, s.r * (0.7 + tw * 0.5), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // galaxy nebulae
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const g of galaxies) {
    const gi = galInfo[g]; if (!gi) continue;
    const c = w2s(gi.cx, gi.cy); const R = gi.r * cam.zoom;
    const pulse = reduceMotion ? 1 : 1 + 0.04 * Math.sin(time * 0.5 + gi.hue);
    const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R * pulse);
    grad.addColorStop(0, `hsla(${gi.hue},80%,62%,0.16)`);
    grad.addColorStop(0.45, `hsla(${gi.hue},75%,55%,0.06)`);
    grad.addColorStop(1, `hsla(${gi.hue},70%,50%,0)`);
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(c.x, c.y, R * pulse, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  const neigh = new Set();
  if (hovered) { neigh.add(hovered.id); edges.forEach(e => { if (e.a === hovered.id) neigh.add(e.b); if (e.b === hovered.id) neigh.add(e.a); }); }

  // constellation lines
  for (const e of edges) {
    const a = nodeById[e.a], b = nodeById[e.b];
    const pa = w2s(a.x, a.y), pb = w2s(b.x, b.y);
    const incident = hovered && (e.a === hovered.id || e.b === hovered.id);
    const ca = typeInfo(a.type).color, cb = typeInfo(b.type).color;
    const grad = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
    const al = incident ? 0.85 : (hovered ? 0.06 : 0.2);
    grad.addColorStop(0, hexA(ca, al)); grad.addColorStop(1, hexA(cb, al));
    ctx.strokeStyle = grad; ctx.lineWidth = incident ? 1.6 : 0.8;
    if (incident) { ctx.shadowColor = hexA(ca, 0.8); ctx.shadowBlur = 8; }
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); ctx.shadowBlur = 0;
  }

  // stars
  for (const n of nodes) {
    const p = w2s(n.x, n.y); const col = typeInfo(n.type).color;
    const dim = hovered && !neigh.has(n.id);
    const isSel = selected && selected.id === n.id;
    const isHov = hovered && hovered.id === n.id;
    const tw = reduceMotion ? 1 : 0.82 + 0.18 * Math.sin(time * 1.6 + n.phase);
    const rBase = n.r * cam.zoom; const bloom = (isHov || isSel) ? 1.5 : 1; const alpha = dim ? 0.28 : 1;

    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = alpha;
    const glowR = rBase * (isHov || isSel ? 7 : 4.5) * tw;
    const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
    gl.addColorStop(0, hexA(col, 0.55 * bloom)); gl.addColorStop(0.4, hexA(col, 0.14)); gl.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fbfdff"; ctx.shadowColor = col; ctx.shadowBlur = 14 * bloom;
    ctx.beginPath(); ctx.arc(p.x, p.y, rBase * bloom * tw, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = hexA(col, 0.9);
    ctx.beginPath(); ctx.arc(p.x, p.y, rBase * bloom * tw * 0.62, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    if ((n.r > 8 || isHov || isSel) && !dim) {
      const spike = rBase * bloom * (isHov || isSel ? 4.2 : 2.6) * tw;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = hexA(col, isHov || isSel ? 0.7 : 0.35); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x - spike, p.y); ctx.lineTo(p.x + spike, p.y);
      ctx.moveTo(p.x, p.y - spike); ctx.lineTo(p.x, p.y + spike); ctx.stroke(); ctx.restore();
    }
  }

  // galaxy labels
  ctx.save(); ctx.textAlign = "center";
  const mono = getComputedStyle(document.body).getPropertyValue("--mono");
  for (const g of galaxies) {
    const gi = galInfo[g]; if (!gi) continue;
    const c = w2s(gi.cx, gi.cy - gi.r * 0.92);
    ctx.font = "600 " + Math.max(10, 12 * Math.min(cam.zoom * 1.5, 1.4)) + "px " + mono;
    ctx.fillStyle = `hsla(${gi.hue},60%,78%,${hovered ? 0.28 : 0.5})`;
    const label = g.toUpperCase(); const ls = 4; let total = 0;
    for (const ch of label) total += ctx.measureText(ch).width + ls;
    let x = c.x - total / 2;
    for (const ch of label) { const w = ctx.measureText(ch).width; ctx.fillText(ch, x + w / 2, c.y); x += w + ls; }
  }
  ctx.restore();

  requestAnimationFrame(draw);
}

/* -------------------------------------------------------- interaction ---- */
function pickNode(mx, my) {
  let best = null, bestD = 1e9;
  for (const n of nodes) {
    const p = w2s(n.x, n.y); const rr = Math.max(n.r * cam.zoom + 8, 12);
    const d = Math.hypot(p.x - mx, p.y - my);
    if (d < rr && d < bestD) { bestD = d; best = n; }
  }
  return best;
}
let dragging = false, moved = false, last = null;
canvas.addEventListener("mousedown", e => { dragging = true; moved = false; last = { x: e.clientX, y: e.clientY }; canvas.classList.add("dragging"); });
window.addEventListener("mouseup", () => { dragging = false; canvas.classList.remove("dragging"); });
window.addEventListener("mousemove", e => {
  if (dragging) {
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    cam.x -= dx / cam.zoom; cam.y -= dy / cam.zoom; last = { x: e.clientX, y: e.clientY };
  } else { const h = pickNode(e.clientX, e.clientY); hovered = h; canvas.style.cursor = h ? "pointer" : "grab"; }
});
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const before = s2w(e.clientX, e.clientY);
  cam.zoom = Math.max(0.2, Math.min(3.2, cam.zoom * Math.exp(-e.deltaY * 0.0012)));
  const after = s2w(e.clientX, e.clientY);
  cam.x += before.x - after.x; cam.y += before.y - after.y;
}, { passive: false });
canvas.addEventListener("click", e => { if (moved) return; const n = pickNode(e.clientX, e.clientY); if (n) openPanel(n.id); else closePanel(); });

/* -------------------------------------------------------------- panel ---- */
const panel = document.getElementById("panel");
async function openPanel(id) {
  const s = nodeData[id]; if (!s) return;
  selected = nodeById[id];
  const t = typeInfo(s.type);
  document.getElementById("panelId").textContent = s.id;
  document.getElementById("panelTitle").textContent = s.title || s.id;
  document.getElementById("panelChips").innerHTML =
    `<span class="chip"><span class="dot" style="background:${t.color}"></span>${t.label}</span>` +
    `<span class="chip galaxy">galáxia ${s.constellation || "geral"}</span>`;
  const tagsEl = document.getElementById("panelTags");
  tagsEl.textContent = (s.tags && s.tags.length) ? "# " + s.tags.join("  # ") : "";

  const body = document.getElementById("panelBody");
  body.innerHTML = '<p style="color:var(--dim)">carregando…</p>';
  panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
  let html = "";
  try { const r = await fetch("/star/" + encodeURIComponent(id)); html = r.ok ? await r.text() : ""; }
  catch (e) { html = ""; }
  // torna [[wikilinks]] clicáveis
  html = html.replace(/\[\[([a-z0-9][a-z0-9-]*)\]\]/g, (m, wid) => nodeData[wid] ? `<span class="wl" data-go="${wid}">${wid}</span>` : m);
  body.innerHTML = html || "<p style=\"color:var(--dim)\">(sem conteúdo)</p>";

  const near = edges.filter(e => e.a === id || e.b === id).map(e => e.a === id ? e.b : e.a);
  const linksEl = document.getElementById("panelLinks");
  if (near.length) {
    linksEl.style.display = "";
    linksEl.innerHTML = '<div class="lbl">Conexões</div>' + near.map(nid => {
      const ns = nodeData[nid], nt = typeInfo(ns.type);
      return `<div class="link-star" data-go="${nid}"><span class="dot" style="background:${nt.color}"></span><span class="t">${ns.title || nid}</span><span class="g">${ns.constellation || ""}</span></div>`;
    }).join("");
  } else { linksEl.style.display = "none"; }
}
function closePanel() { panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true"); selected = null; }
document.getElementById("panelClose").addEventListener("click", closePanel);
document.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });
panel.addEventListener("click", e => { const go = e.target.closest("[data-go]"); if (go) openPanel(go.getAttribute("data-go")); });

init();
