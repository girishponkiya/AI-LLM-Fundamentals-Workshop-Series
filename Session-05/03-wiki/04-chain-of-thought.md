# 04 — Chain-of-Thought (CoT) Prompting

**Overview:** Chain-of-Thought prompting makes the model generate intermediate reasoning steps before the final answer. It works because of a fundamental property of autoregressive generation: generated tokens become conditioning context. This section covers the mechanism (connecting to Session 3), both forms of CoT, key benchmarks, engineering use cases, and — critically — a 2025 nuance about when NOT to use it.

**Cross-references:** [01-history.md §Epoch 4](01-history.md) — ICL at scale is the foundation. [03-zero-few-shot.md §Zero-Shot CoT](03-zero-few-shot.md) — Zero-shot CoT is covered there. [05-self-consistency-meta.md](05-self-consistency-meta.md) — Self-Consistency builds on CoT. [06-decision-framework.md](06-decision-framework.md) — when to use CoT vs other techniques.

---

## Definition

Chain-of-Thought (CoT) prompting instructs the model to generate intermediate reasoning steps before providing a final answer. Instead of jumping directly from problem → answer, the model works through the problem step-by-step in the context window.

**Mechanical change to the prompt:**
- **Few-shot CoT:** Include demonstrations that show input + reasoning chain + output
- **Zero-shot CoT:** Append "Let's think step by step" (or equivalent) to the prompt

---

## The Autoregressive Mechanism — WHY CoT Works

This is the deep explanation. Most engineers know CoT works — few know why.

**The mechanism (connecting to Session 3):**

LLMs generate tokens autoregressively: each token is conditioned on all preceding tokens in the context window.

```
P(token_n | token_1, token_2, ..., token_{n-1})
```

When you ask a model to solve a problem in one step, it must "jump" from the problem statement to the answer using implicit pattern matching alone. For complex tasks, this implicit computation is insufficient.

**What CoT does:** It forces the model to write out intermediate reasoning steps as explicit tokens. Once written, those tokens become conditioning context for the next step. The reasoning chain is NOT just a display artifact — it IS the computation.

```
Without CoT:
Problem tokens → [implicit computation] → Answer token

With CoT:
Problem tokens → Step 1 tokens → Step 2 tokens → Step 3 tokens → Answer token
                     ↑ conditions          ↑ conditions          ↑ conditions
```

Each intermediate step is:
1. Verified by the model during generation (it's consistent with prior context)
2. A conditioning state that makes the next step more likely to be correct
3. Essentially a node in a computation graph instantiated in the context window

**Formal theory:** Joshi et al. (2025) proved that autoregressive CoT enables computation that base next-token prediction cannot perform — the token sequence IS a program execution. arXiv:2503.07932.

**Session 3 connection:** This is exactly why the autoregressive generation mechanism (Session 3) matters for practitioners. The "next token prediction" mechanism is the engine under CoT's hood.

---

## Two Forms of CoT

### 1. Few-Shot CoT (Wei et al. 2022)

Provide demonstrations that show the reasoning chain explicitly. The model learns the expected format and depth of reasoning from examples.

```python
COT_EXAMPLE = """
Incident: API gateway returning 503 errors intermittently, starting 14:23 UTC.
Metrics: 15% of requests failing. Latency p99: 12s (normal: 300ms). No CPU/memory alerts.

Reasoning:
1. 503 = upstream service unavailable. Gateway itself is running (latency is high, not 0).
2. 14:23 correlates exactly with deployment of payment-service v2.3.1 (checked deploy log).
3. p99=12s suggests timeout/retry loop, not capacity issue (would see CPU alerts).
4. 15% failure rate matches payment-service traffic proportion (non-payment routes OK).
5. Rolled back payment-service to v2.3.0 at 14:52 → errors stopped at 14:54.
Root cause: payment-service v2.3.1 introduced a regression causing request timeouts.
Action: Rollback complete. Post-mortem scheduled. Block v2.3.1 until fix validated.
"""

SYSTEM = f"""You are an incident commander analyzing production outages.
Work through each incident systematically. Show your reasoning.

Example:
{COT_EXAMPLE}
"""

# Usage
response = client.messages.create(
    model="claude-sonnet-4-6", max_tokens=1024, system=SYSTEM,
    messages=[{"role": "user", "content": f"Incident: {new_incident}"}]
)
```

**Benchmarks (Wei et al. 2022 — PaLM 540B):**

| Task | Standard Prompting | Few-Shot CoT | Gain |
|------|-------------------|--------------|------|
| GSM8K (Math Word Problems) | 17.9% | 56.9% | +39.0% |
| MAWPS (Arithmetic) | 67.9% | 93.0% | +25.1% |
| AQuA-RAT (Algebra) | 35.8% | 56.9% | +21.1% |

**Paper:** Wei et al. 2022 — arXiv:2201.11903

### 2. Zero-Shot CoT (Kojima et al. 2022)

Append "Let's think step by step" to a zero-shot prompt. No examples needed.

**Benchmarks (Kojima et al. 2022 — text-davinci-002):**

| Task | Zero-Shot | Zero-Shot CoT | Gain |
|------|-----------|---------------|------|
| MultiArith | 17.7% | 78.7% | +61.0% |
| GSM8K | 10.4% | 40.7% | +30.3% |
| AddSub | 69.6% | 85.5% | +15.9% |

**Paper:** Kojima et al. 2022 — arXiv:2205.11916

```python
# Zero-shot CoT — the simplest form
response = client.messages.create(
    model="claude-sonnet-4-6",
    messages=[{
        "role": "user",
        "content": f"{problem_description}\n\nLet's think step by step:"
    }],
    max_tokens=512
)
```

---

## Engineering Use Cases

CoT is most valuable for tasks that require multi-step reasoning — where the model would make logical leaps if forced to answer directly.

### 1. Incident Root Cause Analysis

```python
SYSTEM = """
You are an incident commander. Analyze incidents step-by-step.

Reasoning framework:
1. Characterize the symptoms (what, when, scope, rate)
2. Identify timeline correlations (deployments, config changes, traffic spikes)
3. Apply elimination (rule out components one by one)
4. Form hypothesis (most likely root cause)
5. Validate with evidence
6. State: Root cause, immediate action, post-mortem items

Output format:
Reasoning: [your step-by-step analysis]
Root cause: [specific, technical]
Immediate action: [rollback/hotfix/escalate]
"""
```

### 2. Story Point Estimation

```python
SYSTEM = """
You are a senior engineer estimating story points using Fibonacci scale (1,2,3,5,8,13,21).

Estimation process:
1. List the main implementation subtasks
2. Estimate hours for each (be specific: "write DB migration: 2h")
3. Sum total estimated hours
4. Apply complexity multiplier: simple task=1.0×, integration work=1.3×, risky/unknown=1.6×
5. Convert: <4h=1pt, 4-8h=2pt, 8-16h=3pt, 16-30h=5pt, 30-50h=8pt, >50h=13/21pt
6. Final estimate: [N] points. Confidence: [high/medium/low]. Key assumptions: [list]
"""
```

### 3. Security Code Review

```python
SYSTEM = """
You are a security engineer reviewing code for vulnerabilities.

Review process:
1. Identify all user-controlled inputs
2. Trace each input through the code
3. Check at each sink: SQL queries, file paths, shell commands, eval/exec, output rendering
4. Classify vulnerability type (OWASP category)
5. Assess exploitability and impact
6. Provide specific fix with corrected code

Show your reasoning trace for each identified issue.
"""
```

### 4. Architecture Decision Making

```python
SYSTEM = """
Analyze this architecture decision systematically.

Decision framework:
1. Restate the requirements and constraints
2. List viable options (at least 3)
3. For each option: evaluate against each requirement
4. Identify tradeoffs: performance, cost, operational complexity, team skill match
5. Identify disqualifying factors
6. Recommend with explicit reasoning

Output: Reasoning trace + final recommendation + key caveats.
"""
```

---

## 2025 Nuance: When CoT HURTS

This is the critical 2025 update. Most CoT guidance was written for pre-2024 models. The landscape has changed.

### Finding 1: Reasoning Models — Minimal Gain, High Cost

**Wharton GAIL Lab 2025:** Tested explicit CoT instructions on o3-mini across diverse task types.

Results:
- Average accuracy gain from explicit CoT: **+2.9%**
- Token cost increase: **+20–80% more tokens**
- ROI: Almost always negative

**Why:** Reasoning models (o1, o3, Claude Extended Thinking, DeepSeek R1) already perform CoT internally during their "thinking" phase. They were trained via RL to reason through problems before answering. Adding explicit CoT instructions makes them reason twice — once internally, once explicitly — at significant additional cost with minimal benefit.

**Rule for 2025:** If you're using a reasoning model, simplify your prompt. Don't add "Let's think step by step." Set an appropriate thinking budget and let the model work internally.

```python
# Standard IT/Chat model — CoT valuable
response = client.messages.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user",
        "content": f"{problem}\n\nLet's think step by step:"
    }]
)

# Reasoning model — simplify, set budget
response = client.messages.create(
    model="claude-sonnet-4-6",  # Extended Thinking via parameter
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 8000},
    messages=[{"role": "user", "content": problem}]  # No CoT instruction
)
```

### Finding 2: The Inverted-U Curve for CoT Length

**arXiv 2502.07266:** Accuracy as a function of CoT length follows an inverted-U curve:
- Too short CoT: insufficient reasoning → wrong answers
- Optimal range: clear, complete reasoning → best accuracy
- Too long CoT: overthinking, contradictions, backtracking → accuracy degrades

**Practical implication:** Don't instruct the model to "reason as much as possible" or "think very carefully through every detail." Specify the structure of the reasoning you want, not the volume.

```python
# Good: structured CoT with clear steps
"Analyze this in 4 steps: (1) identify symptoms, (2) correlate timeline, (3) eliminate causes, (4) state root cause."

# Bad: encourages over-reasoning
"Think very carefully and thoroughly through every possible consideration before answering."
```

### Finding 3: Post-hoc Rationalization

The most dangerous CoT failure mode. The model generates a confident, fluent, and internally consistent reasoning chain that leads to a WRONG answer.

**Example pattern:**
```
Problem: "Should we use Redis or Postgres for session storage at 50K RPS?"

Wrong CoT:
"Step 1: Redis is in-memory, so it's faster. ✓ [correct]
 Step 2: Sessions are read/written on every request. ✓ [correct]
 Step 3: At 50K RPS, Redis can handle this. ✓ [correct]
 Step 4: Postgres would be too slow for this volume. ← [plausible but wrong for many setups]
 Conclusion: Use Redis." ← [may be wrong depending on durability requirements]
```

The reasoning *sounds* correct but may be missing critical considerations (durability, failover, operational complexity). You cannot detect this from the output alone. You need an eval set with ground truth.

**Mitigation:** Self-Consistency (multiple independent paths → if they disagree, the post-hoc rationalization didn't dominate). See [05-self-consistency-meta.md](05-self-consistency-meta.md).

---

## When NOT to Use CoT

| Situation | Why CoT Hurts | Use Instead |
|-----------|--------------|-------------|
| Simple classification task | Wastes tokens; no reasoning needed | Zero-shot with clear label list |
| Using a reasoning model (o1, o3, Extended Thinking) | +2.9% gain at 20–80% more tokens | Simple direct prompt |
| Task requires factual recall (not reasoning) | CoT can introduce hallucinated "reasoning steps" | Zero-shot with specific facts in context |
| High-throughput, latency-sensitive pipeline | CoT generates more output tokens = higher latency + cost | Zero-shot or few-shot |
| Very short context window | CoT fills the window with reasoning, leaves no room for answer | Zero-shot or constrained CoT |

---

## CoT vs Zero-Shot CoT: When to Use Each

| Dimension | Few-Shot CoT | Zero-Shot CoT |
|-----------|-------------|---------------|
| **Examples needed** | Yes (3–5 with reasoning) | No |
| **Control over reasoning style** | High | Low |
| **Setup effort** | High | Minimal |
| **Best for** | Domain-specific reasoning, specialized tasks | General multi-step reasoning |
| **Performance** | Generally higher | Lower than few-shot CoT but still large gain over zero-shot |
| **Cost** | Higher (longer examples) | Lower |

**Rule of thumb:** Try zero-shot CoT first. If reasoning style or quality is insufficient, add few-shot CoT examples.

---

## Provider Differences

| Provider | CoT Guidance |
|---------|-------------|
| **Anthropic** | Standard Claude: CoT works well, explicit instructions or examples. Extended Thinking models: set budget_tokens, don't add CoT instructions — model reasons internally. |
| **OpenAI** | Standard models: "Let's think step by step" or few-shot CoT. o1/o3: use Responses API, don't add CoT instructions. |
| **Google Gemini** | Explicitly recommends multi-step reasoning prompts. Flash models: standard CoT. Gemini 2.0 Flash Thinking: reasoning model — simplify prompts. |

---

## Editorial Notes

- **The autoregressive mechanism explanation is the session's deepest technical moment.** Draw it on the board: show the token conditioning chain. Engineers with CS background will connect this to computation theory.
- **2025 nuance (reasoning models):** This is new. Many engineers are using o1/o3 or Extended Thinking and still adding "Let's think step by step" — wasting tokens. Show the Wharton GAIL numbers.
- **Session 3 explicit callback:** "In Session 3 you learned that transformers predict the next token conditioned on all prior tokens. CoT exploits this — it writes the computation into the context window."
- **Post-hoc rationalization warning:** Most engineers are impressed by CoT chains without questioning them. Show an example where the reasoning is fluent but the conclusion is wrong.

---

## References

| Source | Used for |
|--------|----------|
| Wei et al. 2022 — arXiv:2201.11903 | Few-shot CoT, benchmark numbers |
| Kojima et al. 2022 — arXiv:2205.11916 | Zero-shot CoT, "Let's think step by step" |
| Joshi et al. 2025 — arXiv:2503.07932 | Autoregressive CoT theory |
| Wharton GAIL 2025 | CoT on reasoning models: +2.9% at 20–80% more tokens |
| arXiv 2502.07266 | Inverted-U curve for CoT length |
| Anthropic Extended Thinking docs | Budget tokens, internal reasoning |
