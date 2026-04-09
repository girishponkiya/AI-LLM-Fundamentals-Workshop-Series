# Software Resilience

Defensive programming patterns for LLM API integrations — retries, circuit breakers, and semantic caching.

LLM APIs are notoriously unreliable: high latency, strict rate limits (HTTP 429), and frequent timeouts (HTTP 504) are routine. Your backend must treat LLM calls as calls to an external service with SLO guarantees, not as in-process function calls.

---

## Retries with Exponential Backoff

Never immediately retry a failed LLM request — this hammers the provider and worsens an outage. Use **exponential backoff with jitter**: each retry waits progressively longer, and the jitter component prevents multiple clients from all retrying at the same instant (the "thundering herd" problem).

Python's `tenacity` library is the standard tool:

```python
import logging
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_log
)

logger = logging.getLogger(__name__)

@retry(
    stop=stop_after_attempt(3),               # max 3 attempts
    wait=wait_exponential(multiplier=1, min=4, max=10),  # 4s → 8s → 10s
    retry=retry_if_exception_type((RateLimitError, Timeout)),
    before=before_log(logger, logging.INFO)   # log each attempt
)
def call_llm(prompt: str) -> str:
    return client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    ).choices[0].message.content
```

**Why jitter matters:** Without it, a burst of 100 simultaneous failures all retry at exactly T+4s, creating a second spike that can trigger another round of failures. `wait_exponential` includes jitter by default.

**Recommended parameters for LLM APIs:**
- Attempts: 3 (more than 3 rarely helps; the provider is likely down)
- Min wait: 4s (rate limit windows are typically 1–60s)
- Max wait: 10s (beyond this, consider the circuit breaker instead)
- Retry on: `RateLimitError` (429), `Timeout` (504) — **not** on `InvalidRequest` (400, fix the prompt)

---

## Circuit Breaker Pattern

If a provider suffers a 30-minute outage, continuous retries will exhaust your server's thread pool. The circuit breaker solves this by **failing fast** once it detects a persistent failure pattern.

### State Machine

```
         [5 failures in window]          [request succeeds]
CLOSED ──────────────────────────► OPEN ──────────────────► HALF_OPEN
  ▲                                  │                           │
  │          [recovery_timeout]      │    [request fails]        │
  └──────────────────────────────────┘◄──────────────────────────┘
         label reassigned
```

| State | Behaviour |
|---|---|
| **CLOSED** | Normal operation — requests pass through |
| **OPEN** | Fail fast — reject all outbound LLM requests immediately without calling the API |
| **HALF_OPEN** | Recovery test — let one request through; if it succeeds, return to CLOSED; if it fails, return to OPEN |

### Implementation

```python
from enum import Enum
from dataclasses import dataclass, field
import time

class CircuitState(Enum):
    CLOSED    = "closed"
    OPEN      = "open"
    HALF_OPEN = "half_open"

@dataclass
class CircuitBreaker:
    failure_threshold: int   = 5
    recovery_timeout: float  = 30.0
    _state: CircuitState     = field(default=CircuitState.CLOSED, init=False)
    _failure_count: int      = field(default=0, init=False)
    _last_failure_time: float = field(default=0.0, init=False)

    def call(self, fn, *args, **kwargs):
        if self._state == CircuitState.OPEN:
            if time.time() - self._last_failure_time > self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
            else:
                raise CircuitOpenError("Circuit is OPEN — failing fast")
        try:
            result = fn(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        self._failure_count = 0
        self._state = CircuitState.CLOSED

    def _on_failure(self):
        self._failure_count += 1
        self._last_failure_time = time.time()
        if self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN
```

### Fallback Chain Warning

A common pattern is chaining fallbacks: primary model fails → try secondary model → try cached response. Each fallback looks harmless in isolation, but carries a hidden cost:

> **Each fallback re-executes your entire middleware stack.** Semantic cache lookups, governance rules (budget checks, rate limit accounting), logging, and telemetry all run again for the fallback request. A two-hop fallback chain **doubles your operational overhead** per failed request.

Design fallback chains deliberately. Prefer a single well-chosen fallback over a deep chain.

---

## Semantic Caching

Standard key-value caches fail for LLM applications because `"What is Python?"` and `"What's Python?"` are different strings but semantically identical queries.

**Semantic caching** vectorises the prompt and uses **cosine similarity** to return a cached response for semantically equivalent queries — reducing LLM API calls dramatically.

### How It Works

```
User Query → Embed → Vector → Cosine similarity against cache
                                    │
                         similarity ≥ threshold?
                            /              \
                          YES               NO
                           │                │
                   Return cached       Call LLM → Cache result
                    response           (embed query, store)
```

Tools: **GPTCache**, **Redis** with vector search, **Weaviate**, or any vector store with nearest-neighbour search.

### Threshold Selection

The cosine similarity threshold is the critical parameter:

| Threshold | Problem |
|---|---|
| Too low (e.g. 0.6) | **Cache poisoning** — serves cached responses for semantically different queries |
| Too high (e.g. 0.95) | **Cache misses** — barely any queries hit the cache; expensive LLM calls every time |
| ~**0.8** (recommended) | Balanced — semantically equivalent queries hit; distinct questions miss |

> **Measured impact at 0.8 threshold:** up to **68.8% cost reduction** on production LLM workloads.

### Edge Flip Risk

Vector databases use **Approximate Nearest Neighbour (ANN)** search — not exact nearest neighbour. Queries right on the similarity threshold boundary can "edge flip": the same query intermittently returns different cached responses due to the approximation.

Mitigation: add a small confidence margin. If the top-1 similarity is between 0.78–0.82 (near the threshold), treat it as a cache miss and call the LLM directly rather than risking an inconsistent cached response.

---

## Putting It Together

In a production LLM service, these three patterns layer as follows:

```
Incoming Request
    │
    ▼
[Semantic Cache] ──hit──► Return cached response (fast, free)
    │ miss
    ▼
[Circuit Breaker] ──OPEN──► Fail fast / return degraded response
    │ CLOSED/HALF_OPEN
    ▼
[Retry with backoff] ──success──► Return response + update cache
    │ max attempts exhausted
    ▼
Return error / fallback response
```

---

## Related Topics

- [Guardrails & Safety](./05-guardrails-safety.md) — when guardrail validators trigger failures that need retry or fallback handling
- [Production Infrastructure](./08-production-infrastructure.md) — LiteLLM gateway provides built-in retry, failover, and caching at the proxy layer
- [Observability & Monitoring](./07-observability-monitoring.md) — tracking circuit breaker state transitions, cache hit rates, and retry counts as operational metrics
