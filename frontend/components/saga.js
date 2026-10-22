export class SagaVisualizer {
  constructor(container) {
    this.container = container;
    this.shards = [
      { id: 'bank-shard-0', name: 'Shard 0 (:8081)', accounts: 140, activeState: null },
      { id: 'bank-shard-1', name: 'Shard 1 (:8082)', accounts: 131, activeState: null },
      { id: 'bank-shard-2', name: 'Shard 2 (:8083)', accounts: 133, activeState: null }
    ];
    this.activeSagasInFlight = 0;
    this.sagaStep = 0; // 0: idle, 1: debit pending, 2: credit pending, 3: completed, -1: failed
    this.sagaStatusText = 'Idle';
    this.render();
  }

  updateShards(shardsObj) {
    if (!shardsObj) return;
    this.shards = Object.entries(shardsObj).map(([id, data], idx) => {
      const counts = data.counts || {};
      return {
        id,
        name: `Shard ${idx} (:808${idx + 1})`,
        accounts: counts.accounts || (130 + idx * 5),
        activeState: this.shards[idx]?.activeState || null
      };
    });
    this.render();
  }

  startSaga(sourceAcc, destAcc, amount, sourceShard = 0, destShard = 1) {
    this.activeSagasInFlight = 1;
    this.sagaStep = 1;
    this.sagaStatusText = 'DEBIT_PENDING';
    if (this.shards[sourceShard]) this.shards[sourceShard].activeState = 'debit';
    this.render();

    setTimeout(() => {
      this.sagaStep = 2;
      this.sagaStatusText = 'CREDIT_PENDING';
      if (this.shards[destShard]) this.shards[destShard].activeState = 'credit';
      this.render();

      setTimeout(() => {
        this.sagaStep = 3;
        this.sagaStatusText = 'SAGA_COMPLETED';
        this.render();

        setTimeout(() => {
          this.activeSagasInFlight = 0;
          this.sagaStep = 0;
          this.sagaStatusText = 'Idle';
          this.shards.forEach(s => s.activeState = null);
          this.render();
        }, 3000);
      }, 500);
    }, 450);
  }

  failSaga(sourceAcc, destAcc, amount, sourceShard = 0) {
    this.activeSagasInFlight = 1;
    this.sagaStep = -1;
    this.sagaStatusText = 'COMPENSATING_REFUND';
    if (this.shards[sourceShard]) this.shards[sourceShard].activeState = 'refund';
    this.render();

    setTimeout(() => {
      this.activeSagasInFlight = 0;
      this.sagaStep = 0;
      this.sagaStatusText = 'Idle';
      this.shards.forEach(s => s.activeState = null);
      this.render();
    }, 3500);
  }

  render() {
    if (!this.container) return;

    const tilesHtml = this.shards.map((s) => {
      let border = 'var(--border)';
      let bg = 'var(--surface)';
      if (s.activeState === 'debit') { border = 'var(--orange)'; bg = 'var(--fill-orange)'; }
      else if (s.activeState === 'credit') { border = 'var(--accent-blue)'; bg = 'var(--fill-blue)'; }
      else if (s.activeState === 'refund') { border = 'var(--red)'; bg = 'var(--fill-red)'; }

      return `
        <div style="flex: 1; min-width: 0; background: ${bg}; border: 1px solid ${border}; border-radius: 6px; padding: 6px 8px; text-align: center; transition: all 0.3s ease;">
          <div style="font-size: 10px; font-weight: 700; color: var(--navy);">${s.name.split(' ')[0]} ${s.name.split(' ')[1]}</div>
          <div style="font-size: 13px; font-weight: 800; font-family: var(--font-mono); color: var(--ink);">${s.accounts}</div>
          <div style="font-size: 9px; color: var(--muted);">accounts</div>
        </div>
      `;
    }).join('');

    const dot1Color = this.sagaStep >= 1 ? (this.sagaStep === -1 ? 'var(--red)' : 'var(--orange)') : '#cbd5e1';
    const dot2Color = this.sagaStep >= 2 ? 'var(--orange)' : '#cbd5e1';
    const dot3Color = this.sagaStep === 3 ? 'var(--green)' : (this.sagaStep === -1 ? 'var(--red)' : '#cbd5e1');

    this.container.innerHTML = `
      <div class="telemetry-card-top">
        <div class="telemetry-title-group">
          <span class="telemetry-status-dot" style="background: ${this.activeSagasInFlight > 0 ? 'var(--orange)' : 'var(--green)'};"></span>
          <span>Shards & 2-Phase Saga</span>
        </div>
        <span style="font-size: 10px; font-weight: 700; font-family: var(--font-mono); color: var(--orange); background: var(--fill-orange); padding: 1px 6px; border-radius: 4px;">
          ACID + 2PC
        </span>
      </div>
      <div class="telemetry-hero-stat">
        <span class="num-tween" id="hero-shards-count">${this.shards.length}</span>
        <span style="font-size: 12px; font-weight: 600; color: var(--ink-2);">partitions ·</span>
        <span class="num-tween" id="hero-saga-inflight">${this.activeSagasInFlight}</span>
        <span style="font-size: 12px; font-weight: 600; color: var(--ink-2);">sagas in flight</span>
      </div>
      <div class="telemetry-sub-metrics">
        <span>Dual-ledger orchestration · zero financial drift</span>
      </div>
      <div style="display: flex; gap: 6px; margin-bottom: 10px;">
        ${tilesHtml}
      </div>
      <!-- 3-Dot Progression -->
      <div style="display: flex; align-items: center; justify-content: space-between; background: var(--fill-grey); border-radius: 6px; padding: 6px 12px; font-family: var(--font-mono); font-size: 11px;">
        <span style="color: var(--ink-2); font-size: 10px; font-weight: 700;">SAGA:</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${dot1Color}; transition: background 0.3s;"></div>
          <span style="color: var(--muted); font-size: 9px;">→</span>
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${dot2Color}; transition: background 0.3s;"></div>
          <span style="color: var(--muted); font-size: 9px;">→</span>
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${dot3Color}; transition: background 0.3s;"></div>
        </div>
        <span style="font-weight: 700; font-size: 10px; color: ${this.sagaStep === 3 ? 'var(--green)' : this.sagaStep === -1 ? 'var(--red)' : 'var(--orange)'};">
          ${this.sagaStatusText}
        </span>
      </div>
    `;
  }
}
