
export class HashRingVisualizer {
  constructor(containerElement) {
    this.container = containerElement;
    this.totalVnodes = 450;
    this.activeNode = null;
    this.killedNodes = new Set();
    this.arrowAngle = null;
    this.hasFourthShard = false;
    this.init();
  }
  init() {
    this.render();
  }
  setKilledNodes(killedSet) {
    this.killedNodes = new Set(killedSet);
    this.render();
  }
  setFourthShard(enabled) {
    this.hasFourthShard = enabled;
    this.render();
  }
  routeTo(nodeId, key) {
    this.activeNode = nodeId;
    let hash = 0x811c9dc5;
    for (let i = 0; i < (key || 'default').length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const unsigned = hash >>> 0;
    this.arrowAngle = (unsigned % 360);
    this.render();
    clearTimeout(this._pulseTimer);
    this._pulseTimer = setTimeout(() => {
      this.activeNode = null;
      this.arrowAngle = null;
      this.render();
    }, 1500);
  }
  render() {
    const width = 280;
    const height = 280;
    const cx = width / 2;
    const cy = height / 2;
    const r = 100;
    const dotR = 2.4;
    const nodeColors = {
      '8081': '#1f6fd1',
      '8082': '#e8832a',
      '8083': '#2e9e5b',
      '8084': '#8b5cf6'
    };
    const nodeCount = this.hasFourthShard ? 4 : 3;
    const dotsPerNode = Math.floor(450 / nodeCount);
    const sliceAngle = 360 / nodeCount;
    let dotsHtml = '';
    for (let i = 0; i < 450; i++) {
      const nodeIndex = Math.floor(i / dotsPerNode);
      let assignedPort = '808' + (nodeIndex + 1);
      const isKilled = this.killedNodes.has(assignedPort) || this.killedNodes.has('bank-shard-' + nodeIndex);
      let angleDeg = (i / 450) * 360;
      let color = nodeColors[assignedPort] || '#1f6fd1';
      if (isKilled) {
        color = '#9aa3b2'; // Grey
        angleDeg += (nodeIndex % 2 === 0 ? 8 : -8);
      }
      const angleRad = (angleDeg - 90) * (Math.PI / 180);
      const x = cx + r * Math.cos(angleRad);
      const y = cy + r * Math.sin(angleRad);
      const isActiveNode = this.activeNode && (this.activeNode.includes(assignedPort) || this.activeNode.includes('shard-' + nodeIndex));
      const pulseClass = isActiveNode ? 'vnode-pulse' : '';
      dotsHtml += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${isActiveNode ? dotR + 1 : dotR}" 
        fill="${color}" opacity="${isKilled ? '0.35' : '0.85'}" class="vnode-dot ${pulseClass}" 
        style="transition: all 0.3s ease;" />`;
    }
    let arcsHtml = '';
    const nodeDefs = [
      { id: '8081', name: 'Node 1 (:8081)', color: '#1f6fd1', start: 0, end: sliceAngle },
      { id: '8082', name: 'Node 2 (:8082)', color: '#e8832a', start: sliceAngle, end: sliceAngle * 2 },
      { id: '8083', name: 'Node 3 (:8083)', color: '#2e9e5b', start: sliceAngle * 2, end: sliceAngle * 3 }
    ];
    if (this.hasFourthShard) {
      nodeDefs.push({ id: '8084', name: 'Node 4 (:8084)', color: '#8b5cf6', start: sliceAngle * 3, end: 360 });
    }
    let arrowHtml = '';
    if (this.arrowAngle !== null) {
      const arrowRad = (this.arrowAngle - 90) * (Math.PI / 180);
      const ax = cx + (r - 18) * Math.cos(arrowRad);
      const ay = cy + (r - 18) * Math.sin(arrowRad);
      arrowHtml = `
        <line x1="${cx}" y1="${cy}" x2="${ax.toFixed(2)}" y2="${ay.toFixed(2)}" 
              stroke="#1f6fd1" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3,2" />
        <circle cx="${ax.toFixed(2)}" cy="${ay.toFixed(2)}" r="4.5" fill="#1f6fd1" />
      `;
    }
    const ringSvg = `
      <div class="ring-wrapper" style="text-align: center;">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display: block; margin: 0 auto; overflow: visible;">
          <!-- Center ring glow -->
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f3f4f6" stroke-width="2" />
          <circle cx="${cx}" cy="${cy}" r="28" fill="#e8f0fb" stroke="#1f6fd1" stroke-width="1.5" />
          <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-family="'JetBrains Mono', monospace" font-weight="700" fill="#12305f">
            ${this.activeNode ? 'ROUTING' : '450 VN'}
          </text>
          ${dotsHtml}
          ${arrowHtml}
        </svg>
        <!-- Node Status Legends -->
        <div class="ring-legend" style="display: flex; justify-content: center; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
          ${nodeDefs.map(n => {
            const isDead = this.killedNodes.has(n.id) || this.killedNodes.has('bank-shard-' + (parseInt(n.id) - 8081));
            const isActive = this.activeNode && this.activeNode.includes(n.id);
            return `
              <div class="node-legend-pill ${isActive ? 'active-pulse' : ''}" style="
                display: flex; align-items: center; gap: 5px; font-size: 11px; padding: 3px 8px;
                border-radius: 12px; font-family: 'JetBrains Mono', monospace; font-weight: 600;
                background: ${isDead ? '#fbe7e7' : isActive ? '#e8f0fb' : '#f3f4f6'};
                border: 1px solid ${isDead ? '#d64545' : isActive ? '#1f6fd1' : '#e5e7eb'};
                color: ${isDead ? '#d64545' : '#1f2937'};
                ${isDead ? 'text-decoration: line-through; opacity: 0.75;' : ''}
              ">
                <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${isDead ? '#9aa3b2' : n.color};"></span>
                <span>${n.name}</span>
                ${isDead ? '<span style="font-size: 9px; color: #d64545; font-weight: 800;">[KILLED]</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    this.container.innerHTML = ringSvg;
  }
}
