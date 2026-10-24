export class TokenBucketVisualizer {
  constructor(container) {
    this.container = container;
    this.buckets = {
      login: { label: 'Login Security', capacity: 5, tokens: 5, rate: '5/min', refillRatePerSec: 5 / 60 },
      transfer: { label: 'Transfer Protection', capacity: 30, tokens: 30, rate: '30/min', refillRatePerSec: 30 / 60 },
      enquiry: { label: 'Account Lookups', capacity: 120, tokens: 120, rate: '120/min', refillRatePerSec: 120 / 60 }
    };
    this.allowedCount = 0;
    this.throttledCount = 0;
    this.retryAfterSec = null;
    this.retryTimer = null;
    this.flashRedKey = null;
    this.lastRefillTime = performance.now();
    this.showExplainer = false;

    // Refill tick runs every 250ms for smooth sliding replenish
    setInterval(() => this.refill(), 250);
    this.render();
  }

  updateMetrics(allowed, throttled) {
    this.allowedCount = allowed ?? this.allowedCount;
    this.throttledCount = throttled ?? this.throttledCount;
    this.render();
  }

  refill() {
    const now = performance.now();
    const elapsedSec = (now - this.lastRefillTime) / 1000;
    this.lastRefillTime = now;
    let changed = false;

    for (const key of Object.keys(this.buckets)) {
      const b = this.buckets[key];
      if (b.tokens < b.capacity) {
        const added = elapsedSec * b.refillRatePerSec;
        b.tokens = Math.min(b.capacity, b.tokens + added);
        changed = true;
      }
    }
    if (changed) this.render();
  }

  /**
   * Tries to consume 1 token. Returns true if allowed, false if throttled.
   */
  tryConsume(type) {
    this.refill();
    const b = this.buckets[type];
    if (!b) return true;

    if (Math.floor(b.tokens) < 1) {
      const retrySec = type === 'login' ? 12 : type === 'transfer' ? 12 : 5;
      this.triggerThrottle(type, retrySec);
      return false;
    }

    b.tokens = Math.max(0, b.tokens - 1);
    this.allowedCount += 1;
    this.render();
    return true;
  }

  consume(type) {
    return this.tryConsume(type);
  }

  triggerThrottle(type, retryAfter = 12) {
    this.throttledCount += 1;
    this.retryAfterSec = retryAfter;
    this.flashRedKey = type;
    this.render();

    clearInterval(this.retryTimer);
    this.retryTimer = setInterval(() => {
      if (this.retryAfterSec > 1) {
        this.retryAfterSec -= 1;
        this.render();
      } else {
        this.retryAfterSec = null;
        this.flashRedKey = null;
        clearInterval(this.retryTimer);
        this.render();
      }
    }, 1000);
  }

  render() {
    if (!this.container) return;

    const barsHtml = Object.entries(this.buckets).map(([key, b]) => {
      const currentInt = Math.floor(b.tokens);
      const pct = Math.round((b.tokens / b.capacity) * 100);
      const isFlashing = this.flashRedKey === key;
      const barColor = isFlashing ? 'var(--red)' : (pct < 30 ? 'var(--orange)' : 'var(--green)');

      return `
        <div style="margin-bottom: 8px; ${isFlashing ? 'animation: pulseRed 0.6s ease infinite;' : ''}">
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-family: var(--font-mono); color: var(--ink-2); margin-bottom: 2px;">
            <span>${b.label} <small style="color: var(--muted);">(${b.rate})</small></span>
            <span style="font-weight: 700; color: ${isFlashing ? 'var(--red)' : 'var(--ink)'};">
              <strong>${currentInt}</strong> / ${b.capacity} quota
            </span>
          </div>
          <div style="height: 7px; background: #e5e9f0; border-radius: 4px; overflow: hidden; border: ${isFlashing ? '1px solid var(--red)' : 'none'};">
            <div style="height: 100%; width: ${pct}%; background: ${barColor}; border-radius: 4px; transition: width 0.25s ease, background 0.2s ease;"></div>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="telemetry-card-top">
        <div class="telemetry-title-group">
          <span class="telemetry-status-dot" style="background: ${this.retryAfterSec ? 'var(--red)' : 'var(--green)'};"></span>
          <span>Security & Rate Shield</span>
        </div>
        ${this.retryAfterSec ? `
          <span style="font-size: 10px; font-weight: 800; font-family: var(--font-mono); color: var(--red); background: var(--fill-red); padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(214,69,69,0.3); animation: pulseRed 1s infinite;">
            Retry In: ${this.retryAfterSec}s
          </span>
        ` : `
          <span style="font-size: 10px; font-weight: 700; font-family: var(--font-mono); color: var(--green); background: var(--fill-green); padding: 1px 6px; border-radius: 4px;">
            Protected
          </span>
        `}
      </div>
      <div class="telemetry-hero-stat">
        <span class="num-tween" id="hero-rl-allowed" style="color: var(--green);">${this.allowedCount}</span>
        <span style="font-size: 12px; font-weight: 600; color: var(--ink-2);">verified ·</span>
        <span class="num-tween" id="hero-rl-throttled" style="color: ${this.throttledCount > 0 ? 'var(--red)' : 'var(--muted)'};">${this.throttledCount}</span>
        <span style="font-size: 12px; font-weight: 600; color: var(--ink-2);">blocked</span>
      </div>
      <div class="telemetry-sub-metrics">
        <span>Adaptive bot protection & brute-force defense</span>
      </div>
      <div>
        ${barsHtml}
      </div>
    `;
  }
}
