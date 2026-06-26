# 04 — Layer 4: Orchestration & the Loop (planning at runtime)

**Overview:** One tool call (02) is a single reach. A real task needs many, in sequence — and the agent
must **work out that sequence at runtime, from the query, as it goes.** The demystifying line:
*an agent is basically a while-loop around an LLM with tool access and a stopping condition.* That's it;
everything else is refinement. This page covers the loop, the two philosophies of runtime planning
(**ReAct** vs **plan-and-execute**), the robustness patterns that separate a demo from production, and
the Pydantic AI handles that let you show the decoded execution sequence at the code level.

**Cross-references:** [02-tool-calling.md](02-tool-calling.md) — a single tool call is the degenerate
one-step case of this loop. [01-structured-output.md](01-structured-output.md) — validate-and-retry
starts from a schema-validation failure. [03-retrieval-rag.md](03-retrieval-rag.md) — retrieval is one
of the steps the loop sequences. Session 6's **prompt chaining** is the *deterministic* end of this
spectrum (you wired the steps); the dynamic loop is the *adaptive* end (the model wires them).
**Boundary flag:** full agentic architectures, multi-agent systems, and "*when is an agent worth it?*"
are **Session 8**. Research:
[`../01-research/claude-deep-research.md`](../01-research/claude-deep-research.md) §5.

---

## The loop

```
call model → it requests a tool → execute → feed result back → call model → … → stop when done
```

> **The line:** *an agent is a while-loop around an LLM, with tools, retrieval, and a stopping
> condition.* Say it plainly — it deflates the mystique and gives the audience a true mental model.

---

## Two philosophies of runtime planning

The human analogy is exact, and it's the meat of "how do you decode an execution sequence?"

| | **ReAct (Reason + Act)** | **Plan-and-Execute** |
|---|---|---|
| Idea | **Decide as you go** — Thought → Action → Observation, choosing each step from what you just saw | **Plan upfront, then do** — a Planner LLM lists the steps; a (often cheaper) Executor runs them |
| LLM calls | **One per step** | One planning call + cheap execution |
| Strength | Highly **adaptive** — pivots when a tool fails or surprises it | **Predictable, inspectable before execution**, fewer expensive reasoning calls |
| Weakness | Short-term thinking; can **loop or drift**; expensive on long chains | **Rigid** — a surprise needs an explicit **replanning** mechanism or it falls over |
| Human analogy | **Trial-and-error** | **Project management** |

**Mention briefly:** **ReWOO** (plan once with placeholders, run tools in parallel, synthesize — ~2 LLM
calls, very efficient, brittle to surprises) and **Reflexion** (after an attempt, the agent **critiques
its own output** and retries with that critique in memory — the self-correction pattern).

> **The unifying frame to hand the audience:** every single-agent architecture is just a set of answers
> to three questions — *(1) how many LLM calls per step? (2) how does it handle failure — adapt, replan,
> ignore, or self-critique-and-retry? (3) when does it stop?* Choose your answers and you've chosen your
> architecture.

**Pattern vs framework** (so nobody conflates them): **ReAct is a pattern** (a way to structure
reasoning); **Pydantic AI / LangGraph are frameworks** (the plumbing that implements patterns). You can
build a ReAct loop in any of them, or in raw Python.

---

## Robustness patterns that live in the loop

This is what separates a demo from production:

- **Validate-and-retry** — output fails its schema, or a tool errors → feed the error back, try again.
  *(Pydantic AI does this for you — via `ModelRetry`, not a plain exception.)*
- **Ambiguity handling** — *"which items?"* → ask a clarifying question vs assume and proceed. A genuine
  **design decision**, not a bug.
- **Stop conditions & loop guards** — max steps, no-progress detection, cost ceilings — or your adaptive
  agent becomes *"an expensive random walk."*

> Session 6's ReAct hardening checklist (cycle detection, consecutive-error cap, max-steps, fallback)
> applies here verbatim — the framework handles structure, **not** orchestration. The stop machinery is
> never optional.

---

## Pydantic AI shape — and a gift for the demo

```python
result = agent.run_sync("...")        # runs the whole loop to completion

# or, to expose the loop node-by-node:
async with agent.iter("...") as run:
    async for node in run:
        ...                            # walk the graph one node at a time

result.all_messages()                 # ModelRequest → ToolCallPart → ToolReturnPart → …
```

`agent.run()` runs the loop to completion. `agent.iter()` exposes the underlying graph **node-by-node**,
and `all_messages()` prints the full `ModelRequest → ToolCallPart → ToolReturnPart → …` sequence. That
means you can **show the execution sequence at the code level** — the "decoded sequence" made literal —
*before* you even open MLflow.

---

## The misconception to puncture

> *"An agent is magic."*

It's a **while-loop with tools and a stop condition.** The magic is in the *quality* of each decision
(the model) and the *discipline* of the orchestration (your stop machinery) — not in any mystery.

---

## Editorial notes

- **Pivot slide (Slide 11).** This is where the four layers stop being separate features and become one
  system. Deliver the while-loop line slowly; it reframes everything before it.
- **The human analogy carries the compare (Slide 12):** ReAct = trial-and-error; plan-and-execute =
  project management. Most real systems blend them — say so, then defer architecture choice to S8.
- **Show `all_messages()` before MLflow (Demo 1, cell 5).** The runtime plan printed as a message
  sequence is the cheapest, clearest way to make "decoding the sequence" literal.
- **Then break a tool (cell 6).** Watch the loop read the error and retry. That single beat is the whole
  "demo vs production" point.

---

## References (educational-worthy; verified mid-2026)

- ReAct — Yao et al. 2022, arXiv:2210.03629 (decide-as-you-go)
- Plan-and-Execute / ReWOO / Reflexion — LangChain planning-agents docs; "the 4 single-agent patterns"
- Pydantic AI — agents, `agent.iter()`, `all_messages()`, `ModelRetry`: ai.pydantic.dev
- Lilian Weng — "LLM Powered Autonomous Agents" (best long-form overview)
- Session 6 wiki — ReAct hardening checklist (cycle detection, error caps, max-steps, fallback)
