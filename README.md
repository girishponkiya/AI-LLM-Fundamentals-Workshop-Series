# AI & LLM Fundamentals Workshop Series

## Series Overview

**Introduction to LLMs for Software Developers** is a workshop series designed to help software engineers transition into effective AI engineering. Sessions run 60–90 minutes in a **flipped classroom format**: participants review foundational material (Hugging Face LLM Course, Prompt Engineering Guide, etc.) before each live session, which is then devoted to discussion, hands-on labs, and concept debugging rather than traditional lecture.

**Primary reading sources:**
- [Hugging Face LLM Course](https://huggingface.co/learn/llm-course)
- [Introduction to Large Language Models (LLMs) by IIT Bombay and IIT Delhi](https://www.iitb.ac.in/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

> **Note:** Sessions contain more content than can be fully covered in 60–90 minutes. Each session is a starting point for discussion, not comprehensive coverage. Discussions can continue offline indefinitely.

---

## Session Status

| # | Title | Status | Folder |
|---|-------|--------|--------|
| 1 | LLM Paradigm Shift (Probabilistic Thinking) | ✅ Complete | `Session 01 - LLM Paradigm Shift/` |
| 2 | LLM Internals – Tokenization and Basic Architecture | ✅ Complete | *(no separate files)* |
| 3 | LLM Internals – Decoding and Text Generation | ✅ Complete | `Session 03 - Decoding and Text Generation/` |
| 4 | Evaluation, Testing, and Error Handling | 🔄 In Preparation | `Session 04 - Evaluation, Testing, and Monitoring/` |
| 5 | Core Prompt Engineering Techniques | 🔜 Upcoming | — |
| 6 | Advanced Prompt Engineering | 🔜 Upcoming | — |
| 7 | Application Development & Tool Integration | 🔜 Upcoming | — |
| 8 | Advanced Customization – Prompting vs. RAG vs. Fine-Tuning vs. Agents | 🔜 Upcoming | — |

---

## Completed Sessions

### Session 1: LLM Paradigm Shift (Probabilistic Thinking)
**Topics:** Probabilistic outputs, prompt sensitivity, hallucinations, development workflow, monitoring, mindset shift.

The foundational mindset shift from deterministic software engineering ($f(x) = y$) to AI engineering ($P(y \mid x)$). Covers the evolution from Seq2Seq to Transformers, the "Butterfly Effect" of prompt sensitivity, security risks like slopsquatting, and Spec-Driven Development.

**Reading Material/Video:**
- [The LLM Revolution: Transforming Technology and Human Interaction](https://medium.com/@mjangid408.mj/the-llm-revolution-transforming-technology-and-human-interaction-0c59cac7ac96)
- [LLM Integration in Software Engineering: A Comprehensive Framework of Paradigm Shifts, Core Components & Best Practices](https://dev.to/boting_wang_9571e70af30b/llm-integration-in-software-engineering-a-comprehensive-framework-of-paradigm-shifts-core-21ci)
- [The New Code - OpenAI Sean Grove (YouTube)](https://www.youtube.com/watch?v=vwL8Exv3vMI)
- [LLM Settings](https://www.promptingguide.ai/introduction/settings)

---

### Session 2: LLM Internals – Tokenization and Basic Architecture
**Topics:** Tokenization, basic model architecture, autoregressive generation, chat templates.

Covers how LLMs process text as tokens (BPE), why they struggle with character-level tasks (the "Strawberry" test), autoregressive token-by-token generation, and how conversational chat turns are actually processed as a single continuous string separated by control tokens.

**Reading Material/Video:**
- [Hugging Face LLM Course - Chapter 2 Section 4 (Autoregressive models)](https://huggingface.co/learn/llm-course/en/chapter2/4)

---

### Session 3: LLM Internals – Decoding and Text Generation
**Topics:** Decoding strategies, text generation parameters, embeddings.

Covers the inference cycle (Prefill vs. Decode phase, TTFT vs. TPOT), logits and Softmax, deterministic strategies (Greedy Search, Beam Search), stochastic sampling (Temperature, Top-K, Top-P/Nucleus), and Constrained Decoding via FSMs for guaranteed JSON output.

**Reading Material/Video:**
- [Decoding Strategies in Large Language Models](https://mlabonne.github.io/blog/posts/2023-06-07-Decoding_strategies.html)
- [Decoding Strategies (Hugging Face Blog)](https://huggingface.co/blog/mlabonne/decoding-strategies)

---

## Session 4: Evaluation, Testing, and Monitoring *(In Preparation)*

**Topics:** Evaluation criteria, test prompts, eval frameworks, handling randomness, user feedback, guardrails, monitoring.

**Learning Objectives:**
- Define key evaluation metrics for LLM applications
- Implement testing strategies that account for non-determinism
- Understand guardrails, error handling, and production monitoring

**Key Frameworks in Scope:** Pydantic AI Evals, Phoenix (Arize), RAGAS, Langfuse v3, Guardrails AI, Outlines, DeepEval, LiteLLM, Promptfoo, Evidently AI

**Pre-Session Reading:**
- [LLM Testing Methods, Strategies, and Best Practices](https://skphd.medium.com/llm-testing-methods-strategies-and-best-practices-df01794f2b1d)
- [Evaluating LLM Systems: Metrics, Challenges, and Best Practices](https://medium.com/data-science-at-microsoft/evaluating-llm-systems-metrics-challenges-and-best-practices-664ac25be7e5)
- [LLM Evaluation Metrics: A Complete Guide](https://www.f22labs.com/blogs/llm-evaluation-metrics-a-complete-guide/)
- [LLM Evaluation Metrics (Evidently AI)](https://www.evidentlyai.com/llm-guide/llm-evaluation-metrics)


---

## Upcoming Sessions

### Session 5: Core Prompt Engineering Techniques
**Topics:** Zero-shot Prompting, Few-shot Prompting, Chain-of-Thought Prompting, Meta Prompting, Self-Consistency

**Learning Objectives:** Apply different prompt engineering techniques, understand when to use each strategy, implement chain-of-thought reasoning.

**Reading:**
- [Prompting Techniques](https://www.promptingguide.ai/techniques) — covering Zero-shot, Few-shot, Chain-of-Thought, Meta Prompting, Self-Consistency.

---

### Session 6: Advanced Prompt Engineering
**Topics:** Tree of Thoughts, Prompt Chaining, Generate Knowledge Prompting

**Learning Objectives:** Understand advanced prompt engineering methodologies, implement complex problem-solving via prompt chaining, learn knowledge generation for improved performance.

**Reading:**
- [Prompting Techniques](https://www.promptingguide.ai/techniques) — covering Tree of Thoughts, Prompt Chaining, Generate Knowledge Prompting.

---

### Session 7: Application Development & Tool Integration
**Topics:** Retrieval Augmented Generation (RAG), Automatic Reasoning and Tool-use, Automatic Prompt Engineering, structured output, iterative refinement, ambiguity handling, tone, code integration.

**Learning Objectives:** Implement RAG systems for enhanced context, integrate external tools with LLMs, generate structured outputs reliably.

**Reading:**
- [Prompting Techniques](https://www.promptingguide.ai/techniques) — covering RAG, Automatic Reasoning and Tool-use, APE, Structured Output, Iterative Refinement, Ambiguity Handling, Tone, Code Integration.

---

### Session 8: Advanced Customization – Prompting vs. RAG vs. Fine-Tuning vs. Agents
**Topics:** Prompting, RAG, fine-tuning, agents & tool use, choosing the right method, integration strategies.

**Learning Objectives:** Compare customization approaches for LLMs, understand when to use each technique, plan integration strategies for complex applications.

**Reading:**
- [AI Agents Course](https://huggingface.co/learn/agents-course)
- [Simple RAG for GitHub issues using Hugging Face Zephyr and LangChain](https://huggingface.co/blog/langchain)
- [Advanced RAG on Hugging Face documentation using LangChain](https://huggingface.co/blog/langchain)

---
