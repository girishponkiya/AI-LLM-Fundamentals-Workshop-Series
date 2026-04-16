# 05 — Self-Consistency & Meta Prompting (APE + OPRO)

**Overview:** Two techniques at the top of the Complexity Ladder. Self-Consistency adds robustness to CoT by sampling multiple reasoning paths and majority-voting. Meta Prompting delegates prompt construction to the model itself. Both require prerequisites: SC needs CoT, Meta Prompting needs an eval set.

**Cross-references:** [04-chain-of-thought.md](04-chain-of-thought.md) — SC builds on CoT. [06-decision-framework.md](06-decision-framework.md) — when to use SC (high-stakes, high-variance CoT). [07-production.md](07-production.md) — cost budgeting for SC; Meta Prompting drives MLflow prompt registry workflow.

---

## Self-Consistency

### Definition

Self-Consistency (Wang et al. 2022) is an advanced decoding strategy that improves upon standard CoT. Instead of greedy decoding (take the first output), sample N independent CoT reasoning paths at temperature > 0 and select the most frequent final answer via majority vote.

**Mechanical change:** Add a sampling loop. Run the same CoT prompt N times with `temperature > 0`. Extract the final answer from each run. Take the majority vote.

**Intuition:** Different valid reasoning paths that converge on the same answer are more likely to be correct than a single path. High variance in answers signals high uncertainty — SC surfaces this.

### Mechanism

```python
from collections import Counter
import anthropic

client = anthropic.Anthropic()

def extract_answer(text: str) -> str:
    """Extract the final answer from a CoT response. Customize per task."""
    # Look for explicit answer markers
    for marker in ["Final answer:", "Conclusion:", "Therefore:", "Answer:"]:
        if marker in text:
            return text.split(marker)[-1].strip().split("\n")[0].strip()
    # Fall back to last non-empty line
    lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
    return lines[-1] if lines else text.strip()

def self_consistency(
    prompt: str,
    system: str = "",
    n: int = 5,
    temperature: float = 0.7
) -> tuple[str, float, list[str]]:
    """
    Run self-consistency sampling.
    Returns: (majority_answer, confidence_score, all_answers)
    """
    answers = []
    for _ in range(n):
        response = client.messages.create(
            model="claude-sonnet-4-6",
            system=system,
            messages=[{
                "role": "user",
                "content": prompt + "\n\nLet's think step by step:"
            }],
            max_tokens=512,
            temperature=temperature
        )
        text = response.content[0].text
        answer = extract_answer(text)
        answers.append(answer)

    counter = Counter(answers)
    majority_answer = counter.most_common(1)[0][0]
    confidence = counter.most_common(1)[0][1] / n

    return majority_answer, confidence, answers

# Usage
answer, conf, all_answers = self_consistency(
    prompt="A service uses 3 replicas. Each handles 1000 RPS. Traffic spikes to 4500 RPS. How many replicas needed?",
    n=5
)
print(f"Answer: {answer} (confidence: {conf:.0%})")
print(f"All answers: {all_answers}")
```

### Benchmarks (Wang et al. 2022 — PaLM 540B)

| Dataset | Standard CoT | CoT + SC (N=40) | Gain |
|---------|-------------|-----------------|------|
| GSM8K (Math Word Problems) | 56.5% | 74.4% | +17.9% |
| SVAMP (Arithmetic) | 68.3% | 79.3% | +11.0% |
| AQuA (Algebra) | 47.4% | 63.1% | +15.7% |
| StrategyQA (Commonsense) | 65.2% | 71.6% | +6.4% |
| CSQA (Commonsense) | 76.4% | 79.1% | +2.7% |

**Paper:** Wang et al. 2022 — arXiv:2203.11171

**Key observation:** Gains are much larger on math/reasoning tasks (GSM8K +17.9%) than on commonsense tasks (CSQA +2.7%). SC is most valuable where variance in reasoning is high.

### N vs Accuracy Tradeoff

| N | Approximate gain from N=1 | Cost multiplier |
|---|--------------------------|-----------------|
| 1 | Baseline (standard CoT) | 1× |
| 3 | ~60–70% of total SC gain | 3× |
| 5 | ~75–80% of total SC gain | 5× |
| 10 | ~85–90% of total SC gain | 10× |
| 20 | ~90–95% of total SC gain | 20× |
| 40 | ~100% of total SC gain | 40× |

**Practical guidance:** Most gain occurs from N=1 to N=5. Beyond N=10, diminishing returns become severe. Only go to N=20–40 for research benchmarks or very high-stakes financial/safety decisions.

### SC Budget by Task Type

```python
# Explicit SC budget configuration — make this a decision, not an afterthought
SC_CONFIG = {
    "bug_triage":             {"n": 1,  "reason": "Low stakes, speed required, use CoT instead"},
    "log_field_extraction":   {"n": 1,  "reason": "Deterministic task — SC adds no value"},
    "story_estimation":       {"n": 5,  "reason": "Medium stakes, variance expected"},
    "code_security_review":   {"n": 5,  "reason": "Medium-high stakes, reasoning varies"},
    "incident_rca":           {"n": 10, "reason": "High stakes, correctness critical"},
    "financial_calculation":  {"n": 20, "reason": "Very high stakes, errors costly"},
    "safety_critical":        {"n": 40, "reason": "Research/safety — cost justified"},
}
```

### Temperature for SC

Use `temperature = 0.5–0.8` for SC sampling. Temperature 0 would always produce the same output (defeating the purpose). Temperature > 0.9 introduces too much randomness in the reasoning structure.

```python
# SC temperature guidance
temperature_by_task = {
    "factual_qa":     0.5,  # Some diversity but facts-first
    "reasoning":      0.7,  # Good diversity in reasoning paths
    "creative_coding": 0.8, # More path diversity acceptable
}
```

### When SC Won't Help

**Critical limitation:** SC adds robustness to **variance** (random errors) but NOT to **bias** (systematic errors).

If the model makes the SAME wrong reasoning step on every run — e.g., always misinterpreting a specific error pattern — voting just amplifies the wrong answer with high confidence.

**Diagnosis:** Run SC and check the vote distribution:
- High variance (5 different answers) → SC helps, samples are exploring different reasoning paths
- Low variance but wrong (all 5 agree on wrong answer) → Systematic error. SC won't fix this. Check: examples, context, or escalate to fine-tuning.

```python
answer, conf, all_answers = self_consistency(prompt, n=10)
if conf > 0.8:
    # Model is confident — but is it right? Check against eval set.
    print(f"High confidence ({conf:.0%}): {answer}")
else:
    # Low confidence — high variance in reasoning paths
    print(f"Low confidence ({conf:.0%}) — answers: {Counter(all_answers)}")
    print("Consider: Is this task at the edge of model capability?")
```

---

## Meta Prompting

### Definition

Meta Prompting is a family of techniques where an LLM is used to generate, evaluate, or optimize prompts for itself or another LLM. Two main approaches: **APE** (generate candidates, evaluate, select best) and **OPRO** (iterative optimization with score history).

**Prerequisite:** An eval set. Without a test set to score candidates, Meta Prompting degenerates to picking randomly from generated prompts.

---

## APE — Automatic Prompt Engineer

### Definition

APE (Zhou et al. 2022) uses an LLM to generate a set of candidate prompts from a task description, then evaluates each candidate on a test set, and selects the best-performing one.

**Result:** On 24 benchmark tasks, APE-generated prompts beat human-written prompts on 19 tasks (79%).

**Paper:** Zhou et al. 2022 — arXiv:2211.01910

### Process

1. Provide: task description + a few examples of desired behavior
2. Meta-prompt: "Generate N different system prompts for this task"
3. Score each candidate on your golden test set
4. Select the highest-scoring candidate

```python
import json
from anthropic import Anthropic

client = Anthropic()

def generate_prompt_candidates(
    task_description: str,
    examples: list[dict],  # [{"input": str, "output": str}]
    n: int = 5
) -> list[str]:
    """Use an LLM to generate candidate prompts."""
    examples_text = "\n".join(
        f"Input: {ex['input']}\nOutput: {ex['output']}" for ex in examples[:3]
    )
    meta_prompt = f"""
Task: {task_description}

Here are examples of inputs and desired outputs:
{examples_text}

Generate {n} different system prompts that would make an LLM perform this task well.
Each prompt should try a different framing, angle, or instruction style.
Output as JSON: {{"prompts": ["prompt1", "prompt2", ...]}}
"""
    response = client.messages.create(
        model="claude-sonnet-4-6",
        messages=[{"role": "user", "content": meta_prompt}],
        max_tokens=2048
    )
    return json.loads(response.content[0].text)["prompts"]


def score_prompt(prompt: str, test_cases: list[dict], model: str) -> float:
    """Score a prompt against a test set. Returns accuracy (0.0–1.0)."""
    correct = 0
    for case in test_cases:
        response = client.messages.create(
            model=model, max_tokens=256, system=prompt,
            messages=[{"role": "user", "content": case["input"]}]
        )
        output = response.content[0].text.strip()
        if case["expected"] in output:  # Customize matching logic
            correct += 1
    return correct / len(test_cases)


def run_ape(task_description: str, examples: list, test_cases: list, n: int = 5) -> dict:
    """Full APE pipeline: generate → score → select."""
    candidates = generate_prompt_candidates(task_description, examples, n)
    results = []
    for i, prompt in enumerate(candidates):
        score = score_prompt(prompt, test_cases, "claude-sonnet-4-6")
        results.append({"prompt": prompt, "score": score})
        print(f"Candidate {i+1}: score={score:.2f}")

    best = max(results, key=lambda x: x["score"])
    return best
```

### Anthropic Console as APE in a UI

The Anthropic Console "Generate a prompt" feature is APE in a user interface:

1. Navigate to console.anthropic.com → "Generate a prompt"
2. Describe your task in plain language: "I want to classify bug reports into Critical/High/Medium/Low with our team's definitions"
3. The Console generates a structured system prompt with role, format spec, and examples
4. Iterate in the Workbench (side-by-side prompt comparison)
5. Export to code

**Workflow:**
```
Describe task in Console → Generated prompt → Iterate in Workbench
→ Finalize → Move to code → Track in MLflow → Test → Deploy
```

---

## OPRO — Optimization by PROmpting

### Definition

OPRO (Yang et al. 2023) is iterative prompt optimization. Rather than evaluating candidates independently, OPRO builds an optimization trajectory: prior prompts + their scores are included in the meta-prompt, allowing the optimizer LLM to improve upon the best previous prompt.

**Result:** GSM8K accuracy improved from 83% → 89% via OPRO-optimized prompts. One of the discovered effective instructions: "Take a deep breath and work on this problem step-by-step."

**Paper:** Yang et al. 2023 — arXiv:2309.03409

### Process

```python
def opro_optimize(
    task_description: str,
    test_cases: list[dict],
    iterations: int = 5,
    n_candidates_per_iter: int = 3
) -> dict:
    """
    OPRO: Iterative prompt optimization with score history.
    Returns the best prompt found across all iterations.
    """
    history = []  # List of {"prompt": str, "score": float}

    # Seed with a basic starting prompt
    seed_prompt = f"You are a helpful assistant. Complete this task: {task_description}"
    seed_score = score_prompt(seed_prompt, test_cases, "claude-sonnet-4-6")
    history.append({"prompt": seed_prompt, "score": seed_score})

    for iteration in range(iterations):
        # Build optimization trajectory (top 3 from history)
        trajectory = "\n\n".join(
            f"Score {h['score']:.2f}:\n{h['prompt']}"
            for h in sorted(history, key=lambda x: x["score"], reverse=True)[:3]
        )

        meta_prompt = f"""
You are an expert prompt engineer. Optimize this prompt for the following task.

Task: {task_description}

Previous prompts and their accuracy scores (higher = better):
{trajectory}

Generate {n_candidates_per_iter} new prompts that improve upon the best previous prompt.
Each new prompt should be meaningfully different — try different structures, framings, or instructions.
Output as JSON: {{"prompts": ["prompt1", "prompt2", ...]}}
"""
        response = client.messages.create(
            model="claude-sonnet-4-6",
            messages=[{"role": "user", "content": meta_prompt}],
            max_tokens=2048
        )
        new_candidates = json.loads(response.content[0].text)["prompts"]

        for candidate in new_candidates:
            score = score_prompt(candidate, test_cases, "claude-sonnet-4-6")
            history.append({"prompt": candidate, "score": score})
            print(f"Iteration {iteration+1}: score={score:.2f}")

    best = max(history, key=lambda x: x["score"])
    print(f"\nBest prompt (score={best['score']:.2f}):\n{best['prompt']}")
    return best
```

### OPRO + MLflow Integration

```python
import mlflow

with mlflow.start_run(run_name="opro-bug-triage"):
    mlflow.log_param("task", "bug_severity_classification")
    mlflow.log_param("optimizer", "OPRO")
    mlflow.log_param("iterations", 5)

    best = opro_optimize(task_description, test_cases, iterations=5)

    mlflow.log_metric("best_accuracy", best["score"])
    mlflow.log_text(best["prompt"], "optimized_prompt.txt")
    mlflow.log_dict({"history": history}, "optimization_history.json")
```

---

## Limitations of Meta Prompting

| Limitation | Details |
|-----------|---------|
| **Eval set required** | Without test cases to score, you're picking randomly from generated prompts. The entire value proposition is evaluation-driven selection. |
| **Computational cost** | APE with N=10 candidates × M=50 test cases = 500 API calls per optimization run. OPRO × 5 iterations × 3 candidates × 50 test cases = 750 calls. Plan the budget. |
| **Distribution bias** | Generated prompts live in the distribution of "prompts that sound reasonable to LLMs." Domain expert insights (only a payments team member knows what "Critical" means to your SLA) are not automatically discovered. |
| **One-time investment** | Meta Prompting is most valuable when building a new task prompt from scratch. For existing prompts, targeted iteration is usually faster. |
| **Doesn't replace engineering judgment** | APE/OPRO filters candidates from the prompt distribution — it doesn't guarantee the best possible prompt. Human review of top candidates is still valuable. |

---

## Meta Prompting vs Manual Iteration

Use Meta Prompting when:
- Starting a completely new task with no clear prompt structure in mind
- You have an eval set and want to explore many prompt framings quickly
- You want to validate that no obvious prompt formulation outperforms your current one
- You're building an automated prompt optimization pipeline

Use manual iteration when:
- You have a working prompt and need targeted fixes
- The task requires domain knowledge the LLM doesn't have
- Quick turnaround is needed (no time for multiple eval cycles)
- The eval set is small or noisy (APE scores will be unreliable)

---

## Editorial Notes

- **Self-Consistency cost argument is powerful:** "Story estimation is high-stakes (wrong estimates affect sprint planning for 10 engineers). N=5 at 5× cost is $0.05/request. The alternative is a wrong estimate that costs 40 hours of engineering time."
- **The confidence score from SC** is a practical artifact engineers can use. If confidence < 50%, that's a signal to: add more examples, decompose the task, or escalate to a human.
- **OPRO's "take a deep breath" finding** always lands well — show that an instruction discovered by an algorithm that humans would never write can improve accuracy by multiple percentage points.
- **APE → Console connection:** Participants may have already used the Anthropic Console without knowing they were doing APE. Make that connection explicit.

---

## References

| Source | Used for |
|--------|----------|
| Wang et al. 2022 — arXiv:2203.11171 | Self-Consistency, benchmark numbers |
| Zhou et al. 2022 — arXiv:2211.01910 | APE: 19/24 tasks beat human prompts |
| Yang et al. 2023 — arXiv:2309.03409 | OPRO: GSM8K 83% → 89% |
| Anthropic Console docs | "Generate a prompt" as APE UI |
| Comprehensive Framework report | SC budget guidance, Meta Prompting limitations |
