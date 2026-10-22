# Scalable Online Banking System — Frontend

**UCS3513 Mini Project 7 · Experiment 7 · System Design Lab**  
Sri Sivasubramaniya Nadar College of Engineering

## Architecture & Technology Stack
- **Pure Vanilla HTML5 + CSS3 + ES Modules** (Zero framework, Zero build steps).
- **Bundle Size:** < 50 KB total payload.
- **Google Fonts:** `Plus Jakarta Sans` (UI) and `JetBrains Mono` (Data / IDs).
- **Dual-Panel Responsive Layout:** 65% Banking Application + 35% Live System Telemetry.

## Running Standalone against API Gateway
The frontend can be hosted statically on Vercel, Netlify, GitHub Pages, or any HTTP server.

```bash
# Set gateway URL in shell or query param:
export GATEWAY_URL="http://localhost:8080"

# Start local static server:
python -m http.server 3000
```
Then visit: `http://localhost:3000/?gateway=http://localhost:8080`

## Components
1. `index.html`: Responsive 2-panel interface, academic SSN header, dashboard tabs, admin drawer.
2. `app.js`: Main controller, polls `/admin/metrics` every 1000ms, tracks token buckets, handles idempotent transfers.
3. `components/ring.js`: SVG Consistent Hash Ring with 450 virtual nodes and dynamic failover migration.
4. `components/saga.js`: 3-dot 2-Phase Saga step visualizer with live SQL/HTTP request one-liners.
5. `components/event-log.js`: Color-coded streaming event log with up to 50 latest cluster events.
