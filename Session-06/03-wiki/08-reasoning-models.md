# 08 — Reasoning Models: The 2024-25 Playbook Shift

## 1. Overview

Reasoning models (OpenAI o1/o3/o4-mini, Anthropic Claude Extended Thinking, Google Gemini Thinking, DeepSeek R1) bake the reasoning loop into the model itself via reinforcement learning on long internal chains of thought. The prompting contract changes: instructions that were essential for GPT-4 class models are now redundant — and frequently *harmful* — on reasoning models.

This file is the engineering reference for that shift. Read it after you have internalised the classical techniques in:

- [02-tree-of-thoughts.md](./02-tree-of-thoughts.md) — search-based scaffolding that reasoning models partially subsume.
- [05-react.md](./05-react.md) — tool use, which remains orthogonal to internal reasoning.
- [07-decision-framework.md](./07-decision-framework.md) — when to pick a reasoning model vs a chat model + scaffolding.
- [09-production.md](./09-production.md) — cost, latency, and observability implications.
- Session 5's [04-chain-of-thought.md](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/04-chain-of-thought.md) — particularly the "2025 Nuance: When CoT HURTS" section (lines 207-258) which previews everything below.

## 2. The 2024-25 Playbook Shift

The biggest disruption since Session 5 was written is this: the technique that defined modern prompt engineering — "Let's think step by step" — is now an explicit anti-pattern on the strongest commercially available models. OpenAI, Anthropic, and Google have each shipped models that perform multi-step deliberation *internally*, billed at a separate "thinking tokens" rate, controlled by parameters rather than prompt text. If you are still hand-engineering CoT or ToT on top of a reasoning model, you are paying twice and getting worse results. The rest of this file is the new contract.

## 3. OpenAI o1 / o3 / o4-mini

Source: [platform.openai.com/docs/guides/reasoning-best-practices](https://platform.openai.com/docs/guides/reasoning-best-practices).

Verbatim guidance from OpenAI:

- *"Keep prompts simple and direct."*
- *"Avoid chain-of-thought prompts — since these models perform reasoning internally, prompting them to 'think step by step' is unnecessary."*
- *"Try zero shot first, then few shot if needed."*
- *"Asking a reasoning model to reason more may actually hurt the performance."*
- Use the `"developer"` role instead of `"system"` for `o1-2024-12-17` and later.

From the OpenAI cookbook for o3 / o4-mini tool use ([cookbook.openai.com](https://cookbook.openai.com/examples/o-series_tool_use)): *"Since these models are reasoning models and produce an internal chain of thought, they do not have to be explicitly prompted to plan and reason between tool calls."*

```python
from openai import OpenAI

client = OpenAI()

# Correct: minimal, direct, no CoT scaffolding.
response = client.chat.completions.create(
    model="o3",
    reasoning_effort="medium",   # "low" | "medium" | "high"
    messages=[
        {"role": "developer", "content": "You are a senior SRE."},
        {"role": "user", "content":
            "Given these 200 lines of nginx logs, identify the root cause "
            "of the 502 spike between 14:02 and 14:11 UTC.\n\n" + logs},
    ],
)
```

What you do **not** add: "Let's think step by step", "First, list each request...", "Reason carefully before answering". Each of these inflates reasoning-token cost and can degrade accuracy.

## 4. Anthropic Claude Extended Thinking

Source: [docs.anthropic.com/en/docs/build-with-claude/extended-thinking-tips](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking-tips).

The Anthropic contract is slightly looser than OpenAI's: you may give a *high-level intent* to think deeply, but not a *prescriptive* CoT recipe. For Claude 4.x: *"If your prompts previously encouraged the model to be more thorough or use tools more aggressively, dial back that guidance."*

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=16000,
    thinking={"type": "enabled", "budget_tokens": 8000},
    messages=[{
        "role": "user",
        "content": (
            "Diagnose the deadlock from this stack trace and propose a fix. "
            "Think carefully about lock ordering."
            # No "Step 1, Step 2..." scaffolding. The thinking budget does that work.
            f"\n\n{stack_trace}"
        ),
    }],
)
# response.content includes thinking blocks + final text blocks.
```

### The `think` Tool

Source: [anthropic.com/engineering/claude-think-tool](https://www.anthropic.com/engineering/claude-think-tool).

A callable tool — registered the same way as any other tool — that the model can invoke mid-trajectory to deliberate without producing user-visible output. This gives finer-grained control than extended thinking for agentic workflows: the model can pause inside a tool-use loop, jot reasoning, and continue.

Anthropic reports **+54% pass^1** on the Tau-Bench airline domain when the `think` tool is available vs not. For Session 6 demos this is the highest-leverage agent-side primitive to know.

```python
tools = [
    {
        "name": "think",
        "description": "Use this to deliberate before acting. Output is private.",
        "input_schema": {
            "type": "object",
            "properties": {"thought": {"type": "string"}},
            "required": ["thought"],
        },
    },
    # ... your real tools (search_flights, book_ticket, etc.)
]
```

## 5. Google Gemini Thinking

Source: [ai.google.dev/gemini-api/docs/thinking](https://ai.google.dev/gemini-api/docs/thinking).

The Gemini Thinking parameter is `thinkingBudget`, in tokens:

- `0` — disables thinking.
- `-1` — dynamic thinking; the model picks a budget per-request based on complexity.
- positive integer — explicit token budget (e.g. `8192`).

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-2.5-pro",
    contents="Diagnose the root cause from these logs:\n\n" + logs,
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_budget=8192,   # tokens; -1 = dynamic; 0 = off
        ),
    ),
)
```

### Gemini 3 Migration

With Gemini 3 models Google recommends migrating to the newer `thinking_level` parameter (categorical: `"low"` / `"medium"` / `"high"`). `thinkingBudget` remains supported for backward compatibility.

**Important:** `reasoning_effort` (OpenAI-style) and `thinking_level` / `thinkingBudget` cannot be used simultaneously. If you proxy Gemini through an OpenAI-compatible adapter, pick one; mixing them errors out.

## 6. What Becomes Redundant

Reasoning models perform these internally. Stop wrapping them on top:

| Technique | Why it's redundant |
|---|---|
| **Zero-shot CoT** ("Let's think step by step") | The model does this natively in its hidden chain. |
| **Plan-and-Solve** | Internal planning is part of the RL objective. |
| **Complexity-based prompting** | The model self-adjusts; `reasoning_effort` is the right knob. |
| **Auto-CoT** (exemplar mining of reasoning traces) | Exemplar traces conflict with the model's own style. |
| **Self-Consistency** *for offline tasks* | The model aggregates internally; explicit N-sample voting is double work. |
| **Tree-of-Thoughts** *for most use cases* | Internal search replaces ToT for non-game-tree problems. See [02-tree-of-thoughts.md](./02-tree-of-thoughts.md) for the residual cases. |
| **Maieutic prompting** | Iterative self-questioning is folded into the thinking phase. |

## 7. What Stays Valuable

Reasoning is internal. Everything *around* reasoning is still your job.

| Technique | Why it survives |
|---|---|
| **Decomposition / prompt chaining** | Task structure, validators, and dead-letter queues are infrastructure, not reasoning. See [03-prompt-chaining.md](./03-prompt-chaining.md). |
| **ReAct** | Tool use is orthogonal to reasoning. The model still needs your tool catalogue and stopping conditions. See [05-react.md](./05-react.md). |
| **PoT (Program-of-Thoughts)** | A Python interpreter is more accurate than any LLM at arithmetic, dates, and unit conversion. |
| **Faithful CoT** | Translation to a typed/executable language gives you a real verifier. |
| **Reflexion** | Cross-trial episodic memory persists outside the model's context window. |
| **Constitutional critique** | Explicit principle enforcement on user-facing outputs; the critic must have external grounding (rubric, lint, tests). |
| **System 2 Attention (S2A)** | Context cleaning still matters — reasoning models still suffer from noisy inputs and prompt injection. |
| **Thread-of-Thought (ThoT)** | Long-context navigation and re-grounding. |
| **Skeleton-of-Thought (SoT)** | Latency is still latency; parallel section generation is independent of reasoning quality. |

## 8. The Doubled-Cost Trap

Reasoning models bill thinking tokens at the output rate (often 5-10x the input rate of a comparable chat model). If you also wrap them in ToT, Self-Consistency, or explicit CoT, you pay for:

1. Your scaffold's extra prompt tokens.
2. The model's hidden reasoning tokens (which your scaffold *triggered more of*).
3. Whatever output you actually wanted.

The Wharton GAIL Lab 2025 measurement on o3-mini: average accuracy gain from explicit CoT instructions was **+2.9%** at **+20-80% more tokens**. ROI is negative on almost every realistic task. A chain on `gpt-4o-mini` often beats a single `o1` call on production tasks at a fraction of the cost — measure before migrating.

## 9. Emerging 2024-25 Techniques

These are not yet canonical but each is shipping in production agents at major labs:

- **Self-Discover** (Zhou et al. 2024, [arXiv:2402.03620](https://arxiv.org/abs/2402.03620)) — the model composes its own reasoning structure at inference time from a library of "reasoning modules". Reported +20% over CoT-SC on BBH and MATH at 10-40x less compute than ToT.
- **Distilling System 2 into System 1** (Yu, Sukhbaatar, Weston 2024, [arXiv:2407.06023](https://arxiv.org/abs/2407.06023)) — train smaller models to produce correct outputs *without* explicit reasoning traces, preserving accuracy at System 1 latency. Relevant when you want o1-like quality at gpt-4o-mini cost.
- **Branch-Solve-Merge** (Saha et al. 2023, [arXiv:2310.15123](https://arxiv.org/abs/2310.15123)) — divide-and-conquer for long-form generation: branch the task into parallel sub-problems, solve, merge. Like Graph-of-Thoughts without the full graph machinery.
- **Anthropic `think` tool** — first-class tool call for in-trajectory deliberation in agentic settings. More controllable than blanket extended thinking. See §4.
- **Test-time compute scaling laws** — OpenAI, DeepMind, and Anthropic research now treats inference compute as a primary axis: accuracy scales with thinking tokens in predictable power-law relationships. ToT, Reflexion, and reasoning models are unified as different ways to spend inference compute.
- **Process Reward Models (PRMs)** — score every reasoning step, not just the final answer. Enables targeted Self-Refine (fix the wrong step, not the whole draft) and better ToT value functions.

## 10. Multimodal Variants

Most techniques transfer to vision-language models with minor modification:

- **Multimodal CoT** (Zhang et al. 2023, [arXiv:2302.00923](https://arxiv.org/abs/2302.00923)) — CoT with image tokens. Outperforms language-only CoT on ScienceQA.
- **ToT for visual problems** — propose visual hypotheses ("the error is in the chart's axis labelling"), evaluate visually. Works on GPT-4o and Gemini 2.5.
- **ReAct + vision tools** — Observation steps become `describe_image(frame)`, `ocr(region)`, `detect_objects(frame)`.
- **PoT for data charts** — model reads chart pixels and writes pandas code against the implied dataframe; the interpreter is the verifier.
- **S2A and SoT extensions** — S2A for image region cropping before the actual question; SoT for per-page parallel summarisation of multi-page documents.

**Caveat:** EmotionPrompt-style emotional stimuli ("This is very important to my career") appears weaker on vision tasks — less evidence in the literature, and the few measured cases show null or negative effects.

## 11. Editorial Note — The Surprising Finding

From the §9.3 research summary: this is the single most counterintuitive finding from the 2024-25 prompt-engineering literature:

> **OpenAI explicitly tells you to stop using CoT on o1.** Six months ago "Let's think step by step" was the foundational trick; now it is an anti-pattern on the strongest models.

It is also the cleanest lesson about over-fitting to a moving target. Anything you memorise as a "prompt engineering rule" has a half-life. Re-run your eval set every major model release; do not assume yesterday's best practice survives.

## 12. References

| Source | URL / ID |
|---|---|
| OpenAI reasoning best practices | [platform.openai.com/docs/guides/reasoning-best-practices](https://platform.openai.com/docs/guides/reasoning-best-practices) |
| OpenAI cookbook — o3/o4-mini tool use | [cookbook.openai.com](https://cookbook.openai.com/) |
| Anthropic extended thinking tips | [docs.anthropic.com/en/docs/build-with-claude/extended-thinking-tips](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking-tips) |
| Anthropic `think` tool | [anthropic.com/engineering/claude-think-tool](https://www.anthropic.com/engineering/claude-think-tool) |
| Google Gemini Thinking | [ai.google.dev/gemini-api/docs/thinking](https://ai.google.dev/gemini-api/docs/thinking) |
| Self-Discover | [arXiv:2402.03620](https://arxiv.org/abs/2402.03620) |
| Distilling System 2 into System 1 | [arXiv:2407.06023](https://arxiv.org/abs/2407.06023) |
| Branch-Solve-Merge | [arXiv:2310.15123](https://arxiv.org/abs/2310.15123) |
| Multimodal CoT | [arXiv:2302.00923](https://arxiv.org/abs/2302.00923) |
| Huang et al. — LLMs Cannot Self-Correct Reasoning Yet | [arXiv:2310.01798](https://arxiv.org/abs/2310.01798) |
| Inverted-U curve for CoT length | [arXiv:2502.07266](https://arxiv.org/abs/2502.07266) |
| Wharton GAIL Lab 2025 — CoT on o3-mini | See Session 5 [04-chain-of-thought.md](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/04-chain-of-thought.md) §"When CoT HURTS" |
