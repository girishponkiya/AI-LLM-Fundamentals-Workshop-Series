# 05 — MCP: the integration standard

**Overview:** In Demo 1 you hand-wire two tools. Now imagine 50 tools across 3 apps and 3 models —
every model needs bespoke glue for every tool: the **N×M integration problem**. **MCP (Model Context
Protocol)** is an open standard that collapses **N×M into N+M** — each model and each tool implements
**one** protocol and they all interoperate. The canonical line is *"USB-C for AI"*; for an engineering
room the sharper analogy is **LSP (Language Server Protocol)** — one protocol so any editor talks to any
language server. The wire lifecycle is **handshake → discovery → call**, and your daily tool (GitHub
Copilot) is already an MCP **host** that proves the whole story on screen.

**Cross-references:** [02-tool-calling.md](02-tool-calling.md) — MCP standardizes *how tools are exposed
and discovered*; function calling is the model invoking one tool you wired. [04-orchestration-loop.md](04-orchestration-loop.md)
— "the model decides, your code authorizes" reappears as MCP's host-consent model. Demo 2
(`demo_02_mcp`) swaps Demo 1's hand-wired tools for an MCP server; the runbook
([`../05-demo/copilot-runbook.md`](../05-demo/copilot-runbook.md)) shows Copilot as a live host.
Research: [`../01-research/claude-deep-research.md`](../01-research/claude-deep-research.md) §6.

---

## The pain that motivates it

Hand-wiring works for two tools. At **N models × M tools** it's up to N·M one-off integrations — ten of
each is up to a hundred bespoke glue jobs. There has to be a standard.

---

## What MCP is

An open standard (**Anthropic, Nov 2024**; since adopted by OpenAI, Google, and others; donated to the
**Linux Foundation**) that turns **N×M into N+M** — each model and each tool implements **one** protocol.
Built on **JSON-RPC 2.0**.

- **"USB-C for AI"** — the canonical, audience-friendly line: one port, any device.
- **LSP (Language Server Protocol)** — the sharper analogy for *this* room: one protocol so any editor
  talks to any language server, instead of editors×languages bespoke integrations. MCP was explicitly
  inspired by LSP. Use it — it lands harder than "API for AI" and avoids sounding like "the model calls
  a REST endpoint" (that's just function calling).

**Primitives:** **tools = verbs** (actions the model can invoke), **resources = nouns** (data it can
read), **prompts = templates.** **Roles:** **Host** (the app where the LLM lives; arbiter of consent),
**Client** (a 1:1 connection to one server, so permissions don't bleed), **Server** (wraps a filesystem
/ DB / API and exposes it; local or remote).

---

## The lifecycle — and the two analogies, corrected

The precise wire sequence (verified against the MCP spec):

1. **Handshake = `initialize`** — client and server exchange protocol version + capabilities; a mismatch
   ends the call; the client then sends `initialized`. This is **capability negotiation** — "agree what
   we both speak before any data flows." If you want an HTTP-family analogy, it's closer to a **TLS /
   WebSocket-upgrade negotiation** than an "HTTP handshake" (and MCP often runs over **stdio**, not HTTP
   at all).
2. **Discovery = `tools/list`** (also `resources/list`, `prompts/list`) — happens *after* the handshake;
   the server returns a **catalog** of each tool with a **name, description, and JSON Schema**. Best
   analogy: **OpenAPI / Swagger** — the server *self-describes* so the client hardcodes nothing.
   Memorable line: **"the model reads the menu."**
3. **Call = `tools/call`** — schema-validated arguments, gated by user approval.
4. **Shutdown** — clean transport close.

> **The correction to land:** the **handshake** (`initialize`) and **discovery** (`tools/list`) are
> **two separate steps.** Map them separately. Collapsing discovery into "the handshake" is the one
> thing a sharp attendee will catch.

**Transports:** **stdio** (local subprocess, low latency, no network port) and **Streamable HTTP**
(remote/cloud, needs HTTPS + OAuth). The **MCP Registry** (preview, Sept 2025) is becoming the "npm for
MCP servers."

---

## Copilot is an MCP host — the story, proven in their daily tool

GitHub Copilot **agent mode** supports MCP across all surfaces (VS Code, CLI, the cloud agent, the
Copilot app). GitHub's own docs describe the exact sequence: when Copilot adds a server it **"performs a
handshake and queries the tool list,"** then subscribes to `tools/list_changed`. The control surface is
your *"how you control it"* beat:

- Tools are **disabled by default**; you **manually enable** them.
- Each invocation prompts for confirmation — **Allow / Confirm** dropdowns scope it to *this session /
  this solution / all future*.
- **Rug-pull protection:** if a server's tool list changes, prior approvals are **reset.**
- Enterprise/org **"MCP servers in Copilot" policy** governs availability.
- Default servers: **GitHub MCP** (issues/PRs) and **Playwright MCP** (web); the **GitHub MCP Registry**
  lets you discover more.

So you can show — live or from screenshots — the **tool picker** (what Copilot can do), the
**enable/permission UI** (how you control it), and optionally **adding a server** and watching the
handshake + tool-list populate. The IDE narrates your analogy for you. Full steps:
[`../05-demo/copilot-runbook.md`](../05-demo/copilot-runbook.md).

---

## Security throughline

Human-in-the-loop on destructive actions, least privilege, vetted/trusted servers, OAuth for remote.
Worth one slide — and it's a callback to *"the model decides, your code authorizes"* from
[02-tool-calling.md](02-tool-calling.md).

---

## Misconceptions to puncture

- *"MCP is just an API."* → It's a **standard protocol** (USB-C / LSP), not an endpoint.
- *"Discovery is the handshake."* → They're **two separate** MCP steps (`initialize`, then `tools/list`).
- *"MCP replaces function calling."* → No — under the hood a `tools/call` *is* a function call; MCP
  standardizes how tools are *described, discovered, and connected* so they're swappable.

---

## Editorial notes

- **Motivate MCP by hand-wiring first.** Demo 1 wires two tools by hand; *then* "imagine fifty." Keep
  live MCP out of Demo 1 — servers are fiddly, and the hand-wiring is what makes MCP feel necessary.
- **Demo 2 is an A/B (Slide 19):** same agent, tools now discovered from a standalone server. Point at
  the trace: `MCPServerStdio.list_tools` (the menu) and `call_tool` (the call). "Handshake, menu, call."
- **Be precise about handshake ≠ discovery.** It's the credibility detail; both the trace and Copilot
  make the distinction visible on screen.
- **Land it in Copilot:** "the magic you trust daily is this exact protocol — handshake, read the menu,
  call a tool, you approve." Recognition, not instruction.

---

## References (educational-worthy; verified mid-2026)

- MCP spec & architecture — modelcontextprotocol.io (lifecycle, capability negotiation, primitives,
  transports)
- MCP lifecycle deep-dives — Grizzly Peak Software; codilime; Dremio; getknit
- Copilot + MCP — GitHub Docs (agent mode + MCP; "performs a handshake and queries the tool list");
  Microsoft Learn (VS / VS Code MCP)
- Pydantic AI MCP client — ai.pydantic.dev (`MCPServerStdio`, `run_mcp_servers()`)
- MCP Registry (preview, Sept 2025); JSON-RPC 2.0 (the wire format)
