import { api } from './api.js';
import { HashRingVisualizer } from './components/ring.js';
import { TokenBucketVisualizer } from './components/token-bucket.js';
import { SagaVisualizer } from './components/saga.js';
import { KvStoreVisualizer } from './components/kv-store.js';
import { SnowflakeVisualizer } from './components/snowflake.js';
import { EventLogStream } from './components/event-log.js';

class ErodeBankingApp {
  constructor() {
    this.token = localStorage.getItem('esss_token');
    this.user = JSON.parse(localStorage.getItem('esss_user') || 'null');
    if (this.token) api.setToken(this.token);

    this.telemetryEnabled = localStorage.getItem('esss_telemetry_enabled') !== 'false';
    this.telemetryPanelEl = document.getElementById('telemetry-panel');
    this.appContainerEl = document.getElementById('app-container');

    this.killedNodes = new Set();
    this.hasFourthShard = false;
    this.activeTab = 'accounts';

    // State per user
    this.currentBalance = 25420.50;
    this.transactions = [];
    this.bills = [];

    // Components
    this.ring = null;
    this.tokenBucket = null;
    this.saga = null;
    this.kvStore = null;
    this.snowflake = null;
    this.eventLog = null;

    this.init();
  }

  init() {
    this.initComponents();

    api.onOfflineStateChange = (offline) => {
      const banner = document.getElementById('offline-banner');
      if (banner) banner.style.display = offline ? 'block' : 'none';
    };


    this.setupTelemetryToggle();
    this.wireEvents();
    this.renderSessionState();
    this.populateTransferSelect();

    this.pollMetrics();
    this.metricsTimer = setInterval(() => this.pollMetrics(), 1000);

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'SYSTEM_BOOT',
        details: 'Erode SSS Bank Core Cluster online · 3 Shards · 450 vnodes · Edge Limiter active'
      });
    }
  }

  initComponents() {
    const ringEl = document.getElementById('card-hash-ring');
    if (ringEl) this.ring = new HashRingVisualizer(ringEl);

    const tbEl = document.getElementById('card-token-bucket');
    if (tbEl) this.tokenBucket = new TokenBucketVisualizer(tbEl);

    const sagaEl = document.getElementById('card-shards-saga');
    if (sagaEl) this.saga = new SagaVisualizer(sagaEl);

    const kvEl = document.getElementById('card-kv-store');
    if (kvEl) this.kvStore = new KvStoreVisualizer(kvEl);

    const sfEl = document.getElementById('card-snowflake-id');
    if (sfEl) this.snowflake = new SnowflakeVisualizer(sfEl);

    const logEl = document.getElementById('card-event-log');
    if (logEl) this.eventLog = new EventLogStream(logEl);
  }

  setupTelemetryToggle() {
    const btn = document.getElementById('btn-telemetry-toggle');
    if (!btn) return;

    this.applyTelemetryState(this.telemetryEnabled);

    btn.addEventListener('click', () => {
      this.telemetryEnabled = !this.telemetryEnabled;
      localStorage.setItem('esss_telemetry_enabled', String(this.telemetryEnabled));
      this.applyTelemetryState(this.telemetryEnabled);
    });
  }

  applyTelemetryState(enabled) {
    const btn = document.getElementById('btn-telemetry-toggle');
    const indicator = btn?.querySelector('.telemetry-pill-indicator');

    if (enabled) {
      if (btn) btn.classList.add('is-active');
      if (indicator) indicator.textContent = '● ON';
      this.appContainerEl?.classList.remove('telemetry-off');
      if (!document.getElementById('telemetry-panel') && this.telemetryPanelEl) {
        this.appContainerEl?.appendChild(this.telemetryPanelEl);
      }
    } else {
      if (btn) btn.classList.remove('is-active');
      if (indicator) indicator.textContent = 'OFF';
      this.appContainerEl?.classList.add('telemetry-off');
      if (this.telemetryPanelEl && this.telemetryPanelEl.parentNode) {
        this.telemetryPanelEl.remove();
      }
    }
  }

  async pollMetrics() {
    try {
      const { data } = await api.get('/admin/metrics');
      if (data) {
        this.updateMetricsUI(data);
      }
    } catch {
      // Background poll silently ignored
    }
  }

  updateMetricsUI(metrics) {
    if (!metrics) return;
    if (metrics.rateLimiter && this.tokenBucket) {
      this.tokenBucket.updateMetrics(
        metrics.rateLimiter.allowedRequests,
        metrics.rateLimiter.rejectedRequests
      );
    }
    if (metrics.keyValueStore && this.kvStore) {
      this.kvStore.updateMetrics(
        metrics.keyValueStore.hitRatioPercent,
        metrics.keyValueStore.avgGetLatencyNanos
      );
    }
    if (metrics.uniqueIdGenerator && this.snowflake) {
      this.snowflake.updateMetrics(metrics.uniqueIdGenerator.totalGenerated);
    }
    if (metrics.shards && this.saga) {
      this.saga.updateShards(metrics.shards);
    }
  }


  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div>${message}</div>
      <button class="toast-close" aria-label="Close notification">✕</button>
    `;
    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 4500);
  }

  getShardForAccount(accountId) {
    if (!accountId) return '0';
    if (accountId.includes('2')) return '1';
    if (accountId.includes('4')) return '2';
    if (accountId.includes('6')) return '3';
    return '0';
  }

  getNodeForShard(shardId) {
    const map = { '0': 'node:8081', '1': 'node:8082', '2': 'node:8083', '3': 'node:8084' };
    return map[String(shardId)] || 'node:8081';
  }

  async handleLogin(username, password) {
    const btn = document.getElementById('btn-login-submit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Signing In...';
    }

    if (this.tokenBucket && !this.tokenBucket.tryConsume('login')) {
      const retry = this.tokenBucket.retryAfterSec || 12;
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'LOGIN_THROTTLED',
          details: `429 Too Many Requests · IP login bucket exhausted · Retry-After: ${retry}s`
        });
      }
      this.showToast(`Rate limit exceeded (5 logins/min) · retry in ${retry}s`, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
      return;
    }

    try {
      const { data, headers, latency } = await api.post('/auth/login', { username, password });
      this.token = data.token;
      this.user = {
        id: data.customerId || '1',
        username,
        name: data.name || (username.startsWith('aarav') ? 'Aarav Sharma' : username.startsWith('diya') ? 'Diya Patel' : 'Kavya Nair'),
        accountId: data.accountId || 'ACC-0000001'
      };
      api.setToken(this.token);
      localStorage.setItem('esss_token', this.token);
      localStorage.setItem('esss_user', JSON.stringify(this.user));

      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'LOGIN_ALLOWED',
          details: `Authenticated ${this.user.name} (${this.user.accountId}) · Session JWT issued`
        });
      }

      this.showToast(`Welcome back, ${this.user.name}`, 'success');
      this.renderSessionState();
    } catch (err) {
      if (err.status === 429) {
        const retry = err.retryAfter || 12;
        if (this.tokenBucket) this.tokenBucket.triggerThrottle('login', retry);
        if (this.eventLog) {
          this.eventLog.addEvent({
            action: 'LOGIN_THROTTLED',
            details: `429 Too Many Requests · Gateway IP login throttled · Retry-After: ${retry}s`
          });
        }
        this.showToast(`Rate limited · retry in ${retry}s`, 'error');
        return;
      }

      // Demo fallback login
      const accMap = {
        'aarav.sharma1': { name: 'Aarav Sharma', acc: 'ACC-0000001' },
        'diya.patel2': { name: 'Diya Patel', acc: 'ACC-0000002' },
        'kavya.nair4': { name: 'Kavya Nair', acc: 'ACC-0000004' }
      };
      const demo = accMap[username] || { name: username, acc: 'ACC-0000001' };

      this.token = `demo-token-${Date.now()}`;
      this.user = { id: '1', username, name: demo.name, accountId: demo.acc };
      api.setToken(this.token);
      localStorage.setItem('esss_token', this.token);
      localStorage.setItem('esss_user', JSON.stringify(this.user));

      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'LOGIN_ALLOWED',
          details: `Signed in as ${demo.name} (${demo.acc}) [Retail NetBanking]`
        });
      }

      this.showToast(`Signed in as ${demo.name}`, 'success');
      this.renderSessionState();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    }
  }

  handleSignout() {
    this.token = null;
    this.user = null;
    api.setToken(null);
    localStorage.removeItem('esss_token');
    localStorage.removeItem('esss_user');

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'SYSTEM_BOOT',
        details: 'User signed out · session invalidated'
      });
    }

    this.showToast('Signed out of NetBanking', 'info');
    this.renderSessionState();
  }

  renderSessionState() {
    const loginView = document.getElementById('login-view');
    const dashView = document.getElementById('dashboard-view');
    const chipBox = document.getElementById('user-chip-container');
    const nameEl = document.getElementById('user-display-name');
    const accEl = document.getElementById('user-display-account');

    if (this.user && this.token) {
      if (loginView) loginView.style.display = 'none';
      if (dashView) dashView.style.display = 'flex';
      if (chipBox) chipBox.style.display = 'flex';

      if (nameEl) nameEl.textContent = this.user.name;
      if (accEl) accEl.textContent = this.user.accountId;

      const srcAccInput = document.getElementById('transfer-source-acc');
      if (srcAccInput) srcAccInput.value = `${this.user.name} (${this.user.accountId})`;

      this.loadDashboardData();
    } else {
      if (loginView) loginView.style.display = 'flex';
      if (dashView) dashView.style.display = 'none';
      if (chipBox) chipBox.style.display = 'none';
    }
  }

  loadDashboardData() {
    this.initUserState();
    this.updateBalanceUI();
    this.refreshBalance();
    this.updateBeneficiariesList();
    this.loadBills();
    this.renderHistory();
    this.generateNewIdempotencyKey();
  }

  initUserState() {
    if (!this.user) return;
    const accId = this.user.accountId;

    // 1. Balance
    const savedBal = localStorage.getItem(`esss_balance_${accId}`);
    if (savedBal !== null) {
      this.currentBalance = parseFloat(savedBal);
    } else {
      const defaults = {
        'ACC-0000001': 25420.50,
        'ACC-0000002': 18750.00,
        'ACC-0000004': 32100.00
      };
      this.currentBalance = defaults[accId] ?? 25420.50;
      localStorage.setItem(`esss_balance_${accId}`, this.currentBalance.toFixed(2));
    }

    // 2. Transactions
    const savedTxs = localStorage.getItem(`esss_txs_${accId}`);
    if (savedTxs) {
      try {
        this.transactions = JSON.parse(savedTxs);
      } catch {
        this.transactions = [];
      }
    } else {
      this.transactions = [
        {
          transactionId: 'TRF-17926839485',
          description: 'Salary Direct Deposit',
          type: 'CREDIT',
          amountInr: 25000.00,
          balanceAfterInr: this.currentBalance,
          shardId: this.getShardForAccount(accId),
          createdAt: Date.now() - 3600000 * 8
        },
        {
          transactionId: 'TRF-17926831092',
          description: 'IMPS Transfer to Diya Patel',
          type: 'DEBIT',
          amountInr: 500.00,
          balanceAfterInr: this.currentBalance - 500.00,
          shardId: this.getShardForAccount(accId),
          createdAt: Date.now() - 3600000 * 12
        }
      ];
      localStorage.setItem(`esss_txs_${accId}`, JSON.stringify(this.transactions));
    }

    // 3. Bills
    const savedBills = localStorage.getItem(`esss_bills_${accId}`);
    if (savedBills) {
      try {
        this.bills = JSON.parse(savedBills);
      } catch {
        this.bills = [];
      }
    } else {
      this.bills = [
        { id: 'BILL-EL-89', name: 'TNEB Electricity Bill', amount: 840, due: 'Due in 3 days', paid: false },
        { id: 'BILL-BB-41', name: 'Airtel Broadband Service', amount: 1199, due: 'Due in 7 days', paid: false },
        { id: 'BILL-WT-12', name: 'Erode Municipal Water Tax', amount: 320, due: 'Paid on Oct 20', paid: true },
        { id: 'BILL-GAS-55', name: 'Indane Gas Cylinder', amount: 950, due: 'Due in 12 days', paid: false }
      ];
      localStorage.setItem(`esss_bills_${accId}`, JSON.stringify(this.bills));
    }
  }

  updateBalanceUI() {
    const balEl = document.getElementById('balance-amount-display');
    const netBalEl = document.getElementById('stat-net-balance');
    const metaEl = document.getElementById('balance-meta-display');

    const formatted = `₹ ${Number(this.currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (balEl) balEl.textContent = formatted;
    if (netBalEl) netBalEl.textContent = formatted;

    const shardId = this.getShardForAccount(this.user?.accountId);
    const node = this.getNodeForShard(shardId);
    if (metaEl) {
      metaEl.innerHTML = `Served by: <strong>${node}</strong> · Shard: <strong>${shardId}</strong> · Cache: <strong style="color: var(--green);">HIT (&lt;0.4ms)</strong>`;
    }
  }

  async refreshBalance() {
    if (!this.user) return;
    const btn = document.getElementById('btn-refresh-balance');
    if (btn) btn.textContent = 'Refreshing...';

    if (this.tokenBucket && !this.tokenBucket.tryConsume('enquiry')) {
      const retry = this.tokenBucket.retryAfterSec || 5;
      this.showToast(`Rate limit reached on balance enquiries · retry in ${retry}s`, 'warn');
      if (btn) btn.textContent = '↻ Refresh';
      return;
    }

    try {
      const { data, headers, latency } = await api.get(`/accounts/${this.user.accountId}/balance`);
      const inr = data.balanceInr ?? ((data.balanceCents || (this.currentBalance * 100)) / 100);
      this.currentBalance = Number(inr);
      localStorage.setItem(`esss_balance_${this.user.accountId}`, this.currentBalance.toFixed(2));

      const servedBy = headers.get('X-Served-By') || data.servedBy || this.getNodeForShard(this.getShardForAccount(this.user.accountId));
      const shard = headers.get('X-Shard') || data.shard || this.getShardForAccount(this.user.accountId);
      const cacheHit = headers.get('X-Cache-Hit') === 'true' || headers.get('X-Cache-Hit') === 'HIT';

      const metaEl = document.getElementById('balance-meta-display');
      if (metaEl) {
        metaEl.innerHTML = `Served by: <strong>${servedBy}</strong> · Shard: <strong>${shard}</strong> · Cache: <strong style="color: ${cacheHit ? 'var(--green)' : 'var(--orange)'};">${cacheHit ? 'HIT (<0.4 ms)' : 'MISS (DB read)'}</strong>`;
      }

      this.updateBalanceUI();
      if (this.ring) this.ring.routeTo(servedBy, this.user.accountId);
      if (this.kvStore) this.kvStore.recordRequest(cacheHit, latency);

      if (this.eventLog) {
        this.eventLog.addEvent({
          action: cacheHit ? 'CACHE_HIT' : 'CACHE_MISS',
          details: `Balance enquiry for ${this.user.accountId}: ₹${this.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} · ${servedBy} (${cacheHit ? 'L1 RAM Hit' : 'Disk Read'})`
        });
      }
    } catch {
      this.updateBalanceUI();
      const shardId = this.getShardForAccount(this.user.accountId);
      const node = this.getNodeForShard(shardId);
      if (this.ring) this.ring.routeTo(node, this.user.accountId);
      if (this.kvStore) this.kvStore.recordRequest(true, 0.4);
    } finally {
      if (btn) btn.textContent = '↻ Refresh';
    }
  }

  generateNewIdempotencyKey() {
    const raw = `TRF-KEY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const input = document.getElementById('transfer-idem-key');
    if (input) input.value = raw;
    return raw;
  }

  async executeTransfer(isResend = false) {
    if (!this.user) return;
    const toAcc = document.getElementById('transfer-dest-acc').value;
    const amount = parseFloat(document.getElementById('transfer-amount').value);
    const idemKey = document.getElementById('transfer-idem-key').value.trim() || this.generateNewIdempotencyKey();

    if (!toAcc || isNaN(amount) || amount <= 0) {
      this.showToast('Please specify a valid transfer amount', 'warn');
      return;
    }

    // 1. Strict Token Bucket Rate Limit Enforcement
    if (!isResend && this.tokenBucket && !this.tokenBucket.tryConsume('transfer')) {
      const retrySec = this.tokenBucket.retryAfterSec || 12;
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'LOGIN_THROTTLED',
          details: `429 Too Many Requests · Transfer bucket empty (0/30 tokens) · Gateway blocked client · Retry-After: ${retrySec}s`
        });
      }
      this.showToast(`Rate limit exceeded (30 transfers/min) · Retry in ${retrySec}s`, 'error');
      return; // STOP! Transfer blocked!
    }

    // 2. Core Banking Balance Validation
    if (!isResend && amount > this.currentBalance) {
      this.showToast(`Insufficient balance! Available: ₹${this.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'error');
      return;
    }

    const sfId = this.snowflake ? this.snowflake.generateId('TRF') : `TRF-${Date.now()}`;
    const srcShard = parseInt(this.getShardForAccount(this.user.accountId), 10);
    const dstShard = parseInt(this.getShardForAccount(toAcc), 10);
    const srcPort = `808${srcShard + 1}`;
    const dstPort = `808${dstShard + 1}`;

    // 3. Shard & Node Availability Validation (2PC Resilience)
    if (this.killedNodes.has(srcPort)) {
      this.showToast(`Transfer Failed: Your home Node :${srcPort} (Shard ${srcShard}) is OFFLINE!`, 'error');
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'NODE_DOWN',
          details: `TRANSFER_REJECTED · Source node :${srcPort} offline · Gateway cannot dispatch saga`
        });
      }
      return;
    }

    if (this.killedNodes.has(dstPort)) {
      // 2-Phase Commit Saga Abort & Compensating Refund
      if (this.saga) {
        this.saga.failSaga(this.user.accountId, toAcc, amount, srcShard, dstShard);
      }
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'TRANSFER_INITIATED',
          details: `TRANSFER_INITIATED · ${this.user.accountId} → ${toAcc} · ₹${amount} · idem=${idemKey.slice(-8)}`
        });
        setTimeout(() => {
          this.eventLog.addEvent({
            action: 'NODE_DOWN',
            details: `CONNECTION_REFUSED · Node :${dstPort} / Shard ${dstShard} unreachable · HTTP 503`
          });
        }, 250);
        setTimeout(() => {
          this.eventLog.addEvent({
            action: 'SAGA_ABORTED',
            details: `2PC_ABORT · Shard ${dstShard} offline · Triggering compensating transaction`
          });
        }, 500);
        setTimeout(() => {
          this.eventLog.addEvent({
            action: 'COMPENSATING_REFUND',
            details: `COMPENSATING_REFUND · ₹${amount} reservation released · Available Balance preserved: ₹${this.currentBalance.toFixed(2)}`
          });
        }, 750);
      }
      this.showToast(`Transfer Aborted: Destination Node :${dstPort} (Shard ${dstShard}) is OFFLINE. 2PC Saga triggered COMPENSATING REFUND. Balance preserved!`, 'error');
      return;
    }

    const sendBtn = document.getElementById('btn-send-transfer');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Processing Saga...';
    }

    if (this.saga) {
      this.saga.startSaga(this.user.accountId, toAcc, amount, srcShard, dstShard);
    }

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'TRANSFER_INITIATED',
        details: `TRANSFER_INITIATED · ${this.user.accountId} → ${toAcc} · ₹${amount} · idem=${idemKey.slice(-8)} · snowflake=${sfId}`
      });
      setTimeout(() => {
        this.eventLog.addEvent({
          action: 'SAGA_STEP',
          details: `DEBIT_PENDING · shard-${srcShard} · -₹${amount} · source reserved`
        });
      }, 250);
      setTimeout(() => {
        this.eventLog.addEvent({
          action: 'SAGA_STEP',
          details: `CREDIT_PENDING · shard-${dstShard} · +₹${amount} · destination ledger credited`
        });
      }, 500);
    }

    try {
      const { data, headers } = await api.post('/transfers', {
        sourceAccountId: this.user.accountId,
        destAccountId: toAcc,
        amountCents: Math.round(amount * 100),
        description: `Fund transfer to ${toAcc}`
      }, {
        headers: { 'Idempotency-Key': idemKey }
      });

      const dupBadge = document.getElementById('transfer-duplicate-badge');
      if (dupBadge) dupBadge.style.display = isResend ? 'inline-block' : 'none';

      if (!isResend) {
        this.currentBalance = Math.max(0, Math.round((this.currentBalance - amount) * 100) / 100);
        localStorage.setItem(`esss_balance_${this.user.accountId}`, this.currentBalance.toFixed(2));
        this.updateBalanceUI();

        this.addTransaction({
          transactionId: sfId,
          description: `Transfer to ${toAcc}`,
          type: 'DEBIT',
          amountInr: amount,
          balanceAfterInr: this.currentBalance,
          shardId: srcShard,
          createdAt: Date.now()
        });
      }

      if (this.eventLog) {
        setTimeout(() => {
          this.eventLog.addEvent({
            action: isResend ? 'CACHE_HIT' : 'SAGA_COMPLETED',
            details: isResend
              ? 'DUPLICATE_SUPPRESSED · Idempotency hit · original response returned · NO second debit'
              : `SAGA_COMPLETED · Ref #${data?.transferId || sfId} settled · Bal: ₹${this.currentBalance.toFixed(2)}`
          });
        }, 750);
      }

      this.showToast(isResend ? 'Duplicate transfer suppressed (Idempotency Key Hit)' : `Transferred ₹${amount.toFixed(2)} successfully`, isResend ? 'info' : 'success');
      if (!isResend) this.generateNewIdempotencyKey();
    } catch (err) {
      if (err.status === 429) {
        const retry = err.retryAfter || 12;
        if (this.tokenBucket) this.tokenBucket.triggerThrottle('transfer', retry);
        if (this.eventLog) {
          this.eventLog.addEvent({
            action: 'LOGIN_THROTTLED',
            details: `429 Too Many Requests · Gateway token bucket throttled · Retry-After: ${retry}s`
          });
        }
        this.showToast(`Rate limit exceeded · retry in ${retry}s`, 'error');
        return;
      }

      // Offline / standalone demo fallback: Execute the real banking balance debit
      const dupBadge = document.getElementById('transfer-duplicate-badge');
      if (dupBadge) dupBadge.style.display = isResend ? 'inline-block' : 'none';

      if (!isResend) {
        this.currentBalance = Math.max(0, Math.round((this.currentBalance - amount) * 100) / 100);
        localStorage.setItem(`esss_balance_${this.user.accountId}`, this.currentBalance.toFixed(2));
        this.updateBalanceUI();

        this.addTransaction({
          transactionId: sfId,
          description: `Transfer to ${toAcc}`,
          type: 'DEBIT',
          amountInr: amount,
          balanceAfterInr: this.currentBalance,
          shardId: srcShard,
          createdAt: Date.now()
        });
      }

      if (this.eventLog) {
        setTimeout(() => {
          this.eventLog.addEvent({
            action: isResend ? 'CACHE_HIT' : 'SAGA_COMPLETED',
            details: isResend
              ? 'DUPLICATE_SUPPRESSED · Idempotency hit · original response returned · NO second debit'
              : `SAGA_COMPLETED · Ref #${sfId} settled · New Balance: ₹${this.currentBalance.toFixed(2)}`
          });
        }, 750);
      }

      this.showToast(isResend ? 'Duplicate transfer suppressed (Idempotency Key Hit)' : `Transferred ₹${amount.toFixed(2)} successfully`, isResend ? 'info' : 'success');
      if (!isResend) this.generateNewIdempotencyKey();
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Funds';
      }
    }
  }

  addTransaction(tx) {
    this.transactions = [tx, ...this.transactions];
    if (this.user) {
      localStorage.setItem(`esss_txs_${this.user.accountId}`, JSON.stringify(this.transactions));
    }
    this.renderHistory();
  }

  renderHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    if (!this.transactions || this.transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--muted); padding: 24px;">No ledger records found for this shard.</td></tr>`;
      return;
    }

    let totalDebits = 0;
    let totalCredits = 0;

    tbody.innerHTML = this.transactions.map(tx => {
      const isCredit = tx.type === 'CREDIT';
      const amt = Number(tx.amountInr ?? 0);
      const bal = Number(tx.balanceAfterInr ?? 0);

      if (isCredit) {
        totalCredits += amt;
      } else {
        totalDebits += amt;
      }

      const d = new Date(tx.createdAt || Date.now());
      const dateStr = `${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

      return `
        <tr>
          <td style="color: var(--ink-2); white-space: nowrap;">${dateStr}</td>
          <td style="font-family: var(--font-mono); font-size: 11px;">${tx.transactionId || 'TRF-10928'}</td>
          <td><strong>${tx.description || 'Fund Transfer'}</strong></td>
          <td>
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${isCredit ? 'var(--fill-green)' : 'var(--fill-red)'}; color: ${isCredit ? 'var(--green)' : 'var(--red)'};">
              ${tx.type}
            </span>
          </td>
          <td style="font-weight: 700; color: ${isCredit ? 'var(--green)' : 'var(--red)'}; white-space: nowrap;">
            ${isCredit ? '+' : '-'} ₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td style="font-family: var(--font-mono); font-weight: 600; white-space: nowrap;">
            ₹${bal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td>
            <span style="font-size: 10px; font-family: var(--font-mono); padding: 2px 5px; border-radius: 3px; background: var(--fill-blue); color: var(--accent-blue);">
              shard-${tx.shardId ?? '0'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const statDebits = document.getElementById('stat-total-debits');
    const statCredits = document.getElementById('stat-total-credits');
    const statNet = document.getElementById('stat-net-balance');

    if (statDebits) statDebits.textContent = `- ₹ ${totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (statCredits) statCredits.textContent = `+ ₹ ${totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (statNet) statNet.textContent = `₹ ${this.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  getBeneficiariesList() {
    const base = [
      { name: 'Diya Patel', acc: 'ACC-0000002', shard: 'Shard 1 (:8082)', port: '8082' },
      { name: 'Kavya Nair', acc: 'ACC-0000004', shard: 'Shard 2 (:8083)', port: '8083' },
      { name: 'Saravana Rishi', acc: 'ACC-0000005', shard: 'Shard 0 (:8081)', port: '8081' }
    ];
    if (this.hasFourthShard) {
      base.push({ name: 'Meera Krishnan', acc: 'ACC-0000006', shard: 'Shard 3 (:8084)', port: '8084' });
    }
    return base;
  }

  updateBeneficiariesList() {
    this.loadBeneficiaries();
    this.populateTransferSelect();
  }

  loadBeneficiaries() {
    const list = this.getBeneficiariesList();
    const container = document.getElementById('beneficiaries-list-container');
    if (!container) return;

    container.innerHTML = list.map(b => {
      const isDead = this.killedNodes.has(b.port);
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: ${isDead ? 'var(--fill-red)' : 'var(--surface)'}; border: 1px solid ${isDead ? 'var(--red)' : 'var(--border)'}; border-radius: 6px; margin-bottom: 8px;">
          <div>
            <div style="font-weight: 700; color: ${isDead ? 'var(--red)' : 'var(--navy)'}; font-size: 13px;">
              ${b.name} ${isDead ? '<span style="font-size: 10px; font-weight: 800; background: var(--fill-red); color: var(--red); padding: 1px 6px; border-radius: 3px; border: 1px solid rgba(214,69,69,0.3);">[⛔ OFFLINE]</span>' : ''}
            </div>
            <div style="font-size: 11px; font-family: var(--font-mono); color: var(--muted);">${b.acc} · ${b.shard}</div>
          </div>
          <button class="btn-subtle" onclick="window.app.quickTransferTo('${b.acc}')">Send Money ▶</button>
        </div>
      `;
    }).join('');
  }

  populateTransferSelect() {
    const select = document.getElementById('transfer-dest-acc');
    if (!select) return;
    const currentVal = select.value;
    const list = this.getBeneficiariesList();
    select.innerHTML = list.map(b => {
      const isDead = this.killedNodes.has(b.port);
      return `<option value="${b.acc}">${b.name} (${b.acc} · ${b.shard})${isDead ? ' [⛔ OFFLINE]' : ''}</option>`;
    }).join('');
    if (currentVal && list.some(b => b.acc === currentVal)) {
      select.value = currentVal;
    }
  }

  quickTransferTo(acc) {
    const select = document.getElementById('transfer-dest-acc');
    if (select) select.value = acc;
    this.switchTab('transfer');
  }

  loadBills() {
    const container = document.getElementById('bills-list-container');
    if (!container) return;

    container.innerHTML = this.bills.map(b => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 10px;">
        <div>
          <div style="font-weight: 700; color: var(--navy); font-size: 14px;">${b.name}</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
            Bill Ref: <strong style="font-family: var(--font-mono); color: var(--ink-2);">${b.id}</strong> · ${b.due}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 15px; color: var(--navy); font-family: var(--font-mono); margin-bottom: 6px;">
            ₹${b.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          ${b.paid ? `
            <span class="badge-paid">PAID ✓</span>
          ` : `
            <button class="btn-subtle" style="font-weight: 700; color: var(--accent-blue);" onclick="window.app.payBill('${b.id}', ${b.amount})">
              Pay BBPS
            </button>
          `}
        </div>
      </div>
    `).join('');
  }

  async payBill(billId, amount) {
    if (!this.user) return;

    // 1. Rate limiter check
    if (this.tokenBucket && !this.tokenBucket.tryConsume('transfer')) {
      const retrySec = this.tokenBucket.retryAfterSec || 12;
      this.showToast(`Rate limit reached · retry in ${retrySec}s`, 'error');
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'LOGIN_THROTTLED',
          details: `429 Too Many Requests · Bill payment bucket exhausted · Retry-After: ${retrySec}s`
        });
      }
      return;
    }

    // 2. Insufficient balance check
    if (amount > this.currentBalance) {
      this.showToast(`Insufficient balance to pay bill! Available: ₹${this.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'error');
      return;
    }

    // 3. Deduct balance immediately
    this.currentBalance = Math.max(0, Math.round((this.currentBalance - amount) * 100) / 100);
    localStorage.setItem(`esss_balance_${this.user.accountId}`, this.currentBalance.toFixed(2));
    this.updateBalanceUI();

    // 4. Update bill status to PAID
    const targetBill = this.bills.find(b => b.id === billId);
    if (targetBill) {
      targetBill.paid = true;
      targetBill.due = `Paid on ${new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
      localStorage.setItem(`esss_bills_${this.user.accountId}`, JSON.stringify(this.bills));
    }
    this.loadBills();

    // 5. Generate Snowflake Tracking ID & Ledger entry
    const sfId = this.snowflake ? this.snowflake.generateId('BIL') : `BIL-${Date.now()}`;
    const shardId = parseInt(this.getShardForAccount(this.user.accountId), 10);

    this.addTransaction({
      transactionId: sfId,
      description: `BBPS: ${targetBill ? targetBill.name : billId}`,
      type: 'DEBIT',
      amountInr: amount,
      balanceAfterInr: this.currentBalance,
      shardId: shardId,
      createdAt: Date.now()
    });

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'SAGA_COMPLETED',
        details: `BILL_SETTLED · ${targetBill ? targetBill.name : billId} · -₹${amount} · New Bal: ₹${this.currentBalance.toFixed(2)}`
      });
    }

    this.showToast(`Bill ${targetBill ? targetBill.name : billId} (₹${amount}) settled successfully!`, 'success');

    // Optionally notify backend if connected
    try {
      const idemKey = `BILL-${Date.now()}`;
      await api.post('/billpayments', {
        accountId: this.user.accountId,
        billId,
        amountCents: amount * 100
      }, {
        headers: { 'Idempotency-Key': idemKey }
      });
    } catch {
      // Handled gracefully in offline mode
    }
  }

  updateClusterControlsUI() {
    const killBtn = document.getElementById('btn-admin-kill-8082');
    const reviveBtn = document.getElementById('btn-admin-revive-8082');
    const is8082Killed = this.killedNodes.has('8082');
    if (killBtn) killBtn.disabled = is8082Killed;
    if (reviveBtn) reviveBtn.disabled = !is8082Killed;

    const addShardBtn = document.getElementById('btn-admin-add-shard');
    const removeShardBtn = document.getElementById('btn-admin-remove-shard');
    if (addShardBtn) addShardBtn.disabled = this.hasFourthShard;
    if (removeShardBtn) removeShardBtn.disabled = !this.hasFourthShard;

    this.updateDemoAccountsUI();
  }

  updateDemoAccountsUI() {
    document.querySelectorAll('.btn-demo-account').forEach(btn => {
      const node = btn.dataset.node;
      const isDead = this.killedNodes.has(node);
      const nodeSpan = btn.querySelector('.demo-account-node');
      if (nodeSpan) {
        if (isDead) {
          nodeSpan.textContent = `Node (${node}) [⛔ OFFLINE]`;
          nodeSpan.style.color = 'var(--red)';
        } else {
          const map = { '8081': 'Node 1 (:8081)', '8082': 'Node 2 (:8082)', '8083': 'Node 3 (:8083)', '8084': 'Node 4 (:8084)' };
          nodeSpan.textContent = map[node] || `Node (${node})`;
          const colors = { '8081': 'var(--accent-blue)', '8082': 'var(--orange)', '8083': 'var(--green)' };
          nodeSpan.style.color = colors[node] || 'var(--ink)';
        }
      }
    });
  }

  async killNode(port) {
    const btn = document.getElementById(`btn-admin-kill-${port}`);
    if (btn) btn.disabled = true;
    try {
      await api.post(`/admin/nodes/${port}/kill`);
      this.applyNodeKill(port);
    } catch {
      this.applyNodeKill(port);
    } finally {
      this.updateClusterControlsUI();
    }
  }

  applyNodeKill(port) {
    this.killedNodes.add(String(port));
    if (this.ring) this.ring.setKilledNodes(this.killedNodes);
    if (this.saga) this.saga.setKilledNodes(this.killedNodes);
    this.updateBeneficiariesList();
    this.updateClusterControlsUI();

    const timeline = document.getElementById('admin-failure-timeline');
    if (timeline) {
      timeline.style.display = 'block';
      timeline.innerHTML = `
        <strong>Failure Detection Timeline:</strong><br>
        t=0s kill signal → t=5.0s probe 1 fail → t=10.0s probe 2 fail →
        <span style="color: var(--red); font-weight: 700;">t=10.1s node :${port} evicted</span> →
        <span style="color: var(--green); font-weight: 700;">t=10.2s vnodes migrated</span>
      `;
    }

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'NODE_DOWN',
        details: `NODE_DOWN · :${port} evicted from hash ring · Shard 1 marked OFFLINE`
      });
    }

    this.showToast(`Node :${port} killed. Hash ring vnodes redistributed and Shard 1 OFFLINE.`, 'warn');
  }

  async reviveNode(port) {
    const btn = document.getElementById(`btn-admin-revive-${port}`);
    if (btn) btn.disabled = true;
    try {
      await api.post(`/admin/nodes/${port}/revive`);
      this.applyNodeRevive(port);
    } catch {
      this.applyNodeRevive(port);
    } finally {
      this.updateClusterControlsUI();
    }
  }

  applyNodeRevive(port) {
    this.killedNodes.delete(String(port));
    if (this.ring) this.ring.setKilledNodes(this.killedNodes);
    if (this.saga) this.saga.setKilledNodes(this.killedNodes);
    this.updateBeneficiariesList();
    this.updateClusterControlsUI();

    const timeline = document.getElementById('admin-failure-timeline');
    if (timeline) {
      timeline.innerHTML = `
        <strong style="color: var(--green);">Node Recovery:</strong><br>
        Node :${port} responded to health check. Re-added to hash ring with 150 virtual slots restored.
      `;
    }

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'NODE_REJOINED',
        details: `NODE_REJOINED · :${port} restored to ring · Shard 1 marked ONLINE`
      });
    }

    this.showToast(`Node :${port} revived. Consistent hash ring and Shard 1 restored.`, 'success');
  }

  async addFourthShard() {
    const btn = document.getElementById('btn-admin-add-shard');
    if (btn) btn.disabled = true;
    try {
      await api.post('/admin/shards');
      this.applyAddShard();
    } catch {
      this.applyAddShard();
    } finally {
      this.updateClusterControlsUI();
    }
  }

  applyAddShard() {
    this.hasFourthShard = true;
    if (this.ring) this.ring.setFourthShard(true);
    if (this.saga) this.saga.setFourthShard(true);
    this.updateBeneficiariesList();
    this.updateClusterControlsUI();

    const timeline = document.getElementById('admin-failure-timeline');
    if (timeline) {
      timeline.style.display = 'block';
      timeline.innerHTML = `
        <strong style="color: var(--accent-blue);">Scale-Out Resharding:</strong><br>
        Node 4 (:8084 / Shard 3) registered. Ring expanded from 450 to 600 virtual nodes.
      `;
    }

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'RING_ROUTE',
        details: 'Node 4 (:8084) registered · hash ring expanded from 450 to 600 vnodes'
      });
    }
    this.showToast('Node 4 (:8084 / Shard 3) added! Hash ring expanded to 600 vnodes.', 'success');
  }

  async removeFourthShard() {
    const btn = document.getElementById('btn-admin-remove-shard');
    if (btn) btn.disabled = true;
    try {
      await api.delete('/admin/shards/3');
      this.applyRemoveShard();
    } catch {
      this.applyRemoveShard();
    } finally {
      this.updateClusterControlsUI();
    }
  }

  applyRemoveShard() {
    this.hasFourthShard = false;
    if (this.ring) this.ring.setFourthShard(false);
    if (this.saga) this.saga.setFourthShard(false);
    this.updateBeneficiariesList();
    this.updateClusterControlsUI();

    const timeline = document.getElementById('admin-failure-timeline');
    if (timeline) {
      timeline.innerHTML = `
        <strong style="color: var(--ink);">Decommissioning:</strong><br>
        Node 4 (:8084 / Shard 3) decommissioned. Ring rebalanced back to 450 virtual slots.
      `;
    }

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'RING_ROUTE',
        details: 'Node 4 (:8084) decommissioned · ring resized to 450 vnodes'
      });
    }
    this.showToast('Node 4 (:8084) removed. Hash ring restored to 450 vnodes.', 'info');
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.tab-link').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(p => {
      p.style.display = p.id === `tab-${tabId}` ? 'block' : 'none';
    });
    if (tabId === 'history') {
      this.renderHistory();
    } else if (tabId === 'bills') {
      this.loadBills();
    }
  }

  wireEvents() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value.trim();
        const p = document.getElementById('login-password').value.trim();
        this.handleLogin(u, p);
      });
    }

    document.querySelectorAll('.btn-demo-account').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = btn.dataset.username;
        document.getElementById('login-username').value = u;
        document.getElementById('login-password').value = 'Password@123';
        this.handleLogin(u, 'Password@123');
      });
    });

    document.querySelectorAll('.tab-link').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    const signOutBtn = document.getElementById('btn-signout');
    if (signOutBtn) signOutBtn.addEventListener('click', () => this.handleSignout());

    const refBalBtn = document.getElementById('btn-refresh-balance');
    if (refBalBtn) refBalBtn.addEventListener('click', () => this.refreshBalance());

    const refHistBtn = document.getElementById('btn-refresh-history');
    if (refHistBtn) refHistBtn.addEventListener('click', () => this.renderHistory());

    const transferForm = document.getElementById('transfer-form');
    if (transferForm) {
      transferForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.executeTransfer(false);
      });
    }

    const resendBtn = document.getElementById('btn-resend-transfer');
    if (resendBtn) {
      resendBtn.addEventListener('click', () => this.executeTransfer(true));
    }

    const gearBtn = document.getElementById('btn-admin-gear');
    const adminDrawer = document.getElementById('admin-drawer');
    const closeAdminBtn = document.getElementById('btn-close-admin-drawer');

    if (gearBtn && adminDrawer) {
      gearBtn.addEventListener('click', () => adminDrawer.classList.toggle('open'));
    }
    if (closeAdminBtn && adminDrawer) {
      closeAdminBtn.addEventListener('click', () => adminDrawer.classList.remove('open'));
    }

    const killBtn = document.getElementById('btn-admin-kill-8082');
    if (killBtn) killBtn.addEventListener('click', () => this.killNode('8082'));

    const reviveBtn = document.getElementById('btn-admin-revive-8082');
    if (reviveBtn) reviveBtn.addEventListener('click', () => this.reviveNode('8082'));

    const addShardBtn = document.getElementById('btn-admin-add-shard');
    if (addShardBtn) addShardBtn.addEventListener('click', () => this.addFourthShard());

    const removeShardBtn = document.getElementById('btn-admin-remove-shard');
    if (removeShardBtn) removeShardBtn.addEventListener('click', () => this.removeFourthShard());

    const clearLogBtn = document.getElementById('btn-clear-events');
    if (clearLogBtn) clearLogBtn.addEventListener('click', () => this.eventLog?.clear());

    this.updateClusterControlsUI();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new ErodeBankingApp();
});
