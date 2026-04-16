# 01 — Why Prompting Exists: History & Model Taxonomy

**Overview:** The ability to control a model through natural language is the result of a 5-epoch shift in how NLP models are built and trained. Understanding this history is not optional trivia — it explains why techniques work, which model type to use, and why prompting became reliable in 2022.

**Cross-references:** [02-anatomy.md](02-anatomy.md) — the anatomy principles stem from how instruction-tuned models were trained. [04-chain-of-thought.md](04-chain-of-thought.md) — CoT works because of autoregressive generation, which this section introduces.

---

## The 5 Epochs

### Epoch 1: Supervised Models (pre-2018) — Architecture Engineering

**What it was:** Task-specific models. One model per task, trained from scratch with labeled data.

**Mechanics:** Researchers designed custom neural network architectures (LSTM, CNN, bidirectional encoders) for specific tasks. A translation model and a sentiment model were entirely separate systems — no shared intelligence.

**The practitioner's job:** Design the network topology. Choose the right architecture for the task. Gather labeled data. Train from scratch.

**Example:**  
A French→English Statistical Machine Translation (SMT) system trained on parliament transcripts. It could translate but could not summarize. Adding summarization required a new model, new data, new architecture.

**Why this matters:** When something went wrong, you fixed the architecture. There was no prompt.

---

### Epoch 2: Pre-train + Fine-tune (2018–2019) — Objective Engineering

**What it was:** BERT (Google) and GPT-1 (OpenAI) introduced the concept of pre-training on massive unlabeled corpora, then fine-tuning on smaller labeled datasets.

**Mechanics:**  
1. Pre-train on massive text (Common Crawl, Wikipedia, Books) using a self-supervised objective (masked language modeling for BERT, next-token prediction for GPT).  
2. Fine-tune: take the pre-trained base, add a task-specific output head, train on your labeled data with the pre-trained weights as initialization.

**The practitioner's job:** Design the fine-tuning objective. Choose the right pre-trained base. Curate labeled data. Fine-tune per task.

**Example:**  
BERT-Base → add 3-class softmax head → fine-tune on 50,000 labeled movie reviews → sentiment classifier. Far less labeled data needed. But still one fine-tuned model per task.

**Why this matters:** Shared pre-training created shared representations. Fine-tuning transferred that knowledge to new tasks cheaply. But you still needed labeled data and a separate fine-tuned model per task.

---

### Epoch 3: Text-to-Text (2019) — T5

**What it was:** Google's T5 (Text-to-Text Transfer Transformer) cast every NLP task as a text-in → text-out problem using task prefixes.

**Mechanics:**  
Every task — translation, summarization, sentiment classification, QA — is formatted as a text-to-text problem. A fixed prefix in the input specifies the task:

```
translate English to German: That is a good idea.
summarize: [long document...]
classify sentiment: This product is terrible.
question: Who founded Apple? context: Apple was founded by Steve Jobs...
```

T5 still required fine-tuning per task, but the model was a single architecture across all tasks.

**Why this matters:** T5 established that text could be the task specification. The "prefix" is a proto-prompt. The first hint that a model could be directed at inference time, not just trained separately per task.

---

### Epoch 4: Generative Scale + In-Context Learning (2020) — GPT-3

**What it was:** Brown et al. (2020) showed that at sufficient scale (175B parameters), language models exhibit "In-Context Learning" (ICL): they perform tasks from demonstrations in the prompt — without any weight updates.

**Mechanics:**  
The model is given a prompt with task description + examples. It infers the task pattern and completes the sequence. No gradient descent. No fine-tuning. The prompt IS the program.

| Metric | GPT-3 Zero-Shot | GPT-3 One-Shot | GPT-3 Few-Shot (K=8+) |
|--------|----------------|---------------|----------------------|
| CoQA (F1) | 81.5 | 84.0 | 85.0 |
| TriviaQA (Acc) | 64.3% | 68.0% | 71.2% |

**The key insight:** Scale enables ICL. The model's pre-training on massive text implicitly learned to infer patterns from demonstrations. At small scale, this ability barely exists. At 175B, it is robust enough for real use.

**Why this matters:** This is the origin of few-shot prompting. The prompt became the interface. The practitioner's job shifted from "design the network" to "design the prompt."

**Paper:** Brown et al. 2020 — GPT-3 — arXiv:2005.14165

---

### Epoch 5: Instruction Tuning + RLHF (2022–present)

**What it was:** InstructGPT (OpenAI, 2022) and FLAN (Google) showed that fine-tuning on (instruction, output) pairs — plus Reinforcement Learning from Human Feedback (RLHF) — makes models reliably follow natural language instructions.

**Mechanics:**  
1. **Supervised Fine-Tuning (SFT):** Train on human-written (instruction → response) pairs. The model learns to interpret instructions as task specifications.  
2. **Reward Model Training:** Human raters compare pairs of responses. Train a reward model on their preferences.  
3. **RLHF:** Use RL to optimize the SFT model to maximize the reward model's score.

**Result:** InstructGPT (1.3B parameters) is preferred over GPT-3 (175B) by 85% of human raters. Alignment > scale.

**The shift:** From "what token comes next?" → "what does the user want me to do?" This is why prompts work the way they do: the model is trained to follow instructions, not complete strings.

**Why this matters:**  
- Before instruction tuning: zero-shot prompts often failed; models would continue text rather than follow commands  
- After instruction tuning: natural language instructions are the first-class interface  
- This is why all 5 prompting techniques in this session work reliably on modern LLMs

**Papers:**  
- Ouyang et al. 2022 — InstructGPT: 1.3B InstructGPT > 175B GPT-3 (85% human preference)  
- Wei et al. 2022 — FLAN: multi-task instruction tuning improves zero-shot generalization

---

## The Core Insight

> *A prompt is not a chat message. It is a runtime program for a probabilistic computer that was trained to follow instructions. You are not asking — you are configuring.*

---

## Model Taxonomy

For developers, it is critical to understand which type of model you are calling. The prompting strategy changes for each type.

| Model Type | Definition | Training Goal | Prompting Strategy |
|-----------|-----------|--------------|-------------------|
| **Base / Foundation** | Raw pre-trained model (e.g., Llama-3-Base, GPT-3) | Predict the next token in a sequence | DO NOT use in production. Completes strings, ignores instructions. For fine-tuning specialists only. |
| **Instruction-Tuned (IT)** | Base model + SFT on (instruction, output) pairs (e.g., Llama-3-Instruct, Mistral-Instruct) | Follow explicit, one-off commands | Best for 90% of engineering tasks: classification, extraction, code review, summarization |
| **Chat / RLHF** | IT model + RLHF on multi-turn dialogues (e.g., ChatGPT, Claude, Gemini) | Maintain coherence + safety across turns | Conversational agents, multi-turn reasoning, interactive assistants |
| **Reasoning** | Optimized via large-scale RL to use thinking tokens (e.g., OpenAI o1, o3; DeepSeek R1; Claude Extended Thinking) | Solve complex logic, math, code through native CoT | Simplify the prompt — let it think. Explicit CoT adds minimal gain at high cost. |

### Practitioner Rules

1. **For standard engineering tasks (classify, extract, review, summarize):** Use an Instruction-Tuned or Chat model via the `/chat/completions` or Messages API.

2. **For complex reasoning (architectural decisions, multi-step debugging, math):** Use a Reasoning model. But simplify your prompt — don't add CoT instructions. Let the model reason internally.

3. **Never use a Base model in an application.** It will complete text, not follow instructions. Results will be unpredictable.

4. **API endpoint matters:**  
   - IT/Chat models: `/chat/completions` (OpenAI), `/messages` (Anthropic)  
   - Reasoning models (o1, o3): Responses API (OpenAI) for better tool use support  
   - Never use `/completions` for IT models — it's the legacy endpoint for Base models

---

## Why This History Is Exam-Worthy

Engineers who understand these 5 epochs can answer:
- "Why does prompting work at all?" → Epoch 4 (ICL at scale) + Epoch 5 (instruction tuning)
- "Why do we even need to write a system prompt?" → Epoch 5 (RLHF trained the model to follow role specifications)
- "Why is CoT so effective?" → Epoch 4 + autoregressive generation (see [04-chain-of-thought.md](04-chain-of-thought.md))
- "Why does GPT-3 (base) behave differently from ChatGPT?" → Epoch 5 — instruction tuning + RLHF

---

## Editorial Notes

- **Best teaching moment:** Draw the 5-epoch timeline on a whiteboard / slide. Show the horizontal axis = time, vertical axis = "how much the model follows your intent." The jump between Epoch 4 (GPT-3 ICL) and Epoch 5 (InstructGPT) is dramatic.
- **Common misconception to address:** "ChatGPT is just a bigger GPT-3." No — it's instruction-tuned + RLHF. A fundamentally different training objective.
- **Session 3 connection:** The autoregressive generation mechanism introduced in Session 3 is WHY Epoch 4 enables ICL and WHY CoT works. Make this connection explicit.

---

## References

| Source | Used for |
|--------|----------|
| Brown et al. 2020 (arXiv:2005.14165) | GPT-3, ICL, few-shot benchmarks |
| Ouyang et al. 2022 — InstructGPT | Instruction tuning + RLHF |
| Wei et al. 2022 — FLAN | Instruction fine-tuning at scale |
| Comprehensive Framework research report | Model taxonomy table; API endpoint guidance |
| ChatGPT deep research report | 5-epoch teaching narrative |
