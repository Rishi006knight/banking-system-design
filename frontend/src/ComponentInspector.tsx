import React, { useState, useEffect } from 'react';
import { emitTelemetry } from './api';
import type { SystemMetrics } from './types';

interface ComponentInspectorProps {
  initialComponentId?: number;
  onClose?: () => void;
  systemMetrics: SystemMetrics | null;
}

export const ComponentInspector: React.FC<ComponentInspectorProps> = ({
  initialComponentId = 1,
  onClose,
  systemMetrics
}) => {
  const [activeComp, setActiveComp] = useState<number>(initialComponentId);

  useEffect(() => {
    if (initialComponentId) {
      setActiveComp(initialComponentId);
    }
  }, [initialComponentId]);

  // ==========================================
  // COMPONENT 1: Consistent Hash Ring State
  // ==========================================
  const [testAccount, setTestAccount] = useState('ACC-0000001');
  const [hashResult, setHashResult] = useState<{
    hashHex: string;
    hashVal: number;
    angleDeg: number;
    assignedNode: string;
    port: number;
    shardId: string;
    dbFile: string;
  } | null>(null);

  // Deterministic 32-bit Murmur3-like hash function for the demo simulation
  const simulateMurmur3 = (key: string) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const unsigned = hash >>> 0;
    const angle = ((unsigned % 36000) / 100).toFixed(1);
    
    // Virtual node distribution: 3 physical nodes across 450 virtual slots
    let nodeIndex = 0;
    const norm = parseFloat(angle);
    if (norm < 120) {
      nodeIndex = 0; // Node 1
    } else if (norm < 240) {
      nodeIndex = 1; // Node 2
    } else {
      nodeIndex = 2; // Node 3
    }

    const res = {
      hashHex: '0x' + unsigned.toString(16).toUpperCase(),
      hashVal: unsigned,
      angleDeg: parseFloat(angle),
      assignedNode: `Node ${nodeIndex + 1}`,
      port: 8081 + nodeIndex,
      shardId: `bank-shard-${nodeIndex}`,
      dbFile: `bank-shard-${nodeIndex}.db`
    };

    setHashResult(res);

    emitTelemetry({
      id: 'hash-test-' + Date.now(),
      timestamp: Date.now(),
      action: 'CONSISTENT_HASH_ROUTE',
      status: 200,
      latencyMs: 1,
      node: `node-${res.port}`,
      shard: res.shardId,
      details: `Consistent Hash: Key '${key}' (Hash ${res.hashHex}, ${res.angleDeg}°) mapped to ${res.assignedNode} (: ${res.port})`
    });
  };

  // ==========================================
  // COMPONENT 2: Token Bucket Rate Limiter State
  // ==========================================
  const MAX_AUTH_TOKENS = 5;
  const [tokens, setTokens] = useState(5);
  const [burstLogs, setBurstLogs] = useState<Array<{ id: number; status: 'ALLOWED' | 'BLOCKED'; time: string; msg: string }>>([]);
  const [refilling, setRefilling] = useState(false);

  const sendSingleRateLimitRequest = () => {
    const nowStr = new Date().toLocaleTimeString();
    if (tokens > 0) {
      const nextTokens = tokens - 1;
      setTokens(nextTokens);
      setBurstLogs((prev) => [
        {
          id: Date.now() + Math.random(),
          status: 'ALLOWED',
          time: nowStr,
          msg: `HTTP 200 OK — Token consumed (Remaining: ${nextTokens}/${MAX_AUTH_TOKENS})`
        },
        ...prev.slice(0, 7)
      ]);

      emitTelemetry({
        id: 'rl-allow-' + Date.now(),
        timestamp: Date.now(),
        action: 'RATE_LIMIT_PASS',
        status: 200,
        latencyMs: 1,
        node: 'gateway-8080',
        shard: 'token-bucket',
        details: `Token Bucket: Allowed authentication request. Tokens remaining: ${nextTokens}/${MAX_AUTH_TOKENS}`
      });
    } else {
      setBurstLogs((prev) => [
        {
          id: Date.now() + Math.random(),
          status: 'BLOCKED',
          time: nowStr,
          msg: `HTTP 429 TOO MANY REQUESTS — Token bucket empty! Throttled to prevent credential stuffing.`
        },
        ...prev.slice(0, 7)
      ]);

      emitTelemetry({
        id: 'rl-block-' + Date.now(),
        timestamp: Date.now(),
        action: 'RATE_LIMIT_DROP',
        status: 429,
        latencyMs: 0,
        node: 'gateway-8080',
        shard: 'token-bucket',
        details: `Token Bucket: ⛔ HTTP 429 DROPPED! Rate limit reached (5 req/min threshold). Protected against bot spam.`
      });
    }
  };

  const simulateRapidBurst = () => {
    let currentTokens = tokens;
    const newLogs: typeof burstLogs = [];
    const baseTime = Date.now();

    for (let i = 1; i <= 6; i++) {
      const timeStr = new Date(baseTime + i * 80).toLocaleTimeString();
      if (currentTokens > 0) {
        currentTokens--;
        newLogs.push({
          id: baseTime + i,
          status: 'ALLOWED',
          time: timeStr,
          msg: `Req #${i}: HTTP 200 OK (Tokens left: ${currentTokens})`
        });
      } else {
        newLogs.push({
          id: baseTime + i,
          status: 'BLOCKED',
          time: timeStr,
          msg: `Req #${i}: ⛔ HTTP 429 THROTTLED (Burst capacity exhausted)`
        });
      }
    }

    setTokens(currentTokens);
    setBurstLogs((prev) => [...newLogs.reverse(), ...prev.slice(0, 6)]);

    emitTelemetry({
      id: 'burst-' + Date.now(),
      timestamp: Date.now(),
      action: 'BURST_ATTACK_SIM',
      status: 429,
      latencyMs: 2,
      node: 'gateway-8080',
      shard: 'token-bucket',
      details: `Simulated rapid burst of 6 login attempts: ${MAX_AUTH_TOKENS - currentTokens} allowed, ${6 - (MAX_AUTH_TOKENS - currentTokens)} blocked with HTTP 429`
    });
  };

  const refillTokens = () => {
    setRefilling(true);
    setTimeout(() => {
      setTokens(MAX_AUTH_TOKENS);
      setRefilling(false);
      emitTelemetry({
        id: 'refill-' + Date.now(),
        timestamp: Date.now(),
        action: 'TOKEN_BUCKET_REFILL',
        status: 200,
        latencyMs: 1,
        node: 'gateway-8080',
        shard: 'token-bucket',
        details: `Token Bucket refilled back to capacity: 5/5 tokens restored.`
      });
    }, 600);
  };

  // ==========================================
  // COMPONENT 3: Database Shards & Saga State
  // ==========================================
  const [sagaMode, setSagaMode] = useState<'success' | 'failure'>('success');
  const [sagaExecuting, setSagaExecuting] = useState(false);
  const [sagaSteps, setSagaSteps] = useState<Array<{ step: string; status: 'pending' | 'success' | 'failed' | 'rollback'; desc: string }>>([]);

  const executeSagaSimulation = () => {
    setSagaExecuting(true);
    setSagaSteps([
      { step: '1. Hash Ring Resolution', status: 'pending', desc: 'Determining physical shards for Sender and Receiver...' }
    ]);

    setTimeout(() => {
      setSagaSteps([
        { step: '1. Hash Ring Resolution', status: 'success', desc: 'Origin: ACC-0000001 (Shard 0 on Node 1) ➔ Target: ACC-0000002 (Shard 1 on Node 2). Cross-shard transaction confirmed.' },
        { step: '2. Phase 1 - Local Debit', status: 'pending', desc: 'Executing local ACID debit on Node 1 (bank-shard-0.db)...' }
      ]);

      setTimeout(() => {
        setSagaSteps((prev) => [
          prev[0],
          { step: '2. Phase 1 - Local Debit', status: 'success', desc: 'Local Debit ₹5,000 committed on bank-shard-0.db with row lock. Funds safely deducted.' },
          { step: '3. Phase 2 - Remote Credit', status: 'pending', desc: 'Dispatching cross-node credit to Node 2 (:8082)...' }
        ]);

        setTimeout(() => {
          if (sagaMode === 'success') {
            setSagaSteps((prev) => [
              prev[0],
              prev[1],
              { step: '3. Phase 2 - Remote Credit', status: 'success', desc: 'Node 2 confirmed credit of ₹5,000 on bank-shard-1.db.' },
              { step: '4. Saga Completion', status: 'success', desc: 'COMMITTED: Distributed 2-Phase Saga completed with dual ledger entries! No single point of failure.' }
            ]);
            setSagaExecuting(false);

            emitTelemetry({
              id: 'saga-ok-' + Date.now(),
              timestamp: Date.now(),
              action: 'SAGA_2PC_COMMITTED',
              status: 200,
              latencyMs: 14,
              node: 'node-8081 ➔ node-8082',
              shard: 'shard-0 ➔ shard-1',
              details: `2-Phase Saga SUCCESS: ₹5,000 transferred cross-shard from ACC-0000001 (Node 1) to ACC-0000002 (Node 2)`
            });
          } else {
            // Failure with Compensating Transaction
            setSagaSteps((prev) => [
              prev[0],
              prev[1],
              { step: '3. Phase 2 - Remote Credit', status: 'failed', desc: 'SIMULATED TIMEOUT: Node 2 was unreachable or rejected credit!' },
              { step: '4. Compensating Rollback', status: 'rollback', desc: 'SAGA COMPENSATING ACTION TRIGGERED: Re-crediting ₹5,000 back to Shard 0. Customer balance fully restored with 0 loss!' }
            ]);
            setSagaExecuting(false);

            emitTelemetry({
              id: 'saga-fail-' + Date.now(),
              timestamp: Date.now(),
              action: 'SAGA_COMPENSATING_ROLLBACK',
              status: 500,
              latencyMs: 22,
              node: 'node-8081',
              shard: 'shard-0',
              details: `Saga Compensation: Remote credit on Node 2 failed. Automated rollback refunded ₹5,000 to Shard 0. Financial ACID consistency preserved.`
            });
          }
        }, 1000);
      }, 900);
    }, 800);
  };

  // ==========================================
  // COMPONENT 4: In-Memory Key-Value Cache State
  // ==========================================
  const [cacheScenario, setCacheScenario] = useState<{
    type: 'cold' | 'hot' | 'evicted';
    latency: number;
    hit: boolean;
    storage: string;
    details: string;
  } | null>(null);

  const simulateCacheRead = (type: 'cold' | 'hot') => {
    if (type === 'cold') {
      const res = {
        type: 'cold' as const,
        latency: 14.8,
        hit: false,
        storage: 'SQLite Disk I/O (bank-shard-0.db)',
        details: 'Cache Miss! Gateway queried physical SQLite database via JDBC. Latency: 14.8ms. Result stored in L1 cache with 60s TTL.'
      };
      setCacheScenario(res);
      emitTelemetry({
        id: 'cache-cold-' + Date.now(),
        timestamp: Date.now(),
        action: 'CACHE_MISS_DISK_READ',
        status: 200,
        latencyMs: 15,
        node: 'node-8081',
        shard: 'bank-shard-0',
        cacheHit: false,
        details: 'L1 Cache Miss: Queried SQLite disk table `accounts`. Stored entry in memory with 60s TTL.'
      });
    } else {
      const res = {
        type: 'hot' as const,
        latency: 0.3,
        hit: true,
        storage: 'L1 RAM (ConcurrentHashMap KV Store)',
        details: 'Cache Hit! Returned balance directly from RAM in 0.3ms (50x faster than disk). 0 disk I/O operations triggered.'
      };
      setCacheScenario(res);
      emitTelemetry({
        id: 'cache-hot-' + Date.now(),
        timestamp: Date.now(),
        action: 'CACHE_HIT_RAM_READ',
        status: 200,
        latencyMs: 0.3,
        node: 'node-8081',
        shard: 'in-memory-kv',
        cacheHit: true,
        details: 'L1 Cache Hit: Resolved balance from RAM in 0.3ms. Zero disk read latency.'
      });
    }
  };

  const simulateCacheEviction = () => {
    const res = {
      type: 'evicted' as const,
      latency: 0.1,
      hit: false,
      storage: 'Cache Invalidation Event',
      details: "Transfer executed: Key 'bal:ACC-0000001' instantly purged from KV store. Subsequent read will fetch fresh balance."
    };
    setCacheScenario(res);
    emitTelemetry({
      id: 'cache-evict-' + Date.now(),
      timestamp: Date.now(),
      action: 'CACHE_PURGE_INVALIDATE',
      status: 200,
      latencyMs: 0.1,
      node: 'node-8081',
      shard: 'in-memory-kv',
      details: "Write-through invalidation: Cleared stale balance cache for ACC-0000001 after transfer."
    });
  };

  // ==========================================
  // COMPONENT 5: Distributed Snowflake ID State
  // ==========================================
  const [selectedSnowflakeNode, setSelectedSnowflakeNode] = useState<number>(2);
  const [generatedId, setGeneratedId] = useState<{
    rawId: string;
    timestampMs: number;
    nodeId: number;
    sequence: number;
    binaryString: string;
  } | null>(null);

  const generateSnowflake = () => {
    const now = Date.now();
    const epoch = 1704067200000; // Custom epoch: 2024-01-01
    const timeDelta = now - epoch;
    const seq = Math.floor(Math.random() * 20) + 1;
    const nodeId = selectedSnowflakeNode;

    // Simulate 64-bit BigInt composition
    const rawNumber = (BigInt(timeDelta) << 22n) | (BigInt(nodeId) << 12n) | BigInt(seq);
    const binStr = rawNumber.toString(2).padStart(64, '0');

    const result = {
      rawId: `TRF-${rawNumber.toString()}`,
      timestampMs: now,
      nodeId: nodeId,
      sequence: seq,
      binaryString: binStr
    };

    setGeneratedId(result);

    emitTelemetry({
      id: 'snowflake-' + Date.now(),
      timestamp: Date.now(),
      action: 'SNOWFLAKE_ID_GEN',
      status: 200,
      latencyMs: 0.2,
      node: `node-808${nodeId}`,
      shard: 'id-generator',
      details: `Generated 64-bit Snowflake ID: ${result.rawId} on Node ${nodeId} (Seq: #${seq}, coordination-free)`
    });
  };

  return (
    <div className="component-inspector-container">
      {/* Inspector Header */}
      <div className="inspector-header">
        <div className="inspector-title">
          <span className="inspector-icon">⚙️</span>
          <div>
            <h3>Distributed Architecture Console</h3>
            <div className="inspector-sub">Interactive Infrastructure Mechanics & Live Telemetry</div>
          </div>
        </div>

        {onClose && (
          <button className="inspector-close-btn" onClick={onClose} title="Close Inspector">
            ✕
          </button>
        )}
      </div>

      {/* Component Navigation Tabs */}
      <div className="inspector-tabs-row">
        {[
          { id: 1, label: 'Hash Ring Router', icon: '🌐' },
          { id: 2, label: 'Security & Rate Shield', icon: '🛡️' },
          { id: 3, label: 'Distributed Database', icon: '🔄' },
          { id: 4, label: 'Performance Cache', icon: '⚡' },
          { id: 5, label: 'Reference Engine', icon: '🆔' }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`inspector-tab-btn ${activeComp === tab.id ? 'active' : ''}`}
            onClick={() => setActiveComp(tab.id)}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* COMPONENT 1: CONSISTENT HASH RING                              */}
      {/* ============================================================== */}
      {activeComp === 1 && (
        <div className="inspector-content-panel">
          <div className="comp-summary-card">
            <h4>🌐 Component 1: Consistent Hash Ring (Murmur3 Routing)</h4>
            <div className="comp-badge-pill">Role: High-Performance Request Routing & Zero-Downtime Partitioning</div>
            <p className="comp-desc">
              <strong>What it does:</strong> In modern commercial banking, data cannot live in a single bottleneck database.
              Consistent Hashing maps incoming account IDs (e.g. <code>ACC-0000001</code>) across <strong>450 virtual ring slots</strong> (150 per node).
              Instead of naive modulo division (<code>account % N</code>), which breaks and reshuffles 99% of data when servers change, Consistent Hashing guarantees
              that adding or losing a node only remaps <strong>1/N</strong> of accounts.
            </p>
          </div>

          <div className="simulator-box">
            <div className="sim-title">
              <span>🔬</span> Interactive Hash Ring Simulator
            </div>
            <p className="sim-instruct">Enter any account number to trace how the Murmur3 algorithm routes it to a specific backend server:</p>

            <div className="sim-input-row">
              <input
                type="text"
                className="form-input sim-input"
                value={testAccount}
                onChange={(e) => setTestAccount(e.target.value)}
                placeholder="e.g. ACC-0000001"
              />
              <button className="btn-primary sim-btn" onClick={() => simulateMurmur3(testAccount.trim() || 'ACC-0000001')}>
                Trace Hash Ring Route ▶
              </button>
            </div>

            <div className="quick-acc-row">
              <span>Quick Test:</span>
              <button className="chip-btn" onClick={() => { setTestAccount('ACC-0000001'); simulateMurmur3('ACC-0000001'); }}>
                ACC-0000001 (Node 1)
              </button>
              <button className="chip-btn" onClick={() => { setTestAccount('ACC-0000002'); simulateMurmur3('ACC-0000002'); }}>
                ACC-0000002 (Node 2)
              </button>
              <button className="chip-btn" onClick={() => { setTestAccount('ACC-0000004'); simulateMurmur3('ACC-0000004'); }}>
                ACC-0000004 (Node 3)
              </button>
            </div>

            {hashResult && (
              <div className="hash-result-card">
                <div className="hash-metric-grid">
                  <div className="hash-cell">
                    <span className="cell-label">Murmur3 Hash (Hex)</span>
                    <span className="cell-value" style={{ color: '#38bdf8' }}>{hashResult.hashHex}</span>
                  </div>
                  <div className="hash-cell">
                    <span className="cell-label">Ring Angle Position</span>
                    <span className="cell-value" style={{ color: '#fbbf24' }}>{hashResult.angleDeg}° / 360°</span>
                  </div>
                  <div className="hash-cell">
                    <span className="cell-label">Target Shard Server</span>
                    <span className="cell-value" style={{ color: '#10b981' }}>{hashResult.assignedNode} (:{hashResult.port})</span>
                  </div>
                  <div className="hash-cell">
                    <span className="cell-label">Physical Database</span>
                    <span className="cell-value" style={{ color: '#a78bfa' }}>{hashResult.dbFile}</span>
                  </div>
                </div>

                <div className="ring-visual-bar">
                  <div className="ring-node-block" style={{ background: hashResult.assignedNode.includes('1') ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255,255,255,0.05)' }}>
                    <span>Node 1 (:8081)</span>
                    <small>0° - 120°</small>
                  </div>
                  <div className="ring-node-block" style={{ background: hashResult.assignedNode.includes('2') ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255,255,255,0.05)' }}>
                    <span>Node 2 (:8082)</span>
                    <small>120° - 240°</small>
                  </div>
                  <div className="ring-node-block" style={{ background: hashResult.assignedNode.includes('3') ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255,255,255,0.05)' }}>
                    <span>Node 3 (:8083)</span>
                    <small>240° - 360°</small>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* COMPONENT 2: TOKEN BUCKET RATE LIMITER                         */}
      {/* ============================================================== */}
      {activeComp === 2 && (
        <div className="inspector-content-panel">
          <div className="comp-summary-card">
            <h4>🛡️ Component 2: Token Bucket Rate Limiter</h4>
            <div className="comp-badge-pill">Role: DDoS Defense & Credential Stuffing Prevention</div>
            <p className="comp-desc">
              <strong>What it does:</strong> Protects commercial banking APIs against automated script attacks and high-frequency bot traffic.
              The bucket holds up to <strong>5 tokens</strong> for authentication. Each incoming login or sensitive request consumes 1 token.
              If the bucket empties, subsequent requests receive an immediate <strong>HTTP 429 Too Many Requests</strong> without hitting the database.
              Tokens automatically replenish over time at a calibrated refill period (5 tokens/minute).
            </p>
          </div>

          <div className="simulator-box">
            <div className="sim-title">
              <span>🔬</span> Interactive Token Bucket Simulator
            </div>

            {/* Visual Token Bucket Display */}
            <div className="token-bucket-graphic">
              <div className="bucket-rim">
                <span className="bucket-label">Authentication Token Bucket (Capacity: 5)</span>
                <span className="bucket-count" style={{ color: tokens > 0 ? '#10b981' : '#f43f5e' }}>
                  {tokens} / {MAX_AUTH_TOKENS} Available
                </span>
              </div>

              <div className="token-tokens-rack">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    className={`token-coin ${idx <= tokens ? 'token-present' : 'token-spent'}`}
                  >
                    <span>🪙</span>
                    <small>Token #{idx}</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="sim-actions-cluster">
              <button className="btn-primary sim-btn" onClick={sendSingleRateLimitRequest}>
                Send Single Request (Consume 1 Token)
              </button>
              <button
                className="chip-btn"
                style={{ background: 'rgba(244, 63, 94, 0.15)', borderColor: '#f43f5e', color: '#fb7185' }}
                onClick={simulateRapidBurst}
              >
                ⚡ Fire Bot Attack (Spam 6 Rapid Requests)
              </button>
              <button className="chip-btn" onClick={refillTokens} disabled={refilling}>
                {refilling ? 'Refilling...' : '↻ Refill Bucket to 5/5'}
              </button>
            </div>

            {/* Simulated Live Traffic Log */}
            {burstLogs.length > 0 && (
              <div className="burst-logs-panel">
                <div className="burst-log-header">Rate Limiter Evaluation Stream:</div>
                {burstLogs.map((log) => (
                  <div key={log.id} className={`burst-log-item ${log.status === 'ALLOWED' ? 'log-pass' : 'log-drop'}`}>
                    <span className="log-badge">{log.status}</span>
                    <span className="log-time">[{log.time}]</span>
                    <span className="log-msg">{log.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* COMPONENT 3: DATABASE SHARDS & 2-PHASE SAGA                    */}
      {/* ============================================================== */}
      {activeComp === 3 && (
        <div className="inspector-content-panel">
          <div className="comp-summary-card">
            <h4>🔄 Component 3: Database Shards & Distributed 2-Phase Saga</h4>
            <div className="comp-badge-pill">Role: Multi-Database ACID & Cross-Shard Transaction Coordination</div>
            <p className="comp-desc">
              <strong>What it does:</strong> When Customer A (on Shard 0) transfers funds to Customer B (on Shard 1), they reside on 
              <strong> completely separate physical database files</strong>. A standard SQL <code>BEGIN TRANSACTION</code> cannot span multiple machines.
              The bank uses a <strong>2-Phase Saga Coordinator</strong>: Phase 1 executes a local debit on Shard 0. Phase 2 executes a remote credit on Shard 1.
              If Phase 2 fails, the coordinator executes an automated <strong>Compensating Transaction</strong> that refunds Shard 0, guaranteeing zero financial loss.
            </p>
          </div>

          <div className="simulator-box">
            <div className="sim-title">
              <span>🔬</span> Interactive Cross-Shard Saga Transaction Simulator
            </div>

            <div className="saga-controls-row">
              <label className="saga-radio-label">
                <input
                  type="radio"
                  name="sagaOutcome"
                  checked={sagaMode === 'success'}
                  onChange={() => setSagaMode('success')}
                  disabled={sagaExecuting}
                />
                <span>Scenario A: Normal Flow (Both Shards Healthy ➔ Commit)</span>
              </label>

              <label className="saga-radio-label">
                <input
                  type="radio"
                  name="sagaOutcome"
                  checked={sagaMode === 'failure'}
                  onChange={() => setSagaMode('failure')}
                  disabled={sagaExecuting}
                />
                <span style={{ color: '#fb7185' }}>Scenario B: Failure Simulation (Remote Shard Times Out ➔ Auto-Rollback)</span>
              </label>
            </div>

            <button
              className="btn-primary sim-btn"
              onClick={executeSagaSimulation}
              disabled={sagaExecuting}
              style={{ margin: '14px 0' }}
            >
              {sagaExecuting ? 'Executing Distributed Saga...' : 'Run 2-Phase Cross-Shard Saga ▶'}
            </button>

            {/* Stepper Display */}
            {sagaSteps.length > 0 && (
              <div className="saga-stepper">
                {sagaSteps.map((step, idx) => (
                  <div key={idx} className={`saga-step-card saga-${step.status}`}>
                    <div className="step-header">
                      <span className="step-title">{step.step}</span>
                      <span className={`step-badge badge-${step.status}`}>
                        {step.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="step-desc">{step.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* COMPONENT 4: IN-MEMORY KEY-VALUE CACHE                         */}
      {/* ============================================================== */}
      {activeComp === 4 && (
        <div className="inspector-content-panel">
          <div className="comp-summary-card">
            <h4>⚡ Component 4: In-Memory TTL Key-Value Store (L1 Cache)</h4>
            <div className="comp-badge-pill">Role: Sub-Millisecond Balance Enquiry & Session Management</div>
            <p className="comp-desc">
              <strong>What it does:</strong> In commercial banking, <strong>90% of all requests are read-only balance lookups</strong>.
              Querying the physical SQLite database on disk for every balance check wastes I/O and creates disk bottlenecks (~15ms latency).
              The L1 Key-Value Cache stores balance snapshots in RAM with a <strong>60-second TTL</strong> and LRU eviction, delivering sub-millisecond responses (&lt;0.4ms).
              When a debit or transfer occurs, write-through cache invalidation purges the key instantly to prevent stale reads.
            </p>
          </div>

          <div className="simulator-box">
            <div className="sim-title">
              <span>🔬</span> Cold Cache vs Hot Cache Performance Benchmarker
            </div>

            <div className="sim-actions-cluster">
              <button className="chip-btn" onClick={() => simulateCacheRead('cold')}>
                Simulate Cold Read (Cache Miss ➔ Disk I/O)
              </button>
              <button
                className="chip-btn"
                style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981', color: '#34d399' }}
                onClick={() => simulateCacheRead('hot')}
              >
                ⚡ Simulate Hot Read (Cache Hit ➔ RAM)
              </button>
              <button className="chip-btn" onClick={simulateCacheEviction}>
                Simulate Transfer Cache Eviction
              </button>
            </div>

            {cacheScenario && (
              <div className="cache-benchmark-result">
                <div className="benchmark-meters-row">
                  <div className="meter-card">
                    <span className="meter-label">Response Latency</span>
                    <span className="meter-val" style={{ color: cacheScenario.hit ? '#34d399' : '#fbbf24' }}>
                      {cacheScenario.latency} ms
                    </span>
                    <span className="meter-sub">
                      {cacheScenario.hit ? '⚡ 50x Faster than Disk' : 'Physical Disk Head Read'}
                    </span>
                  </div>

                  <div className="meter-card">
                    <span className="meter-label">Cache Resolution</span>
                    <span className="meter-val" style={{ color: cacheScenario.hit ? '#10b981' : '#f43f5e' }}>
                      {cacheScenario.hit ? 'HIT (100%)' : 'MISS (0%)'}
                    </span>
                    <span className="meter-sub">{cacheScenario.storage}</span>
                  </div>

                  <div className="meter-card">
                    <span className="meter-label">Live Cluster Hit Ratio</span>
                    <span className="meter-val" style={{ color: '#38bdf8' }}>
                      {(systemMetrics?.keyValueStore?.hitRatioPercent ?? 88.5).toFixed(1)}%
                    </span>
                    <span className="meter-sub">Active Keys: {systemMetrics?.keyValueStore?.activeKeys ?? 28}</span>
                  </div>
                </div>

                <div className="cache-explainer-box">{cacheScenario.details}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* COMPONENT 5: DISTRIBUTED SNOWFLAKE ID GENERATOR               */}
      {/* ============================================================== */}
      {activeComp === 5 && (
        <div className="inspector-content-panel">
          <div className="comp-summary-card">
            <h4>🆔 Component 5: Distributed Snowflake 64-Bit ID Generator</h4>
            <div className="comp-badge-pill">Role: Coordination-Free, Time-Ordered Global Transaction IDs</div>
            <p className="comp-desc">
              <strong>What it does:</strong> Traditional database <code>AUTO_INCREMENT</code> requires a single centralized lock, creating an immediate bottleneck
              in a multi-shard cluster. Snowflake generates <strong>64-bit integer IDs</strong> independently across all 3 nodes at over 4 million IDs/sec without network coordination.
              Crucially, IDs are <strong>naturally time-ordered</strong>, allowing b-tree database indices to append sequentially without page splits.
            </p>
          </div>

          <div className="simulator-box">
            <div className="sim-title">
              <span>🔬</span> Interactive 64-Bit Snowflake Binary Deconstructer
            </div>

            <div className="node-picker-row">
              <span>Select Generating Node:</span>
              {[1, 2, 3].map((nodeId) => (
                <button
                  key={nodeId}
                  className={`chip-btn ${selectedSnowflakeNode === nodeId ? 'active-node-btn' : ''}`}
                  onClick={() => setSelectedSnowflakeNode(nodeId)}
                >
                  Node {nodeId} (:808{nodeId})
                </button>
              ))}
            </div>

            <button className="btn-primary sim-btn" onClick={generateSnowflake} style={{ margin: '14px 0' }}>
              Generate 64-Bit Snowflake ID ▶
            </button>

            {generatedId && (
              <div className="snowflake-display-card">
                <div className="raw-id-bar">
                  <span className="id-label">Commercial Bank Reference:</span>
                  <span className="id-val">{generatedId.rawId}</span>
                </div>

                <div className="bit-anatomy-header">64-Bit Binary Layout Decomposition:</div>

                <div className="bit-blocks-row">
                  <div className="bit-block bit-sign">
                    <span className="bit-name">Sign (1b)</span>
                    <span className="bit-val">0</span>
                    <small>Unused (Positive)</small>
                  </div>

                  <div className="bit-block bit-time">
                    <span className="bit-name">Timestamp (41 bits)</span>
                    <span className="bit-val">{generatedId.binaryString.slice(1, 42)}</span>
                    <small>{new Date(generatedId.timestampMs).toLocaleTimeString()} ({generatedId.timestampMs} ms)</small>
                  </div>

                  <div className="bit-block bit-node">
                    <span className="bit-name">Node ID (10b)</span>
                    <span className="bit-val">{generatedId.binaryString.slice(42, 52)}</span>
                    <small>Worker #{generatedId.nodeId}</small>
                  </div>

                  <div className="bit-block bit-seq">
                    <span className="bit-name">Sequence (12b)</span>
                    <span className="bit-val">{generatedId.binaryString.slice(52)}</span>
                    <small>Sequence #{generatedId.sequence}</small>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
