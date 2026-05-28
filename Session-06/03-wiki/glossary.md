# Glossary — Session 6: Advanced Prompt Engineering

> Engineering-focused definitions for software engineers who completed Sessions 1–5. Cross-references point to sibling wiki pages where the technique is unpacked in depth.

| Term | Definition |
|------|-----------|
| **Active Prompting** | Diao et al. 2023. Uncertainty-driven exemplar selection: sample multiple CoT answers per training question, measure disagreement, and ask humans to annotate only the highest-uncertainty items. +7.4 pp avg on reasoning benchmarks vs hand-picked few-shots. arXiv:2302.12246. |
| **Analogical Prompting** | Yasunaga et al. 2023. The model self-generates relevant exemplars *and* relevant background knowledge from a problem statement before solving — zero curated few-shots needed. SOTA on several GSM8K/MATH/Code settings. arXiv:2310.01714. |
| **Auto-CoT** | Zhang et al. 2022. Cluster a corpus of questions by embedding, pick one diverse representative per cluster, generate its CoT with Zero-Shot CoT, then use the resulting (Q, CoT) pairs as few-shot exemplars. Eliminates manual exemplar curation. arXiv:2210.03493. |
| **Branch-Solve-Merge (BSM)** | Saha et al. 2023. Decomposition pattern for evaluation/generation: a *branch* prompt enumerates independent sub-aspects, each is *solved* in parallel, and a *merge* prompt aggregates. Used heavily in LLM-as-judge rubrics. arXiv:2310.15123. |
| **Complexity-based Prompting** | Fu et al. 2022. For Self-Consistency, weight votes by reasoning-chain length (longer chains = more reliable on hard problems). +5.3 pp avg, +18 pp max on GSM8K-family. arXiv:2210.00720. |
| **Constitutional Critique** | Bai et al. 2022 (Constitutional AI). Self-critique against an explicit list of written principles ("the constitution") before revising. The principles act as the external signal that bare self-refinement lacks (see Misconception 0). arXiv:2212.08073. |
| **Contrastive CoT** | Chia et al. 2023. Few-shot CoT augmented with *both* correct and deliberately wrong reasoning chains, teaching the model what failure looks like. Up to +15 pp on reasoning benchmarks. arXiv:2311.09277. |
| **Decomposition (family)** | Class of techniques that split a hard problem into easier sub-problems before solving: Least-to-Most, Plan-and-Solve, Branch-Solve-Merge, Skeleton-of-Thought, Prompt Chaining. The "structure is your job" patterns that remain valuable even with reasoning models. |
| **Directional Stimulus Prompting** | Li et al. 2023. A small "policy" LLM emits keyword hints ("stimulus") that steer a larger frozen LLM toward a preferred output. Trained with RL against a downstream metric. arXiv:2302.11520. |
| **EmotionPrompt** | Li et al. 2023. Appending emotional appeals ("This is very important for my career") to a prompt. +115% relative on BIG-Bench Hard in 2023 — but largely neutralised by RLHF-tuned 2024+ models. Re-eval after every model upgrade. arXiv:2307.11760. |
| **Extended Thinking (Claude)** | Anthropic feature where Claude emits internal "thinking" tokens before its visible response. Configured via a thinking-token budget; per Anthropic docs, use *high-level* "think deeply" prompts rather than prescriptive CoT steps. See [00-overview.md](./00-overview.md). |
| **External Grounding (family)** | Techniques that inject information the generator lacks: ReAct (tool calls), Generated Knowledge, RAG, Step-Back (abstraction lookup). The category that fixes Misconception 0 by giving critics an external signal. |
| **Faithful CoT** | Lyu et al. 2023. Two-stage: LLM translates the question into an executable symbolic program (Python, PDDL, Datalog); a deterministic solver runs it. The visible reasoning is *guaranteed* to match the final answer. SOTA on 9/10 benchmarks. arXiv:2301.13379. |
| **Generated Knowledge** | Liu et al. 2021. Prompt the model to first emit relevant background facts, then condition the answer on its own generated context. Fails when parametric knowledge is wrong — the error gets baked in. arXiv:2110.08387. |
| **Graph of Thoughts (GoT)** | Besta et al. 2023. Generalises ToT from a tree to an arbitrary DAG, allowing aggregation, refinement, and back-references between thoughts. -31% cost vs ToT at the same quality on 128-num sorting; +62% quality at matched cost. arXiv:2308.09687. |
| **Least-to-Most** | Zhou et al. 2022. Decompose the problem into an ordered list of progressively harder sub-problems, then solve them in sequence, feeding earlier answers as context. SCAN: 16.2% → 99.7%. arXiv:2205.10625. |
| **LLM-as-judge** | Using an LLM to score outputs against a rubric — the primary eval primitive for advanced pipelines (cross-ref [Session 5 glossary](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/glossary.md)). In Session 6, judges become the *value function* for ToT and the *critic* for Self-Refine. |
| **Maieutic Prompting** | Jung et al. 2022. Recursively generate abductive ("because") and contrastive ("but") explanations, then resolve logical contradictions via a MAX-SAT solver over the resulting belief graph. +20% over SOTA prompting on ComVE/CREAK/CSQA2. arXiv:2205.11822. |
| **MLflow Tracing** | The `@mlflow.trace` decorator and `mlflow.start_span(...)` context manager (MLflow 3.10+, `mlflow.genai` namespace) producing OpenTelemetry-native span trees over multi-stage LLM pipelines. Pair with `mlflow.{openai,anthropic}.autolog()` for zero-config LLM-call capture and `mlflow.update_current_trace(tags={...})` for run-level metadata. The Session 6 observability backbone — every technique in this glossary is logged as a typed span. |
| **`mlflow.genai.evaluate`** | MLflow 3.10+ offline eval entry point for LLM apps: `mlflow.genai.evaluate(data=, predict_fn=, scorers=[Correctness(), Guidelines(...), RelevanceToQuery(), Safety(), Completeness()])`. Supersedes the legacy `mlflow.evaluate` for GenAI tasks; supports both built-in `mlflow.genai.scorers` and custom rubric scorers. |
| **Misconception 0 (Huang et al.)** | "LLMs Cannot Self-Correct Reasoning Yet." Without an *external* feedback signal, self-correction loops *degrade* GSM8K accuracy. The keystone caveat for Self-Refine, Constitutional Critique, and Reflexion. arXiv:2310.01798. |
| **Plan-and-Solve** | Wang et al. 2023. Two-stage Zero-Shot CoT variant: first emit a plan ("Let's first understand the problem and devise a plan…"), then execute it. +9.1 pp avg on arithmetic benchmarks over Zero-Shot CoT. arXiv:2305.04091. |
| **Process Reward Model (PRM)** | A reward model that scores each *intermediate* reasoning step rather than only the final answer. Used as the value function for ToT/GoT search and as the supervisor for RL on reasoning models. Step-level supervision > outcome-only. |
| **Prompt Registry** | MLflow 3.10+ versioned prompt store: `mlflow.genai.register_prompt(name=, template=, commit_message=, tags=)` writes a new prompt version; `mlflow.genai.load_prompt("prompts:/name/version")` (or `prompts:/name@alias`) retrieves it. Semver-style commits give deploy-grade reproducibility for ToT scorers, ReAct system prompts, and Self-Refine critics. |
| **Program-of-Thought (PoT)** | Chen et al. 2022. LLM emits Python (or similar) code; a real interpreter executes it; the result is the answer. Eliminates arithmetic errors. GSM8K: 63.1% → 71.6%; FinQA: 40.4% → 64.5%. arXiv:2211.12588. See [06-secondary-techniques.md](./06-secondary-techniques.md) §A4. |
| **ReAct** | Yao et al. 2022. Interleaves `Thought → Action → Observation` cycles where Action invokes an external tool (search, calculator, API). The reasoning-with-tools loop. +34 pp on ALFWorld vs imitation+RL baseline. arXiv:2210.03629. |
| **Reasoning Model** | LLM RL-tuned to reason in internal thinking tokens (o1/o3, DeepSeek R1, Claude Extended Thinking, Gemini Thinking). Per OpenAI docs, *explicit* CoT prompts on these models *hurt* — the model already does it. Cross-ref [Session 5 glossary](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/glossary.md). |
| **Reflexion** | Shinn et al. 2023. Verbal RL — after a failed trial, the model writes a natural-language "lesson learned" into an episodic memory used to seed the next trial. HumanEval pass@1: GPT-4 80% → 91%. arXiv:2303.11366. |
| **Search/Branching (family)** | Class of techniques that explore multiple reasoning paths: Tree of Thoughts, Graph of Thoughts, Self-Consistency, Maieutic. All require a reliable value function or aggregator — Misconception 2. See [02-tree-of-thoughts.md](./02-tree-of-thoughts.md). |
| **Self-Consistency (SC)** | Sample N CoT paths at T>0, majority-vote the answer. The simplest search technique; the budget-friendly baseline before ToT/GoT. Cross-ref [Session 5 glossary](../../Session%2005%20-%20Core%20Prompt%20Engineering%20Techniques/03-wiki/glossary.md). |
| **Self-Discover** | Zhou et al. 2024. The model first *selects and composes* atomic reasoning modules (e.g., "decompose", "critical thinking", "step-by-step") into a task-specific reasoning structure, then executes it. Discovers a custom CoT shape per task class. arXiv:2402.03620. |
| **Self-Refine** | Madaan et al. 2023. Single-model iterate: generate → self-critique → revise, looping until a stop condition. +20% relative on 7-task avg with GPT-4. **Cap at 1–2 rounds** in production. arXiv:2303.17651. |
| **Self-Correction (family)** | Self-Refine, Reflexion, Constitutional Critique. All collapse to noise without an external verifier (Misconception 0). Pair every self-correction loop with unit tests, schema validation, retrieval, or rubric-bearing judge. |
| **Skeleton-of-Thought (SoT)** | Ning et al. 2023. The model first emits a skeleton of N bullet headings, then expands each bullet *in parallel*. 2.39× wall-clock speedup across 12 LLMs vs sequential decoding. A latency technique, not an accuracy one. arXiv:2307.15337. |
| **SpanType (MLflow)** | Enum on `mlflow.entities.SpanType` — `LLM`, `CHAIN`, `AGENT`, `TOOL`, `RETRIEVER`, `PARSER`. Tagging spans correctly is what unlocks MLflow's per-type cost and latency rollups across an advanced pipeline. |
| **Step-Back Prompting** | Zheng et al. 2023. Before answering, the model first asks itself a more general/abstract question (the "step-back" question) to retrieve broader principles. TimeQA: +27 pp; MMLU-Chemistry: +11 pp on PaLM-2L. arXiv:2310.06117. |
| **System 2 Attention (S2A)** | Weston & Sukhbaatar 2023. The model first *rewrites* its own context to remove irrelevant/distracting information, then answers from the cleaned context. TriviaQA-distractors: 51.7% → 61.3%. arXiv:2311.11829. |
| **`think` tool (Anthropic)** | A no-op tool Claude can invoke mid-trajectory to deliberate without emitting a user-visible response. Anthropic reports +54% pass^1 on Tau-Bench airline domain. A structural alternative to inline CoT for tool-using agents. |
| **`thinkingBudget` (Gemini)** | Google `ThinkingConfig.thinking_budget` token cap. `0` = disable thinking; `-1` = dynamic; positive int = explicit token budget. With Gemini 3, migrating to `thinking_level`; both cannot be combined with `reasoning_effort`. |
| **Thread-of-Thought (ThoT)** | Zhou et al. 2023. "Walk me through this context in manageable parts": a single instruction that has the model summarise long/chaotic contexts piece-by-piece before answering. Designed for noisy retrieval results. arXiv:2311.08734. |
| **Tree of Thoughts (ToT)** | Yao et al. 2023. Frame reasoning as search: generate K candidate thoughts per node, *evaluate* each with a value function, expand via BFS/DFS/beam. Game of 24 (GPT-4): CoT 4% → ToT 74%. Requires a reliable evaluator (Misconception 2). arXiv:2305.10601. See [02-tree-of-thoughts.md](./02-tree-of-thoughts.md). |
| **Value Function (ToT)** | The scoring function `v: partial_thought → ℝ` that ToT/GoT use to rank candidates. Implemented as LLM-as-judge with a rubric, a PRM, or an executable verifier. A weak value function makes search strictly worse than Self-Consistency. |

---

## Key Papers Quick Reference

All 24 advanced-technique papers from the anchor research (§6.1 benchmarks + §10 Tier 3 reference library).

| Technique | Authors (Year) | arXiv | One-line takeaway |
|-----------|----------------|-------|-------------------|
| Tree of Thoughts | Yao et al. 2023 | 2305.10601 | Search over thoughts; +70 pp on Game of 24 vs CoT — needs a real value function. |
| ReAct | Yao et al. 2022 | 2210.03629 | Thought → Action → Observation loop; +34 pp on ALFWorld. The tool-use standard. |
| Self-Refine | Madaan et al. 2023 | 2303.17651 | Generate → critique → revise on one model; +20% rel; cap at 1–2 rounds. |
| Reflexion | Shinn et al. 2023 | 2303.11366 | Verbal RL with episodic memory; HumanEval 80% → 91% on GPT-4. |
| Least-to-Most | Zhou et al. 2022 | 2205.10625 | Solve ordered sub-problems; SCAN 16.2% → 99.7%. |
| Step-Back | Zheng et al. 2023 | 2310.06117 | Abstract first, then answer; +27 pp on TimeQA. |
| Program-of-Thought | Chen et al. 2022 | 2211.12588 | Emit Python, run it; +24.1 pp on FinQA. |
| Plan-and-Solve | Wang et al. 2023 | 2305.04091 | Plan then execute; +9.1 pp over Zero-Shot CoT. |
| Skeleton-of-Thought | Ning et al. 2023 | 2307.15337 | Outline + parallel expand; 2.39× speedup. |
| Auto-CoT | Zhang et al. 2022 | 2210.03493 | Cluster questions, auto-generate exemplars; kills manual few-shot curation. |
| Generated Knowledge | Liu et al. 2021 | 2110.08387 | Self-generate context before answering; fragile to parametric errors. |
| Directional Stimulus | Li et al. 2023 | 2302.11520 | Small RL-tuned hint LLM steers a frozen large LLM. |
| Active Prompting | Diao et al. 2023 | 2302.12246 | Uncertainty-driven exemplar selection; +7.4 pp avg. |
| Graph of Thoughts | Besta et al. 2023 | 2308.09687 | DAG over thoughts; -31% cost vs ToT at parity. |
| Thread-of-Thought | Zhou et al. 2023 | 2311.08734 | Walk through chaotic context in chunks; designed for noisy RAG. |
| Analogical Prompting | Yasunaga et al. 2023 | 2310.01714 | Self-generated exemplars + background; zero curated few-shots. |
| System 2 Attention | Weston & Sukhbaatar 2023 | 2311.11829 | Rewrite context to strip distractors; +9.6 pp on TriviaQA-distractors. |
| EmotionPrompt | Li et al. 2023 | 2307.11760 | Emotional appeals; +115% rel in 2023, mostly neutralised post-RLHF. |
| Constitutional AI | Bai et al. 2022 | 2212.08073 | Self-critique against explicit written principles. |
| Maieutic Prompting | Jung et al. 2022 | 2205.11822 | Belief graph + MAX-SAT over abductive/contrastive expansions; +20%. |
| Complexity-based | Fu et al. 2022 | 2210.00720 | Length-weighted Self-Consistency voting; +18 pp max on GSM8K. |
| Faithful CoT | Lyu et al. 2023 | 2301.13379 | LLM → symbolic program → solver; reasoning is provably faithful. |
| Contrastive CoT | Chia et al. 2023 | 2311.09277 | Few-shot with both correct and wrong chains; up to +15 pp. |
| LLMs Cannot Self-Correct | Huang et al. 2023 | 2310.01798 | Misconception 0: no external signal ⇒ self-correction degrades accuracy. |

> Bonus 2024 papers (cited in [00-overview.md](./00-overview.md) but outside the core 24): Self-Discover (2402.03620), Distill System 2 → System 1 (2407.06023), Branch-Solve-Merge (2310.15123), Multimodal CoT (2302.00923).
