export type StarType = 'code-map' | 'decision' | 'gotcha' | 'doc';

export interface Star {
  id: string;
  type: StarType;
  constellation: string;
  title: string;
  summary: string;
  tags: string[];
  links: string[];
  updated: string;
  body: string;
}

export interface GraphNode {
  id: string;
  type: StarType;
  constellation: string;
  title: string;
  summary: string;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface ConstellationGraph {
  project: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Config {
  project: string;
  schema: number;
}
