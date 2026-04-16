# Demo Materials — Session 5: Core Prompt Engineering Techniques

Four live Jupyter notebooks, each mapped to a slide block.  
All notebooks use a local `.env` file for configuration — no hardcoded keys.

---

## Quick Start

```bash
# 1. Copy and fill in your endpoint details
cp .env.example .env
# edit .env with your API_BASE_URL, API_KEY, MODEL_NAME

# 2. Install dependencies
uv add openai mlflow pandas python-dotenv jupyter

# 3. (Demo 3 only) Start MLflow in a separate terminal
mlflow ui --port 5000

# 4. Launch notebooks
uv run jupyter notebook notebooks/
```

---

## Environment (`.env`)

| Variable | Description | Ollama example |
|----------|-------------|----------------|
| `API_BASE_URL` | OpenAI-compatible endpoint | `http://localhost:11434/v1` |
| `API_KEY` | API key (use any string for Ollama) | `ollama` |
| `MODEL_NAME` | Model identifier | `llama3.2:1b` |

---

## Notebooks

| File | Slide | Block | Duration | What the audience sees |
|------|-------|-------|----------|------------------------|
| [demo_01_anatomy_builder.ipynb](notebooks/demo_01_anatomy_builder.ipynb) | 18 | Prompt Anatomy | 8 min | 5 progressive prompt versions → comparison table |
| [demo_02_technique_comparison.ipynb](notebooks/demo_02_technique_comparison.ipynb) | 29 | 5 Techniques | 8 min | 5 techniques → LLM-as-judge scores → ranked DataFrame |
| [demo_03_mlflow_tracker.ipynb](notebooks/demo_03_mlflow_tracker.ipynb) | 37 | Production | 5 min | Prompt v1 vs v2 in MLflow UI — accuracy delta |
| [demo_04_injection_attack.ipynb](notebooks/demo_04_injection_attack.ipynb) | 40 | Production | 5 min | Attack succeeds → hardened prompt → attack blocked |

---

## Demo 1 — Anatomy Builder

**Teaching point:** Same model, same task — output quality improves with each added component.

Adds one component per cell:
1. Bare task
2. + Role / PCT pattern (~37% improvement)
3. + Context (positional bias rule: context at top, query at end)
4. + Constraints + JSON schema (`response_format: json_object`)
5. + XML structural tags
6. Side-by-side comparison DataFrame

---

## Demo 2 — Technique Comparison

**Teaching point:** Start at Zero-Shot. Escalate only with evidence. Check the cost multiplier.

Runs the same bug triage task through 5 techniques:

| Technique | Cost multiplier |
|-----------|----------------|
| Zero-Shot | 1× |
| Zero-Shot CoT | ~1.5× |
| Few-Shot (3 examples) | ~2.5× |
| Few-Shot + CoT | ~3.5× |
| Self-Consistency (N=5) | 5× |

LLM-as-judge scores each on Accuracy + Reasoning + Actionability (max 15).

---

## Demo 3 — MLflow Prompt Tracker

**Teaching point:** Prompts are code. Version them. Measure before promoting.

- Prompt v1: minimal zero-shot
- Prompt v2: PCT + XML + JSON format
- Both evaluated on 10-item golden test set
- Results logged to MLflow → compare view shows accuracy delta

**Requires:** `mlflow ui --port 5000` running before the session.

---

## Demo 4 — Injection Attack

**Teaching point:** OWASP LLM01:2025 is real. The fix is structural, not just a rule.

Steps:
1. Vulnerable prompt + normal document → correct summary
2. Same prompt + malicious document → model leaks system prompt *(let this land)*
3. Hardened prompt (XML tags + security rule) + same attack → blocked
4. Roleplay attack variant → also blocked

**Presenter note:** Pause after step 2 and ask the audience: *"Should I be worried?"*

---

## Files

```
05-demo/
├── README.md
├── demo-plan.md          # presenter guide with timing + talking points
├── .env                  # your local config (git-ignored)
├── .env.example          # template
└── notebooks/
    ├── demo_01_anatomy_builder.ipynb
    ├── demo_02_technique_comparison.ipynb
    ├── demo_03_mlflow_tracker.ipynb
    └── demo_04_injection_attack.ipynb
```
