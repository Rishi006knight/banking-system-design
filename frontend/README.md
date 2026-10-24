# Scalable Online Banking System — Web Application

**High-Performance Digital Retail NetBanking & Observability Dashboard**

## Architecture & Technology Stack
- **Pure Vanilla HTML5 + CSS3 + ES Modules** (Zero framework dependencies, Zero build steps).
- **Bundle Size:** < 50 KB total payload.
- **Typography:** `Plus Jakarta Sans` (Banking UI) and `JetBrains Mono` (Financial Data / Reference IDs).
- **Dual-Panel Responsive Layout:** 65% Retail Banking Operations + 35% Live System Observability & Telemetry.

## Running Standalone against API Gateway
The web frontend can be served statically using any HTTP server or deployed directly to edge hosting platforms (Vercel, Netlify, Cloudflare Pages, AWS S3/CloudFront):

```bash
# Set gateway URL in shell or query param:
export GATEWAY_URL="http://localhost:8080"

# Start local static server:
python -m http.server 3000
```
Then open: `http://localhost:3000/?gateway=http://localhost:8080`

## Core Modules
1. `index.html`: Responsive dual-panel interface, brand navigation, banking dashboard tabs, cluster settings drawer, and transaction modals.
2. `app.js`: Main application controller, authenticated session management, live telemetry streaming, and idempotent transfer flows.
3. `components/ring.js`: SVG Consistent Hash Ring with 450-600 virtual nodes and dynamic failover routing pointer.
4. `components/saga.js`: 3-stage 2-Phase Saga distributed transaction coordinator with automated compensating refund visualization.
5. `components/token-bucket.js`: Multi-tier rate limiting monitor displaying sliding token refills and backpressure countdowns.
6. `components/kv-store.js`: Sub-millisecond L1 RAM cache hit-ratio telemetry and TTL expiration tracker.
7. `components/snowflake.js`: 64-bit monotonically ordered transaction reference generator and bitfield breakdown.
8. `components/event-log.js`: Real-time streaming audit and cluster event feed.
