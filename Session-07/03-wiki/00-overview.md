# Session 7 — Overview

**Application Development & Tool Integration.** How a bare LLM becomes an application — built up in
four layers on one customer-support example, capped by MCP.

## The spine
A support bot, given only a raw LLM, answers *"where's my order and can I return part of it?"* with a
confident, fully invented reply. One moment, four failures — and each is a layer:

| Failure | Cure | Page |
|---|---|---|
| Reply your code can't parse | Structured output | [01](01-structured-output.md) |
| Invented the order status | Tool / function calling | [02](02-tool-calling.md) |
| Invented the return policy | Retrieval (RAG) | [03](03-retrieval-rag.md) |
| One-shot guess, no recovery | Orchestration — the loop | [04](04-orchestration-loop.md) |

…then [MCP](05-mcp.md) as the integration standard that makes tools composable.

## The thread
Each layer reproduces something a human does without thinking. The four layers are the machinery it
takes to mimic one fluent human act. This is sharpest in [retrieval](03-retrieval-rag.md): *a question
and its answer don't look alike — trivial for you, a research field for a machine.*

## Where it sits in the series
Sessions 5–6 = talking to the model (prompting). **Session 7 = wiring it into an app (mechanics).**
Session 8 = choosing architectures (prompt vs RAG vs fine-tune vs agents). RAG and agents appear in
both 7 and 8 — here as *how*, there as *which*.

See also: [glossary](glossary.md) · full backing research in `../01-research/claude-deep-research.md`.
