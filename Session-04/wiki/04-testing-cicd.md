# Testing & CI/CD

How to embed LLM evaluation into pull request gates, nightly pipelines, and automated red-teaming.

---

## The Quality Gate Architecture

The central concept in LLM CI/CD is a **multi-layer quality gate** — a pipeline of increasingly expensive checks that must all pass before a merge is allowed:

```
PR Opened → GitHub Actions
    │
    ├─ [1] Deterministic tests
    │       Format validation, JSON schema, response structure
    │       Fast, cheap, no LLM calls
    │
    ├─ [2] LLM-as-judge on golden dataset
    │       Run agent against curated test cases
    │       Score with judge model
    │
    ├─ [3] Per-metric thresholds
    │       faithfulness ≥ 0.85
    │       context_precision ≥ 0.80
    │       toxicity = 0
    │
    ├─ [4] Cost / latency budget check
    │       P95 latency ≤ SLO
    │       Estimated cost per request ≤ budget
    │
    └─ PASS → merge allowed | FAIL → block with detailed report
```

Hard gates (layer 1 + safety in layer 3) should fail immediately and never be overridden. Soft gates (quality scores) can be tuned based on acceptable regression thresholds.

---

## Promptfoo

**Description:** Open-source CLI tool for evaluating LLM prompts locally and in CI/CD via YAML configuration. No heavy Python required.

### YAML-Driven Configuration

```yaml
# promptfooconfig.yaml
prompts:
  - "Answer the following question: {{question}}"

providers:
  - openai:gpt-4o
  - anthropic:claude-sonnet-4-6   # A/B test two models

tests:
  - vars:
      question: "What is the refund policy?"
    assert:
      - type: llm-rubric
        value: "Response must mention 30-day return window"
      - type: latency
        threshold: 3000   # ms

defaultTest:
  options:
    provider: openai:gpt-4o-mini   # use cheaper model for the judge
```

Promptfoo ships with a **semantic cache** (24h TTL default) so repeated eval runs don't re-call the LLM for cached inputs — critical for cost control in CI.

Run locally: `npx promptfoo@latest eval -c promptfooconfig.yaml -o results.json`

### GitHub Actions CI/CD Pipeline

```yaml
name: LLM Prompt Evaluation
on:
  pull_request:
    paths: ['prompts/**']

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Cache promptfoo results
        uses: actions/cache@v4
        with:
          path: ~/.cache/promptfoo
          key: ${{ runner.os }}-promptfoo-${{ hashFiles('prompts/**') }}

      - name: Run evaluation
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: npx promptfoo@latest eval -c promptfooconfig.yaml -o results.json

      - name: Quality gate (jq-based)
        run: |
          FAITHFULNESS=$(jq '.results.metrics.faithfulness' results.json)
          CTX_PRECISION=$(jq '.results.metrics.context_precision' results.json)
          FAILURES=$(jq '.results.stats.failures' results.json)

          if (( $(echo "$FAITHFULNESS < 0.85" | bc -l) )); then
            echo "Faithfulness $FAITHFULNESS below threshold 0.85"; exit 1
          fi
          if (( $(echo "$CTX_PRECISION < 0.80" | bc -l) )); then
            echo "Context precision $CTX_PRECISION below threshold 0.80"; exit 1
          fi
          if [ "$FAILURES" -gt 0 ]; then
            echo "$FAILURES deterministic tests failed"; exit 1
          fi

      - uses: promptfoo/promptfoo-action@v1
        with:
          config: 'prompts/promptfooconfig.yaml'
          fail-on-threshold: 85    # block merge if < 85% pass rate
```

### Automated Red Teaming

Promptfoo automates adversarial attacks against your LLM before they reach production. Configure plugins in your YAML:

```yaml
redteam:
  plugins:
    - jailbreak          # attempts to bypass safety constraints
    - pii                # tries to extract personally identifiable information
    - prompt-injection   # tests susceptibility to instruction overriding
    - overreliance       # tests excessive trust in the model's own output
```

> For the safety threat taxonomy these plugins target, see [Guardrails & Safety → Prompt Injection](./05-guardrails-safety.md#prompt-injection).

---

## DeepEval: pytest Integration {#deepeval-pytest-integration}

DeepEval turns golden datasets into pytest test suites. The full framework setup is covered in [Evaluation Frameworks → DeepEval](./03-evaluation-frameworks.md#deepeval). The CI/CD pattern:

```python
# test_rag_agent.py
import pytest
from deepeval import assert_test
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric

dataset = ...  # load your golden dataset

@pytest.mark.parametrize("golden", dataset.goldens)
def test_rag_agent(golden):
    actual_output = agent.answer(golden.input)
    test_case = LLMTestCase(
        input=golden.input,
        actual_output=actual_output,
        retrieval_context=golden.retrieval_context
    )
    assert_test(test_case, [
        FaithfulnessMetric(threshold=0.85),
        AnswerRelevancyMetric(threshold=0.80)
    ])
```

Run in CI:
```bash
poetry run deepeval test run test_rag_agent.py -c -n 4
```
- `-c`: cache judge LLM responses (avoids re-scoring identical inputs)
- `-n 4`: run 4 test workers in parallel

---

## Cost Management in CI/CD

LLM evals in CI have real costs. Unmanaged, they can easily exceed $50/day on a busy team.

| Strategy | Details |
|---|---|
| **Cheap judge model** | GPT-4 judge: ~$1–3/run for 50 cases. GPT-4o-mini: ~$0.02/run. Use the cheap model by default; gate to GPT-4 only on nightly runs. |
| **Cache aggressively** | Promptfoo caches LLM responses (24h TTL default). DeepEval `-c` flag does the same. Always enable. |
| **Smoke tests on PR** | Run a small subset (10–20 critical cases) on every PR. Run the full suite (200+ cases) only nightly. |
| **Metric subsets** | For RAGAS, run Faithfulness + Answer Relevancy on PRs only. Add Context Precision + Recall to nightly. |
| **Skip unchanged prompts** | Use file path filters in GitHub Actions (`paths: ['prompts/**']`) to skip eval when only non-prompt files change. |

---

## A/B Testing Infrastructure

When comparing two versions (prompt A vs prompt B, model A vs model B), standard A/B testing applies with LLM-specific adjustments.

**Setup:**
1. **Power analysis first** — calculate required sample size before starting (LLM output variance is higher than a button click, so you need more data)
2. **Run an A/A test** — validate that your infrastructure produces similar scores for identical inputs; if A/A shows a difference, your measurement is broken
3. **Measure all dimensions simultaneously:** quality (faithfulness, accuracy), UX (satisfaction, retention), operational (P95 latency, cost per request), and safety (toxicity rate, refusal accuracy)
4. **Never peek / stop early** — multiple comparisons during a running test inflate false positive rates

**The "no peeking" rule explained:** If you check results every day and stop when you see significance, you're making ~30 comparisons across a month-long test. By chance alone, one of those will look significant at p < 0.05. This is why A/B tests must specify duration before starting.

> For the foundational concepts behind A/B testing for LLMs, see [Foundations → A/B Testing](./01-foundations.md#ab-testing-for-llm-features).

---

## Related Topics

- [Foundations](./01-foundations.md) — golden dataset design and EDD methodology that CI/CD enforces
- [Evaluation Metrics](./02-evaluation-metrics.md) — the metrics used as quality gate thresholds
- [Evaluation Frameworks](./03-evaluation-frameworks.md) — Pydantic AI, Phoenix, RAGAS, DeepEval APIs used in test suites
- [Guardrails & Safety](./05-guardrails-safety.md) — safety checks that belong in the deterministic layer of the quality gate
- [Observability & Monitoring](./07-observability-monitoring.md) — production monitoring that feeds regressions back into CI test cases
