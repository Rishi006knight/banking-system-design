import { HashRingVisualizer } from './components/ring.js';
import { SagaVisualizer } from './components/saga.js';
import { EventLogStream } from './components/event-log.js';
class BankingApp {
  constructor() {
    this.apiUrl = this.resolveApiUrl();
    this.token = localStorage.getItem('esss_token');
    this.user = JSON.parse(localStorage.getItem('esss_user') || 'null');
    this.activeTab = 'balance';
    this.killedNodes = new Set();
    this.hasFourthShard = false;
    this.sparklineData = Array(30).fill(1.5);
    this.isOffline = false;
    this.ring = null;
    this.saga = null;
    this.eventLog = null;
    this.tokenBuckets = {
      login: { capacity: 5, tokens: 5, max: 5 },
      transfer: { capacity: 30, tokens: 30, max: 30 },
      enquiry: { capacity: 120, tokens: 120, max: 120 }
    };
    this.kvKeys = [
      { key: 'session:aarav.sharma1', ttl: 890, type: 'SESSION' },
      { key: 'bal:ACC-0000001', ttl: 54, type: 'BALANCE' },
      { key: 'idem:TRF-9021', ttl: 86320, type: 'IDEMPOTENCY' },
      { key: 'otp:ACC-0000001', ttl: 240, type: 'AUTH' },
      { key: 'rate:client-127.0.0.1', ttl: 42, type: 'RATELIMIT' }
    ];
    this.init();
  }
  resolveApiUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('gateway')) {
      return urlParams.get('gateway').replace(/\/$/, '');
    }
    if (localStorage.getItem('GATEWAY_URL')) {
      return localStorage.getItem('GATEWAY_URL').replace(/\/$/, '');
    }
    if (window.GATEWAY_URL) {
      return window.GATEWAY_URL.replace(/\/$/, '');
    }
    if (window.location.port === '8080' || window.location.hostname.includes('onrender.com')) {
      return window.location.origin;
    }
    return 'http://localhost:8080';
  }
  init() {
    const ringEl = document.getElementById('hash-ring-container');
    if (ringEl) this.ring = new HashRingVisualizer(ringEl);
    const sagaEl = document.getElementById('saga-container');
    if (sagaEl) this.saga = new SagaVisualizer(sagaEl);
    const logEl = document.getElementById('event-log-container');
    if (logEl) this.eventLog = new EventLogStream(logEl);
    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'SYSTEM_BOOT',
        status: 200,
        latencyMs: 1,
        node: 'gateway:8080',
        shard: 'cluster-mesh',
        details: 'API Gateway initialized with 3 cluster shard nodes and 450 virtual ring slots'
      });
    }
    this.wireEvents();
    this.renderAuthState();
    this.pollMetrics();
    this.metricsTimer = setInterval(() => this.pollMetrics(), 1000);
    this.ttlTimer = setInterval(() => this.updateTtlCountdowns(), 1000);
  }
  async apiFetch(endpoint, options = {}) {
    const start = performance.now();
    const headers = new Headers(options.headers || {});
    if (this.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    const fullUrl = this.apiUrl + endpoint;
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers
      });
      const latency = Math.round(performance.now() - start);
      const servedBy = response.headers.get('X-Served-By') || 'node:8082';
      const shard = response.headers.get('X-Shard') || '1';
      const cacheHit = response.headers.get('X-Cache-Hit') === 'true' || response.headers.get('X-Cache-Hit') === 'HIT';
      const retryAfter = response.headers.get('Retry-After');
      this.updateTraceStrip({
        gateway: 'gateway:8080',
        node: servedBy,
        shard: shard,
        cacheHit: cacheHit,
        latency: latency,
        status: response.status
      });
      this.pushSparklineSample(latency);
      if (response.status === 429) {
        this.handleRateLimitDrop(retryAfter || 60, endpoint);
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Rate limited — retry in ${retryAfter || 60}s`);
      }
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `HTTP ${response.status}`);
      }
      const data = await response.json();
      return { data, headers: response.headers, latency };
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        this.setOfflineState(true);
      }
      throw err;
    }
  }
  updateTraceStrip({ gateway, node, shard, cacheHit, latency, status }) {
    const stripEl = document.getElementById('global-trace-strip');
    if (!stripEl) return;
    stripEl.style.display = 'flex';
    stripEl.innerHTML = `
      <span>→ <strong>${gateway}</strong></span>
      <span style="color: #9aa3b2;">·</span>
      <span>routed → <strong style="color: #1f6fd1;">${node}</strong></span>
      <span style="color: #9aa3b2;">·</span>
      <span>shard: <strong>${shard}</strong></span>
      <span style="color: #9aa3b2;">·</span>
      <span>cache: <strong style="color: ${cacheHit ? '#2e9e5b' : '#e8832a'};">${cacheHit ? 'HIT' : 'MISS'}</strong></span>
      <span style="color: #9aa3b2;">·</span>
      <span style="color: #2e9e5b; font-weight: 700;">${latency}ms</span>
      ${status === 429 ? `<span style="color: #d64545; font-weight: 800; margin-left: 8px;">[429 THROTTLED]</span>` : ''}
    `;
  }
  pushSparklineSample(val) {
    this.sparklineData.push(val);
    if (this.sparklineData.length > 30) this.sparklineData.shift();
    this.renderSparkline();
  }
  renderSparkline() {
    const el = document.getElementById('latency-sparkline');
    if (!el) return;
    const max = Math.max(...this.sparklineData, 20);
    const w = 180;
    const h = 28;
    const step = w / (this.sparklineData.length - 1);
    const points = this.sparklineData
      .map((val, idx) => {
        const x = (idx * step).toFixed(1);
        const y = (h - (val / max) * (h - 4)).toFixed(1);
        return `${x},${y}`;
      })
      .join(' ');
    el.innerHTML = `
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <polyline fill="none" stroke="#1f6fd1" stroke-width="1.8" points="${points}" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
  }
  setOfflineState(offline) {
    this.isOffline = offline;
    const banner = document.getElementById('offline-banner');
    if (banner) {
      banner.style.display = offline ? 'block' : 'none';
    }
  }
  async pollMetrics() {
    try {
      const res = await fetch(`${this.apiUrl}/admin/metrics`, { method: 'GET' });
      if (!res.ok) throw new Error('Metrics endpoint unavailable');
      const data = await res.json();
      this.setOfflineState(false);
      this.updateMetricsUI(data);
    } catch {
      this.setOfflineState(true);
      this.updateMetricsUI({
        rateLimiter: { totalRequests: 142, allowedRequests: 138, rejectedRequests: 4, activeBuckets: 3 },
        keyValueStore: { hitRatioPercent: 88.5, activeKeys: 28, avgGetLatencyNanos: 420000 },
        uniqueIdGenerator: { totalGenerated: 180240, generationRatePerSecond: 12 },
        consistentHashRing: { nodeCount: this.hasFourthShard ? 4 : 3, totalVirtualNodes: this.hasFourthShard ? 600 : 450 }
      });
    }
  }
  updateMetricsUI(metrics) {
    if (!metrics) return;
    const rl = metrics.rateLimiter || {};
    this.animateNumber('metric-rl-allowed', rl.allowedRequests ?? 138);
    this.animateNumber('metric-rl-throttled', rl.rejectedRequests ?? 0);
    const chr = metrics.consistentHashRing || {};
    const nodesCount = chr.nodeCount ?? (this.hasFourthShard ? 4 : 3);
    const vnodes = chr.totalVirtualNodes ?? (nodesCount * 150);
    this.animateNumber('metric-ring-nodes', nodesCount);
    this.animateNumber('metric-ring-vnodes', vnodes);
    const kv = metrics.keyValueStore || {};
    const hitRatio = (kv.hitRatioPercent ?? 88.5).toFixed(1);
    this.animateNumber('metric-kv-hitratio', hitRatio, '%');
    this.animateNumber('metric-kv-keys', kv.activeKeys ?? 28);
    const latencyMs = ((kv.avgGetLatencyNanos ?? 400000) / 1000000).toFixed(2);
    const latEl = document.getElementById('metric-kv-latency');
    if (latEl) latEl.textContent = `${latencyMs} ms`;
    const gaugeEl = document.getElementById('kv-gauge-fill');
    if (gaugeEl) gaugeEl.style.width = `${Math.min(100, Math.max(0, hitRatio))}%`;
    const sf = metrics.uniqueIdGenerator || {};
    this.animateNumber('metric-sf-count', sf.totalGenerated ?? 180240);
  }
  animateNumber(elementId, targetValue, suffix = '') {
    const el = document.getElementById(elementId);
    if (!el) return;
    const current = el.getAttribute('data-value');
    if (current === String(targetValue)) return;
    el.setAttribute('data-value', targetValue);
    el.classList.add('num-changing');
    el.textContent = `${targetValue}${suffix}`;
    setTimeout(() => {
      el.classList.remove('num-changing');
    }, 250);
  }
  updateTtlCountdowns() {
    this.kvKeys.forEach(k => {
      if (k.ttl > 0) k.ttl -= 1;
    });
    const el = document.getElementById('kv-keys-list');
    if (!el) return;
    el.innerHTML = this.kvKeys.map(k => {
      const mins = Math.floor(k.ttl / 60);
      const secs = k.ttl % 60;
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      return `
        <div class="kv-key-pill" style="
          display: flex; justify-content: space-between; align-items: center; padding: 4px 8px;
          background: #ffffff; border: 1px solid #e5e7eb; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 10px; margin-bottom: 3px;
        ">
          <span style="color: #12305f; font-weight: 600;">${k.key}</span>
          <span style="color: #2e9e5b; font-weight: 700;">TTL: ${timeStr}</span>
        </div>
      `;
    }).join('');
  }
  handleRateLimitDrop(retrySeconds, endpoint) {
    const pill = document.getElementById('rate-limit-pill');
    if (pill) {
      pill.style.display = 'inline-block';
      pill.textContent = `Retry-After: ${retrySeconds}s`;
      setTimeout(() => { pill.style.display = 'none'; }, retrySeconds * 1000);
    }
    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'RATE_LIMIT_DROP',
        status: 429,
        latencyMs: 0,
        node: 'gateway:8080',
        shard: 'token-bucket',
        details: `⛔ HTTP 429 Throttle on ${endpoint}. Rate limit threshold exceeded. Retry after ${retrySeconds}s.`
      });
    }
    const bar = document.getElementById('bucket-bar-login');
    if (bar) {
      bar.classList.add('bar-flash-red');
      setTimeout(() => bar.classList.remove('bar-flash-red'), 1200);
    }
  }
  async handleLogin(username, password) {
    const submitBtn = document.getElementById('btn-login-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';
    }
    try {
      const { data, headers, latency } = await this.apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      this.token = data.token;
      this.user = {
        id: data.customerId || data.userId || '1',
        username: username,
        name: data.name || (username.startsWith('aarav') ? 'Aarav Sharma' : username.startsWith('diya') ? 'Diya Patel' : 'Kavya Nair'),
        accountId: data.accountId || 'ACC-0000001'
      };
      localStorage.setItem('esss_token', this.token);
      localStorage.setItem('esss_user', JSON.stringify(this.user));
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'LOGIN_ALLOWED',
          status: 200,
          latencyMs: latency,
          node: headers.get('X-Served-By') || 'node:8081',
          shard: headers.get('X-Shard') || '0',
          details: `Authenticated customer ${username} (${this.user.accountId}). Session token generated.`
        });
      }
      this.kvKeys.unshift({ key: `session:${this.token.slice(-8)}`, ttl: 900, type: 'SESSION' });
      this.renderAuthState();
    } catch (err) {
      alert(err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to Account';
      }
    }
  }
  handleLogout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('esss_token');
    localStorage.removeItem('esss_user');
    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'LOGOUT',
        status: 200,
        latencyMs: 1,
        node: 'gateway:8080',
        shard: 'session-store',
        details: 'Customer session terminated securely.'
      });
    }
    this.renderAuthState();
  }
  renderAuthState() {
    const loginCard = document.getElementById('login-panel');
    const dashboard = document.getElementById('dashboard-panel');
    const userBar = document.getElementById('header-user-bar');
    if (this.user && this.token) {
      if (loginCard) loginCard.style.display = 'none';
      if (dashboard) dashboard.style.display = 'block';
      if (userBar) {
        userBar.style.display = 'flex';
        document.getElementById('header-user-name').textContent = this.user.name;
        document.getElementById('header-user-account').textContent = this.user.accountId;
      }
      this.loadDashboardData();
    } else {
      if (loginCard) loginCard.style.display = 'block';
      if (dashboard) dashboard.style.display = 'none';
      if (userBar) userBar.style.display = 'none';
    }
  }
  async loadDashboardData() {
    if (!this.user) return;
    this.refreshBalance();
    this.loadTransactions();
    this.loadBeneficiaries();
    this.loadBills();
    this.generateNewIdempotencyKey();
  }
  async refreshBalance() {
    if (!this.user) return;
    const btn = document.getElementById('btn-refresh-balance');
    if (btn) btn.classList.add('spinning');
    try {
      const { data, headers, latency } = await this.apiFetch(`/accounts/${this.user.accountId}/balance`);
      const balEl = document.getElementById('balance-display-amount');
      const inr = data.balanceInr ?? ((data.balanceCents || 0) / 100);
      if (balEl) balEl.textContent = `₹ ${Number(inr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      const servedBy = headers.get('X-Served-By') || 'node:8081';
      const shard = headers.get('X-Shard') || '0';
      const cacheHit = headers.get('X-Cache-Hit') === 'true';
      const tagEl = document.getElementById('balance-meta-tag');
      if (tagEl) {
        tagEl.innerHTML = `Served by: <strong>${servedBy}</strong> &bull; Shard: <strong>${shard}</strong> &bull; Cache: <strong style="color: ${cacheHit ? '#2e9e5b' : '#e8832a'};">${cacheHit ? 'HIT (0.4ms)' : 'MISS'}</strong>`;
      }
      if (this.ring) {
        this.ring.routeTo(servedBy, this.user.accountId);
      }
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: cacheHit ? 'CACHE_HIT' : 'CACHE_MISS',
          status: 200,
          latencyMs: latency,
          node: servedBy,
          shard: shard,
          cacheHit: cacheHit,
          details: `Balance query for ${this.user.accountId}: ₹${inr} (${cacheHit ? 'L1 RAM Cache Hit' : 'SQLite Disk Read'})`
        });
      }
    } catch (err) {
      console.warn('Balance refresh failed:', err);
    } finally {
      if (btn) setTimeout(() => btn.classList.remove('spinning'), 400);
    }
  }
  generateNewIdempotencyKey() {
    const raw = 'IDEM-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const input = document.getElementById('transfer-idempotency-key');
    if (input) input.value = raw;
    return raw;
  }
  async executeTransfer(isResend = false) {
    if (!this.user) return;
    const toAcc = document.getElementById('transfer-to-account').value.trim();
    const amount = parseFloat(document.getElementById('transfer-amount').value);
    const idemKey = document.getElementById('transfer-idempotency-key').value.trim() || this.generateNewIdempotencyKey();
    if (!toAcc || isNaN(amount) || amount <= 0) {
      alert('Please provide a valid destination account number and transfer amount');
      return;
    }
    const sendBtn = document.getElementById('btn-send-transfer');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Processing Saga Transfer...';
    }
    if (this.saga) {
      this.saga.startSaga(this.user.accountId, toAcc, amount);
    }
    if (this.eventLog) {
      this.eventLog.addEvent({
        action: isResend ? 'TRANSFER_RESEND' : 'TRANSFER_INITIATED',
        status: 200,
        latencyMs: 2,
        node: 'gateway:8080',
        shard: 'cross-shard',
        details: `Transfer ₹${amount} from ${this.user.accountId} to ${toAcc} (Idem-Key: ${idemKey})`
      });
    }
    try {
      const { data, headers, latency } = await this.apiFetch('/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey
        },
        body: JSON.stringify({
          sourceAccountId: this.user.accountId,
          destAccountId: toAcc,
          amountCents: Math.round(amount * 100),
          description: `Transfer to ${toAcc}`
        })
      });
      const resBadge = document.getElementById('transfer-suppressed-badge');
      if (resBadge) {
        if (isResend || data.message?.includes('idempotent') || data.status === 'DUPLICATE_SUPPRESSED') {
          resBadge.style.display = 'inline-block';
        } else {
          resBadge.style.display = 'none';
        }
      }
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'SAGA_COMPLETED',
          status: 200,
          latencyMs: latency,
          node: headers.get('X-Served-By') || 'node:8081',
          shard: headers.get('X-Shard') || '0',
          details: `Saga Committed: Transfer Ref #${data.transferId || 'TRF-106'} settled across shards without double-spend.`
        });
      }
      this.refreshBalance();
      this.loadTransactions();
      if (!isResend) {
        this.generateNewIdempotencyKey();
      }
    } catch (err) {
      if (this.saga) {
        this.saga.failSaga(this.user.accountId, toAcc, amount);
      }
      alert('Transfer failed: ' + err.message);
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Funds (2-Phase Saga)';
      }
    }
  }
  async loadTransactions() {
    if (!this.user) return;
    try {
      const { data, headers } = await this.apiFetch(`/accounts/${this.user.accountId}/transactions?page=0&size=10`);
      const items = data.items || data || [];
      const tbody = document.getElementById('tx-history-tbody');
      if (!tbody) return;
      const servedShard = headers.get('X-Shard') || '0';
      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #9aa3b2; padding: 24px;">No transactions recorded on this account shard yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = items.map(tx => {
        const isCredit = tx.type === 'CREDIT';
        const dateStr = new Date(tx.createdAt || Date.now()).toLocaleDateString('en-IN', {
          month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        const amt = tx.amountInr ?? ((tx.amountCents || 0) / 100);
        const bal = tx.balanceAfterInr ?? ((tx.balanceAfterCents || 0) / 100);
        return `
          <tr>
            <td style="color: #64748b;">${dateStr}</td>
            <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">${tx.transactionId || 'TRF-10928'}</td>
            <td><strong>${tx.description || 'Fund Transfer'}</strong></td>
            <td>
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${isCredit ? '#ecfdf5' : '#fbe7e7'}; color: ${isCredit ? '#2e9e5b' : '#d64545'};">
                ${tx.type}
              </span>
            </td>
            <td style="font-weight: 700; color: ${isCredit ? '#2e9e5b' : '#d64545'};">
              ${isCredit ? '+' : '-'} ₹${Number(amt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td style="font-family: 'JetBrains Mono', monospace;">₹${Number(bal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td>
              <span style="font-size: 10px; font-family: 'JetBrains Mono', monospace; padding: 2px 5px; border-radius: 3px; background: #e8f0fb; color: #1f6fd1;">
                shard-${tx.shardId || servedShard}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    } catch {
    }
  }
  loadBeneficiaries() {
    const list = [
      { name: 'Diya Patel', account: 'ACC-0000002', shard: 'Shard 1 (:8082)' },
      { name: 'Kavya Nair', account: 'ACC-0000004', shard: 'Shard 2 (:8083)' },
      { name: 'Saravana Rishi', account: 'ACC-0000005', shard: 'Shard 0 (:8081)' }
    ];
    const el = document.getElementById('beneficiaries-list');
    if (!el) return;
    el.innerHTML = list.map(b => `
      <div class="bene-item" style="
        display: flex; justify-content: space-between; align-items: center; padding: 10px;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px;
      ">
        <div>
          <div style="font-weight: 700; color: #12305f;">${b.name}</div>
          <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #64748b;">
            ${b.account} &bull; ${b.shard}
          </div>
        </div>
        <button class="btn-subtle" onclick="window.app.selectBeneficiary('${b.account}')">
          Transfer ▶
        </button>
      </div>
    `).join('');
  }
  selectBeneficiary(acc) {
    const input = document.getElementById('transfer-to-account');
    if (input) input.value = acc;
    this.switchTab('transfer');
  }
  loadBills() {
    const bills = [
      { id: 'BILL-EL-89', name: 'TNEB Electricity Bill', amount: 840, due: 'In 3 days' },
      { id: 'BILL-BB-41', name: 'Airtel Fiber Broadband', amount: 1199, due: 'In 7 days' },
      { id: 'BILL-WT-12', name: 'Erode Municipal Water', amount: 320, due: 'Paid' }
    ];
    const el = document.getElementById('bills-list');
    if (!el) return;
    el.innerHTML = bills.map(b => `
      <div class="bill-row" style="
        display: flex; justify-content: space-between; align-items: center; padding: 10px;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px;
      ">
        <div>
          <div style="font-weight: 700; color: #12305f;">${b.name}</div>
          <div style="font-size: 11px; color: #64748b;">Invoice ID: ${b.id} &bull; ${b.due}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 14px; color: #12305f; margin-bottom: 4px;">₹${b.amount}</div>
          ${b.due === 'Paid' ? `
            <span style="font-size: 10px; font-weight: 700; color: #2e9e5b; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">PAID ✓</span>
          ` : `
            <button class="btn-subtle" onclick="window.app.payBill('${b.id}', ${b.amount})">Pay BBPS</button>
          `}
        </div>
      </div>
    `).join('');
  }
  async payBill(billId, amount) {
    if (!this.user) return;
    try {
      const idemKey = 'BILL-' + Date.now();
      await this.apiFetch('/billpayments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey },
        body: JSON.stringify({
          accountId: this.user.accountId,
          billId: billId,
          amountCents: amount * 100
        })
      });
      alert(`Bill ${billId} (₹${amount}) settled successfully!`);
      this.refreshBalance();
      this.loadTransactions();
    } catch (err) {
      alert('Bill payment error: ' + err.message);
    }
  }
  async killNode(port) {
    const btn = document.getElementById(`btn-kill-${port}`);
    if (btn) btn.disabled = true;
    try {
      const { data } = await this.apiFetch(`/admin/nodes/${port}/kill`, { method: 'POST' });
      this.killedNodes.add(String(port));
      if (this.ring) this.ring.setKilledNodes(this.killedNodes);
      const t0 = data.evictedAt || Date.now();
      const timelineEl = document.getElementById('failure-timeline-strip');
      if (timelineEl) {
        timelineEl.style.display = 'block';
        timelineEl.innerHTML = `
          <strong>Failure Detection Timeline:</strong>
          <span>t=0s kill signal</span> →
          <span>t=5.0s probe 1 fail</span> →
          <span>t=10.0s probe 2 fail</span> →
          <span style="color: #d64545; font-weight: 700;">t=10.1s node :${port} evicted</span> →
          <span style="color: #2e9e5b; font-weight: 700;">t=10.2s vnodes migrated</span>
        `;
      }
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'NODE_DOWN',
          status: 500,
          latencyMs: 12,
          node: `node:${port}`,
          shard: `bank-shard-${parseInt(port) - 8081}`,
          details: `Node :${port} killed! Gateway evicted node from hash ring. 150 vnodes redistributed to survivors.`
        });
      }
    } catch (err) {
      alert('Kill node error: ' + err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  async reviveNode(port) {
    const btn = document.getElementById(`btn-revive-${port}`);
    if (btn) btn.disabled = true;
    try {
      await this.apiFetch(`/admin/nodes/${port}/revive`, { method: 'POST' });
      this.killedNodes.delete(String(port));
      if (this.ring) this.ring.setKilledNodes(this.killedNodes);
      const timelineEl = document.getElementById('failure-timeline-strip');
      if (timelineEl) {
        timelineEl.innerHTML = `
          <strong style="color: #2e9e5b;">Node Recovery:</strong>
          <span>Node :${port} responded to health probe. Re-added to hash ring with 150 virtual ring slots restored.</span>
        `;
      }
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'NODE_REJOINED',
          status: 200,
          latencyMs: 8,
          node: `node:${port}`,
          shard: `bank-shard-${parseInt(port) - 8081}`,
          details: `Node :${port} recovered! Re-joined consistent hash ring. Topology balanced.`
        });
      }
    } catch (err) {
      alert('Revive node error: ' + err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }
  async addFourthShard() {
    try {
      await this.apiFetch('/admin/shards', { method: 'POST' });
      this.hasFourthShard = true;
      if (this.ring) this.ring.setFourthShard(true);
      if (this.eventLog) {
        this.eventLog.addEvent({
          action: 'SHARD_EXPAND',
          status: 200,
          latencyMs: 15,
          node: 'gateway:8080',
          shard: 'bank-shard-3',
          details: '4th Shard (:8084) registered in cluster! Hash ring expanded from 450 to 600 virtual nodes.'
        });
      }
      alert('4th Shard successfully registered! Ring updated to 600 vnodes.');
    } catch (err) {
      alert('Add shard error: ' + err.message);
    }
  }
  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content-panel').forEach(p => {
      p.style.display = p.id === `tab-${tabId}` ? 'block' : 'none';
    });
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
    document.querySelectorAll('.demo-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const acc = btn.dataset.account;
        document.getElementById('login-username').value = acc;
        document.getElementById('login-password').value = 'Password@123';
      });
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
    const refreshBtn = document.getElementById('btn-refresh-balance');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshBalance());
    }
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
    const adminToggle = document.getElementById('btn-admin-drawer-toggle');
    const adminDrawer = document.getElementById('admin-drawer');
    const adminClose = document.getElementById('btn-admin-drawer-close');
    if (adminToggle && adminDrawer) {
      adminToggle.addEventListener('click', () => {
        adminDrawer.classList.toggle('open');
      });
    }
    if (adminClose && adminDrawer) {
      adminClose.addEventListener('click', () => {
        adminDrawer.classList.remove('open');
      });
    }
    const killBtn = document.getElementById('btn-kill-8082');
    if (killBtn) killBtn.addEventListener('click', () => this.killNode('8082'));
    const reviveBtn = document.getElementById('btn-revive-8082');
    if (reviveBtn) reviveBtn.addEventListener('click', () => this.reviveNode('8082'));
    const addShardBtn = document.getElementById('btn-add-shard');
    if (addShardBtn) addShardBtn.addEventListener('click', () => this.addFourthShard());
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => this.handleLogout());
    const clearLogBtn = document.getElementById('btn-clear-events');
    if (clearLogBtn) clearLogBtn.addEventListener('click', () => this.eventLog.clear());
  }
}
window.addEventListener('DOMContentLoaded', () => {
  window.app = new BankingApp();
});
