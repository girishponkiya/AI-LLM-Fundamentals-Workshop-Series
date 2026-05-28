// Session 6 — Advanced Prompt Engineering — WIKI DATA
// Enriched with key points, pseudocode, references, and wiki_file deep-links
// extracted from the 03-wiki/ markdown files. Used by wiki-tree.html.

const THEME_DATA = [
  {
    "id": "families",
    "name": "Four Technique Families",
    "icon": "🧩",
    "color": "#6c3fc5",
    "tagline": "20+ named techniques collapse to 5 patterns. Use the family to pick the technique.",
    "wiki_file": "01-landscape.md",
    "sections": [
      {
        "id": "fam-decomp",
        "title": "Decomposition",
        "description": "Split the problem. Each call has one job + a gradable contract. Includes: Prompt Chaining, Least-to-Most, Plan-and-Solve, Skeleton-of-Thought.",
        "wiki_file": "01-landscape.md",
        "wiki_anchor": "#the-five-technique-families",
        "keyPoints": [
          { "text": "Output of step N feeds step N+1; intermediate states are inspectable, cacheable, and individually testable.", "core": true },
          { "text": "Engineering win is debuggability, not headline accuracy lift.", "core": false },
          { "text": "Motto: solve the smallest thing the model can reliably solve, then chain.", "core": true },
          { "text": "Members: Prompt Chaining, Least-to-Most, Plan-and-Solve, Skeleton-of-Thought (parallel fan-out).", "core": false }
        ],
        "references": [
          { "title": "Zhou et al. 2022 — Least-to-Most Prompting", "url": "https://arxiv.org/abs/2205.10625", "note": "Flagship decomposition technique." }
        ]
      },
      {
        "id": "fam-search",
        "title": "Search / Branching",
        "description": "Explore alternative reasoning paths. Externalises search the LLM cannot do internally. Includes: ToT, Graph-of-Thoughts, Maieutic.",
        "wiki_file": "01-landscape.md",
        "wiki_anchor": "#the-five-technique-families",
        "keyPoints": [
          { "text": "Vanilla CoT is left-to-right autoregressive — one wrong token commits the whole chain.", "core": false },
          { "text": "Search externalises exploration: propose k candidate thoughts, score with a value function, keep top-b, expand.", "core": true },
          { "text": "Motto: when early commits are catastrophic, branch and score.", "core": true },
          { "text": "Members: Tree of Thoughts (BFS/DFS/beam), Graph of Thoughts (DAG), Maieutic Prompting (SAT-resolved tree)." }
        ],
        "references": [
          { "title": "Yao et al. 2023 — Tree of Thoughts", "url": "https://arxiv.org/abs/2305.10601", "note": "Flagship search/branching technique." }
        ]
      },
      {
        "id": "fam-selfcorr",
        "title": "Self-Correction",
        "description": "Verify own work. REQUIRES external grounding (rubric / tests / verifier) — Huang et al. 2310.01798. Includes: Self-Refine, Reflexion, Constitutional, Contrastive CoT, Faithful CoT.",
        "wiki_file": "01-landscape.md",
        "wiki_anchor": "#the-five-technique-families",
        "keyPoints": [
          { "text": "Generate draft → critique against rubric/principles/contrastive demos → revise.", "core": false },
          { "text": "Cap at 1–2 rounds in production; more rounds rarely help and often regress (Huang 2310.01798).", "core": true },
          { "text": "Motto: the model is a better grader than generator — exploit that asymmetry.", "core": true },
          { "text": "Members: Self-Refine, Reflexion, Constitutional, Contrastive CoT, Faithful CoT." }
        ],
        "references": [
          { "title": "Madaan et al. 2023 — Self-Refine", "url": "https://arxiv.org/abs/2303.17651", "note": "Flagship self-correction technique." },
          { "title": "Huang et al. 2023 — LLMs Cannot Self-Correct Reasoning Yet", "url": "https://arxiv.org/abs/2310.01798", "note": "Why we cap rounds and require external verifiers." }
        ]
      },
      {
        "id": "fam-ground",
        "title": "External Grounding",
        "description": "Use tools / code / knowledge. Reasoning grounded in external reality. Includes: ReAct, Program-of-Thought, Generated Knowledge, Step-Back.",
        "wiki_file": "01-landscape.md",
        "wiki_anchor": "#the-five-technique-families",
        "keyPoints": [
          { "text": "The LLM does not compute the answer — it decides what to compute and delegates.", "core": true },
          { "text": "Arithmetic → Python interpreter, facts → retriever, log queries → real tooling.", "core": false },
          { "text": "Motto: don't make the model do what a deterministic tool does better.", "core": true },
          { "text": "Members: ReAct, Program-of-Thought, Generated Knowledge, Step-Back." }
        ],
        "references": [
          { "title": "Yao et al. 2022 — ReAct", "url": "https://arxiv.org/abs/2210.03629", "note": "Flagship external-grounding technique." }
        ]
      },
      {
        "id": "fam-context",
        "title": "Exemplar / Context Control",
        "description": "Control what enters the context window. Includes: Auto-CoT, Analogical, Active Prompting, Thread-of-Thought, S2A, Complexity-based, EmotionPrompt.",
        "wiki_file": "01-landscape.md",
        "wiki_anchor": "#the-five-technique-families",
        "keyPoints": [
          { "text": "Few-shot done right at scale: cluster the task distribution and auto-pick demos, or rewrite the context to drop distractors before solving.", "core": true },
          { "text": "Acts on the INPUT, not the reasoning trace.", "core": false },
          { "text": "Motto: cheapest accuracy lift is usually a better example, not a cleverer chain.", "core": true },
          { "text": "Members: Auto-CoT, Analogical, Active, Complexity-based, Thread-of-Thought, S2A, Directional Stimulus, EmotionPrompt." }
        ],
        "references": [
          { "title": "Zhang et al. 2022 — Auto-CoT", "url": "https://arxiv.org/abs/2210.03493", "note": "Flagship exemplar-control technique." }
        ]
      },
      {
        "id": "fam-timeline",
        "title": "Timeline 2021 → 2025",
        "description": "GenKnow (2021) → CoT/SC/L2M (2022) → ToT/ReAct/Reflexion/Self-Refine (2023) → Reasoning models o1/Claude/Gemini Thinking (2024-25) → think-tool, PRMs, test-time compute scaling.",
        "wiki_file": "01-landscape.md",
        "wiki_anchor": "#timeline-2021--2025",
        "keyPoints": [
          { "text": "2021: Generated Knowledge (Liu, arXiv:2110.08387) opens the era.", "core": false },
          { "text": "2023 H1 is the densest cluster — Reflexion, Self-Refine, Plan-and-Solve, ToT all landed within five months.", "core": true },
          { "text": "Sep 2024: OpenAI o1 ships — reasoning baked in via RL on internal CoT; the playbook shift begins.", "core": true },
          { "text": "Post-2024: research absorbed into the model itself — `think` tool, PRMs, test-time compute scaling laws." }
        ],
        "references": [
          { "title": "Session 6 wiki — 01-landscape.md", "url": "./01-landscape.md", "note": "Full timeline table and production-vs-academic split." }
        ]
      }
    ]
  },
  {
    "id": "primary",
    "name": "Primary Techniques",
    "icon": "⭐",
    "color": "#2b7de9",
    "tagline": "The four you must own — 25 min of deep dives. Mechanism, when, when-not, engineering example, failure modes.",
    "wiki_file": "02-tree-of-thoughts.md",
    "sections": [
      {
        "id": "pri-tot-mech",
        "title": "ToT — Mechanism: Propose → Eval → Search",
        "description": "Tree of Thoughts (Yao et al. 2023, arXiv:2305.10601). Propose k children → score each → BFS/DFS/beam → commit at threshold or budget exhausted. 20-50× tokens.",
        "wiki_file": "02-tree-of-thoughts.md",
        "wiki_anchor": "#definition",
        "keyPoints": [
          { "text": "Four-step loop: Propose k children → Evaluate each (sure/maybe/impossible or 1-10) → Search (BFS/DFS/beam keeps top-b) → Commit on threshold or budget.", "core": true },
          { "text": "ToT is not a prompt — it is an orchestration loop over many model calls.", "core": true },
          { "text": "Beam search with beam∈[2,5], depth∈[3,5] is the production default; cost ≈ beam × k × depth calls.", "core": false },
          { "text": "Mechanism that wins is scoring + pruning, NOT just branching (Self-Consistency only varies sampling)." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "ToT — beam search core loop",
          "code": "for d in range(depth):\n    candidates = []\n    while frontier:\n        node = frontier.popleft()\n        children = propose(node.state, k)        # 1 LLM call -> k thoughts\n        for thought in children:\n            new_state = apply_thought(node.state, thought)\n            score = evaluate(new_state)          # 1 LLM call per child\n            candidates.append(Node(new_state, score=score))\n    candidates.sort(key=lambda x: -x.score)\n    frontier = deque(candidates[:beam])          # prune to top-b"
        },
        "references": [
          { "title": "Yao et al. 2023 — Tree of Thoughts (NeurIPS 2023)", "url": "https://arxiv.org/abs/2305.10601", "note": "Original paper; Game of 24, Creative Writing, Mini Crosswords." },
          { "title": "princeton-nlp/tree-of-thought-llm", "url": "https://github.com/princeton-nlp/tree-of-thought-llm", "note": "Reference implementation; sure/maybe/impossible evaluator." }
        ]
      },
      {
        "id": "pri-tot-headline",
        "title": "ToT — 4% → 74% (Game of 24)",
        "description": "Vanilla CoT on GPT-4: 4%. ToT: 74%. The visceral demo for why search matters.",
        "wiki_file": "02-tree-of-thoughts.md",
        "wiki_anchor": "#the-game-of-24-headline-benchmark",
        "keyPoints": [
          { "text": "GPT-4 on Game of 24: standard prompting 7.3%, CoT 4.0%, CoT+SC(N=100) 9.0%, ToT(b=5) 74%.", "core": true },
          { "text": "The 4→74 delta is the most cherry-picked stat in prompt engineering — read with both asterisks: catastrophic early-commit + cheap reliable evaluator.", "core": true },
          { "text": "Also lifts Mini Crosswords (16% → 60%) and Creative Writing coherence.", "core": false },
          { "text": "Most production tasks are NOT Game of 24 — the structural prerequisites rarely hold." }
        ],
        "references": [
          { "title": "Yao et al. 2023 — Tree of Thoughts", "url": "https://arxiv.org/abs/2305.10601", "note": "Source of the 4%→74% headline." }
        ]
      },
      {
        "id": "pri-tot-rca",
        "title": "ToT — RCA hypothesis tree (engineering)",
        "description": "Propose 4 hypotheses (DB pool / GC pause / downstream timeout / deploy). Evaluator scores each against log evidence 1-10. Beam=2, depth=3. Ranked tree with evidence trails.",
        "wiki_file": "02-tree-of-thoughts.md",
        "wiki_anchor": "#engineering-example--rca-hypothesis-tree",
        "keyPoints": [
          { "text": "k=4 hypotheses, beam=2, depth=3 — Level-1 scores like [7,3,5,9] keep {deploy, db_pool}.", "core": true },
          { "text": "Pruned branches are kept in the audit log — post-mortem can ask why GC-pause was ruled out at level 1.", "core": true },
          { "text": "Evaluator emits a 1-10 score from raw evidence; cast to float and divide by 10.", "core": false },
          { "text": "The tree is one deliverable; the audit trail of pruned hypotheses is often the more valuable second one." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "RCA evaluator — numeric score against evidence",
          "code": "def evaluate_rca(state) -> float:\n    msg = [{\"role\": \"user\", \"content\":\n        f\"Evidence:\\n{state.evidence}\\n\\nHypothesis: {state.hypothesis}\\n\\n\"\n        \"Score 1-10 how well this hypothesis explains the evidence. \"\n        \"Respond with ONLY the integer.\"}]\n    raw = llm(msg, temperature=0.0)\n    try:\n        return int(raw.strip()) / 10\n    except ValueError:\n        return 0.5"
        },
        "references": [
          { "title": "Session 6 wiki — 02-tree-of-thoughts.md §RCA", "url": "./02-tree-of-thoughts.md", "note": "Full propose_rca / evaluate_rca code and MLflow logging." }
        ]
      },
      {
        "id": "pri-tot-nope",
        "title": "ToT — When NOT to use",
        "description": "(a) No reliable value function — search amplifies a bad evaluator (Misconception 2). (b) Task solvable >85% via SC N=5 — cheaper. (c) Real-time UX. (d) Reasoning model — you pay twice.",
        "wiki_file": "02-tree-of-thoughts.md",
        "wiki_anchor": "#when-not-to-use-tot",
        "keyPoints": [
          { "text": "Smell test: re-score one node 5× at temp 0.7 — std-dev > 0.2 means your evaluator is noise; ToT will burn money.", "core": true },
          { "text": "Self-Consistency N=5 already >85% → stay there; ToT is 30-50× cost for marginal gain.", "core": true },
          { "text": "Reasoning model exception: o1/o3/Claude Extended Thinking/Gemini Thinking do internal search — wrapping in ToT is the 'paying twice' anti-pattern.", "core": true },
          { "text": "Open-ended writing without rubric — 'score this paragraph' is too subjective; use Self-Refine with explicit rubric." }
        ],
        "references": [
          { "title": "Huang et al. 2023 — LLMs Cannot Self-Correct Reasoning Yet", "url": "https://arxiv.org/abs/2310.01798", "note": "Why LLM-judged value functions degrade the search." }
        ]
      },
      {
        "id": "pri-chain-onev",
        "title": "Chaining — One verb per call",
        "description": "Splitting heuristic. Cut at any boundary where you can write an assertion on intermediate output (JSON schema, regex, enum check).",
        "wiki_file": "03-prompt-chaining.md",
        "wiki_anchor": "#the-one-verb-per-call-splitting-heuristic",
        "keyPoints": [
          { "text": "Every prompt does exactly one thing — 'extract X and summarise Y and rate Z' is three calls.", "core": true },
          { "text": "Cut test: can you write an assertion (JSON schema, regex, enum, Pydantic) on intermediate output? Then it's a chain boundary.", "core": true },
          { "text": "Per-step accuracy goes up — single-verb prompts have tighter, more deterministic behaviour.", "core": false },
          { "text": "Bonus: cache hits on Step 1, easier debugging — when step 3 fails you know exactly which call to inspect." }
        ],
        "references": [
          { "title": "Anthropic Cookbook — prompt chaining", "url": "https://github.com/anthropics/anthropic-cookbook", "note": "Reference patterns; system-prompt caching per step." }
        ]
      },
      {
        "id": "pri-chain-floor",
        "title": "Chaining — Accuracy floor = product",
        "description": "0.95 × 0.92 × 0.88 × 0.80 = 62%. Per-step pass-rate analysis. Fix the weakest step first, not the overall pipeline.",
        "wiki_file": "03-prompt-chaining.md",
        "wiki_anchor": "#the-accuracy-floor-math--why-your-pipeline-ships-at-62",
        "keyPoints": [
          { "text": "End-to-end pass rate is the PRODUCT of per-step pass rates: 0.95 × 0.92 × 0.88 × 0.80 = 0.616.", "core": true },
          { "text": "Fix the weakest step first — never the one you remember last touching.", "core": true },
          { "text": "6-step chain at 0.95 → 73.5%; 10-step at 0.95 → 59.9%. More steps = lower floor.", "core": false },
          { "text": "Per-step pass-rate is the single most important MLflow metric to surface — bar chart it." }
        ],
        "references": [
          { "title": "Eugene Yan — LLM Patterns", "url": "https://eugeneyan.com/writing/llm-patterns/", "note": "Production chain patterns, per-step eval." }
        ]
      },
      {
        "id": "pri-chain-valid",
        "title": "Chaining — Validator + retry-w/-feedback",
        "description": "Pydantic schema. On fail: re-feed validator complaint as context for next attempt (micro-Self-Refine). Terminal failure → DLQ with full payload.",
        "wiki_file": "03-prompt-chaining.md",
        "wiki_anchor": "#validator--retry-with-feedback-micro-self-refine",
        "keyPoints": [
          { "text": "On ValidationError, inject the exact error back into ctx as `_<name>_feedback` for the next attempt.", "core": true },
          { "text": "This is a single-round Self-Refine embedded in a chain step — a micro-Self-Refine.", "core": true },
          { "text": "Each attempt becomes its own child MLflow span so retry pattern is visible in trace.", "core": false },
          { "text": "Beyond 2 retries you are in a bug — escalate per the error-propagation strategy." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "Validator + retry-with-feedback",
          "code": "for attempt in range(retries + 1):\n    raw = fn(ctx)\n    try:\n        parsed = schema.model_validate_json(raw)\n        ctx[name] = parsed.model_dump()\n        return ctx\n    except ValidationError as e:\n        ctx[f\"_{name}_feedback\"] = (\n            f\"Previous output failed validation:\\n{e}\\n\\n\"\n            \"Return STRICT JSON matching the schema. No prose.\"\n        )\nraise ChainStepError(name, last_output=raw, last_error=str(e))"
        },
        "references": [
          { "title": "Pydantic v2 docs", "url": "https://docs.pydantic.dev/", "note": "BaseModel, model_validate_json, ValidationError." }
        ]
      },
      {
        "id": "pri-chain-error",
        "title": "Chaining — Error propagation modes",
        "description": "Fail-fast (irreversible) · Fallback chain (degraded OK) · Self-heal (deterministic re-prompt) · Graceful degrade (mark for human review). Pick explicitly per chain.",
        "wiki_file": "03-prompt-chaining.md",
        "wiki_anchor": "#error-propagation-strategies-anchor-56",
        "keyPoints": [
          { "text": "Fail-fast for irreversible downstream actions (DB write, send-email, rollback).", "core": true },
          { "text": "Fallback chain for degraded-but-acceptable output; mark confidence=0.5.", "core": false },
          { "text": "Self-heal for deterministic validation errors — re-prompt with validator complaint (micro-Self-Refine).", "core": true },
          { "text": "Always emit a structured trace event on every failure. Without DLQ + MLflow trace, you degrade silently for weeks." }
        ],
        "references": [
          { "title": "Session 6 wiki — 03-prompt-chaining.md", "url": "./03-prompt-chaining.md", "note": "Full ChainResult / run_step_resilient pattern." }
        ]
      },
      {
        "id": "pri-genk-mech",
        "title": "GenKnow — Mechanism (Liu 2021)",
        "description": "Two-call: prompt LM to generate background facts → second call answers using those facts + question. LLM as own retriever, no embedding index. arXiv:2110.08387.",
        "wiki_file": "04-generate-knowledge.md",
        "wiki_anchor": "#definition",
        "keyPoints": [
          { "text": "Call 1 generates background knowledge (facts, rules, definitions) — no answer yet.", "core": true },
          { "text": "Call 2 answers using knowledge + original question; knowledge becomes explicit context tokens.", "core": true },
          { "text": "LLM acts as its own retriever — no embedding index needed; ~2× tokens, zero retrieval infrastructure.", "core": false },
          { "text": "Mechanism: latent parametric knowledge → explicit context, where attention can use it like retrieved documents." }
        ],
        "references": [
          { "title": "Liu et al. 2022 — Generated Knowledge Prompting", "url": "https://arxiv.org/abs/2110.08387", "note": "ACL 2022; NumerSense, CSQA 2.0, QASC SOTA at the time." }
        ]
      },
      {
        "id": "pri-genk-ex",
        "title": "GenKnow — Deprecated-API code review",
        "description": "Step 1: 'List deprecation rules for AWS SDK v2 → v3.' Step 2: 'Given this diff and the above rules, flag v2 usages and propose v3 rewrite.'",
        "wiki_file": "04-generate-knowledge.md",
        "wiki_anchor": "#engineering-example--deprecated-api-code-review",
        "keyPoints": [
          { "text": "The deprecation rules are explicit and citable — reviewer points at 'rule 4' rather than waving at v3 best practice.", "core": true },
          { "text": "Rules are a stable artefact — cache once per session/model version; run all PRs against the cached rule set.", "core": true },
          { "text": "Failures are diagnosable — if reviewer misses a v2 pattern, inspect Call 1 and see whether the rule was even listed.", "core": false },
          { "text": "Same pattern for Java 8→17, Python 2→3, React class→hooks, OAuth1→OAuth2, COBOL→Python migration." }
        ],
        "references": [
          { "title": "Anthropic Prompt Caching", "url": "https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching", "note": "Cache the knowledge artefact for 90% cost reduction on hits." }
        ]
      },
      {
        "id": "pri-genk-warn",
        "title": "GenKnow — Amplifies hallucinations",
        "description": "When model's parametric knowledge is wrong, generated knowledge bakes the error into context. NEVER use for ground-truth Q&A. Real RAG is Session 8.",
        "wiki_file": "04-generate-knowledge.md",
        "wiki_anchor": "#critical-warning--amplifies-hallucinations",
        "keyPoints": [
          { "text": "Failure pattern: wrong fact in Call 1 (e.g. 'Lambda timeout default 30s' — actually 3s) → confident, plausible, internally consistent, WRONG answer in Call 2.", "core": true },
          { "text": "Structurally identical to CoT's post-hoc rationalisation failure — chain looks right, foundation is wrong.", "core": true },
          { "text": "NEVER use for: customer support over real docs, citation-required outputs, medical/legal/financial advice, frequently-updated facts.", "core": false },
          { "text": "When stakes are high enough that hallucinated facts matter → switch to real RAG (Session 8)." }
        ],
        "references": [
          { "title": "Huang et al. 2023 — LLMs Cannot Self-Correct Reasoning Yet", "url": "https://arxiv.org/abs/2310.01798", "note": "Generalises to amplified hallucination in self-generated context." }
        ]
      },
      {
        "id": "pri-react-loop",
        "title": "ReAct — Thought/Action/Observation loop",
        "description": "Yao et al. 2022, arXiv:2210.03629. Model reasons in NL (Thought), emits structured action (search[q], calc[...]), orchestrator runs it, feeds back Observation. Repeat until Finish or budget.",
        "wiki_file": "05-react.md",
        "wiki_anchor": "#definition",
        "keyPoints": [
          { "text": "Each turn: Thought (NL reasoning) → Action (structured tool call) → Observation (tool output appended to conversation).", "core": true },
          { "text": "Loop continues until Finish[...], max-step budget hit, cycle detection fires, or consecutive errors exceed cap.", "core": true },
          { "text": "ReAct is STATEFUL — full conversation history (thoughts + actions + observations) is passed on every subsequent turn.", "core": false },
          { "text": "Synergy: Thoughts react to observations; Actions ground reasoning in external reality — neither alone matches the combo." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "ReAct turn (production-shaped)",
          "code": "for step in range(max_steps):\n    msg = llm_chat(history)\n    history.append({\"role\": \"assistant\", \"content\": msg})\n    thought, action = parse_react(msg)\n    if action[\"name\"] == \"Finish\":\n        return action[\"args\"][\"answer\"]\n    call_key = (action[\"name\"], json.dumps(action[\"args\"], sort_keys=True))\n    if call_key in seen: break          # cycle detection\n    seen.add(call_key)\n    obs = tools[action[\"name\"]](**action[\"args\"])\n    history.append({\"role\": \"user\", \"content\": f\"Observation: {obs}\"})\nreturn fallback_cot(question)            # non-convergence path"
        },
        "references": [
          { "title": "Yao et al. 2022 — ReAct (ICLR 2023)", "url": "https://arxiv.org/abs/2210.03629", "note": "Original paper; ALFWorld, WebShop, HotpotQA, FEVER." }
        ]
      },
      {
        "id": "pri-react-bench",
        "title": "ReAct — Benchmarks",
        "description": "ALFWorld +34 pp over IL+RL. WebShop +10 pp. HotpotQA, FEVER: consistently beats CoT-only and action-only baselines.",
        "wiki_file": "05-react.md",
        "wiki_anchor": "#benchmarks-yao-et-al-2022-iclr-2023",
        "keyPoints": [
          { "text": "ALFWorld (text household tasks): +34 pp absolute over Imitation Learning + RL baseline.", "core": true },
          { "text": "WebShop (multi-step web shopping): +10 pp over IL+RL.", "core": false },
          { "text": "HotpotQA + FEVER: ReAct beats CoT-only AND action-only consistently — more robust to hallucination than CoT.", "core": true },
          { "text": "Reason-only hallucinates; Act-only is brittle; ReAct combines both — each step is auditable and adaptive." }
        ],
        "references": [
          { "title": "Yao et al. 2022 — ReAct", "url": "https://arxiv.org/abs/2210.03629", "note": "Source of all benchmarks." }
        ]
      },
      {
        "id": "pri-react-bot",
        "title": "ReAct — On-call incident bot",
        "description": "Tools: query_metrics, tail_logs, list_recent_deploys, rollback. Bot sees metric spike at deploy time → proposes targeted rollback. Each step inspectable, auditable, retraceable.",
        "wiki_file": "05-react.md",
        "wiki_anchor": "#engineering-example--on-call-incident-bot-demo-d4",
        "keyPoints": [
          { "text": "Three tool calls, four thoughts, one Finish → bot proposes targeted rollback with evidence trail.", "core": true },
          { "text": "Bot stays read-only — `rollback` defined but NOT exposed; human approves the write action.", "core": true },
          { "text": "Each Thought reflects on the Observation: pool 99% → suspect exhaustion → tail logs → see slow queries → check deploys.", "core": false },
          { "text": "Production posture: write tools always require human approval; read-only tools can autonomously run." }
        ],
        "references": [
          { "title": "Session 6 wiki — 05-react.md §D4", "url": "./05-react.md", "note": "Full tool dictionary + sample trace." }
        ]
      },
      {
        "id": "pri-react-hard",
        "title": "ReAct — Production hardening checklist",
        "description": "✅ Cycle detection (tool_name, args fingerprint) · ✅ Consecutive-error cap (3 → break) · ✅ Max-steps with graceful fallback · ✅ Tool-not-found with available list · ✅ Full history passed every call · ✅ Fallback to CoT on terminal failure.",
        "wiki_file": "05-react.md",
        "wiki_anchor": "#hardening-checklist--why-each-item-exists",
        "keyPoints": [
          { "text": "Cycle detection: hash (tool_name, sorted_args) into a `seen` set; break on repeat. Without it: infinite loop on same tool call.", "core": true },
          { "text": "Consecutive-error cap (3 → break): tool down → model retries → infinite errors without it.", "core": true },
          { "text": "Tool-not-found returns the available list — model hallucinates tool names; the list helps it self-correct.", "core": false },
          { "text": "Parse errors are EXPECTED, not exceptional — feed parse error back as Observation, let model self-correct.", "core": false },
          { "text": "Every item in this checklist exists because a real production system ate it." }
        ],
        "references": [
          { "title": "Lilian Weng — LLM Powered Agents", "url": "https://lilianweng.github.io/posts/2023-06-23-agent/", "note": "Best long-form overview of agent loop patterns." }
        ]
      },
      {
        "id": "pri-react-nope",
        "title": "ReAct — When NOT to use",
        "description": "Read-only computation (PoT — cheaper). Latency <500ms (5-tool ReAct ≈ 10+ seconds). Reasoning model with native tool use (handles internally). Misconception 3: ReAct is a LOOP — stopping machinery is not optional.",
        "wiki_file": "05-react.md",
        "wiki_anchor": "#when-not-to-use-react",
        "keyPoints": [
          { "text": "Pure read-only computation (percentiles, sums, joins) → use Program-of-Thought; LLM is a bad calculator.", "core": true },
          { "text": "Latency budget < 500 ms — a 5-turn ReAct loop is 5-15s easily.", "core": false },
          { "text": "Reasoning model with native tool use: OpenAI o3/o4-mini cookbook says 'they do not have to be explicitly prompted to plan and reason between tool calls.' Wrapping in ReAct = paying twice.", "core": true },
          { "text": "Anthropic `think` tool: +54% pass^1 on Tau-Bench airline — pair instead of explicit ReAct scaffolding on Claude 4." }
        ],
        "references": [
          { "title": "OpenAI o3/o4-mini cookbook", "url": "https://cookbook.openai.com/examples/o-series/o3o4-mini_prompting_guide", "note": "Reasoning + tool use — drop the Thought: scaffolding." },
          { "title": "Anthropic think tool", "url": "https://www.anthropic.com/engineering/claude-think-tool", "note": "+54% pass^1 Tau-Bench airline." }
        ]
      }
    ]
  },
  {
    "id": "secondary",
    "name": "Secondary Techniques",
    "icon": "🔧",
    "color": "#0891b2",
    "tagline": "Solid coverage — capsule per technique. Used in production but not the day-1 picks.",
    "wiki_file": "06-secondary-techniques.md",
    "sections": [
      {
        "id": "sec-pns",
        "title": "Plan-and-Solve (FREE upgrade)",
        "description": "Replace 'Let's think step by step' with 'First understand the problem and plan, then execute step by step, paying attention to variable values'. +9.1 pp avg over Zero-shot CoT. Wang et al. 2023, arXiv:2305.04091. Always ship this first.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#a1-plan-and-solve--the-free-upgrade",
        "keyPoints": [
          { "text": "Drop-in trigger: 'Let's first understand the problem and devise a plan to solve the problem. Then carry out the plan and solve the problem step by step.'", "core": true },
          { "text": "PS+ adds: '...pay attention to calculation and intermediate variables.' — reduces calculation errors.", "core": false },
          { "text": "+9.1 pp average over Zero-shot CoT on GSM8K (Wang et al., ACL 2023).", "core": true },
          { "text": "Highest ROI of any technique — one prompt change, zero added tokens of consequence, measurable gain.", "core": false },
          { "text": "Forces planning phase first → reduces 'missing-step errors' (12% of Zero-shot CoT failures per Wang et al.)." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "Plan-and-Solve trigger phrase",
          "code": "PLAN_AND_SOLVE = (\n    \"Let's first understand the problem and devise a plan to solve it.\\n\"\n    \"Then, let's carry out the plan and solve the problem step by step.\\n\"\n    \"Pay attention to calculation, intermediate variables, and edge cases.\"\n)"
        },
        "references": [
          { "title": "Wang et al. 2023 — Plan-and-Solve Prompting (ACL 2023)", "url": "https://arxiv.org/abs/2305.04091", "note": "Original paper; +9.1pp on GSM8K over Zero-shot CoT." }
        ]
      },
      {
        "id": "sec-l2m",
        "title": "Least-to-Most",
        "description": "LLM auto-decomposes problem into ordered sub-problems → solves sequentially with prior answers in context. SCAN: 16.2% → 99.7%. Zhou et al. 2022, arXiv:2205.10625.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#a2-least-to-most-prompting--sequential-decomposition",
        "keyPoints": [
          { "text": "Two stages: (1) decompose problem into ordered sub-problems; (2) solve each in order, appending each answer to context before the next.", "core": true },
          { "text": "SCAN compositional generalisation: code-davinci-002 reached 99.7% with 14 exemplars vs CoT's 16.2%.", "core": true },
          { "text": "Key contrast with Plan-and-Solve: PnS plans + executes in one call; L2M makes separate call per sub-problem.", "core": false },
          { "text": "Use auto (L2M) for exploration; hand-authored chains for production. Bad decomposition cascades." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "L2M sequential decomposition",
          "code": "def least_to_most_sql(question, schema):\n    steps = json.loads(llm(decomp_prompt))[\"steps\"]\n    context = [f\"Schema: {schema}\", f\"Question: {question}\"]\n    for i, step in enumerate(steps):\n        prompt = \"\\n\".join(context) + f\"\\n\\nSub-question {i+1}: {step}\\nAnswer:\"\n        answer = llm(prompt)\n        context.append(f\"Sub-question {i+1}: {step}\\nAnswer: {answer}\")\n    return context[-1]"
        },
        "references": [
          { "title": "Zhou et al. 2022 — Least-to-Most Prompting (ICLR 2023)", "url": "https://arxiv.org/abs/2205.10625", "note": "SCAN 16.2% → 99.7% — one of the largest deltas in prompt-engineering literature." }
        ]
      },
      {
        "id": "sec-stepback",
        "title": "Step-Back",
        "description": "Derive higher-level principle FIRST, then apply to specific question. TimeQA +27 pp, MMLU Chemistry +11 pp. Engineering example: K8s pod-crash debug categories. Zheng et al. 2023, arXiv:2310.06117.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#a3-step-back-prompting--abstract-then-solve",
        "keyPoints": [
          { "text": "Step 1: derive the higher-level concept / principle / category. Step 2: apply both abstract principle and specific question.", "core": true },
          { "text": "PaLM-2L results: TimeQA +27 pp, MMLU Chemistry +11 pp, MMLU Physics +7 pp, MuSiQue +7 pp.", "core": true },
          { "text": "Anchors reasoning in stable abstractions (categories of failure, classes of equations) rather than brittle specifics.", "core": false },
          { "text": "Failure mode: wrong-category cascade — model picks 'ImagePullBackOff' when actual cause is OOMKill → confidently wrong remediation." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "Step-Back — K8s pod-crash debug",
          "code": "STEP_BACK_PROMPT = (\n    \"Step 1 (step back): What are the general categories of \"\n    \"Kubernetes pod failures? List 5-7 with one-line descriptions.\\n\\n\"\n    \"Step 2 (apply): Given the categories from Step 1 and the diagnostic \"\n    \"output below, which category fits, and what is the standard remediation?\\n\\n\"\n    f\"Diagnostic output:\\n{kubectl_describe}\"\n)"
        },
        "references": [
          { "title": "Zheng et al. 2023 — Take a Step Back", "url": "https://arxiv.org/abs/2310.06117", "note": "PaLM-2L TimeQA +27pp; chemistry +11pp." }
        ]
      },
      {
        "id": "sec-pot",
        "title": "Program-of-Thought (PoT)",
        "description": "LLM writes Python/SQL → real interpreter computes. GSM8K +8.5 pp, FinQA +24.1 pp. ~1.2× tokens. Anything numeric/tabular/aggregational. Chen et al. 2022, arXiv:2211.12588. Sandbox required.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#a4-program-of-thought-pot--offload-computation",
        "keyPoints": [
          { "text": "LLM writes Python/SQL; a real interpreter computes the answer — reasoning is in code STRUCTURE, computation is offloaded.", "core": true },
          { "text": "GSM8K: PoT 71.6% vs CoT 63.1% → +8.5pp. FinQA: PoT 64.5% vs CoT 40.4% → +24.1pp.", "core": true },
          { "text": "Cost: only ~1.2× tokens; the killer ratio for any tabular/numeric workload.", "core": false },
          { "text": "Sandbox is mandatory: subprocess with seccomp, no network, no FS, hard timeout, or Docker `--network=none --read-only --cap-drop=ALL`." },
          { "text": "Failure mode: code runs but computes wrong thing (uses `.mean()` instead of `.quantile(0.99)`). Mitigation: SC vote across N=5 PoT runs." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "PoT exec — sandboxed",
          "code": "def pot_exec(question, df_pickle_path, columns):\n    code = llm(POT_PROMPT.format(question=question, columns=columns))\n    code = extract_code_block(code)\n    wrapper = f\"import pandas as pd\\ndf = pd.read_pickle({df_pickle_path!r})\\n{code}\"\n    # Sandbox: no network, 10s timeout, restricted FS in production\n    r = subprocess.run([\"python\", \"-c\", wrapper], capture_output=True,\n                       text=True, timeout=10)\n    return r.stdout.strip()"
        },
        "references": [
          { "title": "Chen et al. 2023 — Program of Thoughts (TMLR)", "url": "https://arxiv.org/abs/2211.12588", "note": "GSM8K +8.5pp; FinQA +24.1pp." }
        ]
      },
      {
        "id": "sec-srefine",
        "title": "Self-Refine (cap at 2 rounds)",
        "description": "Same LLM as gen/critic/refiner. ~+20% avg across 7 tasks. Figure 4: marginal returns by round 3, regression by round 4-5. REQUIRES external rubric (Huang 2310.01798). Madaan et al. 2023, arXiv:2303.17651.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#a5-self-refine--generate-critique-refine",
        "keyPoints": [
          { "text": "Same LLM plays three roles: Generator → Critic → Refiner. Loop until stopping condition.", "core": true },
          { "text": "+~20% absolute averaged across 7 tasks (code, math, dialogue, sentiment) on GPT-3.5/ChatGPT/GPT-4.", "core": true },
          { "text": "Round-by-round (Figure 4): most gain in rounds 1-2; marginal by round 3; regression in 4-5. PRODUCTION CAP: 2 rounds.", "core": true },
          { "text": "REQUIRES external rubric / unit-tests / linter — without it, Huang 2310.01798 shows self-correction DEGRADES GSM8K.", "core": false },
          { "text": "Exit early on convergence: critic says 'no changes' AND external lint == 0 → break before round 3 regression." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "Self-Refine — exit on convergence",
          "code": "draft = generate(task)\nreport, n_err = lint(draft)            # external rubric signal\nfor r in range(max_rounds):           # cap at 2\n    critique = critic(task, draft, lint_report=report)\n    if critique[\"done\"] and n_err == 0:\n        break                          # both signals agree\n    new_draft = refine(task, draft, critique)\n    new_report, new_err = lint(new_draft)\n    if new_err >= n_err:               # plateau or regression\n        break\n    draft, report, n_err = new_draft, new_report, new_err"
        },
        "references": [
          { "title": "Madaan et al. 2023 — Self-Refine (NeurIPS)", "url": "https://arxiv.org/abs/2303.17651", "note": "Original; +20% avg across 7 tasks." },
          { "title": "Huang et al. 2023 — LLMs Cannot Self-Correct Reasoning Yet", "url": "https://arxiv.org/abs/2310.01798", "note": "Why external rubric is non-negotiable." }
        ]
      },
      {
        "id": "sec-contr",
        "title": "Contrastive CoT",
        "description": "Include positive AND negative exemplars in few-shot, labelled. Up to +15 pp w/ Self-Consistency. Use when a specific recurrent error exists (SQL LEFT JOIN confusion). Chia et al. 2023, arXiv:2311.09277.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#a6-contrastive-chain-of-thought--positive--negative-exemplars",
        "keyPoints": [
          { "text": "Include BOTH correct and incorrect reasoning chains in few-shot exemplars, each clearly labelled.", "core": true },
          { "text": "Up to +15pp with self-consistency on arithmetic and commonsense benchmarks.", "core": true },
          { "text": "Most effective when a specific, recurrent failure mode exists — negative exemplar demonstrates exactly that mistake.", "core": false },
          { "text": "Failure mode: cargo-cult negatives — a 'plausibly wrong' invented pattern teaches the model a NEW mistake. Derive negatives from real eval failures only." },
          { "text": "Canonical example: SQL LEFT JOIN with WHERE-on-right-side-column — silently converts to INNER JOIN." }
        ],
        "references": [
          { "title": "Chia et al. 2023 — Contrastive Chain-of-Thought", "url": "https://arxiv.org/abs/2311.09277", "note": "+15pp with self-consistency on arithmetic and commonsense." }
        ]
      },
      {
        "id": "sec-sot",
        "title": "Skeleton-of-Thought",
        "description": "Skeleton + parallel section expansion. 2.39× wall-clock latency reduction; SAME tokens. List-shaped outputs (architecture review, multi-finding code review). Ning et al. 2024, arXiv:2307.15337.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#a7-skeleton-of-thought--parallel-expansion",
        "keyPoints": [
          { "text": "Two stages: skeleton (numbered list, one call) → N parallel calls each expanding one point; concat the results.", "core": true },
          { "text": "Latency math: sequential_time = Σ latency(section_i); SoT_time = latency(skeleton) + MAX(latency(section_i)). Replace sum with max.", "core": true },
          { "text": "Up to 2.39× end-to-end wall-clock speedup across 12 LLMs; SoT-R router variant: 2.01× avg with no quality loss.", "core": false },
          { "text": "Output token count = same as sequential generation; only wall-clock improves.", "core": false },
          { "text": "Don't use when sections reference each other ('as discussed above…') or for short responses (<300 tokens)." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "SoT — async parallel fan-out",
          "code": "async def sot(question):\n    skeleton = await async_llm(SKELETON_PROMPT.format(question=question))\n    points = parse_numbered_list(skeleton)\n    tasks = [async_llm(EXPAND_PROMPT.format(i=i, point=p, skeleton=skeleton,\n                                            question=question))\n             for i, p in points]\n    expanded = await asyncio.gather(*tasks)        # max() not sum()\n    return skeleton + \"\\n\\n\" + \"\\n\\n\".join(expanded)"
        },
        "references": [
          { "title": "Ning et al. 2024 — Skeleton-of-Thought (ICLR)", "url": "https://arxiv.org/abs/2307.15337", "note": "2.39× wall-clock speedup; 2.01× with SoT-R router." }
        ]
      },
      {
        "id": "sec-autocot",
        "title": "Auto-CoT",
        "description": "k-means cluster unlabelled questions → Zero-shot CoT rationale per cluster representative → concat as few-shot. Matches Manual-CoT, zero human labelling. Zhang et al. 2022, arXiv:2210.03493.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#a8-auto-cot--clustering-based-exemplar-selection",
        "keyPoints": [
          { "text": "Three steps: embed unlabelled questions → k-means cluster → pick centroid representative → Zero-shot CoT rationale per rep.", "core": true },
          { "text": "Matches or exceeds Manual-CoT across MultiArith, GSM8K, AQuA, SVAMP, CSQA, StrategyQA — with zero human labelling.", "core": true },
          { "text": "Tagline from the paper: 'let's think not just step by step, but also one by one.'", "core": false },
          { "text": "Clustering ensures diversity → prompt covers more failure modes than hand-curated set." },
          { "text": "Failure mode: centroid representatives are 'typical but uninteresting' — no edge cases. Combine with Active Prompting for hard-case coverage." }
        ],
        "references": [
          { "title": "Zhang et al. 2022 — Automatic Chain of Thought (ICLR 2023)", "url": "https://arxiv.org/abs/2210.03493", "note": "Within 1pp of Manual-CoT with zero labelling effort." }
        ]
      }
    ]
  },
  {
    "id": "emerging",
    "name": "Emerging / Overview",
    "icon": "🌱",
    "color": "#1a9e6e",
    "tagline": "One-line each on a single overview slide. Deep treatment in wiki.",
    "wiki_file": "06-secondary-techniques.md",
    "sections": [
      {
        "id": "em-got",
        "title": "Graph of Thoughts",
        "description": "ToT generalised to DAG. Adds aggregate + refine ops. For sort/merge/fusion tasks. 128-num sort: +62% quality, -31% cost vs ToT. Besta et al. 2024, arXiv:2308.09687.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#b1-graph-of-thoughts-got",
        "keyPoints": [
          { "text": "ToT generalised from tree to arbitrary DAG; adds aggregate (merge branches) and refine (loop a node back on itself).", "core": true },
          { "text": "128-number sort vs ToT: +62% quality while cutting cost >31%.", "core": true },
          { "text": "Engineering use: multi-subsystem incident analysis where DB / network / app branches need an aggregate step.", "core": false },
          { "text": "Caveat: spcl/graph-of-thoughts reference impl is research-grade, not production-hardened. Only when task has a genuine merge step." }
        ],
        "references": [
          { "title": "Besta et al. 2024 — Graph of Thoughts (AAAI)", "url": "https://arxiv.org/abs/2308.09687", "note": "DAG with aggregate + refine; 128-num sort headline." }
        ]
      },
      {
        "id": "em-thot",
        "title": "Thread-of-Thought",
        "description": "Segment long chaotic context (logs, transcripts) into coherent threads before reasoning. Beats CoT on PopQA, MTCR. Zhou et al. 2023, arXiv:2311.08734.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#b2-thread-of-thought-thot",
        "keyPoints": [
          { "text": "Trigger: 'Walk me through this context in manageable parts step by step, summarising and analysing as we go.'", "core": true },
          { "text": "Model segments chaotic context into coherent threads, then a second call answers using thread-structured analysis.", "core": false },
          { "text": "Beats vanilla context, retrieval-only, and standard CoT on PopQA, EntityQ, and the authors' MTCR multi-turn dataset.", "core": true },
          { "text": "Engineering use: post-mortem from 500-line concatenated log + alerts + deploy notes — segment first, then synthesise." }
        ],
        "references": [
          { "title": "Zhou et al. 2023 — Thread of Thought", "url": "https://arxiv.org/abs/2311.08734", "note": "PopQA, EntityQ, MTCR wins." }
        ]
      },
      {
        "id": "em-analog",
        "title": "Analogical Prompting",
        "description": "'Recall 3 analogous problems + solutions, then solve.' Beats CoT on GSM8K, MATH, Codeforces. Zero labelling. Yasunaga et al. 2024, arXiv:2310.01714.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#b3-analogical-prompting",
        "keyPoints": [
          { "text": "Prompt: 'Recall three relevant problems and their solutions, then solve the following problem.'", "core": true },
          { "text": "LLM self-generates few-shot exemplars by analogy — no human labelling required.", "core": false },
          { "text": "Consistently outperforms Zero-shot CoT, Manual few-shot CoT, and zero-shot on GSM8K, MATH, Codeforces, BIG-Bench.", "core": true },
          { "text": "Caveat: if model's recall of analogous problems is wrong, the self-generated exemplars MISLEAD rather than help." }
        ],
        "references": [
          { "title": "Yasunaga et al. 2024 — Analogical Reasoners (ICLR)", "url": "https://arxiv.org/abs/2310.01714", "note": "Beats Manual + Zero-shot CoT across GSM8K, MATH, Codeforces." }
        ]
      },
      {
        "id": "em-s2a",
        "title": "System 2 Attention",
        "description": "Rewrite context to drop irrelevant/biased/distracting content, then answer. TriviaQA distractors: 51.7% → 61.3%. Also indirect-injection defence. Weston & Sukhbaatar 2023, arXiv:2311.11829.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#b4-system-2-attention-s2a",
        "keyPoints": [
          { "text": "Two-step: rewrite context to remove irrelevant/biased material → answer using cleaned context.", "core": true },
          { "text": "TriviaQA with in-topic distractors: 51.7% → 61.3% (+9.6pp).", "core": true },
          { "text": "Strong defence against indirect prompt injection — drops the injected text before the model commits to it.", "core": false },
          { "text": "Caveat: filtering step can drop legitimately relevant context that looks like noise (e.g. one critical log line buried in 50). Reserve for >2K-token contexts." }
        ],
        "references": [
          { "title": "Weston & Sukhbaatar 2023 — System 2 Attention", "url": "https://arxiv.org/abs/2311.11829", "note": "TriviaQA 51.7% → 61.3%." }
        ]
      },
      {
        "id": "em-emotion",
        "title": "EmotionPrompt",
        "description": "Append 'this is important to my career' etc. BIG-Bench Hard +115% relative (2023 era). NEUTRALISED on heavily RLHF-tuned frontier models. Quick A/B only. Li et al. 2023, arXiv:2307.11760.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#b5-emotionprompt--social-prompting",
        "keyPoints": [
          { "text": "Append emotional/social stimuli ('This is critical to my career', 'You'd better be sure', 'Believe in yourself').", "core": false },
          { "text": "2023-era models: Instruction Induction +8%, BIG-Bench Hard +115% relative.", "core": true },
          { "text": "ERA-DEPENDENT: largely NEUTRALISED on Claude 3+, GPT-4 Turbo — they're trained to be consistently helpful regardless of emotional framing.", "core": true },
          { "text": "Treat as a low-cost A/B test only. Re-run your eval at every major model bump — 'best practices' have a half-life." }
        ],
        "references": [
          { "title": "Li et al. 2023 — EmotionPrompt", "url": "https://arxiv.org/abs/2307.11760", "note": "BIG-Bench Hard +115% relative on 2023-era models." }
        ]
      },
      {
        "id": "em-refl",
        "title": "Reflexion",
        "description": "Self-Refine + episodic memory across trials. REQUIRES external verifier (tests). HumanEval pass@1: 80% → 91%. AlfWorld +22 pp. Shinn et al. 2023, arXiv:2303.11366.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#b6-reflexion",
        "keyPoints": [
          { "text": "Self-Refine + a lessons-learned wiki across trials — verbal RL with episodic memory.", "core": true },
          { "text": "REQUIRES external binary success/failure verifier (unit tests, env reward, ground truth). Without it, degrades to noisy self-critique.", "core": true },
          { "text": "HumanEval pass@1: 91% vs GPT-4 baseline 80% (+11pp). AlfWorld +22pp. HotpotQA +20pp.", "core": false },
          { "text": "Engineering use: test-driven code generation where test suite is the verifier." }
        ],
        "references": [
          { "title": "Shinn et al. 2023 — Reflexion (NeurIPS)", "url": "https://arxiv.org/abs/2303.11366", "note": "HumanEval 80%→91%; AlfWorld +22pp." }
        ]
      },
      {
        "id": "em-const",
        "title": "Constitutional Critique",
        "description": "Critique against fixed written 'constitution' (policy doc). Reproducible, auditable. Use for style guide / security / compliance enforcement. Bai et al. 2022, arXiv:2212.08073.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#b7-constitutional-self-critique",
        "keyPoints": [
          { "text": "Critique a draft against an explicit, written list of principles (the 'constitution'); then revise to comply.", "core": true },
          { "text": "Distinct from Self-Refine: rubric is FIXED, external, and human-authored — a document, not free-form self-generated critique.", "core": true },
          { "text": "Engineering use: API doc generation with rules like '1. every endpoint must document rate limits, 2. error codes must include remediation…'", "core": false },
          { "text": "Caveat: degrades to ungrounded self-critique when rules are fuzzy or context-dependent." }
        ],
        "references": [
          { "title": "Bai et al. 2022 — Constitutional AI", "url": "https://arxiv.org/abs/2212.08073", "note": "Original CAI paper; the inference-time critique-revise is the production-useful piece." }
        ]
      },
      {
        "id": "em-maieutic",
        "title": "Maieutic Prompting",
        "description": "Abductive belief tree + SAT solver. +20% over SOTA on commonsense (ComVE, CREAK, CSQA2). Engineering overhead high; mostly academic. Jung et al. 2022, arXiv:2205.11822.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#b8-maieutic-prompting",
        "keyPoints": [
          { "text": "Builds abductive explanation tree ('X is true because…' / 'X is false because…') and resolves contradictions with a SAT solver.", "core": true },
          { "text": "Up to +20% over SOTA prompting on three commonsense benchmarks (ComVE, CREAK, CSQA2).", "core": true },
          { "text": "Engineering use: access-control rule verification; model generates explanation tree, SAT solver checks consistency, surfaces policy bugs.", "core": false },
          { "text": "Caveat: high engineering overhead (SAT integration, tree validation) for moderate gains; hard to extend beyond binary truth values." }
        ],
        "references": [
          { "title": "Jung et al. 2022 — Maieutic Prompting (EMNLP)", "url": "https://arxiv.org/abs/2205.11822", "note": "+20% on commonsense benchmarks." }
        ]
      },
      {
        "id": "em-cmplx",
        "title": "Complexity-based",
        "description": "Longer-chain exemplars beat short ones. SC: vote only among top-K complex chains. +5.3 pp avg, +18 pp max. Fu et al. 2022, arXiv:2210.00720.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#b9-complexity-based-prompting",
        "keyPoints": [
          { "text": "Two findings: (1) exemplars with longer reasoning chains (~9 steps) outperform short-chain exemplars (2-3 steps).", "core": true },
          { "text": "(2) For self-consistency voting, select only the most complex chains (top-K by step count) to vote with.", "core": true },
          { "text": "+5.3pp average across GSM8K/MathQA/MultiArith/BBH vs Wei et al. CoT baseline; up to +18pp on specific tasks.", "core": false },
          { "text": "Caveat: 'length washing' — some models pad reasoning without improving it. Verify on eval that longer = more correct, not just more verbose." }
        ],
        "references": [
          { "title": "Fu et al. 2023 — Complexity-Based Prompting (ICLR)", "url": "https://arxiv.org/abs/2210.00720", "note": "+5.3pp avg, +18pp max." }
        ]
      },
      {
        "id": "em-faith",
        "title": "Faithful CoT",
        "description": "Translate NL → program → deterministic solver. Reasoning trace mathematically faithful. 9/10 benchmarks beat CoT. PoT is the Python special case. Lyu et al. 2023, arXiv:2301.13379.",
        "wiki_file": "06-secondary-techniques.md",
        "wiki_anchor": "#b10-faithful-cot",
        "keyPoints": [
          { "text": "Two stages: translate NL problem to symbolic program (Python, Datalog, PDDL, DSL) → run deterministic solver/interpreter.", "core": true },
          { "text": "Reasoning trace is mathematically guaranteed FAITHFUL — chain and answer cannot diverge.", "core": true },
          { "text": "Outperforms standard CoT on 9 of 10 benchmarks. PoT is the Python special case of this general pattern.", "core": false },
          { "text": "Engineering use: contract clause analysis — translate to first-order logic predicates + Datalog query, evaluate deterministically." },
          { "text": "Caveat: NL→formal-program translation is itself error-prone; wrong translation is computed faithfully but answers wrong question." }
        ],
        "references": [
          { "title": "Lyu et al. 2023 — Faithful Chain-of-Thought (IJCNLP-AACL Best Paper)", "url": "https://arxiv.org/abs/2301.13379", "note": "Faithful by construction; 9/10 benchmarks beat CoT." }
        ]
      }
    ]
  },
  {
    "id": "ladder",
    "name": "Complexity Ladder + Composition",
    "icon": "🪜",
    "color": "#d97706",
    "tagline": "The session's core practical takeaway — how to pick a technique and how to combine them.",
    "wiki_file": "07-decision-framework.md",
    "sections": [
      {
        "id": "lad-r0",
        "title": "Rung 0-3: Session 5 territory",
        "description": "Zero-shot → Zero-shot CoT → Few-shot CoT → Self-Consistency (N=5, majority vote). Session 6 picks up at Rung 4.",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#1-the-advanced-complexity-ladder--11-rungs",
        "keyPoints": [
          { "text": "Rung 0: Zero-shot (1×). Rung 1: Zero-shot CoT 'think step by step' (1.5×). Rung 2: Few-shot CoT 3-8 exemplars (1.5-2×).", "core": true },
          { "text": "Rung 3: Self-Consistency at N=5, majority vote (5×).", "core": true },
          { "text": "If SC has plateaued AND failures share a structural defect (wrong arithmetic, missing data, style drift), do NOT raise N — move sideways into Rung 4+.", "core": false },
          { "text": "SC at N=20 cannot fix a problem that needs PoT." }
        ]
      },
      {
        "id": "lad-r4",
        "title": "Rung 4: Plan-and-Solve",
        "description": "Free zero-shot upgrade. Always try first.",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#1-the-advanced-complexity-ladder--11-rungs",
        "keyPoints": [
          { "text": "Cheapest non-trivial upgrade in the entire ladder — one extra instruction buys +9.1pp on GSM8K.", "core": true },
          { "text": "Plan generated in the same call as the solution → only ~10% token overhead.", "core": true },
          { "text": "Always try this BEFORE climbing further.", "core": false },
          { "text": "Failure mode: 'generic plan' — if the plan reads like a template, force specificity with a one-shot example of a concrete plan." }
        ]
      },
      {
        "id": "lad-r5",
        "title": "Rung 5: Decompose (L2M / Chain)",
        "description": "Auto (Least-to-Most) or hand-authored (Prompt Chaining).",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#1-the-advanced-complexity-ladder--11-rungs",
        "keyPoints": [
          { "text": "Split single prompt into K explicit subtasks. Cost: 2-4× tokens, 1+K× API calls.", "core": true },
          { "text": "Use AUTO (Least-to-Most) for exploration; HAND-AUTHORED chains for production.", "core": true },
          { "text": "Anti-pattern: 8-step chain where steps 2-7 are read-only transformations — collapse those into a single call.", "core": false }
        ]
      },
      {
        "id": "lad-r6",
        "title": "Rung 6: Ground (PoT / ReAct)",
        "description": "Numeric → PoT. Needs current data / tools → ReAct.",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#1-the-advanced-complexity-ladder--11-rungs",
        "keyPoints": [
          { "text": "Most production engineers should live HERE. PoT (1.2×) routes numeric work to interpreter; ReAct (4-15×) routes data-fetch to tools.", "core": true },
          { "text": "Both replace probabilistic guessing with deterministic execution.", "core": true },
          { "text": "Orthogonal — many production pipelines use both, with PoT inside ReAct's `code_exec` tool.", "core": false }
        ]
      },
      {
        "id": "lad-r7",
        "title": "Rung 7: Self-correct",
        "description": "Self-Refine (1-2 rounds) or Constitutional critique. Needs external rubric.",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#1-the-advanced-complexity-ladder--11-rungs",
        "keyPoints": [
          { "text": "Works ONLY with a rubric. Self-Refine uses free-form critic; Constitutional uses written constitution.", "core": true },
          { "text": "Cap at 2 rounds — round 3+ regresses on 30-40% of tasks (Madaan 2023).", "core": true },
          { "text": "Signature failure: critic says 'looks good' on round 1, refines anyway, makes it worse. ALWAYS honor 'no changes needed' and stop.", "core": false }
        ]
      },
      {
        "id": "lad-r8",
        "title": "Rung 8: Search",
        "description": "ToT (beam=2-3) or Reflexion (needs verifier).",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#1-the-advanced-complexity-ladder--11-rungs",
        "keyPoints": [
          { "text": "Search is 30-50× a single CoT call. Pay only when (a) value function cheaper than generator, AND (b) task admits multiple valid paths.", "core": true },
          { "text": "If either prerequisite is false → stop at Rung 7.", "core": true },
          { "text": "Reflexion needs an external verifier (unit tests, regex, typed schema). Without one, it amplifies hallucinations.", "core": false }
        ]
      },
      {
        "id": "lad-r9",
        "title": "Rung 9: Compose DAG",
        "description": "Explicit pipeline of multiple techniques (e.g., Step-Back → GenKnow → ReAct → ToT → PoT → Self-Refine).",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#1-the-advanced-complexity-ladder--11-rungs",
        "keyPoints": [
          { "text": "DAG of techniques with ONE PURPOSE per node — the rule is 'one technique per failure mode.'", "core": true },
          { "text": "If you can't name the failure mode a stage addresses → delete the stage.", "core": true },
          { "text": "Most production DAGs have 3-5 stages; anything beyond 7 is usually over-engineered.", "core": false }
        ]
      },
      {
        "id": "lad-r10",
        "title": "Rung 10: Switch to reasoning model",
        "description": "o1/o3, Claude Extended Thinking, Gemini Thinking. CoT/ToT/PnS largely redundant at this rung.",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#1-the-advanced-complexity-ladder--11-rungs",
        "keyPoints": [
          { "text": "Reasoning model runs its own internal CoT + search. Wrapping it in ToT pays twice.", "core": true },
          { "text": "Migrate when your gpt-4o + ToT bill exceeds o1-mini's thinking-token bill on the same eval set.", "core": true },
          { "text": "Migration deletes scaffolding: no 'Let's think step by step', no SC vote, no ToT beam.", "core": false },
          { "text": "Keep: ReAct (model can't reach your APIs), PoT (still can't run code natively in most providers), Constitutional critique (style is your concern)." }
        ]
      },
      {
        "id": "lad-pair-good",
        "title": "Pair well — composition winners",
        "description": "PnS+PoT · ReAct+Self-Refine · GenKnow+Step-Back · SC+Complexity · ToT+PoT (per-leaf evaluator) · SoT+Constitutional.",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#3-composition-rules--pair-well",
        "keyPoints": [
          { "text": "PnS + PoT: plan in prose, emit Python for the execute step. Plan keeps model honest; PoT keeps arithmetic exact.", "core": true },
          { "text": "ReAct + Self-Refine: gather evidence with ReAct, then refine the synthesis. Order matters — never refine before gathering.", "core": true },
          { "text": "ToT + PoT: PoT is the per-leaf evaluator — confirms each hypothesis numerically. Eliminates 'bad value function' failure mode.", "core": false },
          { "text": "SC + Complexity: vote only among top-K complex chains; +15pp over plain SC (Fu 2023)." },
          { "text": "SoT + Constitutional: parallel sections + per-section style-guide critique. Architecture-review automation." }
        ]
      },
      {
        "id": "lad-pair-bad",
        "title": "Pair badly — composition anti-patterns",
        "description": "ToT+Self-Refine same trial · Reflexion+Self-Refine same loop · Emotion+reasoning model · ToT+reasoning model · S2A+clean short context.",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#4-composition-rules--pair-badly",
        "keyPoints": [
          { "text": "ToT + Self-Refine in same trial: refining branches you may prune. Doubles cost with no measurable gain.", "core": true },
          { "text": "Reflexion + Self-Refine in same inner loop: both are self-critique. Without external verifier, second loop reinforces first loop's drift.", "core": true },
          { "text": "ToT + reasoning model: model already runs internal search — pay for same search twice. Drop ToT on o1/o3/Claude Thinking.", "core": true },
          { "text": "EmotionPrompt + reasoning model: RLHF on o1/o3/Claude Thinking neutralised social-pressure tokens. The +115% effect was era-dependent." },
          { "text": "S2A + short focused contexts: rewrite costs more than the noise it removes. Reserve for >2K-token contexts with mixed signal." }
        ]
      },
      {
        "id": "lad-cost",
        "title": "Cost lookup (× single CoT call)",
        "description": "PnS 1.1× · Step-Back/GenKnow/S2A 2× · Contrastive 2× · Self-Refine (2r) 3-4× · L2M/chain 2-4× · ReAct 4-15× · ToT (b=3,d=3,k=5) 30-50× · GoT 10-30× · Reflexion (5 trials) 5-20× · PoT ~1.2× · SoT ~1× tokens (N+1× calls, parallel) · Analogical 2-3×.",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#5-cost-lookup-table",
        "keyPoints": [
          { "text": "Reading the table at 10K req/day @ gpt-4o $0.0025in/$0.010out: single CoT ≈ $0.005/call → $50/day baseline.", "core": true },
          { "text": "ToT at 40× = $2,000/day. That is the line where Rung 10 (reasoning model) becomes the cheaper option.", "core": true },
          { "text": "SoT: same total tokens as sequential, N+1 calls in parallel — saves wall-clock latency, not money.", "core": false },
          { "text": "PoT cost (~1.2×) is the killer ratio for any numeric/tabular workload." }
        ]
      },
      {
        "id": "lad-shortcut",
        "title": "Decision shortcuts",
        "description": "Jump to Rung 6 if task is numeric (PoT) or needs current data (ReAct). Jump to Rung 10 if your team has API access and latency budget for thinking tokens.",
        "wiki_file": "07-decision-framework.md",
        "wiki_anchor": "#2-decision-shortcuts",
        "keyPoints": [
          { "text": "Numeric task → jump to Rung 6 (PoT). Skip 1→2→3→4. The +8.5pp GSM8K and +24.1pp FinQA deltas justify it.", "core": true },
          { "text": "Budget allows thinking tokens → jump to Rung 10. Port your Rung 0 prompt and re-eval BEFORE building anything elaborate.", "core": true },
          { "text": "The flowchart is conservative: cheap-upgrade questions first; only reach ToT when both branching task AND verifier exist.", "core": false }
        ]
      }
    ]
  },
  {
    "id": "reasoning",
    "name": "Reasoning Models (2024-25)",
    "icon": "🧠",
    "color": "#a855f7",
    "tagline": "The biggest playbook shift since Session 5 — what changes when the model does the search for you.",
    "wiki_file": "08-reasoning-models.md",
    "sections": [
      {
        "id": "rm-openai",
        "title": "OpenAI o1 / o3 / o4-mini",
        "description": "Official guidance VERBATIM: 'Avoid chain-of-thought prompts — prompting them to think step by step is unnecessary.' 'Asking a reasoning model to reason more may actually hurt performance.' 'Try zero-shot first, then few-shot if needed.' Use 'developer' role (o1-2024-12-17+).",
        "wiki_file": "08-reasoning-models.md",
        "wiki_anchor": "#3-openai-o1--o3--o4-mini",
        "keyPoints": [
          { "text": "OpenAI verbatim: 'Avoid chain-of-thought prompts — prompting them to think step by step is unnecessary.'", "core": true },
          { "text": "OpenAI verbatim: 'Asking a reasoning model to reason more may actually hurt the performance.'", "core": true },
          { "text": "Use `developer` role instead of `system` for o1-2024-12-17 and later.", "core": false },
          { "text": "`reasoning_effort` parameter: 'low' | 'medium' | 'high' — that is the right knob, not prompt scaffolding." },
          { "text": "o3/o4-mini tool use: 'they do not have to be explicitly prompted to plan and reason between tool calls.'" }
        ],
        "references": [
          { "title": "OpenAI Reasoning Best Practices", "url": "https://platform.openai.com/docs/guides/reasoning-best-practices", "note": "Official guidance — verbatim quotes above." },
          { "title": "OpenAI cookbook — o3/o4-mini tool use", "url": "https://cookbook.openai.com/examples/o-series_tool_use", "note": "Drop the Thought: scaffolding for reasoning models with tools." }
        ]
      },
      {
        "id": "rm-claude",
        "title": "Claude Extended Thinking + think tool",
        "description": "High-level 'think deeply' intent, not prescriptive CoT steps. Claude 4.x: dial back aggressive-tool/thoroughness guidance. `think` tool: callable mid-trajectory for in-context deliberation. Tau-Bench airline: +54% pass^1 with think tool.",
        "wiki_file": "08-reasoning-models.md",
        "wiki_anchor": "#4-anthropic-claude-extended-thinking",
        "keyPoints": [
          { "text": "Contract: give high-level INTENT to think deeply, NOT prescriptive CoT recipe.", "core": true },
          { "text": "Claude 4.x: 'If your prompts previously encouraged the model to be more thorough or use tools more aggressively, dial back that guidance.'", "core": true },
          { "text": "`think` tool: callable mid-trajectory for in-context deliberation; private output. Registered like any other tool.", "core": false },
          { "text": "Tau-Bench airline domain: +54% pass^1 with `think` tool available vs not." }
        ],
        "references": [
          { "title": "Anthropic Extended Thinking tips", "url": "https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking-tips", "note": "Official Anthropic guidance for Claude 4.x." },
          { "title": "Anthropic — Claude think tool", "url": "https://www.anthropic.com/engineering/claude-think-tool", "note": "+54% pass^1 Tau-Bench airline." }
        ]
      },
      {
        "id": "rm-gemini",
        "title": "Gemini thinkingBudget / thinking_level",
        "description": "thinkingBudget=0 disables thinking; -1 = dynamic (model decides). Higher budget → more detailed reasoning. Gemini 3: migrating to thinking_level. Cannot combine with reasoning_effort.",
        "wiki_file": "08-reasoning-models.md",
        "wiki_anchor": "#5-google-gemini-thinking",
        "keyPoints": [
          { "text": "`thinkingBudget` in tokens: 0 disables thinking; -1 = dynamic (model picks budget); positive int = explicit budget.", "core": true },
          { "text": "Gemini 3: migrating to `thinking_level` ('low'/'medium'/'high'). `thinkingBudget` remains supported for backward compatibility.", "core": true },
          { "text": "`reasoning_effort` (OpenAI-style) and `thinking_level`/`thinkingBudget` CANNOT be used simultaneously — pick one.", "core": false }
        ],
        "references": [
          { "title": "Google Gemini Thinking docs", "url": "https://ai.google.dev/gemini-api/docs/thinking", "note": "ThinkingConfig and thinkingBudget parameter reference." }
        ]
      },
      {
        "id": "rm-redundant",
        "title": "Becomes redundant",
        "description": "Zero-shot CoT · Plan-and-Solve · ToT · Maieutic · Auto-CoT · Complexity-based · Self-Consistency for offline tasks. The model does these natively. Hand-engineering them on top = paying twice.",
        "wiki_file": "08-reasoning-models.md",
        "wiki_anchor": "#6-what-becomes-redundant",
        "keyPoints": [
          { "text": "Zero-shot CoT, Plan-and-Solve: model does these natively in hidden chain.", "core": true },
          { "text": "Tree-of-Thoughts: internal search replaces ToT for non-game-tree problems.", "core": true },
          { "text": "Self-Consistency for offline tasks: model aggregates internally; explicit N-sample voting is double work.", "core": false },
          { "text": "Auto-CoT, Complexity-based, Maieutic: all folded into the thinking phase." },
          { "text": "Wharton GAIL Lab 2025 on o3-mini: avg accuracy gain from explicit CoT was +2.9% at +20-80% more tokens — ROI negative on most realistic tasks." }
        ],
        "references": [
          { "title": "Wharton GAIL Lab 2025 measurement", "url": "https://arxiv.org/abs/2502.07266", "note": "CoT-on-o3-mini ROI analysis." }
        ]
      },
      {
        "id": "rm-keep",
        "title": "Still valuable",
        "description": "Decomposition / chaining (task structure is YOUR job) · ReAct (tool use orthogonal) · PoT / Faithful CoT (interpreters still beat LLMs at arithmetic) · Reflexion (cross-trial memory model doesn't keep) · Constitutional · S2A · ThoT (context cleaning) · SoT (latency is latency).",
        "wiki_file": "08-reasoning-models.md",
        "wiki_anchor": "#7-what-stays-valuable",
        "keyPoints": [
          { "text": "Task structure, validators, dead-letter queues are infrastructure, not reasoning — chaining survives.", "core": true },
          { "text": "ReAct: tool use is orthogonal to reasoning — model still needs your tool catalogue and stopping conditions.", "core": true },
          { "text": "PoT / Faithful CoT: a Python interpreter is more accurate than any LLM at arithmetic, dates, unit conversion.", "core": false },
          { "text": "Reflexion: episodic memory persists outside the model's context window — cross-trial wisdom is your job." },
          { "text": "SoT: latency is latency; parallel section generation is independent of reasoning quality." }
        ]
      },
      {
        "id": "rm-emerging",
        "title": "Emerging 2024-25",
        "description": "Self-Discover (model picks reasoning modules; +20% over CoT-SC at 10-40× less compute than ToT, arXiv:2402.03620) · Branch-Solve-Merge · Distill System 2 → System 1 · Process Reward Models · Test-time compute scaling laws.",
        "wiki_file": "08-reasoning-models.md",
        "wiki_anchor": "#9-emerging-2024-25-techniques",
        "keyPoints": [
          { "text": "Self-Discover (Zhou et al. 2024): model composes own reasoning structure at inference from library of reasoning modules. +20% over CoT-SC at 10-40× less compute than ToT.", "core": true },
          { "text": "Distill System 2 → System 1 (Yu/Sukhbaatar/Weston 2024): train smaller models to produce correct outputs WITHOUT explicit reasoning traces.", "core": true },
          { "text": "Branch-Solve-Merge: divide-and-conquer for long-form generation. Like Graph-of-Thoughts without full graph machinery.", "core": false },
          { "text": "Process Reward Models (PRMs): score every reasoning step. Enable targeted Self-Refine and better ToT value functions.", "core": false },
          { "text": "Test-time compute scaling: accuracy scales with thinking tokens in predictable power-law relationships." }
        ],
        "references": [
          { "title": "Self-Discover (Zhou et al. 2024)", "url": "https://arxiv.org/abs/2402.03620", "note": "+20% over CoT-SC at 10-40× less compute than ToT." },
          { "title": "Distill System 2 into System 1", "url": "https://arxiv.org/abs/2407.06023", "note": "Yu, Sukhbaatar, Weston 2024." },
          { "title": "Branch-Solve-Merge", "url": "https://arxiv.org/abs/2310.15123", "note": "Saha et al. 2023." }
        ]
      }
    ]
  },
  {
    "id": "production",
    "name": "Production + MLflow Tracing",
    "icon": "🏭",
    "color": "#ef4444",
    "tagline": "Apply the discipline of Session 5 §5 to EVERY sub-prompt in a chain.",
    "wiki_file": "09-production.md",
    "sections": [
      {
        "id": "pr-trace",
        "title": "MLflow Tracing API (2.14+)",
        "description": "@mlflow.trace + SpanType.{CHAIN, LLM, TOOL, AGENT}. OpenTelemetry-native span trees. mlflow.openai.autolog() auto-traces all OpenAI calls. Builds directly on Session 4's prompt registry.",
        "wiki_file": "09-production.md",
        "wiki_anchor": "#1-mlflow-310-tracing--genai--the-upgrade-from-session-4",
        "keyPoints": [
          { "text": "`@mlflow.trace(name=..., span_type=..., attributes=...)` turns any function into a span. Best practice: always pass `name=` and `attributes=`.", "core": true },
          { "text": "SpanType enum: CHAIN (orchestration), LLM (single model call), TOOL (function-calling), AGENT (top-level loop), RETRIEVER (RAG step).", "core": true },
          { "text": "`mlflow.openai.autolog()` / `anthropic.autolog()` / `langchain.autolog()` — one-line provider auto-tracing.", "core": false },
          { "text": "`mlflow.update_current_trace(tags={...})` annotates the active trace with searchable string tags (stop reason, cost, prompt version)." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "Chain tracing — Pattern 1",
          "code": "mlflow.openai.autolog()\n\n@mlflow.trace(\n    name=\"bug_triage_pipeline\",\n    span_type=SpanType.CHAIN,\n    attributes={\"prompt_version\": \"v3.2\", \"model\": MODEL},\n)\ndef triage(report: str) -> dict:\n    signal   = extract_signal(report)\n    routing  = classify_component(signal)\n    response = draft_response(signal, routing)\n    return {\"signal\": signal, \"routing\": routing, \"response\": response}"
        },
        "references": [
          { "title": "MLflow 3.10 Tracing docs", "url": "https://mlflow.org/docs/latest/llms/tracing/index.html", "note": "@mlflow.trace, start_span, SpanType, autolog." }
        ]
      },
      {
        "id": "pr-compare",
        "title": "Technique comparison experiment",
        "description": "Loop {zero_shot_cot, plan_and_solve, tot_beam2, self_refine_2r} → for each, log accuracy + avg_tokens + p50_latency + total_cost_usd. In MLflow compare view, ToT $0.30/call vs PnS $0.005/call settles the architecture debate.",
        "wiki_file": "09-production.md",
        "wiki_anchor": "#3-pattern-2--technique-comparison-with-mlflowgenaievaluate",
        "keyPoints": [
          { "text": "`mlflow.genai.evaluate(data, predict_fn, scorers=[...])` runs predict_fn over the dataset, applies scorers in parallel, logs every per-row trace.", "core": true },
          { "text": "Built-in scorers: Correctness, Guidelines, Safety, RelevanceToQuery, Completeness. Custom scorers via `@scorer` decorator.", "core": true },
          { "text": "Typical RCA result: ToT-beam2 scores +6pp Correctness over Plan-and-Solve at 40× the cost. The numbers, not opinions, decide which ships.", "core": false }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "Technique comparison — Pattern 2",
          "code": "for name, fn in TECHNIQUES.items():\n    with mlflow.start_run(run_name=name):\n        results = mlflow.genai.evaluate(\n            data=eval_data,\n            predict_fn=lambda input, _fn=fn: _fn(input),\n            scorers=[\n                Correctness(),\n                Guidelines(name=\"rca_rules\", guidelines=GUIDELINES),\n                Safety(),\n                cites_evidence,\n                cost_under_5_cents,\n            ],\n        )"
        },
        "references": [
          { "title": "MLflow genai.evaluate", "url": "https://mlflow.org/docs/latest/llms/llm-evaluate/index.html", "note": "Built-in judges + custom scorer API." }
        ]
      },
      {
        "id": "pr-cost",
        "title": "Cost / token cap per run",
        "description": "PRICING dict per model. log_call_cost(step, model, usage) per LLM call. Cumulative run cost as MLflow metric. Stop or switch when ToT/Reflexion exceeds ~$0.50/request: draft-and-verify, switch to SC N=5, cache value-fn, or switch model.",
        "wiki_file": "09-production.md",
        "wiki_anchor": "#7-pattern-6--cost-tracking-surfaced-in-the-trace-ui",
        "keyPoints": [
          { "text": "Per-call cost = prompt_tokens/1000 × in_price + completion_tokens/1000 × out_price. Attach as span attribute AND accumulate on trace tag.", "core": true },
          { "text": "Filterable: `mlflow.search_traces(filter_string=\"tags.cost_usd > '0.30'\")`.", "core": true },
          { "text": "Stop-and-switch threshold: ToT or Reflexion >$0.50/request — draft-and-verify, SC N=5, aggressive cache, or migrate to reasoning model.", "core": false },
          { "text": "Update `PRICING` dict at every model release — stale pricing produces silently wrong cost dashboards." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "Per-call cost attribution",
          "code": "def attribute_cost(model: str, usage) -> float:\n    cost = price_of(model, usage.prompt_tokens, usage.completion_tokens)\n    span = mlflow.get_current_active_span()\n    if span is not None:\n        span.set_attribute(\"usage.prompt_tokens\", usage.prompt_tokens)\n        span.set_attribute(\"usage.completion_tokens\", usage.completion_tokens)\n        span.set_attribute(\"cost_usd\", round(cost, 6))\n    return cost"
        },
        "references": [
          { "title": "Session 6 wiki — 09-production.md Pattern 6", "url": "./09-production.md", "note": "Full PRICING dict + cost rollup on trace root." }
        ]
      },
      {
        "id": "pr-cache",
        "title": "Caching per technique",
        "description": "Per-step in chain: hash(template_v + model + inputs). ReAct read-only tools: (tool, json.dumps(args, sort_keys)). ToT value-fn: hash(node_state + model). Self-Refine intermediates: NEVER cache (each must change by design).",
        "wiki_file": "09-production.md",
        "wiki_anchor": "#10-caching-strategies",
        "keyPoints": [
          { "text": "Per-step chain: hash(template_version + model + step_inputs) — all read-only steps.", "core": true },
          { "text": "ReAct tools: (tool_name, json.dumps(args, sort_keys=True)) — READ-ONLY tools only; never mutating tools.", "core": true },
          { "text": "ToT value function: hash(node_state + model) — identical sub-trees recur across runs and across requests.", "core": false },
          { "text": "Self-Refine intermediates: NEVER cache — each round must change by design; caching defeats the technique." },
          { "text": "Semantic cache only at chain boundaries, never inside tight loops — false-positives COMPOUND across steps." }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "Cache key construction",
          "code": "# Per-step chain cache\nkey = hashlib.sha256(\n    f\"{template_version}|{model}|{json.dumps(step_inputs, sort_keys=True)}\".encode()\n).hexdigest()\n\n# ReAct tool cache (read-only tools only)\ntool_key = (tool_name, json.dumps(args, sort_keys=True))\n\n# ToT value function cache\nvalue_key = hashlib.sha256(f\"{node_state}|{model}\".encode()).hexdigest()"
        },
        "references": [
          { "title": "Anthropic Prompt Caching", "url": "https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching", "note": "90% cost / 80% TTFT savings on stable prefixes." }
        ]
      },
      {
        "id": "pr-error",
        "title": "Error propagation strategies",
        "description": "Fail-fast (irreversible) · Fallback chain (degraded OK) · Self-heal (deterministic re-prompt) · Graceful degrade (confidence=0.5, mark for human). Always emit structured trace event on every failure.",
        "wiki_file": "09-production.md",
        "wiki_anchor": "#11-error-propagation-strategies",
        "keyPoints": [
          { "text": "5-step chain at 0.95 per step = 77% end-to-end; 8 steps = 66%. Must pick a strategy PER STEP.", "core": true },
          { "text": "Fail-fast for irreversible downstream actions; self-heal for deterministic validation errors (mini-Self-Refine).", "core": true },
          { "text": "Always emit a structured trace attribute on every failure — debuggable offline without re-running the chain.", "core": false }
        ],
        "pseudocode": {
          "lang": "python",
          "label": "Resilient step runner",
          "code": "for attempt in range(retries + 1):\n    try:\n        out = fn(ctx)\n    except Exception as e:\n        last_error = str(e); continue\n    if validator is None or validator(out):\n        return ChainResult(out, confidence=1.0)\n    ctx[f\"_{name}_feedback\"] = validator.last_error    # self-heal\nif fallback_fn:\n    return ChainResult(fallback_fn(ctx), confidence=0.5, error=last_error)\nreturn ChainResult(None, confidence=0.0, needs_human=True)"
        },
        "references": [
          { "title": "Session 6 wiki — 09-production.md §11", "url": "./09-production.md", "note": "Full ChainResult + run_step_resilient." }
        ]
      },
      {
        "id": "pr-huang",
        "title": "Misconception 0: self-correct w/o verifier",
        "description": "Huang et al. 2310.01798 — 'LLMs Cannot Self-Correct Reasoning Yet.' Without external feedback (rubric, tests, linter, ground truth), self-correction DEGRADES GSM8K accuracy. The single most important caveat in advanced prompt engineering.",
        "wiki_file": "09-production.md",
        "wiki_anchor": "#12-misconception-0--self-correction-without-a-verifier-critical",
        "keyPoints": [
          { "text": "Huang et al. 2023: when GPT-3.5/GPT-4 self-corrects WITHOUT external feedback, GSM8K accuracy DEGRADES vs original answer.", "core": true },
          { "text": "Pure 'do you think this is right?' loops are not just useless — they are HARMFUL.", "core": true },
          { "text": "Required external signals: Self-Refine → rubric/lint/tests; Constitutional → policy doc; Reflexion → episode reward; ToT → executor/verifier.", "core": true },
          { "text": "Verification check: disable critic → run eval with Correctness(); enable critic → run again. If Correctness/mean didn't improve ≥2pp on >100 cases, you have NO critic. Strip the loop." }
        ],
        "references": [
          { "title": "Huang et al. 2023 — LLMs Cannot Self-Correct Reasoning Yet", "url": "https://arxiv.org/abs/2310.01798", "note": "The single most important caveat in advanced prompt engineering." }
        ]
      },
      {
        "id": "pr-wisdom",
        "title": "Practitioner wisdom",
        "description": "Eval set > fancier technique · schema-validate every JSON · cache at temp=0 (near-deterministic) · per-step pass-rate before changing any prompt · re-run evals every major model bump · reasoning models 5-10× per token (gpt-4o-mini chain often beats one o1 call).",
        "wiki_file": "09-production.md",
        "wiki_anchor": "#15-practitioner-wisdom--things-i-wish-i-knew-before",
        "keyPoints": [
          { "text": "Biggest improvement comes from a good eval set, not a fancier technique. A 100-case golden set for your domain beats every paper.", "core": true },
          { "text": "Schema-validate every intermediate JSON output. Pydantic at every boundary; `response_format={\"type\": \"json_object\"}` where supported.", "core": true },
          { "text": "Per-step pass-rate analysis BEFORE changing any prompt — the weakest step is always the target, not the strongest.", "core": false },
          { "text": "Reasoning models cost 5-10× per token. A chain on gpt-4o-mini often outperforms one o1 call on production tasks. Measure first." },
          { "text": "EmotionPrompt and low-effort tricks are model-version-dependent. Re-run eval at every major model bump." }
        ],
        "references": [
          { "title": "Eugene Yan — LLM Patterns", "url": "https://eugeneyan.com/writing/llm-patterns/", "note": "Production wisdom: eval set first, schema-validate, per-step pass-rate." }
        ]
      }
    ]
  },
  {
    "id": "demos",
    "name": "Demos",
    "icon": "🎬",
    "color": "#14b8a6",
    "tagline": "5 demos woven through the session (~28 min total).",
    "wiki_file": null,
    "sections": [
      {
        "id": "d1",
        "title": "D1: ToT on Game-of-24",
        "description": "Live (~6 min, after §2a). Run vanilla CoT first — fails (4% on GPT-4). Then ToT — show tree expand level by level, hypotheses scored and pruned. The 4% → 74% delta is visceral.",
        "wiki_file": null
      },
      {
        "id": "d2",
        "title": "D2: Bug-triage chain",
        "description": "Live (~6 min, after §2b). 3-step chain: extract signal → classify component → draft response. Pydantic validators per step, retry-with-feedback on schema fail, full MLflow tracing.",
        "wiki_file": null
      },
      {
        "id": "d3",
        "title": "D3: PoT vs CoT bake-off",
        "description": "Lab (~5 min, after §3.4). 30 finance-math questions. Log accuracy + tokens to MLflow. PoT wins by ~+15 pp depending on numeric complexity.",
        "wiki_file": null
      },
      {
        "id": "d4",
        "title": "D4: ReAct K8s incident bot",
        "description": "Live (~6 min, after §2d). Fake tools: query_metrics, tail_logs, list_recent_deploys, rollback. Show Thought/Action/Observation loop step-by-step. Bot proposes targeted rollback.",
        "wiki_file": null
      },
      {
        "id": "d5",
        "title": "D5: MLflow technique comparison",
        "description": "Live (~5 min, after §6.2). Same RCA task through 4 techniques (zero_shot_cot, plan_and_solve, tot_beam2, self_refine_2r). Compare accuracy/cost/latency in MLflow UI.",
        "wiki_file": null
      }
    ]
  },
  {
    "id": "deferred",
    "name": "Deferred → Later Sessions",
    "icon": "📦",
    "color": "#9ca3af",
    "tagline": "Content found in research but out of scope for Session 6.",
    "wiki_file": null,
    "sections": [
      {
        "id": "def-rag",
        "title": "RAG → Session 8",
        "description": "Full retrieval-augmented generation. Generated Knowledge is the prompt-only proxy in S6.",
        "wiki_file": null
      },
      {
        "id": "def-ft",
        "title": "Fine-tuning / RLHF → Session 8",
        "description": "Different lever. Out of prompt-engineering scope.",
        "wiki_file": null
      },
      {
        "id": "def-agents",
        "title": "Full agents / multi-agent → S7+",
        "description": "ReAct + Chaining are the prerequisites. Architecture lives in later sessions.",
        "wiki_file": null
      },
      {
        "id": "def-dspy",
        "title": "DSPy / prompt compilers",
        "description": "Tool category, not a technique. Pointer in reference library only.",
        "wiki_file": null
      },
      {
        "id": "def-ds",
        "title": "Directional Stimulus",
        "description": "Train small policy LM to emit hints for big frozen LLM. High-volume production only; setup too heavy for workshop. Li et al. 2023, arXiv:2302.11520.",
        "wiki_file": null
      },
      {
        "id": "def-prm",
        "title": "Process Reward Models (PRMs)",
        "description": "Score every reasoning step. Enables targeted Self-Refine and better ToT value functions. Research-stage in 2025.",
        "wiki_file": null
      },
      {
        "id": "def-distill",
        "title": "Distill System 2 → System 1",
        "description": "Train models to produce correct outputs WITHOUT explicit reasoning traces, preserving accuracy at System 1 speed. Yu/Sukhbaatar/Weston 2024, arXiv:2407.06023.",
        "wiki_file": null
      },
      {
        "id": "def-bsm",
        "title": "Branch-Solve-Merge",
        "description": "Divide-and-conquer for long-form generation. Similar to GoT without full graph machinery. Saha et al. 2023, arXiv:2310.15123.",
        "wiki_file": null
      },
      {
        "id": "def-mm",
        "title": "Multimodal CoT / ReAct",
        "description": "Vision-language variants. Out of scope; future session.",
        "wiki_file": null
      },
      {
        "id": "def-inj",
        "title": "Prompt injection at advanced rungs",
        "description": "Same defences as Session 5 §5.4-5.5 apply per step in any chain. Cross-reference S5.",
        "wiki_file": null
      }
    ]
  }
];
