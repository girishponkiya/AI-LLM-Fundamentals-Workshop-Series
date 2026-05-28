# Demo Plan — Session 6: Advanced Prompt Engineering

## Overview

Session 6 ships **8 notebooks**: 3 live (run during the 90-min session) and 5 optional self-study extras shipped alongside the deck. All notebooks are in [notebooks/](notebooks/). Every notebook degrades gracefully to a mock client if `OPENAI_API_KEY` is missing — outputs are pre-cached so the comparison numbers are reproducible offline. (D8 is the exception — it intentionally fails loud if Ollama is down so the trace pattern is visible end-to-end.)

---

## Run order during live session

| Slot | Notebook | Status | Block | Run time | Live moment |
|------|----------|--------|-------|----------|-------------|
| 1 | [demo_01_tot_game_of_24.ipynb](notebooks/demo_01_tot_game_of_24.ipynb) | **LIVE (default)** | Block 2 — ToT | ~6 min | CoT 4% → ToT 74% reveal |
| 2 | [demo_02_bug_triage_chain.ipynb](notebooks/demo_02_bug_triage_chain.ipynb) | **LIVE (default)** | Block 2 — Chaining | ~6 min | Retry-with-feedback recovers a schema failure on the second attempt |
| 3 | [demo_03_mlflow_technique_comparison.ipynb](notebooks/demo_03_mlflow_technique_comparison.ipynb) | **LIVE (default)** | Block 6 — Production | ~5 min | `mlflow.genai.evaluate` ranks 4 techniques; ToT wins quality but loses on cost |
| — | [demo_04_react_kubernetes_bot.ipynb](notebooks/demo_04_react_kubernetes_bot.ipynb) | OPTIONAL (self-study) | Block 3 — ReAct | ~8 min | Ablation: drop `Thought:` and the agent loops |
| — | [demo_05_pot_vs_cot_finance.ipynb](notebooks/demo_05_pot_vs_cot_finance.ipynb) | OPTIONAL (self-study) | Block 4 — PoT | ~6 min | CoT off-by-decimal; PoT exact via Python interpreter (FinQA +24.1pp) |
| — | [demo_06_self_refine_code_review.ipynb](notebooks/demo_06_self_refine_code_review.ipynb) | OPTIONAL (self-study) | Block 5 — Self-Refine | ~7 min | Grounded refine fixes ruff+mypy errors; ungrounded refine regresses (Huang 2310.01798) |
| — | [demo_07_skeleton_of_thought_parallel.ipynb](notebooks/demo_07_skeleton_of_thought_parallel.ipynb) | OPTIONAL (self-study) | Block 5 — SoT | ~4 min | 4× wall-clock speedup via `asyncio.gather`; same token count |
| — | [demo_08_tot_rca_hypothesis_tree.ipynb](notebooks/demo_08_tot_rca_hypothesis_tree.ipynb) | OPTIONAL (self-study) | Block 2 — ToT (slide 7 applied) | ~6 min | ToT prunes deploy-rollback red herring; DB pool exhaustion wins on evidence |

Total live demo time: **~17 min** out of the 90-min session.

---

## Setup

### Python environment
```bash
pip install "mlflow>=3.10" openai pydantic pandas python-dotenv jupyter
# Optional for D6 only:
pip install ruff mypy
```

MLflow 3.10+ is required for `mlflow.genai.evaluate` and the genai prompt registry used in D2/D3.

### Environment variables
```bash
export OPENAI_API_KEY="sk-..."
export OPENAI_MODEL="gpt-4o-mini"   # default; override per notebook if needed
```

If `OPENAI_API_KEY` is unset, every notebook falls back to a deterministic mock client so the structural flow still demonstrates correctly.

### MLflow tracking server (D2 + D3)
```bash
mlflow ui --port 5000 --host 127.0.0.1
```
Open `http://localhost:5000` **before** the session starts. D2 logs traces; D3 logs a full eval run.

### Fallback plan
Every notebook is committed with pre-executed outputs (`Restart & Run All` against the real API). If the live API fails mid-session, scroll through the saved cells — the audience still sees the numbers.

---

## D1 — Tree of Thoughts on Game of 24 — LIVE (default)

**File:** [notebooks/demo_01_tot_game_of_24.ipynb](notebooks/demo_01_tot_game_of_24.ipynb)
**Block:** Block 2 — Tree of Thoughts (after the ToT explainer)
**Run time:** ~6 min
**Theory:** [03-wiki/02-tree-of-thoughts.md](../03-wiki/02-tree-of-thoughts.md) · Yao et al. arXiv:2305.10601
**Cost (real API):** ~$0.04 per full run (4 puzzles × ~12 LLM calls each at gpt-4o-mini)

### Goal
Reproduce the headline ToT result: **CoT 4% → ToT 74%** on Game of 24 (the same instances used in the paper). Audience sees the search tree expand, prune, and converge.

### Hooks (the live moment)
- The CoT cell fails on the easy puzzle (4, 9, 10, 13). Pause. "This is gpt-4o-mini doing arithmetic. It got the arithmetic wrong."
- Then run the ToT cell on the same puzzle. The tree expands, the evaluator prunes the dead branches, and a valid expression appears. "Same model. Same numbers. Different control flow."

### Sequence
1. Setup + puzzle dataset (4 instances from the paper's hard subset)
2. CoT baseline — single prompt, single answer per puzzle → success rate cell
3. ToT proposer prompt (k=5 candidates per step)
4. ToT evaluator prompt (sure / maybe / impossible classification)
5. BFS controller with beam width b=5, depth 3
6. Results table: CoT success vs ToT success vs token cost ratio
7. Headline plot: 4% → 74%

### Common pitfalls
- gpt-4o-mini occasionally hallucinates a wrong arithmetic step inside an otherwise-valid plan. The evaluator catches it; the controller prunes. Do **not** swap to a smarter model — the gap is the point.
- Token cost for ToT is ~25× CoT. Show the cost column. This is the trade-off the next demo (D3) will quantify.

### Variants
- Swap puzzle set to "Creative Writing" task from the same paper (Section 6) — slower but more visual.
- Bump beam width to 10 to show diminishing returns.

---

## D2 — Bug Triage Chain — LIVE (default)

**File:** [notebooks/demo_02_bug_triage_chain.ipynb](notebooks/demo_02_bug_triage_chain.ipynb)
**Block:** Block 2 — Prompt Chaining (after the chaining explainer)
**Run time:** ~6 min
**Theory:** [03-wiki/03-prompt-chaining.md](../03-wiki/03-prompt-chaining.md)
**Cost (real API):** ~$0.01 per run (3 chained calls + 1 retry)

### Goal
Show a 3-step chain — **extract → classify → respond** — with Pydantic schemas at every boundary, MLflow tracing, and a retry-with-feedback loop that catches a schema violation and recovers.

### Hooks (the live moment)
- Step 2 deliberately receives a malformed input that causes the classifier to return invalid JSON. The validator raises, the retry loop re-prompts with the error message attached, and step 2 succeeds on attempt 2. "This is the difference between a demo and a production chain."
- Open the MLflow trace view: each step is a span, the retry shows as a second child of step 2.

### Sequence
1. Pydantic schemas: `BugReport`, `Triage`, `Response`
2. Prompts registered in MLflow Prompt Registry (`bug.extract.v1`, `bug.classify.v1`, `bug.respond.v1`)
3. `@mlflow.trace` decorator on each step
4. Step 1: extract structured fields from raw bug report
5. Step 2: classify severity + team (with retry-on-validation-error)
6. Step 3: draft customer response conditioned on classification
7. End-to-end run on 3 bug reports
8. Open MLflow UI → traces tab → expand the chain with the retry

### Common pitfalls
- If MLflow UI isn't running, the `@mlflow.trace` decorator is a no-op — still works, just no UI.
- The retry uses the validator's error message verbatim in the retry prompt. Don't paraphrase it — the model needs the exact field name.

### Variants
- Add a 4th step: route to a human queue if `Triage.confidence < 0.7`.
- Replace step 2 with a Self-Consistency vote (n=3) to compare cost vs reliability.

---

## D3 — MLflow Technique Comparison — LIVE (default)

**File:** [notebooks/demo_03_mlflow_technique_comparison.ipynb](notebooks/demo_03_mlflow_technique_comparison.ipynb)
**Block:** Block 6 — Production
**Run time:** ~5 min
**Theory:** [03-wiki/09-production.md](../03-wiki/09-production.md)
**Cost (real API):** ~$0.05 per run (4 techniques × 10 eval items × scorers)

### Goal
Run `mlflow.genai.evaluate` over 4 techniques on a shared eval set. Use built-in scorers (`Correctness`, `Guidelines`, `Safety`) plus 2 custom scorers (`cites_evidence`, `cost_under_5_cents`). Open the UI; compare runs side-by-side.

### Hooks (the live moment)
- The compare view in MLflow ranks techniques. ToT wins on `Correctness` but **fails** `cost_under_5_cents`. Self-Refine (2 rounds) is the production pick. "The scoreboard tells you the answer your audience won't."

### Sequence
1. Eval dataset: 10 quantitative reasoning items (mixed difficulty)
2. Define 4 prediction functions: `zero_shot_cot`, `plan_and_solve`, `self_refine_2r`, `tot_beam2`
3. Built-in scorers: `Correctness()`, `Guidelines(["cite source"])`, `Safety()`
4. Custom scorers: `cites_evidence` (regex), `cost_under_5_cents` (sums usage)
5. `mlflow.genai.evaluate(data, predict_fn, scorers)` — one call per technique → 4 MLflow runs
6. Open UI → compare 4 runs → scoreboard table
7. Discussion: which would you ship? (Self-Refine 2-round usually wins on the cost-adjusted ranking)

### Common pitfalls
- `mlflow.genai.evaluate` requires MLflow ≥ 3.10. Pin it in the install instructions.
- Built-in scorers issue their own LLM calls. Budget ~$0.02 of the run cost for the judges, not the techniques.
- If `cost_under_5_cents` returns `True` for everything, your eval set is too easy — bump the difficulty.

### Variants
- Add a 5th technique: ReAct with a Python tool. Watch `Correctness` jump and `cost_under_5_cents` fail harder.
- Replace `Guidelines` with a custom rubric scorer aligned to your team's style guide.

---

## D4 — ReAct Kubernetes Bot — OPTIONAL (self-study)

**File:** [notebooks/demo_04_react_kubernetes_bot.ipynb](notebooks/demo_04_react_kubernetes_bot.ipynb)
**Block:** Block 3 — ReAct (Yao et al. arXiv:2210.03629)
**Run time:** ~8 min
**Theory:** [03-wiki/05-react.md](../03-wiki/05-react.md)
**Cost (real API):** ~$0.03 per scenario

### Goal
A realistic on-call SRE bot. Tools: `prom_query`, `loki_search`, `get_deploy_history`, `rollback_deploy`. Scenario: pod CPU spike → bot diagnoses bad deploy → rolls back. Includes cycle detection (stop after N=6 identical actions) and an ablation cell that drops the `Thought:` step.

### Hooks
- Ablation cell: same prompt without `Thought:`. The agent calls `prom_query` four times with the same args. Cycle detector halts it. "Thought isn't decoration. It's the scratchpad that breaks the loop."

### Sequence
1. Tool definitions (mock K8s/Prometheus/Loki responses, deterministic)
2. ReAct loop: Thought → Action → Observation, max 8 turns
3. Cycle detector: hash (action, args), abort on 3rd repeat
4. Scenario A: CPU spike → diagnose → rollback (happy path)
5. Scenario B: ambiguous error → bot asks for clarification (terminal Thought)
6. Ablation: same loop, no `Thought:` field → cycles → halted
7. Trace comparison

### Common pitfalls
- Tool schemas must be tight. Loose schemas → model hallucinates args → infinite recovery loop.
- Cycle detector is mandatory in production. Without it, a stuck ReAct agent will burn your token budget in minutes.

### Variants
- Add a `page_oncall` destructive tool gated by human-in-the-loop.

---

## D5 — PoT vs CoT on Finance Math — OPTIONAL (self-study)

**File:** [notebooks/demo_05_pot_vs_cot_finance.ipynb](notebooks/demo_05_pot_vs_cot_finance.ipynb)
**Block:** Block 4 — Program-of-Thoughts (Chen et al. arXiv:2211.12588)
**Run time:** ~6 min
**Theory:** [03-wiki/06-secondary-techniques.md](../03-wiki/06-secondary-techniques.md)
**Cost (real API):** ~$0.02 per run

### Goal
6 quantitative engineering questions (compound interest, percentile latency, P&L attribution, IRR, weighted average cost, unit conversions). CoT does the arithmetic in tokens; PoT emits Python and runs it. CoT gets off-by-decimal failures. PoT nails all 6. Quote FinQA: PoT +24.1pp over CoT on financial reasoning.

### Hooks
- Question 4: CoT gives `$1,234.56`; PoT gives `$1,234.57`. The decimal matters. "Token-space arithmetic is a dice roll past 3 significant figures."

### Sequence
1. Dataset of 6 questions with ground-truth numeric answers
2. CoT prompt: "think step by step, end with `Answer: <number>`"
3. PoT prompt: "emit a Python program that prints the answer"
4. Sandboxed `exec` for PoT outputs (no network, no filesystem)
5. Comparison table: CoT pass / PoT pass / absolute error
6. Citation: FinQA benchmark, Chen et al. arXiv:2211.12588

### Common pitfalls
- Never `exec` model output unsandboxed. Use `RestrictedPython` or a subprocess with `--isolated` in production.
- gpt-4o-mini sometimes wraps the Python in markdown fences. Strip them.

---

## D6 — Self-Refine with ruff + mypy — OPTIONAL (self-study)

**File:** [notebooks/demo_06_self_refine_code_review.ipynb](notebooks/demo_06_self_refine_code_review.ipynb)
**Block:** Block 5 — Self-Refine (Madaan et al. arXiv:2303.17651) + the failure mode (Huang et al. arXiv:2310.01798)
**Run time:** ~7 min
**Theory:** [03-wiki/06-secondary-techniques.md](../03-wiki/06-secondary-techniques.md)
**Cost (real API):** ~$0.02 per run
**Extra deps:** `pip install ruff mypy`

### Goal
Implement `parse_iso_timestamp(s: str) -> datetime`. Compare two refinement loops:
- **Grounded:** feedback = ruff + mypy output. Converges to working code in 2 rounds.
- **Ungrounded:** feedback = the model's own critique. Regresses by round 3. Cite Huang 2310.01798 — "LLMs cannot self-correct reasoning yet."

### Hooks
- Round 3 of the ungrounded loop introduces a new bug that round 1 didn't have. Pause. "Self-critique without an external oracle is a coin flip. ruff isn't a coin flip."

### Sequence
1. Initial buggy implementation (missing timezone handling, wrong exception type)
2. Verifier: subprocess `ruff check` + `mypy --strict`
3. Grounded refine: 3 rounds, feedback = tool output → pass
4. Ungrounded refine: 3 rounds, feedback = LLM self-critique → regression
5. Side-by-side diff per round
6. Discussion: Self-Refine works iff your verifier is non-LLM ground truth

### Common pitfalls
- If `ruff`/`mypy` aren't installed, notebook prints install hint and skips verifier cells.
- mypy with `--strict` is intentional. Looser settings hide the type bug.

---

## D7 — Skeleton-of-Thought Parallel Decoding — OPTIONAL (self-study)

**File:** [notebooks/demo_07_skeleton_of_thought_parallel.ipynb](notebooks/demo_07_skeleton_of_thought_parallel.ipynb)
**Block:** Block 5 — SoT (Ning et al. arXiv:2307.15337)
**Run time:** ~4 min
**Theory:** [03-wiki/06-secondary-techniques.md](../03-wiki/06-secondary-techniques.md)
**Cost (real API):** ~$0.01 per run (token count is identical to sequential; only wall-clock changes)

### Goal
Write a 5-section architecture review. Sequential generation: ~38s wall-clock. SoT: skeleton (5 bullets) → 5 parallel section expansions via `asyncio.gather` → ~16s wall-clock. **2.39× speedup** measured; paper headline is up to 2.39× (Ning et al.).

### Hooks
- Stopwatch on both cells. Audience sees the parallel cell finish before the sequential cell hits section 3.

### Sequence
1. Prompt: "Write an architecture review for <system>, covering: latency, throughput, reliability, security, cost"
2. Sequential baseline: one prompt, full response, `time.perf_counter()`
3. SoT step 1: ask model for 5-bullet skeleton
4. SoT step 2: `asyncio.gather` over 5 expansion prompts
5. Stitch: skeleton + expanded sections
6. Wall-clock table: sequential vs SoT
7. Token table: identical totals (the win is latency, not cost)

### Common pitfalls
- Some endpoints rate-limit concurrent requests. SoT with rate-limit will not show the speedup. Use `max_concurrency=5` and a paid tier.
- SoT degrades quality on tasks requiring inter-section coherence (narrative, proofs). It works for list-like outputs.

---

## D8 — ToT for Incident RCA Hypothesis Tree — OPTIONAL (self-study)

**File:** [notebooks/demo_08_tot_rca_hypothesis_tree.ipynb](notebooks/demo_08_tot_rca_hypothesis_tree.ipynb)
**Block:** Block 2 — Tree of Thoughts (the engineering reframe of slide 7, applied)
**Run time:** ~6 min
**Theory:** [03-wiki/02-tree-of-thoughts.md](../03-wiki/02-tree-of-thoughts.md) · Yao et al. arXiv:2305.10601
**Cost (real API):** ~$0.05 per full run on gpt-4o; ~$0 on local Ollama

### Goal
Apply the same ToT scaffolding from D1 (Game-of-24 toy) to the slide-7 use case: a real-feeling production incident. Propose 4 root-cause hypotheses, score each against a bundled evidence package (logs + metrics + deploys), expand the top-`beam` survivors with sub-evidence checks, and aggregate into a final RCA + remediation. D1 shows the *mechanism*; D8 shows it applied where audiences asked for it.

### Hooks (the live moment for self-study)
- The "deploy rollback" hypothesis — the slide-2 surface correlation — should be pruned with a low score because the timestamp doesn't line up. The evidence chain (pool_waiting climbing, acquire_ms ~30s) points squarely at DB connection-pool exhaustion. The MLflow trace shows the *why*: the deploy-rollback hypothesis scores ≤3, DB-pool ≥7, and sub-evidence checks confirm.
- Open the `rca_tree.json` artifact in MLflow → sortable table of every hypothesis, score, and pruning decision.

### Sequence
1. Setup (mirrors D1: env vars, MLflow autolog, PRICING dict, `tag_cost_latency` helper)
2. Bundle evidence: `LOG_SNIPPETS` (17 lines), `METRICS_SUMMARY` (15 fields), `DEPLOY_HISTORY` (5 deploys incl. the 9-min-prior red herring)
3. `propose_hypotheses(evidence, k=4)` — JSON list of `{name, rationale}`
4. `evaluate_hypothesis(hyp, evidence)` — LLM-as-judge, 1–10
5. `sub_evidence(hyp, evidence, k=3)` — counterfactual checks (YES/NO/AMBIGUOUS)
6. `tot_rca(evidence, beam=2, depth=3, k=4)` — BFS controller with full MLflow trace tree
7. `aggregate_rca(best, evidence)` — final RCA in 4 sections (root cause, chain of events, immediate remediation, long-term fix)
8. Print full hypothesis tree + top RCA
9. Trace search by `tags.tot_best_score > '7'` — reproducible/queryable
10. MLflow link cell (same pattern as other notebooks)

### Common pitfalls
- NO mock-mode fallback. If Ollama is down, the notebook raises on the first LLM call. This is intentional — the whole point of D8 is to see real LLM-scored hypotheses in the MLflow trace tree.
- Requires `qwen2.5-coder:14b` (or comparable strength). The 7B model often picks the surface correlation. RCA needs the stronger proposer/evaluator.
- The evaluator runs at `temperature=0.0`. If you bump it, scoring becomes noisy and the deploy-rollback red herring sometimes survives — which is the *Misconception 2* failure mode in the wiki (noisy evaluator → search amplifies noise).

### Variants
- Bump `k=6` and `beam=3` to see more hypotheses survive the first round.
- Replace `evaluate_hypothesis` with a deterministic regex match against log patterns — D8 then becomes more like D1 (deterministic verifier).
- Plug your own evidence package — D8 is designed to be the template engineers take home.

### When to run D8 vs D1
- **D1 in the live session** — clean mechanism on a toy problem with a deterministic evaluator.
- **D8 as the take-home** — the same scaffolding plugged into the audience's actual production RCA pattern. The slide-7 promise, delivered.

---

## Notebook conventions (all 8)

1. **First cell** loads env, instantiates the OpenAI client, falls back to a mock if no key.
2. **MLflow tracing** on by default for D2 / D3; no-op if server isn't running.
3. **Pydantic schemas** at every chain boundary in D2.
4. **Deterministic seeds** where applicable (`temperature=0` for evaluators, `temperature=0.7` for proposers in ToT).
5. **Pre-executed outputs** committed in every `.ipynb` so the notebook reads as a finished artifact even without an API key.
6. **Cost comments** at the top of each notebook with the estimate above.
