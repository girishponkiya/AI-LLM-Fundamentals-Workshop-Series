# Session 4 — Hands-on Demo: Tracing & Evaluation with MLflow

Hands-on companion to Session 4: *LLM Evaluation, Testing & Monitoring*.  
Running example: **ZomatoBot** — an LLM-powered restaurant recommendation chatbot.

---

## Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (or pip)
- An OpenAI-compatible API (local Ollama, or any hosted endpoint)

---

## Setup (one-time)

```bash
# 1. Install dependencies
uv venv .venv --python 3.11
uv pip install -r requirements.txt

# 2. Configure your API
cp .env.example .env
# Edit .env — set OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL

# 3. Start the MLflow tracking server (keep this running in a separate terminal)
mlflow server --host 127.0.0.1 --port 5000
```

Open the MLflow UI at **http://127.0.0.1:5000** — keep it open alongside the notebooks.

---

## Notebooks

Run them in order. Each act builds on the previous one.

| # | Notebook | What you'll learn | Time |
|---|---|---|---|
| 1 | [01_tracing.ipynb](01_tracing.ipynb) | Instrument any LLM app with zero code changes (`autolog`) and with custom spans (`@mlflow.trace`) | ~10 min |
| 2 | [02_evaluation.ipynb](02_evaluation.ipynb) | Build a golden dataset; write boolean and float scorers; run `mlflow.genai.evaluate()` | ~15 min |
| 3 | [03_llm_judge.ipynb](03_llm_judge.ipynb) | Use an LLM as a judge to score semantic quality (relevance, safety, helpfulness) | ~15 min |

---

## Metric types covered

| Type | Example scorers | When to use |
|---|---|---|
| Boolean (deterministic) | `is_polite`, `mentions_indian_place` | Measurable rules you can express in code |
| Float (deterministic) | `conciseness` | Gradual qualities like length or coverage |
| Boolean (LLM judge) | `llm_relevance`, `llm_safety` | Pass/fail on semantic criteria |
| Float (LLM judge) | `llm_helpfulness` | Graded semantic quality |

**Rule of thumb:** start with deterministic scorers (fast, free, reproducible). Add LLM judges only for qualities that require language understanding.

---

## What to look at in the MLflow UI

After running each notebook:

- **Traces tab** — every LLM call with prompt, response, latency, and token count
- **Experiments → ZomatoBot → run** — per-row scorer results linked to traces
- **Compare runs** — select two runs to diff metrics side-by-side (useful for prompt A/B testing)

---

## Environment variables

| Variable | Example | Description |
|---|---|---|
| `OPENAI_API_KEY` | `ollama` | API key (use any string for local Ollama) |
| `OPENAI_BASE_URL` | `http://localhost:11434/v1` | Base URL of your OpenAI-compatible endpoint |
| `OPENAI_MODEL` | `llama3.2:1b` | Model name to use |

