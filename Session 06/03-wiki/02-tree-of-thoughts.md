# 02 — Tree of Thoughts (ToT)

**Overview:** Tree of Thoughts is CoT that branches and backtracks. Instead of generating one left-to-right reasoning chain (Session 5), ToT expands a tree of partial "thoughts", scores each node with a value function, and searches (BFS / DFS / beam) for the highest-scoring leaf. The headline result is brutal: on Game of 24, GPT-4 jumps from **4% (CoT) to 74% (ToT)** — but you pay 30–50× tokens for it. This file covers the propose/evaluate/search mechanism, the value-function trap, the BFS implementation, MLflow logging, and when *not* to reach for ToT.

**Cross-references:** [01-landscape.md](01-landscape.md) — ToT lives in Family 2 (Search/Branching). [07-decision-framework.md](07-decision-framework.md) — when ToT beats Self-Consistency, chaining, or just spending the money on a reasoning model. [08-reasoning-models.md](08-reasoning-models.md) — why hand-engineered ToT on top of o1/Claude-thinking is the "paying twice" anti-pattern. [Session 5 / 04-chain-of-thought.md](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/04-chain-of-thought.md) — CoT is the linear ancestor; ToT lets you back up. [Session 5 / 05-self-consistency-meta.md](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/05-self-consistency-meta.md) — Self-Consistency is sampling+voting; ToT is search+scorer. Different beasts.

---

## Definition

**Tree of Thoughts (ToT)** — Yao et al. 2023, arXiv:2305.10601 (NeurIPS 2023). At each node:

1. **Propose:** generate *k* candidate next thoughts (each "thought" is a coherent text chunk — a partial reasoning step, a sub-plan, a hypothesis).
2. **Evaluate:** call the model again to score each candidate (often "sure / maybe / impossible" or a numeric 1–10).
3. **Search:** apply BFS, DFS, or beam search over the scored tree, keeping the top-*b* nodes at each level.
4. **Commit:** stop when the value crosses a threshold, a terminal state is reached, or the budget is exhausted.

```
                     root (problem)
                       │
        ┌──────────────┼──────────────┐
     thought-1     thought-2      thought-3       ← propose k=3 children
     (score=0.7)   (score=0.3)    (score=0.9)    ← evaluate each
                       ×                            ← prune (beam=2)
        │                            │
     thought-1a ...              thought-3a ...    ← expand surviving nodes
```

ToT is **not** a prompt — it is an orchestration loop over many model calls.

---

## Why ToT > CoT-with-Self-Consistency

In Session 5 you learned Self-Consistency: sample N independent CoT chains at temperature ≈ 0.7, then majority-vote the final answer. That technique relies on the model's output distribution containing the right answer often enough that voting recovers it.

ToT differs along two axes:

| Dimension | CoT + Self-Consistency | Tree of Thoughts |
|-----------|-----------------------|------------------|
| **What's varied** | Random sampling across full reasoning chains | Branches explored, lookahead, backtracking |
| **Scoring** | None — vote at the end | Per-node value function, scored *during* search |
| **Pruning** | None — every chain runs to completion | Beam/best-first prunes dead branches early |
| **Catastrophic early commit** | Each chain still commits left-to-right | The tree can abandon a bad opening |
| **Cost (relative to CoT 1×)** | ~5× | 30–50× |

The mechanical difference is **scoring + pruning**. Self-Consistency is statistical denoising; ToT is search. Two regimes where the difference matters:

- **Catastrophic early commits.** Game of 24 demands picking the right first operation. A wrong opening — say, `13 + 8` when the solution required `13 - 8` — kills the chain. CoT can't back up; ToT scores both openings and keeps the promising one.
- **The model is better at *evaluating* than *generating*.** A model that can't reliably produce the optimal 4-op arithmetic chain can often tell you whether a partial expression is "promising" or "doomed". ToT exploits that gap.

If you cannot reliably write that value function, ToT collapses to expensive sampling. See [§Misconception 2](#misconception-2-tot-is-just-cot--n).

---

## The Game-of-24 Headline Benchmark

Yao et al. 2023, GPT-4:

| Method | Success rate on Game of 24 |
|--------|---------------------------|
| Standard prompting (zero-shot) | 7.3% |
| CoT (few-shot) | **4.0%** |
| CoT + Self-Consistency (N=100) | 9.0% |
| **ToT (b=5)** | **74%** |

That `4 → 74` delta is the slide everyone remembers from this paper. It is also the most cherry-picked number in the prompt-engineering literature. Read it as: *for a narrow class of tasks (catastrophic early-commit + cheap evaluator), ToT can be transformational.* Most production tasks are not Game of 24.

ToT also lifts:
- **Creative Writing** coherence scores (judged by GPT-4 + humans)
- **Mini Crosswords** word-level completion rate from 16% → 60%

**Paper:** Yao et al. 2023 — arXiv:2305.10601. Reference implementation: [princeton-nlp/tree-of-thought-llm](https://github.com/princeton-nlp/tree-of-thought-llm).

---

## BFS / DFS / Beam — Pick One

| Strategy | When to use | Memory | Behaviour |
|----------|------------|--------|-----------|
| **BFS** | Shallow trees, small *k*, no quick wins | O(b^d) | Explore all of level d before any of d+1 |
| **DFS** | Deep trees, terminate-on-first-good-leaf | O(d) | Dive on highest-score child, backtrack on fail |
| **Beam (most common)** | Production default | O(beam) | Keep top-*beam* at each level; prune the rest |

Beam search with `beam ∈ [2, 5]` and `depth ∈ [3, 5]` is the production default. It bounds cost (≈ `beam × k × depth` model calls + evaluations) and degrades gracefully when the value function is noisy.

---

## Full Python — BFS / Beam variant

Self-contained, runnable. Adapted from anchor §5.2.

```python
"""
tree_of_thoughts.py

A minimal but production-shaped ToT implementation supporting BFS, DFS,
and beam search. The model is abstracted behind `propose` and `evaluate`
callables — wire them to any provider.
"""

from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Any


@dataclass
class Node:
    state: Any                        # serializable thought / partial state
    path: list = field(default_factory=list)
    score: float = 0.0
    node_id: str = "r"


def tot(
    root_state: Any,
    propose: Callable[[Any, int], list],         # (state, k) -> list[thought]
    evaluate: Callable[[Any], float],            # (state) -> 0.0..1.0
    is_terminal: Callable[[Any], bool],
    apply_thought: Callable[[Any, Any], Any],    # (state, thought) -> new_state
    strategy: str = "beam",
    beam: int = 3,
    depth: int = 4,
    k: int = 5,
) -> Node:
    """
    Returns the best Node found within the depth/beam budget.

    Cost is bounded by: depth * beam * k proposal calls
                     + depth * beam * k evaluation calls.
    """
    frontier: deque[Node] = deque([Node(state=root_state)])
    best = Node(state=root_state, score=-float("inf"))

    for d in range(depth):
        candidates: list[Node] = []

        while frontier:
            node = frontier.pop() if strategy == "dfs" else frontier.popleft()
            children_thoughts = propose(node.state, k)        # 1 LLM call -> k thoughts

            for i, thought in enumerate(children_thoughts):
                new_state = apply_thought(node.state, thought)
                score = evaluate(new_state)                   # 1 LLM call per child
                child = Node(
                    state=new_state,
                    path=node.path + [thought],
                    score=score,
                    node_id=f"{node.node_id}.{i}",
                )
                if score > best.score:
                    best = child
                if is_terminal(new_state):
                    return child
                candidates.append(child)

        if strategy == "beam":
            candidates.sort(key=lambda x: -x.score)
            frontier = deque(candidates[:beam])
        elif strategy == "bfs":
            frontier = deque(candidates)
        else:  # dfs
            frontier = deque(sorted(candidates, key=lambda x: -x.score))

    return best
```

**Note on the LLM calls.** A real `propose` issues one call returning *k* thoughts (cheaper than k separate calls). A real `evaluate` may batch by passing all *k* candidates in one call and asking for *k* scores back. Both optimisations matter at production scale — the naive implementation above is for clarity.

---

## The Value Function — Deep Dive

The value function is the single point of failure in ToT. Yao et al. tested two flavours:

### 1. "Sure / Maybe / Impossible" classification

The model is shown a partial state and asked whether reaching the goal is `sure`, `maybe`, or `impossible`. Map to numeric scores (e.g. 1.0 / 0.5 / 0.0) and average across 3 samples for noise reduction.

```python
EVAL_PROMPT = """Given the partial state below, decide whether it can reach
the goal. Respond with EXACTLY one word: sure, maybe, or impossible.

Goal: Combine the numbers using +, -, *, / to produce exactly 24.
Partial state: {state}
Verdict:"""

def evaluate(state) -> float:
    votes = [llm(EVAL_PROMPT.format(state=state), temp=0.7) for _ in range(3)]
    score = sum({"sure": 1.0, "maybe": 0.5, "impossible": 0.0}.get(v.strip().lower(), 0.0)
                for v in votes) / 3
    return score
```

### 2. Numeric scoring against rubric

For RCA-style tasks where evidence is graded:

```python
EVAL_PROMPT = """Score how well this hypothesis explains the evidence below.
Use a 1-10 integer scale. Respond with ONLY the number.

Evidence:
{evidence}

Hypothesis:
{hypothesis}

Score:"""
```

### What makes a good evaluator

| Property | Why it matters | Smell test |
|---------|---------------|-----------|
| **Resolves promising/doomed** | If every node scores 0.5, search degenerates to BFS | Score variance across siblings > 0.2 |
| **Cheap relative to propose** | You call it `beam × k × depth` times | Eval ≤ ½ the proposal cost |
| **Insensitive to phrasing** | Otherwise score is noise | Re-score the same node 5×; std-dev < 0.1 |
| **Externally grounded when possible** | LLM evaluating LLM amplifies bias (cf. [Huang 2310.01798](https://arxiv.org/abs/2310.01798)) | Prefer unit tests, type-checks, executable verifiers |

If you have a **deterministic verifier** (a unit test, linter, type-checker, executable program), use it as the evaluator and ToT becomes dramatically more reliable. ToT-with-pytest is a different beast from ToT-with-LLM-judge.

---

## Engineering Example — RCA Hypothesis Tree

From anchor §2.1: a multi-step root-cause analysis where the model proposes hypotheses, an evaluator scores them against log evidence, and a beam survives to the next level.

**Setup:**
- *k* = 4 candidate hypotheses per node
- *beam* = 2
- *depth* = 3
- Evaluator: numeric 1–10 against the evidence trail collected so far

**Level 0 (root):** raw alert + initial log dump.

**Level 1 — propose 4 root-cause families:**
```
1. DB connection pool exhaustion
2. GC pause in JVM service
3. Downstream API timeout cascade
4. Bad deploy (v2.47 introduced regression)
```
Evaluator scores against the log evidence: `[7, 3, 5, 9]`. Beam=2 keeps `{deploy, db_pool}`.

**Level 2 — for each surviving branch, propose 4 sub-hypotheses:**
```
Branch "Bad deploy":
  1.1 New migration locks user_sessions table
  1.2 New background job exhausts thread pool
  1.3 Feature flag flipped during rollout
  1.4 Config change broke retry policy

Branch "DB pool":
  2.1 Slow query saturates pool
  2.2 Connection leak in new code path
  2.3 PgBouncer misconfig
  2.4 Replica lag forcing reads to primary
```
Evaluator scores each against evidence + new sub-evidence pulled (deploy diff, slow-query log). Beam=2 again.

**Level 3 — terminal.** The highest-scoring leaf carries an evidence chain you can hand to the post-mortem document. The pruned branches are kept in the log so the review can ask "did we consider GC pause? Yes, scored 3/10, pruned at level 1 — here's why."

```python
def propose_rca(state, k=4):
    msg = [
        {"role": "system", "content":
            "You are an SRE. Given the alert and evidence so far, propose "
            f"{k} distinct, mutually-exclusive root-cause hypotheses. "
            "Be specific (name services, queries, deploys). One per line."},
        {"role": "user", "content": state.dump()},
    ]
    raw = llm(msg)
    return [line.strip() for line in raw.splitlines() if line.strip()][:k]


def evaluate_rca(state) -> float:
    msg = [{"role": "user", "content":
        f"Evidence:\n{state.evidence}\n\nHypothesis: {state.hypothesis}\n\n"
        "Score 1-10 how well this hypothesis explains the evidence. "
        "Respond with ONLY the integer."}]
    raw = llm(msg, temperature=0.0)
    try:
        return int(raw.strip()) / 10
    except ValueError:
        return 0.5

winner = tot(
    root_state=RCAState(alert=alert, evidence=initial_logs),
    propose=propose_rca,
    evaluate=evaluate_rca,
    is_terminal=lambda s: s.depth >= 3,
    apply_thought=lambda s, t: s.with_hypothesis(t),
    strategy="beam", beam=2, depth=3, k=4,
)
```

The tree is the artefact. The audit trail of pruned hypotheses is the second deliverable — often more valuable than the final answer for blameless post-mortems.

---

## MLflow Tracing for ToT (MLflow 3.10+)

From anchor §5a.5. Logs every expansion, every score, every prune. The MLflow UI renders the search tree as a span tree; `log_table` gives you a browsable tabular artefact of the whole search.

```python
import json
import mlflow
from mlflow.entities import SpanType

mlflow.openai.autolog()                      # auto-traces every OpenAI call
mlflow.set_experiment("session6/tot_search")


@mlflow.trace(
    name="tot_logged",
    span_type=SpanType.CHAIN,
    attributes={"strategy": "beam", "beam": 3, "depth": 3, "k": 4,
                "tot_version": "v1.2"},
)
def tot_logged(root, propose, evaluate, beam=3, depth=3, k=4):
    frontier  = [{"id": "r", "state": root, "score": 0.0, "parent": None}]
    all_nodes = list(frontier)

    for d in range(depth):
        next_f = []
        for node in frontier:
            with mlflow.start_span(
                name=f"expand_{node['id']}",
                span_type=SpanType.CHAIN,
            ) as sp:
                sp.set_attribute("depth", d)
                sp.set_attribute("parent_id", node["id"])
                sp.set_attribute("parent_score", node["score"])

                children = propose(node["state"], k)
                sp.set_attribute("n_children", len(children))

                for i, c in enumerate(children):
                    with mlflow.start_span(
                        name=f"eval_{node['id']}.{i}",
                        span_type=SpanType.LLM,
                    ) as esp:
                        s = evaluate(c)
                        esp.set_attribute("node_score", s)
                        esp.set_inputs({"state": str(c)[:500]})
                        esp.set_outputs({"score": s})

                    nid = f"{node['id']}.{i}"
                    cn = {"id": nid, "state": c, "score": s,
                          "parent": node["id"], "depth": d + 1,
                          "pruned": False}
                    next_f.append(cn)
                    all_nodes.append(cn)
                    mlflow.log_metric(f"node_score.{nid}", s, step=d)

        kept     = sorted(next_f, key=lambda x: -x["score"])[:beam]
        kept_ids = {n["id"] for n in kept}
        for n in next_f:
            if n["id"] not in kept_ids:
                n["pruned"] = True
        frontier = kept

        mlflow.log_metric("frontier_size", len(frontier), step=d)
        mlflow.log_metric("pruned_count", len(next_f) - len(frontier), step=d)

    best = max(all_nodes, key=lambda x: x["score"])

    # Log full search tree as a structured table (browsable in the UI).
    node_table = {
        "id":     [n["id"]          for n in all_nodes],
        "parent": [n["parent"]      for n in all_nodes],
        "depth":  [n.get("depth", 0) for n in all_nodes],
        "score":  [n["score"]       for n in all_nodes],
        "pruned": [n.get("pruned", False) for n in all_nodes],
        "state":  [str(n["state"])[:300] for n in all_nodes],
    }
    mlflow.log_table(data=node_table, artifact_file="search_tree.json")

    # Annotate the active trace so we can filter past runs by outcome.
    mlflow.update_current_trace(tags={
        "selected_node_id":  best["id"],
        "best_score":        f"{best['score']:.3f}",
        "depth_reached":     str(d + 1),
        "nodes_expanded":    str(len(all_nodes)),
        "nodes_pruned":      str(sum(1 for n in all_nodes if n["pruned"])),
    })
    return best
```

What you see in the MLflow UI:
- **Span tree:** every `expand_<id>` and `eval_<id>` as nested spans with `node_score` attributes
- **Per-node metric series:** `node_score.r.0`, `node_score.r.1`, … plotted over depth
- **Pruned count per level:** quick sanity check that beam is actually pruning
- **`search_tree.json` table artefact:** sortable/filterable in the Artifacts tab — click `pruned=True` rows to audit what the search threw away
- **Trace tags:** `selected_node_id`, `depth_reached`, `nodes_pruned` searchable across runs

### Querying past ToT searches

`mlflow.search_traces` lets you replay or compare prior runs by tag. Useful when triaging "why did Game-of-24 fail on this input yesterday?":

```python
# Find every ToT search that landed on a level-3 leaf with high score.
df = mlflow.search_traces(
    experiment_names=["session6/tot_search"],
    filter_string="tags.depth_reached = '3' AND tags.best_score > '0.8'",
    max_results=50,
)
print(df[["trace_id", "tags.selected_node_id", "tags.best_score"]])

# Pull one specific trace and walk its spans (for offline replay).
tr = mlflow.get_trace(df.iloc[0]["trace_id"])
expand_spans = [s for s in tr.data.spans if s.name.startswith("expand_")]
for s in expand_spans:
    print(s.name, s.attributes.get("n_children"), s.attributes.get("parent_score"))
```

Pair this with [Session 5's LLM-as-judge metric](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/05-self-consistency-meta.md) to grade leaves against ground truth across runs.

---

## When NOT to Use ToT

| Situation | Why ToT hurts | Use instead |
|-----------|--------------|------------|
| Task has no clear intermediate states to score | Value function returns noise; search amplifies it | Self-Consistency or chaining |
| Self-Consistency N=5 already > 85% on your eval | ToT 30–50× cost for marginal gain | Stay with SC |
| Latency budget < 5s end-to-end | One ToT run easily takes 30–60 s | Plan-and-Solve, ReAct |
| No reliable evaluator exists | Garbage scores → garbage search | Chaining with validators |
| You're already on a reasoning model (o1, o3, Claude Extended Thinking, Gemini Thinking) | Model does internal search; you'd pay twice (anchor §7.2) | Direct prompt + thinking budget |
| Task is open-ended writing without a rubric | "Score this paragraph" is too subjective | Self-Refine with explicit rubric |

**The reasoning-model exception is the most important one for 2025.** Anthropic's own docs and OpenAI's reasoning-best-practices guide both say: stop hand-engineering search on top of a model that already does it internally. See [08-reasoning-models.md](08-reasoning-models.md).

---

## <a id="misconception-2-tot-is-just-cot--n"></a>Misconception 2 — "ToT is just CoT × N"

**The claim:** "ToT is just sampling N CoT chains and picking the best, right? So it's basically Self-Consistency with a fancier name."

**Why it's wrong:** ToT requires a *reliable value function*. If you cannot reliably score a partial thought, ToT is no better than sampling N paths and voting — at 5–10× higher cost (you pay for the evaluator on top of the proposals). The mechanism that makes ToT win is the *scorer + pruner*, not the branching.

**Smell test for whether ToT actually helps you:**

1. Write your value function.
2. Apply it 5 times to the same partial state at temperature 0.7.
3. Compute std-dev of the scores.
4. If std-dev > 0.2 (on a 0–1 scale), your evaluator is noise. ToT will burn money. Use Self-Consistency or chain with deterministic validators instead.

This is why ToT-with-pytest works and ToT-with-LLM-judge often doesn't. The deterministic verifier is the lifeline.

**Related caveat — Misconception 7:** "If GPT-4 fails, ToT will save me." If the model lacks the underlying knowledge or a reliable scorer, search amplifies the failure rather than fixing it. ToT lifts *planning* tasks; it does not inject *knowledge*. For knowledge gaps, use [Generate Knowledge](04-generate-knowledge.md) or real RAG (Session 8).

---

## Cost Reality — 30–50× Tokens

From anchor §4.1:

| Method | Token multiplier vs single CoT call |
|--------|------------------------------------|
| Plan-and-Solve | 1.1× |
| Self-Consistency (N=5) | 5× |
| ReAct (5 turns) | 5–15× |
| **ToT (b=3, d=3, k=5)** | **30–50×** |
| Reflexion (5 trials) | 5–20× |

Math behind the multiplier:
- Proposals: `depth × beam × k` proposal calls
- Evaluations: `depth × beam × k` evaluation calls (some implementations batch)
- Approx total LLM calls for `b=3, d=3, k=5`: `≈ 2 × 3 × 3 × 5 = 90 calls`

**The doubled-cost trap (anchor §5.6):** if you run ToT on top of a reasoning model, the model is *also* doing internal search. You're paying for two searches and the outer one is worse than the model's native one. Don't.

**Mitigation:**
- Use a cheap model for proposals (`gpt-4o-mini`) and a strong model only for evaluation ("draft-and-verify"). Often within 5% of full ToT cost at 3–5× cheaper.
- Cache the value function aggressively. At temperature 0 and identical state, it's deterministic — store `hash(node_state + model) → score` and you'll get cache hits inside the same run (anchor §5.5).
- Replace ToT with Self-Consistency N=5 as the first experiment. If SC gets within 5% of ToT, ship SC.

---

## Editorial Notes

- **The Game-of-24 number (4% → 74%) is the most copy-pasted statistic in prompt engineering.** Always teach it with the asterisk: that delta requires (a) catastrophic-early-commit task structure and (b) a cheap, reliable evaluator. Most production tasks meet neither.
- **The value function is everything.** Show the audience the smell test (std-dev across re-scores). Engineers who've shipped code review tools immediately recognise this as the same trap as flaky tests — and they instinctively trust deterministic verifiers more than LLM judges.
- **Connect to Session 5 explicitly.** "In Session 5 you used CoT — one chain, left to right. Self-Consistency added N parallel chains with voting. ToT adds *branching*, *scoring*, and *pruning*. Three orthogonal mechanisms."
- **The 'CoT is print-debugging, ToT is a stepping debugger that can rewind' analogy (anchor §9.1)** lands every time. Engineers know rewinding state is a fundamentally different capability from logging.
- **Show the search tree in MLflow live.** The visceral moment is watching the tree expand and prune in the UI. The 90-call cost shows up in the cost metric next to it. Both numbers in one screen — engineers internalise the trade-off in seconds.

---

## References

| Source | Used for |
|--------|----------|
| Yao et al. 2023 — arXiv:2305.10601 (NeurIPS 2023) | ToT mechanism, Game of 24 4%→74%, Mini Crosswords, Creative Writing |
| princeton-nlp/tree-of-thought-llm (GitHub) | Reference implementation; the "sure/maybe/impossible" evaluator |
| Huang et al. 2023 — arXiv:2310.01798 | Why LLM-judged value functions degrade self-correction; carries through to ToT evaluators |
| Anthropic Extended Thinking docs | The "paying twice" trap when running ToT on a reasoning model |
| OpenAI reasoning-best-practices | "Asking a reasoning model to reason more may hurt performance" — applies to ToT-on-o1 |
| anchor §2.1, §5.2, §5a.5, §8 (Misconceptions 2 & 7) | RCA tree example, BFS code, MLflow logging, misconceptions |
| MLflow Tracing docs (3.10+) | `@mlflow.trace(name=, span_type=, attributes=)`, `mlflow.start_span`, `mlflow.update_current_trace`, `mlflow.log_table`, `mlflow.search_traces` |
| LearnPrompting — Tree of Thoughts | [learnprompting.org/docs/advanced/decomposition/tree_of_thoughts](https://learnprompting.org/docs/advanced/decomposition/tree_of_thoughts) — diagrams |
