# Wiki Overview — Session 6: Advanced Prompt Engineering

**Central Narrative:** In Session 5 a prompt was a string — one call, one answer, one grade. In Session 6 the prompt becomes a **control-flow program**: multiple calls, routed and evaluated, with intermediate state. Everything advanced — Tree of Thoughts, Prompt Chaining, ReAct, Self-Refine, Reflexion — falls out of that one shift. The engineer's job moves from *writing prompts* to *orchestrating them*: picking a technique family, composing techniques that pair well, capping cost, instrumenting per-step eval, and recognising when a reasoning model has already done the work internally so you stop paying twice.

---

## File Index

| File | Contents |
|------|----------|
| [01-landscape.md](01-landscape.md) | The 5 technique families + timeline 2021→2025 + production vs academic split + reasoning-model disruption preview |
| [02-tree-of-thoughts.md](02-tree-of-thoughts.md) | ToT mechanism (propose/evaluate/search), Game-of-24 result, RCA hypothesis tree, value-function trap, cost reality |
| [03-prompt-chaining.md](03-prompt-chaining.md) | Static DAG of prompts, one-verb-per-call heuristic, accuracy-floor math, Pydantic validators, error-propagation modes |
| [04-generate-knowledge.md](04-generate-knowledge.md) | Liu et al. 2021 two-call pattern, when self-RAG works, AWS SDK v2→v3 code-review example, hallucination warning |
| [05-react.md](05-react.md) | Thought/Action/Observation loop, ALFWorld +34 pp, on-call K8s incident bot, production hardening checklist |
| [06-secondary-techniques.md](06-secondary-techniques.md) | Plan-and-Solve, Least-to-Most, Step-Back, PoT, Self-Refine, Contrastive CoT, SoT, Auto-CoT + overview wall (GoT, ThoT, Analogical, S2A, EmotionPrompt, Reflexion, Constitutional, Maieutic, Complexity, Faithful) |
| [07-decision-framework.md](07-decision-framework.md) | 11-rung Advanced Complexity Ladder, pair-well/pair-badly table, cost lookup 1×→50×, Mermaid decision flowchart |
| [08-reasoning-models.md](08-reasoning-models.md) | OpenAI o1/o3 guidance verbatim, Claude Extended Thinking + `think` tool, Gemini `thinkingBudget`, what's redundant, doubled-cost trap |
| [09-production.md](09-production.md) | MLflow 3.10+ Tracing + `mlflow.genai`, `@mlflow.trace(span_type=SpanType.X)` + `mlflow.genai.evaluate` + Prompt Registry, technique comparison pattern, Huang et al. caveat |
| [glossary.md](glossary.md) | 35+ term definitions + key papers quick reference table |

---

## Cross-Reference Map

| If you need... | Go to |
|----------------|-------|
| Why single-call prompting hits a ceiling | [01-landscape.md §Opening](01-landscape.md) |
| The 5-family taxonomy (decomposition / search / self-correction / grounding / context-control) | [01-landscape.md §Families](01-landscape.md) |
| Timeline 2021→2025 of named techniques | [01-landscape.md §Timeline](01-landscape.md) |
| ToT mechanism (propose/evaluate/search) | [02-tree-of-thoughts.md §Mechanism](02-tree-of-thoughts.md) |
| Game-of-24 4%→74% reproduction | [02-tree-of-thoughts.md §Benchmark](02-tree-of-thoughts.md) |
| Why ToT amplifies a bad value function | [02-tree-of-thoughts.md §Value-Function Trap](02-tree-of-thoughts.md) |
| Chain accuracy floor math (0.95 × 0.92 × ... = 62%) | [03-prompt-chaining.md §Accuracy Floor](03-prompt-chaining.md) |
| One-verb-per-call splitting heuristic | [03-prompt-chaining.md §Splitting](03-prompt-chaining.md) |
| Validator + retry-with-feedback pattern | [03-prompt-chaining.md §Validators](03-prompt-chaining.md) |
| Generated Knowledge vs real RAG | [04-generate-knowledge.md §Warning](04-generate-knowledge.md) |
| ReAct production hardening (cycle detection, max-steps, fallback) | [05-react.md §Hardening](05-react.md) |
| Plan-and-Solve zero-shot upgrade | [06-secondary-techniques.md §Plan-and-Solve](06-secondary-techniques.md) |
| PoT for numeric/tabular tasks | [06-secondary-techniques.md §PoT](06-secondary-techniques.md) |
| Self-Refine without a verifier — why it degrades | [06-secondary-techniques.md §Self-Refine](06-secondary-techniques.md) and [09-production.md §Misconception-0](09-production.md) |
| Which technique for a given task | [07-decision-framework.md §Ladder](07-decision-framework.md) |
| Pair-well / pair-badly combinations | [07-decision-framework.md §Composition](07-decision-framework.md) |
| Cost lookup table 1×→50× | [07-decision-framework.md §Cost](07-decision-framework.md) |
| OpenAI o1/o3 "avoid CoT" official guidance | [08-reasoning-models.md §OpenAI](08-reasoning-models.md) |
| Anthropic `think` tool +54% pass^1 result | [08-reasoning-models.md §Anthropic](08-reasoning-models.md) |
| Gemini `thinkingBudget` API code | [08-reasoning-models.md §Gemini](08-reasoning-models.md) |
| MLflow 3.10+ `@mlflow.trace` + `SpanType` + `mlflow.genai` example | [09-production.md §Tracing](09-production.md) |
| Huang et al. 2310.01798 self-correction caveat | [09-production.md §Misconception-0](09-production.md) |
| Any term definition | [glossary.md](glossary.md) |

---

## Session Flow Summary

| Block | Content | Time |
|-------|---------|------|
| Opening | Session 5 ceiling + "prompt as control-flow program" reframe | 5 min |
| Section 1 | The 5 technique families + timeline + reasoning-model disruption preview | 10 min |
| Section 2 | 4 primary techniques deep dives — ToT, Chaining, GenKnow, ReAct (+ D1 + D2 (live)) | 25 min |
| Section 3 | Secondary techniques — Plan-and-Solve, L2M, Step-Back, PoT, Self-Refine, Contrastive, SoT, Auto-CoT + overview wall (+ D5 · D6 · D7 (optional)) | 15 min |
| Section 4 | The 11-rung Advanced Complexity Ladder + pair-well/badly + cost lookup | 10 min |
| Section 5 | 2024–2025 reasoning models — playbook shift (o1/o3, Claude Extended Thinking, Gemini) | 10 min |
| Section 6 | Production + MLflow 3.10+ Tracing + `mlflow.genai` scorers/registry + Huang caveat (+ D5) | 10 min |
| Closing | Three questions + Session 7 preview | 5 min |
| **Total** | | **~90 min** |

> **Tooling note:** S6 standardises on **MLflow 3.10+ GenAI APIs** throughout — `@mlflow.trace` + `mlflow.entities.SpanType` for instrumentation, `mlflow.genai.evaluate` with `mlflow.genai.scorers` for offline eval, and `mlflow.genai.register_prompt` / `load_prompt` for versioned prompt templates. The legacy `mlflow.evaluate` flow from Session 4 is superseded by the `mlflow.genai` namespace for all LLM workloads.

---

## Key Benchmarks at a Glance

| Technique | Paper | Key Result |
|-----------|-------|-----------|
| Tree of Thoughts | Yao et al. 2023 (NeurIPS) | Game of 24 GPT-4: 4% → **74%** (+70 pp) |
| Least-to-Most | Zhou et al. 2022 (ICLR) | SCAN: 16.2% → **99.7%** (+83.5 pp) |
| ReAct | Yao et al. 2022 (ICLR) | ALFWorld: **+34 pp** over IL+RL; WebShop +10 pp |
| Reflexion | Shinn et al. 2023 (NeurIPS) | HumanEval pass@1: 80% → **91%** (+11 pp) |
| Self-Refine | Madaan et al. 2023 (NeurIPS) | 7-task avg: **+20% absolute** |
| Program-of-Thought | Chen et al. 2022 (TMLR) | GSM8K +8.5 pp; FinQA 40.4% → **64.5%** (+24.1 pp) |
| Step-Back | Zheng et al. 2023 | TimeQA **+27 pp**; Chemistry +11 pp |
| Skeleton-of-Thought | Ning et al. 2024 (ICLR) | 12 LLMs avg: **2.39× latency reduction** |
| Plan-and-Solve | Wang et al. 2023 (ACL) | Arithmetic avg: **+9.1 pp** over Zero-shot CoT |
| Graph of Thoughts | Besta et al. 2024 (AAAI) | 128-num sort: **+62% quality, −31% cost** vs ToT |
| Contrastive CoT | Chia et al. 2023 | Up to **+15 pp** w/ Self-Consistency |
| S2A | Weston & Sukhbaatar 2023 | TriviaQA distractors: 51.7% → 61.3% (**+9.6 pp**) |
| EmotionPrompt | Li et al. 2023 | BIG-Bench Hard: **+115% relative** (era-dependent) |
| Anthropic `think` tool | Anthropic 2024 | Tau-Bench airline: **+54% pass^1** |
| Self-correction caveat | Huang et al. 2023 (2310.01798) | Self-correct w/o verifier *degrades* GSM8K |
