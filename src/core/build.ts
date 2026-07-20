import fs from 'node:fs';
import { indexPath, graphPath } from './paths';
import { resolvedLinks } from './star';
import { readAllStars, readConfig } from './store';
import type { Star, ConstellationGraph, GraphEdge } from './types';

export function buildIndexMarkdown(project: string, stars: Star[]): string {
  const byCluster = new Map<string, Star[]>();
  for (const s of stars) {
    const arr = byCluster.get(s.constellation) ?? [];
    arr.push(s);
    byCluster.set(s.constellation, arr);
  }
  const lines: string[] = [`# Constellation — ${project}`, ''];
  for (const cluster of [...byCluster.keys()].sort()) {
    lines.push(`## ${cluster}`, '');
    for (const s of byCluster.get(cluster)!) {
      lines.push(`- [${s.id}] (${s.type}) ${s.summary}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function buildGraph(project: string, stars: Star[]): ConstellationGraph {
  const ids = new Set(stars.map((s) => s.id));
  const edges: GraphEdge[] = [];
  for (const s of stars) {
    for (const target of resolvedLinks(s)) {
      if (ids.has(target)) edges.push({ source: s.id, target });
    }
  }
  return {
    project,
    nodes: stars.map((s) => ({
      id: s.id, type: s.type, constellation: s.constellation,
      title: s.title, summary: s.summary, tags: s.tags,
      files: s.files, refs: s.refs,
    })),
    edges,
  };
}

export function sync(root: string): void {
  const project = readConfig(root).project;
  const stars = readAllStars(root);
  fs.writeFileSync(indexPath(root), buildIndexMarkdown(project, stars));
  fs.writeFileSync(graphPath(root), JSON.stringify(buildGraph(project, stars), null, 2) + '\n');
}
