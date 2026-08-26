
import { readFileSync, writeFileSync } from "fs";

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  description?: string;
};

type RawTool = Record<string, any>;

type Field = { name: string; path: string };

type Tool = {
  id: string;
  name: string;
  description: string;
  service: string;
  requiredInputs: Field[];
  allInputs: Field[];
  outputFields: Field[];
  domain: string;
};
interface Node {
  id: string;
  service?: string;
}
interface Edge {
  from: string;
  to: string;
  label?: string;
}
interface Graph {
  nodes: Node[];
  edges: Edge[];
}


const CATALOG_PATH = process.argv.length > 2 ? process.argv[process.argv.length - 1] : undefined;
const OUT_PATH = "dependency_graph.json";

/*
  Upstream functions reading RAW json files : loadCatalog(), 
  slugOf(), descriptionOf(), inputSchemaOf(), outputSchemaOf(), buildTool(),
  inferDomain(), inferService()
*/
function loadCatalog(): RawTool[] {
  if (!CATALOG_PATH) {
    throw new Error("pass the toolkit catalog path as the first argument");
  }
  const data = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
  return Array.isArray(data) ? data : (data.tools ?? data.items ?? []);
}

function slugOf(tool: RawTool): string | undefined {
  return tool.slug ?? tool.name ?? tool.function?.name;
}

function descriptionOf(tool: RawTool): string {
  return tool.description ?? tool.function?.description ?? "";
}

function inputSchemaOf(tool: RawTool): JsonSchema | undefined {
  return (
    tool.input_parameters ??
    tool.inputParameters ??
    tool.parameters ??
    tool.function?.parameters ??
    tool.function?.input_parameters
  );
}

function outputSchemaOf(tool: RawTool): JsonSchema | undefined {
  return (
    tool.output_parameters ??
    tool.outputParameters ??
    tool.response ??
    tool.response_schema ??
    tool.output_schema ??
    tool.function?.response
  );
}
function flattenSchemaFields(schema: JsonSchema | undefined, depth = 0): Field[] {
  if (!schema || depth > 4) return [];
  const out: Field[] = [];
  const seen = new Set<string>();
  const visit = (s: JsonSchema | undefined, prefix: string, d: number) => {
    if (!s || d > 4) return;
    if (s.properties) {
      for (const [key, sub] of Object.entries(s.properties)) {
        const p = prefix ? `${prefix}.${key}` : key;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ name: key, path: p });
        }
        visit(sub, p, d + 1);
      }
    }
    if (s.items) visit(s.items, prefix, d + 1);
  };
  visit(schema, "", depth);
  return out;
}

function requiredFields(schema: JsonSchema | undefined): Field[] {
  if (!schema || !schema.properties) return [];
  const required = new Set(schema.required || []);
  return Object.keys(schema.properties)
    .filter((k) => required.has(k))
    .map((k) => ({ name: k, path: k }));
}

function allInputFields(schema: JsonSchema | undefined): Field[] {
  if (!schema || !schema.properties) return [];
  return Object.keys(schema.properties).map((k) => ({ name: k, path: k }));
}

const DOMAIN_KEYWORDS: Array<[string, string[]]> = [
  ["pull_review_comment", ["review comment for a pull request", "review_comment_for_a_pull_request", "pull_request_review_comment"]],
  ["pull_review", ["review for a pull request", "review_for_a_pull_request", "pull_request_review", "reviews for a pull request"]],
  ["pull", ["pull request", "pull_request", "pull requests"]],
  ["issue_comment", ["issue comment", "issue_comment"]],
  ["issue_type", ["issue type", "issue_type"]],
  ["issue_event", ["issue event", "issue_event"]],
  ["issue", ["issue"]],
  ["commit_comment", ["commit comment", "commit_comment"]],
  ["commit", ["commit"]],
  ["branch", ["branch"]],
  ["ref", ["reference", " ref ", "_reference"]],
  ["label", ["label"]],
  ["milestone", ["milestone"]],
  ["release_asset", ["release asset", "release_asset"]],
  ["release", ["release"]],
  ["workflow_run", ["workflow run", "workflow_run"]],
  ["job", [" job", "_job"]],
  ["gist_comment", ["gist comment", "gist_comment"]],
  ["gist", ["gist"]],
  ["team", ["team"]],
  ["webhook", ["webhook"]],
  ["repo", ["repository", "repo"]],
  ["org", ["organization", " org "]],
  ["user", ["user"]],
];

function inferDomain(tool: RawTool): string {
  const hay = ` ${slugOf(tool) || ""} ${tool.name || ""} `
    .toLowerCase()
    .replace(/_/g, " ");
  for (const [domain, keywords] of DOMAIN_KEYWORDS) {
    for (const kw of keywords) {
      if (hay.includes(kw.replace(/_/g, " "))) return domain;
    }
  }
  return "misc";
}

function inferService(tool: RawTool, domain: string): string {
  if (tool.service) return tool.service;
  return domain;
}

type DomainRule = {
  producerField: string;
  consumerParams: string[];
  sameDomainOnly?: boolean;
};

const DOMAIN_RULES: Record<string, DomainRule[]> = {
  issue: [{ producerField: "number", consumerParams: ["issue_number"] }],
  pull: [{ producerField: "number", consumerParams: ["pull_number", "pull_request_number"] }],
  milestone: [{ producerField: "number", consumerParams: ["milestone_number", "milestone"] }],
  issue_comment: [{ producerField: "id", consumerParams: ["comment_id"], sameDomainOnly: true }],
  commit_comment: [{ producerField: "id", consumerParams: ["comment_id"], sameDomainOnly: true }],
  pull_review_comment: [{ producerField: "id", consumerParams: ["comment_id"], sameDomainOnly: true }],
  gist_comment: [{ producerField: "id", consumerParams: ["comment_id"], sameDomainOnly: true }],
  pull_review: [{ producerField: "id", consumerParams: ["review_id"] }],
  release: [{ producerField: "id", consumerParams: ["release_id"] }],
  release_asset: [{ producerField: "id", consumerParams: ["asset_id"] }],
  workflow_run: [{ producerField: "id", consumerParams: ["run_id", "workflow_run_id"] }],
  job: [{ producerField: "id", consumerParams: ["job_id"] }],
  gist: [{ producerField: "id", consumerParams: ["gist_id"] }],
  team: [{ producerField: "slug", consumerParams: ["team_slug"] }],
  label: [{ producerField: "name", consumerParams: ["name"], sameDomainOnly: true }],
  branch: [
    { producerField: "name", consumerParams: ["branch", "base", "head"] },
  ],
  commit: [
    { producerField: "sha", consumerParams: ["sha", "commit_sha", "commit_id", "ref", "base", "head", "basehead"] },
  ],
  ref: [{ producerField: "object.sha", consumerParams: ["sha"] }],
};


const GENERIC_PASSTHROUGH_FIELDS = new Set(["sha", "ref", "path", "filename", "tag_name"]);

function buildTool(raw: RawTool): Tool | null {
  const id = slugOf(raw);
  if (!id) return null;
  const inputSchema = inputSchemaOf(raw);
  const outputSchema = outputSchemaOf(raw);
  const domain = inferDomain(raw);
  return {
    id,
    name: raw.name || id,
    description: descriptionOf(raw),
    service: inferService(raw, domain),
    requiredInputs: requiredFields(inputSchema),
    allInputs: allInputFields(inputSchema),
    outputFields: flattenSchemaFields(outputSchema),
    domain,
  };
}

function discoverEdges(tools: Tool[]): Edge[] {
  const edgeKey = (e: Edge) => `${e.from}=>${e.to}:${e.label}`;
  const edges = new Map<string, Edge>();

  const byDomainField = new Map<string, Map<string, Set<string>>>();
  for (const t of tools) {
    const fieldNames = new Set(t.outputFields.map((f) => f.name));
    const fieldPaths = new Set(t.outputFields.map((f) => f.path));
    let byField = byDomainField.get(t.domain);
    if (!byField) {
      byField = new Map();
      byDomainField.set(t.domain, byField);
    }
    for (const f of fieldNames) {
      if (!byField.has(f)) byField.set(f, new Set());
      byField.get(f)!.add(t.id);
    }
    for (const f of fieldPaths) {
      if (!byField.has(f)) byField.set(f, new Set());
      byField.get(f)!.add(t.id);
    }
  }
  const byFieldAnyDomain = new Map<string, Set<string>>();
  for (const t of tools) {
    for (const f of t.outputFields) {
      if (!GENERIC_PASSTHROUGH_FIELDS.has(f.name)) continue;
      if (!byFieldAnyDomain.has(f.name)) byFieldAnyDomain.set(f.name, new Set());
      byFieldAnyDomain.get(f.name)!.add(t.id);
    }
  }

  const requiredParamNamesByTool = new Map(tools.map((t) => [t.id, new Set(t.requiredInputs.map((f) => f.name))]));

  const DISCOVERY_VERB_RE = /(^|_)(LIST|SEARCH|FIND|QUERY|FETCH|GET_ALL|GET_MANY|CREATE)(_|$)/i;
  const byDomain = new Map<string, string[]>();
  for (const t of tools) {
    if (!byDomain.has(t.domain)) byDomain.set(t.domain, []);
    byDomain.get(t.domain)!.push(t.id);
  }

  for (const consumer of tools) {
    for (const input of consumer.requiredInputs) {
      let matchedThisParam = false;

      for (const [domain, rules] of Object.entries(DOMAIN_RULES)) {
        for (const rule of rules) {
          if (!rule.consumerParams.includes(input.name)) continue;
          if (rule.sameDomainOnly && domain !== consumer.domain) continue;
          const producers = byDomainField.get(domain)?.get(rule.producerField);
          if (producers) {
            for (const producerId of producers) {
              if (producerId === consumer.id) continue;
              if (requiredParamNamesByTool.get(producerId)?.has(input.name)) continue;
              const e = { from: producerId, to: consumer.id, label: input.name };
              edges.set(edgeKey(e), e);
              matchedThisParam = true;
            }
          }
        
          if (!producers || producers.size === 0) {
            for (const producerId of byDomain.get(domain) ?? []) {
              if (producerId === consumer.id) continue;
              if (requiredParamNamesByTool.get(producerId)?.has(input.name)) continue;
              const producer = tools.find((t) => t.id === producerId)!;
              if (!DISCOVERY_VERB_RE.test(producer.id)) continue;
              const e = { from: producerId, to: consumer.id, label: input.name };
              edges.set(edgeKey(e), e);
              matchedThisParam = true;
            }
          }
        }
      }

      if (!matchedThisParam && GENERIC_PASSTHROUGH_FIELDS.has(input.name)) {
        const producers = byFieldAnyDomain.get(input.name);
        if (producers) {
          for (const producerId of producers) {
            if (producerId === consumer.id) continue;
            if (requiredParamNamesByTool.get(producerId)?.has(input.name)) continue;
            const e = { from: producerId, to: consumer.id, label: input.name };
            edges.set(edgeKey(e), e);
            matchedThisParam = true;
          }
        }
      }
      if (!matchedThisParam) {
        const m = input.name.match(/^([a-z][a-z0-9]*)_(id|number|slug)$/i);
        if (m) {
          const resourceWord = m[1].toLowerCase();
          const suffix = m[2].toLowerCase();
          const baseEligible = tools.filter(
            (producer) =>
              producer.id !== consumer.id && !requiredParamNamesByTool.get(producer.id)?.has(input.name)
          );
          const withMatchingField = baseEligible.filter((p) => p.outputFields.some((f) => f.name === suffix));
          const nameMatches = (p: Tool) => {
            const hay = `${p.id} ${p.name}`.toLowerCase().replace(/_/g, " ");
            return new RegExp(`\\b${resourceWord}s?\\b`).test(hay);
          };
          let pool = withMatchingField.filter((p) => p.domain === resourceWord);
          if (pool.length === 0) pool = withMatchingField.filter(nameMatches);
          if (pool.length === 0) {
            pool = baseEligible.filter((p) => p.domain === resourceWord && DISCOVERY_VERB_RE.test(p.id));
            if (pool.length === 0) pool = baseEligible.filter((p) => nameMatches(p) && DISCOVERY_VERB_RE.test(p.id));
          }
          for (const producer of pool) {
            const e = { from: producer.id, to: consumer.id, label: input.name };
            edges.set(edgeKey(e), e);
          }
        }
      }
    }
  }

  return Array.from(edges.values());
}

async function refineWithLLM(tools: Tool[], edges: Edge[]): Promise<Edge[]> {
  const baseURL = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.TOOLGRAPH_LLM_MODEL || "openai/gpt-4o";
  if (!baseURL || !apiKey) {
    console.error("[llm] OPENAI_BASE_URL/OPENAI_API_KEY not set — skipping LLM refinement.");
    return edges;
  }

  const resolvedParams = new Set(edges.map((e) => `${e.to}:${e.label}`));
  const unresolved = tools.flatMap((t) =>
    t.requiredInputs
      .filter((f) => !resolvedParams.has(`${t.id}:${f.name}`) && !["owner", "repo", "org"].includes(f.name))
      .map((f) => ({ tool: t.id, param: f.name }))
  );
  if (unresolved.length === 0) return edges;

  const catalogSummary = tools.map((t) => ({
    id: t.id,
    domain: t.domain,
    outputs: t.outputFields.map((f) => f.name),
  }));

  const prompt = `You are helping build a tool dependency graph for an agent that calls REST-style tools.
Given this catalog summary (id, inferred domain, output field names):
${JSON.stringify(catalogSummary)}

And this list of {tool, param} pairs where "param" is a REQUIRED input the tool needs but no producer was
found automatically, propose which existing tool id (if any) most plausibly produces a value for that param.
Only propose a producer if you are confident based on the field names/domains above; omit uncertain pairs.
Return ONLY a JSON array like [{"from": "<producer tool id>", "to": "<tool>", "label": "<param>"}], nothing else.

Pairs to resolve:
${JSON.stringify(unresolved)}`;

  try {
    const res = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error(`[llm] request failed: ${res.status} ${await res.text()}`);
      return edges;
    }
    const data: any = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? "";
    const clean = text.replace(/```json|```/g, "").trim();
    const proposed: Edge[] = JSON.parse(clean);
    const known = new Set(tools.map((t) => t.id));
    // Same guard discoverEdges() applies to heuristic edges: a tool that itself
    // requires param X can't be the source of X for someone else (they still need
    // it supplied first). The LLM only sees each candidate's OUTPUT fields, never
    // its own required inputs, so it can't apply this rule itself — e.g. it will
    // happily propose GET_A_USER (which requires `username` as input) as a producer
    // of `username`, which is backwards. Enforce it here before merging.
    const requiredParamNamesByTool = new Map(tools.map((t) => [t.id, new Set(t.requiredInputs.map((f) => f.name))]));
    const merged = new Map(edges.map((e) => [`${e.from}=>${e.to}:${e.label}`, e]));
    let rejectedSelfReq = 0;
    for (const e of proposed) {
      if (!e.from || !e.to || !e.label || !known.has(e.from) || !known.has(e.to) || e.from === e.to) continue;
      if (requiredParamNamesByTool.get(e.from)?.has(e.label)) {
        rejectedSelfReq++;
        continue;
      }
      merged.set(`${e.from}=>${e.to}:${e.label}`, e);
    }
    if (rejectedSelfReq > 0) {
      console.error(`[llm] rejected ${rejectedSelfReq} proposed edge(s) where the producer itself requires the param.`);
    }
    console.error(`[llm] added ${merged.size - edges.length} candidate edge(s).`);
    return Array.from(merged.values());
  } catch (err) {
    console.error("[llm] refinement skipped due to error:", (err as Error).message);
    return edges;
  }
}


async function generate(rawTools: RawTool[]): Promise<Graph> {
  const tools = rawTools.map(buildTool).filter((t): t is Tool => t !== null);

  let edges = discoverEdges(tools);
  edges = await refineWithLLM(tools, edges); 

  const nodes: Node[] = tools.map((t) => ({ id: t.id, service: t.service }));
  edges.sort((a, b) => (a.from + a.to + (a.label ?? "")).localeCompare(b.from + b.to + (b.label ?? "")));
  return { nodes, edges };
}
async function main() {
  const graph = await generate(loadCatalog());
  writeFileSync(OUT_PATH, JSON.stringify(graph, null, 2), "utf-8");
  console.error(
    `wrote ${graph.nodes.length} nodes, ${graph.edges.length} edges to ${OUT_PATH}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
