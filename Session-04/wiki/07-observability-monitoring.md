# Observability & Monitoring

Tracing, metrics, drift detection, alerting, and closing the feedback loop from production back to evaluation.

> This file covers *what you observe and how*. For deployment and infrastructure of these tools, see [Production Infrastructure](./08-production-infrastructure.md).

---

## Langfuse v3

**Platform:** v3.158+, Python SDK v4.0 (OTel-based), JS/TS SDK v5.x
**License:** MIT (self-hosted core)

Langfuse is the primary LLMOps platform for this stack — all-in-one tracing, cost tracking, prompt management, and evaluation in a single tool.

### Tracing Architecture

Data is organised as: **Sessions → Traces → Observations** (Generation, Span, Event).

The ingestion pipeline:
```
SDKs → batch events → HTTP/OTel → Langfuse Web API
    → raw event uploaded to S3/MinIO
    → reference queued in Redis/BullMQ
    → Langfuse Worker processes + enriches
    → flushed to ClickHouse (analytics)
    → PostgreSQL (transactional metadata)
```

This architecture handles traffic spikes gracefully — events are queued, not dropped. The trade-off is **eventual consistency**: scores and aggregates may lag a few seconds behind ingestion.

**Instrumentation** via the `@observe()` decorator:

```python
from langfuse import get_client, observe

langfuse = get_client()

@observe()
def my_rag_pipeline(query: str):
    docs = retrieve(query)       # auto-traced as a span
    response = generate(docs)    # auto-traced as a generation
    return response
```

Each `@observe()` call creates a span with automatic start/end timing, input/output capture, and parent-child nesting.

---

### Cost Tracking

Langfuse automatically calculates costs when:
1. Usage data (token counts) is ingested with the trace
2. A matching model definition with prices exists

It ships with **predefined prices for OpenAI, Anthropic, and Google** models. Custom models are defined at the project level.

**Pricing tiers** (added Dec 2025) support context-dependent pricing — e.g., Gemini's tiered pricing based on total token length.

The **Metrics API** enables programmatic cost queries with aggregation by model, time granularity, user, and feature tag. This is what you'd feed into Grafana dashboards or budget alert pipelines.

---

### Prompt Versioning

Each prompt update creates an **immutable version** (1, 2, 3, …). **Labels** are mutable pointers to versions:

```
Prompt: "You are a support assistant..."
  ├── Version 1  ← staging
  ├── Version 2  ← (no label)
  └── Version 3  ← production, latest
```

Reassigning the `production` label provides **instant rollback** with no deployment required. Prompts support `{{variable}}` syntax for compilation and can reference other prompts (composability).

> **This is the canonical prompt management tool in this stack.** Don't store prompt versions in code constants — store them in Langfuse and reference by label so you can roll back without a deployment.

---

### Evaluation Methods

Three evaluation paths, usable simultaneously:

**1. LLM-as-a-Judge** — configured in UI, runs automatically on new traces. Full debug tracing included so you can see why the judge scored as it did.

**2. Human annotation queues** — domain experts review traces with `ScoreConfigs`. Supports structured annotation with predefined categories.

**3. SDK-based programmatic scoring** — push scores from any external pipeline:

```python
langfuse.score(
    trace_id=trace_id,
    name="faithfulness",
    value=0.92,
    data_type="NUMERIC",
    comment="RAGAS faithfulness score"
)
```

Score types: `NUMERIC` (float), `CATEGORICAL` (string), `BOOLEAN`.

Score analytics include **Pearson/Spearman correlation**, **Cohen's Kappa**, **F1**, **MAE**, and **RMSE** — allowing you to measure agreement between automated and human scores.

> For Langfuse deployment specs and pricing tiers, see [Production Infrastructure → Langfuse Deployment](./08-production-infrastructure.md#langfuse-deployment).

---

## OpenTelemetry GenAI Semantic Conventions (v1.40.0)

OTel provides the **standard attribute vocabulary** for LLM spans. Using these attributes ensures your traces work with any OTel-compatible backend (Langfuse, Phoenix, Jaeger, Grafana Tempo).

**Key span attributes:**

| Attribute | Example Value | Purpose |
|---|---|---|
| `gen_ai.operation.name` | `"chat"`, `"embeddings"` | Type of operation |
| `gen_ai.request.model` | `"gpt-4o"` | Requested model |
| `gen_ai.response.model` | `"gpt-4o-2024-11-20"` | Actual model used (may differ) |
| `gen_ai.provider.name` | `"openai"`, `"anthropic"` | Provider |
| `gen_ai.usage.input_tokens` | `1024` | Prompt tokens |
| `gen_ai.usage.output_tokens` | `256` | Completion tokens |

**Span naming convention:** `{operation} {model}` → e.g., `"chat gpt-4o"`, `"embeddings text-embedding-3-small"`

**Content capture** (opt-in, disabled by default for privacy):
```bash
OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true
```

**Key metrics:**
- `gen_ai.client.token.usage` — histogram; bucket boundaries from 1 to 67M tokens
- `gen_ai.client.operation.duration` — histogram of request duration

---

## Performance Metrics: TTFT, TPOT, Goodput

The three metrics that matter most for LLM performance SLOs:

| Metric | Definition | Why it matters |
|---|---|---|
| **TTFT** — Time to First Token | Wall clock from request to first streamed token | User perceived latency for streaming UIs |
| **TPOT** — Time Per Output Token | Average time between successive output tokens | Determines streaming smoothness |
| **Goodput** | Requests per second meeting **all** SLO constraints | Unlike raw throughput, this counts only successful requests |

> **Goodput is the correct production SLO metric.** High throughput with 40% of requests exceeding latency SLOs = low goodput. Always track P50/P95/P99 percentiles alongside the mean.

The full monitoring stack across five categories:
- **Performance:** TTFT, TPOT, E2E latency, tokens/sec, P50/P95/P99
- **Cost:** Per-request, per-1K tokens, daily/monthly by model/user/feature
- **Quality:** LLM-as-judge scores, user feedback signals, hallucination detection rate
- **Safety:** Guardrail trigger rate, toxicity scores, PII detection, injection attempt rate
- **Business:** Task completion rate, NPS/CSAT, retry/regeneration rate

---

## Drift Detection

When user behaviour changes or the world changes, your model degrades silently. Detecting drift in LLM systems requires tracking four types:

| Drift Type | What Changes | Example |
|---|---|---|
| **Input drift** | Statistical change in incoming prompts | Users start asking about a new product feature |
| **Output drift** | Change in response patterns | Response length distribution shifts after a model update |
| **Concept drift** | Relationship between inputs and desired outputs changes | "Formal tone" requests now expect different formality levels |
| **Embedding drift** | Shifts in vector space distribution | New topic domain appears in production queries |

### Detecting It: Wasserstein Distance

The traditional **Kolmogorov-Smirnov (KS) test** is ineffective for high-dimensional embeddings. Use **Wasserstein distance** (Earth Mover's Distance) instead — it measures the geometric divergence between distributions and handles the continuous, high-dimensional nature of embedding spaces.

> **Threshold:** PSI > 0.2 indicates significant drift. PSI (Population Stability Index) is a common companion metric.

**Evidently AI** is the standard tool for batch drift detection; it runs entirely offline (pure Python).

### Canary Prompts

A simple, powerful technique: maintain a set of **fixed, unchanging prompts** that you run against production models on a schedule. Response variations on these fixed inputs surface behavioural drift — shifts in reasoning, tone, or confidence that statistical metrics might miss.

Example: `"Summarise the following in exactly 3 bullet points: [fixed text]"` — if the model starts returning 4 bullets or ignoring the length constraint, your canary fires.

---

## Alerting Without Fatigue

PagerDuty 2025 data: the average on-call engineer receives **~50 alerts/week**, but only **2–5% require action**. Poorly designed alerting trains engineers to ignore pages.

**Principles for actionable alerting:**

| Principle | How to apply |
|---|---|
| **Multi-signal alerts** | Fire only when latency P95 rises AND grounding falls AND hallucination rate increases simultaneously — not any single signal alone |
| **Adaptive thresholds** | Account for known patterns (traffic spikes at 9am, lower quality scores on weekends) |
| **Tiered severity** | P1 = customer-blocking; P2 = degraded quality; P3 = minor regression |
| **Alert grouping** | Group related signals into a single incident |

**AlertGuardian** (2025 research): using LLM+graph models to classify alerts achieved **93.8–95.5% alert reduction** while maintaining 98.5% action accuracy.

---

## OpenLIT SDK

For teams that want OTel auto-instrumentation without manual span creation:

```python
import openlit

openlit.init()   # auto-instruments OpenAI, Anthropic, LangChain, etc.
```

Exports:
- **Traces** → Jaeger
- **Metrics** → Prometheus
- **Visualisation** → Grafana

OpenLIT is the simplest path to a standards-compliant observability setup. It instruments LLM calls automatically using the OTel GenAI Semantic Conventions, so you get the standard attributes without writing a single span manually.

---

## Enterprise Tooling Comparison

| Tool | Category | Strength | Open Source |
|---|---|---|---|
| **Langfuse** | All-in-one LLMOps | Deep tracing, prompt management, team collaboration | Yes (MIT) |
| **Arize Phoenix** | Evaluation + Observability | OTel-native, RAG retrieval metrics, Phoenix Evals | Yes (ELv2) |
| **Promptfoo** | Security + CI/CD | Red-teaming, CI/CD integration, YAML-driven local testing | Yes |
| **Datadog / New Relic** | Enterprise APM | Integrating LLM tracking into existing enterprise cloud infra | No |

For most teams: **Langfuse for production tracing + Phoenix for evaluation datasets + Promptfoo for CI/CD red-teaming** is the recommended stack.

---

## Closing the Loop: UI Feedback

User signals are the highest-quality signal for improving your golden dataset — they represent real production failures that automated evals miss.

**Progressive disclosure pattern:**

```
Step 1: Low friction  →  thumbs up / thumbs down (inline, one click)
Step 2: On thumbs down  →  free-form text field ("What went wrong?")
Step 3: Optional  →  categorical dropdowns ("Hallucination / Off-topic / Tone / Other")
Step 4: Route  →  all negative feedback + context → evaluation pipeline
```

The progressive disclosure approach maximises feedback volume (most users will click thumbs down) while capturing rich signal from the minority who engage further.

---

## Related Topics

- [Foundations](./01-foundations.md) — EDD loop: production failures feed back into golden datasets
- [Evaluation Metrics](./02-evaluation-metrics.md) — the scores being tracked (faithfulness, TTFT, etc.)
- [Evaluation Frameworks](./03-evaluation-frameworks.md) — Langfuse LLM-as-judge and Phoenix server-side evaluation
- [Production Infrastructure](./08-production-infrastructure.md) — deployment of Langfuse, Prometheus, Grafana, and the complete self-hosted stack
