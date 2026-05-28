# 06 — Secondary & Emerging Techniques

**Overview:** Beyond ToT, ReAct, and Prompt Chaining (the three primary deep dives), there are roughly 18 named techniques in the literature that an engineer reaches for in production. This file is the working reference. Half A is the working set — 8 techniques you will actually deploy. Half B is the awareness set — 10 emerging or niche techniques you should recognise on a paper or a colleague's slide deck but rarely build into a pipeline. Every benchmark cited has an arXiv ID. Every code snippet is runnable Python for an engineering scenario (no poetry, no recipes).

**Cross-references:**
- [02-tree-of-thoughts.md](02-tree-of-thoughts.md) — deep dive on ToT; this file's Graph-of-Thoughts (B1) builds on it.
- [03-prompt-chaining.md](03-prompt-chaining.md) — Plan-and-Solve, Least-to-Most, and SoT are decomposition cousins of authored chaining.
- [05-react.md](05-react.md) — Reflexion (B6) is ReAct + episodic memory; PoT (A4) is the non-agentic computation pattern.
- [07-decision-framework.md](07-decision-framework.md) — Complexity Ladder rungs; this file populates rungs 4–8.

**How to read this file:**
- Half A (techniques 1–8) — each ~55 lines. Definition, mechanism, key benchmark, runnable engineering snippet, when-not, failure mode. These are the techniques worth memorising.
- Half B (techniques 9–18) — each ~15 lines. One paragraph, one benchmark, one engineering use, one caveat. These are the techniques worth recognising.
- References table at end — every paper, every arXiv ID, in one place.

---

# HALF A — Eight Secondary Techniques (Deep Reference)

## A1. Plan-and-Solve — The Free Upgrade

**Paper:** Wang et al. 2023, ACL — arXiv:2305.04091

### Definition

Zero-shot drop-in replacement for "Let's think step by step." The trigger phrase is two sentences instead of one:

> *"Let's first understand the problem and devise a plan to solve the problem. Then, let's carry out the plan and solve the problem step by step."*

The stronger **PS+** variant appends: *"…pay attention to calculation and intermediate variables."*

### Why it works

Zero-shot CoT lets the model dive straight into execution. Plan-and-Solve forces a planning phase first, which reduces "missing-step errors" — Wang et al. measured these at 12% of Zero-shot CoT failures on GSM8K. The plan acts as a structural frame the model fills in, rather than a direction it wanders in.

### Key benchmark

GSM8K and arithmetic benchmarks: **+9.1pp average over Zero-shot CoT** (Wang et al., ACL 2023, arXiv:2305.04091). PS+ further reduces calculation errors. Highest ROI of any technique in the report: one prompt change, zero added tokens of any consequence, measurable gain.

### Runnable snippet — incident severity triage

```python
import anthropic
client = anthropic.Anthropic()

PLAN_AND_SOLVE = """Let's first understand the problem and devise a plan to solve it.
Then, let's carry out the plan and solve the problem step by step.
Pay attention to calculation, intermediate variables, and edge cases."""

def triage(incident: str) -> dict:
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=f"""You are an on-call SRE assistant. Classify incident severity
(SEV1, SEV2, SEV3, SEV4) and propose the first remediation step.

{PLAN_AND_SOLVE}

Output JSON: {{"severity": str, "first_action": str, "reasoning": str}}""",
        messages=[{"role": "user", "content": incident}],
    )
    return resp.content[0].text
```

### Engineering example — bug triage

Same prompt skeleton, swap the system message to a bug-triage role. The plan forces the model to enumerate (a) what subsystem the bug touches, (b) what user impact it has, (c) which severity tier matches the impact — before emitting the verdict. Without the plan, the model often anchors on the most emotionally charged word in the report ("crash", "data loss") and skips the impact analysis.

### When not to use it

Never; it is free. The only counter-indication is if you're already at a higher rung of the Complexity Ladder (Self-Refine, ToT) — Plan-and-Solve is redundant once the technique already includes a planning phase.

### Failure mode

The plan can be too generic ("1. Understand 2. Solve 3. Verify") on tasks the model finds easy. This wastes a few tokens but does not hurt accuracy. There is no observed downside.

---

## A2. Least-to-Most Prompting — Sequential Decomposition

**Paper:** Zhou et al. 2022, ICLR 2023 — arXiv:2205.10625

### Definition

Two stages:
1. **Decompose** — prompt the LLM to break the problem into an ordered list of sub-problems.
2. **Solve sequentially** — solve each sub-problem in order, *appending each answer to the context* before solving the next.

The key contrast with Plan-and-Solve: Plan-and-Solve produces a plan and executes it in one call. Least-to-Most makes a separate call per sub-problem, with the previous answers explicitly in context.

### Why it works

Each later sub-problem is solved with the answers to earlier sub-problems available as context. This lets the model generalise to harder problem instances than any single in-context exemplar demonstrated. The compositional structure is built up step by step, not constructed in one pass.

### Key benchmark

SCAN compositional generalisation: code-davinci-002 with Least-to-Most reached **99.7% accuracy with 14 exemplars** vs Chain-of-Thought's **16.2%** (Zhou et al., ICLR 2023, arXiv:2205.10625). A staggering delta — one of the largest in the prompt-engineering literature.

### Runnable snippet — multi-table SQL generation

```python
def least_to_most_sql(question: str, schema: dict) -> str:
    # Stage 1: decompose
    decomp_prompt = f"""Schema: {schema}
Question: {question}

Break this question into an ordered list of sub-questions, where each later
sub-question can use the answer to earlier ones. Output JSON: {{"steps": [...]}}"""
    steps = json.loads(llm(decomp_prompt))["steps"]

    # Stage 2: solve sequentially, accumulating context
    context = [f"Schema: {schema}", f"Original question: {question}"]
    for i, step in enumerate(steps):
        prompt = "\n".join(context) + f"\n\nSub-question {i+1}: {step}\nAnswer:"
        answer = llm(prompt)
        context.append(f"Sub-question {i+1}: {step}\nAnswer: {answer}")
    return context[-1]  # final answer includes the SQL
```

### Engineering example — multi-table SQL

Question: "Monthly revenue by region for the last 12 months, excluding refunded orders." Decomposition:
1. What columns does the `orders` table have?
2. Given that, how does it join to `customers` to get region?
3. Given those joins, how do we filter out refunds?
4. Given the filter, write the final aggregation by month and region.

Each later step uses the table/column names resolved by earlier steps. The final SQL is built compositionally.

### When not to use it

When sub-problems are independent (no information flows forward) — Skeleton-of-Thought (A7) parallelises more efficiently for that shape. Also avoid when the decomposition step is unreliable on your domain — a bad decomposition cascades into the rest of the pipeline.

### Failure mode

If the decomposer hallucinates a sub-problem that doesn't exist in the actual problem ("what is the timezone of each region?"), the rest of the chain inherits that hallucination. Mitigation: validate each decomposition step against a schema or a known sub-question template before executing.

---

## A3. Step-Back Prompting — Abstract Then Solve

**Paper:** Zheng et al. 2023 — arXiv:2310.06117

### Definition

Before answering a specific question, prompt the model to derive the higher-level concept, principle, or category that applies. Then use both the abstract principle and the specific question together to produce the answer.

### Why it works

Anchors reasoning in stable, well-learned abstractions (categories of failure, classes of equations, types of policy) rather than in the brittle specifics of one instance. Models confuse "this case" with "similar-but-different case" more often than they get the category wrong.

### Key benchmark

PaLM-2L results from Zheng et al. (arXiv:2310.06117):
- **MMLU Physics: +7pp**
- **MMLU Chemistry: +11pp**
- **TimeQA: +27pp**
- **MuSiQue: +7pp**

The TimeQA +27pp is the headline number — temporal reasoning is exactly the kind of task where stepping back to "what kind of time question is this?" before answering pays off.

### Runnable snippet — K8s pod-crash debugging

```python
STEP_BACK_PROMPT = """You are a Kubernetes troubleshooting expert.

Step 1 (step back): What are the general categories of Kubernetes pod failures?
List 5–7 categories with one-line descriptions.

Step 2 (apply): Given the categories from Step 1 and the diagnostic output below,
which category fits, and what is the standard remediation?

Diagnostic output:
{kubectl_describe}

Output JSON: {{"category": str, "evidence_from_output": str, "remediation": str}}"""

def debug_pod(kubectl_describe: str) -> dict:
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user",
                   "content": STEP_BACK_PROMPT.format(kubectl_describe=kubectl_describe)}],
    )
    return json.loads(resp.content[0].text)
```

### Engineering example — K8s pod crash

`kubectl describe pod` shows `OOMKilled` in the last termination reason. Without step-back, the model often jumps to "increase memory limit" without considering whether it's a memory leak, a load spike, or an under-sized container. With step-back, the model first enumerates {OOMKill, CrashLoopBackOff, ImagePullBackOff, liveness-probe failure, readiness-probe failure, node eviction}, identifies OOMKill, and only then considers the four standard remediations (limit increase, leak fix, HPA tuning, request/limit ratio).

### When not to use it

When the model has been observed to step back to the wrong category on your eval set. The technique is only as good as the abstraction step. Always run a held-out eval before committing — a confidently wrong category propagates into the answer.

### Failure mode

Wrong-category cascade. The model picks "ImagePullBackOff" when the actual root cause is OOMKill, and then confidently emits the wrong remediation. Mitigation: log the chosen category as a structured field; alert when it disagrees with downstream evidence.

---

## A4. Program-of-Thought (PoT) — Offload Computation

**Paper:** Chen et al. 2022, TMLR 2023 — arXiv:2211.12588

### Definition

The LLM writes Python (or SQL, or another executable language). A real interpreter computes the answer. The reasoning is in the *structure* of the code; the computation is offloaded entirely to the interpreter.

### Why it works

LLMs are unreliable arithmeticians. Interpreters are not. Separating the *symbolic reasoning* (LLMs are good) from the *numerical computation* (LLMs are bad) is the entire insight. Faithful CoT (B10) generalises this from Python to arbitrary symbolic solvers.

### Key benchmark

From Chen et al. (TMLR 2023, arXiv:2211.12588):
- **GSM8K: PoT 71.6% vs CoT 63.1% → +8.5pp**
- **FinQA: PoT 64.5% vs CoT 40.4% → +24.1pp**
- With self-consistency: GSM8K 80%, FinQA 68.1%

The FinQA gap (+24.1pp) is the killer number for any engineer working with tabular numeric data.

### Runnable snippet — log percentile analysis

```python
import subprocess, tempfile, textwrap

POT_PROMPT = """Write a Python script using pandas to answer the following question.
The script must end with `print(result)` where `result` is the final answer.
The dataframe is already loaded as `df`. Do not include explanations.

Question: {question}
Columns in df: {columns}"""

def pot_exec(question: str, df_pickle_path: str, columns: list) -> str:
    code = llm(POT_PROMPT.format(question=question, columns=columns))
    code = extract_code_block(code)
    wrapper = textwrap.dedent(f"""
        import pandas as pd
        df = pd.read_pickle({df_pickle_path!r})
        {code}
    """)
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
        f.write(wrapper); path = f.name
    # Sandbox: no network, 10s timeout, restricted FS in production
    r = subprocess.run(["python", path], capture_output=True,
                       text=True, timeout=10)
    return r.stdout.strip()
```

### Engineering example — pandas log percentiles

Question: "Given these 10,000 access-log lines parsed into `df`, what is the p99 latency by endpoint?" PoT writes:

```python
result = df.groupby("endpoint")["latency_ms"].quantile(0.99).round(2).to_dict()
print(result)
```

The interpreter runs this exactly. Asking the LLM to "compute p99 from a list of 10,000 numbers" in prose is hopeless. PoT makes it trivial.

### When not to use it

When code execution is unsafe and you cannot sandbox. Untrusted input can inject `os.system(...)` or filesystem writes. Mitigation: subprocess with `seccomp`, no network, no filesystem, hard timeout. In production, use a Docker container with `--network=none --read-only --cap-drop=ALL` or a managed sandbox like Pyodide/E2B.

### Failure mode

The LLM writes code that runs but computes the wrong thing (uses `.mean()` instead of `.quantile(0.99)`, or groups by the wrong column). Mitigation: cross-check with a Self-Consistency vote across N=5 PoT runs — the interpreter outputs are easy to compare numerically.

---

## A5. Self-Refine — Generate, Critique, Refine

**Paper:** Madaan et al. 2023, NeurIPS 2023 — arXiv:2303.17651

### Definition

The same LLM plays three roles in sequence:
1. **Generator** — writes the first draft.
2. **Critic** — writes specific, actionable feedback on the draft.
3. **Refiner** — applies the feedback to produce a new draft.

Loop until a stopping condition. The paper explores up to 5 rounds; in production, cap at 2.

### Why it works

Models are often better at *critiquing* a candidate than producing the best candidate in one shot — the same asymmetry that makes code review effective even when the reviewer wrote the code. Pointing at a specific draft narrows the model's task from "produce the best possible thing" to "find what's wrong with this specific thing."

### Key benchmark

**~+20% absolute improvement averaged across 7 tasks** (code optimisation, math word problems, dialogue response generation, sentiment reversal, etc.) on GPT-3.5/ChatGPT/GPT-4 (Madaan et al., NeurIPS 2023, arXiv:2303.17651). Largest gains on tasks with a clear, evaluable rubric.

**Round-by-round behaviour (paper Figure 4):** most gain in rounds 1–2; marginal returns by round 3; occasional regression by rounds 4–5. Practical rule: cap at 2 rounds, exit early on convergence.

### Runnable snippet — code review hardening with external linter signal

```python
import subprocess, tempfile, mlflow
from mlflow.entities import SpanType

GEN_PROMPT = """Write a Python function for this spec:
{task}

Return only the function body in a ```python fenced block."""

CRITIC_PROMPT = """Review the function below against this rubric:
  1. Handles empty / None input explicitly.
  2. Validates argument types (raises TypeError on bad input).
  3. Uses `logging`, not `print`, for diagnostics.
  4. Has a docstring with Args / Returns / Raises.
  5. Raises typed exceptions, not bare `Exception`.

Linter report (ruff + mypy):
{lint_report}

Spec: {task}
Draft:
{draft}

Output JSON: {{"issues": [{{"rule": int, "fix": str}}], "done": bool}}"""

REFINE_PROMPT = """Apply every fix in `issues` to the draft. Preserve behaviour.
Return only the revised function in a ```python fenced block.

Spec: {task}
Draft:
{draft}
Critique JSON:
{critique}"""

def lint(code: str) -> tuple[str, int]:
    """Run ruff + mypy; return (combined report, error count) as the external signal."""
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
        f.write(code); path = f.name
    ruff = subprocess.run(["ruff", "check", "--output-format=concise", path],
                          capture_output=True, text=True)
    mypy = subprocess.run(["mypy", "--no-color-output", path],
                          capture_output=True, text=True)
    report = (ruff.stdout + ruff.stderr + mypy.stdout + mypy.stderr).strip()
    n_errors = report.count("\n") + (1 if report else 0)
    return report, n_errors

@mlflow.trace(name="self_refine", span_type=SpanType.CHAIN,
              attributes={"technique": "self_refine"})
def self_refine(task: str, max_rounds: int = 2):
    draft = extract_code(llm(GEN_PROMPT.format(task=task)))
    report, n_err = lint(draft)
    history = [(draft, n_err)]
    for r in range(max_rounds):
        critique = json.loads(llm(CRITIC_PROMPT.format(
            task=task, draft=draft, lint_report=report or "(no lint findings)")))
        if critique["done"] and n_err == 0:
            break  # critic + linter agree — exit before round-3 regression
        new_draft = extract_code(llm(REFINE_PROMPT.format(
            task=task, draft=draft, critique=json.dumps(critique))))
        new_report, new_err = lint(new_draft)
        if new_err >= n_err:
            break  # plateau or regression on the external signal — stop
        draft, report, n_err = new_draft, new_report, new_err
        history.append((draft, n_err))
    mlflow.update_current_trace(tags={"rounds": str(len(history) - 1),
                                       "final_lint_errors": str(n_err)})
    return draft, history
```

### Engineering example — code review hardening

Spec: *"Write `parse_iso_timestamp(s: str) -> datetime` that handles `Z`, offset, and naive forms."* Round-0 draft typically misses the empty-string case and uses `print` for warnings. The linter flags the missing return-type narrowing and the bare `except:`. The critic JSON enumerates fixes per rubric rule; the refiner applies them. Round-1 draft passes ruff and mypy with zero findings → the `n_err == 0` branch exits before round 2. The MLflow trace shows three child spans (gen, critic, refine) plus the lint subprocess timings, and the trace tag `rounds=1` is queryable via `mlflow.search_traces(filter_string="tags.rounds = '1'")`.

### When not to use it

Without an external verifier or rubric. Huang et al. 2023 (arXiv:2310.01798) demonstrated that self-correction *degrades* GSM8K accuracy when the same model is both writer and critic without external grounding. Self-Refine's gains depend on the critic having access to information the generator didn't: a rubric document, unit test results, linter output, a static analyser's report.

### Failure mode

Round 3+ regression. The critic invents nitpicks once the obvious issues are fixed, and the refiner introduces new bugs while addressing them. Cap at 2 rounds and exit on the convergence signals shown above.

---

## A6. Contrastive Chain-of-Thought — Positive + Negative Exemplars

**Paper:** Chia et al. 2023 — arXiv:2311.09277

### Definition

In your few-shot exemplars, include **both** a correct reasoning chain AND an incorrect one — each clearly labelled (e.g., `[Correct reasoning:]` vs `[Incorrect reasoning — do not do this:]`). The model learns not only what good reasoning looks like, but what specific errors to avoid.

### Why it works

Tells the model what *not* to do, not just what to do — analogous to negative training examples in supervised learning. The contrastive signal sharpens the decision boundary along the axis where errors recur. Standard few-shot CoT can only point at one side of the boundary.

### Key benchmark

Up to **+15pp with self-consistency** on arithmetic and commonsense reasoning benchmarks (Chia et al., 2023, arXiv:2311.09277). Particularly effective when a specific, recurrent failure mode exists — the negative exemplar demonstrates exactly that mistake.

### Runnable snippet — SQL LEFT JOIN semantics

```python
SYSTEM = """You generate SQL queries from natural-language questions.

<exemplar>
<question>List all customers and their order count, including those with zero orders.</question>
<correct_reasoning>
LEFT JOIN customers to orders so customers with no orders are kept.
Use COUNT(orders.id) (not COUNT(*)) so NULLs from the right side count as 0.
</correct_reasoning>
<correct_sql>
SELECT c.id, c.name, COUNT(o.id) AS order_count
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name;
</correct_sql>
<incorrect_reasoning>
LEFT JOIN customers to orders. Then filter WHERE orders.status = 'completed'.
</incorrect_reasoning>
<incorrect_sql>
SELECT c.id, c.name, COUNT(*) AS order_count
FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'completed'
GROUP BY c.id, c.name;
</incorrect_sql>
<why_incorrect>
The WHERE clause on the right-side column converts the LEFT JOIN into an
INNER JOIN — customers with no orders are dropped. The filter must move
into the ON clause to preserve the LEFT JOIN semantics.
</why_incorrect>
</exemplar>

Now answer the next question following the correct pattern."""
```

### Engineering example — SQL LEFT JOIN

The single most common SQL bug in LLM-generated queries is filtering a LEFT-joined right-side column in the WHERE clause, which silently converts the join to an INNER JOIN. A contrastive exemplar showing exactly this mistake, with the explanation, eliminates the failure mode for that prompt.

### When not to use it

When you cannot construct the negative exemplar correctly. A slightly-wrong negative teaches the model to make a new error. Invest the engineering time only when you have a clear, reproducible failure pattern documented from real eval data.

### Failure mode

Cargo-cult negatives. Engineers add a negative exemplar that demonstrates a "plausibly wrong" pattern they think the model might generate, but the model wasn't actually making that mistake. Now the model occasionally makes the new mistake. Mitigation: derive negative exemplars from actual eval failures, not imagined ones.

---

## A7. Skeleton-of-Thought — Parallel Expansion

**Paper:** Ning et al. 2023, ICLR 2024 — arXiv:2307.15337

### Definition

Two stages:
1. Ask the LLM for a **skeleton** — a short numbered list of points.
2. Fire **N parallel API calls**, each expanding one point. Concatenate the results.

The output token count is the same as a sequential generation. The wall-clock latency is reduced because the expansions run concurrently.

### Why it works — the latency math

Standard autoregressive decoding is sequential. End-to-end wall-clock time for a structured output:

```
sequential_time = Σ latency(section_i)
SoT_time        = latency(skeleton) + max_i(latency(section_i))
```

Replacing a *sum* with a *max* over independent sections is the entire trick. For a 5-section document where each section takes ~3 seconds, sequential is 15s plus skeleton; SoT is ~3s plus skeleton (~5× speedup in this idealised case).

### Key benchmark

**Up to 2.39× end-to-end wall-clock speedup across 12 LLMs**, with quality equal or better in 60% of cases (Ning et al., ICLR 2024, arXiv:2307.15337). The SoT-R "router" variant adds a classifier that decides per-question whether SoT is appropriate (short or sequential answers skip it), reaching **2.01× average speedup with no quality loss**.

### Runnable snippet — async parallel expansion

```python
import asyncio

SKELETON_PROMPT = """Produce a numbered skeleton (3–7 points) for an answer to:
{question}

Output exactly: 1. <point> \n 2. <point> ... no other text."""

EXPAND_PROMPT = """Expand point {i} ("{point}") of the skeleton below into one
self-contained paragraph (3–5 sentences). Do not reference other points.

Full skeleton:
{skeleton}

Original question: {question}"""

async def sot(question: str) -> str:
    skeleton = await async_llm(SKELETON_PROMPT.format(question=question))
    points = parse_numbered_list(skeleton)  # list of (i, text)
    tasks = [
        async_llm(EXPAND_PROMPT.format(i=i, point=p, skeleton=skeleton,
                                       question=question))
        for i, p in points
    ]
    expanded = await asyncio.gather(*tasks)
    body = "\n\n".join(f"**{p}**\n{e}" for (_, p), e in zip(points, expanded))
    return skeleton + "\n\n" + body
```

### Engineering example — architecture review

Question: "Review the design of this new payment processing service." Skeleton (one call): `[scalability, security, observability, cost, failure modes]`. Five parallel calls (`asyncio.gather`) each expand one section. The reviewer receives a complete 5-section document in roughly `1 / 2.4×` the wall-clock time versus sequential generation.

### When not to use it

When sections reference each other ("as discussed above in point 2…") — parallel expansion cannot satisfy cross-references. Also avoid on short responses (under ~300 output tokens) where the skeleton-call overhead exceeds the parallelism savings.

### Failure mode

Inter-section duplication. Two parallel calls independently cover the same sub-point because each call sees only the skeleton, not the other expansions. Mitigation: instruct each call explicitly to stay within its own section; deduplicate post-hoc with a short consolidation call.

---

## A8. Auto-CoT — Clustering-Based Exemplar Selection

**Paper:** Zhang et al. 2022, ICLR 2023 — arXiv:2210.03493

### Definition

Auto-generates few-shot CoT exemplars from an unlabelled pool, in three steps:
1. Embed questions with Sentence-BERT (or any embedding model), k-means cluster into K clusters.
2. Pick the question closest to each cluster centroid (the "representative question").
3. Generate a rationale for each representative via Zero-shot CoT ("Let's think step by step").

Concatenate the resulting (question, rationale, answer) triples as your few-shot prompt. No human labelling required.

### Why it works

Hand-written exemplars are biased toward whatever subset of the problem space the author found memorable. Clustering ensures diversity across the problem distribution, so the prompt covers more failure modes than a hand-curated set. The tagline from the paper: *"let's think not just step by step, but also one by one."*

### Key benchmark

Matches or exceeds Manual-CoT across MultiArith, GSM8K, AQuA, SVAMP, CSQA, StrategyQA — within 1pp on most benchmarks, but with **zero human labelling effort** (Zhang et al., ICLR 2023, arXiv:2210.03493). The labelling-cost-to-quality ratio is the headline.

### Runnable snippet — clustering exemplars

```python
from sklearn.cluster import KMeans
import numpy as np

def auto_cot_exemplars(questions: list[str], k: int = 8) -> list[dict]:
    # 1. Embed
    embeddings = np.array([embed(q) for q in questions])
    # 2. Cluster + pick representatives
    km = KMeans(n_clusters=k, random_state=0, n_init=10).fit(embeddings)
    reps = []
    for c in range(k):
        members = np.where(km.labels_ == c)[0]
        centroid = km.cluster_centers_[c]
        dists = np.linalg.norm(embeddings[members] - centroid, axis=1)
        rep_idx = members[np.argmin(dists)]
        reps.append(questions[rep_idx])
    # 3. Generate rationale per representative via Zero-shot CoT
    exemplars = []
    for q in reps:
        rationale = llm(f"{q}\n\nLet's think step by step:")
        exemplars.append({"question": q, "rationale": rationale})
    return exemplars
```

### Engineering example — bug-triage prompt library

You have 5,000 historical bug reports, unlabelled. Embed each with a sentence-transformer, cluster into 8 groups, pick the centroid representative of each. Generate a Zero-shot CoT rationale for each. Concatenate the 8 (bug, reasoning, severity) triples into your few-shot prompt. The resulting prompt covers 8 archetypes of bug rather than the 3 archetypes a human curator would have written from memory.

### When not to use it

When the Zero-shot CoT rationale generation step produces poor-quality chains (the model doesn't know the domain). Inspect the auto-generated exemplars before shipping. Bad exemplars in a few-shot prompt are worse than no exemplars at all.

### Failure mode

Centroid representatives that are *typical* but uninteresting — every cluster's centroid is a vanilla case, and the prompt covers no edge cases. Mitigation: combine Auto-CoT with Active Prompting (B9), which selects by uncertainty rather than typicality.

---

# HALF B — Ten Emerging / Overview Techniques

## B1. Graph of Thoughts (GoT)

**Paper:** Besta et al. 2023, AAAI 2024 — arXiv:2308.09687

ToT generalised from a tree to an arbitrary DAG, with two extra operations: **aggregate** (merge two thought branches into one combined thought) and **refine** (loop a node back on itself to improve it). A GoT controller maintains a graph of thought nodes and applies a sequence of operations (generate, score, aggregate, refine). On a 128-number sorting task vs ToT, GoT improved solution quality by **+62% while cutting cost by >31%**. Engineering use: multi-subsystem incident analysis where parallel branches (DB, network, app) need an aggregate step that produces a unified causal chain. **Caveat:** the `spcl/graph-of-thoughts` reference implementation is research-grade, not production-hardened — only worth the overhead when your task has a genuine merge step.

## B2. Thread-of-Thought (ThoT)

**Paper:** Zhou et al. 2023 — arXiv:2311.08734

For long, chaotic contexts (concatenated logs, transcripts, document dumps). Trigger prompt: *"Walk me through this context in manageable parts step by step, summarising and analysing as we go."* The model segments the context into coherent threads, then a second call extracts the final answer using the thread-structured analysis. Beats vanilla context, retrieval-only, and standard CoT on PopQA, EntityQ, and the authors' MTCR multi-turn conversation dataset. Engineering use: incident post-mortem from a 500-line concatenated log + 3 monitoring alerts + 2 deploy notes — segment first, then synthesise. **Caveat:** wasted tokens when the context is already well-structured.

## B3. Analogical Prompting

**Paper:** Yasunaga et al. 2023, ICLR 2024 — arXiv:2310.01714

The LLM self-generates its own few-shot examples by analogy before solving. Prompt: *"Recall three relevant problems and their solutions, then solve the following problem."* No human-labelled exemplars needed; the model retrieves from its own parametric knowledge. Consistently outperforms Zero-shot CoT, Manual few-shot CoT, and zero-shot on GSM8K, MATH (competition problems), Codeforces, and BIG-Bench. Engineering use: explaining an unfamiliar algorithm in a codebase by asking the model to recall similar algorithms first ("Recall three string-matching algorithms and how they work, then explain this Aho-Corasick implementation"). **Caveat:** if the model's recall of analogous problems is wrong, the self-generated exemplars mislead rather than help.

## B4. System 2 Attention (S2A)

**Paper:** Weston & Sukhbaatar 2023 — arXiv:2311.11829

A two-step defence against context pollution. Step 1: ask the LLM to *rewrite the context* to remove irrelevant, biased, or distracting material. Step 2: answer using the cleaned context. On a TriviaQA variant with in-topic distractors, accuracy improves **51.7% → 61.3% (+9.6pp)**. Engineering use: security audit of a design document containing both spec and the engineer's potentially-misleading self-assessment — S2A drops the assessment first, then audits the spec. Also strong as a defence against indirect prompt injection. **Caveat:** the filtering step itself can drop legitimately relevant context that looks like noise (e.g., one critical log line buried in 50 irrelevant ones).

## B5. EmotionPrompt / Social Prompting

**Paper:** Li et al. 2023 — arXiv:2307.11760

Append emotionally or socially charged stimuli to the prompt — *"This is very important to my career"*, *"You'd better be sure"*, *"Believe in yourself."* On 2023-era models: Instruction Induction +8.00%, BIG-Bench Hard +115% relative. Engineering use: append *"This is a critical production issue; your analysis must be thorough"* to an incident triage prompt, run on 50 held-out incidents, keep only if LLM-judge scores improve >3%. **Caveat (era-dependent):** these numbers are from 2023 on older models. Gains diminish significantly on heavily RLHF-tuned frontier models (Claude 3+, GPT-4 Turbo) — these models are trained to be consistently helpful regardless of emotional framing. Treat as a low-cost A/B test only.

## B6. Reflexion

**Paper:** Shinn et al. 2023, NeurIPS 2023 — arXiv:2303.11366

Self-Refine + a lessons-learned wiki across trials. An agent attempts a task, receives a binary success/failure signal from an external evaluator (unit tests, environment reward, ground-truth check), writes a verbal "lesson" describing what went wrong, stores it in a short episodic memory buffer, and retries with the lessons in context. HumanEval pass@1: **91% vs GPT-4 baseline 80% (+11pp)**. AlfWorld: +22pp. HotpotQA: +20pp. Engineering use: test-driven code generation where the test suite is the verifier. **Caveat (requires external verifier):** without a reliable success signal, Reflexion degrades into noisy self-critique. The whole technique depends on the verifier being trustworthy — don't use it for tasks where you cannot programmatically check success.

## B7. Constitutional Self-Critique

**Paper:** Bai et al. 2022 — arXiv:2212.08073

Critique a draft against an explicit, written list of principles (the "constitution"), then revise the draft to comply. Distinct from Self-Refine: the rubric is fixed, external, and authored by humans — it is a document, not a free-form self-generated critique. The original CAI paper uses this to *train* a model via RLAIF, but the **inference-time critique-revise pattern** is the production-useful piece. Engineering use: API documentation generation with a constitution like `[1. Every endpoint must document rate limits. 2. Error codes must include remediation. 3. Examples must use placeholder credentials. 4. Deprecated fields must show removal version.]` The critique step checks each rule; the revise step fixes violations. **Caveat:** degrades to ungrounded self-critique when the rules are fuzzy or context-dependent.

## B8. Maieutic Prompting

**Paper:** Jung et al. 2022, EMNLP 2022 — arXiv:2205.11822

Builds an abductive explanation tree — the model recursively generates "X is true because…" and "X is false because…" for a claim, expanding until atomic propositions, then resolves contradictions using a SAT solver applied to the logical relationships between nodes. Up to **+20% improvement over SOTA prompting** on three commonsense benchmarks (ComVE, CREAK, CSQA2). Engineering use: access-control rule verification — the model generates an explanation tree for "User X should be denied access to endpoint Y given these IAM policies", and the SAT solver checks consistency, surfacing policy bugs. **Caveat:** engineering overhead is high (SAT integration, tree validation) for moderate gains on most production tasks; hard to extend beyond binary truth values.

## B9. Complexity-based Prompting

**Paper:** Fu et al. 2022, ICLR 2023 — arXiv:2210.00720

Two linked findings: (1) exemplars with **longer reasoning chains** (~9 steps) consistently outperform short-chain exemplars (2–3 steps); (2) for self-consistency voting, **select only the most complex chains** (top-K by step count) to vote with, filtering out short low-effort samples. +5.3pp average across GSM8K, MathQA, MultiArith, BBH vs Wei et al. CoT baseline; up to **+18pp** on specific tasks. Engineering use: when curating few-shot exemplars for security vulnerability analysis, prefer the 8-step reasoning chain over the 3-step version among candidates of equivalent correctness. **Caveat:** length-correlated quality is not universal — some models pad reasoning without improving it ("length washing"). Verify on your eval that longer is actually more correct, not just more verbose.

## B10. Faithful CoT

**Paper:** Lyu et al. 2023, IJCNLP-AACL 2023 (Best Paper) — arXiv:2301.13379

Two stages: (1) translate the natural-language problem into a **symbolic program** (Python, Datalog, PDDL, or a task-specific DSL); (2) run a **deterministic solver** or interpreter on the program. Because the answer is computed from the chain, the chain is mathematically guaranteed faithful — the reasoning trace and the answer cannot diverge. Outperforms standard CoT on **9 of 10 benchmarks** tested. Program-of-Thought (A4) is the Python special case of this general pattern. Engineering use: contract clause analysis — translate a clause into first-order-logic predicates and a Datalog query (`IF jurisdiction='EU' AND data='personal' THEN applies(GDPR)`); the Datalog engine evaluates it deterministically; the engineer sees both the symbolic form and the conclusion (fully auditable). **Caveat:** the natural-language → formal-program translation is itself error-prone; a wrong translation is computed faithfully but answers the wrong question.

---

## Composition Notes

Many of these techniques combine well:
- **Plan-and-Solve + PoT** — plan in prose, execute the numeric step in code. Standard pattern for any task that mixes reasoning with arithmetic.
- **Step-Back + Self-Refine** — abstract first, draft, critique against the abstraction. Good for STEM tutoring or technical writing.
- **Skeleton-of-Thought + Constitutional Critique** — fan out section drafts in parallel, then run each through a per-section constitution. Architecture-review automation.
- **Auto-CoT + Active Prompting** — Auto-CoT for coverage of the typical distribution, Active Prompting to add the hard cases. The cheapest path to a high-quality few-shot prompt with no manual labelling.
- **Contrastive CoT + Self-Consistency** — the +15pp number from Chia et al. requires SC sampling on top of contrastive exemplars; one technique alone underperforms.

For composition logic, see [07-decision-framework.md](07-decision-framework.md) — the Complexity Ladder shows which combinations skip a rung and which are redundant.

---

## Editorial Notes

- **The "free upgrade" framing for Plan-and-Solve is load-bearing.** When you teach this section, lead with it. Most engineers using "think step by step" can change one line of their system prompt and bank +9.1pp on the spot — without any pipeline change, A/B test, or cost increase. Show the diff live.
- **PoT vs Faithful CoT is the same idea at two abstraction levels.** Don't teach them separately. PoT is "Faithful CoT where the DSL is Python." Once a learner understands the offload-to-interpreter pattern, both are obvious.
- **Self-Refine and Reflexion look similar; the difference is the verifier.** Self-Refine uses the model itself; Reflexion uses an external signal. The "no verifier" failure mode (Huang et al. arXiv:2310.01798) is the punchline of the section — teach it explicitly.
- **EmotionPrompt is the cautionary tale.** The 2023-era +115% number is real, and it is also nearly gone on modern RLHF-tuned models. Use it to teach learners how to read prompt-engineering papers with a year-stamp in mind. Era-dependent gains are the rule, not the exception.
- **Half B is for recognition, not deployment.** When a colleague mentions Maieutic Prompting or Graph of Thoughts on a slide, your learners should know what they are and roughly why they're not in production. They should not feel pressure to actually build them.
- **Demo plan:** the [05-demo/](../05-demo/) notebooks compare Plan-and-Solve vs Zero-shot CoT on a triage task (~5 lines of diff), and Self-Refine round 1 vs round 2 vs round 3 to show the regression at round 3. These two demos cover the two most surprising findings for engineers.
- **MLflow tracing (3.10+):** all snippets above are simplified for readability. In the demo notebooks, wrap each LLM call with `@mlflow.trace(name="...", span_type=SpanType.LLM, attributes={"technique": "self_refine", "round": r})` (import `from mlflow.entities import SpanType`) so the trace shows generator vs critic vs refiner spans separately; tag the parent trace with `mlflow.update_current_trace(tags={...})` for per-task rollups. The Self-Refine convergence plot becomes obvious in the MLflow UI. All MLflow code in this wiki uses `@mlflow.trace` + `mlflow.genai` scorers/registry — see [09-production.md](09-production.md).

---

## References

| # | Technique | Paper | arXiv ID | Venue/Year |
|---|-----------|-------|----------|------------|
| A1 | Plan-and-Solve | Wang et al. — Plan-and-Solve Prompting | arXiv:2305.04091 | ACL 2023 |
| A2 | Least-to-Most | Zhou et al. — Least-to-Most Prompting | arXiv:2205.10625 | ICLR 2023 |
| A3 | Step-Back | Zheng et al. — Take a Step Back | arXiv:2310.06117 | 2023 |
| A4 | Program-of-Thought | Chen et al. — Program of Thoughts | arXiv:2211.12588 | TMLR 2023 |
| A5 | Self-Refine | Madaan et al. — Self-Refine | arXiv:2303.17651 | NeurIPS 2023 |
| A6 | Contrastive CoT | Chia et al. — Contrastive Chain-of-Thought | arXiv:2311.09277 | 2023 |
| A7 | Skeleton-of-Thought | Ning et al. — Skeleton-of-Thought | arXiv:2307.15337 | ICLR 2024 |
| A8 | Auto-CoT | Zhang et al. — Automatic Chain of Thought | arXiv:2210.03493 | ICLR 2023 |
| B1 | Graph of Thoughts | Besta et al. — Graph of Thoughts | arXiv:2308.09687 | AAAI 2024 |
| B2 | Thread-of-Thought | Zhou et al. — Thread of Thought | arXiv:2311.08734 | 2023 |
| B3 | Analogical Prompting | Yasunaga et al. — Large Language Models as Analogical Reasoners | arXiv:2310.01714 | ICLR 2024 |
| B4 | System 2 Attention | Weston & Sukhbaatar — System 2 Attention | arXiv:2311.11829 | 2023 |
| B5 | EmotionPrompt | Li et al. — Large Language Models Understand and Can Be Enhanced by Emotional Stimuli | arXiv:2307.11760 | 2023 |
| B6 | Reflexion | Shinn et al. — Reflexion | arXiv:2303.11366 | NeurIPS 2023 |
| B7 | Constitutional Critique | Bai et al. — Constitutional AI | arXiv:2212.08073 | 2022 |
| B8 | Maieutic Prompting | Jung et al. — Maieutic Prompting | arXiv:2205.11822 | EMNLP 2022 |
| B9 | Complexity-based Prompting | Fu et al. — Complexity-Based Prompting | arXiv:2210.00720 | ICLR 2023 |
| B10 | Faithful CoT | Lyu et al. — Faithful Chain-of-Thought Reasoning | arXiv:2301.13379 | IJCNLP-AACL 2023 |
| — | Self-Refine failure mode | Huang et al. — Large Language Models Cannot Self-Correct Reasoning Yet | arXiv:2310.01798 | 2023 |
