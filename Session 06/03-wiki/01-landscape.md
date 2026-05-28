# 01 — The Advanced Prompt Engineering Landscape

**Overview:** Sessions 1–5 trained you on single-call prompting: write one prompt, parse one answer, log it to MLflow. Session 6 is what you reach for when that ceiling is hit. The defining shift is mechanical, not philosophical: **the prompt is no longer a string — it is a control-flow program.** You orchestrate multiple model calls, route between them, evaluate intermediate state, and decide what to do next. Every technique in this session falls out of that one idea. This file maps the territory: the five technique families, the 2021→2025 research trajectory, and where each technique actually lands in production today.

**Cross-references:**
- [02-tree-of-thoughts.md](02-tree-of-thoughts.md) — flagship example of the Search/Branching family
- [05-react.md](05-react.md) — flagship example of the External Grounding family
- [07-decision-framework.md](07-decision-framework.md) — how to pick a family for a given task
- [08-reasoning-models.md](08-reasoning-models.md) — how o1/o3/Extended Thinking/Gemini Thinking change which families still apply

---

## The Session 5 Ceiling

Chain-of-Thought, Self-Consistency, few-shot, and the anatomy template (role, task, context, format) all share one constraint: they live inside a single API call. You write a prompt, you get a completion, you grade it. That works for classification, extraction, summarization, and most code-review-style tasks — roughly 70% of production prompts at most teams. The ceiling shows up when (a) the problem has clear intermediate states that you want to inspect or score, (b) early commits are catastrophic (a wrong root-cause hypothesis sends you down a 30-minute rabbit hole), (c) the model needs information it doesn't have (current logs, the database schema, the result of running code), or (d) the answer needs to be verified before it ships. At that point, "better prompt" stops helping. You need a *program* whose instructions happen to be written in English and executed by an LLM. The five families below are the five shapes that program tends to take.

---

## The Five Technique Families

### 1. Decomposition — split the problem

Break a hard problem into a sequence (or DAG) of easier subproblems, each solved by its own LLM call. Output of step *N* feeds step *N+1*. The intermediate steps are inspectable, cacheable, and individually testable — which is the engineering win, not the accuracy lift.

- Prompt Chaining (manual DAG of prompts)
- Least-to-Most (auto subproblem list, sequential)
- Plan-and-Solve (zero-shot: plan first, then solve)
- Skeleton-of-Thought (plan, then PARALLEL fan-out — latency win)

> **Motto:** *Solve the smallest thing the model can reliably solve, then chain.*

### 2. Search / Branching — explore alternative reasoning paths

Vanilla CoT is left-to-right autoregressive; one wrong token commits you. Search techniques externalize the exploration the LLM cannot do internally: propose *k* candidate thoughts, score each with a value function (another LLM call), keep the top-*b*, expand, repeat. BFS, DFS, beam, or DAG.

- Tree of Thoughts (ToT) — BFS/DFS over thoughts + value function
- Graph of Thoughts (GoT) — DAG with aggregate/refine operations
- Maieutic Prompting — abductive tree resolved by a SAT solver

> **Motto:** *When early commits are catastrophic, branch and score.*

### 3. Self-Correction — verify own work

Generate a draft, then run a second (and sometimes third) pass whose job is to critique the draft against a rubric, against principles, or against contrastive examples — then revise. Capped at 1–2 rounds in production; more rounds rarely help and often hurt (see Huang et al., 2310.01798).

- Self-Refine (gen → critique → revise, same LLM)
- Reflexion (verbal RL: episodic memory of past failures)
- Constitutional self-critique (critique against written principles)
- Contrastive CoT (show valid AND invalid demos)
- Faithful CoT (translate to formal language, run deterministic solver)

> **Motto:** *The model is a better grader than generator — exploit that asymmetry.*

### 4. External Grounding — use tools, code, knowledge

The LLM does not compute the answer; it decides *what to compute* and delegates. Arithmetic goes to a Python interpreter, facts go to a retriever, log queries go to your existing tooling. The model is the planner; the environment is the ground truth.

- ReAct (Thought → Action → Observation loop)
- Program-of-Thought (PoT) (LLM writes code, interpreter executes)
- Generated Knowledge (LM generates relevant facts, then answers)
- Step-Back Prompting (abstract to first principles, then solve)

> **Motto:** *Don't make the model do what a deterministic tool does better.*

### 5. Exemplar & Context Control — shape what the model sees

Few-shot done right at scale: cluster your task distribution and auto-pick demos (Auto-CoT), let the model self-generate analogous examples (Analogical), annotate the most uncertain inputs (Active), or rewrite the context to drop distractors before solving (S2A, ThoT). The technique acts on the *input*, not the reasoning trace.

- Auto-CoT (cluster + auto-generate exemplars)
- Analogical Prompting (model self-generates exemplars via analogy)
- Active Prompting (annotate the most uncertain questions)
- Complexity-based (prefer longer-chain demos)
- Thread-of-Thought (ThoT) (segment chaotic long context)
- System 2 Attention (S2A) (rewrite context to drop distractors)
- Directional Stimulus (small RL'd model emits hints)
- EmotionPrompt ("this is important to my career" — yes, really)

> **Motto:** *Cheapest accuracy lift is usually a better example, not a cleverer chain.*

### Visual taxonomy

```
ADVANCED PROMPT ENGINEERING
│
├── 1. DECOMPOSITION (split the problem)
│     ├── Prompt Chaining           (manual DAG of prompts)
│     ├── Least-to-Most             (auto subproblem list, sequential)
│     ├── Plan-and-Solve            (zero-shot: plan, then solve)
│     └── Skeleton-of-Thought       (plan, then PARALLEL fan-out — latency win)
│
├── 2. SEARCH / BRANCHING (explore alternative reasoning paths)
│     ├── Tree of Thoughts (ToT)    (BFS/DFS over thoughts + value function)
│     ├── Graph of Thoughts (GoT)   (DAG with aggregate/refine ops)
│     └── Maieutic Prompting        (abductive tree → SAT solver)
│
├── 3. SELF-CORRECTION (verify own work)
│     ├── Self-Refine               (gen → critique → revise, same LLM)
│     ├── Reflexion                 (verbal RL: episodic memory of failures)
│     ├── Constitutional self-critique (critique against written principles)
│     ├── Contrastive CoT           (show valid AND invalid demos)
│     └── Faithful CoT              (translate → deterministic solver)
│
├── 4. EXTERNAL GROUNDING (use tools / code / knowledge)
│     ├── ReAct                     (Thought → Action → Observation loop)
│     ├── Program-of-Thought (PoT)  (LLM writes code, interpreter computes)
│     ├── Generated Knowledge       (LM generates facts, then answers)
│     └── Step-Back Prompting       (abstract to first principles, then solve)
│
└── 5. EXEMPLAR & CONTEXT CONTROL
      ├── Auto-CoT                  (cluster + auto-generate exemplars)
      ├── Analogical Prompting      (model self-generates exemplars via analogy)
      ├── Active Prompting          (annotate most uncertain questions)
      ├── Complexity-based          (prefer longer-chain demos)
      ├── Thread-of-Thought (ThoT)  (segment chaotic long context)
      ├── System 2 Attention (S2A)  (rewrite context to drop distractors)
      ├── Directional Stimulus      (small RL'd model emits hints)
      └── EmotionPrompt             ("this is important to my career" — yes, really)
```

---

## Timeline 2021 → 2025

| Year | Key techniques introduced |
|------|--------------------------|
| 2021 | Generated Knowledge (Liu, arXiv:2110.08387) |
| 2022 H1 | Chain-of-Thought (Wei), Self-Consistency (Wang), Maieutic (Jung 2205.11822), Least-to-Most (Zhou 2205.10625) |
| 2022 H2 | ReAct (Yao 2210.03629), Auto-CoT (Zhang 2210.03493), Complexity-based (Fu 2210.00720), PoT (Chen 2211.12588), Constitutional AI (Bai 2212.08073) |
| 2023 H1 | Faithful CoT (2301.13379), Directional Stimulus (2302.11520), Active Prompting (2302.12246), Reflexion (2303.11366), Self-Refine (2303.17651), Plan-and-Solve (2305.04091), Tree of Thoughts (2305.10601) |
| 2023 H2 | EmotionPrompt (2307.11760), Skeleton-of-Thought (2307.15337), Graph of Thoughts (2308.09687), Analogical (2310.01714), Step-Back (2310.06117), Thread-of-Thought (2311.08734), Contrastive CoT (2311.09277), S2A (2311.11829) |
| 2024–2025 | Reasoning models (o1 Sep 2024, o3, Claude 3.7/4 Extended Thinking, Gemini 2.5 Thinking); Self-Discover (Zhou et al., 2024); test-time compute scaling; Anthropic `think` tool |

The cluster of papers in 2023 H1 is the single densest period of advanced-prompting research to date. Reflexion, Self-Refine, Plan-and-Solve, and ToT all landed within five months of each other. Everything since is either a refinement, a context-engineering variant, or — starting Sep 2024 — being absorbed into the model itself via reasoning-model RL.

---

## Production vs Academic Split

Not every technique on the tree is something you should ship. After two years of industry adoption, the split is reasonably clear:

- **Heavily used in production:** Prompt Chaining, Plan-and-Solve, ReAct, PoT, Self-Refine (capped at 1–2 rounds), Step-Back, Generated Knowledge. These are cheap, debuggable, and have positive ROI even on commodity models.
- **Used selectively:** Self-Consistency, Auto-CoT, S2A, Tree of Thoughts (offline batch only — 10–100× tokens is the cost).
- **Mostly academic:** Graph of Thoughts, Maieutic, Active Prompting, Directional Stimulus, EmotionPrompt, Contrastive CoT. Headline numbers in the papers, but either the value function is unwritable in practice, the orchestration overhead dwarfs the lift, or the technique has been quietly subsumed by reasoning models.

The rule of thumb: if the technique requires you to write a reliable scorer for partial outputs, it stays in the lab until you have one.

---

## Reasoning-Model Disruption (Preview)

In September 2024, OpenAI shipped o1 — the first widely available model trained via large-scale RL to use internal "thinking tokens" before emitting a final answer. Claude 3.7/4 Extended Thinking and Gemini 2.5 Thinking followed. These models do search, decomposition, and self-correction *natively, inside one API call*. OpenAI's own guidance now reads: *"Avoid chain-of-thought prompts… prompting them to 'think step by step' is unnecessary"* and *"asking a reasoning model to reason more may actually hurt the performance."* This does not retire advanced prompt engineering — Decomposition, ReAct, PoT, and Self-Refine all remain useful on reasoning models because they touch *external* structure (tools, sub-pipelines, verification). What it does retire is hand-engineering CoT and ToT *on top of* a reasoning model. See [08-reasoning-models.md](08-reasoning-models.md) for the full breakdown and the updated decision matrix.

---

## Editorial Notes

- **Best teaching moment:** Draw the five families on a whiteboard as five branches off "single-call prompting." Then put one engineering example under each: prompt chain for a bug-triage pipeline, ToT for log-based RCA, Self-Refine for code-review polish, ReAct for "investigate this incident" agents, Auto-CoT for a classifier with 12 categories. Concrete > abstract.
- **Common misconception to address:** "Advanced = better." No. Advanced = more orchestration cost. If a session-5 prompt gets you to 92%, don't reach for ToT to chase the last 3% — the token bill and latency will sink the feature.
- **Session 5 connection:** Every advanced technique still uses session-5 anatomy *inside each call*. ToT calls a "proposer" prompt and an "evaluator" prompt — both are session-5 prompts. The advance is in the orchestration around them, not in their content.
- **What to skip in a 90-minute session:** GoT, Maieutic, Directional Stimulus, EmotionPrompt. Mention them by name, point at the references, move on.

---

## References

| Source | Used for |
|--------|----------|
| Yao et al. 2023 (arXiv:2305.10601) | Tree of Thoughts — flagship Search family technique |
| Zhou et al. 2022 (arXiv:2205.10625) | Least-to-Most — flagship Decomposition technique |
| Madaan et al. 2023 (arXiv:2303.17651) | Self-Refine — flagship Self-Correction technique |
| Yao et al. 2022 (arXiv:2210.03629) | ReAct — flagship External Grounding technique |
| Zhang et al. 2022 (arXiv:2210.03493) | Auto-CoT — flagship Exemplar Control technique |
| Huang et al. 2023 (arXiv:2310.01798) | Self-correction limits — why we cap at 1–2 rounds |
| OpenAI o1 / o3 documentation | "Avoid CoT on reasoning models" guidance |
| Session 6 research report (claude-compass artifact) | 5-family taxonomy, timeline, production/academic split |
