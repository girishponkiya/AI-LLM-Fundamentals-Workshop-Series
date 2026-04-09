# Evaluation Frameworks

Purpose-built frameworks for implementing evaluation pipelines — how to run metrics, wire up judges, and structure test suites.

> This file covers *framework APIs and implementation*. For the underlying metric formulas (BLEU, RAGAS, G-Eval, etc.), see [Evaluation Metrics](./02-evaluation-metrics.md).

---

## Pydantic AI Evals

**Package:** `pydantic-evals` (standalone — does not depend on `pydantic-ai`)
**Install:** `pip install pydantic-evals` or `pip install 'pydantic-evals[logfire]'` for OpenTelemetry support

The standout feature of Pydantic AI Evals is **span-based evaluation**: the ability to test *how* an agent runs (which tools it called, what the latency was, which execution paths were taken) — not just what it returns. This is unavailable in other frameworks.

### Core Primitives

The framework revolves around three abstractions:

**`Case`** — a single test scenario:

```python
from pydantic_evals import Case

case = Case(
    name="refund_query",
    inputs="What is the refund policy?",
    expected_output="30-day return policy",
    metadata={"category": "support"},
    evaluators=()   # case-specific evaluators (optional)
)
```

**`Dataset`** — a collection of cases with evaluators:

```python
from pydantic_evals import Dataset

dataset = Dataset(
    cases=[case],
    evaluators=[EqualsExpected()],
    report_evaluators=[
        ConfusionMatrixEvaluator(predicted_from='output', expected_from='expected_output')
    ]
)
report = dataset.evaluate_sync(my_task, name="v1-experiment")
report.print(include_averages=True, include_reasons=True)
```

Key `Dataset` methods:
- `evaluate(task, max_concurrency?, repeat?)` — async; `evaluate_sync` is the sync wrapper
- `from_file(path)` / `to_file(path)` — YAML/JSON persistence for golden datasets
- `repeat=N` — runs each case N times and produces `ReportCaseAggregate` with averaged statistics (useful for non-determinism)

**`Evaluator`** — abstract dataclass implementing `evaluate(ctx: EvaluatorContext) → EvaluatorOutput`. The context exposes: `inputs`, `output`, `expected_output`, `metadata`, `duration`, `attributes`, `metrics`, and crucially, `span_tree`.

---

### 11 Built-in Evaluators

| Evaluator | Returns | Purpose |
|---|---|---|
| `EqualsExpected` | `bool` | `output == expected_output` |
| `Equals(value)` | `bool` | `output == value` |
| `Contains(value, case_sensitive?)` | `EvaluationReason` | Substring / membership check |
| `IsInstance(type_name)` | `EvaluationReason` | Type checking by class name |
| `MaxDuration(seconds)` | `bool` | Performance gate |
| `HasMatchingSpan(query)` | `bool` | OTel span presence check |
| `LLMJudge(rubric)` | `dict` | LLM-based scoring |
| `ConfusionMatrixEvaluator` | `ConfusionMatrix` | Report-level classification matrix |
| `PrecisionRecallEvaluator` | `PrecisionRecall + AUC` | Report-level PR curve |
| `ROCAUCEvaluator` | `LinePlot + AUC` | Report-level ROC curve |
| `KolmogorovSmirnovEvaluator` | `LinePlot + KS stat` | Distribution test |

---

### Span-Based Evaluation (the unique capability)

With `logfire.configure()` active, every task execution captures an OpenTelemetry span tree accessible via `ctx.span_tree`:

```python
from pydantic_evals import Evaluator, EvaluatorContext

class ToolCallEvaluator(Evaluator):
    def evaluate(self, ctx: EvaluatorContext):
        # Did the agent call the search tool?
        called_search = ctx.span_tree.any({'name_contains': 'search_tool'})
        # Did any LLM call exceed 5 seconds?
        slow_call = ctx.span_tree.any({'max_duration': 5.0})
        return called_search and not slow_call
```

`SpanTree` methods: `find(predicate)`, `first(predicate)`, `any(query)`, `count(query)`.

`SpanQuery` TypedDicts: `{'name_contains': 'tool_call'}`, `{'has_attributes': {'operation': 'search'}}`, `{'max_duration': 5.0}`.

> **Caveat:** Span-based evaluation requires the `logfire` optional dependency. Accessing `ctx.span_tree` without it raises `SpanTreeRecordingError`. The `SpanTree` is ephemeral — created during live evaluation only, not reconstructable from historical trace data.

---

### LLM Judge

`LLMJudge` wraps four specialised judge agents for different comparison contexts (output-only, input+output, expected+output, input+expected+output):

```python
from pydantic_evals.evaluators import LLMJudge
from pydantic_evals.evaluators.llm_as_a_judge import set_default_judge_model

set_default_judge_model('anthropic:claude-sonnet-4-6')

judge = LLMJudge(
    rubric="Response must be factually accurate and cite sources",
    include_input=True,
    include_expected_output=True,
    score={'evaluation_name': 'accuracy_score'},
    assertion={'include_reason': True}
)
```

Returns `GradingOutput(reason: str, pass_: bool, score: float)`.

---

## Phoenix Evals

**Package:** `arize-phoenix-evals` v2.11+, server `arize-phoenix` v13.8+
**License:** ELv2 (open-source), free cloud tier at `app.phoenix.arize.com`

Phoenix is OpenTelemetry-native — it's built around traces and spans as the primary data model, making it a natural fit for production monitoring as well as offline evaluation.

### Client-Side Evaluation

The modern API (v2.0+) uses `create_classifier()` and `evaluate_dataframe()`:

```python
from phoenix.evals import create_classifier, evaluate_dataframe
from phoenix.evals.llm import LLM

llm = LLM(provider="openai", model="gpt-4o")
evaluator = create_classifier(
    name="relevance",
    prompt_template="Is the response relevant?\n\nQuery: {input}\nResponse: {output}",
    llm=llm,
    choices={"relevant": 1.0, "irrelevant": 0.0},
)
results_df = evaluate_dataframe(dataframe=df, evaluators=[evaluator])
```

Phoenix uses **tool calling for structured output extraction** — the LLM is required to invoke a generated tool definition, ensuring reliable label extraction rather than fragile text parsing. The `LLM` class supports OpenAI, Anthropic, Azure, and LiteLLM providers.

### Server-Side Evaluation

Server-side evaluators run in the Phoenix UI without code, attached to experiments. Workflow: traces → dataset → experiment → evaluator scores results.

> **Current limitation:** Server-side evaluators require an experiment with an LLM task. You cannot evaluate dataset rows without re-generating output — meaning you can't score historical traces in isolation.

### 16 Pre-Built Evaluation Templates

All templates target precision 70–90% and F1 70–85% against golden benchmark data:

Hallucination, Q&A on Retrieved Data, Retrieval (RAG) Relevance, Summarization, Code Generation, Toxicity, AI vs Human (Groundtruth), Reference (Citation) Link, User Frustration, SQL Generation, Agent Function Calling, Agent Path Convergence, Agent Planning, Agent Reflection, Audio Emotion Detection, Code Metrics.

### Hallucination Evaluator Details

Classifies responses as `"factual"` (score=1.0) or `"hallucinated"` (score=0.0) by comparing response against provided context.

Benchmarked on HaluEval QA with GPT-4:
- **Precision: 0.93** — when it says "hallucinated," it's right 93% of the time
- **Recall: 0.72** — it catches 72% of actual hallucinations
- **~28% of hallucinations go undetected**

> **Scope limitation:** Designed only for context-grounded hallucination detection. It cannot check public-knowledge factual accuracy (e.g., "the capital of France is Paris"). The binary classification also misses partial hallucinations.

### Production Deployment

```bash
docker run -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:latest
```

- Port **6006**: UI + OTLP HTTP ingestion
- Port **4317**: OTLP gRPC ingestion
- Database: SQLite (default) or PostgreSQL ≥14 for production
- Helm chart: `oci://registry-1.docker.io/arizephoenix/phoenix-helm`

---

## RAGAS

**Package:** `ragas` v0.4.3 (Jan 2026), maintained by VibrantLabs

RAGAS provides the most mathematically rigorous metrics for RAG pipelines. For what each metric *measures* and its formulas, see [Evaluation Metrics → RAGAS](./02-evaluation-metrics.md#rag-specific-metrics-ragas). This section covers the implementation API.

### Collections API (v0.4.3)

The v0.4 Collections API replaces the legacy pattern:

```python
from openai import AsyncOpenAI
from ragas.llms import llm_factory
from ragas.metrics.collections import Faithfulness, AnswerRelevancy, ContextPrecision

client = AsyncOpenAI()
llm = llm_factory("gpt-4o-mini", client=client)

scorer = Faithfulness(llm=llm)
result = await scorer.ascore(
    user_input="When was the first Super Bowl?",
    response="The first Super Bowl was held on Jan 15, 1967",
    retrieved_contexts=["The First AFL–NFL World Championship Game...January 15, 1967..."]
)
print(result.value)   # float
print(result.reason)  # optional explanation
```

Key migration changes from v0.3:
- `LangchainLLMWrapper` → `llm_factory()`
- Raw floats → `MetricResult` objects with `.value` and `.reason`
- `single_turn_ascore(sample)` → `ascore(**kwargs)`
- `evaluate()` → `@experiment()` decorator (though `evaluate()` still works with deprecation warnings)

### Cost Concerns

Faithfulness alone requires multiple LLM calls per sample. A rough breakdown per sample:

| Metric | LLM calls | Embedding calls |
|---|---|---|
| Faithfulness | 2 | 0 |
| Answer Relevancy | 1 | N+1 (default N=3) |
| Context Precision | 1 | 0 |
| Context Recall | 1 | 0 |

**Cost management strategies:**
- Run heavy metrics on subsets (>50 samples is expensive)
- Use `DiskCacheBackend` — dramatically reduces cost on repeated runs with identical inputs
- Use `gpt-4o-mini` as the evaluator for development; switch to `gpt-4o` for final evaluation runs

### Known Limitations

- **Evaluator model disagreement:** A Tweag study (Feb 2025) found substantial score differences across evaluator models. GPT-3.5, GPT-4, Claude, and Llama 3 produce meaningfully different scores for identical inputs. Some models (especially Llama 3) fail to respond in the expected JSON format.
- **Benchmark optimism:** The original paper's 95% human agreement for Faithfulness and 70% for Context Relevance were measured on WikiEval — a relatively easy benchmark. Real-world agreement rates are lower.
- **Binary claim extraction:** Faithfulness assumes all claims are discrete and binary. Nuanced or partially-supported claims are forced into supported/unsupported buckets.

---

## DeepEval

**Package:** `deepeval`
**Description:** pytest-native LLM testing framework that integrates G-Eval and other metrics directly into Python test suites.

### G-Eval Integration

DeepEval's primary innovation is wrapping G-Eval (see [Evaluation Metrics → G-Eval](./02-evaluation-metrics.md#g-eval)) in a pytest-compatible API with auto-generated CoT rubrics:

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

professionalism_metric = GEval(
    name="Professionalism",
    criteria="The output must maintain a professional tone, avoiding slang.",
    evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT],
)

test_case = LLMTestCase(
    input="Summarise the outage.",
    actual_output="The server crashed hard, it was totally busted."
)
```

DeepEval calculates scores using **token weight summation** (probabilistic weighting) rather than parsing text — the same technique as the original G-Eval paper. Rubrics are auto-generated via chain-of-thought, so you only need to specify the criteria in plain English.

### pytest Integration

For CI/CD usage, see [Testing & CI/CD → DeepEval](./04-testing-cicd.md#deepeval-pytest-integration). The core pattern:

```python
import pytest
from deepeval import assert_test
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric

@pytest.mark.parametrize("golden", dataset.goldens)
def test_rag_agent(golden):
    assert_test(golden=golden, observed_callback=agent.answer)
```

Run with: `poetry run deepeval test run test_rag_agent.py -c -n 4`
- `-c`: enable caching (avoids re-calling the judge LLM for identical inputs)
- `-n 4`: run 4 test cases in parallel

---

## Related Topics

- [Evaluation Metrics](./02-evaluation-metrics.md) — formulas and theory behind BLEU, RAGAS, G-Eval, BERTScore
- [Testing & CI/CD](./04-testing-cicd.md) — how DeepEval and Promptfoo plug into CI pipelines
- [Observability & Monitoring](./07-observability-monitoring.md) — Langfuse LLM-as-judge and Phoenix server-side evaluation in production
- [Foundations](./01-foundations.md) — golden dataset design that feeds into these frameworks
