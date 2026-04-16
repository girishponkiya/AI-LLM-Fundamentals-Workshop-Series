# Glossary — Session 5: Core Prompt Engineering

| Term | Definition |
|------|-----------|
| **APE (Automatic Prompt Engineer)** | Meta Prompting technique where an LLM generates N candidate prompts, each is evaluated on a test set, and the best-scoring one is selected. Zhou et al. 2022: 19/24 tasks beat human-written prompts. |
| **Autoregressive Generation** | Text generation where each token is predicted from all preceding tokens: P(token_n \| token_1,...,token_{n-1}). The core mechanism of GPT-style LLMs. CoT exploits this — intermediate tokens become conditioning context. |
| **Base Model** | Raw pre-trained model (e.g., GPT-3, Llama-3-Base). Predicts next token. Does NOT follow instructions reliably. Only for fine-tuning, never for production apps. |
| **Chain-of-Thought (CoT)** | Prompting technique where the model generates intermediate reasoning steps before the final answer. Two forms: Few-Shot CoT (Wei et al. 2022) and Zero-Shot CoT (Kojima et al. 2022). |
| **Chat Model** | Instruction-tuned model + RLHF on multi-turn dialogue data. Maintains coherence and safety across conversation turns. Examples: ChatGPT, Claude, Gemini. |
| **Complexity Ladder** | Escalation order for prompting techniques: Zero-Shot → Few-Shot → CoT → Self-Consistency → Meta Prompting → Fine-Tuning. Start at Zero-Shot; escalate only with eval evidence. |
| **Few-Shot Prompting** | Including 3–5 input→output demonstration pairs ("exemplars") in the prompt. Model infers the task pattern via In-Context Learning. Brown et al. 2020. |
| **FLAN** | Fine-tuned LAnguage Net (Google 2022). Instruction-tuned model trained on 60+ tasks. Showed that instruction fine-tuning improves zero-shot generalization. |
| **Floating Alias** | A model identifier that resolves to the current latest snapshot (e.g., "gpt-4o", "claude-sonnet"). Dangerous in production: silent model updates can change prompt behavior without error. |
| **Golden Test Set** | 50–100 labeled input→output pairs used to evaluate and regression-test prompt changes. Mandatory before any promotion to production. |
| **ICL (In-Context Learning)** | Model learning to perform a task from examples in the prompt, without weight updates. Emerges at scale with GPT-3 (175B). The foundation of few-shot prompting. |
| **Indirect Injection** | Prompt injection where malicious instructions are embedded in data the model processes (documents, PDFs, tool outputs, emails) rather than in the user's direct message. |
| **InstructGPT** | OpenAI 2022. Base GPT-3 + SFT + RLHF. Result: 1.3B InstructGPT preferred over 175B GPT-3 by 85% of human raters. Established instruction tuning + RLHF as the alignment standard. |
| **Instruction-Tuned (IT) Model** | Base model fine-tuned on (instruction, output) pairs using SFT. Reliably follows explicit natural language commands. Best for 90% of engineering tasks. |
| **Inverted-U Curve (CoT length)** | Accuracy as a function of CoT length peaks at an optimal range. Too short = insufficient reasoning; too long = overthinking, contradictions. arXiv:2502.07266. |
| **LLM-as-Judge** | Using a powerful LLM to evaluate the outputs of another LLM against a rubric (groundedness, correctness, policy compliance). Used for automated eval when exact match is insufficient. Session 4 topic. |
| **Meta Prompting** | Using an LLM to generate, evaluate, and optimize prompts. Includes APE (candidate selection) and OPRO (iterative optimization with score history). Requires an eval set. |
| **Min et al. 2022** | "Rethinking the Role of Demonstrations." Key finding: random labels in few-shot examples cause only 0–5% accuracy drop. What matters: FORMAT, LABEL SPACE, and DISTRIBUTION — not individual label correctness. arXiv:2202.12837. |
| **Model Pinning** | Using a specific model snapshot (e.g., "claude-sonnet-4-6") rather than a floating alias, to prevent silent model updates from breaking prompts. |
| **OPRO (Optimization by PROmpting)** | Iterative prompt optimization where prior prompts + their scores form an optimization trajectory in the meta-prompt. Yang et al. 2023. GSM8K: 83% → 89%. |
| **PCT Pattern** | Persona-Context-Task prompt structure. ~37% improvement in output relevance vs unstructured prompts. The role grounds vocabulary; context provides information; task specifies action. |
| **Positional Bias** | Models attend more to recent tokens. Practical rule: place long context at the TOP of the prompt and the specific query at the VERY END. +30% quality improvement. |
| **Post-hoc Rationalization** | CoT failure mode where the model produces a confident, fluent reasoning chain that leads to a wrong answer. Cannot be detected from output alone — requires eval set with ground truth. |
| **Prompt Caching** | Anthropic caches frequently-used system prompt prefixes. 90% cost reduction + 80% faster TTFT on cache hits. Cache threshold: 1024 tokens. TTL: 5 min (resets on each hit). |
| **Prompt Injection** | OWASP LLM01:2025. User input (direct) or embedded data (indirect) overrides the model's intended behavior. Roleplay attacks: 89.6% success rate. |
| **Reasoning Model** | LLM optimized via large-scale RL to reason using internal "thinking" tokens before responding. Examples: OpenAI o1/o3, DeepSeek R1, Claude Extended Thinking. Explicit CoT adds only +2.9% accuracy at 20–80% more tokens. |
| **RLHF (Reinforcement Learning from Human Feedback)** | Training technique: human raters compare responses → reward model learns preferences → RL optimizes the policy to maximize reward. Used in InstructGPT, ChatGPT, Claude. |
| **Self-Consistency (SC)** | Advanced decoding strategy: sample N independent CoT paths at temperature > 0, take majority vote on final answer. Wang et al. 2022. GSM8K: 56.5% → 74.4% (N=40). |
| **Structured Outputs** | API-level enforcement of output JSON schema. OpenAI: `response_format: json_schema`. Anthropic: Tool Use with `input_schema`. More reliable than prose format instructions under load. |
| **System Prompt** | Developer-controlled prompt set before the conversation. Contains role, standing rules, format spec, few-shot examples. Cached by Anthropic. Security boundary: critical rules belong here only. |
| **T5 (Text-to-Text Transfer Transformer)** | Google 2019. Epoch 3 model that cast all NLP tasks as text-in → text-out. Fixed prefixes ("summarize:", "translate:") were the first proto-prompts. |
| **TTFT (Time To First Token)** | Latency from API call to first token of response. Prompt caching reduces TTFT by up to 80%. |
| **User Prompt** | The per-call message from the user. Contains the dynamic task input. Treated as untrusted by default. Not cached. |
| **XML Tagging** | Anthropic's recommended practice of wrapping prompt sections in XML tags (`<instructions>`, `<context>`, `<example>`, `<input>`) to prevent the model confusing data with instructions. Also key injection defense. |
| **Zero-Shot CoT** | Appending "Let's think step by step" to a zero-shot prompt. Kojima et al. 2022. MultiArith: 17.7% → 78.7%. Enables reasoning without examples. |
| **Zero-Shot Prompting** | Instruction + input only. No examples. Model draws on training knowledge. Always the starting technique — most cost-efficient baseline. |

---

## Key Papers Quick Reference

| Technique | Paper | Key Result | arXiv |
|-----------|-------|-----------|-------|
| Few-Shot / ICL | Brown et al. 2020 — GPT-3 | TriviaQA: 64.3% → 71.2% (K=8) | 2005.14165 |
| Few-Shot labels | Min et al. 2022 — Rethinking Demonstrations | Random labels: 0–5% accuracy drop | 2202.12837 |
| Chain-of-Thought | Wei et al. 2022 | GSM8K: 17.9% → 56.9% | 2201.11903 |
| Zero-Shot CoT | Kojima et al. 2022 | MultiArith: 17.7% → 78.7% | 2205.11916 |
| Self-Consistency | Wang et al. 2022 | GSM8K: 56.5% → 74.4% (N=40) | 2203.11171 |
| APE | Zhou et al. 2022 | 19/24 tasks beat human prompts | 2211.01910 |
| OPRO | Yang et al. 2023 | GSM8K: 83% → 89% | 2309.03409 |
| InstructGPT | Ouyang et al. 2022 | 1.3B > 175B (85% human pref) | — |
| CoT theory | Joshi et al. 2025 | Autoregressive CoT formal proof | 2503.07932 |
| CoT length | arXiv 2502.07266 | Inverted-U curve for CoT length | 2502.07266 |
| CoT on reasoning | Wharton GAIL 2025 | +2.9% gain at 20–80% more tokens | — |
