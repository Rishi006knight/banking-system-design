import { api } from './api.js';
import { HashRingVisualizer } from './components/ring.js';
import { TokenBucketVisualizer } from './components/token-bucket.js';
import { SagaVisualizer } from './components/saga.js';
import { KvStoreVisualizer } from './components/kv-store.js';
import { SnowflakeVisualizer } from './components/snowflake.js';
import { EventLogStream } from './components/event-log.js';

export const BANK_CUSTOMERS_DIRECTORY = [
  { accountId: 'ACC-0000001', name: 'Aarav Sharma', shardId: 0, port: '8081', branch: 'Erode Main', ifsc: 'ESSS0001001', category: 'Platinum Savings' },
  { accountId: 'ACC-0000002', name: 'Diya Patel', shardId: 1, port: '8082', branch: 'Coimbatore RS Puram', ifsc: 'ESSS0001002', category: 'Gold Savings' },
  { accountId: 'ACC-0000003', name: 'Rohan Verma', shardId: 0, port: '8081', branch: 'Chennai Anna Nagar', ifsc: 'ESSS0001003', category: 'Corporate Salary' },
  { accountId: 'ACC-0000004', name: 'Kavya Nair', shardId: 2, port: '8083', branch: 'Salem Fairlands', ifsc: 'ESSS0001004', category: 'Platinum Savings' },
  { accountId: 'ACC-0000005', name: 'Saravana Rishi', shardId: 0, port: '8081', branch: 'Erode Perundurai', ifsc: 'ESSS0001005', category: 'Executive Current' },
  { accountId: 'ACC-0000006', name: 'Meera Krishnan', shardId: 3, port: '8084', branch: 'Bangalore Indiranagar', ifsc: 'ESSS0001006', category: 'NRI Prime' },
  { accountId: 'ACC-0000007', name: 'Aditya Kulkarni', shardId: 1, port: '8082', branch: 'Mumbai Bandra', ifsc: 'ESSS0001007', category: 'Regular Savings' },
  { accountId: 'ACC-0000008', name: 'Ananya Iyer', shardId: 2, port: '8083', branch: 'Madurai Simmakkal', ifsc: 'ESSS0001008', category: 'Platinum Savings' },
  { accountId: 'ACC-0000009', name: 'Vikram Singhania', shardId: 0, port: '8081', branch: 'Kolkata Park Street', ifsc: 'ESSS0001009', category: 'Wealth Privilege' },
  { accountId: 'ACC-0000010', name: 'Pooja Hegde', shardId: 1, port: '8082', branch: 'Mangalore Hampankatta', ifsc: 'ESSS0001010', category: 'Retail Savings' },
  { accountId: 'ACC-0000011', name: 'Karthik Subramaniam', shardId: 2, port: '8083', branch: 'Tiruchirappalli Cantt', ifsc: 'ESSS0001011', category: 'Corporate Salary' },
  { accountId: 'ACC-0000012', name: 'Sneha Reddy', shardId: 3, port: '8084', branch: 'Hyderabad Hitec City', ifsc: 'ESSS0001012', category: 'Gold Savings' },
  { accountId: 'ACC-0000013', name: 'Rajeshwari Sundaram', shardId: 0, port: '8081', branch: 'Tirunelveli Junction', ifsc: 'ESSS0001013', category: 'Senior Citizen Prime' },
  { accountId: 'ACC-0000014', name: 'Nikhil Bansal', shardId: 1, port: '8082', branch: 'Delhi Connaught Place', ifsc: 'ESSS0001014', category: 'Platinum Savings' },
  { accountId: 'ACC-0000015', name: 'Swati Deshmukh', shardId: 2, port: '8083', branch: 'Pune Kothrud', ifsc: 'ESSS0001015', category: 'Retail Savings' },
  { accountId: 'ACC-0000016', name: 'Arjun Balakrishnan', shardId: 3, port: '8084', branch: 'Kochi Marine Drive', ifsc: 'ESSS0001016', category: 'Executive Current' },
  { accountId: 'ACC-0000017', name: 'Priya Nambiar', shardId: 0, port: '8081', branch: 'Calicut Palayam', ifsc: 'ESSS0001017', category: 'Regular Savings' },
  { accountId: 'ACC-0000018', name: 'Harish Madhavan', shardId: 1, port: '8082', branch: 'Vellore Fort Area', ifsc: 'ESSS0001018', category: 'Gold Savings' },
  { accountId: 'ACC-0000019', name: 'Divya Venkataraman', shardId: 2, port: '8083', branch: 'Thanjavur Old Bus Stand', ifsc: 'ESSS0001019', category: 'Platinum Savings' },
  { accountId: 'ACC-0000020', name: 'Manoj Chandrasekaran', shardId: 3, port: '8084', branch: 'Hosur Sipcot', ifsc: 'ESSS0001020', category: 'Corporate Salary' },
  { accountId: 'ACC-0000021', name: 'Ritu Sengupta', shardId: 0, port: '8081', branch: 'Bhubaneswar Saheed Nagar', ifsc: 'ESSS0001021', category: 'Retail Savings' },
  { accountId: 'ACC-0000022', name: 'Siddharth Menon', shardId: 1, port: '8082', branch: 'Thrissur Round', ifsc: 'ESSS0001022', category: 'Wealth Privilege' },
  { accountId: 'ACC-0000023', name: 'Tanvi Joshi', shardId: 2, port: '8083', branch: 'Ahmedabad Navrangpura', ifsc: 'ESSS0001023', category: 'Gold Savings' },
  { accountId: 'ACC-0000024', name: 'Ashwin Ramachandran', shardId: 3, port: '8084', branch: 'Mysore Saraswathipuram', ifsc: 'ESSS0001024', category: 'Executive Current' },
  { accountId: 'ACC-0000025', name: 'Lavanya Narayanan', shardId: 0, port: '8081', branch: 'Kanchipuram Gandhi Road', ifsc: 'ESSS0001025', category: 'Platinum Savings' },
  { accountId: 'ACC-0000026', name: 'Gaurav Chatterjee', shardId: 1, port: '8082', branch: 'Guwahati Pan Bazar', ifsc: 'ESSS0001026', category: 'Regular Savings' },
  { accountId: 'ACC-0000027', name: 'Shalini Pillai', shardId: 2, port: '8083', branch: 'Trivandrum Kowdiar', ifsc: 'ESSS0001027', category: 'Senior Citizen Prime' },
  { accountId: 'ACC-0000028', name: 'Pranav Srinivasan', shardId: 3, port: '8084', branch: 'Dindigul Bus Stand', ifsc: 'ESSS0001028', category: 'Corporate Salary' }
];

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
    const found = BANK_CUSTOMERS_DIRECTORY.find(c => c.accountId === accountId);
    if (found) return String(found.shardId);
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

      const cleanU = (username || '').toLowerCase().trim();
      const dirCustomer = BANK_CUSTOMERS_DIRECTORY.find(c =>
        c.accountId.toLowerCase() === cleanU ||
        c.name.toLowerCase().replace(/\s+/g, '.').includes(cleanU) ||
        cleanU.includes(c.accountId.toLowerCase()) ||
        cleanU.includes(c.name.toLowerCase().split(' ')[0])
      );

      const demo = dirCustomer
        ? { name: dirCustomer.name, acc: dirCustomer.accountId }
        : (accMap[username] || { name: username, acc: 'ACC-0000001' });

      this.token = `demo-token-${Date.now()}`;
      this.user = { id: demo.acc.replace(/\D/g, '') || '1', username, name: demo.name, accountId: demo.acc };
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

  switchAccount(targetAccountId) {
    if (!targetAccountId) return;
    const customer = BANK_CUSTOMERS_DIRECTORY.find(c => c.accountId === targetAccountId);
    const name = customer ? customer.name : targetAccountId;
    this.token = `demo-token-${Date.now()}`;
    this.user = {
      id: targetAccountId.replace(/\D/g, '') || '1',
      username: customer ? customer.name.toLowerCase().replace(/\s+/g, '.') : targetAccountId,
      name,
      accountId: targetAccountId
    };
    api.setToken(this.token);
    localStorage.setItem('esss_token', this.token);
    localStorage.setItem('esss_user', JSON.stringify(this.user));

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'LOGIN_ALLOWED',
        details: `Switched account to ${name} (${targetAccountId}) · Shard ${this.getShardForAccount(targetAccountId)}`
      });
    }

    this.showToast(`Switched account to ${name} (${targetAccountId})`, 'info');
    this.renderSessionState();
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

  populateLoginDirectory() {
    const select = document.getElementById('login-directory-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Choose Account to Sign In (28 Accounts) --</option>' +
      BANK_CUSTOMERS_DIRECTORY.map(c => `
        <option value="${c.accountId}" data-username="${c.name.toLowerCase().replace(/\s+/g, '.')}">
          ${c.name} (${c.accountId} · Shard ${c.shardId} · ${c.branch})
        </option>
      `).join('');
  }

  renderSessionState() {
    const loginView = document.getElementById('login-view');
    const dashView = document.getElementById('dashboard-view');
    const chipBox = document.getElementById('user-chip-container');
    const nameEl = document.getElementById('user-display-name');
    const accEl = document.getElementById('user-display-account');
    const switcher = document.getElementById('header-account-switcher');

    this.populateLoginDirectory();

    if (this.user && this.token) {
      if (loginView) loginView.style.display = 'none';
      if (dashView) dashView.style.display = 'flex';
      if (chipBox) chipBox.style.display = 'flex';

      if (nameEl) nameEl.textContent = this.user.name;
      if (accEl) accEl.textContent = this.user.accountId;

      if (switcher) {
        switcher.innerHTML = BANK_CUSTOMERS_DIRECTORY.map(c => `
          <option value="${c.accountId}" ${c.accountId === this.user.accountId ? 'selected' : ''}>
            ${c.name} (${c.accountId})
          </option>
        `).join('');
      }

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
    this.refreshTransactions();
    this.updateBeneficiariesList();
    this.loadBills();
    this.renderHistory();
    this.generateNewIdempotencyKey();

    if (this.ring && this.user) {
      const port = this.getNodeForShard(this.getShardForAccount(this.user.accountId)).replace(/\D/g, '');
      this.ring.routeTo(port, this.user.accountId);
    }
  }

  getDefaultBalanceForAccount(accId) {
    const defaults = {
      'ACC-0000001': 25420.50,
      'ACC-0000002': 18750.00,
      'ACC-0000004': 32100.00
    };
    if (defaults[accId] !== undefined) return defaults[accId];
    const num = parseInt((accId || '').replace(/\D/g, '') || '1', 10);
    return Math.round((14000.00 + (num * 1250.75)) * 100) / 100;
  }

  getDefaultTransactionsForAccount(accId, bal) {
    const shardId = parseInt(this.getShardForAccount(accId), 10);
    const openingCredit = Math.round(bal * 0.75 * 100) / 100;
    return [
      {
        transactionId: `TRF-${Date.now() - 3600000 * 12}`,
        description: 'Salary Direct Deposit',
        type: 'CREDIT',
        amountInr: openingCredit,
        balanceAfterInr: bal,
        shardId: shardId,
        createdAt: Date.now() - 3600000 * 12
      }
    ];
  }

  creditRecipientAccount(toAcc, amount, sfId, dstShard, remarks = '') {
    if (!toAcc) return;

    // 1. Recipient balance
    const recipientBalKey = `esss_balance_${toAcc}`;
    const savedBal = localStorage.getItem(recipientBalKey);
    let recipientBal;
    if (savedBal !== null) {
      recipientBal = parseFloat(savedBal);
    } else {
      recipientBal = this.getDefaultBalanceForAccount(toAcc);
    }
    const newRecipientBal = Math.round((recipientBal + amount) * 100) / 100;
    localStorage.setItem(recipientBalKey, newRecipientBal.toFixed(2));

    // 2. Recipient transactions
    const recipientTxsKey = `esss_txs_${toAcc}`;
    const savedTxs = localStorage.getItem(recipientTxsKey);
    let recipientTxs = [];
    if (savedTxs) {
      try {
        recipientTxs = JSON.parse(savedTxs);
      } catch {
        recipientTxs = [];
      }
    } else {
      recipientTxs = this.getDefaultTransactionsForAccount(toAcc, recipientBal);
    }

    const senderName = this.user?.name || this.user?.accountId || 'Account Holder';
    const cleanRemarks = (remarks || '').trim();
    const desc = cleanRemarks
      ? `Transfer from ${senderName} (${this.user?.accountId || ''}) · ${cleanRemarks}`
      : `Transfer from ${senderName} (${this.user?.accountId || ''})`;

    const creditTx = {
      transactionId: sfId ? `CR-${sfId}` : (this.snowflake ? this.snowflake.generateId('TRF') : `TRF-${Date.now()}`),
      description: desc,
      type: 'CREDIT',
      amountInr: amount,
      balanceAfterInr: newRecipientBal,
      shardId: dstShard ?? parseInt(this.getShardForAccount(toAcc), 10),
      createdAt: Date.now()
    };

    const updatedTxs = [creditTx, ...recipientTxs];
    localStorage.setItem(recipientTxsKey, JSON.stringify(updatedTxs));

    // 3. If currently logged in as recipient (e.g. same session or active view):
    if (this.user && this.user.accountId === toAcc) {
      this.currentBalance = newRecipientBal;
      this.transactions = updatedTxs;
      this.updateBalanceUI();
      this.renderHistory();
    }
  }

  async refreshTransactions() {
    if (!this.user) return;
    try {
      const { data } = await api.get(`/accounts/${this.user.accountId}/transactions`);
      if (Array.isArray(data) && data.length > 0) {
        const backendTxs = data.map(tx => ({
          transactionId: tx.transactionId,
          description: tx.description,
          type: (tx.type === 'TRANSFER_IN' || tx.type === 'DEPOSIT' || tx.type === 'CREDIT') ? 'CREDIT' : 'DEBIT',
          amountInr: tx.amountInr ?? (tx.amountCents / 100.0),
          balanceAfterInr: tx.balanceAfterInr ?? (tx.balanceAfterCents / 100.0),
          shardId: this.getShardForAccount(this.user.accountId),
          createdAt: tx.createdAt
        }));

        const existingIds = new Set(backendTxs.map(t => t.transactionId));
        this.transactions = [...backendTxs, ...this.transactions.filter(t => !existingIds.has(t.transactionId))];
        localStorage.setItem(`esss_txs_${this.user.accountId}`, JSON.stringify(this.transactions));
        this.renderHistory();
      }
    } catch {
      // In offline / standalone demo mode, local state is preserved
    }
  }

  initUserState() {
    if (!this.user) return;
    const accId = this.user.accountId;

    // 1. Balance
    const savedBal = localStorage.getItem(`esss_balance_${accId}`);
    if (savedBal !== null) {
      this.currentBalance = parseFloat(savedBal);
    } else {
      this.currentBalance = this.getDefaultBalanceForAccount(accId);
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
      this.transactions = this.getDefaultTransactionsForAccount(accId, this.currentBalance);
      localStorage.setItem(`esss_txs_${accId}`, JSON.stringify(this.transactions));
    }

    // 3. Bills (Variable number of bills per account, up to 5 bills max)
    const savedBills = localStorage.getItem(`esss_bills_${accId}`);
    if (savedBills) {
      try {
        this.bills = JSON.parse(savedBills);
      } catch {
        this.bills = [];
      }
    } else {
      this.bills = this.generateBillsForAccount(accId);
      localStorage.setItem(`esss_bills_${accId}`, JSON.stringify(this.bills));
    }
  }

  generateBillsForAccount(accId) {
    const catalog = [
      { id: 'BILL-EL-89', name: 'TNEB Electricity Bill', amount: 840, due: 'Due in 3 days', paid: false },
      { id: 'BILL-BB-41', name: 'Airtel Broadband Service', amount: 1199, due: 'Due in 7 days', paid: false },
      { id: 'BILL-WT-12', name: 'Erode Municipal Water Tax', amount: 320, due: 'Paid on Oct 20', paid: true },
      { id: 'BILL-GAS-55', name: 'Indane Gas Cylinder', amount: 950, due: 'Due in 12 days', paid: false },
      { id: 'BILL-CC-09', name: 'HDFC Regalia Credit Card', amount: 4850, due: 'Due in 5 days', paid: false },
      { id: 'BILL-INS-77', name: 'LIC Life Insurance Premium', amount: 2400, due: 'Due in 15 days', paid: false },
      { id: 'BILL-DTH-23', name: 'Tata Play DTH Re-charge', amount: 499, due: 'Paid yesterday', paid: true },
      { id: 'BILL-MUN-91', name: 'Property Tax Settlement', amount: 1850, due: 'Due in 9 days', paid: false }
    ];

    const num = parseInt((accId || '').replace(/\D/g, '') || '1', 10);
    // Variable bills count: between 3 and 5 (max 5 bills)
    const count = Math.min(5, 3 + (num % 3));
    const offset = (num * 2) % catalog.length;
    const bills = [];
    for (let i = 0; i < count; i++) {
      const b = catalog[(offset + i) % catalog.length];
      bills.push({ ...b, id: `${b.id}-${accId.slice(-3)}` });
    }
    return bills;
  }

  handleDeposit(amount, method = 'UPI', remarks = '') {
    if (!this.user) return;
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      this.showToast('Please enter a valid deposit amount', 'warn');
      return;
    }

    this.currentBalance = Math.round((this.currentBalance + numAmt) * 100) / 100;
    localStorage.setItem(`esss_balance_${this.user.accountId}`, this.currentBalance.toFixed(2));
    this.updateBalanceUI();

    const sfId = this.snowflake ? this.snowflake.generateId('DEP') : `DEP-${Date.now()}`;
    const shardId = parseInt(this.getShardForAccount(this.user.accountId), 10);
    const cleanRemarks = (remarks || '').trim();
    const desc = `Deposit via ${method}${cleanRemarks ? ' · ' + cleanRemarks : ''}`;

    this.addTransaction({
      transactionId: sfId,
      description: desc,
      type: 'CREDIT',
      amountInr: numAmt,
      balanceAfterInr: this.currentBalance,
      shardId: shardId,
      createdAt: Date.now()
    });

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'DEPOSIT_COMPLETED',
        details: `CREDIT_SETTLED · +₹${numAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} via ${method} · Snowflake=${sfId} · New Bal: ₹${this.currentBalance.toFixed(2)}`
      });
    }

    this.showToast(`Deposited ₹${numAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} successfully via ${method}!`, 'success');

    const modal = document.getElementById('modal-deposit');
    if (modal) modal.classList.remove('open');
    const form = document.getElementById('deposit-form');
    if (form) form.reset();
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

    const found = BANK_CUSTOMERS_DIRECTORY.find(c => c.accountId === this.user?.accountId);
    const catEl = document.getElementById('account-category-display');
    const ifscEl = document.getElementById('account-ifsc-display');
    const branchEl = document.getElementById('account-branch-display');
    if (catEl) catEl.textContent = found ? found.category : 'Retail Platinum Savings';
    if (ifscEl) ifscEl.textContent = found ? found.ifsc : 'ESSS0001001';
    if (branchEl) branchEl.textContent = found ? `${found.branch} Branch` : 'Erode Main Branch';
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
    const remarks = document.getElementById('transfer-remarks')?.value.trim();
    const transferDesc = remarks ? `Transfer to ${toAcc} (${remarks})` : `Transfer to ${toAcc}`;

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
        description: transferDesc
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
          description: transferDesc,
          type: 'DEBIT',
          amountInr: amount,
          balanceAfterInr: this.currentBalance,
          shardId: srcShard,
          createdAt: Date.now()
        });

        // Credit recipient account balance & transaction history
        this.creditRecipientAccount(toAcc, amount, sfId, dstShard, remarks);

        const remInput = document.getElementById('transfer-remarks');
        if (remInput) remInput.value = '';
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
          description: transferDesc,
          type: 'DEBIT',
          amountInr: amount,
          balanceAfterInr: this.currentBalance,
          shardId: srcShard,
          createdAt: Date.now()
        });

        // Credit recipient account balance & transaction history
        this.creditRecipientAccount(toAcc, amount, sfId, dstShard, remarks);

        const remInput = document.getElementById('transfer-remarks');
        if (remInput) remInput.value = '';
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
    if (!this.user) return [];
    const accId = this.user.accountId;
    const saved = localStorage.getItem(`esss_beneficiaries_${accId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // Fall back to defaults
      }
    }

    const defaults = BANK_CUSTOMERS_DIRECTORY
      .filter(c => c.accountId !== accId && ['ACC-0000002', 'ACC-0000004', 'ACC-0000005', 'ACC-0000006'].includes(c.accountId))
      .slice(0, 3)
      .map(c => ({
        name: c.name,
        acc: c.accountId,
        shard: `Shard ${c.shardId} (:808${c.shardId + 1})`,
        port: `808${c.shardId + 1}`
      }));

    if (this.hasFourthShard) {
      const node4Cust = BANK_CUSTOMERS_DIRECTORY.find(c => c.shardId === 3 && c.accountId !== accId);
      if (node4Cust && !defaults.some(d => d.acc === node4Cust.accountId)) {
        defaults.push({
          name: node4Cust.name,
          acc: node4Cust.accountId,
          shard: `Shard 3 (:8084)`,
          port: '8084'
        });
      }
    }

    localStorage.setItem(`esss_beneficiaries_${accId}`, JSON.stringify(defaults));
    return defaults;
  }

  updateBeneficiariesList() {
    this.loadBeneficiaries();
    this.populateTransferSelect();
    this.populateDirectoryDropdown();
  }

  populateDirectoryDropdown() {
    const select = document.getElementById('beneficiary-select-directory');
    if (!select || !this.user) return;

    const existingAccs = new Set(this.getBeneficiariesList().map(b => b.acc));
    existingAccs.add(this.user.accountId);

    const available = BANK_CUSTOMERS_DIRECTORY.filter(c => !existingAccs.has(c.accountId));
    select.innerHTML = '<option value="">-- Choose from Directory --</option>' +
      available.map(c => `
        <option value="${c.accountId}" data-name="${c.name}" data-shard="${c.shardId}">
          ${c.name} (${c.accountId} · Shard ${c.shardId} · ${c.branch})
        </option>
      `).join('');
  }

  handleAddBeneficiary(name, acc, shardId) {
    if (!this.user) return;
    const cleanName = (name || '').trim();
    const cleanAcc = (acc || '').trim().toUpperCase();
    const sId = parseInt(shardId ?? '0', 10);
    const port = `808${sId + 1}`;

    if (!cleanName || cleanName.length < 2) {
      this.showToast('Please enter a valid payee name', 'warn');
      return;
    }
    if (!cleanAcc || cleanAcc.length < 4) {
      this.showToast('Please enter a valid account number (e.g. ACC-0000006)', 'warn');
      return;
    }
    if (cleanAcc === this.user.accountId) {
      this.showToast('Cannot add yourself as a beneficiary', 'warn');
      return;
    }

    const currentList = this.getBeneficiariesList();
    if (currentList.some(b => b.acc === cleanAcc)) {
      this.showToast(`Beneficiary with account ${cleanAcc} is already registered`, 'warn');
      return;
    }

    const newBeneficiary = {
      name: cleanName,
      acc: cleanAcc,
      shard: `Shard ${sId} (:${port})`,
      port: port
    };

    const updated = [...currentList, newBeneficiary];
    localStorage.setItem(`esss_beneficiaries_${this.user.accountId}`, JSON.stringify(updated));

    this.updateBeneficiariesList();

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'BENEFICIARY_ADDED',
        details: `BENEFICIARY_ADDED · ${cleanName} (${cleanAcc}) · Shard ${sId} (:${port}) mapped to ring`
      });
    }

    this.showToast(`Beneficiary "${cleanName}" (${cleanAcc}) added successfully!`, 'success');

    const modal = document.getElementById('modal-add-beneficiary');
    if (modal) modal.classList.remove('open');
    const form = document.getElementById('add-beneficiary-form');
    if (form) form.reset();
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
    const totalNodes = this.hasFourthShard ? 4 : 3;
    const removedCount = this.killedNodes.size;
    const counterEl = document.getElementById('admin-removal-counter');
    if (counterEl) {
      counterEl.textContent = `${removedCount} / 3 removed`;
      counterEl.style.color = removedCount >= 3 ? 'var(--red)' : 'var(--navy)';
    }

    // Update each node badge and button
    ['8081', '8082', '8083'].forEach(port => {
      const badge = document.getElementById(`badge-node-${port}`);
      const btn = document.getElementById(`btn-toggle-node-${port}`);
      const isDead = this.killedNodes.has(port);

      if (badge) {
        badge.className = isDead ? 'event-pill event-pill-red' : 'event-pill event-pill-green';
        badge.textContent = isDead ? 'OFFLINE' : 'ONLINE';
      }
      if (btn) {
        if (isDead) {
          btn.textContent = '↻ Revive';
          btn.style.color = 'var(--green)';
          btn.disabled = false;
        } else {
          btn.textContent = '⛔ Remove';
          btn.style.color = 'var(--red)';
          btn.disabled = (removedCount >= 3) || ((totalNodes - removedCount) <= 1);
        }
      }
    });

    // Node 4 controls
    const badge4 = document.getElementById('badge-node-8084');
    const btn4 = document.getElementById('btn-toggle-node-8084');
    if (badge4 && btn4) {
      if (!this.hasFourthShard) {
        badge4.className = 'event-pill event-pill-grey';
        badge4.textContent = 'OFFLINE';
        btn4.textContent = '➕ Add Node 4';
        btn4.style.color = 'var(--accent-blue)';
        btn4.disabled = false;
      } else {
        const isDead = this.killedNodes.has('8084');
        badge4.className = isDead ? 'event-pill event-pill-red' : 'event-pill event-pill-green';
        badge4.textContent = isDead ? 'OFFLINE' : 'ONLINE';
        btn4.textContent = '➖ Remove Node 4';
        btn4.style.color = 'var(--ink-2)';
        btn4.disabled = false;
      }
    }

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
    const totalNodes = this.hasFourthShard ? 4 : 3;
    if (this.killedNodes.size >= 3 || (totalNodes - this.killedNodes.size) <= 1) {
      this.showToast('Quorum Protection: Minimum 1 active node required. Cannot remove more than 3 nodes.', 'warn');
      return;
    }
    const btn = document.getElementById(`btn-toggle-node-${port}`);
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
    const totalNodes = this.hasFourthShard ? 4 : 3;
    if (this.killedNodes.size >= 3 || (totalNodes - this.killedNodes.size) <= 1) {
      this.showToast('Quorum Protection: Minimum 1 active node required. Cannot remove more nodes.', 'warn');
      return;
    }

    this.killedNodes.add(String(port));
    if (this.ring) this.ring.setKilledNodes(this.killedNodes);
    if (this.saga) this.saga.setKilledNodes(this.killedNodes);
    this.updateBeneficiariesList();
    this.updateClusterControlsUI();

    const shardIdx = (port === '8081' ? '0' : (port === '8082' ? '1' : (port === '8083' ? '2' : '3')));
    const timeline = document.getElementById('admin-failure-timeline');
    if (timeline) {
      timeline.style.display = 'block';
      timeline.innerHTML = `
        <strong>Failure Detection Timeline:</strong><br>
        t=0s kill signal → t=5.0s probe fail →
        <span style="color: var(--red); font-weight: 700;">node :${port} (Shard ${shardIdx}) evicted</span> →
        <span style="color: var(--green); font-weight: 700;">150 vnodes migrated to survivors</span>
      `;
    }

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'NODE_DOWN',
        details: `NODE_DOWN · :${port} (Shard ${shardIdx}) evicted from hash ring · 150 vnodes migrated`
      });
    }

    this.showToast(`Node :${port} (Shard ${shardIdx}) removed. Hash ring pointer and vnodes rerouted.`, 'warn');
  }

  async reviveNode(port) {
    const btn = document.getElementById(`btn-toggle-node-${port}`);
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

    const shardIdx = (port === '8081' ? '0' : (port === '8082' ? '1' : (port === '8083' ? '2' : '3')));
    const timeline = document.getElementById('admin-failure-timeline');
    if (timeline) {
      timeline.innerHTML = `
        <strong style="color: var(--green);">Node Recovery:</strong><br>
        Node :${port} (Shard ${shardIdx}) restored. 150 virtual slots rebalanced on hash ring.
      `;
    }

    if (this.eventLog) {
      this.eventLog.addEvent({
        action: 'NODE_REJOINED',
        details: `NODE_REJOINED · :${port} (Shard ${shardIdx}) restored to ring · ONLINE`
      });
    }

    this.showToast(`Node :${port} revived. Consistent hash ring and Shard ${shardIdx} restored.`, 'success');
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

    const loginDirSelect = document.getElementById('login-directory-select');
    if (loginDirSelect) {
      loginDirSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          const opt = loginDirSelect.options[loginDirSelect.selectedIndex];
          const u = opt.dataset.username || e.target.value;
          document.getElementById('login-username').value = u;
          document.getElementById('login-password').value = 'Password@123';
          this.handleLogin(u, 'Password@123');
        }
      });
    }

    const headerSwitcher = document.getElementById('header-account-switcher');
    if (headerSwitcher) {
      headerSwitcher.addEventListener('change', (e) => {
        if (e.target.value && (!this.user || e.target.value !== this.user.accountId)) {
          this.switchAccount(e.target.value);
        }
      });
    }

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

    // Wire individual per-node toggle buttons
    ['8081', '8082', '8083'].forEach(port => {
      const btn = document.getElementById(`btn-toggle-node-${port}`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (this.killedNodes.has(port)) {
            this.reviveNode(port);
          } else {
            this.killNode(port);
          }
        });
      }
    });

    // Node 4 toggle
    const toggle4Btn = document.getElementById('btn-toggle-node-8084');
    if (toggle4Btn) {
      toggle4Btn.addEventListener('click', () => {
        if (!this.hasFourthShard) {
          this.addFourthShard();
        } else {
          this.removeFourthShard();
        }
      });
    }

    const clearLogBtn = document.getElementById('btn-clear-events');
    if (clearLogBtn) clearLogBtn.addEventListener('click', () => this.eventLog?.clear());

    // Deposit Modal Events
    const openDepBtn = document.getElementById('btn-open-deposit');
    const closeDepBtn = document.getElementById('btn-close-deposit');
    const cancelDepBtn = document.getElementById('btn-cancel-deposit');
    const depModal = document.getElementById('modal-deposit');
    const depForm = document.getElementById('deposit-form');

    if (openDepBtn && depModal) {
      openDepBtn.addEventListener('click', () => {
        if (!this.user) return;
        const accSpan = document.getElementById('deposit-target-acc');
        const balSpan = document.getElementById('deposit-current-bal');
        if (accSpan) accSpan.textContent = this.user.accountId;
        if (balSpan) balSpan.textContent = `₹ ${this.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        depModal.classList.add('open');
      });
    }

    const closeDeposit = () => depModal?.classList.remove('open');
    if (closeDepBtn) closeDepBtn.addEventListener('click', closeDeposit);
    if (cancelDepBtn) cancelDepBtn.addEventListener('click', closeDeposit);

    document.querySelectorAll('.quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const amtInput = document.getElementById('deposit-amount');
        if (amtInput && chip.dataset.amount) {
          amtInput.value = chip.dataset.amount;
        }
      });
    });

    if (depForm) {
      depForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amt = document.getElementById('deposit-amount')?.value;
        const method = document.getElementById('deposit-method')?.value || 'UPI';
        const remarks = document.getElementById('deposit-remarks')?.value || '';
        this.handleDeposit(amt, method, remarks);
      });
    }

    // Add Beneficiary Modal Events
    const openAddBenBtn = document.getElementById('btn-open-add-beneficiary');
    const closeAddBenBtn = document.getElementById('btn-close-beneficiary-modal');
    const cancelAddBenBtn = document.getElementById('btn-cancel-add-beneficiary');
    const benModal = document.getElementById('modal-add-beneficiary');
    const benForm = document.getElementById('add-beneficiary-form');
    const dirSelect = document.getElementById('beneficiary-select-directory');

    if (openAddBenBtn && benModal) {
      openAddBenBtn.addEventListener('click', () => {
        this.populateDirectoryDropdown();
        benModal.classList.add('open');
      });
    }

    const closeAddBeneficiary = () => benModal?.classList.remove('open');
    if (closeAddBenBtn) closeAddBenBtn.addEventListener('click', closeAddBeneficiary);
    if (cancelAddBenBtn) cancelAddBenBtn.addEventListener('click', closeAddBeneficiary);

    if (dirSelect) {
      dirSelect.addEventListener('change', () => {
        const opt = dirSelect.options[dirSelect.selectedIndex];
        if (opt && opt.value) {
          const nameInput = document.getElementById('beneficiary-custom-name');
          const accInput = document.getElementById('beneficiary-custom-acc');
          const shardInput = document.getElementById('beneficiary-custom-shard');
          if (nameInput) nameInput.value = opt.dataset.name || '';
          if (accInput) accInput.value = opt.value;
          if (shardInput) shardInput.value = opt.dataset.shard || '0';
        }
      });
    }

    if (benForm) {
      benForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('beneficiary-custom-name')?.value;
        const acc = document.getElementById('beneficiary-custom-acc')?.value;
        const shard = document.getElementById('beneficiary-custom-shard')?.value || '0';
        this.handleAddBeneficiary(name, acc, shard);
      });
    }

    // Close modals on clicking overlay backdrop
    window.addEventListener('click', (e) => {
      if (e.target === depModal) depModal.classList.remove('open');
      if (e.target === benModal) benModal.classList.remove('open');
    });

    this.updateClusterControlsUI();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new ErodeBankingApp();
});
