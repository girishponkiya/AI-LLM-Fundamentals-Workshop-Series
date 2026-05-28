# 04 — Generate Knowledge Prompting

**Overview:** Generate Knowledge is the *prompt-only* proxy for RAG. Two LLM calls: (1) ask the model to dump relevant background facts about the question; (2) feed those facts + the original question into a second call that produces the answer. No embedding index, no vector store, no retrieval pipeline. It works because parametric knowledge that doesn't surface in a single call often *does* surface when you ask for it explicitly — once it's in the context window, attention can use it. **Critical caveat:** the technique amplifies hallucinations when the model's parametric knowledge is wrong. Real RAG with grounded retrieval is Session 8's topic.

**Cross-references:** [01-landscape.md](01-landscape.md) — Generate Knowledge is Family 4 (External Grounding) — though "external" is misleading; the source is still the model's own weights. [05-react.md](05-react.md) — ReAct grounds with real tool calls; Generate Knowledge grounds with self-retrieval. [06-secondary-techniques.md](06-secondary-techniques.md) — Step-Back is the close cousin (abstract first, then specifics). [07-decision-framework.md](07-decision-framework.md) — when to pick Generate Knowledge vs RAG vs Step-Back. **Session 8 (forthcoming)** — full RAG: embedding index, retrieval, citations. Use Generate Knowledge until you build that infrastructure; switch when correctness matters.

---

## Definition

**Generate Knowledge Prompting** — Liu et al. 2021, arXiv:2110.08387 (ACL 2022). A two-call pattern:

1. **Call 1 (knowledge generation):** "Given the question, generate background knowledge that would help answer it." The output is a list of facts, definitions, or rules. No final answer yet.
2. **Call 2 (answering):** "Given this background knowledge and the question, answer the question." The first call's output becomes context for the second.

```
       ┌────────────────────────────┐
       │ Question: <user query>     │
       └─────────────┬──────────────┘
                     │
         ┌───────────▼───────────┐
         │ Call 1: Generate      │
         │ background knowledge  │
         └───────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Knowledge (5–8 bullets)│
        └───────────┬────────────┘
                    │
        ┌───────────▼────────────┐
        │ Call 2: Answer using   │
        │ knowledge + question   │
        └───────────┬────────────┘
                    │
                    ▼
                [ answer ]
```

The "two calls" framing matters: knowledge generation and answering have *different* prompt anatomies (different role, different task, different output format) — keep them in separate calls.

---

## Why It Works — Parametric Knowledge → Context Window

LLM weights store a lot. The trick is that a single forward pass doesn't always surface what's in there.

**The mechanism:**
- The model's parametric knowledge is conditioned on the entire prompt. Asking "how do I fix this OAuth2 502?" activates some subspace of the weights.
- But asking *first* "explain the OAuth2 token-refresh architecture and its error codes" forces the model to emit that knowledge *as tokens*. Those tokens then become explicit conditioning context for the next call.
- This is the same autoregressive mechanism that makes CoT work (Session 5 §04). Tokens in the context window are stronger conditioning than parametric knowledge alone.

In short: Generate Knowledge moves latent parametric knowledge into explicit context, where attention can use it the same way it would use retrieved documents.

**An equivalent framing:** the LLM acts as its own retriever — no embedding index needed. The cost is two LLM calls (~2× tokens) instead of one LLM call + one retrieval call. The upside is zero retrieval infrastructure.

---

## Key Result — Liu et al. 2022

State-of-the-art at the time of publication (2021–2022, pre-GPT-3.5) on three commonsense benchmarks. Tested with GPT-3 175B and T5-11B.

| Benchmark | Baseline | + Generated Knowledge | Δ |
|-----------|----------|----------------------|----|
| NumerSense (numerical commonsense) | Prior SOTA | **SOTA** | reported gain on multiple base models |
| CommonsenseQA 2.0 | Prior SOTA | **SOTA** | reported gain on multiple base models |
| QASC (science exam) | Prior SOTA | **SOTA** | reported gain on multiple base models |

Liu et al. 2022, arXiv:2110.08387, *Generated Knowledge Prompting for Commonsense Reasoning*.

The 2025 reality is more nuanced: frontier RLHF-tuned models (GPT-4, Claude 4, Gemini 2.5) often surface that knowledge on a *single* call. The Generate Knowledge delta has narrowed on commonsense tasks but remains useful when (a) the knowledge is specialised, (b) the model needs prompting to slow down before answering, or (c) you're using a smaller / less RLHF-tuned model.

---

## Engineering Example — Deprecated API Code Review

**Scenario:** Your team is migrating from AWS SDK for JavaScript v2 to v3. A junior engineer submits a PR. You want an LLM reviewer to flag v2 idioms and propose v3 rewrites.

**Why Generate Knowledge fits here:**
- The model knows AWS SDK v2 → v3 deprecation rules — but on a single pass, it often gives generic "looks fine to me" reviews.
- Forcing it to *first* list the deprecation rules makes the second call do a targeted check rather than a vibe check.

```python
"""
deprecated_api_review.py — AWS SDK v2 → v3 migration reviewer
using Generate Knowledge prompting.
"""

from anthropic import Anthropic
client = Anthropic()

MODEL = "claude-sonnet-4-6"


# ── Call 1: Generate domain knowledge ─────────────────────────────────────────
KNOWLEDGE_SYSTEM = """You are an AWS SDK migration expert.
List the most important deprecation rules and recommended replacements when
migrating from AWS SDK for JavaScript v2 to v3.

Output a numbered list. For each rule:
- v2 pattern (concrete code shape, e.g. `new AWS.S3()`)
- v3 replacement (concrete code shape, e.g. `new S3Client()` + `send()`)
- Why it changed (modular imports, middleware stack, etc.)

Be precise. No generic advice. 8-12 rules."""


def generate_knowledge() -> str:
    resp = client.messages.create(
        model=MODEL, max_tokens=2000,
        system=KNOWLEDGE_SYSTEM,
        messages=[{"role": "user",
                   "content": "Generate the v2 → v3 migration rules."}],
    )
    return resp.content[0].text


# ── Call 2: Apply knowledge to a diff ─────────────────────────────────────────
REVIEW_SYSTEM = """You are a senior reviewer evaluating an AWS SDK v2 → v3
migration PR. Use the deprecation rules provided below as your reference.

<deprecation_rules>
{knowledge}
</deprecation_rules>

For each violation found in the diff:
1. Cite the rule number from the deprecation rules
2. Quote the offending line(s)
3. Provide the corrected v3 code
4. Mark severity: BLOCKER (v2 import remains) | WARNING (deprecated pattern) | NIT (style)

Output as STRICT JSON:
{{
  "findings": [
    {{"rule_id": int, "line_range": "L<start>-L<end>", "before": str,
      "after": str, "severity": "BLOCKER|WARNING|NIT", "rationale": str}}
  ],
  "summary": str
}}

If no violations are found, return `findings: []` with a summary stating so."""


def review_diff(diff: str, knowledge: str) -> dict:
    import json
    resp = client.messages.create(
        model=MODEL, max_tokens=2000,
        system=REVIEW_SYSTEM.format(knowledge=knowledge),
        messages=[{"role": "user",
                   "content": f"<diff>\n{diff}\n</diff>"}],
    )
    return json.loads(resp.content[0].text)


# ── Orchestration ─────────────────────────────────────────────────────────────
def review_pr(diff: str) -> dict:
    knowledge = generate_knowledge()      # cache this per session — it's stable
    return review_diff(diff, knowledge)
```

**Why this is better than a single-call review:**
- The deprecation rules are *explicit and citable* — the reviewer can point at "rule 4" rather than waving in the direction of a v3 best practice.
- The rules are a **stable artefact** — generate them once per session (or per model version) and cache. Run all PRs against the cached rule set.
- Failures are diagnosable — if the reviewer misses a v2 pattern, you can inspect the knowledge call and see whether the rule was even listed.

**Same pattern works for:**
- Java 8 → 17 (collections, Optional, var)
- Python 2 → 3 (print, division, byte strings)
- React class components → hooks
- COBOL → Python (anchor supplementary — generate the business rules first, port second)
- OAuth1 → OAuth2 (anchor supplementary OAuth2 502 debug)

---

## When to Use — Decision Rubric

The question every engineer should ask before reaching for Generate Knowledge:

```
Is the answer in the model's weights?
├── No → use real retrieval (RAG, Session 8) or ReAct with a search tool
└── Yes — but doesn't surface reliably on a single call?
    │
    ├── Need first-principles reasoning? → Step-Back Prompting
    │     (anchor §2.6 — "what category does this fall into?")
    │
    ├── Need explicit facts/rules listed? → Generate Knowledge (this file)
    │
    └── Need both? → Step-Back → Generate Knowledge → Answer (chain them)
```

**Concrete differences:**

| | Generate Knowledge | Step-Back | RAG (Session 8) |
|--|-------------------|-----------|-----------------|
| **What's surfaced** | Concrete facts, rules, definitions | Abstract category / first principles | Retrieved documents from a corpus |
| **Source** | Model weights | Model weights | External index |
| **Citable?** | No (no source attribution) | No | Yes (document IDs, URLs) |
| **Best for** | Specialised but stable knowledge | "Which category does this fall into?" | Current data, internal docs, anything needing citations |
| **Failure mode** | Hallucinated rules | Wrong category → wrong principle | Stale or missing documents |
| **Setup cost** | Zero | Zero | Embedding index + retrieval pipeline |
| **Per-call cost** | ~2× | ~2× | 1× LLM + 1× retrieval |

**Use Generate Knowledge when:**
- The knowledge is specialised but the model has seen it (deprecation rules, common security patterns, well-documented APIs).
- You don't have retrieval infrastructure (yet).
- You can cache the knowledge artefact across requests.
- You're prototyping and want to validate the approach before building RAG.

**Use Step-Back when:** the question is specific and you suspect the model needs to ground in first principles first (K8s pod failures by category, PostgreSQL deadlock by isolation level). See [06-secondary-techniques.md](06-secondary-techniques.md).

**Use RAG when:** you need citations, your knowledge changes (Confluence, runbooks, JIRA), or correctness is non-negotiable.

---

## Critical Warning — Amplifies Hallucinations

**This is the most important caveat in this file.** If the model's parametric knowledge is *wrong*, Generate Knowledge bakes that error into the answer.

The failure pattern:
1. Call 1: model confidently generates wrong "knowledge" — e.g. "AWS Lambda timeout default is 30 seconds" (actually 3 seconds).
2. Call 2: now uses the wrong fact as authoritative context.
3. Output: confident, plausible, internally consistent — *and wrong*.

This is structurally the same as the post-hoc rationalisation failure mode of CoT (Session 5 §04). The reasoning chain *looks* right; the foundation is wrong.

**Mitigations:**

| Mitigation | When it helps |
|------------|--------------|
| Cite-or-decline prompt in Call 1 | Forces model to mark uncertain facts; better than blind generation |
| Spot-check the knowledge artefact | If you cache it, review it once; reuse with confidence |
| Cross-check against deterministic sources | For code/API stuff, parse the actual SDK docs (then you've built RAG anyway) |
| **Switch to real RAG** | When stakes are high enough that hallucinated facts matter |

**Never use Generate Knowledge for:**
- Ground-truth Q&A with users (customer support over your real docs)
- Anything where citations are required
- Frequently-updated knowledge (versions, prices, configs, schedules)
- Medical, legal, financial advice
- Anything where "confidently wrong" is worse than "I don't know"

For any of these → use real RAG (Session 8) with retrieval over your authoritative corpus.

---

## Editorial Notes

- **Frame Generate Knowledge as the prompt-only proxy for RAG.** It's the right starting point when you want the RAG *behaviour* without yet building the RAG *infrastructure*. Engineers prototyping LLM features land here naturally.
- **The "amplifies hallucinations" warning is the most important slide.** Engineers see the two-call pattern, think "this is RAG", and trust the output the way they'd trust retrieved documents. Show a concrete example where Call 1 emits a wrong fact and Call 2 produces a confident wrong answer. The audience needs to *feel* the failure mode.
- **Cache Call 1 aggressively.** The knowledge artefact is stable across many requests in the same session. This brings the cost back to ~1.05× single-call for amortised workloads.
- **Don't oversell the technique on 2025 frontier models.** A direct prompt to GPT-4 or Claude 4 often surfaces the same knowledge on the first try. Show the Liu 2022 result, then say "on a small or older model, the delta is bigger. On modern RLHF models, you may not need this." Be honest about diminishing returns.
- **Connect to Session 8 explicitly.** "If you find yourself wanting citations or verifying the knowledge artefact, you've grown into needing RAG. That's Session 8."
- **The rubber-duck analogy (anchor §9.1):** "Rubber-duck yourself to surface latent context." Works well for engineers who've debugged something by explaining it to a colleague.

---

## References

| Source | Used for |
|--------|----------|
| Liu et al. 2022 — arXiv:2110.08387 | Two-call pattern, NumerSense / CSQA 2.0 / QASC SOTA results |
| Anchor §2.3 | Definition, AWS SDK v2 → v3 engineering example |
| Anchor §6.4 | Hallucination-amplification failure mode |
| Anchor §9.1 | "Rubber-duck yourself" analogy |
| LearnPrompting — Generated Knowledge | [learnprompting.org/docs/intermediate/generated_knowledge](https://learnprompting.org/docs/intermediate/generated_knowledge) — step-by-step walk-through |
| Session 8 (forthcoming) | Real RAG with retrieval + citations — the production answer when Generate Knowledge isn't enough |
| Anthropic prompt-caching docs | Cache the knowledge artefact (Call 1's output) across the session for 90% cost reduction |
