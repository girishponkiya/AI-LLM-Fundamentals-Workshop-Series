# 02 — Layer 2: Tool / Function Calling

**Overview:** A model's knowledge is frozen at training time and it has no access to the present world
or to *your* systems — it cannot know today's order status. Tool calling lets it **reach out**: you
describe a function, the model emits a **structured call** naming it and filling the arguments, *your
code* runs the real function and hands the result back. The mental model that carries the whole layer:
the model is the **decision layer** (which function, what arguments); your code is the **execution
layer**. The model never touches your database — it only *asks*.

**Cross-references:** [01-structured-output.md](01-structured-output.md) — a tool call *is* structured
output (01) aimed at your code; same primitive, new target. [03-retrieval-rag.md](03-retrieval-rag.md)
— retrieval can be a fixed pipeline step *or* a `search()` tool the model calls (agentic RAG).
[04-orchestration-loop.md](04-orchestration-loop.md) — one tool call is a single reach; the loop chains
many. [05-mcp.md](05-mcp.md) — MCP is the *standard* for exposing tools so any model talks to any tool.
Research: [`../01-research/claude-deep-research.md`](../01-research/claude-deep-research.md) §3. Builds
directly on Session 6's ReAct.

---

## The mechanism — the heart of "integration"

1. **Describe** a function to the model: a name, a description, and a JSON Schema for its arguments.
2. The model, instead of replying in prose, emits a **structured tool call** — a JSON object naming the
   function and filling its arguments.
3. Your code **intercepts** it, runs the real function (`get_order("A7731")` → hits the DB), and passes
   the result back into the conversation.
4. The model **continues** with real data in hand.

> **The line to remember:** the model **decides**, your code **executes and authorizes**. Every action
> is mediated, validated, and authorized by code you control. That single sentence is your entire
> trust-and-security story.

---

## Decision layer vs execution layer

This split is why *"the model deleted my database"* is a **your-code failure**, not a model failure.
The model can only *request* `delete_user(42)`; whether that runs — and with what privileges, and
whether a human approves first — is decided entirely by the execution layer. Design tools the way you'd
design an API surface exposed to an untrusted caller:

- Read-only by default; write/destructive tools gated behind explicit approval.
- Validate arguments before executing (Pydantic does this for you).
- Return model-readable errors, not exceptions that crash the run.

---

## The research → production arc (ties to the ART reading)

**ReAct** (Reason + Act, Yao et al. 2022) introduced interleaving *Thought → Action → Observation*,
where the "Action" was **parsed out of free-form text** the model generated. Function calling is the
**productized, API-guaranteed** version of the same idea: the provider returns a well-formed call
instead of you regexing it out of prose. **ART** (Automatic Reasoning and Tool-use) in the assigned
reading is the same lineage.

> Narrative to land: *"the research idea was ReAct; the production form is function calling."*

The Session 6 ReAct loop hand-rolled `Thought:/Action:` string parsing. Native tool-calling APIs (and
Pydantic AI on top of them) kill the parser — but the orchestration around it (loops, retries, stop
conditions) is still your job. See [04-orchestration-loop.md](04-orchestration-loop.md).

---

## Pydantic AI shape (used in Demo 1)

```python
@agent.tool_plain                       # no agent context needed
def get_order(order_id: str) -> dict:
    """Look up an order by its ID and return status + line items."""
    return db.lookup(order_id)
```

Pydantic AI builds the tool's JSON Schema from the **function signature**, and pulls the
**description from the docstring** (param descriptions too). Arguments are **validated by Pydantic**; if
the model supplies bad args, the error is handed back and it retries. Tools can return anything Pydantic
can serialize.

---

## Pitfalls / war-story material

- **Too many tools** → the model picks wrong or stalls. Keep the menu small and well-described.
- **Vague descriptions** → wrong arguments. The model reads your description fields to decide how to
  call. **Treat tool descriptions as prompts.**
- **Trusting tool output blindly** → tool results can be wrong or untrusted; validate.
- **No error path** → a tool that throws should return a model-readable error so the model can adapt,
  not crash the run.

---

## The misconception to puncture

> *"The model runs the tool."*

It does **not**. It *requests*; your code runs it and decides whether to. (See the decision/execution
split above — it's the same point, and it's worth repeating because the whole security story hangs on
it.)

---

## Editorial notes

- **One sentence does the heavy lifting:** "the model decides, your code executes." Put it on the slide
  alone. Everything about safety, validation, and authorization is a corollary.
- **Demo beat (Demo 1, cell 3):** show the model *emitting* the call, then your code running
  `get_order` and the real status returning. Make the interception visible — that's the "aha."
- **Tie to the reading:** name ReAct → function calling → ART explicitly so the lineage lands.
- **Resist coding all of retrieval here.** `get_policy` in the demo is a tiny in-memory lookup; the deep
  retrieval ideas live in Layer 3 on slides, not in this tool.

---

## References (educational-worthy; verified mid-2026)

- ReAct — Yao et al. 2022, arXiv:2210.03629 (the pattern function calling productizes)
- ART (Automatic Reasoning and Tool-use) — the assigned-reading lineage
- Pydantic AI — tools & toolsets: ai.pydantic.dev (`@agent.tool` / `@agent.tool_plain`, schema from
  signature, docstring as description, arg validation + retry)
- OpenAI function calling / `tool_calls`; Anthropic `tool_use` blocks — provider-native tool APIs
