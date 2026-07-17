const TYPE_COLOR = {
  'code-map': '#4fa3ff',
  'decision': '#ffb454',
  'gotcha':   '#ff5c7a',
  'doc':      '#5cd6a8',
};

async function main() {
  const graph = await (await fetch('/data')).json();
  document.title = `Constellation — ${graph.project}`;

  const elements = [
    ...graph.nodes.map((n) => ({
      data: { id: n.id, label: n.title, type: n.type, constellation: n.constellation },
    })),
    ...graph.edges.map((e) => ({ data: { source: e.source, target: e.target } })),
  ];

  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements,
    style: [
      { selector: 'node', style: {
        'background-color': (el) => TYPE_COLOR[el.data('type')] || '#889',
        'label': 'data(label)', 'color': '#e8ecf5', 'font-size': 10,
        'text-valign': 'bottom', 'text-margin-y': 4,
      } },
      { selector: 'edge', style: {
        'width': 1, 'line-color': '#33415c', 'curve-style': 'bezier',
        'target-arrow-color': '#33415c', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.7,
      } },
    ],
    layout: { name: 'cose', animate: false, padding: 40 },
  });

  const panel = document.getElementById('panel');
  cy.on('tap', 'node', async (evt) => {
    const id = evt.target.id();
    panel.innerHTML = `<p class="hint">${id}</p>` + await (await fetch(`/star/${encodeURIComponent(id)}`)).text();
  });
}

main();
