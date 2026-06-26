# Session 7 — Application Development & Tool Integration

Part of the [AI & LLM Fundamentals Workshop Series](https://github.com/girishponkiya/AI-LLM-Fundamentals-Workshop-Series).
A ~75-minute, flipped-classroom session that turns a bare LLM into an application — built up through
**four layers** on a single customer-support example, capped by **MCP**.

> **The spine:** one hallucinating support bot → four cures → one integration standard.
> **The thread:** each layer reproduces something a human does without thinking — *easy for a human,
> hard for a machine.*

## The four layers (+ the standard)
1. **Structured output** — the contract problem; make the model fill a form, not write a letter.
2. **Tool / function calling** — decision layer (model) vs execution layer (your code).
3. **Retrieval (RAG)** — and *why retrieval is hard*: a question and its answer don't look alike.
4. **Orchestration — the loop** — an agent is a while-loop around an LLM with tools, retrieval, and a
   stop condition; ReAct vs plan-and-execute.
- **MCP** — USB-C / LSP for AI; `handshake → discovery → call`; Copilot is an MCP host.

## Folder
```
01-research/   claude-deep-research.md      # the full research backing the session
03-wiki/       00-overview + 01..05 layer pages + glossary + wiki-tree.html
04-slides/     deck.pptx / deck.pdf + slide-plan.md + presenter-transcript.md
05-demo/       README + notebooks/ + mcp_server.py + .env + requirements.txt + demo-plan.md + copilot-runbook.md
explore.html   interactive overview (session7-data.js)
SESSION.yaml   the session manifest
_source/       the original AI-generated files, preserved untouched
```

## Running the demos
See [`05-demo/README.md`](05-demo/README.md). Short version:
```bash
cd 05-demo && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# edit .env (model + MLflow); set USE_TEST_MODEL=1 to rehearse without a live model
jupyter lab        # open notebooks/demo_01_support_assistant.ipynb
```
**One hard requirement:** the demo model must support tool/function calling (vLLM:
`--enable-auto-tool-choice` + a tool parser; Ollama: a tool-capable model like `qwen2.5`).

## Differentiation from Session 8
S7 = **how to build** the pieces (mechanics). S8 = **which to choose** (prompt vs RAG vs fine-tune vs
agents). RAG and agents appear in both, at different altitudes.

## Verified stack
`pydantic-ai-slim 1.68` + `mlflow 3.x` (autolog). Pinned `pydantic-ai < 1.69` — MLflow's autolog
breaks on pydantic-ai ≥ 2.0.
