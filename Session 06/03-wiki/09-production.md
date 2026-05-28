# 09 — Production Engineering for Advanced Prompts

**Overview:** Multi-call techniques — ToT, ReAct, Self-Refine, prompt chains — turn one HTTP call into 5–50 LLM invocations with branching, retries, tool calls, and per-step state. A single `mlflow.start_run` is no longer enough to debug, cost, or evaluate them. This section is the operations layer for everything in Sessions 5 and 6: observability via the MLflow 3.10+ tracing and GenAI APIs, caching and error-propagation strategies tuned to each technique, the most dangerous misconception in the field (self-correction without a verifier), and the practitioner heuristics that decide when to stop adding technique and start cutting cost.

**Cross-references:**
- Tree-of-Thoughts search internals — [02-tree-of-thoughts.md](02-tree-of-thoughts.md)
- Chain orchestration, validators, fail-soft — [03-prompt-chaining.md](03-prompt-chaining.md)
- ReAct loop, stopping conditions, cycle detection — [05-react.md](05-react.md)
- Decision rules for picking a technique — [07-decision-framework.md](07-decision-framework.md)
- Reasoning models (o1, Claude Extended Thinking, Gemini thinking) — [08-reasoning-models.md](08-reasoning-models.md)

**Extends:**
- Session 5 §5 production (see [../../Session 05 - Core Prompt Engineering Techniques/03-wiki/07-production.md](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/07-production.md)) — prompt versioning, semantic versioning, golden test set, injection defenses, model pinning, caching basics
- Session 4 MLflow — you already use `@mlflow.trace`, `mlflow.start_span`, `mlflow.genai.evaluate`, the Prompt Registry, and `mlflow.search_traces` on single-call bots. This file shows why the same primitives upgrade cleanly to 5–50 call pipelines.

---

## 1. MLflow 3.10+ Tracing & GenAI — the upgrade from Session 4

### Why `start_run` alone is insufficient for advanced techniques

In Session 4 you wrapped a single LLM call in `@mlflow.trace`, registered the prompt with `mlflow.genai.register_prompt`, and evaluated outputs via `mlflow.genai.evaluate`. That works for one-shot prompting and a Pydantic-AI agent with 4 tools.

It does not scale to the techniques in Session 6 unless you add structure:

| Technique | Calls per request | What a flat trace loses |
|-----------|------------------|------------------------------|
| Prompt chain (5 steps) | 5 | Which step failed; per-step latency; cumulative cost |
| Self-Refine (3 rounds) | 7 (gen + 3×(critique+refine)) | Per-round quality trajectory; stop reason |
| ReAct (8 turns) | 8 LLM + 8 tool | Tool call args; observations; cycle detection |
| ToT (beam=3, depth=4) | up to 36 | Tree shape; pruned branches; value-function scores |
| Technique comparison | 4 × 100 eval items | Per-technique cost; latency p50; accuracy delta |

You need **nested spans, trace-level tags, and per-step metrics** — all already present in MLflow 3.10's GenAI surface.

### Core MLflow 3.10+ primitives used in this section

| Primitive | Purpose |
|-----------|---------|
| `@mlflow.trace(name=..., span_type=..., attributes=...)` | Decorator turning any function into a span. v3 best practice: always pass `name=` and `attributes=`. |
| `mlflow.start_span(name=..., span_type=...)` | Context manager for sub-spans (one per ReAct turn, ToT expansion, tool call). |
| `mlflow.update_current_trace(tags={...})` | Annotate the active trace with searchable string tags (stop reason, cost, prompt version). |
| `span.set_inputs(...)`, `span.set_outputs(...)`, `span.set_attribute(k, v)` | Per-span structured data — shows in the UI side panel. |
| `mlflow.get_current_active_span()` | Guard before calling `update_current_trace` inside an eval `predict_fn`. |
| `mlflow.openai.autolog()` / `mlflow.anthropic.autolog()` / `mlflow.langchain.autolog()` | One-line provider auto-tracing — captures messages, tokens, latency. |
| `mlflow.genai.evaluate(data=..., predict_fn=..., scorers=[...])` | The eval entry point for chains, agents, RAG. |
| `mlflow.genai.scorers.{Correctness, Guidelines, RelevanceToQuery, Safety, Completeness}` | Built-in LLM judges. |
| `mlflow.genai.scorers.scorer` | Decorator for custom scorers (boolean or float). |
| `mlflow.genai.register_prompt(name=..., template=..., commit_message=..., tags=...)` | Versioned prompt registry — same API for single prompts and chain-step prompts. |
| `mlflow.genai.load_prompt("prompts:/<name>/<version>")` | Load a registered prompt by version (or alias). |
| `mlflow.search_traces(...)` / `mlflow.search_runs(...)` | Programmatic queries for dashboards, regression alerts, audit. |

`SpanType` enum (`from mlflow.entities import SpanType`) used by the UI to colour and group nodes:

| `SpanType` | Use for |
|-----------|---------|
| `CHAIN` | Orchestration nodes — pipeline root, ReAct turn, ToT expansion |
| `LLM` | A single model API call (input messages, output, usage) |
| `TOOL` | Tool execution inside ReAct, function-calling, retrieval |
| `AGENT` | Top-level agent loop (one per request) |
| `RETRIEVER` | Retrieval step in a RAG chain |

### One-line provider auto-tracing

```python
import mlflow
mlflow.set_tracking_uri("http://127.0.0.1:5000")
mlflow.openai.autolog()        # all openai.*.create calls auto-traced
mlflow.anthropic.autolog()     # all anthropic.messages.create calls auto-traced
mlflow.langchain.autolog()     # all LangChain runs auto-traced
```

Call these once at process start. Combined with `@mlflow.trace` on your own functions, you get the full tree (chain → LLM → tool → LLM) with zero boilerplate.

---

## 2. Pattern 1 — Chain tracing (one trace, nested spans)

Wrap each chain step in `@mlflow.trace` with an explicit `name=` and `span_type=`; pass version metadata as `attributes`. The MLflow UI shows a waterfall where each step's latency, tokens, and cost are visible.

```python
import json, os, time
import mlflow
from mlflow.entities import SpanType
from openai import OpenAI

mlflow.set_tracking_uri("http://127.0.0.1:5000")
mlflow.set_experiment("session6/chain_tracing")
mlflow.openai.autolog()                              # auto-traces every LLM call

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
MODEL  = "gpt-4o"

EXTRACT_PROMPT = (
    "You are a triage assistant. Extract a JSON object with keys "
    "`severity` (low|medium|high|critical), `component`, `stack_trace_present` (bool), "
    "`reproduction_steps` (list[str]). Return ONLY valid JSON.\n\nBug report:\n{report}"
)

CLASSIFY_PROMPT = (
    "Given this extracted signal, return the owning team as one of "
    "[`backend`, `frontend`, `infra`, `data`, `mobile`]. Return JSON: "
    '{{"team": "<team>", "confidence": <0-1>}}.\n\nSignal:\n{signal}'
)

DUPES_PROMPT = (
    "Given this bug signal, generate 3 short search queries that would find "
    "duplicate tickets in Jira. Return JSON: {{\"queries\": [\"...\"]}}.\n\nSignal:\n{signal}"
)

DRAFT_PROMPT = (
    "Draft a 3-sentence acknowledgement to the reporter. State the owning team, "
    "severity, and whether duplicates were found. Tone: neutral, factual.\n\n"
    "Signal: {signal}\nTeam: {team}\nDuplicates: {dupes}"
)


@mlflow.trace(
    name="bug_triage_pipeline",
    span_type=SpanType.CHAIN,
    attributes={"prompt_version": "v3.2", "model": MODEL},
)
def triage(report: str) -> dict:
    mlflow.update_current_trace(tags={"pipeline": "bug_triage", "model": MODEL})
    signal    = extract_signal(report)
    routing   = classify_component(signal)
    dupes     = find_duplicates(signal)
    response  = draft_response(signal, routing, dupes)
    return {"signal": signal, "routing": routing, "dupes": dupes, "response": response}


@mlflow.trace(name="extract_signal", span_type=SpanType.LLM,
              attributes={"step": "1_extract"})
def extract_signal(text: str) -> dict:
    resp = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": EXTRACT_PROMPT.format(report=text)}],
        temperature=0,
    )
    return json.loads(resp.choices[0].message.content)


@mlflow.trace(name="classify_component", span_type=SpanType.LLM,
              attributes={"step": "2_classify"})
def classify_component(signal: dict) -> dict:
    resp = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[{"role": "user",
                   "content": CLASSIFY_PROMPT.format(signal=json.dumps(signal))}],
        temperature=0,
    )
    return json.loads(resp.choices[0].message.content)


@mlflow.trace(name="find_duplicates", span_type=SpanType.RETRIEVER,
              attributes={"step": "3_dedupe"})
def find_duplicates(signal: dict) -> list[str]:
    resp = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[{"role": "user",
                   "content": DUPES_PROMPT.format(signal=json.dumps(signal))}],
        temperature=0,
    )
    queries = json.loads(resp.choices[0].message.content)["queries"]
    # In production: jira_client.search(jql=...). Here: stub that returns IDs.
    hits = [f"BUG-{abs(hash(q)) % 10000}" for q in queries]
    span = mlflow.get_current_active_span()
    if span is not None:
        span.set_attribute("dedupe.queries", queries)
        span.set_attribute("dedupe.hits", hits)
    return hits


@mlflow.trace(name="draft_response", span_type=SpanType.LLM,
              attributes={"step": "4_draft"})
def draft_response(signal: dict, routing: dict, dupes: list[str]) -> str:
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": DRAFT_PROMPT.format(
            signal=json.dumps(signal), team=routing["team"], dupes=dupes)}],
        temperature=0.2,
    )
    return resp.choices[0].message.content


report = (
    "App crashes on startup after upgrading to v4.7 on Android 14. "
    "Stack: NullPointerException in AuthInterceptor.intercept(). "
    "Repro: open app cold-start, sign in, crash within 2s. Happens on Pixel 7."
)
result = triage(report)
```

In the UI: a tree rooted at `bug_triage_pipeline` (CHAIN) with four child spans (each LLM or RETRIEVER), each carrying its own latency, token counts (from autolog), and `step` attribute. When `find_duplicates` is slow, you see it immediately. Trace-level tags `pipeline=bug_triage` and `model=gpt-4o` let you filter via `mlflow.search_traces(filter_string="tags.pipeline = 'bug_triage'")`.

See [03-prompt-chaining.md](03-prompt-chaining.md) for the orchestration patterns (sequential, parallel, conditional, fail-soft).

---

## 3. Pattern 2 — Technique comparison with `mlflow.genai.evaluate`

The single highest-leverage MLflow workflow in this session: compare techniques on the same eval set. In MLflow 3 the manual loop+`log_metric` pattern is gone — `mlflow.genai.evaluate` runs your `predict_fn` over the dataset, applies all scorers in parallel, logs every per-row trace, and aggregates the metrics.

```python
import os, time
import mlflow
from mlflow.genai.scorers import scorer, Correctness, Guidelines, Safety
from mlflow.entities import SpanType

mlflow.set_tracking_uri("http://127.0.0.1:5000")
mlflow.set_experiment("session6/technique_comparison")
mlflow.openai.autolog()

# Each technique is a predict_fn: takes `input` (the RCA prompt) and returns a string.
# Implementations live in their respective wiki files; signatures are uniform.
from techniques import (
    zero_shot_cot_fn,       # 03-wiki: 04-chain-of-thought (S5)
    plan_and_solve_fn,      # 03-wiki: 04-chain-of-thought (S5)
    tot_beam2_fn,           # 03-wiki: 02-tree-of-thoughts
    self_refine_fn,         # 03-wiki: 06-self-refine
)

TECHNIQUES = {
    "zero_shot_cot":  zero_shot_cot_fn,
    "plan_and_solve": plan_and_solve_fn,
    "tot_beam2":      tot_beam2_fn,
    "self_refine_2r": self_refine_fn,
}

# RCA golden set — each row: incident log snippet + ground-truth root cause.
# In production this lives in a versioned JSONL file or a Delta table.
eval_data = [
    {"inputs": {"input": open(f"rca/case_{i:03d}.txt").read()},
     "expectations": {"expected_response": open(f"rca/case_{i:03d}.gold").read()}}
    for i in range(100)
]

# Custom scorer: penalise outputs that don't cite a specific log line / timestamp.
@scorer
def cites_evidence(outputs: str) -> bool:
    """RCA outputs must reference a timestamp or a specific service name."""
    import re
    has_ts      = bool(re.search(r"\d{2}:\d{2}:\d{2}", outputs))
    has_service = bool(re.search(r"\b(api|db|kafka|redis|worker|ingress)\b", outputs, re.I))
    return has_ts and has_service


# Custom scorer: cost per item — derived from the trace's tags.
@scorer
def cost_under_5_cents(outputs: str, trace) -> bool:
    """Trace-derived: fail rows whose cost_usd tag exceeds $0.05."""
    tags = (trace.info.tags or {}) if trace is not None else {}
    try:
        return float(tags.get("cost_usd", "0")) <= 0.05
    except ValueError:
        return False


GUIDELINES = (
    "The response must (1) identify the root-cause service, "
    "(2) cite at least one timestamp from the input log, "
    "(3) propose one concrete mitigation. No speculation beyond the log."
)

for name, fn in TECHNIQUES.items():
    with mlflow.start_run(run_name=name):
        mlflow.log_param("technique", name)
        mlflow.log_param("model",     "gpt-4o")
        mlflow.log_param("eval_set",  "rca_golden_v3")

        results = mlflow.genai.evaluate(
            data=eval_data,
            predict_fn=lambda input, _fn=fn: _fn(input),
            scorers=[
                Correctness(),                             # vs expected_response
                Guidelines(name="rca_rules", guidelines=GUIDELINES),
                Safety(),
                cites_evidence,
                cost_under_5_cents,
            ],
        )

        for k, v in results.metrics.items():
            print(f"  {name}/{k}: {float(v):.3f}")
```

Each row produces one trace (with the technique's full span tree inside) and one row in the eval table. The MLflow UI's Compare view ranks runs by any metric. Typical RCA-on-log-snippets result: ToT-beam2 scores +6 pp `Correctness/mean` over Plan-and-Solve at 40× the cost. The numbers, not opinions, decide which technique ships.

`Correctness`, `Guidelines`, `Safety` are MLflow built-in judges. `cites_evidence` is a deterministic custom scorer. `cost_under_5_cents` reads from per-trace tags written by Pattern 6.

---

## 4. Pattern 3 — Self-Refine convergence tracking

Self-Refine has four possible stop reasons (critic-satisfied, plateau, regression, max-rounds). The most useful artifact for tuning a deployment is the distribution of stop reasons across your eval set — it tells you whether to increase or decrease the round cap.

Per-round metrics use step-indexed `log_metric` (still the v3 idiom for time-series-like values). End-of-trace summaries use `mlflow.update_current_trace(tags=...)` so they are searchable.

```python
import mlflow
from mlflow.entities import SpanType


@mlflow.trace(
    name="self_refine_convergence",
    span_type=SpanType.CHAIN,
    attributes={"technique": "self_refine", "max_rounds": 4},
)
def tracked_self_refine(task: str, max_rounds: int = 4) -> str:
    """Self-Refine with an EXTERNAL test-runner score.
    `task` is a code-generation prompt; `score()` runs pytest against the output.
    """
    out = generate(task)
    s   = score(out)                              # external rubric / test runner
    mlflow.log_metric("quality", s, step=0)
    mlflow.log_metric("tokens",  count_tokens(out), step=0)

    stop_reason = "max_rounds"
    rounds_used = max_rounds
    for r in range(1, max_rounds + 1):
        with mlflow.start_span(name=f"refine_round_{r}",
                               span_type=SpanType.CHAIN) as sp:
            crit = critique(task, out)
            sp.set_attribute("critique_preview", crit[:300])

            if crit.lower().strip().startswith("no changes"):
                stop_reason, rounds_used = "critic_satisfied", r - 1
                break

            new_out = refine(task, out, crit)
            ns      = score(new_out)
            mlflow.log_metric("quality", ns, step=r)
            mlflow.log_metric("tokens",  count_tokens(new_out), step=r)
            sp.set_attribute("delta_quality", ns - s)

            if ns - s < 0.02:
                stop_reason, rounds_used = "plateau", r
                break
            if ns < s:
                stop_reason, rounds_used = "regression", r
                # Roll back to the previous (better) round's output.
                break
            out, s = new_out, ns

    mlflow.update_current_trace(tags={
        "stop_reason":  stop_reason,
        "rounds_used":  str(rounds_used),
        "final_score":  f"{s:.3f}",
    })
    return out
```

**The `score(out)` call must use an external signal** — `pytest`, a linter, a rubric document, or ground truth. A pure "do you think this is right?" score will degrade outputs (see Misconception 0 below).

Query the resulting traces to make the tuning decision:

```python
traces = mlflow.search_traces(
    experiment_names=["session6/self_refine"],
    filter_string="tags.stop_reason = 'critic_satisfied'",
    return_type="pandas",
)
# 60%+ critic_satisfied early → lower max_rounds, save tokens
# 60%+ plateau → critic finds no actionable signal; rewrite the critique prompt
# any regression → keep the rollback branch in place
```

---

## 5. Pattern 4 — ReAct loop observability

ReAct's value to debugging is the visible trajectory (thought → action → observation → thought …). Capture that as span attributes; the full loop implementation lives in [05-react.md](05-react.md). The MLflow layer is small and uniform:

```python
import json
import mlflow
from mlflow.entities import SpanType


@mlflow.trace(
    name="react_oncall_agent",
    span_type=SpanType.AGENT,
    attributes={"max_steps": 10},
)
def react_observable(question: str, tools: dict, max_steps: int = 10) -> str:
    mlflow.update_current_trace(tags={"agent": "react_oncall", "question_preview": question[:80]})
    history = [{"role": "user", "content": question}]
    seen_actions: set[tuple] = set()

    for step in range(max_steps):
        with mlflow.start_span(name=f"turn_{step}",
                               span_type=SpanType.CHAIN) as turn:

            with mlflow.start_span(name="llm_decide", span_type=SpanType.LLM):
                msg = llm_chat(history)                  # autolog captures messages

            thought, action = parse_react(msg)
            turn.set_attribute("thought",     thought[:500])
            turn.set_attribute("action_name", action["name"])
            turn.set_attribute("action_args", json.dumps(action["args"]))

            if action["name"] == "Finish":
                turn.set_attribute("terminal", True)
                mlflow.update_current_trace(tags={
                    "stop_reason": "finish",
                    "steps_used":  str(step + 1),
                })
                return action["args"]["answer"]

            # Cycle detection: same (tool, args) twice in a row → bail out.
            sig = (action["name"], json.dumps(action["args"], sort_keys=True))
            if sig in seen_actions:
                mlflow.update_current_trace(tags={
                    "stop_reason": "cycle_detected",
                    "steps_used":  str(step + 1),
                })
                turn.set_attribute("cycle_detected", True)
                return "[ABORT] Detected action cycle; falling back to CoT."
            seen_actions.add(sig)

            with mlflow.start_span(name=f"tool::{action['name']}",
                                   span_type=SpanType.TOOL) as tspan:
                tspan.set_inputs(action["args"])
                obs = tools[action["name"]](**action["args"])
                tspan.set_outputs({"observation": str(obs)[:1000]})

            turn.set_attribute("obs_preview", str(obs)[:300])
            history += [{"role": "assistant", "content": msg},
                        {"role": "tool",      "content": str(obs)}]

    mlflow.update_current_trace(tags={"stop_reason": "max_steps_reached"})
    return "[ABORT] max_steps reached without Finish."


# Realistic on-call tool set: read-only by design (cycle-safe).
TOOLS = {
    "search_logs":     lambda service, since: loki_query(service, since),
    "describe_pod":    lambda name, namespace: kubectl_describe(name, namespace),
    "get_recent_deploys": lambda service: deploy_history(service, last_n=5),
    "query_prom":      lambda promql: prometheus_query(promql),
}
```

Each turn produces a CHAIN span with `thought`, `action_name`, `action_args`, and `obs_preview` attributes; a child LLM span (autolog fills tokens/latency); a child TOOL span with structured inputs/outputs. When a production ReAct agent enters a cycle, the MLflow trace shows the repeated `(action_name, action_args)` tuples at a glance — far faster than parsing logs.

For the stopping-condition logic itself (max-steps, cycle detection, consecutive-error cap, fallback to CoT), see [05-react.md](05-react.md).

---

## 6. Pattern 5 — Tree-of-Thoughts search logging

The search machinery (propose, evaluate, beam pruning, BFS/DFS) lives in [02-tree-of-thoughts.md](02-tree-of-thoughts.md). For observability you need three things: per-node scores as MLflow metrics, the full tree as a browsable artifact, and tree-shape summary tags on the trace.

```python
import json
import pandas as pd
import mlflow
from mlflow.entities import SpanType


@mlflow.trace(
    name="tot_code_refactor",
    span_type=SpanType.CHAIN,
    attributes={"beam": 3, "depth": 3},
)
def tot_logged(root: str, propose, evaluate, beam: int = 3, depth: int = 3) -> dict:
    """ToT over candidate refactors of a code snippet.
    `propose(state) -> list[str]` generates child refactors.
    `evaluate(state) -> float` is the value function (e.g. mypy + ruff + test pass-rate).
    """
    frontier  = [{"id": "r", "state": root, "score": 0.0, "parent": None, "depth": 0}]
    all_nodes = list(frontier)

    for d in range(depth):
        next_f = []
        for node in frontier:
            with mlflow.start_span(name=f"expand_{node['id']}",
                                   span_type=SpanType.CHAIN) as sp:
                sp.set_inputs({"parent_id": node["id"], "depth": d})
                children = propose(node["state"])
                child_scores = []
                for i, c in enumerate(children):
                    s   = evaluate(c)
                    nid = f"{node['id']}.{i}"
                    cn  = {"id": nid, "state": c, "score": s,
                           "parent": node["id"], "depth": d + 1}
                    next_f.append(cn)
                    all_nodes.append(cn)
                    child_scores.append({"node_id": nid, "score": s})
                    mlflow.log_metric(f"node_score.{nid}", s, step=d)
                sp.set_outputs({"children": child_scores})

        frontier = sorted(next_f, key=lambda x: -x["score"])[:beam]
        mlflow.log_metric("frontier_size", len(frontier), step=d)
        mlflow.log_metric("frontier_best_score",
                          frontier[0]["score"] if frontier else 0.0, step=d)

    best = max(all_nodes, key=lambda x: x["score"])

    # Persist the tree as a browsable table artifact in the MLflow UI.
    tree_df = pd.DataFrame([
        {"id": n["id"], "parent": n["parent"], "depth": n["depth"],
         "score": n["score"], "state_preview": n["state"][:200]}
        for n in all_nodes
    ])
    mlflow.log_table(tree_df, artifact_file="search_tree.json")

    # Raw tree for offline replay / visualisation.
    mlflow.log_text(json.dumps(all_nodes, default=str, indent=2),
                    "search_tree_full.json")

    mlflow.update_current_trace(tags={
        "tot_nodes_total":   str(len(all_nodes)),
        "tot_best_node_id":  best["id"],
        "tot_best_score":    f"{best['score']:.3f}",
        "tot_branching_factor": str(round(len(all_nodes) / max(1, depth), 2)),
    })
    return best
```

`mlflow.log_table` makes `search_tree.json` browsable in the Artifacts tab; `mlflow.log_text` keeps the raw nested form for offline reconstruction. Trace tags (`tot_best_score`, `tot_nodes_total`) make ToT runs queryable: `mlflow.search_traces(filter_string="tags.tot_best_score >= '0.8'")` (underscore tag names keep the MLflow filter syntax clean — no backtick escaping required for dotted names).

---

## 7. Pattern 6 — Cost tracking surfaced in the trace UI

Pricing differences across techniques are not 10% or 20%; they are 10× to 100×. Without per-call cost logging, you cannot make the architecture call between ToT and Plan-and-Solve.

```python
import mlflow

PRICING = {                                # USD per 1K tokens
    "gpt-4o":                {"in": 0.0025,  "out": 0.010},
    "gpt-4o-mini":           {"in": 0.00015, "out": 0.0006},
    "o1-mini":               {"in": 0.003,   "out": 0.012},
    "claude-sonnet-4-6":     {"in": 0.003,   "out": 0.015},
    "claude-haiku-4-6":      {"in": 0.0008,  "out": 0.004},
    "gemini-2.0-flash":      {"in": 0.000075,"out": 0.0003},
}


def price_of(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    p = PRICING.get(model, {"in": 0.001, "out": 0.003})
    return prompt_tokens / 1000 * p["in"] + completion_tokens / 1000 * p["out"]


def attribute_cost(model: str, usage) -> float:
    """Attach per-call cost to the active span AND accumulate on the trace tag.
    Call after every LLM invocation inside a traced function.
    """
    cost = price_of(model, usage.prompt_tokens, usage.completion_tokens)

    span = mlflow.get_current_active_span()
    if span is not None:
        span.set_attribute("usage.prompt_tokens",     usage.prompt_tokens)
        span.set_attribute("usage.completion_tokens", usage.completion_tokens)
        span.set_attribute("cost_usd",                round(cost, 6))

    # Trace-level rolling sum, stored as a tag so it's searchable.
    # Tags are strings → we parse, add, re-stringify.
    active = mlflow.get_current_active_span()
    if active is not None:
        # The root trace tag is what makes cost queryable in Pattern 2's scorer.
        # `update_current_trace` is idempotent — last write wins per tag.
        from mlflow import MlflowClient
        client = MlflowClient()
        trace_id = active.trace_id
        existing = client.get_trace(trace_id).info.tags or {}
        prev = float(existing.get("cost_usd", "0"))
        mlflow.update_current_trace(tags={"cost_usd": f"{prev + cost:.6f}"})

    return cost


# Use inside any chain step
@mlflow.trace(name="extract_signal", span_type=SpanType.LLM)
def extract_signal(text: str) -> dict:
    resp = client.chat.completions.create(model=MODEL, messages=[...])
    attribute_cost(MODEL, resp.usage)
    return json.loads(resp.choices[0].message.content)
```

Now the cost shows up:
- **In each LLM span** — drill into `extract_signal`, see `cost_usd = 0.0042` in the attribute panel.
- **On the trace root** — filter `mlflow.search_traces(filter_string="tags.cost_usd > '0.30'")`.
- **In `mlflow.genai.evaluate`** — the `cost_under_5_cents` scorer in Pattern 2 reads this tag.

In MLflow's compare view you will see ToT at ~$0.30/call vs Plan-and-Solve at ~$0.005/call. The numbers, not opinions, settle the architecture debate.

Update `PRICING` at every model release. Stale pricing produces silently wrong cost dashboards.

---

## 8. Pattern 7 — Prompt Registry for chained prompts

Session 4 used the Prompt Registry for a single agent system prompt. Chains have the same need — multiplied by the number of steps. The registry treats chain prompts identically: one entry per step, each independently versioned, each loaded by name+version at runtime.

```python
import mlflow

mlflow.set_tracking_uri("http://127.0.0.1:5000")

# --- Register each chain step's prompt -----------------------------------
EXTRACT_V1 = (
    "You are a triage assistant. Extract a JSON object with keys "
    "`severity` (low|medium|high|critical), `component`, "
    "`stack_trace_present` (bool), `reproduction_steps` (list[str]). "
    "Return ONLY valid JSON.\n\nBug report:\n{report}"
)

CLASSIFY_V1 = (
    "Given this extracted signal, return the owning team as one of "
    "[backend, frontend, infra, data, mobile]. Return JSON: "
    '{{"team": "<team>", "confidence": <0-1>}}.\n\nSignal:\n{signal}'
)

DRAFT_V1 = (
    "Draft a 3-sentence acknowledgement to the reporter. State the owning team, "
    "severity, and whether duplicates were found. Tone: neutral, factual.\n\n"
    "Signal: {signal}\nTeam: {team}\nDuplicates: {dupes}"
)

p_extract  = mlflow.genai.register_prompt(
    name="triage_extract",
    template=EXTRACT_V1,
    commit_message="v1 — strict JSON schema, severity enum",
    tags={"chain": "bug_triage", "step": "1_extract"},
)
p_classify = mlflow.genai.register_prompt(
    name="triage_classify",
    template=CLASSIFY_V1,
    commit_message="v1 — five-team enum with confidence",
    tags={"chain": "bug_triage", "step": "2_classify"},
)
p_draft    = mlflow.genai.register_prompt(
    name="triage_draft",
    template=DRAFT_V1,
    commit_message="v1 — neutral 3-sentence acknowledgement",
    tags={"chain": "bug_triage", "step": "4_draft"},
)
print(f"Registered: extract v{p_extract.version}, "
      f"classify v{p_classify.version}, draft v{p_draft.version}")


# --- Load by version at process start -------------------------------------
EXTRACT_TEMPLATE  = mlflow.genai.load_prompt("prompts:/triage_extract/1").template
CLASSIFY_TEMPLATE = mlflow.genai.load_prompt("prompts:/triage_classify/1").template
DRAFT_TEMPLATE    = mlflow.genai.load_prompt("prompts:/triage_draft/1").template


# --- Use in the chain, tagging each trace with the version mix ------------
@mlflow.trace(name="bug_triage_pipeline", span_type=SpanType.CHAIN)
def triage(report: str) -> dict:
    mlflow.update_current_trace(tags={
        "prompt_extract":  f"v{p_extract.version}",
        "prompt_classify": f"v{p_classify.version}",
        "prompt_draft":    f"v{p_draft.version}",
    })
    signal   = extract_signal(report, EXTRACT_TEMPLATE)
    routing  = classify_component(signal, CLASSIFY_TEMPLATE)
    drafted  = draft_response(signal, routing, [], DRAFT_TEMPLATE)
    return {"signal": signal, "routing": routing, "response": drafted}
```

**Why this matters at chain scale:** when `mlflow.search_traces` shows a regression, the per-step prompt-version tags tell you *which step's prompt changed* — without scrolling through git diffs. To roll back one step independently, change the loaded version: `mlflow.genai.load_prompt("prompts:/triage_extract/3")` swaps in v3 of *just* the extract prompt; the other steps stay on v1.

Use registry **aliases** (production / staging / candidate) instead of pinning version numbers in code when you want safe progressive rollouts:

```python
mlflow.genai.set_prompt_alias("triage_extract", alias="production", version=1)
# Code always loads "prompts:/triage_extract@production".
# Promote v2 by retargeting the alias — no code change, no redeploy.
```

---

## 9. Pattern 8 — Production monitoring with `mlflow.genai.evaluate` + scorers

Tracing tells you *what happened*. Evaluation tells you *whether it was correct*. For chains and agents, run `mlflow.genai.evaluate` nightly (or per-PR in CI) over a frozen golden set, using built-in judges *plus* a custom per-step scorer that catches silent step-level regressions.

```python
import json
import mlflow
from mlflow.genai.scorers import (
    scorer, Correctness, Guidelines, Safety, RelevanceToQuery,
)

mlflow.set_tracking_uri("http://127.0.0.1:5000")
mlflow.set_experiment("session6/bug_triage_nightly_eval")


# --- Golden set: each row has the bug report + the gold artefacts per step.
# In production this is a versioned JSONL file under data/ in the repo.
eval_data = [
    {
        "inputs": {
            "report": "App crashes on startup after v4.7 upgrade ...",
        },
        "expectations": {
            "expected_response": (
                "Mobile team; high severity; AuthInterceptor NPE on cold start."
            ),
            "gold_severity": "high",
            "gold_team":     "mobile",
        },
    },
    # ... 99 more rows
]


# --- Custom scorer: per-step pass-rate by reading the trace tree.
# `triage()` returns a dict; we score every step independently from one trace.
@scorer
def per_step_pass_rate(outputs: dict, expectations: dict) -> float:
    """Return the fraction of chain steps that produced correct output.
    Catches the classic 'overall answer looks ok but step 2 was wrong' case.
    """
    steps_correct = 0
    steps_total   = 2

    signal  = outputs.get("signal",  {}) or {}
    routing = outputs.get("routing", {}) or {}

    if signal.get("severity") == expectations.get("gold_severity"):
        steps_correct += 1
    if routing.get("team") == expectations.get("gold_team"):
        steps_correct += 1

    return steps_correct / steps_total


# --- Custom scorer: dedupe step produced valid issue IDs.
@scorer
def dedupe_well_formed(outputs: dict) -> bool:
    dupes = outputs.get("dupes", [])
    return all(isinstance(d, str) and d.startswith("BUG-") for d in dupes)


GUIDELINES = (
    "Response must be 2-4 sentences, factual, no apology language, "
    "no commitment to a fix timeline. Always name the owning team."
)


def predict_for_eval(report: str) -> dict:
    """Adapter: mlflow.genai.evaluate passes inputs by keyword."""
    return triage(report)


with mlflow.start_run(run_name="nightly_eval"):
    mlflow.log_param("model",         "gpt-4o")
    mlflow.log_param("prompt_extract", f"v{p_extract.version}")
    mlflow.log_param("prompt_classify", f"v{p_classify.version}")
    mlflow.log_param("prompt_draft",   f"v{p_draft.version}")

    results = mlflow.genai.evaluate(
        data=eval_data,
        predict_fn=predict_for_eval,
        scorers=[
            Correctness(),                           # final response vs expected
            Guidelines(name="tone_rules", guidelines=GUIDELINES),
            Safety(),
            RelevanceToQuery(),
            per_step_pass_rate,                      # custom: per-step accuracy
            dedupe_well_formed,                      # custom: structural check
        ],
    )

    for k, v in sorted(results.metrics.items()):
        print(f"  {k}: {float(v):.3f}")
```

The output is one MLflow run with:
- Aggregate metrics: `Correctness/mean`, `tone_rules/mean`, `per_step_pass_rate/mean`, etc.
- One row per eval item in `results.tables["eval_results"]` — per-row pass/fail visible in the Evaluations tab.
- A full trace per row — clickable for failure forensics.

**Regression alert (run this from CI):**

```python
runs = mlflow.search_runs(
    experiment_names=["session6/bug_triage_nightly_eval"],
    order_by=["start_time DESC"],
    max_results=2,
)
if len(runs) >= 2:
    delta = runs.iloc[0]["metrics.Correctness/mean"] - \
            runs.iloc[1]["metrics.Correctness/mean"]
    if delta < -0.02:
        raise SystemExit(f"FAIL: Correctness dropped {delta:.3f} vs last run")
```

This single check, run on every PR, prevents the most common production failure mode: an "improved" prompt that quietly breaks step 2 while the overall response still reads plausibly.

---

## 10. Caching strategies

The Session 5 caching guidance (90% cost / 80% TTFT savings on Anthropic prompt prefixes) still applies. For multi-call techniques, cache *at the right granularity* — uniform caching at the wrong layer either saves nothing or corrupts results.

| Cache target | Key structure | When to cache |
|---|---|---|
| **Per-step in chain** | `hash(template_version + model + step_inputs)` | All read-only steps |
| **ReAct tool calls** | `(tool_name, json.dumps(args, sort_keys=True))` | Read-only tools only (search, fetch, query) — never mutating tools |
| **ToT value function** | `hash(node_state + model)` | Identical sub-trees recur across runs and across requests |
| **Self-Refine intermediates** | **Never cache** | Each round must change by design; caching defeats the technique |

Semantic cache (vector-similarity lookup) is useful only at chain boundaries, never inside tight loops. False-positive semantic matches compound errors across steps — a near-miss at step 2 can produce a wildly wrong output at step 7.

Rule of thumb: at `temperature=0` LLMs are near-deterministic. Cache aggressively at exact-key level before reaching for semantic caching.

---

## 11. Error propagation strategies

A 5-step chain with 95% per-step reliability has 77% end-to-end reliability. With 8 steps it is 66%. You cannot ignore failure handling; you must pick a strategy *per step*.

| Strategy | When to use | Implementation |
|---|---|---|
| **Fail-fast** | Irreversible downstream actions (db write, email send, payment) | `raise ChainStepError` immediately |
| **Fallback chain** | Degraded-but-acceptable output is acceptable | Run a simpler fallback function |
| **Self-heal** | Deterministic validation error (JSON parse, schema) | Re-prompt with the error message as context (mini-Self-Refine) |
| **Graceful degrade** | Optional enrichment steps (e.g. "find duplicate tickets") | Set `confidence=0.5`, mark output for human review |

```python
from dataclasses import dataclass
from typing import Any, Callable, Optional
import mlflow


@dataclass
class ChainResult:
    value:        Any
    confidence:   float
    needs_human:  bool = False
    error:        Optional[str] = None


def run_step_resilient(
    name: str,
    fn: Callable,
    ctx: dict,
    retries: int = 2,
    validator: Optional[Callable] = None,
    fallback_fn: Optional[Callable] = None,
) -> ChainResult:
    last_error = None
    for attempt in range(retries + 1):
        try:
            out = fn(ctx)
        except Exception as e:
            last_error = str(e)
            continue

        if validator is None or validator(out):
            return ChainResult(out, confidence=1.0)

        last_error = getattr(validator, "last_error", "validator_failed")
        # Self-heal: feed the error back into the next attempt's context.
        ctx[f"_{name}_feedback"] = last_error

    span = mlflow.get_current_active_span()
    if span is not None:
        span.set_attribute(f"{name}.last_error", last_error or "")
        span.set_attribute(f"{name}.attempts",   retries + 1)

    if fallback_fn:
        return ChainResult(fallback_fn(ctx), confidence=0.5, error=last_error)
    mlflow.update_current_trace(tags={f"step_failed.{name}": "true"})
    return ChainResult(None, confidence=0.0, needs_human=True, error=last_error)
```

Emit a structured trace attribute on every failure (`span.set_attribute(...)` or a trace tag) so failures are debuggable offline without re-running the chain.

---

## 12. Misconception 0 — Self-correction without a verifier (CRITICAL)

This is the most important and least-known failure mode in the entire advanced-prompting space.

**Huang et al. 2023 — "Large Language Models Cannot Self-Correct Reasoning Yet"** (arXiv:[2310.01798](https://arxiv.org/abs/2310.01798))

The finding: when GPT-3.5-turbo or GPT-4 is asked to self-correct its own reasoning *without any external feedback signal*, **performance on GSM8K degrades** compared to the original answer. The model is not an oracle on its own correctness. When you ask "is this right?", it often says yes to wrong answers and no to right ones — and the "correction" makes things worse.

### Implications for every self-correction technique in this session

| Technique | Required external signal |
|-----------|--------------------------|
| **Self-Refine** | A rubric document, unit-test runner, linter, ground-truth reference — anything the critic can read that the generator did not have |
| **Constitutional critique** | An explicit constitution / policy document the critic checks against |
| **Reflexion** | Episode-level reward signal — typically pass/fail on the task |
| **ToT value function** | A scorer with information beyond the LLM's own confidence — verifier, executor, retrieval, or human-labeled exemplars |

### The rule

> Pure "do you think this is right?" loops are not just useless; they are harmful.

If you cannot point to the external signal the critic uses, you do not have a self-correction loop — you have a noise generator that costs N× more.

### How to verify your loop in practice

1. Disable the critic. Run the generator alone through `mlflow.genai.evaluate` with `Correctness()`.
2. Enable the critic. Run again.
3. If `Correctness/mean` did not improve by a margin you trust (≥ 2 pp on a >100-case set), you have no critic — strip the loop, save the tokens.

This single check would have prevented many of the deployed Self-Refine and Constitutional-AI pipelines that ship today.

---

## 13. Other misconceptions (1–7)

Brief catalog. Full text in the research artifact §8.

**1. "More technique = more quality."** Each layered technique adds variance, tokens, and failure modes. Beyond three layers, marginal additions hurt more than help. The right answer is always "measure on your eval set first."

**2. "ToT is just CoT × N."** ToT requires a *reliable value function*. Without one you are running expensive Self-Consistency with worse semantics. If you cannot reliably score a partial thought, ToT is no better than sampling N paths and voting — at far higher cost. See [02-tree-of-thoughts.md](02-tree-of-thoughts.md).

**3. "ReAct is just CoT with tool calls."** ReAct is a *loop*. Engineers who forget the stopping machinery (max-steps, cycle detection, consecutive-error cap, fallback to CoT) ship infinite-loop production bots. The stopping logic is not optional. See [05-react.md](05-react.md).

**4. "Prompt chains are microservices."** Every step is non-deterministic. Validators, retries, dead-letter queues, and confidence propagation are not optional. You need per-step eval sets, not just end-to-end. See [03-prompt-chaining.md](03-prompt-chaining.md).

**5. "Few-shot exemplars are cheap."** They inflate prompt cost on *every call, forever*. For high-QPS endpoints, long few-shot prompts are your biggest token bill. Cache them in a versioned template; consider Auto-CoT or Plan-and-Solve to reduce or eliminate them.

**6. "Self-Consistency improves any output."** Only for tasks with a discrete majority (multiple-choice, numeric answers, classification). For open-ended text it inflates cost and produces averaging artifacts.

**7. "If GPT-4 fails, ToT will save me."** If the model lacks the underlying knowledge or a reliable value function, search amplifies the failure. ToT lifts planning tasks; it does not inject knowledge.

---

## 14. When to stop and switch

The escape-hatch rule from the decision framework ([07-decision-framework.md](07-decision-framework.md)):

> **If your ToT or Reflexion run exceeds ~$0.50 per request, stop.**

Then in order of preference:

| Option | Trade-off |
|--------|-----------|
| **Draft-and-verify** — cheaper model proposes, strong model only evaluates | 5–10× cost cut, usually < 2 pp quality drop |
| **Self-Consistency at N=5** — replaces ToT for many tasks | Within ~5% quality at far lower cost; no value function needed |
| **Aggressive caching of the value function** | 30–80% cost cut if sub-trees recur |
| **Migrate to a reasoning model** (o1-mini, Claude Extended Thinking, Gemini thinking) | Thinking tokens on o1-mini often cost less than orchestrating 30 ToT calls on gpt-4o — and may produce better results |

See [08-reasoning-models.md](08-reasoning-models.md) for when reasoning models replace explicit search structures entirely.

---

## 15. Practitioner wisdom — "Things I wish I knew before"

Distilled from the research artifact and from Eugene Yan / Hamel Husain / Simon Willison's production write-ups:

- **The biggest improvement comes from a good eval set, not a fancier technique.** Spend engineering time on evals first. A 100-case golden set for your domain beats every paper.
- **Schema-validate every intermediate JSON output.** Always. A missing key in step 3 that causes a silent failure in step 7 is the single most common production bug in prompt chains. Pydantic at every boundary; `response_format={"type": "json_object"}` where supported.
- **Cache aggressively at temperature=0.** LLMs are near-deterministic at `temp=0` — exploit it. Per-step exact-key caching first; semantic caching only at chain boundaries.
- **Run a per-step pass-rate analysis before changing any prompt.** The weakest step, not the overall pipeline, is always the target. Tuning the strongest step is the most common form of wasted effort. The `per_step_pass_rate` scorer in Pattern 8 is the canonical implementation.
- **Prompt injection bypasses all this.** Harden inputs at every chain boundary — not just at the front door. A clean user input can become a malicious step-3 input after retrieval. See section 17.
- **Reasoning models cost 5–10× per token.** A chain on `gpt-4o-mini` often outperforms one `o1` call on production tasks. Measure before assuming the expensive model wins.
- **EmotionPrompt and low-effort tricks are model-version-dependent.** The famous "you'll be tipped $200" / "this is important to my career" boosts were measured on 2023-era models. RLHF-tuned Claude 3+ and GPT-4 Turbo are largely insensitive or mildly negative. Re-run your eval at every major model bump.

---

## 16. Prompt injection at advanced rungs

Session 5 §5.4–5.5 (see [../../Session 05 - Core Prompt Engineering Techniques/03-wiki/07-production.md](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/07-production.md)) covered the OWASP LLM01:2025 injection threat for a *single* prompt: structural separation, XML tags, sanitization, output validation, least privilege.

Multi-call techniques inherit those defenses **and add new attack surface at every step**.

| Attack surface | Example |
|---------------|---------|
| **Step-2 input from retrieval** | RAG fetches a doc with embedded "ignore previous instructions" inside |
| **ReAct tool output** | A web-search tool returns adversarial text the model then trusts |
| **ToT child proposal** | A maliciously-crafted root-level input causes the propose step to generate child states that override the evaluator |
| **Self-Refine critique** | An injected user input causes the critique step to recommend leaking data |

### Defenses at advanced rungs

1. **Re-apply the XML data envelope at every step.** Wrap every untrusted intermediate (retrieval results, tool outputs, child proposals) in `<untrusted_data>...</untrusted_data>` before passing to the next LLM call. The system prompt must repeat the rule: instructions inside `<untrusted_data>` are data, never commands.
2. **Pydantic schema guard at every chain boundary.** If the output of step N does not parse against the schema, halt the chain. Many injection attempts succeed by producing free-form prose where structured output was expected; schema validation catches them.
3. **Tool whitelist per step.** ReAct agents that can read should not be able to write at the same step. Constrain the tool set to the minimum needed at each loop turn.
4. **Log every injection attempt as a trace tag.** `mlflow.update_current_trace(tags={"injection_detected": "step_3"})` makes security incidents queryable via `mlflow.search_traces(filter_string="tags.injection_detected != ''")`.
5. **Never compose a follow-up prompt by string-concatenating an untrusted intermediate.** Always pass through a sanitizer or schema.

The 5-step chain that worked perfectly in dev will be exploited via step 3 in production. Plan for it.

---

## 17. Editorial Notes (teaching)

- **Lead the session with the MLflow Tracing UI.** Run Pattern 1 live on the bug-triage chain, then open the trace tree. Engineers immediately understand the value — flat logs cannot show what a span tree shows in two seconds.
- **Spend disproportionate time on Misconception 0.** It contradicts a deeply held intuition ("of course self-correction helps") and most participants will go back to their teams and find existing Self-Refine deployments with no external verifier. The Huang et al. citation gives them air cover to push back.
- **Pattern 6 (cost tracking) is the closing slide.** Showing ToT at $0.30/call vs Plan-and-Solve at $0.005/call on the same eval set in MLflow's compare view is the most persuasive "stop adding technique" demonstration possible.
- **Pattern 7 (Prompt Registry) is the highest leverage take-home.** Engineers who already use the registry for a single prompt instantly grasp it scales to chains — and the alias mechanism solves their progressive-rollout problem.
- **Skip Pattern 5 (ToT logging) if time-constrained.** It is the lowest-frequency technique in shipped systems (research artifact §6.3) — Patterns 1, 2, 3, 7, 8 cover 90% of production needs.
- **Bring a stale `PRICING` dict to demo.** Set the gpt-4o output price to 2024 numbers, show the cost dashboard, then ask why it's wrong. Drives home: pricing data is a maintenance burden, not a one-time config.

---

## References

| Source | Used for |
|--------|----------|
| MLflow 3.10 docs — Tracing API (`@mlflow.trace`, `start_span`, `SpanType`) | Patterns 1, 3, 4, 5; trace tag and attribute idioms |
| MLflow 3.10 docs — `mlflow.genai.evaluate`, built-in scorers | Patterns 2, 8; `Correctness`, `Guidelines`, `Safety`, `RelevanceToQuery` |
| MLflow 3.10 docs — `mlflow.genai.register_prompt` / `load_prompt` / aliases | Pattern 7; chain-prompt registry and progressive rollout |
| MLflow 3.10 docs — `mlflow.search_traces`, `mlflow.search_runs` | Regression alerts; per-step diagnosis; cost queries |
| MLflow docs — OpenAI / Anthropic / LangChain autolog | `mlflow.openai.autolog()` semantics; auto-captured usage |
| Huang et al. 2023 — "LLMs Cannot Self-Correct Reasoning Yet" — arXiv:[2310.01798](https://arxiv.org/abs/2310.01798) | Misconception 0; external verifier requirement |
| Yao et al. 2023 — Tree of Thoughts — NeurIPS | ToT cost / value-function failure mode (Misconception 2) |
| Yao et al. 2022 — ReAct — ICLR | ReAct loop stopping conditions (Misconception 3) |
| Madaan et al. 2023 — Self-Refine — NeurIPS | Round-cap heuristics (1 round for editing, 2 default, 4 high-stakes) |
| Shinn et al. 2023 — Reflexion — NeurIPS | Episode-level reward as external signal |
| OWASP GenAI Security Project 2025 — LLM01 | Prompt injection at multi-step boundaries |
| Anthropic Prompt Caching docs | 90% cost / 80% TTFT — per-step caching key structure |
| OpenAI / Anthropic / Google pricing pages | `PRICING` dict (Pattern 6); update at each release |
| Eugene Yan / Hamel Husain / Simon Willison blogs | Production wisdom: eval set first, schema-validate, per-step pass-rate analysis |
| Session 4 demo notebooks 01–06 (this repo) | Source patterns for `@mlflow.trace`, `start_span`, `genai.evaluate`, Prompt Registry, `update_current_trace`, `get_current_active_span` |
| Comprehensive Framework research artifact §5, §5a, §8 | Source for the eight MLflow patterns; caching and error tables; misconceptions |
