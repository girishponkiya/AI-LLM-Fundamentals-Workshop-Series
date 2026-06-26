# 01 — Layer 1: Structured Output (the contract problem)

**Overview:** Software components talk to each other through **fixed contracts** — a REST endpoint
expects a request body and returns a response shape, a function has a signature, a table has a schema.
A bare LLM returns free-form prose, which nothing downstream can consume. Structured output is the
shift from *answering* to *interpreting*: the model fills out a **form**, not a letter, so its reply
becomes data your code can branch on. This is the substrate for every layer that follows — a tool call
(02) is just structured output pointed at your code; a retrieval result (03) is structured context fed
back in.

**Cross-references:** [00-overview.md](00-overview.md) — where this sits in the spine.
[02-tool-calling.md](02-tool-calling.md) — a tool call *is* structured output aimed at your code.
[03-retrieval-rag.md](03-retrieval-rag.md) — grounding fills the truth gap this layer cannot.
[04-orchestration-loop.md](04-orchestration-loop.md) — validation-failure → retry is the first turn of
the loop. Session 3 (constrained decoding / FSM) is the mechanism that *enforces* a schema at decode
time. Full backing research: [`../01-research/claude-deep-research.md`](../01-research/claude-deep-research.md) §2.

---

## The pain that motivates it

For an LLM to be a **component** rather than a chat toy, its output must conform to a contract the next
block can consume. You cannot pour *"Sure! Looks like order A7731 is on its way…"* into a function that
expects `{intent, order_id, items}`. So we stop asking the model to talk and start asking it to emit a
structure:

```json
{"intent": "order_status_and_return", "order_id": "A7731", "items": null}
```

Now your code can branch on `intent`, validate `order_id`, and notice `items` is `null` — an ambiguity
to flag (which items?). The reply went from prose-you-parse-by-hand to data-you-act-on.

> **The one-liner:** *It fills out a form; it doesn't write you a letter.*

---

## Three escalating levels of enforcement

| Level | What it gives you | What it does **not** give you |
|------|-------------------|-------------------------------|
| **1. Prompt-and-pray** — ask for JSON in the prompt | Works often | Fails silently sometimes. Not a contract. |
| **2. JSON mode** — provider guarantees *syntactically valid* JSON | Always parseable | Says nothing about *which* fields or types |
| **3. Schema-constrained / structured outputs** — supply a JSON Schema or Pydantic model; the decoder is constrained to schema-valid tokens | A real contract: right fields, right types, guaranteed | (still not *truth* — see below) |

Level 3 is the **constrained-decoding / finite-state-machine** idea from Session 3, now in service of
an application contract. The decoder is masked at each step so only tokens that keep the output
schema-valid can be emitted. All major providers now offer native schema-constrained structured
outputs; libraries like **Pydantic**, **Outlines**, and **xgrammar** implement the constraint layer.

---

## Pydantic AI shape (used in Demo 1)

```python
from pydantic import BaseModel
from pydantic_ai import Agent

class SupportReply(BaseModel):
    intent: str
    order_id: str | None
    needs_clarification: bool
    message: str

agent = Agent("your-vllm-model", output_type=SupportReply)
result = agent.run_sync("Where's A7731, can I return part of it?")
result.output            # -> a validated SupportReply, guaranteed
```

If validation fails, Pydantic AI feeds the error back to the model and it **retries** — your first
glimpse of the refinement loop (see [04-orchestration-loop.md](04-orchestration-loop.md)).

---

## The misconception to puncture

> *"Structured output guarantees correct data."*

**No.** It guarantees the **shape**, not the **truth**. The model can return a perfectly schema-valid
`order_id` it invented out of thin air. **Shape ≠ substance.** That gap is *exactly* why Layers 2 and 3
exist: tool calling fetches the real order, retrieval fetches the real policy. Structured output makes
the answer *machinable*; it does nothing to make it *true*.

---

## Editorial notes

- **Lead with the contract, not with Pydantic.** The audience is engineers — "software talks through
  fixed contracts" is a sentence they already believe. Structured output is just that belief applied to
  the model.
- **Demo beat (Demo 1, cell 2):** show the bare-prose answer, then `output_type=SupportReply`, then
  print `result.output` — a typed object. The contrast is the whole point.
- **Land "shape ≠ truth" hard.** It's the hinge that motivates the next two layers and pre-empts the
  most common misconception. Say it out loud and put the invented-but-valid `order_id` on the slide.
- **Callback forward:** "a tool call is just this, pointed at your code" — plant it here so Layer 2
  feels inevitable.

---

## References (educational-worthy; verified mid-2026)

- Pydantic AI — agents & structured output: ai.pydantic.dev (`output_type`, validation-retry)
- OpenAI Structured Outputs / JSON Schema mode; Anthropic tool-use as structured output
- Outlines & xgrammar — constrained decoding / FSM-masked generation (the Session 3 mechanism)
- JSON Schema — json-schema.org (the contract language under all of the above)
