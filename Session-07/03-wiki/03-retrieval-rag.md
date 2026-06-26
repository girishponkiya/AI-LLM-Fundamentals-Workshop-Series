# 03 — Layer 3: Retrieval (RAG) and the hard problem of retrieval

**Overview:** The model has **two knowledge holes** — *temporal* (it doesn't know the present world,
past its training cutoff) and *private* (it has never seen *your* data). RAG fixes both the same way:
**retrieve relevant text at query time and put it in the context window**, so the answer is grounded in
real, current, owned knowledge. The naive picture (embed query → vector search → stuff top-k →
generate) often works. But the moment you ask *why*, you hit this layer's centerpiece: **a question and
its answer don't look alike.** Bridging that gap — trivial for a human, a research field for a machine —
is what the rest of this page is about.

**Cross-references:** [00-overview.md](00-overview.md) — retrieval is where the "easy for a human, hard
for a machine" thread is sharpest. [02-tool-calling.md](02-tool-calling.md) — retrieval can be a fixed
pipeline step or a `search()` *tool* (agentic RAG). [04-orchestration-loop.md](04-orchestration-loop.md)
— retrieval is one of the things the loop sequences. Demo 3 (`demo_03_retrieval_asymmetry`) makes §The
core difficulty and §HyDE concrete. **Boundary flag:** *RAG vs fine-tuning vs long-context* — when to
retrieve, retrain, or just stuff it all in the prompt — is **Session 8**; here RAG is taught as a
*pattern*, not chosen against alternatives. Research:
[`../01-research/claude-deep-research.md`](../01-research/claude-deep-research.md) §4.

---

## Why RAG — two gaps, one fix

| Gap | What's missing | RAG's fix |
|-----|----------------|-----------|
| **Temporal** | The present world (post-cutoff) | Retrieve current text into context |
| **Private** | *Your* policies, orders, docs | Retrieve owned text into context |

> **The analogy:** *open-book exam — the model isn't smarter, it's just allowed to check its notes.*
> Ideally with a citation, so the answer is traceable.

---

## The core difficulty: a question and its answer don't look alike

The question — *"can I return an opened item?"* — and the clause that answers it — *"unsealed
merchandise may be exchanged within 14 days of delivery"* — **share almost no words.** A human bridges
that instantly. A machine doing **keyword/lexical matching fails**: no overlap, no match.

**Embeddings are the first fix.** An embedding maps text to a vector that captures *meaning*, so
*"budget phone" ≈ "affordable smartphone"* sit close even with zero shared words. This solves
**vocabulary mismatch** — the thing keyword search can't do.

**But here's the deeper trap.** A **question** and its **answer** are different *shapes* of text —
different length, different grammar (interrogative vs declarative), different vocabulary — and they tend
to live in **different regions of embedding space.** A general-purpose similarity model, asked "what's
nearest this question?", happily returns **other questions**, not the answer. So *"embed the query, find
the nearest text"* is **not** automatically *"find the answer."*

> This is the centerpiece: **easy for you in half a second; a research field for a machine.**

---

## Symmetric vs asymmetric semantic search

The field names exactly this distinction (the sentence-transformers / SBERT framing):

- **Symmetric search** — query and corpus entries are about the **same length and content** (e.g., "find
  duplicate questions"). Query and document are interchangeable.
- **Asymmetric search** — a **short query** retrieves from **longer passages** (e.g., "retrieve the
  answer"). **This is what RAG actually needs.**

The fix is models **trained for asymmetry** — on query→passage pairs (the **MS MARCO** dataset is the
canonical one):

- **DPR** (Dense Passage Retrieval) — **separate encoders** for questions and passages, trained to pull
  a question and its answer-passage together.
- **E5 / multilingual-E5** — a single model but with **`query:` and `passage:` prefixes**, so each side
  is encoded for its role. *(Great live demo: the same text embedded with `query:` vs `passage:` lands
  in different places — see Demo 3.)*

> **Takeaway:** the embedding model is **not neutral** — it must be trained for the shape of matching you
> need. Picking a *symmetric* model for a Q→A task is a classic **silent failure**.

---

## Query transformation — do I rephrase or expand?

Yes — these are real, named techniques:

- **Query rewriting** — clean up / disambiguate; stays *question-shaped*. Cheap; helps with messy input.
- **Multi-query / query expansion** — fan one query into several variants, retrieve for each, union the
  results. Improves recall when phrasing is unpredictable.
- **HyDE (Hypothetical Document Embeddings)** — the elegant one. Ask the LLM to **write a hypothetical
  answer**, then embed *that* and search with it. Now you match **answer-to-answer** instead of
  question-to-answer — the hypothetical shares the vocabulary, length, and structure of real answers, so
  its nearest neighbours *are* real answers. It manufactures the missing piece to bridge the gap.

**Honesty / nuance (good for credibility):** none of these is a free lunch. HyDE adds an extra LLM call
(latency/cost) and can *underperform* on precise factual/numeric queries (e.g., financial tables), where
it can hallucinate a misleading hypothetical. Many teams apply it **selectively** — only on ambiguous or
low-confidence queries. *"It depends"* is the correct, adult answer.

---

## Lexical never died: hybrid search

Dense vectors encode **meaning, not exact strings.** So pure-vector retrieval has a brutal blind spot:
**identifiers, SKUs, codes, names, rare technical terms.** Ask for "SKU AZ-4471" and a dense retriever
may confidently surface a *semantically similar but wrong* product, while the exact-match document never
surfaces. A human would just match the string.

- **BM25** (sparse/lexical) — nails exact terms and rare tokens; no notion of meaning.
- **Dense** — nails paraphrase/semantics; misses exact strings.
- **Hybrid search** — run both and **fuse**, typically with **Reciprocal Rank Fusion (RRF)**, which
  combines on *rank position* rather than raw scores (BM25 and cosine scores aren't on the same scale,
  so naive weighting breaks).

> Across benchmarks, *if your RAG uses pure vector search, adding BM25 is the single highest-impact
> upgrade you can make.*

---

## Reranking: recall first, then precision

Retrieval is two-stage by nature:

- **First stage (recall)** — a **bi-encoder** embeds query and documents *separately* (so document
  vectors can be precomputed) → fast, casts a wide net, returns ~50–200 candidates.
- **Second stage (precision)** — a **cross-encoder** reranker takes the query and each candidate
  **together** and scores the pair jointly → far more accurate, far slower, so you only run it on the
  shortlist. *(**ColBERT / late interaction** is a middle ground: token-level matching, more accurate
  than bi-encoders, cheaper than full cross-encoders.)*

**The canonical production pipeline** (slide-worthy):

```
query → [hybrid retrieval: BM25 ∥ dense] → RRF fusion → cross-encoder rerank → top-k → LLM
```

Two-stage hybrid + reranking consistently and significantly beats any single-stage method on real
benchmarks.

---

## Other knobs (mention, don't dwell)

**Chunking** (size/overlap — too big dilutes, too small fragments), **contextual retrieval** (prepend a
short context blurb to each chunk before embedding — consistently helps), **metadata filtering.** These
are the dials people actually turn in production.

---

## The teaching takeaway — the staircase

Pose the questions in order and let the machinery accrete:

1. keyword match **fails** →
2. embeddings fix **vocabulary** →
3. but Q and A live **apart** → asymmetric models / **HyDE** bridge the shape gap →
4. but **exact strings** break → **hybrid + BM25** →
5. but **ranking is noisy** → **rerank.**

> **The punchline:** all of that machinery just to reproduce what a human does in half a second when
> they "go look it up." That asymmetry — trivial for us, a research field for machines — *is* the lesson.

---

## Misconceptions to puncture

- *"Better embeddings fix exact-match failures."* → No; that's a job for **BM25/hybrid**, not a bigger
  model.
- *"Semantic search always beats keyword."* → False on identifiers, codes, and some domains (finance)
  where BM25 wins.
- *"A question embeds near its answer."* → Often not; that's the **asymmetry** problem.
- *"HyDE / query-expansion always helps."* → Hurts on precise factual queries; use selectively.

---

## Editorial notes

- **This is the centerpiece — slow down (Slide 9, ~5 min).** The value is in *posing* the question, not
  answering every one. Put the question and the answering clause side by side and let the room feel that
  they connected them without trying.
- **Run Demo 3 here if you have the 90-min slot.** Same text under `query:` vs `passage:` prefixes lands
  apart; HyDE closes the gap — in numbers. If no embeddings endpoint at the venue, present from a
  screenshot; the concept carries.
- **Keep the demo's retrieval tiny.** Demo 1's `get_policy` is a toy in-memory lookup on purpose; the
  deep ideas here are taught on slides, not all coded.
- **Hold the altitude.** Resist "should I use RAG or fine-tune?" — that's the Session 8 finale; spoiling
  it here weakens both sessions.

---

## References (educational-worthy; verified mid-2026)

- Symmetric vs asymmetric semantic search — sbert.net; OpenSearch asymmetric-model docs; Milvus
- DPR / E5 / multilingual-E5; MS MARCO query→passage training data
- HyDE — Gao et al. 2022 ("Precise Zero-Shot Dense Retrieval without Relevance Labels")
- Query transformation — LangChain multi-query; ARAGOG; "Out of Style: RAG's Fragility to Linguistic
  Variation"
- Hybrid search & RRF; cross-encoders / rerankers; ColBERT late interaction
- Contextual retrieval — Anthropic engineering blog
