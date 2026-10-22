export class HashRingVisualizer {
  constructor(container) {
    this.container = container;
    this.activeNode = '8081';
    this.killedNodes = new Set();
    this.hasFourthShard = false;
    this.arrowAngle = 0;
    this.lastRoutedText = null;
    this.render();
  }

  setKilledNodes(killedSet) {
    this.killedNodes = new Set(killedSet);
    this.updateActivePointer();
    this.render();
  }

  setFourthShard(enabled) {
    this.hasFourthShard = enabled;
    this.updateActivePointer();
    this.render();
  }

  getAliveNodes() {
    const all = this.hasFourthShard ? ['8081', '8082', '8083', '8084'] : ['8081', '8082', '8083'];
    return all.filter(port => !this.killedNodes.has(port));
  }

  updateActivePointer() {
    const alive = this.getAliveNodes();
    if (alive.length === 0) {
      this.lastRoutedText = '<span style="color: var(--red); font-weight: 700;">⛔ ALL NODES OFFLINE</span>';
      return;
    }

    // If current activeNode is killed, find clockwise successor among alive nodes
    if (this.killedNodes.has(this.activeNode)) {
      const all = this.hasFourthShard ? ['8081', '8082', '8083', '8084'] : ['8081', '8082', '8083'];
      const deadIdx = all.indexOf(this.activeNode);
      let successor = alive[0];
      for (let i = 1; i < all.length; i++) {
        const next = all[(deadIdx + i) % all.length];
        if (alive.includes(next)) {
          successor = next;
          break;
        }
      }
      const deadPort = this.activeNode;
      this.activeNode = successor;
      this.arrowAngle = this.getNodeBaseAngle(successor);
      this.lastRoutedText = `<span style="color: var(--orange);">Node :${deadPort} removed</span> → <span style="color: var(--green); font-weight: 700;">Pointer rerouted to :${successor}</span>`;
    } else {
      this.arrowAngle = this.getNodeBaseAngle(this.activeNode);
      if (this.killedNodes.size > 0) {
        this.lastRoutedText = `<span>${this.killedNodes.size} node(s) removed · Pointer ──▶ :${this.activeNode}</span>`;
      } else {
        this.lastRoutedText = `<span>Pointer ──▶ Node :${this.activeNode} (${alive.length} active)</span>`;
      }
    }
  }

  getNodeBaseAngle(port) {
    const nodeCount = this.hasFourthShard ? 4 : 3;
    const ports = this.hasFourthShard ? ['8081', '8082', '8083', '8084'] : ['8081', '8082', '8083'];
    const idx = ports.indexOf(String(port));
    if (idx === -1) return 0;
    return (idx / nodeCount) * 360;
  }

  routeTo(nodeId, key = '', reroutedFrom = null) {
    const port = String(nodeId).replace(/\D/g, '') || '8081';
    const alive = this.getAliveNodes();

    if (this.killedNodes.has(port)) {
      // Find clockwise fall-through successor
      const all = this.hasFourthShard ? ['8081', '8082', '8083', '8084'] : ['8081', '8082', '8083'];
      const deadIdx = all.indexOf(port);
      let successor = alive[0] || port;
      for (let i = 1; i < all.length; i++) {
        const candidate = all[(deadIdx + i) % all.length];
        if (alive.includes(candidate)) {
          successor = candidate;
          break;
        }
      }
      this.activeNode = successor;
      this.arrowAngle = this.getNodeBaseAngle(successor);
      this.lastRoutedText = `<span style="color: var(--red);">⛔ :${port} down</span> → <span style="color: var(--green); font-weight: 700;">Pointer REROUTED to :${successor}</span>`;
    } else {
      this.activeNode = port;
      let hash = 0x811c9dc5;
      for (let i = 0; i < (key || 'acc').length; i++) {
        hash ^= key.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      this.arrowAngle = Math.abs(hash) % 360;
      this.lastRoutedText = `Routed key <span style="font-weight: 700; color: var(--navy);">${key.slice(0, 11)}</span> → :${port}`;
    }

    this.render();
  }

  render() {
    if (!this.container) return;
    const w = 260;
    const h = 260;
    const cx = w / 2;
    const cy = h / 2;
    const r = 90;

    const nodeCount = this.hasFourthShard ? 4 : 3;
    const totalVnodes = this.hasFourthShard ? 600 : 450;
    const vnodesPerNode = 150;

    const colors = {
      '8081': '#1f6fd1', // Blue (Node 1)
      '8082': '#e8832a', // Orange (Node 2)
      '8083': '#2e9e5b', // Green (Node 3)
      '8084': '#8b5cf6'  // Purple (Node 4)
    };

    // Virtual Node Dots
    let dotsSvg = '';
    for (let i = 0; i < totalVnodes; i++) {
      const nodeIdx = Math.floor(i / vnodesPerNode);
      const port = `808${nodeIdx + 1}`;
      const isKilled = this.killedNodes.has(port);
      let angleDeg = (i / totalVnodes) * 360;
      let dotColor = colors[port] || '#1f6fd1';

      if (isKilled) {
        dotColor = '#cbd5e1';
      }

      const angleRad = (angleDeg - 90) * (Math.PI / 180);
      const x = (cx + r * Math.cos(angleRad)).toFixed(1);
      const y = (cy + r * Math.sin(angleRad)).toFixed(1);

      const isActivePort = (this.activeNode === port);
      dotsSvg += `<circle cx="${x}" cy="${y}" r="${isActivePort ? 2.8 : 1.8}" fill="${dotColor}" opacity="${isKilled ? 0.2 : 0.85}"/>`;
    }

    // Physical Node Perimeter Badges / Markers
    const allPorts = this.hasFourthShard ? ['8081', '8082', '8083', '8084'] : ['8081', '8082', '8083'];
    let nodeLabelsSvg = '';
    allPorts.forEach((port, idx) => {
      const angleDeg = (idx / nodeCount) * 360;
      const angleRad = (angleDeg - 90) * (Math.PI / 180);
      const labelR = r + 18;
      const lx = cx + labelR * Math.cos(angleRad);
      const ly = cy + labelR * Math.sin(angleRad);
      const isDead = this.killedNodes.has(port);
      const color = colors[port] || '#1f6fd1';

      nodeLabelsSvg += `
        <g transform="translate(${lx}, ${ly})">
          <circle cx="0" cy="0" r="10" fill="${isDead ? 'var(--fill-red)' : '#ffffff'}" stroke="${isDead ? 'var(--red)' : color}" stroke-width="${isDead ? 1 : 1.8}" />
          <text x="0" y="3.5" text-anchor="middle" font-size="8.5" font-weight="800" font-family="var(--font-mono)" fill="${isDead ? 'var(--red)' : color}">
            ${isDead ? '✕' : `N${idx + 1}`}
          </text>
        </g>
      `;
    });

    // POINTER NEEDLE & RADAR BEACON (Always visible for ANY number of nodes)
    const pointerRad = (this.arrowAngle - 90) * (Math.PI / 180);
    const arrowX = cx + (r - 12) * Math.cos(pointerRad);
    const arrowY = cy + (r - 12) * Math.sin(pointerRad);
    const activeColor = colors[this.activeNode] || '#12305f';

    const activeNodesCount = nodeCount - this.killedNodes.size;
    const statusText = this.lastRoutedText || `<span>Pointer ──▶ Node :${this.activeNode} (${activeNodesCount}/${nodeCount} active)</span>`;

    this.container.innerHTML = `
      <div class="telemetry-card-top">
        <div class="telemetry-title-group">
          <span class="telemetry-status-dot" style="background: ${this.killedNodes.size > 0 ? (activeNodesCount === 0 ? 'var(--red)' : 'var(--orange)') : 'var(--green)'};"></span>
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
      <div style="display: flex; justify-content: center; align-items: center; margin: 2px 0;">
        <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e9f0" stroke-width="1.5" stroke-dasharray="3 3" />
          ${dotsSvg}
          ${nodeLabelsSvg}
          <!-- Pointer Needle (Always Visible) -->
          <line x1="${cx}" y1="${cy}" x2="${arrowX.toFixed(1)}" y2="${arrowY.toFixed(1)}"
                stroke="${activeColor}" stroke-width="2.2" stroke-linecap="round"
                style="transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);" />
          <!-- Pointer Tip Beacon -->
          <circle cx="${arrowX.toFixed(1)}" cy="${arrowY.toFixed(1)}" r="5"
                  fill="${activeColor}" stroke="#ffffff" stroke-width="1.5"
                  style="transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 6px ${activeColor};" />
          <!-- Compass Center Hub -->
          <circle cx="${cx}" cy="${cy}" r="12" fill="#ffffff" stroke="#12305f" stroke-width="2" />
          <circle cx="${cx}" cy="${cy}" r="4.5" fill="${activeColor}" style="transition: fill 0.3s;" />
        </svg>
      </div>
      <div style="margin-top: 4px; padding: 5px 8px; border-radius: 5px; font-size: 10.5px; font-family: var(--font-mono); text-align: center; background: var(--fill-grey); border: 1px solid var(--border); min-height: 24px; display: flex; align-items: center; justify-content: center;">
        ${statusText}
      </div>
    `;
  }
}
