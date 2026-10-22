
export class SagaVisualizer {
  constructor(containerElement) {
    this.container = containerElement;
    this.shardsData = [
      { id: 'bank-shard-0', name: 'Shard 0 (:8081)', accounts: 140, txCount: 850, active: false },
      { id: 'bank-shard-1', name: 'Shard 1 (:8082)', accounts: 131, txCount: 790, active: false },
      { id: 'bank-shard-2', name: 'Shard 2 (:8083)', accounts: 133, txCount: 820, active: false }
    ];
    this.sagaState = {
      active: false,
      step: 0, // 0: idle, 1: debit pending, 2: credit pending, 3: completed, -1: failed
      sourceShard: 'bank-shard-0',
      destShard: 'bank-shard-1',
      amountInr: 500,
      logs: []
    };
    this.init();
  }
  init() {
    this.render();
  }
  updateShards(shardsObj) {
    if (!shardsObj) return;
    this.shardsData = Object.entries(shardsObj).map(([id, data], idx) => {
      const counts = data.counts || {};
      return {
        id,
        name: `Shard ${idx} (:808${idx + 1})`,
        accounts: counts.accounts || (130 + idx * 5),
        txCount: counts.transactions || (800 + idx * 25),
        active: false
      };
    });
    this.render();
  }
  startSaga(sourceAcc, destAcc, amount, sourceShard = 'bank-shard-0', destShard = 'bank-shard-1') {
    this.sagaState = {
      active: true,
      step: 1,
      sourceShard,
      destShard,
      amountInr: amount,
      logs: [
        {
          step: 1,
          status: 'PENDING',
          text: `[SQL LOCAL] UPDATE accounts SET balance = balance - ${amount} WHERE id = '${sourceAcc}' -- Shard: ${sourceShard}`
        }
      ]
    };
    this.render();
    setTimeout(() => {
      if (!this.sagaState.active) return;
      this.sagaState.step = 2;
      this.sagaState.logs.push({
        step: 2,
        status: 'PENDING',
        text: `[HTTP REMOTE] POST http://localhost:8082/accounts/${destAcc}/credit -- Shard: ${destShard} (+₹${amount})`
      });
      this.render();
      setTimeout(() => {
        if (!this.sagaState.active) return;
        this.sagaState.step = 3;
        this.sagaState.logs.push({
          step: 3,
          status: 'COMPLETED',
          text: `[SAGA COMMIT] Dual-ledger entry written. Status: SAGA_COMPLETED. Both shards committed.`
        });
        this.render();
        setTimeout(() => {
          this.sagaState.active = false;
          this.sagaState.step = 0;
          this.render();
        }, 4500);
      }, 500);
    }, 450);
  }
  failSaga(sourceAcc, destAcc, amount, sourceShard = 'bank-shard-0', destShard = 'bank-shard-1') {
    this.sagaState = {
      active: true,
      step: 1,
      sourceShard,
      destShard,
      amountInr: amount,
      logs: [
        {
          step: 1,
          status: 'PENDING',
          text: `[SQL LOCAL] UPDATE accounts SET balance = balance - ${amount} WHERE id = '${sourceAcc}'`
        }
      ]
    };
    this.render();
    setTimeout(() => {
      this.sagaState.step = -1;
      this.sagaState.logs.push({
        step: 2,
        status: 'FAILED',
        text: `[NETWORK TIMEOUT] Shard ${destShard} unreachable! Triggering Compensating Refund.`
      });
      this.sagaState.logs.push({
        step: 3,
        status: 'ROLLBACK',
        text: `[COMPENSATING REFUND] UPDATE accounts SET balance = balance + ${amount} WHERE id = '${sourceAcc}' -- Zero funds lost.`
      });
      this.render();
      setTimeout(() => {
        this.sagaState.active = false;
        this.sagaState.step = 0;
        this.render();
      }, 6000);
    }, 600);
  }
  render() {
    const { active, step, logs } = this.sagaState;
    let dot1Color = '#9aa3b2';
    let dot1Label = '1. Debit';
    if (step >= 1) dot1Color = '#e8832a'; // Orange
    if (step === 3) dot1Color = '#2e9e5b'; // Green
    let dot2Color = '#9aa3b2';
    let dot2Label = '2. Credit';
    if (step >= 2) dot2Color = '#e8832a'; // Orange
    if (step === 3) dot2Color = '#2e9e5b'; // Green
    if (step === -1) dot2Color = '#d64545'; // Red failure
    let dot3Color = '#9aa3b2';
    let dot3Label = '3. Commit';
    if (step === 3) {
      dot3Color = '#2e9e5b';
      dot3Label = '3. Committed ✓';
    } else if (step === -1) {
      dot3Color = '#d64545';
      dot3Label = '3. Rollback ↺';
    }
    const html = `
      <div class="saga-visualizer-box">
        <!-- 3 Shard Partition Tiles -->
        <div class="shard-tiles-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
          ${this.shardsData.map(s => `
            <div class="shard-tile" style="
              background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px;
              text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 11px;
            ">
              <div style="font-weight: 700; color: #12305f; font-size: 11px;">${s.name}</div>
              <div style="font-size: 16px; font-weight: 800; color: #1f6fd1; margin: 3px 0;">${s.accounts}</div>
              <div style="font-size: 9px; color: #64748b;">accounts</div>
            </div>
          `).join('')}
        </div>
        <!-- 3-Dot Saga Progress Bar -->
        <div class="saga-dots-strip" style="
          background: #f3f4f6; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px;
          display: flex; align-items: center; justify-content: space-between;
        ">
          <!-- Step 1 Dot -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 14px; height: 14px; border-radius: 50%; background: ${dot1Color}; display: inline-block; transition: all 0.3s ease; box-shadow: 0 0 6px ${dot1Color};"></span>
            <span style="font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #1f2937;">${dot1Label}</span>
          </div>
          <div style="flex: 1; height: 2px; background: #e5e7eb; margin: 0 8px;"></div>
          <!-- Step 2 Dot -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 14px; height: 14px; border-radius: 50%; background: ${dot2Color}; display: inline-block; transition: all 0.3s ease; box-shadow: 0 0 6px ${dot2Color};"></span>
            <span style="font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #1f2937;">${dot2Label}</span>
          </div>
          <div style="flex: 1; height: 2px; background: #e5e7eb; margin: 0 8px;"></div>
          <!-- Step 3 Dot -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 14px; height: 14px; border-radius: 50%; background: ${dot3Color}; display: inline-block; transition: all 0.3s ease; box-shadow: 0 0 6px ${dot3Color};"></span>
            <span style="font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #1f2937;">${dot3Label}</span>
          </div>
        </div>
        <!-- SQL / HTTP One-liner Feed -->
        <div class="saga-oneliner-feed" style="
          background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px;
          font-family: 'JetBrains Mono', monospace; font-size: 10px; line-height: 1.4; max-height: 70px; overflow-y: auto;
        ">
          ${logs.length === 0 ? `
            <span style="color: #9aa3b2;">Awaiting cross-shard transfer to trigger 2-Phase Saga...</span>
          ` : logs.map(l => `
            <div style="color: ${l.status === 'COMPLETED' ? '#2e9e5b' : l.status === 'FAILED' || l.status === 'ROLLBACK' ? '#d64545' : '#e8832a'}; margin-bottom: 2px;">
              ${l.text}
            </div>
          `).join('')}
        </div>
      </div>
    `;
    this.container.innerHTML = html;
  }
}
