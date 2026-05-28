# Session 6: Advanced Prompt Engineering

## Overview

**Series:** AI & LLM Fundamentals for Software Developers  
**Format:** Flipped classroom — 60–90 min live session  
**Status:** ✅ Ready (all stages delivered)

---

## Topic

How to solve problems that basic prompting can't — using reasoning architectures, multi-step pipelines, and composable technique stacks.

**Techniques covered:**

**Core (deep coverage):**
- **Tree of Thoughts (ToT)** — Branching search over reasoning paths; BFS/DFS/beam over a thought graph
- **Prompt Chaining** — Decompose complex tasks into sequential sub-prompts; orchestrate the pipeline
- **Generate Knowledge Prompting** — Generate relevant facts first, then use them to answer
- **ReAct (Reason + Act)** — Interleave reasoning traces with tool/API calls in a structured loop

**Supporting:**
- **Least-to-Most Prompting** — Solve easy sub-problems first, build toward the hard one
- **Step-Back Prompting** — Ask a more abstract question before answering the specific one
- **Program-of-Thought (PoT)** — Offload computation to code execution instead of model arithmetic
- **Self-Refine** — Model critiques and rewrites its own output iteratively
- **Contrastive CoT** — Include both correct and incorrect reasoning examples
- **Skeleton-of-Thought** — Generate structure first; fill in detail in parallel (latency optimization)
- **Auto-CoT** — LLM generates its own CoT demonstrations automatically

**Emerging / Overview:**
- Graph-of-Thought, Thread-of-Thought, Analogical Prompting, S2A, EmotionPrompt, Reflexion

---

## Learning Objectives

By the end of this session, participants will be able to:
1. Know when ToT beats linear CoT — and how to implement the search loop
2. Decompose a complex engineering task into a clean prompt chain
3. Apply Generate Knowledge to improve factual answers before committing
4. Build a ReAct loop that interleaves reasoning and tool calls
5. Choose and compose advanced techniques with a cost-vs-benefit lens
6. Diagnose failure modes specific to each advanced technique

---

## Pre-Session Reading

Participants should read before attending:

- [Advanced Prompting Techniques — DAIR.AI](https://www.promptingguide.ai/techniques) ← **primary reading**
- [Tree of Thoughts paper — Yao et al. 2023](https://arxiv.org/abs/2305.10601)
- [ReAct paper — Yao et al. 2022](https://arxiv.org/abs/2210.03629)
- [Generate Knowledge paper — Liu et al. 2021](https://arxiv.org/abs/2110.08387)

---

## Session Files

| File / Folder | Description | Status |
|---------------|-------------|--------|
| `03-wiki/wiki-tree.html` | Interactive wiki tree | ✅ |
| `03-wiki/` | Multi-file reference wiki | ✅ |
| `04-slides/` | Slide plan + presenter transcript + deck | ✅ |
| `05-demo/` | Jupyter notebooks for live demos | ✅ |

---

## How to Run / Present

1. **Pre-reading.** Audience reads the wiki (`03-wiki/`) before the session.
2. **Slides.** Open `04-slides/Session-6-Advanced-Prompt-Engineering.pdf` (30 slides) for the live session, OR the `.pptx` for edits.
3. **Demos.** D1/D2/D3 run live during the session. D4-D7 are optional self-study. See `05-demo/README.md` for setup.
4. **MLflow.** Start a local server: `mlflow server --host 127.0.0.1 --port 5000`. Notebooks default to local Ollama; override via env vars for cloud providers.
5. **Presenter transcript.** `04-slides/presenter-transcript-30.md` matches the 30-slide deck.

---

## Connection to Other Sessions

| Session | Relationship |
|---------|-------------|
| Session 5 — Core Prompt Engineering | Prerequisite — do not re-cover Zero-Shot/Few-Shot/CoT/SC/Meta |
| Session 7 — Application Development & Tool Integration | ReAct introduced here; full agent architectures covered there |
| Session 8 — Customization (RAG / Fine-Tuning / Agents) | RAG and fine-tuning explicitly deferred to Session 8 |

---

## Key Papers Quick Reference

| Technique | Paper | arXiv |
|-----------|-------|-------|
| Tree of Thoughts | Yao et al. 2023 | [2305.10601](https://arxiv.org/abs/2305.10601) |
| ReAct | Yao et al. 2022 | [2210.03629](https://arxiv.org/abs/2210.03629) |
| Generate Knowledge | Liu et al. 2021 | [2110.08387](https://arxiv.org/abs/2110.08387) |
| Least-to-Most | Zhou et al. 2022 | [2205.10625](https://arxiv.org/abs/2205.10625) |
| Step-Back | Zheng et al. 2023 | [2310.06117](https://arxiv.org/abs/2310.06117) |
| Program of Thoughts | Chen et al. 2022 | [2211.12588](https://arxiv.org/abs/2211.12588) |
| Self-Refine | Madaan et al. 2023 | [2303.17651](https://arxiv.org/abs/2303.17651) |
| Auto-CoT | Zhang et al. 2022 | [2210.03493](https://arxiv.org/abs/2210.03493) |
| Skeleton-of-Thought | Ning et al. 2023 | [2307.15337](https://arxiv.org/abs/2307.15337) |
| Graph of Thoughts | Besta et al. 2023 | [2308.09687](https://arxiv.org/abs/2308.09687) |
