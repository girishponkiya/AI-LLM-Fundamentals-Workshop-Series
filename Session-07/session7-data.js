/* Data for explore.html — Session 7 interactive overview.
   Shape consumed by explore.html: title, subtitle, thread, hook, layers[], mcp, demos[]. */
window.SESSION7 = {
  title: "Application Development & Tool Integration",
  subtitle: "How a bare LLM becomes an application — four layers on one support example, capped by MCP.",
  thread: "Each layer reproduces something a human does without thinking — easy for a human, hard for a machine.",

  hook: {
    label: "The disease — one bare LLM behind a chat box",
    customer: "“Where's my order #A7731, and can I return part of it?”",
    bot: "“Shipped Tuesday, arrives Thursday — and yes, 30-day returns, no problem!”",
    verdict: "Plausible. Confident. Entirely invented — it never looked anything up.",
    failures: [
      "Gave the UI a paragraph, not data",
      "Invented the order status",
      "Invented the return policy",
      "One blind guess, no recovery"
    ]
  },

  layers: [
    {
      n: 1, color: "#0F766E",
      title: "Structured output",
      tag: "The contract problem · shape ≠ truth",
      wiki: "03-wiki/01-structured-output.md",
      points: [
        "Software talks through fixed contracts — you can't feed prose to the next block.",
        "Constrain the output to a schema: it fills a form, not writes a letter.",
        "Three levels: prompt-and-pray → JSON mode → schema-constrained decoding (Session 3's FSM).",
        "Guarantees the <b>shape</b>, not the <b>truth</b> — a valid order_id can still be invented."
      ]
    },
    {
      n: 2, color: "#0E7490",
      title: "Tool / function calling",
      tag: "Decision layer (model) vs execution layer (your code)",
      wiki: "03-wiki/02-tool-calling.md",
      points: [
        "The model's knowledge is frozen and blind to your systems — so it reaches out.",
        "It emits a structured <i>call</i>; your code runs the real function and feeds the result back.",
        "The model <b>decides</b>; your code <b>executes and authorizes</b> — the whole security story.",
        "Research idea = ReAct; production form = function calling (same ART lineage)."
      ]
    },
    {
      n: 3, color: "#7C3AED",
      title: "Retrieval (RAG)",
      tag: "Why a question ≠ its answer — the centerpiece",
      wiki: "03-wiki/03-retrieval-rag.md",
      points: [
        "Two gaps — temporal (cutoff) and private (your data); one fix: retrieve into context.",
        "A question and its answer share few words and live in <i>different regions</i> of vector space.",
        "Fixes accrete: embeddings → asymmetric models / HyDE → hybrid + BM25 → rerank.",
        "All that machinery to reproduce what your brain does in half a second when you look it up."
      ]
    },
    {
      n: 4, color: "#B45309",
      title: "Orchestration — the loop",
      tag: "ReAct vs plan-and-execute",
      wiki: "03-wiki/04-orchestration-loop.md",
      points: [
        "An agent is a while-loop around an LLM with tools, retrieval, and a stop condition.",
        "ReAct decides as it goes (trial-and-error); plan-and-execute plans first (project management).",
        "Robustness lives here: validate-and-retry, ambiguity handling, stop conditions.",
        "agent.iter() / all_messages() show the decoded execution sequence — before MLflow even opens."
      ]
    }
  ],

  mcp: {
    color: "#0F766E",
    title: "MCP — the integration standard",
    tag: "USB-C / LSP for AI · handshake → discovery → call",
    wiki: "03-wiki/05-mcp.md",
    points: [
      "Hand-wiring 50 tools across 3 models = the N×M problem; MCP collapses it to N+M.",
      "Open standard (Anthropic, Nov 2024; Linux Foundation) over JSON-RPC 2.0.",
      "Lifecycle: <code>initialize</code> handshake → <code>tools/list</code> discovery → <code>tools/call</code>.",
      "Handshake ≠ discovery — two separate steps. Copilot agent mode is a live MCP host."
    ]
  },

  demos: [
    { title: "Demo 1 — Support assistant", note: "All four layers on one Pydantic AI agent; the loop, a retry, then the run as an MLflow timeline." },
    { title: "Demo 2 — Same agent via MCP", note: "Hand-wired tools swapped for an MCP server; point at list_tools (the menu) and call_tool in the trace." },
    { title: "Demo 3 — Why retrieval is hard", note: "A question embeds nearer other questions than its answer; HyDE closes the gap, in numbers." }
  ]
};
