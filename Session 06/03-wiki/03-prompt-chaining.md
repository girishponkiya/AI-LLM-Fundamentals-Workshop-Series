# 03 — Prompt Chaining / Task Decomposition

**Overview:** Prompt chaining is the workhorse pattern of advanced prompt engineering — a statically-authored DAG of prompts where the output of step *N* becomes the input of step *N+1*. *You* decompose the task; you don't ask the LLM to do it (that's Least-to-Most). Every Session 5 anatomy lesson still applies — but it applies *per step*. This file covers the "one verb per call" splitting heuristic, the accuracy-floor math (62% is what you actually ship), validator + retry-with-feedback, error-propagation modes, a 3-step bug-triage chain with Pydantic, and MLflow chain tracing.

**Cross-references:** [01-landscape.md](01-landscape.md) — Chaining is Family 1 (Decomposition). [06-secondary-techniques.md](06-secondary-techniques.md) — Least-to-Most lets the LLM decompose; this is the auto-decomposition cousin. [07-decision-framework.md](07-decision-framework.md) — when to chain vs. compose ToT + PoT. [09-production.md](09-production.md) — caching, eval-per-step, dead-letter queues. [Session 5 / 02-anatomy.md](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/02-anatomy.md) — every chain step is still a 5-component prompt. [Session 5 / 07-production.md](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/07-production.md) — schema-validated JSON, system/user split, caching — applied per call.

---

## Definition

**Prompt chaining** — a statically-authored Directed Acyclic Graph (DAG) of LLM calls. Each node is a prompt with one job; each edge is a typed contract on the intermediate output.

```
[ input ]
    │
    ▼
┌───────────────────┐
│ Step 1: Extract   │   ← one verb per call
│  -> JSON signal   │   ← validator on output
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Step 2: Classify  │   ← gets typed input from Step 1
│  -> severity      │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Step 3: Respond   │   ← composes everything
│  -> draft reply   │
└─────────┬─────────┘
          ▼
       [ output ]
```

### Chaining vs. Least-to-Most

| | Prompt Chaining | Least-to-Most |
|--|----------------|---------------|
| Who decomposes? | **You** (build-time) | The LLM (run-time) |
| DAG shape | Static, known at deploy | Dynamic, varies per input |
| Validators | Tight (you wrote them) | Hard — sub-problem shape unknown |
| Best for | Repeatable enterprise pipelines | Compositional generalisation (SCAN-shaped) |
| Failure mode | Wrong split → silent rot | Bad decomposition cascades |

Default to chaining when the task structure is stable. Use Least-to-Most when each input has a genuinely different decomposition. See [06-secondary-techniques.md](06-secondary-techniques.md).

---

## The "One Verb Per Call" Splitting Heuristic

**The rule:** every prompt does exactly one thing. If you write "extract X *and* summarise Y *and* rate Z", that is three calls.

**The cut test:** can you write an assertion on the intermediate output (JSON schema, regex, enum check, type signature)? If yes, that's a chain boundary.

| Sentence smell | Where to cut |
|----------------|-------------|
| "Extract A, then format A as B" | Two calls: extract → format |
| "Classify and explain" | Two calls: classify → explain |
| "Summarise and rate" | Two calls: summarise → rate (rating now grades a fixed input) |
| "Find issues and propose fixes" | Two calls: find → fix-each |

Why each cut helps:
- **Per-step accuracy goes up** — single-verb prompts have tighter, more deterministic behaviour.
- **You get a validator boundary** — a JSON schema, regex, or Pydantic model that catches malformed outputs early.
- **Cost and latency drop on cache hits** — Step 1 often has identical inputs across many requests; cache it.
- **Failures get debuggable** — when something goes wrong at "step 3", you know exactly which call to inspect.

---

## The Accuracy-Floor Math — Why Your Pipeline Ships at 62%

Each chain step has an independent pass-rate. The end-to-end pass-rate is the **product**.

| Step | Pass rate |
|------|----------|
| 1. Extract bug signal | 0.95 |
| 2. Classify component | 0.92 |
| 3. Find duplicates | 0.88 |
| 4. Draft reply | 0.80 |
| **End-to-end** | **0.95 × 0.92 × 0.88 × 0.80 = 0.616 ≈ 62%** |

That weakest step (0.80) is dragging the whole chain. Fix Step 4 → 0.92, and end-to-end jumps to 71%. Add one more weak step and you're under 50%.

**Two implications you must internalise:**

1. **Per-step pass-rate analysis is non-negotiable.** Before tuning any prompt, instrument every step with a pass/fail metric. The weakest step is always the target — *never* the one you remember last touching.
2. **More steps = lower floor.** A 6-step chain at 0.95 per step ends at `0.95^6 = 73.5%`. A 10-step chain at the same per-step accuracy is `0.95^10 = 59.9%`. Splitting more aggressively buys per-step accuracy but spends pipeline accuracy. Find the elbow with measurement, not intuition.

Per-step pass-rate is the single most important metric to surface in MLflow. The Session 6 demo notebook D2 plots `step_1_pass_rate`, `step_2_pass_rate`, etc. as bar charts next to the cumulative product.

---

## Validator + Retry-With-Feedback (Micro-Self-Refine)

The core production pattern. On validation failure, you re-feed the validator's complaint back to the LLM as context — that's a single-round Self-Refine embedded in a chain step. Each attempt is recorded as its own child span so the MLflow UI shows exactly which retry passed.

```python
"""
chain_runner.py — production-shaped chain step runner with retries.
"""

import json
from typing import Callable, Any
import mlflow
from mlflow.entities import SpanType
from pydantic import BaseModel, ValidationError


class ChainStepError(Exception):
    def __init__(self, step_name: str, last_output: Any, last_error: str):
        self.step_name = step_name
        self.last_output = last_output
        self.last_error = last_error
        super().__init__(f"{step_name}: {last_error}")


def run_step(
    name: str,
    fn: Callable[[dict], str],          # (context) -> raw model output
    ctx: dict,
    schema: type[BaseModel] | None = None,
    retries: int = 2,
) -> dict:
    """
    Runs one chain step with validator + retry-with-feedback.

    On validation failure, the validator error is injected back into ctx
    under `_<name>_feedback`. The prompt template should consume that field
    on retries to apply the correction. Each attempt is logged as its own
    child span so the retry pattern is visible in the trace.
    """
    last_output, last_error = None, None
    for attempt in range(retries + 1):
        with mlflow.start_span(
            name=f"{name}_attempt_{attempt}",
            span_type=SpanType.LLM,
        ) as sp:
            sp.set_attribute("attempt", attempt)
            sp.set_attribute("has_feedback", f"_{name}_feedback" in ctx)

            raw = fn(ctx)
            last_output = raw
            sp.set_inputs({"context_keys": list(ctx.keys())})

            if schema is None:
                sp.set_attribute("validator", "none")
                sp.set_outputs({"raw": raw[:500]})
                ctx[name] = raw
                return ctx

            try:
                parsed = schema.model_validate_json(raw)
                ctx[name] = parsed.model_dump()
                ctx.pop(f"_{name}_feedback", None)
                sp.set_attribute("validator_pass", True)
                sp.set_outputs({"parsed": ctx[name]})
                return ctx
            except ValidationError as e:
                last_error = str(e)
                sp.set_attribute("validator_pass", False)
                sp.set_attribute("validator_error", last_error[:500])
                ctx[f"_{name}_feedback"] = (
                    f"Your previous output failed validation on attempt "
                    f"{attempt+1}:\n{last_error}\n\nReturn STRICT JSON matching "
                    f"the schema. No prose."
                )

    raise ChainStepError(name, last_output=last_output, last_error=last_error or "")
```

The prompt template for each step should include something like:

```python
PROMPT = """{system}

{previous_steps_context}

{validator_feedback_if_any}

Task: {task}

Output STRICT JSON matching the schema. No prose, no code fences.
"""
```

When the validator complains, the next call sees the exact failure mode. The model corrects on the second try in most cases. Beyond 2 retries, you are in a bug — escalate per the error-propagation strategy below.

---

## Error-Propagation Strategies (anchor §5.6)

Four strategies. Choose one explicitly per chain (and arguably per *step*):

| Strategy | When to use | Implementation |
|----------|------------|---------------|
| **Fail-fast** | Irreversible downstream actions (DB write, send-email, rollback) | `raise ChainStepError` immediately; let the caller decide |
| **Fallback chain** | Degraded-but-acceptable output acceptable | Run a simpler fallback function; mark `confidence=0.5` |
| **Self-heal** | Deterministic validation error (bad JSON, wrong enum) | Re-prompt with the validator's error as context (micro-Self-Refine, above) |
| **Graceful degrade** | Optional enrichment steps | Set `confidence=0.5`, mark output for human review, continue |

**Always** emit a structured trace event on every failure — `mlflow.log_event` or span attribute. The dead-letter queue and the MLflow trace together let you debug failures offline. Without both, you'll silently degrade in production for weeks before noticing.

```python
class ChainResult:
    def __init__(self, value, confidence: float, needs_human: bool = False):
        self.value = value
        self.confidence = confidence
        self.needs_human = needs_human


def run_step_resilient(name, fn, ctx, retries=2, schema=None, fallback_fn=None):
    try:
        ctx = run_step(name, fn, ctx, schema=schema, retries=retries)
        return ChainResult(ctx[name], confidence=1.0)
    except ChainStepError as e:
        # Annotate the active trace so failures are searchable in the UI.
        if mlflow.get_current_active_span() is not None:
            mlflow.update_current_trace(tags={
                f"{name}.failure":       e.last_error[:200],
                f"{name}.fallback_used": str(fallback_fn is not None),
            })
        if fallback_fn is not None:
            return ChainResult(fallback_fn(ctx), confidence=0.5)
        return ChainResult(None, confidence=0.0, needs_human=True)
```

---

## Engineering Example — 3-Step Bug-Triage Chain

Maps to Demo D2. A bug report comes in via webhook. The chain extracts structured signal, classifies severity + component, and drafts a triage reply for the on-call.

### Pydantic schemas

```python
from pydantic import BaseModel, Field
from typing import Literal


class ExtractedSignal(BaseModel):
    title: str
    steps_to_reproduce: list[str]
    expected_behaviour: str
    observed_behaviour: str
    error_messages: list[str] = Field(default_factory=list)
    stack_traces: list[str] = Field(default_factory=list)
    affected_versions: list[str] = Field(default_factory=list)


class Classification(BaseModel):
    severity: Literal["Critical", "High", "Medium", "Low"]
    component: Literal["api", "frontend", "db", "auth", "billing", "infra", "other"]
    confidence: Literal["high", "medium", "low"]
    is_duplicate_of: str | None = Field(
        default=None, description="Existing ticket ID if this looks like a duplicate"
    )


class TriageResponse(BaseModel):
    acknowledgement: str
    immediate_actions: list[str]
    requested_info: list[str] = Field(default_factory=list)
    assignee_suggestion: str
```

### Three step functions

```python
SYSTEM_EXTRACT = """You are a bug triage assistant. Extract structured signal
from a bug report. Return STRICT JSON matching the ExtractedSignal schema."""

SYSTEM_CLASSIFY = """You are a bug triage assistant. Given an extracted bug
signal, classify severity and component.

Severity definitions:
- Critical: data loss, security breach, system down for users
- High: major feature broken, no workaround
- Medium: feature partially broken, workaround exists
- Low: cosmetic, typo, minor inconvenience

Return STRICT JSON matching the Classification schema."""

SYSTEM_RESPOND = """You are an on-call engineer drafting a first response to
a reporter. Use the extracted signal and classification to draft a triage reply.
Tone: factual, blameless, action-oriented. Return STRICT JSON matching the
TriageResponse schema."""


def extract_step(ctx: dict) -> str:
    fb = ctx.get("_extract_feedback", "")
    user = f"{fb}\n\nBug report:\n{ctx['raw_report']}"
    return llm(system=SYSTEM_EXTRACT, user=user)


def classify_step(ctx: dict) -> str:
    fb = ctx.get("_classify_feedback", "")
    user = f"{fb}\n\nExtracted signal:\n{json.dumps(ctx['extract'], indent=2)}"
    return llm(system=SYSTEM_CLASSIFY, user=user)


def respond_step(ctx: dict) -> str:
    fb = ctx.get("_respond_feedback", "")
    user = (
        f"{fb}\n\nExtracted signal:\n{json.dumps(ctx['extract'], indent=2)}\n\n"
        f"Classification:\n{json.dumps(ctx['classify'], indent=2)}"
    )
    return llm(system=SYSTEM_RESPOND, user=user)


def triage_chain(raw_report: str) -> TriageResponse:
    ctx = {"raw_report": raw_report}
    ctx = run_step("extract",  extract_step,  ctx, schema=ExtractedSignal)
    ctx = run_step("classify", classify_step, ctx, schema=Classification)
    ctx = run_step("respond",  respond_step,  ctx, schema=TriageResponse)
    return TriageResponse.model_validate(ctx["respond"])
```

Three calls, three validators, two retries each. The validator-feedback loop catches the most common failure (bad JSON formatting, missing field) automatically.

---

## MLflow Tracing for Chains (MLflow 3.10+)

From anchor §5a.1. One `@mlflow.trace`-decorated outer function with `attributes=` capturing the chain version, one decorated sub-step per node. The MLflow UI renders the chain as a span tree with per-step latency, tokens, and pass/fail. Tags on the active trace let you slice the eval set by step pass-rate.

```python
import time
import mlflow
from mlflow.entities import SpanType

mlflow.openai.autolog()                        # auto-traces every OpenAI call
mlflow.set_experiment("session6/bug_triage_chain")

CHAIN_VERSION = "v3.2"
MODEL         = "claude-sonnet-4-6"


@mlflow.trace(
    name="bug_triage",
    span_type=SpanType.CHAIN,
    attributes={"chain_version": CHAIN_VERSION, "model": MODEL,
                "n_steps": 3},
)
def triage(raw_report: str, ticket_id: str = "unknown") -> dict:
    ctx = {"raw_report": raw_report}
    step_pass = {}

    try:
        ctx = traced_extract(ctx);  step_pass["extract"]  = 1
    except ChainStepError:           step_pass["extract"]  = 0; raise
    try:
        ctx = traced_classify(ctx); step_pass["classify"] = 1
    except ChainStepError:           step_pass["classify"] = 0; raise
    try:
        ctx = traced_respond(ctx);  step_pass["respond"]  = 1
    except ChainStepError:           step_pass["respond"]  = 0; raise

    # Annotate the trace with chain-level outcomes — searchable across runs.
    mlflow.update_current_trace(tags={
        "ticket_id":      ticket_id,
        "severity":       ctx["classify"]["severity"],
        "component":      ctx["classify"]["component"],
        "step_pass_rates": json.dumps(step_pass),
        "chain_version":  CHAIN_VERSION,
    })
    return ctx["respond"]


@mlflow.trace(name="extract_signal", span_type=SpanType.LLM,
              attributes={"prompt": "triage_extract", "schema": "ExtractedSignal"})
def traced_extract(ctx):
    t0 = time.time()
    out = run_step("extract", extract_step, ctx, schema=ExtractedSignal)
    mlflow.log_metric("extract.latency_ms", (time.time() - t0) * 1000)
    return out


@mlflow.trace(name="classify_bug", span_type=SpanType.LLM,
              attributes={"prompt": "triage_classify", "schema": "Classification"})
def traced_classify(ctx):
    t0 = time.time()
    out = run_step("classify", classify_step, ctx, schema=Classification)
    mlflow.log_metric("classify.latency_ms", (time.time() - t0) * 1000)
    return out


@mlflow.trace(name="draft_response", span_type=SpanType.LLM,
              attributes={"prompt": "triage_respond", "schema": "TriageResponse"})
def traced_respond(ctx):
    t0 = time.time()
    out = run_step("respond", respond_step, ctx, schema=TriageResponse)
    mlflow.log_metric("respond.latency_ms", (time.time() - t0) * 1000)
    return out


with mlflow.start_run(run_name=f"triage_{CHAIN_VERSION}"):
    mlflow.log_param("prompt_version", CHAIN_VERSION)
    mlflow.log_param("model", MODEL)
    result = triage(bug_report_text, ticket_id="BUG-9421")
```

To compute per-step pass-rate across a 50-report eval set, query the traces:

```python
df = mlflow.search_traces(
    experiment_names=["session6/bug_triage_chain"],
    filter_string=f"tags.chain_version = '{CHAIN_VERSION}'",
    max_results=500,
)
# tags.step_pass_rates is a JSON string like {"extract":1,"classify":1,"respond":0}
rates = df["tags.step_pass_rates"].dropna().map(json.loads)
import pandas as pd
print(pd.DataFrame(list(rates)).mean())   # per-step pass-rate, sorted by step
```

---

## Versioning Chain Prompts in the Prompt Registry

Every step in the chain is a *separate* registered prompt with its own version history. This lets you bump one step (e.g. `triage_respond v4` for a softer tone) without disturbing the others, and gives you a deterministic way to roll back when a tagged trace shows regression.

```python
import mlflow

# --- Step 1: register the extract prompt ------------------------------------
EXTRACT_TEMPLATE = """You are a bug triage assistant. Extract structured signal
from a bug report. Return STRICT JSON matching the ExtractedSignal schema.

{{ validator_feedback }}

Bug report:
{{ raw_report }}
"""

pv_extract = mlflow.genai.register_prompt(
    name="triage_extract",
    template=EXTRACT_TEMPLATE,
    commit_message="v3 — added validator_feedback slot for retry-with-feedback",
    tags={"chain": "bug_triage", "step": "1_extract", "schema": "ExtractedSignal"},
)

# --- Step 2: classify -------------------------------------------------------
CLASSIFY_TEMPLATE = """You are a bug triage assistant. Given an extracted bug
signal, classify severity and component.

Severity rubric:
- Critical: data loss, security breach, system down
- High:     major feature broken, no workaround
- Medium:   feature partially broken, workaround exists
- Low:      cosmetic, typo, minor inconvenience

{{ validator_feedback }}

Extracted signal:
{{ extract }}

Return STRICT JSON matching the Classification schema.
"""

pv_classify = mlflow.genai.register_prompt(
    name="triage_classify",
    template=CLASSIFY_TEMPLATE,
    commit_message="v2 — sharpened severity rubric (Critical = data loss only)",
    tags={"chain": "bug_triage", "step": "2_classify", "schema": "Classification"},
)

# --- Step 3: respond --------------------------------------------------------
RESPOND_TEMPLATE = """You are an on-call engineer drafting a first response.
Use the extracted signal and classification to draft a triage reply.
Tone: factual, blameless, action-oriented.

{{ validator_feedback }}

Extracted signal:
{{ extract }}

Classification:
{{ classify }}

Return STRICT JSON matching the TriageResponse schema.
"""

pv_respond = mlflow.genai.register_prompt(
    name="triage_respond",
    template=RESPOND_TEMPLATE,
    commit_message="v3 — explicit blameless tone, drop hedging adjectives",
    tags={"chain": "bug_triage", "step": "3_respond", "schema": "TriageResponse"},
)

print(pv_extract.version, pv_classify.version, pv_respond.version)
# -> e.g. 3 2 3
```

Then the chain *loads* the pinned versions at request time. Pinning by URI (`prompts:/<name>/<version>`) makes the chain build deterministic; the trace records which versions composed the answer.

```python
# Load specific versions of each step's prompt.
EXTRACT_PROMPT  = mlflow.genai.load_prompt("prompts:/triage_extract/3")
CLASSIFY_PROMPT = mlflow.genai.load_prompt("prompts:/triage_classify/2")
RESPOND_PROMPT  = mlflow.genai.load_prompt("prompts:/triage_respond/3")


def extract_step(ctx: dict) -> str:
    rendered = EXTRACT_PROMPT.format(
        raw_report=ctx["raw_report"],
        validator_feedback=ctx.get("_extract_feedback", ""),
    )
    return llm(system="", user=rendered)


def classify_step(ctx: dict) -> str:
    rendered = CLASSIFY_PROMPT.format(
        extract=json.dumps(ctx["extract"], indent=2),
        validator_feedback=ctx.get("_classify_feedback", ""),
    )
    return llm(system="", user=rendered)


def respond_step(ctx: dict) -> str:
    rendered = RESPOND_PROMPT.format(
        extract=json.dumps(ctx["extract"],  indent=2),
        classify=json.dumps(ctx["classify"], indent=2),
        validator_feedback=ctx.get("_respond_feedback", ""),
    )
    return llm(system="", user=rendered)


# Record the pinned versions on every trace for full reproducibility.
@mlflow.trace(name="bug_triage", span_type=SpanType.CHAIN,
              attributes={"chain_version": CHAIN_VERSION})
def triage_versioned(raw_report: str) -> dict:
    mlflow.update_current_trace(tags={
        "prompt_extract":  f"triage_extract/{EXTRACT_PROMPT.version}",
        "prompt_classify": f"triage_classify/{CLASSIFY_PROMPT.version}",
        "prompt_respond":  f"triage_respond/{RESPOND_PROMPT.version}",
    })
    ctx = {"raw_report": raw_report}
    ctx = traced_extract(ctx)
    ctx = traced_classify(ctx)
    ctx = traced_respond(ctx)
    return ctx["respond"]
```

Three registered prompts, three versions composed by one chain. To A/B a new `respond` prompt against production: register `triage_respond/4`, deploy a branch that loads `/4`, compare `tags.severity` distributions across the two `chain_version` tag values.

---

## Caching Per Step (anchor §5.5)

Each chain step is a cache candidate. The right cache key depends on the step's job.

| Cache target | Key | Why |
|--------------|-----|-----|
| Step prompt + input | `hash(template_version + model + step_inputs)` | Identical input → identical output at temp=0 |
| Step 1 "extract" specifically | `hash(raw_report_normalized)` | Same bug report re-submitted → same signal |
| LLM-as-judge scores in the chain | `hash(state + judge_model)` | Judge is deterministic at temp=0 |
| **Never cache** | Self-Refine intermediates | By design each iteration must differ |

Use semantic cache (vector similarity) only at **chain boundaries**, not inside tight loops. False-positive semantic matches *compound* across steps — a near-miss on Step 1 produces wrong inputs to Step 2, and the validator may not catch a plausibly-wrong-but-near input.

**Anthropic's prompt caching:** the system prompt of each step (the long, stable part) is a perfect candidate for Anthropic's 90% cost reduction on cache hits. Pin your system prompt; vary only the user message.

---

## <a id="misconception-4"></a>Misconception 4 — "Chains are just microservices"

**The claim:** "A chain is N services with typed contracts. I'll just add retries and circuit breakers like any other distributed system."

**Why it's wrong:** every chain step is **non-deterministic**. A microservice at `99.9%` is "five nines" territory; an LLM step at `99.9%` does not exist. Treat every step as a `~95%` SLO black box and design accordingly.

What microservices intuition gets right:
- Retries, timeouts, circuit breakers — yes, apply them.
- Typed contracts (JSON schema, Pydantic) — yes, mandatory.
- Dead-letter queues — yes, every chain step is a DLQ candidate.

What microservices intuition gets *wrong*:
- "Retry-on-error gets you back to 99.9% per step" — false. The model may consistently fail on the same input. Three retries of the same call may produce three different wrong outputs.
- "If the contract type-checks, the data is correct" — false. The model can produce schema-valid garbage (correct types, semantically nonsense). You need **eval sets per step**, not just schema validation.
- "Compose two services at 99% and you get 98%" — true for microservices. For chains at 0.95 each, you get 0.62 at 4 deep. The exponent compounds *much* faster than people expect because per-step accuracy starts so much lower.

The fix is the same as the Session 5 anatomy lesson, applied per call: clear role, tight task, validator on output, per-step eval set, schema-validated JSON. Plus the chain-specific addition: per-step pass-rate analysis and explicit error-propagation strategy.

---

## When NOT to Chain

| Situation | Why chaining hurts | Use instead |
|-----------|--------------------|------------|
| Each input demands a different decomposition | Static DAG can't adapt; bad fit | Least-to-Most (LLM decomposes per-input) |
| Subtasks can run in parallel | Serial latency = sum of step latencies | Skeleton-of-Thought (parallel section expansion) |
| One LLM call already meets the SLO | Extra calls add cost + failure modes for no gain | Stay with one call (Session 5 anatomy) |
| Numeric / tabular computation in the middle | Floor drops fast — LLMs miscompute | Drop in a PoT step: LLM writes code, interpreter runs it |
| Sub-task needs current data the model doesn't have | Step will hallucinate; downstream poisoned | Convert that step to a ReAct tool call |
| Reasoning model with native tool use | The model handles decomposition internally; you'd pay twice | Direct prompt + tools (see [08-reasoning-models.md](08-reasoning-models.md)) |

The most common bad chain: a 7-step pipeline where one of the middle steps could have been a `pandas.groupby` written by PoT. The chain's accuracy floor is dragged below 60% by the LLM trying to compute percentiles in prose.

---

## Editorial Notes

- **The 0.95^4 = 0.62 slide is the most clarifying moment of the chaining lecture.** Engineers used to microservices arithmetic don't internalise that "95% per step is not very good" until the multiplication hits them.
- **Per-step pass-rate analysis** is the practitioner skill of the session. Show MLflow with three bars: `step_1_pass`, `step_2_pass`, `step_3_pass`. Ask the audience which step to fix. They always point at the lowest bar. That's the right instinct.
- **The "one verb per call" splitting heuristic** is the cleanest rule in this whole session. Engineers use it within days of learning it.
- **Validator + retry-with-feedback** is a micro-Self-Refine — call this out explicitly. It connects chaining to self-correction (Family 3) without leaving the chain pattern.
- **The microservices analogy is dangerous because it's *almost* right.** Use the misconception slide to spend two minutes on what transfers and what breaks. Engineers walk away with a much sharper mental model than if you just said "chains are like distributed systems."
- **Anchor §9.1's analogy:** "Each call is a microservice with a 95% SLA — design for retries and circuit breakers." Use it, but pair it with the misconception above so they understand the limit.

---

## → Session 7 preview

The chain in this wiki runs locally as a notebook function. In **Session 7** we'll wrap exactly this DAG as a FastAPI endpoint, expose each tool as an OpenAI function-calling schema (or MCP tool), and extend MLflow Tracing across HTTP service boundaries. The accuracy floor math (slide 8) and per-step pass-rate analysis (slide 8) become production-grade SLO metrics.

---

## References

| Source | Used for |
|--------|----------|
| Anthropic Cookbook — prompt chaining notebooks | Reference patterns; system-prompt caching per step |
| Anchor §2.2 | Definition, one-verb-per-call heuristic, accuracy floor math |
| Anchor §3.3 (full RCA pipeline) | End-to-end chain example with MLflow tracing |
| Anchor §5.1, §5.5, §5.6 | Fail-soft pattern, cache strategy, error-propagation table |
| Anchor §5a.1 | MLflow `@mlflow.trace` chain pattern |
| Anchor §8 — Misconception 4 | Non-determinism warning vs microservices intuition |
| Pydantic v2 docs | `BaseModel`, `model_validate_json`, `ValidationError` |
| Eugene Yan — eugeneyan.com/writing/llm-patterns/ | Production chain patterns, per-step eval |
| LangChain LCEL docs | Reference chain-orchestration syntax (not used directly here) |
| MLflow Tracing docs (3.10+) | `@mlflow.trace(name=, span_type=, attributes=)`, `mlflow.start_span`, `mlflow.update_current_trace`, `mlflow.search_traces`, `SpanType.{CHAIN, LLM}`, autolog |
| MLflow Prompt Registry (3.10+) | `mlflow.genai.register_prompt`, `mlflow.genai.load_prompt("prompts:/<name>/<version>")` for per-step version pinning |
