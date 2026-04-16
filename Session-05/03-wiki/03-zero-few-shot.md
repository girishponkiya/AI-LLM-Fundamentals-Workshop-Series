# 03 — Zero-Shot & Few-Shot Prompting

**Overview:** The first two rungs of the Complexity Ladder. Zero-shot is always the starting point — the most cost-efficient baseline. Few-shot is the first escalation when output format or content is inconsistent. A surprising research finding from Min et al. 2022 changes how most engineers think about constructing few-shot examples.

**Cross-references:** [02-anatomy.md](02-anatomy.md) — few-shot examples are component 2 of the anatomy, placed in the system prompt for caching. [06-decision-framework.md](06-decision-framework.md) — when to escalate from zero-shot to few-shot (signal: format/content wrong). [07-production.md](07-production.md) — few-shot examples in system prompt benefit from Anthropic's prompt caching.

---

## Zero-Shot Prompting

### Definition

Instruction + input only. No demonstrations. The model draws on its pre-training knowledge and instruction-tuning alignment to perform the task.

**Mechanical change to the prompt:** Nothing is added. You write a task description and provide input. No examples.

```python
# Zero-shot bug classification
response = client.messages.create(
    model="claude-sonnet-4-6",
    system="""You are a bug triage assistant.
Classify bug reports by severity: Critical, High, Medium, Low.

Severity definitions:
- Critical: data loss, security breach, system unavailable
- High: major feature broken, no workaround
- Medium: feature partially broken, workaround exists
- Low: cosmetic, minor inconvenience

Output JSON: {"severity": str, "component": str, "confidence": "high|medium|low"}""",
    messages=[{"role": "user", "content": f'Bug: "{bug_description}"'}],
    max_tokens=256
)
```

### Why It Works

Zero-shot works because instruction-tuned models (Epoch 5) were trained on vast (instruction, response) pairs covering hundreds of task types. The model has seen "classify bug by severity" in thousands of variations during fine-tuning. When you provide a clear instruction + input, the model retrieves the learned task pattern.

**When zero-shot is sufficient:**
- Standard classification tasks with common labels (sentiment, priority, category)
- Standard extraction into a well-known schema
- Summarization with common format requirements
- Any task the model "knows" from training distribution

### Zero-Shot CoT — "Let's Think Step by Step"

Kojima et al. 2022 discovered that appending "Let's think step by step" (or equivalent) to a zero-shot prompt dramatically improves reasoning task performance — without any examples.

| Task | Zero-Shot Accuracy | Zero-Shot CoT Accuracy | Gain |
|------|--------------------|------------------------|------|
| MultiArith | 17.7% | 78.7% | +61.0% |
| GSM8K | 10.4% | 40.7% | +30.3% |
| AQUA-RAT | 31.9% | 45.3% | +13.4% |

**Paper:** Kojima et al. 2022 — arXiv:2205.11916

**How it works:** The magic phrase forces the model to generate intermediate reasoning tokens before producing an answer. Those intermediate tokens become conditioning context for the final answer — exploiting the autoregressive mechanism. See [04-chain-of-thought.md](04-chain-of-thought.md) for the deep explanation.

**Two-stage pattern for reliability:**

```python
# Stage 1: Elicit reasoning
stage1 = client.messages.create(
    model="claude-sonnet-4-6",
    messages=[{
        "role": "user",
        "content": f"{problem}\n\nLet's think step by step:"
    }],
    max_tokens=512
)
reasoning = stage1.content[0].text

# Stage 2: Extract final answer from reasoning
stage2 = client.messages.create(
    model="claude-sonnet-4-6",
    messages=[
        {"role": "user", "content": f"{problem}\n\nLet's think step by step:"},
        {"role": "assistant", "content": reasoning},
        {"role": "user", "content": "Therefore, the final answer is:"}
    ],
    max_tokens=64
)
```

### Zero-Shot Failure Modes

| Signal | Diagnosis | Fix |
|--------|-----------|-----|
| Output uses wrong labels | Model doesn't know your custom taxonomy | Add explicit definitions (always) or escalate to few-shot |
| Output format inconsistent across runs | No format spec | Add explicit JSON schema |
| Wrong answers on multi-step tasks | Task requires reasoning not explicit CoT | Add "Let's think step by step" → Zero-Shot CoT |
| Output still wrong after ZS-CoT | Task too complex for zero-shot | Escalate to few-shot or few-shot CoT |

**Escalation signal:** Zero-shot consistency < threshold on your eval set. See [06-decision-framework.md](06-decision-framework.md).

---

## Few-Shot Prompting

### Definition

Include 3–5 input→output demonstration pairs ("exemplars") in the prompt. The model infers the task pattern via In-Context Learning (ICL).

**Mechanical change to the prompt:** Add demonstrations in input→output format before the actual query. Usually placed in the system prompt for caching.

```python
FEW_SHOT_EXAMPLES = """
Examples:
Bug: "Login button sends password in plaintext over HTTP"
Output: {"severity": "Critical", "component": "auth", "confidence": "high"}

Bug: "Spell check underlines valid German words in the editor"
Output: {"severity": "Low", "component": "editor", "confidence": "high"}

Bug: "Dashboard takes 45 seconds to load for users with >1000 items"
Output: {"severity": "High", "component": "performance", "confidence": "high"}

Bug: "Password reset email sometimes arrives 2 hours late"
Output: {"severity": "Medium", "component": "notifications", "confidence": "medium"}
"""

SYSTEM = f"""You are a bug triage assistant for a Python backend team.
Classify bug reports by severity and component.

{FEW_SHOT_EXAMPLES}

Output JSON matching examples above. No prose."""

response = client.messages.create(
    model="claude-sonnet-4-6", max_tokens=256, system=SYSTEM,
    messages=[{"role": "user", "content": f'Bug: "{new_bug}"'}]
)
```

### Why It Works

Few-shot prompting exploits the same ICL mechanism as zero-shot, but provides explicit demonstrations. The model uses the examples to infer:
1. The expected output format (exactly how JSON should look)
2. The label space (which severity levels are valid)
3. The calibration (what counts as "Critical" vs "High" in your context)
4. The level of detail expected

Brown et al. 2020 showed that few-shot performance improves more rapidly with model scale than zero-shot — larger models are better meta-learners.

**Benchmarks (Brown et al. 2020 — GPT-3):**

| Task | Zero-Shot | One-Shot | Few-Shot (K=8+) |
|------|-----------|----------|-----------------|
| CoQA (F1) | 81.5 | 84.0 | 85.0 |
| TriviaQA (Acc) | 64.3% | 68.0% | 71.2% |
| WebQA (Acc) | 14.4% | 25.3% | 29.9% |

**Paper:** Brown et al. 2020 — GPT-3 — arXiv:2005.14165

---

## The Min et al. 2022 Surprise Finding

**Most engineers don't know this.** Min et al. (2022) ran a controlled experiment: what happens if you use **random (wrong) labels** in few-shot examples?

**Result:** Accuracy drops only 0–5%.

This defies the intuition that few-shot examples teach the model the right answer. What the examples actually provide:

1. **FORMAT** (most important): The input-output structure — JSON shape, label format, field names
2. **LABEL SPACE**: The set of valid output options (even if individual assignments are wrong)
3. **INPUT DISTRIBUTION**: What examples of this task look like
4. **NOT the individual label correctness**: Surprisingly, whether each specific example maps to the right answer matters very little

**Practical implication for engineers:**

You don't need perfectly curated, carefully labeled examples. You need:
- Well-formatted examples (critical)
- Examples that cover your label space (critical)  
- Examples that represent the distribution of real inputs (important)
- Correct labels: nice to have but not the primary driver

**Paper:** Min et al. 2022 — "Rethinking the Role of Demonstrations" — arXiv:2202.12837

**Engineering takeaway:** If you're struggling to curate perfect examples, focus on format quality and distribution coverage first. Don't spend 3 days labeling 50 examples perfectly when 5 well-formatted ones covering the label space may work just as well.

---

## Example Selection Guidelines

Given Min et al.'s finding, here's what to optimize for:

### 1. Cover the Label Space

Include at least one example per valid output class. For a 4-class severity model: include one Critical, one High, one Medium, one Low example.

### 2. Match Real Input Distribution

Use examples from actual production inputs — not synthetic toy examples. If 80% of real bugs are "High" or "Medium", include more examples of those.

```python
# Good: from real data, covers label space
examples = [
    ("Login sends password in plaintext", "Critical"),      # covers Critical
    ("Dashboard loads in 45s for large accounts", "High"),  # covers High
    ("Password reset email sometimes delayed", "Medium"),   # covers Medium
    ("Spell check underlines valid words", "Low"),          # covers Low
    ("Auth token expires without warning", "High"),         # second High — most common
]

# Bad: synthetic, biased toward simple cases
examples = [
    ("App crashes", "Critical"),
    ("Button misaligned", "Low"),
]
```

### 3. Include Edge Cases

Add at least one near-boundary example — a bug that could reasonably be classified as either of two adjacent severities. This teaches the model your team's calibration.

### 4. Quality > Quantity

3–5 high-quality, diverse examples outperform 10+ low-quality or repetitive examples. Context window budget is real.

### 5. Use Anthropic XML Tags for Examples

```python
system = """
You are a bug triage assistant.

<examples>
<example>
<input>Bug: "Login sends password in plaintext over HTTP"</input>
<output>{"severity": "Critical", "component": "auth"}</output>
</example>

<example>
<input>Bug: "Dashboard takes 45 seconds to load for users with >1000 items"</input>
<output>{"severity": "High", "component": "performance"}</output>
</example>
</examples>

Classify the bug in the <bug> tags below.
"""
```

---

## Few-Shot Failure Modes

| Signal | Diagnosis | Fix |
|--------|-----------|-----|
| Format is right, content is wrong | Examples don't match real distribution | Replace examples with real production inputs |
| Model over-anchors to example style | Too few examples, model mimics style not logic | Add more diverse examples |
| Output deviates from format | Examples inconsistent with each other | Standardize example format |
| Still wrong after 5 examples | Task requires reasoning, not pattern matching | Escalate to Chain-of-Thought (see [04-chain-of-thought.md](04-chain-of-thought.md)) |
| Context window consumed by examples | Too many/long examples | Reduce to 3–5 representative examples; move to system prompt for caching |

---

## Provider Differences

| Provider | Few-Shot Guidance |
|---------|-----------------|
| **Anthropic** | Wrap examples in `<example>` XML tags. Place in system prompt for caching. Use 3–5 diverse examples. Combine with explicit format spec. |
| **OpenAI** | Use `###` separators or labeled `Input:` / `Output:` format. Place in system message. |
| **Google Gemini** | Provide input-output pairs to define format and style. Use in system instructions. |

---

## Demo 2 Preview: Technique Comparison

See [05-demo/](../05-demo/) for the full notebook. The comparison shows the same bug classification task run through:
1. Zero-shot (with severity definitions)
2. Zero-shot CoT ("Think step by step")
3. Few-shot (3 examples, no reasoning)
4. Few-shot CoT (3 examples + reasoning steps)
5. Self-Consistency (SC N=5 on few-shot CoT)

Each output is scored by an LLM-as-judge against ground truth labels. The resulting DataFrame shows accuracy vs cost tradeoff clearly.

---

## Editorial Notes

- **The Min et al. finding is the "aha" moment** for this section. Most engineers assume they need perfectly labeled examples. Show the actual result: 0–5% drop with random labels. Watch faces change.
- **Practical demo:** Live in the notebook, swap two labels to be wrong → run → show accuracy barely changed. Then change the FORMAT → run → show accuracy drops significantly.
- **Context: "What do examples actually teach?"** Use the analogy: examples are like unit tests for output format — they spec the contract, not the logic.

---

## References

| Source | Used for |
|--------|----------|
| Brown et al. 2020 — arXiv:2005.14165 | GPT-3, ICL, few-shot benchmarks |
| Kojima et al. 2022 — arXiv:2205.11916 | Zero-shot CoT, "Let's think step by step" |
| Min et al. 2022 — arXiv:2202.12837 | Labels don't matter as much as format |
| Anthropic Prompting Best Practices | XML tagging for examples |
| DAIR.AI Prompt Engineering Guide | Zero-shot and few-shot definitions |
