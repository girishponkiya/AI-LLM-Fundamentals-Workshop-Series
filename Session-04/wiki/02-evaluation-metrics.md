# Evaluation Metrics

The scoring functions used to measure LLM output quality — what each measures, how it's computed, and where it fails.

> This file covers metric *theory and formulas*. For how to call these metrics via frameworks (RAGAS API, DeepEval, Phoenix), see [Evaluation Frameworks](./03-evaluation-frameworks.md).

---

## Text Generation Metrics

These metrics compare a generated text against a human reference. They are cheap to compute but correlate poorly with human judgment for open-ended generation.

### BLEU

BLEU (Bilingual Evaluation Understudy) measures modified n-gram precision with a brevity penalty:

$$\text{BLEU} = \text{BP} \cdot \exp\left(\sum_{n=1}^{N} w_n \cdot \ln(p_n)\right)$$

Where:
- **BP** = exp(1 − r/c) if c ≤ r, else 1 (penalises short outputs)
- Standard BLEU-4 uses equal weights: w₁ = w₂ = w₃ = w₄ = 0.25

> **Critical flaw:** Any single pₙ = 0 makes the entire score 0 (geometric mean problem). A single missing 4-gram zeroes out the whole score regardless of how good the rest is.

Use `sacrebleu` for standardised, reproducible computation. BLEU is acceptable for machine translation benchmarks but **not recommended for RAG or open-ended generation**.

---

### ROUGE

ROUGE (Recall-Oriented Understudy for Gisting Evaluation) is recall-oriented — it measures how much of the reference appears in the generated output.

**ROUGE-N** measures n-gram recall:

$$\text{ROUGE-N} = \frac{\sum_{\text{ref}} \sum_{\text{gram}_n} \text{Count}_{\text{match}}(\text{gram}_n)}{\sum_{\text{ref}} \sum_{\text{gram}_n} \text{Count}(\text{gram}_n)}$$

**ROUGE-L** uses Longest Common Subsequence (LCS), capturing word order without requiring consecutive matches:

$$F_{lcs} = \frac{(1 + \beta^2) \cdot P_{lcs} \cdot R_{lcs}}{R_{lcs} + \beta^2 \cdot P_{lcs}}$$

ROUGE-L is preferred over ROUGE-N for summarisation tasks because sentence-level LCS handles paraphrasing better than exact n-gram overlap.

---

### METEOR

METEOR improves on BLEU with three key additions:
1. **Recall weighting**: 9× more weight on recall than precision by default
2. **Synonym matching**: Uses WordNet to count matching synonyms, not just exact tokens
3. **Fragmentation penalty**: `Penalty = γ · (chunks / matched_unigrams)^β` — penalises disjointed matches

Default parameters: α=0.9, β=3.0, γ=0.5.

> **Performance:** Corpus-level correlation with human judgment of **0.964** vs BLEU's 0.817 — a significant improvement.

---

### BERTScore

BERTScore moves beyond surface overlap by using contextual embeddings from pretrained transformers (default: `roberta-large`, layer 17):

$$R_{BERT} = \frac{1}{|x|} \sum_{x_i \in x} \max_{\hat{x}_j \in \hat{x}} \cos(x_i, \hat{x}_j)$$

Token-level greedy matching computes precision, recall, and F1. Optional IDF weighting emphasises rare tokens. With baseline rescaling, scores range approximately 0–1.

> **Known weakness:** Antonyms get high cosine similarity in BERT space. "best" and "worst" are contextually similar to BERT, so BERTScore will not penalise their substitution.

---

## LLM-as-Judge Metrics

### G-Eval

G-Eval (Liu et al., 2023) uses chain-of-thought evaluation with **probability-weighted scoring** rather than parsing a text label:

$$\text{score}_d = \sum_{s=1}^{S} s \cdot p_d(s)$$

Where p_d(s) is the LLM's token probability for score s. This avoids the fragility of text parsing ("7 out of 10" vs "seven/ten") and produces a continuous score.

When token probabilities are unavailable (e.g., GPT-4 API), Monte Carlo sampling with n=20, temperature=2 estimates the distribution.

> **Performance:** Spearman ρ = 0.514 on SummEval — significantly outperforms BLEU, ROUGE, and BERTScore.
> **Known bias:** Tends to favour LLM-generated text over human-written text.

For G-Eval *implementation* inside DeepEval, see [Evaluation Frameworks → DeepEval](./03-evaluation-frameworks.md#deepeval).

---

### LLM Judge Biases

LLM judges introduce systematic biases that must be actively mitigated:

| Bias | Description | Mitigation |
|---|---|---|
| **Position bias** | Arbitrarily favours the first option in pairwise comparison | Randomise order, average both orderings |
| **Length bias** | Rewards verbose answers regardless of factual correctness | Score conciseness explicitly in rubric |
| **Agreeableness bias** | In class-imbalanced settings, over-accepts; True Negative Rate can drop below 25% | Calibrate with known negatives, set explicit rejection criteria |

> **Practical rule:** Never trust a single LLM judge score in isolation. Combine with human spot-checks and statistical controls.

---

## RAG-Specific Metrics (RAGAS)

RAGAS provides four metrics specifically designed to isolate where a RAG pipeline fails — retrieval vs. generation.

> These definitions cover *what each metric measures*. For the RAGAS Collections API and code usage, see [Evaluation Frameworks → RAGAS](./03-evaluation-frameworks.md#ragas).

### Faithfulness

Measures what fraction of claims in the response are supported by retrieved context:

$$\text{Faithfulness} = \frac{|\text{Supported claims}|}{|\text{Total claims}|}$$

Requires **2 LLM calls**: one for claim extraction, one for claim verification. This is the **most expensive RAGAS metric**. Human agreement: ~95% on WikiEval benchmark (lower on real-world data).

### Answer Relevancy

Uses reverse question generation and embedding similarity to check if the response actually addresses the question:

$$\text{Answer Relevancy} = \frac{1}{N} \sum_{i=1}^{N} \cos(E_{g_i}, E_o)$$

Where E_o is the original question embedding and E_{g_i} are embeddings of N questions reverse-engineered from the response (default N=3). Requires 1 LLM call + N+1 embedding calls.

### Context Precision

Measures whether relevant chunks rank higher than irrelevant ones in the retrieved context:

$$\text{Context Precision@K} = \frac{\sum_{k=1}^{K} (\text{Precision@k} \times v_k)}{|\text{Relevant items in top K}|}$$

Where v_k ∈ {0,1} indicates relevance at rank k. An irrelevant chunk at position 1 hurts significantly more than at later positions — which reflects how LLMs actually use context (they're more influenced by early chunks).

### Context Recall

Measures what fraction of reference claims are attributable to the retrieved context:

$$\text{Context Recall} = \frac{|\text{Reference claims supported by context}|}{|\text{Total reference claims}|}$$

Requires a ground-truth reference answer, unlike the other three RAGAS metrics.

> **Evaluator disagreement warning:** A Tweag study (Feb 2025) found substantial score disagreement across evaluator models. GPT-3.5, GPT-4, Claude, and Llama 3 produce meaningfully different scores for identical inputs. Some models (especially Llama 3) fail to respond in the expected JSON format. Human agreement on Context Relevance is only ~70% on WikiEval — lower than Faithfulness.

---

## Inter-Annotator Agreement

When building golden datasets with human annotators, you need to measure how consistently they agree — before trusting the labels.

### Cohen's Kappa (2 raters)

$$\kappa = \frac{p_o - p_e}{1 - p_e}$$

Where p_o = observed agreement, p_e = expected agreement by chance.

| κ range | Interpretation |
|---|---|
| < 0.20 | Slight |
| 0.21–0.40 | Fair |
| 0.41–0.60 | Moderate |
| 0.61–0.80 | Substantial |
| 0.81–1.00 | Almost perfect |

**LLM evaluation rule of thumb:** AI-human agreement with κ > 0.70 indicates trustworthy AI coding; κ < 0.60 signals the prompt needs refinement.

### Fleiss' Kappa (≥2 raters, nominal data)

$$\kappa_F = \frac{\bar{P} - \bar{P}_e}{1 - \bar{P}_e}, \quad \text{where } \bar{P}_e = \sum p_j^2$$

Limitation: requires balanced rating (each item rated by the same number of raters). Use when you have a fixed panel.

### Krippendorff's Alpha (most general)

Uses coincidence matrices: α = 1 − D_o / D_e

- Handles **any number of raters**
- Handles **any data type** (nominal, ordinal, interval, ratio)
- Handles **missing data** gracefully

| α | Reliability |
|---|---|
| ≥ 0.80 | Reliable |
| 0.67–0.79 | Allows tentative conclusions |
| < 0.67 | Data should not be used |

> **Default choice:** When in doubt, use Krippendorff's Alpha — it's the most general and makes the fewest assumptions.

---

## Code Evaluation Metrics

### Pass@K

The unbiased estimator for the probability of generating at least one correct solution in K attempts:

$$\text{pass@k} = 1 - \frac{\binom{n-c}{k}}{\binom{n}{k}}$$

Where n = total generations, c = correct ones, k = the budget you care about.

> **Benchmark:** State-of-the-art models achieve **pass@1 ≈ 0.85+** on HumanEval (164 hand-crafted problems).

Execution-based metrics like Pass@K are strongly preferred over text-matching metrics for code — running the tests is the ground truth.

### CodeBLEU

Combines four equally-weighted components:
1. Standard BLEU (surface overlap)
2. Keyword-weighted BLEU (programming keywords get 5× weight)
3. AST sub-tree matching (structural similarity)
4. Data-flow graph matching (semantic similarity)

Useful when unit tests are **unavailable** — otherwise, prefer execution-based evaluation. CodeBLEU is still inferior to running the code.

---

## Related Topics

- [Foundations](./01-foundations.md) — why these metrics exist and how they fit into golden dataset evaluation
- [Evaluation Frameworks](./03-evaluation-frameworks.md) — framework APIs for computing these metrics (RAGAS, DeepEval, Phoenix, Pydantic AI)
- [Testing & CI/CD](./04-testing-cicd.md) — how metric thresholds become quality gates in CI pipelines
- [Observability & Monitoring](./07-observability-monitoring.md) — tracking metric scores over time in production
