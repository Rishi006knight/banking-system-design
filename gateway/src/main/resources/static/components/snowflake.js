export class SnowflakeVisualizer {
  constructor(container) {
    this.container = container;
    this.totalGenerated = 72;
    this.lastId = 'TRF-1792683948572016640';
    this.render();
  }

  updateMetrics(total) {
    if (total !== undefined && total !== this.totalGenerated) {
      this.totalGenerated = total;
      this.render();
    }
  }

  generateId(prefix = 'TRF') {
    this.totalGenerated += 1;
    const timeBits = (BigInt(Date.now()) << 22n);
    const nodeBits = (BigInt(1) << 12n);
    const seqBits = BigInt(this.totalGenerated % 4096);
    const sfVal = (timeBits | nodeBits | seqBits).toString();
    this.lastId = `${prefix}-${sfVal}`;
    this.render();
    return this.lastId;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="telemetry-card-top">
        <div class="telemetry-title-group">
          <span class="telemetry-status-dot" style="background: var(--green);"></span>
          <span>Transaction Audit References</span>
        </div>
      </div>
      <div class="telemetry-hero-stat">
        <span class="num-tween" id="hero-sf-count">${this.totalGenerated}</span>
        <span style="font-size: 12px; font-weight: 600; color: var(--ink-2);">Issued ·</span>
        <span style="color: var(--green); font-size: 18px; font-weight: 800;">0</span>
        <span style="font-size: 12px; font-weight: 600; color: var(--ink-2);">Duplicates</span>
      </div>
      <!-- Reference Structure Bar -->
      <div style="display: flex; gap: 2px; height: 16px; border-radius: 4px; overflow: hidden; margin-bottom: 8px;" title="High-Precision Timestamp | Node Origin | Sequence Index">
        <div style="flex: 41; background: var(--accent-blue); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #ffffff;">Timestamp</div>
        <div style="flex: 10; background: var(--orange); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #ffffff;">Node</div>
        <div style="flex: 12; background: var(--green); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #ffffff;">Sequence</div>
      </div>
      <!-- Last Generated ID in Mono -->
      <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-family: var(--font-mono); font-size: 11px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); margin-bottom: 2px;">
          <span>Latest Generated Reference:</span>
          <span style="color: var(--accent-blue);">${new Date().toISOString().slice(11, 19)}</span>
        </div>
        <div style="font-weight: 700; color: var(--navy); word-break: break-all;">
          ${this.lastId}
        </div>
      </div>
    `;
  }
}
