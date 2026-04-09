# Foundations of LLM Evaluation

Why evaluating an LLM isn't just "running tests" — and the methodology that replaces it.

---

## Why Probabilistic Evaluation Differs from Unit Testing

Traditional software has a contract: given the same inputs, you always get the same output. A unit test either passes or fails. This model **breaks completely** with LLMs.

An LLM might return a perfectly valid HTTP 200 status code while delivering a completely hallucinated, toxic, or off-brand response. There is no exception to catch, no stacktrace to read — just a semantically wrong answer that looks right.

Three properties make LLMs fundamentally different to test:

1. **Non-determinism** — Even at `temperature=0`, the same prompt can produce different outputs across runs due to batch size variations in matrix multiplication and normalization. You cannot rely on exact output matching.
2. **Semantic correctness ≠ syntactic correctness** — The model can produce fluent, well-structured text that is factually wrong, biased, or off-policy. No format check catches this.
3. **The output space is unbounded** — Unlike a function returning an integer, an LLM can return anything. You cannot enumerate edge cases the same way.

The consequence: **probabilistic evaluation with statistical thresholds replaces assertion-based testing**. Instead of `assert output == expected`, you ask: "Does this output score above 0.85 on a faithfulness metric, across 90% of test cases?"

---

## Evaluation-Driven Development (EDD)

EDD is the methodology that embeds evaluation throughout the LLM development lifecycle — not just at release time. It was formalized in a 2024 paper (arXiv:2411.13768) as "EDDOps."

The workflow is cyclical:

```
(1) Write evals  →  (2) Build agent/app to pass them
         ↑                        ↓
(5) Iterate       (3) Monitor production failures
         ↑                        ↓
         └──── (4) Add failures to eval dataset ───┘
```

This contrasts with TDD/BDD in two important ways:
- Evals use **statistical tolerances**, not binary pass/fail assertions
- The loop never closes — production monitoring continuously feeds new failure cases back into the eval dataset

> **Key principle:** Write your evals *before* you write the prompt or the agent. Define what "good" looks like first.

---

## Handling Non-Determinism

Since temperature=0 doesn't guarantee determinism, evaluation strategies must account for variance:

| Strategy | How it works | When to use |
|---|---|---|
| **Multi-run consensus** | Run each eval 3–5×, track σ; flag cases where σ > 0.15 | All critical evals |
| **Majority voting** | Simple majority for classification; mean for scores | Classification tasks |
| **Self-consistency sampling** | Query same model multiple times, vote on reasoning paths | Complex reasoning tasks |
| **Hard gates** | Compliance violations fail regardless of composite score | Safety, legal, PII |

For non-deterministic layers (the LLM itself), use **statistics and tolerances**. For deterministic layers (pre/post-processing logic), use standard unit tests — don't conflate the two.

---

## Golden Dataset Design

A golden dataset is a curated collection of test cases representing ground truth for your application. It is the foundation everything else is built on.

**Size guidance:**
- Start with **10–20 high-priority examples** covering critical use cases and known edge cases
- For statistical confidence: ~**246 samples per scenario** (assumes 80% expected pass rate, 5% margin of error, 95% confidence level)
- Quality matters more than quantity — 20 excellent cases beat 200 mediocre ones

**What belongs in a golden dataset:**
- Happy-path examples (the core use case working correctly)
- Edge cases discovered from production failures
- Adversarial inputs (prompts designed to elicit bad behavior)
- **Negative / unanswerable cases** — inputs where the correct response is "I don't know." A system that doesn't know it should refuse will hallucinate instead.

**Storage and versioning:**
- Store as versioned files in Git, alongside the prompt versions they test
- Treat golden datasets like code: review changes, track diffs
- Annotate each case with why it was added (production failure? known regression?)

---

## Golden Dataset Bootstrapping

Starting from zero is the hardest part. Three practical sources:

**1. Log extraction (highest signal)**
Production is your best teacher. Set a rule: every production failure, user downvote, or reported hallucination automatically becomes a candidate entry. Filter and validate before adding, but always start here.

**2. Synthetic generation (silver data)**
Use scripts to generate Question–Context–Answer tuples from your internal documents. LLMs can help generate these, but treat them as "silver" (lower confidence) until a human validates them. Useful for scaling up coverage quickly.

**3. Negative / unanswerable cases (often skipped)**
Explicitly construct inputs where the necessary context is missing, ambiguous, or contradictory. Test that the system refuses gracefully rather than confabulating. These cases surface a failure mode that happy-path generation never covers.

---

## A/B Testing for LLM Features

When comparing two prompt versions, model upgrades, or retrieval strategies, standard A/B testing applies — with adjustments for LLM stochasticity.

The key differences from traditional A/B tests:

- **Larger samples required** — LLM output variance is higher than a button click, so you need more data to reach statistical significance
- **Run an A/A test first** — Validate that your infrastructure produces similar scores for identical inputs before trusting A/B results
- **Never stop early** ("peeking" leads to false conclusions due to multiple comparison problems)
- **Measure all dimensions simultaneously**: quality (accuracy, faithfulness), UX (satisfaction, retention), operational (latency P95, cost), and safety

> For CI/CD implementation of A/B infrastructure, see [Testing & CI/CD](./04-testing-cicd.md).

---

## Related Topics

- [Evaluation Metrics](./02-evaluation-metrics.md) — the scoring functions used to measure golden dataset performance
- [Evaluation Frameworks](./03-evaluation-frameworks.md) — tools that implement eval pipelines (Pydantic AI, Phoenix, RAGAS, DeepEval)
- [Testing & CI/CD](./04-testing-cicd.md) — how evals plug into pull request gates and nightly pipelines
- [Observability & Monitoring](./07-observability-monitoring.md) — production monitoring that feeds failure cases back into the golden dataset
