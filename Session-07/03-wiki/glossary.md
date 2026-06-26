# Glossary — Session 7

Every term in one place. Page references point to the wiki file where the term is developed.

---

### Layer 1 — Structured output

- **Structured output** — making the model emit output that conforms to a contract (a JSON Schema /
  Pydantic model) your code can consume. *"Fills a form, not a letter."* → [01](01-structured-output.md)
- **Contract** — the fixed shape software components agree on (REST body, function signature, DB schema).
  The reason structured output exists. → [01](01-structured-output.md)
- **JSON mode** — provider guarantee of *syntactically valid* JSON; says nothing about which fields/types.
  → [01](01-structured-output.md)
- **Schema-constrained / structured outputs** — decoder constrained to only schema-valid tokens; a real
  contract. The Session 3 constrained-decoding / FSM idea applied to an app. → [01](01-structured-output.md)
- **Shape ≠ truth** — structured output guarantees the *shape* of the reply, not its *correctness*; a
  schema-valid `order_id` can still be invented. → [01](01-structured-output.md)
- **Pydantic / Outlines / xgrammar** — libraries that implement the schema-constraint layer.
  → [01](01-structured-output.md)

### Layer 2 — Tool / function calling

- **Tool / function calling** — the model emits a structured *call* (name + arguments); your code runs the
  real function and feeds the result back. → [02](02-tool-calling.md)
- **Decision layer vs execution layer** — the model *decides* which function and arguments; *your code*
  executes and authorizes. The whole trust/security story. → [02](02-tool-calling.md)
- **ReAct (Reason + Act)** — interleaved Thought → Action → Observation; the research pattern that
  function calling productizes. → [02](02-tool-calling.md), [04](04-orchestration-loop.md)
- **ART (Automatic Reasoning and Tool-use)** — same lineage as ReAct; the assigned-reading reference.
  → [02](02-tool-calling.md)
- **Tool description as prompt** — the model reads your description/docstring to decide how to call; vague
  text → bad calls. → [02](02-tool-calling.md)

### Layer 3 — Retrieval (RAG)

- **RAG (Retrieval-Augmented Generation)** — retrieve relevant text at query time, put it in the context
  window, ground the answer. *"Open-book exam."* → [03](03-retrieval-rag.md)
- **Two gaps — temporal & private** — the model doesn't know the present world (cutoff) and has never seen
  *your* data; RAG fixes both. → [03](03-retrieval-rag.md)
- **Embedding** — a vector capturing meaning, so paraphrases sit close; fixes *vocabulary mismatch*.
  → [03](03-retrieval-rag.md)
- **Query–answer asymmetry** — a question and its answer are different shapes and live in different regions
  of embedding space; the centerpiece "hard for a machine" problem. → [03](03-retrieval-rag.md)
- **Symmetric vs asymmetric search** — symmetric = query≈document (dup detection); asymmetric = short query
  → long passage (what RAG needs). → [03](03-retrieval-rag.md)
- **DPR / E5 / MS MARCO** — asymmetry-trained retrieval: separate Q/passage encoders (DPR); `query:` /
  `passage:` prefixes (E5); query→passage training data (MS MARCO). → [03](03-retrieval-rag.md)
- **Query transformation** — *rewriting* (clean/disambiguate), *multi-query / expansion* (fan out + union),
  *HyDE* (below). → [03](03-retrieval-rag.md)
- **HyDE (Hypothetical Document Embeddings)** — have the LLM write a hypothetical *answer*, embed that, and
  search — matching answer-to-answer to bridge the asymmetry. → [03](03-retrieval-rag.md)
- **BM25** — sparse/lexical scoring; nails exact terms, SKUs, codes; no notion of meaning.
  → [03](03-retrieval-rag.md)
- **Hybrid search** — run dense + BM25 and fuse; the single highest-impact upgrade over pure vector search.
  → [03](03-retrieval-rag.md)
- **RRF (Reciprocal Rank Fusion)** — fuse result lists by *rank position* (not raw, incomparable scores).
  → [03](03-retrieval-rag.md)
- **Bi-encoder vs cross-encoder** — bi-encoder embeds query/doc separately (fast, recall); cross-encoder
  scores the pair jointly (accurate, slow → shortlist only). → [03](03-retrieval-rag.md)
- **Reranking** — second-stage precision pass (cross-encoder) over first-stage candidates.
  → [03](03-retrieval-rag.md)
- **ColBERT / late interaction** — token-level matching; a middle ground between bi- and cross-encoders.
  → [03](03-retrieval-rag.md)
- **Chunking / contextual retrieval / metadata filtering** — the production dials of a RAG index.
  → [03](03-retrieval-rag.md)

### Layer 4 — Orchestration / the loop

- **Agent** — a while-loop around an LLM with tools, retrieval, and a stopping condition.
  → [04](04-orchestration-loop.md)
- **The loop** — call model → request tool → execute → feed result back → repeat → stop.
  → [04](04-orchestration-loop.md)
- **Plan-and-Execute** — plan all steps upfront, then run them; predictable, inspectable, rigid (needs
  replanning on surprise). → [04](04-orchestration-loop.md)
- **ReWOO** — plan once with placeholders, run tools in parallel, synthesize; efficient, brittle.
  → [04](04-orchestration-loop.md)
- **Reflexion** — self-critique an attempt and retry with that critique in memory.
  → [04](04-orchestration-loop.md)
- **Validate-and-retry** — feed a schema/tool error back to the model and try again (Pydantic AI via
  `ModelRetry`). → [04](04-orchestration-loop.md)
- **Stop conditions / loop guards** — max steps, no-progress detection, cost ceilings; without them the
  agent is "an expensive random walk." → [04](04-orchestration-loop.md)
- **Pattern vs framework** — ReAct is a *pattern*; Pydantic AI / LangGraph are *frameworks* that implement
  patterns. → [04](04-orchestration-loop.md)
- **`agent.iter()` / `all_messages()`** — Pydantic AI handles that expose the loop node-by-node and print
  the `ModelRequest → ToolCallPart → ToolReturnPart` sequence. → [04](04-orchestration-loop.md)

### MCP

- **MCP (Model Context Protocol)** — open standard (Anthropic, Nov 2024; Linux Foundation) over JSON-RPC
  2.0 that turns N×M tool integration into N+M. → [05](05-mcp.md)
- **N×M problem** — every model needing bespoke glue for every tool; MCP collapses it to N+M.
  → [05](05-mcp.md)
- **USB-C for AI / LSP analogy** — one port/protocol so any model talks to any tool (LSP = any editor ↔
  any language server). → [05](05-mcp.md)
- **Host / Client / Server** — Host = app where the LLM lives (consent arbiter); Client = 1:1 connection
  to a server; Server = wraps a filesystem/DB/API. → [05](05-mcp.md)
- **Tools / resources / prompts** — MCP primitives: verbs / nouns / templates. → [05](05-mcp.md)
- **Lifecycle: handshake → discovery → call** — `initialize` (capability negotiation), `tools/list`
  (self-describing catalog, "read the menu"), `tools/call` (validated, approval-gated). Handshake and
  discovery are **separate** steps. → [05](05-mcp.md)
- **stdio vs Streamable HTTP** — local subprocess transport vs remote (HTTPS + OAuth). → [05](05-mcp.md)
- **Rug-pull protection** — if a server's tool list changes, prior approvals are reset. → [05](05-mcp.md)
- **MCP Registry** — preview "npm for MCP servers." → [05](05-mcp.md)

### Stack / tooling (the demo)

- **Pydantic AI** — model-agnostic agent framework; structured output, tools, MCP client, validation-retry.
- **MLflow autolog** — `mlflow.pydantic_ai.autolog()`; turns a run into a timeline of agent/LLM/tool/MCP
  spans (callback to Session 4). Pin `pydantic-ai < 1.69` (autolog breaks on ≥ 2.0).
- **vLLM / Ollama** — OpenAI-compatible model backends; the model **must** support tool/function calling.
- **`USE_TEST_MODEL`** — `.env` toggle to run notebooks against a fake model (no live LLM) for rehearsal.

---

*Discovered-but-deferred terms (Q&A reservoir / Session 8): GraphRAG, SPLADE/learned-sparse, agentic RAG /
CRAG, RAG evaluation (RAGAS), semantic caching, lost-in-the-middle, MCP elicitation & sampling, A2A
(agent-to-agent), multi-agent orchestration. See research §9.*
