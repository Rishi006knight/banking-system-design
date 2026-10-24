export class KvStoreVisualizer {
  constructor(container) {
    this.container = container;
    this.hitRatioPercent = 88.5;
    this.avgLatencyMs = 0.40;
    this.sparklineSamples = Array(30).fill(0.4);
    this.isMissFlashing = false;
    this.topKeys = [
      { key: 'session:active_user', ttl: 894, type: 'SESSION' },
      { key: 'balance:ACC-0000001', ttl: 54, type: 'BALANCE' },
      { key: 'receipt:TRF-8841', ttl: 86320, type: 'RECEIPT' }
    ];
    setInterval(() => this.tickTtl(), 1000);
    this.render();
  }

  updateMetrics(hitRatio, avgLatencyNanos) {
    if (hitRatio !== undefined) this.hitRatioPercent = parseFloat(hitRatio.toFixed(1));
    if (avgLatencyNanos !== undefined) this.avgLatencyMs = parseFloat((avgLatencyNanos / 1000000).toFixed(2));
    this.render();
  }

  recordRequest(cacheHit, latencyMs) {
    this.sparklineSamples.push(latencyMs);
    if (this.sparklineSamples.length > 30) this.sparklineSamples.shift();
    if (!cacheHit) {
      this.isMissFlashing = true;
      this.render();
      setTimeout(() => {
        this.isMissFlashing = false;
        this.render();
      }, 800);
    } else {
      this.render();
    }
  }

  tickTtl() {
    this.topKeys.forEach(k => {
      if (k.ttl > 0) k.ttl -= 1;
    });
    this.render();
  }

  formatTtl(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  renderSparklineSvg() {
    const w = 140;
    const h = 22;
    const max = Math.max(...this.sparklineSamples, 10);
    const step = w / (this.sparklineSamples.length - 1);
    const points = this.sparklineSamples.map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (h - (v / max) * (h - 4)).toFixed(1);
      return `${x},${y}`;
    }).join(' ');

    return `
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <polyline fill="none" stroke="${this.isMissFlashing ? 'var(--orange)' : 'var(--accent-blue)'}" stroke-width="1.8" points="${points}" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
  }

  render() {
    if (!this.container) return;
    const barColor = this.isMissFlashing ? 'var(--orange)' : 'var(--green)';
    const keysListHtml = this.topKeys.map(k => `
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-family: var(--font-mono); padding: 3px 6px; background: var(--fill-grey); border-radius: 4px; margin-bottom: 3px;">
        <span style="color: var(--navy); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;">${k.key}</span>
        <span style="font-weight: 700; color: ${k.ttl < 60 ? 'var(--red)' : 'var(--green)'};">${this.formatTtl(k.ttl)}</span>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div class="telemetry-card-top">
        <div class="telemetry-title-group">
          <span class="telemetry-status-dot" style="background: ${this.isMissFlashing ? 'var(--orange)' : 'var(--green)'};"></span>
          <span>Performance Cache Tier</span>
        </div>
        <span style="font-size: 10px; font-weight: 700; font-family: var(--font-mono); color: var(--green); background: var(--fill-green); padding: 1px 6px; border-radius: 4px;">
          Sub-ms Speed
        </span>
      </div>
      <div class="telemetry-hero-stat">
        <span class="num-tween" id="hero-kv-hitratio" style="color: ${this.isMissFlashing ? 'var(--orange)' : 'var(--green)'};">${this.hitRatioPercent}%</span>
        <span style="font-size: 12px; font-weight: 600; color: var(--ink-2);">cache hit ·</span>
        <span class="num-tween" id="hero-kv-latency">${this.avgLatencyMs < 1 ? '<0.4 ms' : `${this.avgLatencyMs} ms`}</span>
      </div>
      <div class="telemetry-sub-metrics">
        <span>Real-time balance caching & session acceleration</span>
      </div>
      <!-- Hit Ratio Bar -->
      <div style="margin-bottom: 8px;">
        <div style="height: 7px; background: #e5e9f0; border-radius: 4px; overflow: hidden;">
          <div style="height: 100%; width: ${Math.min(100, this.hitRatioPercent)}%; background: ${barColor}; border-radius: 4px; transition: all 0.3s ease;"></div>
        </div>
      </div>
      <!-- Sparkline row -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase;">Response Time (Last 30):</span>
        ${this.renderSparklineSvg()}
      </div>
      <!-- Top 3 Keys -->
      <div style="margin-top: 4px;">
        <div style="font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 3px;">Active Cache Entries & Expiry:</div>
        ${keysListHtml}
      </div>
    `;
  }
}
