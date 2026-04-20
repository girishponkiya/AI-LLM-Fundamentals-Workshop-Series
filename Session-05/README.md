# Session 5: Core Prompt Engineering Techniques

## Overview

**Series:** AI & LLM Fundamentals for Software Developers
**Format:** Flipped classroom — 60–90 min live session
**Status:** 🔜 In Preparation

---

## Topic

How to write prompts that reliably produce the output you want — and why the technique matters, not just the wording.

**Techniques covered:**
- **Zero-shot Prompting** — Direct instruction with no examples
- **Few-shot Prompting** — Guiding the model with worked examples
- **Chain-of-Thought (CoT)** — Making the model reason step-by-step
- **Meta Prompting** — Using LLMs to generate and optimise prompts
- **Self-Consistency** — Sampling multiple outputs and voting for reliability

---

## Learning Objectives

By the end of this session, participants will be able to:
1. Apply the right prompting technique for a given task
2. Understand the mechanical difference between each technique (what actually changes)
3. Implement chain-of-thought reasoning to improve LLM accuracy on complex tasks
4. Know when _not_ to use a technique (limitations and failure modes)

---

## Pre-Session Reading

Participants should read before attending:

- [Prompting Techniques — DAIR.AI](https://www.promptingguide.ai/techniques) ← **primary reading**
- [Anthropic Prompt Engineering Docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)

---

## Session Files

| File / Folder | Description | Status |
|---------------|-------------|--------|
| `slides/` | Prensentation | ✅ (almost) Ready |
| `wiki/` | Deep-dive reference articles (5 articles, one per technique) | ✅ (partial) Ready |
| `demo/` | Jupyter notebooks for hands-on demos (5 notebooks) | ✅ Ready |

---

## Reference Library (Quick Links)

### Guides
- https://www.promptingguide.ai/techniques
- https://github.com/dair-ai/prompt-engineering-guide
- https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
- https://platform.openai.com/docs/guides/prompt-engineering
- https://cloud.google.com/discover/what-is-prompt-engineering
- https://ai.google.dev/gemini-api/docs/prompting-strategies

### Courses
- https://learn.deeplearning.ai/courses/chatgpt-prompt-eng (DeepLearning.AI — free)
- https://www.coursera.org/learn/generative-ai-prompt-engineering-for-everyone (IBM)
- https://www.coursera.org/learn/prompt-engineering (Vanderbilt)
- https://www.coursera.org/specializations/packt-prompt-engineering-masterclass-from-beginner-to-advanced
- https://www.coursera.org/specializations/prompting-essentials-google

### Key Papers
| Technique | Paper | Link |
|-----------|-------|------|
| Few-shot | Brown et al. 2020 — GPT-3 | https://arxiv.org/abs/2005.14165 |
| Chain-of-Thought | Wei et al. 2022 | https://arxiv.org/abs/2201.11903 |
| Zero-shot CoT | Kojima et al. 2022 | https://arxiv.org/abs/2205.11916 |
| Self-Consistency | Wang et al. 2022 | https://arxiv.org/abs/2203.11171 |
| Meta / APE | Zhou et al. 2022 | https://arxiv.org/abs/2211.01910 |
| OPRO (prompt optimisation) | Yang et al. 2023 | https://arxiv.org/abs/2309.03409 |
| Least-to-Most | Zhou et al. 2022 | https://arxiv.org/abs/2205.10625 |
| Step-Back Prompting | Zheng et al. 2023 | https://arxiv.org/abs/2310.06117 |

---

## Connection to Other Sessions

| Session | Connection |
|---------|------------|
| Session 1 (Probabilistic Thinking) | Prompt sensitivity and why prompting is non-deterministic |
| Session 3 (Decoding & Generation) | Temperature and sampling — directly affects Self-Consistency |
| Session 4 (Evaluation) | How to measure whether a prompting technique actually improved output |
| Session 5 (Prompt Engineering) | **this one** |
| Session 6 (Advanced Prompt Engineering) | Builds directly on this session — Tree of Thoughts, Prompt Chaining |
