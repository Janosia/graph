// Renders dependency_graph.json into a standalone, offline-capable HTML visualization
// (vis-network from CDN, with the graph data embedded inline so no fetch/CORS issues
// when opened directly as a file). Run: node scripts/build_visualization.js [graph.json] [out.html]
const fs = require("fs");
const path = require("path");

const graphPath = process.argv[2] || path.join(__dirname, "..", "dependency_graph.json");
const outPath = process.argv[3] || path.join(__dirname, "..", "dependency_graph.html");

const graph = JSON.parse(fs.readFileSync(graphPath, "utf-8"));

const services = [...new Set(graph.nodes.map((n) => n.service))].sort();
const palette = [
  "#4f8cff", "#ff6b6b", "#51cf66", "#f7b731", "#a29bfe", "#20bf6b",
  "#eb3b5a", "#0fb9b1", "#fd9644", "#3867d6", "#8854d0", "#26de81",
  "#fc5c65", "#45aaf2", "#2bcbba", "#fed330", "#778ca3", "#a55eea",
  "#4b6584", "#d1d8e0", "#eb2f06", "#22a6b3", "#6ab04c", "#f0932b",
  "#badc58", "#e056fd",
];
const colorOf = Object.fromEntries(services.map((s, i) => [s, palette[i % palette.length]]));

const nodes = graph.nodes.map((n) => ({
  id: n.id,
  label: n.id.replace(/^GITHUB_/, "").replace(/_/g, " "),
  title: `${n.id}\nservice: ${n.service}`,
  group: n.service,
  color: colorOf[n.service],
}));

const edges = graph.edges.map((e) => ({
  from: e.from,
  to: e.to,
  label: e.label,
  arrows: "to",
  font: { align: "middle", size: 10, color: "#666" },
  color: { color: "#aab", opacity: 0.55 },
}));

const legend = services.map((s) => `<span class="legend-item"><span class="dot" style="background:${colorOf[s]}"></span>${s}</span>`).join("");

const visLib = fs.readFileSync(path.join(__dirname, "..", "assets", "vis-network.min.js"), "utf-8");

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Tool Dependency Graph</title>
<script>${visLib}</script><style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f7f8fb; }
  header { padding: 14px 20px; background: #fff; border-bottom: 1px solid #e3e6ee; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  h1 { font-size: 16px; margin: 0; color: #222; }
  .stats { font-size: 13px; color: #666; }
  .legend { padding: 8px 20px; background: #fff; border-bottom: 1px solid #e3e6ee; font-size: 12px; display: flex; flex-wrap: wrap; gap: 12px; }
  .legend-item { display: inline-flex; align-items: center; gap: 5px; color: #444; }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  #network { width: 100vw; height: calc(100vh - 96px); }
  #search { padding: 5px 8px; border: 1px solid #ccd; border-radius: 6px; font-size: 13px; }
</style>
</head>
<body>
<header>
  <h1>Tool Dependency Graph &mdash; ${graph.nodes.length} tools, ${graph.edges.length} edges</h1>
  <input id="search" type="text" placeholder="Filter by tool id..." />
</header>
<div class="legend">${legend}</div>
<div id="network"></div>
<script>
  const nodesData = new vis.DataSet(${JSON.stringify(nodes)});
  const edgesData = new vis.DataSet(${JSON.stringify(edges)});
  const container = document.getElementById("network");
  const data = { nodes: nodesData, edges: edgesData };
  const options = {
    nodes: { shape: "dot", size: 10, font: { size: 11, color: "#222" }, borderWidth: 1 },
    edges: { smooth: { type: "dynamic" } },
    physics: {stabilization: { iterations: 150, fit: true },
        barnesHut: { gravitationalConstant: -4000, springLength: 100, springConstant: 0.02, avoidOverlap: 0.1 },
        maxVelocity: 40,
        timestep: 0.5, 
    },
    interaction: { hover: true, tooltipDelay: 100 },
    groups: {}
  };
const network = new vis.Network(container, data, options);
        network.once("stabilizationIterationsDone", () => {
        network.setOptions({ physics: false });
});
  document.getElementById("search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toUpperCase();
    if (!q) { nodesData.forEach(n => nodesData.update({ id: n.id, hidden: false })); return; }
    nodesData.forEach(n => nodesData.update({ id: n.id, hidden: !n.id.toUpperCase().includes(q) }));
  });
</script>
</body>
</html>
`;

fs.writeFileSync(outPath, html);
console.log(`Wrote visualization -> ${outPath}`);
