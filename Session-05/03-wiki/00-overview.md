# Wiki Overview — Session 5: Core Prompt Engineering Techniques

> ⚠️ ***work in progress***

**Central Narrative:** Prompting is not art — it is runtime configuration for a probabilistic computer. Engineers who understand the 5-epoch history, the 5 anatomy components, and the 5 primitive techniques can diagnose and fix any prompting failure systematically. The Complexity Ladder + Signal-to-Fix table replace guesswork with engineering discipline.

---

## File Index

| File | Contents |
|------|----------|
| [01-history.md](01-history.md) | The 5-epoch story of NLP evolution + model taxonomy (Base/IT/Chat/Reasoning) |
| [02-anatomy.md](02-anatomy.md) | Prompt anatomy: Role, Context, Task, Constraints, Output Format + XML tagging + System vs User + templates |
| [03-zero-few-shot.md](03-zero-few-shot.md) | Zero-Shot (incl. Zero-Shot CoT) + Few-Shot (incl. Min et al. 2022 surprise finding) |
| [04-chain-of-thought.md](04-chain-of-thought.md) | Chain-of-Thought: autoregressive mechanism, benchmarks, 2025 nuances, failure modes |
| [05-self-consistency-meta.md](05-self-consistency-meta.md) | Self-Consistency + Meta Prompting (APE + OPRO) |
| [06-decision-framework.md](06-decision-framework.md) | Complexity Ladder, Signal-to-Fix table, task matrix, Mermaid flowchart, cost comparison |
| [07-production.md](07-production.md) | Versioning, MLflow tracking, testing pyramid, prompt injection, caching, model pinning |
| [glossary.md](glossary.md) | 25+ term definitions + key papers quick reference table |

---

## Cross-Reference Map

| If you need... | Go to |
|----------------|-------|
| Why prompting works mechanically (history) | [01-history.md §Epoch 4–5](01-history.md) |
| Why CoT works (autoregressive mechanism) | [04-chain-of-thought.md §Mechanism](04-chain-of-thought.md) |
| Where to put context in the prompt | [02-anatomy.md §Positional Bias](02-anatomy.md) |
| Min et al. 2022 finding (labels vs format) | [03-zero-few-shot.md §Min et al. Surprise](03-zero-few-shot.md) |
| When CoT hurts in 2025 (reasoning models) | [04-chain-of-thought.md §2025 Nuance](04-chain-of-thought.md) |
| How Self-Consistency voting works | [05-self-consistency-meta.md §Mechanism](05-self-consistency-meta.md) |
| APE / OPRO code examples | [05-self-consistency-meta.md §APE and OPRO](05-self-consistency-meta.md) |
| Which technique for a given task | [06-decision-framework.md §Task Matrix](06-decision-framework.md) |
| What failure signal to look for | [06-decision-framework.md §Signal-to-Fix](06-decision-framework.md) |
| When to stop prompting → fine-tuning | [06-decision-framework.md §Fine-Tuning Signal](06-decision-framework.md) |
| MLflow prompt tracking code | [07-production.md §MLflow](07-production.md) |
| Prompt injection defense code | [07-production.md §Injection](07-production.md) |
| Caching numbers (90%/80%) | [07-production.md §Caching](07-production.md) |
| Model pinning | [07-production.md §Model Pinning](07-production.md) |
| Any term definition | [glossary.md](glossary.md) |

---

## Key Benchmarks at a Glance

| Technique | Paper | Key Result |
|-----------|-------|-----------|
| Few-Shot | Brown et al. 2020 (GPT-3) | TriviaQA: 64.3% → 71.2% (K=8) |
| Zero-Shot CoT | Kojima et al. 2022 | MultiArith: 17.7% → 78.7%; GSM8K: 10.4% → 40.7% |
| Few-Shot CoT | Wei et al. 2022 | GSM8K: 17.9% → 56.9% (PaLM 540B) |
| Self-Consistency | Wang et al. 2022 (N=40) | GSM8K: 56.5% → 74.4% |
| Self-Consistency | Wang et al. 2022 | SVAMP: 68.3% → 79.3% |
| APE | Zhou et al. 2022 | 19/24 tasks beat human-written prompts |
| OPRO | Yang et al. 2023 | GSM8K: 83% → 89% |
| Few-shot labels | Min et al. 2022 | Random labels: only 0–5% accuracy drop |
| CoT on reasoning models | Wharton GAIL 2025 | +2.9% accuracy at 20–80% more tokens |
