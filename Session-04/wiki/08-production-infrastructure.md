# Production Infrastructure

The complete self-hosted stack for running LLM applications in production — gateway, tracing, metrics, experiment tracking, air-gapped deployment, and compliance.

---

## The Complete Self-Hosted Stack

This diagram is the authoritative reference for how all components connect:

```
┌─────────────────────────────────────────────────────────────┐
│                      LLM Application                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ OpenAI-compatible API calls
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    LiteLLM Proxy                            │
│   (load balancing, failover, virtual keys, caching)        │
└────────┬───────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
  [LLM Providers]                [Local vLLM / Ollama]
  OpenAI, Anthropic,             (air-gapped inference)
  Google, Azure, etc.
         │
         │ success_callback: langfuse
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Langfuse (v3)                             │
│   Web API → Redis/BullMQ → Worker → ClickHouse             │
│                                   → PostgreSQL             │
│                                   → S3/MinIO               │
└──────────────────────────┬──────────────────────────────────┘
                           │ Custom exporter (see note)
                           ▼
┌──────────────────────────────────────┐
│           Prometheus                 │◄── Application metrics
└──────────────────────────┬───────────┘    (prometheus_client)
                           ▼
┌──────────────────────────────────────┐
│     Grafana (dashboards + alerts)    │
└──────────────────────────────────────┘
         │
         ▼
  [Evidently AI]          [MLflow]
  (batch drift detection)  (experiment tracking)
```

Each component is independently deployable and replaceable. The stack is fully open-source and can run in air-gapped environments.

---

## LiteLLM Gateway

LiteLLM is an OpenAI-compatible proxy that unifies 100+ LLM providers behind a single API endpoint. Your application calls LiteLLM; LiteLLM routes to the right provider.

**Key capabilities:**
- **Throughput:** 1,500+ requests/second
- **Load balancing** across multiple deployments of the same model
- **Automatic failover** to backup models
- **Per-user virtual keys** with individual rate limits and budget caps
- **Response caching** (exact-match and semantic)

### Load Balancing Strategies

| Strategy | Best for |
|---|---|
| `simple-shuffle` | Distributing load evenly across identical replicas |
| `least-busy` | Routing to the replica with fewest in-flight requests |
| `latency-based-routing` | Routing to the replica with lowest recent P50 latency |

### Configuration Example

```yaml
# config.yaml
model_list:
  - model_name: gpt-4o              # name your application uses
    litellm_params:
      model: azure/gpt-4o-eu        # actual provider model
      api_base: https://my-endpoint.openai.azure.com/
      api_key: "os.environ/AZURE_API_KEY"

  - model_name: gpt-4o              # second deployment of same logical model
    litellm_params:
      model: openai/gpt-4o          # fallback to direct OpenAI
      api_key: "os.environ/OPENAI_API_KEY"

  - model_name: local-llama
    litellm_params:
      model: ollama/llama3.3
      api_base: http://localhost:11434

litellm_settings:
  success_callback: ["langfuse"]   # auto-send traces to Langfuse
  num_retries: 3

router_settings:
  routing_strategy: latency-based-routing
  fallbacks: [{"gpt-4o": ["local-llama"]}]   # fallback chain
```

Start: `litellm --config config.yaml --port 4000`

> For the resilience patterns (retries, circuit breakers) that LiteLLM implements internally, see [Software Resilience](./06-software-resilience.md).

---

## Langfuse Deployment {#langfuse-deployment}

> This section covers Langfuse *deployment and ops*. For Langfuse's observability features (tracing, prompt versioning, scoring), see [Observability & Monitoring → Langfuse](./07-observability-monitoring.md#langfuse-v3).

### Self-Hosted Setup

```bash
git clone https://github.com/langfuse/langfuse.git && cd langfuse
# Edit docker-compose.yml — update all values marked CHANGEME
docker compose up
```

Required services: `langfuse-web`, `langfuse-worker`, PostgreSQL, ClickHouse, Redis/Valkey, MinIO/S3.

**Minimum hardware:** 4 cores, 16 GiB RAM, 100 GiB storage.

### Pricing Tiers (Cloud)

| Plan | Price | Included units | Data retention |
|---|---|---|---|
| **Hobby** | Free | 50k/month | 30 days |
| **Core** | $29/mo | 100k/month | 90 days |
| **Pro** | $199/mo | 100k/month | 3 years |
| **Enterprise** | $2,499/mo | 100k/month | 3 years |

**Units** = Traces + Observations + Scores. Overages: $8 per additional 100k units (Core/Pro).

Self-hosted core is **MIT-licensed** with no usage limits. Enterprise features (SSO, SCIM, protected prompts, audit log export) require a **$500/month license key** even on self-hosted.

### Prometheus Integration

> **Langfuse does not natively export Prometheus metrics** (GitHub issue #2508, open as of March 2026).

Workaround options:
1. **Custom exporter:** Build a service that polls the Langfuse Metrics API on a schedule and translates results into Prometheus counters/histograms
2. **Direct instrumentation:** Use `prometheus_client` in your application alongside the Langfuse SDK — instrument the LLM calls in both systems independently

```python
from prometheus_client import Counter, Histogram
import time

llm_requests = Counter('llm_requests_total', 'Total LLM requests', ['model', 'status'])
llm_latency  = Histogram('llm_request_duration_seconds', 'LLM request latency', ['model'])

with llm_latency.labels(model='gpt-4o').time():
    response = call_llm(prompt)
    langfuse.score(trace_id=..., name='latency', value=elapsed)

llm_requests.labels(model='gpt-4o', status='success').inc()
```

---

## MLflow for Experiment Tracking

MLflow provides experiment tracking specifically designed for LLM development — comparing prompt versions, model upgrades, and RAG configurations.

```python
import mlflow

mlflow.openai.autolog()   # auto-traces all OpenAI calls

with mlflow.start_run(run_name="prompt-v3-gpt4o"):
    results = mlflow.genai.evaluate(
        model=my_rag_agent,
        data=eval_dataset,
        scorers=[
            mlflow.genai.Correctness(),
            mlflow.genai.Guidelines(guidelines="Response must be concise")
        ]
    )
    mlflow.log_metric("faithfulness_mean", results.faithfulness.mean())
```

`mlflow-tracing` is optimised for production with async logging — it doesn't block the request path.

**When to use MLflow vs Langfuse:**
- **MLflow:** Experiment tracking, comparing eval runs across prompt/model versions, integrates well with existing ML pipelines
- **Langfuse:** Production tracing, real-time cost tracking, prompt versioning with instant rollback, human annotation queues

Both can run simultaneously — MLflow for experiments, Langfuse for production.

---

## Air-Gapped Deployment

For regulated industries (government, healthcare, finance) where no data can leave the network.

### Requirements

| Component | Air-Gapped Solution |
|---|---|
| LLM inference | vLLM or Ollama with pre-downloaded model weights stored in MinIO |
| Tracing | Langfuse self-hosted with `LANGFUSE_TELEMETRY_ENABLED=false` |
| Drift detection | Evidently AI (pure Python, no external calls) |
| Evaluation judge | Local LLM-as-judge (Llama 3.3, Qwen, etc.) via vLLM |
| Model weights | Transfer via physical media; store in MinIO; never pull from internet at runtime |

### Kubernetes Support

Kubernetes v1.36+ includes enhanced air-gapped AI workload support. NVIDIA NIM provides local model repositories — a curated catalogue of optimised models that can be deployed in air-gapped Kubernetes clusters.

### Deployment Checklist

```
[ ] All container images pulled and pushed to internal registry
[ ] Model weights downloaded and stored in MinIO (not pulled at runtime)
[ ] Langfuse telemetry disabled (LANGFUSE_TELEMETRY_ENABLED=false)
[ ] LiteLLM configured to point to local vLLM endpoints only
[ ] Evidently AI running entirely offline (no cloud API calls)
[ ] Local judge model configured (no OpenAI/Anthropic API calls for evaluation)
[ ] Network egress rules verified — no outbound connections to external APIs
```

---

## Compliance & Audit Trails

### Certifications

| Platform | Certifications |
|---|---|
| **Langfuse** (self-hosted) | ISO 27001 + SOC 2 |
| **Arize Phoenix** v2.5.0 | SOC 2 + HIPAA-compliant air-gapped |

### What to Log

Every interaction in a regulated environment must be logged locally with:
- Full prompt (including system prompt and context)
- Full model output
- Model version and provider
- Timestamp and user/session identifier
- Any guardrail decisions (triggered, action taken)
- Cost and token counts

Langfuse captures all of this automatically via the `@observe()` decorator. The `DiskCacheBackend` or a local PostgreSQL store provides durable, queryable audit records.

> **Minimum retention:** Check your regulatory requirements. HIPAA requires 6 years; PCI-DSS requires 12 months minimum. Langfuse Pro/Enterprise provides 3-year retention; self-hosted has no limit.

---

## Related Topics

- [Software Resilience](./06-software-resilience.md) — retry and circuit breaker patterns that LiteLLM implements at the proxy layer
- [Observability & Monitoring](./07-observability-monitoring.md) — what to instrument, Langfuse features, drift detection, and alerting
- [Guardrails & Safety](./05-guardrails-safety.md) — NeMo Guardrails and hallucination detection deployable as sidecars in this stack
- [Testing & CI/CD](./04-testing-cicd.md) — Promptfoo and DeepEval that plug into this infrastructure during development
