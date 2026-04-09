# Session 4 Wiki: LLM Evaluation, Testing, and Monitoring

A production-focused reference for evaluating, testing, guarding, and monitoring LLM applications. 97 topics organised across 8 themes.

---

## Navigation

| # | Theme | What it covers |
|---|---|---|
| 1 | [Foundations](./01-foundations.md) | Why LLM evaluation ≠ unit testing; EDD methodology; golden dataset design and bootstrapping |
| 2 | [Evaluation Metrics](./02-evaluation-metrics.md) | BLEU, ROUGE, METEOR, BERTScore, G-Eval, RAGAS metrics, LLM judge biases, inter-annotator agreement, Pass@K |
| 3 | [Evaluation Frameworks](./03-evaluation-frameworks.md) | Pydantic AI Evals (span-based), Phoenix Evals, RAGAS API, DeepEval |
| 4 | [Testing & CI/CD](./04-testing-cicd.md) | Quality gate architecture, Promptfoo, GitHub Actions, cost management, A/B testing |
| 5 | [Guardrails & Safety](./05-guardrails-safety.md) | Guardrails AI, Outlines, NeMo, Guidance, Llama Guard 3, HHEM, SelfCheckGPT, prompt injection |
| 6 | [Software Resilience](./06-software-resilience.md) | Tenacity retries, circuit breaker pattern, semantic caching |
| 7 | [Observability & Monitoring](./07-observability-monitoring.md) | Langfuse v3, OTel conventions, drift detection, alerting, tooling comparison, feedback loop |
| 8 | [Production Infrastructure](./08-production-infrastructure.md) | LiteLLM, Langfuse deployment, MLflow, air-gapped deployment, compliance |

---

## How to Read This Wiki

Each theme file is **self-contained** — readable independently without prior context. Topics covered in detail in one file are **briefly described with a cross-link** in others. Follow links to go deeper; they always point to the authoritative home of a concept.

---

## Mental Model: How the Themes Connect

```
                    ┌──────────────────────┐
                    │   1. FOUNDATIONS     │
                    │  EDD · Golden Data   │
                    │  Non-determinism     │
                    └──────────┬───────────┘
                               │ defines "good"
              ┌────────────────▼────────────────┐
              │         2. METRICS              │
              │  BLEU · ROUGE · BERTScore       │
              │  G-Eval · RAGAS · Pass@K        │
              └────────────────┬────────────────┘
                               │ implemented by
              ┌────────────────▼─────────────────┐
              │       3. FRAMEWORKS              │
              │  Pydantic AI · Phoenix           │
              │  RAGAS API · DeepEval            │
              └────────────────┬─────────────────┘
                               │ enforced by
              ┌────────────────▼─────────────────┐
              │         4. CI/CD                 │
              │  Promptfoo · Quality gates       │
              │  GitHub Actions · Cost mgmt      │
              └────────────────┬─────────────────┘
                               │ deployed with
              ┌────────────────▼─────────────────┐
              │    8. PRODUCTION INFRA           │
              │  LiteLLM · Langfuse deploy       │
              │  MLflow · Air-gapped · Compliance│
              └────────────────┬─────────────────┘
                               │ observed by
              ┌────────────────▼─────────────────┐
              │    7. OBSERVABILITY              │
              │  Langfuse · OTel · Drift         │
              │  Alerting · Feedback loop        │
              └──────────────────────────────────┘

   Cross-cutting concerns (apply everywhere):
   ┌────────────────────┐   ┌───────────────────────┐
   │  5. GUARDRAILS     │   │  6. RESILIENCE        │
   │  Input/output      │   │  Retries · Circuit    │
   │  validation        │   │  breaker · Caching    │
   │  Hallucination     │   │                       │
   │  Prompt injection  │   │                       │
   └────────────────────┘   └───────────────────────┘
```

Themes 1→4 form a **development pipeline** (define → measure → implement → enforce). Themes 7 and 8 are **production concerns** (observe → deploy). Themes 5 and 6 are **cross-cutting** — they apply at every layer.

---

## Quick Reference: Key Numbers & Thresholds

### Quality Thresholds (CI/CD gates)

| Metric | Minimum threshold | Notes |
|---|---|---|
| Faithfulness (RAGAS) | ≥ 0.85 | Below this = hallucination risk |
| Context Precision (RAGAS) | ≥ 0.80 | Below this = poor retrieval ranking |
| Toxicity | 0.0 | Hard gate — any toxicity fails |
| G-Eval / LLM judge | ≥ 0.70 | Task-dependent; set per rubric |
| Cohen's Kappa (human annotation) | ≥ 0.70 | AI-human agreement threshold |

### Performance Benchmarks

| Metric | Value | Context |
|---|---|---|
| G-Eval Spearman ρ | 0.514 | vs BLEU 0.39 on SummEval |
| METEOR human correlation | 0.964 | vs BLEU 0.817 |
| Phoenix hallucination precision | 0.93 | Recall 0.72 (28% miss rate) |
| HHEM vs GPT-3.5 F1 | 1.5× better | RAGTruth Summarisation |
| HHEM inference latency | ~0.6s | Consumer GPU vs 35s RAGAS+GPT-4 |
| Pass@1 SOTA (HumanEval) | ≈ 0.85+ | Code generation |
| Semantic cache cost reduction | 68.8% | At cosine threshold ~0.8 |
| Promptfoo CI gate | 85% pass rate | `fail-on-threshold: 85` |
| Krippendorff's α reliable | ≥ 0.80 | Tentative: 0.67–0.79 |

### Drift Detection

| Signal | Threshold | Action |
|---|---|---|
| PSI | > 0.2 | Significant drift — investigate |
| Embedding Wasserstein distance | Baseline +2σ | Retrain or re-evaluate |
| Canary prompt deviation | > 15% response change | Alert P2 |

### Cost Benchmarks (CI/CD)

| Setup | Cost per 50-case run |
|---|---|
| GPT-4 judge | ~$1–3 |
| GPT-4o-mini judge | ~$0.02 |
| Cached repeat run | ~$0.00 |

### Alerting

| Metric | Benchmark |
|---|---|
| Alerts/week per engineer (industry) | ~50 |
| Actionable alert rate | 2–5% |
| AlertGuardian reduction | 93.8–95.5% fewer alerts |
| AlertGuardian action accuracy maintained | 98.5% |

---

## Tool Quick-Pick Guide

**"I need to evaluate a RAG pipeline"**
→ [RAGAS](./03-evaluation-frameworks.md#ragas) for metrics + [Phoenix Evals](./03-evaluation-frameworks.md#phoenix-evals) for production tracing

**"I need LLM testing in pytest"**
→ [DeepEval](./03-evaluation-frameworks.md#deepeval)

**"I need to test prompts in CI/CD"**
→ [Promptfoo](./04-testing-cicd.md#promptfoo)

**"I need to red-team my application"**
→ [Promptfoo red teaming plugins](./04-testing-cicd.md#automated-red-teaming)

**"I need to validate JSON output structure"**
→ [Outlines](./05-guardrails-safety.md#outlines) (local models) or [JSON strict mode](./05-guardrails-safety.md#json-strict-mode) (API providers)

**"I need to detect hallucinations cheaply"**
→ [HHEM](./05-guardrails-safety.md#hhem) (fast, local) → escalate to [RAGAS Faithfulness](./03-evaluation-frameworks.md#ragas) (expensive, accurate)

**"I need production tracing and cost tracking"**
→ [Langfuse v3](./07-observability-monitoring.md#langfuse-v3)

**"I need a unified LLM gateway"**
→ [LiteLLM](./08-production-infrastructure.md#litellm-gateway)

**"I need air-gapped deployment"**
→ [Air-Gapped Deployment](./08-production-infrastructure.md#air-gapped-deployment)

**"I need to handle LLM API outages"**
→ [Software Resilience](./06-software-resilience.md)

---
