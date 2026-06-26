# Session 7 — Demo materials

Three notebooks that turn a bare LLM into a support assistant, plus a tiny MCP server. They mirror the
slide flow: Demo 1 builds all four layers on one agent, Demo 2 swaps the hand-wired tools for MCP, Demo
3 is the optional "why retrieval is hard" centerpiece.

```
05-demo/
├── notebooks/
│   ├── demo_01_support_assistant.ipynb   # all 4 layers + the loop + retry + MLflow timeline
│   ├── demo_02_mcp.ipynb                  # same agent, tools discovered from an MCP server
│   └── demo_03_retrieval_asymmetry.ipynb  # question ≠ answer in embedding space; HyDE closes the gap
├── mcp_server.py                          # FastMCP server exposing get_order + get_policy (used by demo_02)
├── .env.example                           # template — copy to .env and fill in model + MLflow + toggles
└── requirements.txt                       # verified working set
```

## Setup

```bash
cd 05-demo
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: point at your model + MLflow; set USE_TEST_MODEL=1 to run without a live model
jupyter lab          # open notebooks/demo_01_support_assistant.ipynb
```

`load_dotenv()` walks up from the notebook directory, so `.env` is found from `notebooks/`. `demo_02`
launches `../mcp_server.py` as a subprocess over stdio — run Jupyter from inside `05-demo/`.

## One hard requirement

**The demo model must support tool/function calling.**
- **vLLM:** start with `--enable-auto-tool-choice` and a tool parser.
- **Ollama:** use a tool-capable model (e.g. `qwen2.5`).

Confirm it once before running: run `demo_01` for real. If the model can't call tools, Demos 1 and 2
won't work — there is no graceful degradation for that.

## Running without a live model

Set `USE_TEST_MODEL=1` in `.env`. Every notebook then runs against a fake model — no GPU, no endpoint —
so you can verify the wiring and the MLflow timeline end-to-end. Set it back to `0` for the live run.

## MLflow

Point `MLFLOW_TRACKING_URI` at your server. One line of `mlflow.pydantic_ai.autolog()` turns each run
into a timeline of agent / LLM / tool / MCP spans — the Demo 1 climax and the Session 4 callback. In
Demo 2 the trace shows `MCPServerStdio.list_tools` (discovery) and `call_tool` (the call) — the MCP
lifecycle, on the wire.

> **Version pin (matters):** `pydantic-ai < 1.69`. MLflow's autolog patches `Agent.__init__` in a way
> that breaks on pydantic-ai ≥ 2.0 (the `instrument=` kwarg was removed in 2.0). See
> [requirements.txt](requirements.txt).
