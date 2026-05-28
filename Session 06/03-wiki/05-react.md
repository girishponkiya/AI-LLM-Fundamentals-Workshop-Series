# 05 — ReAct (Reasoning + Acting)

**Overview:** ReAct is the **Thought / Action / Observation loop** — the LLM reasons in natural language, emits a structured tool call, the orchestrator executes it, and feeds the result back. It's the canonical pattern for any LLM that needs real-world data: metrics, logs, search results, DB queries, API calls. ReAct beat imitation-learning + RL baselines on ALFWorld by **+34 pp** (Yao et al. 2022, arXiv:2210.03629). It is also the single most over-shipped pattern in the field — engineers forget the *stopping machinery* (max-steps, cycle detection, error caps, fallback) and ship infinite loops. This file covers the loop, the synergy that makes it work, the production-hardened implementation, the on-call incident bot demo (D4), MLflow observability, and the provider-specific tool-use mechanics.

**Cross-references:** [01-landscape.md](01-landscape.md) — ReAct lives in Family 4 (External Grounding). [04-generate-knowledge.md](04-generate-knowledge.md) — Generate Knowledge grounds with self-retrieval; ReAct grounds with *real* tools. [06-secondary-techniques.md](06-secondary-techniques.md) — Program-of-Thought is the right answer for read-only computation; ReAct is for everything else that needs tools. [07-decision-framework.md](07-decision-framework.md) — when to ReAct vs chain + PoT vs reasoning-model-with-native-tools. [08-reasoning-models.md](08-reasoning-models.md) — o1 / Claude Extended Thinking / Gemini Thinking handle the reasoning between tool calls internally — ReAct prompting becomes redundant. [09-production.md](09-production.md) — caching read-only tool calls, MLflow agent spans. [Session 5 / 04-chain-of-thought.md](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/04-chain-of-thought.md) — the "Thought" step is just CoT applied per turn.

---

## Definition

**ReAct** — Yao et al. 2022, arXiv:2210.03629 (ICLR 2023). An interleaved loop:

```
┌────────────────────────────────────────────────────┐
│ Thought:      <natural-language reasoning>         │
│ Action:       <tool_name>[<args as JSON>]          │
│ Observation:  <tool output>                        │
│ Thought:      <reasoning given observation>        │
│ Action:       Finish[<final answer>]                │
└────────────────────────────────────────────────────┘
```

Each turn:
1. **Thought** — the model writes a short plan / sub-goal / hypothesis.
2. **Action** — the model emits a structured tool call.
3. **Observation** — the orchestrator executes the tool and appends the result to the conversation.

The loop continues until the model emits `Finish[...]`, the max-step budget is hit, cycle detection fires, or consecutive errors exceed the cap. The full conversation history (thoughts + actions + observations) is passed to every subsequent turn — ReAct is stateful.

---

## Why It Works — Reasoning + Acting Synergy

Yao et al. ran ablations on two halves:

| Mode | Behaviour | Failure mode |
|------|-----------|--------------|
| Reason-only (CoT) | Plans without tools | **Hallucination.** Fabricates facts it can't verify. |
| Act-only (chain of API calls) | Tools without reasoning | **Brittle.** Rigid call sequences, no recovery from unexpected outputs. |
| **ReAct (both)** | Thought plans, Action grounds | **Each step is auditable and adaptive.** |

The synergy:
- **Thoughts plan sub-goals and react to observations** — when an API returns unexpected data, the next Thought reflects on it and adjusts.
- **Actions ground the reasoning in external reality** — the model can't hallucinate the metric value if it just called `query_metrics(...)`.

This is the same mechanism that makes CoT work (Session 5 §04 — the autoregressive context-conditioning trick), but extended with external evidence as observation tokens.

---

## Benchmarks (Yao et al. 2022, ICLR 2023)

| Benchmark | Baseline | ReAct | Δ |
|-----------|----------|-------|----|
| **ALFWorld** (text-based household tasks) | Imitation Learning + RL | **+34 pp absolute** | massive |
| **WebShop** (multi-step web shopping) | IL+RL | **+10 pp** | substantial |
| **HotpotQA** (multi-hop QA) | CoT-only | beats CoT-only and Act-only consistently | — |
| **FEVER** (fact verification) | CoT-only | beats CoT-only and Act-only consistently | — |

**Paper:** Yao et al. 2022 — arXiv:2210.03629. The ALFWorld result is the slide everyone remembers; the HotpotQA / FEVER results show ReAct is more robust to hallucination than CoT.

---

## Production-Hardened ReAct Loop

The naive ReAct loop is six lines. The production-hardened loop is six pages. Below is the minimum viable production implementation, adapted from anchor §2.4. **Every line of the hardening machinery is non-optional.**

```python
"""
react_prod.py — production-shaped ReAct loop with full hardening.

Hardening checklist (anchor §5.3):
  ✅ Cycle detection via (tool_name, args) fingerprint
  ✅ Consecutive-error cap (3 errors → break)
  ✅ Max-steps limit with fallback
  ✅ Tool-not-found error with available-tools list
  ✅ Full history passed on every call (ReAct is stateful)
  ✅ Fallback to CoT on non-convergence
"""

import json
from typing import Callable, Any


REACT_SYSTEM = """You are an on-call SRE diagnosing a production incident.
Use available tools to gather evidence. Reason step by step.

Format EXACTLY as:
  Thought: <your reasoning>
  Action: <tool_name>[<args as JSON>]
OR when done:
  Thought: <your reasoning>
  Action: Finish[<root cause summary>]

Available tools: {tool_list}
"""


def parse_react(msg: str) -> tuple[str, dict]:
    """Parse a Thought/Action message into (thought, action_dict)."""
    thought, action_line = "", ""
    for line in msg.splitlines():
        if line.startswith("Thought:"):
            thought = line[len("Thought:"):].strip()
        elif line.startswith("Action:"):
            action_line = line[len("Action:"):].strip()

    if action_line.startswith("Finish["):
        return thought, {"name": "Finish",
                         "args": {"answer": action_line[len("Finish["):-1]}}

    try:
        tool_name, rest = action_line.split("[", 1)
        args = json.loads(rest.rstrip("]"))
        return thought, {"name": tool_name.strip(), "args": args}
    except Exception as e:
        return thought, {"name": "_parse_error", "args": {"raw": action_line,
                                                          "err": str(e)}}


def react_prod(
    question: str,
    tools: dict[str, Callable[..., str]],
    llm_chat: Callable[[list[dict]], str],
    fallback_cot: Callable[[str], str],
    max_steps: int = 10,
    max_consec_errors: int = 3,
) -> str:
    """
    Production-hardened ReAct loop.

    `tools` maps tool name → callable. `llm_chat` is a chat-completion
    function taking message history, returning the assistant's message.
    `fallback_cot` is the safety net invoked on non-convergence.
    """
    history: list[dict] = [
        {"role": "system",
         "content": REACT_SYSTEM.format(tool_list=", ".join(tools.keys()))},
        {"role": "user", "content": question},
    ]
    seen: set = set()           # for cycle detection
    consec_errors = 0

    for step in range(max_steps):
        msg = llm_chat(history)
        history.append({"role": "assistant", "content": msg})
        thought, action = parse_react(msg)

        # Terminal: Finish action
        if action["name"] == "Finish":
            return action["args"]["answer"]

        # Cycle detection
        call_key = (action["name"], json.dumps(action["args"], sort_keys=True))
        if call_key in seen:
            break  # repeating the same call -> we're stuck, abort to fallback
        seen.add(call_key)

        # Tool dispatch
        try:
            if action["name"] not in tools:
                obs = (f"Tool '{action['name']}' not found. "
                       f"Available tools: {list(tools.keys())}")
                # NOT an error -> don't increment consec_errors;
                # let the model self-correct on the next turn.
            elif action["name"] == "_parse_error":
                obs = f"Parse error: {action['args']['err']}. Retry the Action line."
            else:
                obs = str(tools[action["name"]](**action["args"]))
                consec_errors = 0
        except Exception as e:
            obs = f"Error executing {action['name']}: {e}"
            consec_errors += 1
            if consec_errors >= max_consec_errors:
                break

        history.append({"role": "user",
                        "content": f"Observation: {obs}"})

    # Did not converge — fall back to CoT-only synthesis
    return fallback_cot(question)
```

### Hardening Checklist — Why Each Item Exists

| Item | Failure mode without it |
|------|------------------------|
| **Cycle detection** (`(tool_name, args)` in `seen`) | Model loops calling `query_metrics("api", "1h")` forever |
| **Consecutive-error cap** | Tool down → model retries same call → infinite errors |
| **Max-steps limit** | Long, unclear tasks burn budget; cap and fall back |
| **Tool-not-found with available list** | Model hallucinates tool names; the list helps it self-correct |
| **Full history on every call** | Stateful — the model needs to see past observations to reason about them |
| **Fallback to CoT on non-convergence** | Better degraded answer than crash; raise the failure event to MLflow |
| **Parse error recovery** | LLM produces a malformed `Action:` line; recover gracefully |

The last item is subtle but worth highlighting: parse errors are *expected*, not exceptional. Treat them like the validator-feedback loop in [03-prompt-chaining.md](03-prompt-chaining.md) — feed the parse error back as an observation and let the model self-correct.

---

## Engineering Example — On-Call Incident Bot (Demo D4)

The canonical ReAct demo for this workshop. A bot triages an incident by calling read-only tools, reasons about the evidence, and proposes a targeted action.

### Tool dictionary

```python
def query_metrics(service: str, window: str = "1h") -> str:
    """Query Prometheus / Datadog. Returns a structured summary."""
    return (
        f"[metrics] {service} window={window}: "
        f"p99_latency=2340ms (+890ms vs baseline), "
        f"db_connections=497/500 (99% pool utilisation), "
        f"error_rate=12.3%, request_rate=4500 rps"
    )


def tail_logs(service: str, n: int = 50) -> str:
    """Tail recent log lines. Returns last n entries."""
    return (
        f"[logs] last {n} of {service}:\n"
        f"03:14:22 ERROR Connection pool exhausted (waited 5000ms)\n"
        f"03:14:21 WARN  Slow query: SELECT * FROM user_sessions ... (8.4s)\n"
        f"03:14:18 WARN  Slow query: SELECT * FROM user_sessions ... (7.9s)\n"
        f"03:12:00 INFO  Deploy v2.47 rolled out (commit a3f2c1b)"
    )


def list_recent_deploys(service: str) -> str:
    """List deploys in the last 24h."""
    return (
        f"[deploys] {service}:\n"
        f"v2.47 03:12:00 UTC (commit a3f2c1b — added 3 background jobs, "
        f"new query on user_sessions table)\n"
        f"v2.46 yesterday 14:00 UTC (commit 9b8e7d2 — UI-only change)"
    )


def rollback(deploy_id: str) -> str:
    """Roll back to the previous deploy. WRITE TOOL — gated."""
    return f"[rollback] Initiated rollback from {deploy_id}. ETA: 90s."


TOOLS = {
    "query_metrics":       query_metrics,
    "tail_logs":           tail_logs,
    "list_recent_deploys": list_recent_deploys,
    # rollback is NOT exposed unless a human approves the proposed action.
}
```

### Sample trace

```
USER: CRITICAL: API service latency p99 > 2000ms for 15 minutes.
      Error rate 12%. Started at 03:14 UTC. Service: api-gateway.

ASSISTANT:
Thought: Latency p99 > 2000ms and error rate 12% — pool exhaustion or
         downstream timeout. First check metrics to confirm.
Action: query_metrics[{"service": "api-gateway", "window": "1h"}]

OBSERVATION: [metrics] api-gateway window=1h: p99_latency=2340ms (+890ms ...),
             db_connections=497/500 (99% pool utilisation), error_rate=12.3%

ASSISTANT:
Thought: DB pool at 99% utilisation strongly suggests pool exhaustion. Let me
         tail the logs to confirm and look for the trigger.
Action: tail_logs[{"service": "api-gateway", "n": 50}]

OBSERVATION: [logs] last 50 of api-gateway:
             03:14:22 ERROR Connection pool exhausted (waited 5000ms)
             03:14:21 WARN  Slow query: SELECT * FROM user_sessions ... (8.4s)
             03:14:18 WARN  Slow query: SELECT * FROM user_sessions ... (7.9s)
             03:12:00 INFO  Deploy v2.47 rolled out (commit a3f2c1b)

ASSISTANT:
Thought: Pool exhaustion confirmed, triggered by slow queries on user_sessions
         starting ~03:14:18. The deploy at 03:12:00 is suspicious. Let me check
         what changed in v2.47.
Action: list_recent_deploys[{"service": "api-gateway"}]

OBSERVATION: [deploys] api-gateway:
             v2.47 03:12:00 UTC (commit a3f2c1b — added 3 background jobs,
             new query on user_sessions table)
             v2.46 yesterday 14:00 UTC (commit 9b8e7d2 — UI-only change)

ASSISTANT:
Thought: v2.47 added a new query on user_sessions table and 3 background jobs.
         The slow queries match. Root cause: v2.47's new user_sessions query
         is missing an index, causing pool exhaustion. Propose: rollback
         v2.47, then add the index in v2.48.
Action: Finish[Root cause: v2.47 introduced an unindexed query on user_sessions
         (commit a3f2c1b). The query consumes connections for 8+ seconds,
         exhausting the 500-connection pool. Immediate action: rollback v2.47.
         Follow-up: add covering index, ship as v2.48.]
```

Three tool calls, four thoughts, one Finish. The bot proposes a *targeted* rollback with evidence trail. Notice the bot never *executes* `rollback` — it stays read-only; the human approves the write action. This is the right production posture for any ReAct agent that can touch infrastructure.

---

## MLflow Observability for ReAct (MLflow 3.10+, anchor §5a.4)

Every turn becomes a nested span. Thoughts and actions become span attributes; tool calls get their own `SpanType.TOOL` spans with input args and observation previews. Trace-level tags (`terminated`, `final_action`, `steps_used`) make problem traces searchable across an eval run.

```python
import json
import mlflow
from mlflow.entities import SpanType

mlflow.openai.autolog()
mlflow.set_experiment("session6/react_oncall_bot")

MAX_STEPS         = 10
MAX_CONSEC_ERRORS = 3


@mlflow.trace(
    name="react_full",
    span_type=SpanType.AGENT,
    attributes={
        "max_steps":         MAX_STEPS,
        "max_consec_errors": MAX_CONSEC_ERRORS,
        "tools":             ["query_metrics", "tail_logs", "list_recent_deploys"],
        "agent_version":     "v1.4",
    },
)
def react_observable(question: str, tools: dict,
                     max_steps: int = MAX_STEPS) -> str:
    history = [{"role": "user", "content": question}]
    seen: set = set()
    errors = 0
    step = 0

    for step in range(max_steps):
        with mlflow.start_span(name=f"turn_{step}",
                                span_type=SpanType.CHAIN) as turn_span:
            turn_span.set_attribute("step", step)

            with mlflow.start_span(name="llm_thought",
                                    span_type=SpanType.LLM) as lsp:
                msg = llm_chat(history)
                lsp.set_outputs({"raw": msg[:1000]})
            thought, action = parse_react(msg)

            turn_span.set_attribute("thought",     thought[:500])
            turn_span.set_attribute("action_name", action["name"])
            turn_span.set_attribute("action_args", json.dumps(action["args"]))

            # Terminal: model emitted Finish[...]
            if action["name"] == "Finish":
                mlflow.update_current_trace(tags={
                    "steps_used":   str(step + 1),
                    "final_action": "Finish",
                    "terminated":   "finish",
                })
                return action["args"]["answer"]

            # Cycle detection — same (tool, args) twice
            call_key = (action["name"], json.dumps(action["args"], sort_keys=True))
            if call_key in seen:
                turn_span.set_attribute("cycle_detected", True)
                mlflow.update_current_trace(tags={
                    "terminated":      "cycle_detected",
                    "cycle_action":    action["name"],
                    "steps_used":      str(step + 1),
                })
                break
            seen.add(call_key)

            # Tool dispatch as its own span
            action_name = action["name"]
            with mlflow.start_span(name=f"tool::{action_name}",
                                    span_type=SpanType.TOOL) as tspan:
                tspan.set_attribute("tool_name", action_name)
                tspan.set_attribute("tool_args", json.dumps(action["args"]))
                try:
                    if action_name not in tools:
                        obs = (f"Tool '{action_name}' not found. "
                               f"Available: {list(tools.keys())}")
                        tspan.set_attribute("tool_not_found", True)
                    else:
                        obs = str(tools[action_name](**action["args"]))
                        errors = 0
                    tspan.set_attribute("obs_preview", str(obs)[:300])
                    tspan.set_outputs({"observation": str(obs)[:2000]})
                except Exception as e:
                    obs = f"Error: {e}"
                    errors += 1
                    tspan.set_attribute("error",       str(e)[:300])
                    tspan.set_attribute("error_count", errors)
                    if errors >= MAX_CONSEC_ERRORS:
                        mlflow.update_current_trace(tags={
                            "terminated":  "consec_error_cap",
                            "steps_used":  str(step + 1),
                            "last_error":  str(e)[:200],
                        })
                        break

            turn_span.set_attribute("observation_preview", str(obs)[:300])
            history.append({"role": "assistant", "content": msg})
            history.append({"role": "user", "content": f"Observation: {obs}"})

    # Non-convergence path (max_steps hit OR cycle/error break above already tagged)
    if mlflow.get_current_active_span() is not None:
        # Only set "terminated=max_steps" if no earlier break tagged it
        mlflow.update_current_trace(tags={
            "steps_used":      str(step + 1),
            "converged":       "false",
            "fallback_to_cot": "true",
        })
    return "ReAct did not converge — fell back to CoT (see trace)"
```

What appears in the MLflow UI:
- **Agent span tree** — every turn nested under `react_full`
- **Per-turn attributes** — `thought`, `action_name`, `action_args`, `observation_preview`
- **Tool spans** — one per call with `tool_args`, `obs_preview`, `error` if any
- **Trace tags** — `terminated` (`finish` / `cycle_detected` / `consec_error_cap` / `max_steps`), `steps_used`, `final_action`, `cycle_action` — all searchable

### Finding problem traces

```python
# Surface every run that aborted on a cycle.
df_cycles = mlflow.search_traces(
    experiment_names=["session6/react_oncall_bot"],
    filter_string="tags.terminated = 'cycle_detected'",
    max_results=100,
)
print(df_cycles["tags.cycle_action"].value_counts())
# -> e.g. tail_logs: 11, query_metrics: 4   (now you know which tool loops)

# Triage runs that didn't converge for any reason.
df_bad = mlflow.search_traces(
    experiment_names=["session6/react_oncall_bot"],
    filter_string="tags.converged = 'false' OR tags.terminated = 'consec_error_cap'",
    max_results=200,
)
print(df_bad[["trace_id", "tags.terminated", "tags.steps_used"]].head())
```

For 50-incident eval runs, group by `tags.terminated` and `tags.agent_version` to compare prompt revisions or tool-definition changes — every termination reason is a separate failure mode worth its own dashboard.

---

## When NOT to Use ReAct

| Situation | Why ReAct hurts | Use instead |
|-----------|----------------|-------------|
| Pure read-only computation (percentiles, sums, joins) | LLM is a bad calculator; tool-call overhead is wasted | **Program-of-Thought** — LLM writes code, interpreter computes |
| Latency budget < 500 ms | A 5-turn ReAct loop is 5–15 s easily | One-shot prompt or PoT |
| Reasoning model with native tool use (o1/o3, Claude Extended Thinking + tools, Gemini Thinking) | The model handles inter-tool reasoning internally; you'd pay twice | Direct tool-calling on the reasoning model |
| Task is genuinely single-tool, single-shot | A loop is overkill | One function-call request, no loop |
| You can't write the tools | Tool-less ReAct degenerates to CoT | CoT or chaining |

The reasoning-model exception is becoming the dominant 2025 consideration. OpenAI's o3/o4-mini cookbook explicitly says: *"Since these models are reasoning models and produce an internal chain of thought, they do not have to be explicitly prompted to plan and reason between tool calls."* If you're on a reasoning model and still wrapping the model in a hand-rolled ReAct prompt with `Thought:` parsing, you are paying twice. See [08-reasoning-models.md](08-reasoning-models.md).

---

## <a id="misconception-3"></a>Misconception 3 — "ReAct is just CoT + tools"

**The claim:** "Wire up a few tool definitions, append `Let's think step by step`, and you've got ReAct."

**Why it's wrong:** ReAct is a **loop**. The loop's stopping conditions are *the technique*, not boilerplate.

What engineers ship as "ReAct" but isn't:
- One-shot `tools=[...]` call without iteration → that's function calling, not ReAct.
- A `while True:` loop calling tools with no cycle detection → that's an outage waiting to happen.
- A loop without max-steps → that's a budget hole.
- A loop without consecutive-error cap → that's a retry storm.
- A loop without full-history passing → the "reasoning" is amnesiac and degenerates fast.

The **stopping machinery is not optional**. Every item in the hardening checklist is there because a real production system ate it. Treat the production-hardened loop above as the template; tune the knobs (`max_steps`, `max_consec_errors`), but never remove them.

The cleanest analogy (anchor §9.1): *"ReAct is a REPL where the LLM is the developer and your tools are the runtime."* A REPL with no `exit` command and no error handler isn't a tool — it's a hazard.

---

## Provider Notes — Tool Use APIs

ReAct predates structured tool-calling APIs. Modern providers expose tool-calling as a first-class concept, which often *replaces* hand-rolled `Thought: / Action:` parsing — the API handles the structured part for you.

| Provider | Tool API | Notes |
|----------|----------|-------|
| **OpenAI** | `tools=[{"type": "function", "function": {...}}]` + `tool_calls` in response | Use Responses API for o1/o3. Returns structured `function.name` and `function.arguments`. Don't add explicit `Thought:` formatting on reasoning models. |
| **Anthropic** | `tools=[{"name": ..., "input_schema": ...}]` + `tool_use` block | Native parsing — no string parsing of `Action:`. Pair with the **`think` tool** for in-trajectory deliberation: anthropic.com/engineering/claude-think-tool reports **+54% pass^1** on Tau-Bench airline domain. |
| **Google Gemini** | `tools=[Tool(function_declarations=[...])]` + `function_call` parts | Set `thinking_budget` for thinking models; don't add CoT/ReAct boilerplate on top. |

**When using native tool-calling APIs:**
- The LLM emits structured `tool_use` blocks — no fragile string parsing.
- The Observation step is the `tool_result` block you append before the next call.
- Cycle detection, max-steps, error caps — **still your job**. The API handles structure, not orchestration.

In other words: native tool-calling kills the `parse_react` function in the loop above, but every other line of the hardening machinery remains. The ReAct *pattern* — Thought → Action → Observation → repeat — is now expressed in provider-native primitives rather than text parsing.

---

## Editorial Notes

- **The REPL analogy is the most useful one (anchor §9.1).** Every engineer in the audience has used a REPL. ReAct as "an LLM in a REPL where your tools are the runtime" lands instantly. Then the misconception slide: a REPL without an `exit` is a hazard.
- **Walk through Demo D4 live.** The sample trace above is the right amount of complexity — three tool calls, one Finish, a real engineering conclusion. Engineers see the Thought / Action / Observation loop in action and understand why each step matters.
- **Show the hardening checklist explicitly.** Engineers think they "know" ReAct from blog posts. The hardening checklist is what production looks like; without it they ship infinite loops within their first sprint. Spend two minutes on each checklist item — the cycle detection one and the consecutive-error-cap one are the most non-obvious.
- **The reasoning-model exception.** Half the room will be on Claude 4 or o1/o3 within six months. The "don't wrap a reasoning model in ReAct boilerplate" rule is the single most important 2025 takeaway. Show OpenAI's verbatim guidance ("they do not have to be explicitly prompted to plan and reason between tool calls").
- **Read-only by default, write tools gated.** The on-call bot example is deliberate — `rollback` is in the tool *definition* but not exposed to the agent. Production agents should ship with this posture by default; write tools require human approval. Engineers immediately understand the safety implication.
- **Connect to Session 7.** "ReAct + structured tool-use + observability *is* a basic agent. Session 7 takes this from a single agent to multi-agent orchestration."

---

## → Session 7 preview

The ReAct loop in this wiki has hardcoded tools as Python functions. **Session 7** rebuilds the same loop with:
- Tool schemas via OpenAI function-calling / Anthropic tool use / **MCP** (Model Context Protocol)
- Tools as separate microservices (one per concern: metrics, logs, deploys, infra)
- Cycle detection + budget caps as middleware
- MLflow trace IDs propagated through HTTP headers for end-to-end observability

## → Session 8 preview

**Session 8** introduces **RAG** as the production alternative to Generated Knowledge (this technique's wiki: [04-generate-knowledge.md](./04-generate-knowledge.md)) — vector retrieval grounds the model with authoritative data instead of hallucinated parametric knowledge.

---

## References

| Source | Used for |
|--------|----------|
| Yao et al. 2022 — arXiv:2210.03629 (ICLR 2023) | ReAct mechanism, ALFWorld +34 pp, WebShop +10 pp, HotpotQA, FEVER |
| Anchor §2.4 | Definition, on-call incident bot example, production-hardened loop |
| Anchor §5.3 | Production hardening checklist |
| Anchor §5a.4 | MLflow agent-span observability code |
| Anchor §8 — Misconception 3 | "ReAct = CoT + tools" — stopping machinery not optional |
| Anchor §9.1 | "REPL where the LLM is the developer" analogy |
| Lilian Weng — LLM Powered Agents | [lilianweng.github.io/posts/2023-06-23-agent/](https://lilianweng.github.io/posts/2023-06-23-agent/) — best long-form overview |
| Anthropic `think` tool | [anthropic.com/engineering/claude-think-tool](https://www.anthropic.com/engineering/claude-think-tool) — +54% pass^1 Tau-Bench airline |
| OpenAI o3/o4-mini cookbook | [cookbook.openai.com/examples/o-series/o3o4-mini_prompting_guide](https://cookbook.openai.com/examples/o-series/o3o4-mini_prompting_guide) — reasoning + tool use |
| LearnPrompting — ReAct | [learnprompting.org/docs/advanced_applications/react](https://learnprompting.org/docs/advanced_applications/react) — diagram + walk-through |
| LangChain Agents docs | Reference ReAct implementation in a framework (not used directly here) |
| MLflow Tracing docs (3.10+) | `@mlflow.trace(name=, span_type=, attributes=)`, `mlflow.start_span`, `mlflow.update_current_trace`, `mlflow.search_traces`, `SpanType.{AGENT, CHAIN, LLM, TOOL}` |
