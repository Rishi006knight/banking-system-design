export class HashRingVisualizer {
  constructor(container) {
    this.container = container;
    this.activeNode = null;
    this.killedNodes = new Set();
    this.hasFourthShard = false;
    this.arrowAngle = 0;
    this.showArrow = false;
    this.lastRoutedText = null;
    this.render();
  }

  setKilledNodes(killedSet) {
    this.killedNodes = new Set(killedSet);
    if (this.killedNodes.has('8082')) {
      this.lastRoutedText = '<span style="color: var(--orange); font-weight: 700;">Node 2 (:8082) evicted · 150 vnodes rerouted clockwise</span>';
    } else {
      this.lastRoutedText = '<span style="color: var(--green); font-weight: 700;">Node 2 restored · 450 vnodes balanced</span>';
    }
    this.render();
  }

  setFourthShard(enabled) {
    this.hasFourthShard = enabled;
    if (enabled) {
      this.lastRoutedText = '<span style="color: var(--accent-blue); font-weight: 700;">Node 4 registered · 600 vnodes active</span>';
    } else {
      this.lastRoutedText = '<span style="color: var(--ink-2);">Node 4 removed · ring restored to 450 vnodes</span>';
    }
    this.render();
  }

  routeTo(nodeId, key = '', reroutedFrom = null) {
    this.activeNode = nodeId;
    this.showArrow = true;
    let hash = 0x811c9dc5;
    for (let i = 0; i < (key || 'acc').length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    this.arrowAngle = Math.abs(hash) % 360;

    if (reroutedFrom) {
      this.lastRoutedText = `<span style="color: var(--red);">⛔ :${reroutedFrom} down</span> → <span style="color: var(--green); font-weight: 700;">REROUTED to :${nodeId}</span>`;
    } else {
      this.lastRoutedText = `Routed key <span style="font-weight: 700; color: var(--navy);">${key.slice(0, 11)}</span> → ${nodeId}`;
    }

    this.render();

    clearTimeout(this._pulseTimer);
    this._pulseTimer = setTimeout(() => {
      this.activeNode = null;
      this.showArrow = false;
      this.render();
    }, 2500);
  }

  render() {
    if (!this.container) return;
    const w = 260;
    const h = 260;
    const cx = w / 2;
    const cy = h / 2;
    const r = 94;

    const nodeCount = this.hasFourthShard ? 4 : 3;
    const totalVnodes = this.hasFourthShard ? 600 : 450;
    const vnodesPerNode = 150;

    const colors = {
      '8081': '#1f6fd1', // Blue (Node 1)
      '8082': '#e8832a', // Orange (Node 2)
      '8083': '#2e9e5b', // Green (Node 3)
      '8084': '#8b5cf6'  // Purple (Node 4)
    };

    let dotsSvg = '';
    for (let i = 0; i < totalVnodes; i++) {
      const nodeIdx = Math.floor(i / vnodesPerNode);
      const port = `808${nodeIdx + 1}`;
      const isKilled = this.killedNodes.has(port) || this.killedNodes.has(`bank-shard-${nodeIdx}`);
      let angleDeg = (i / totalVnodes) * 360;
      let dotColor = colors[port] || '#1f6fd1';

      if (isKilled) {
        dotColor = '#9aa3b2';
        angleDeg += (nodeIdx % 2 === 0 ? 10 : -10);
      }

      const angleRad = (angleDeg - 90) * (Math.PI / 180);
      const x = (cx + r * Math.cos(angleRad)).toFixed(1);
      const y = (cy + r * Math.sin(angleRad)).toFixed(1);

      const isActive = this.activeNode && (this.activeNode.includes(port) || this.activeNode.includes(`shard-${nodeIdx}`));
      dotsSvg += `<circle cx="${x}" cy="${y}" r="${isActive ? 3.5 : 2}" fill="${dotColor}" opacity="${isKilled ? 0.25 : 0.85}"/>`;
    }

    const arrowRad = (this.arrowAngle - 90) * (Math.PI / 180);
    const arrowX = (cx + (r - 18) * Math.cos(arrowRad)).toFixed(1);
    const arrowY = (cy + (r - 18) * Math.sin(arrowRad)).toFixed(1);

    const activeNodesCount = nodeCount - this.killedNodes.size;
    const statusText = this.lastRoutedText || (this.killedNodes.has('8082')
      ? '<span style="color: var(--orange); font-weight: 700;">Node 2 evicted · 150 vnodes rerouted clockwise</span>'
      : '<span>Deterministic Murmur3 routing active</span>');

    this.container.innerHTML = `
      <div class="telemetry-card-top">
        <div class="telemetry-title-group">
          <span class="telemetry-status-dot" style="background: ${this.killedNodes.size > 0 ? 'var(--orange)' : 'var(--green)'};"></span>
          <span>Consistent Hash Ring</span>
        </div>
        <span style="font-size: 10px; font-weight: 700; font-family: var(--font-mono); color: var(--accent-blue); background: var(--fill-blue); padding: 1px 6px; border-radius: 4px;">
          Murmur3
        </span>
      </div>
      <div class="telemetry-hero-stat">
        <span class="num-tween" id="hero-ring-nodes">${activeNodesCount} / ${nodeCount}</span>
        <span style="font-size: 13px; font-weight: 600; color: var(--ink-2);">nodes</span>
      </div>
      <div class="telemetry-sub-metrics">
        <span>${totalVnodes} vnodes (${activeNodesCount * 150} active) · 0 key drift</span>
      </div>
      <div style="display: flex; justify-content: center; align-items: center; margin: 4px 0;">
        <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e9f0" stroke-width="1.5" stroke-dasharray="3 3" />
          ${dotsSvg}
          <circle cx="${cx}" cy="${cy}" r="12" fill="#ffffff" stroke="#12305f" stroke-width="2" />
          <circle cx="${cx}" cy="${cy}" r="4" fill="#12305f" />
          ${this.showArrow ? `
            <line x1="${cx}" y1="${cy}" x2="${arrowX}" y2="${arrowY}" stroke="#12305f" stroke-width="2" stroke-linecap="round" style="transition: all 400ms ease;" />
            <circle cx="${arrowX}" cy="${arrowY}" r="4" fill="#1f6fd1" />
          ` : ''}
        </svg>
      </div>
      <div style="margin-top: 4px; padding: 4px 8px; border-radius: 4px; font-size: 10.5px; font-family: var(--font-mono); text-align: center; background: var(--fill-grey); border: 1px solid var(--border); min-height: 22px; display: flex; align-items: center; justify-content: center;">
        ${statusText}
      </div>
    `;
  }
}
