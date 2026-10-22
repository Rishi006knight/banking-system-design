let currentUser = null;
let sessionToken = null;
let lastServedBy = '--';
let lastShard = '--';
let lastCacheStatus = '--';

document.addEventListener("DOMContentLoaded", () => {
    generateIdemKey('trf-idem');
    generateIdemKey('bill-idem');
    
    // Initial fetch of telemetry
    refreshMetrics();
    refreshGatewayRoutes();

    // Auto-refresh telemetry every 3 seconds
    setInterval(() => {
        refreshMetrics();
        refreshGatewayRoutes();
    }, 3000);
});

function toggleTelemetryPanel() {
    const sidebar = document.getElementById('telemetry-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
}

function switchAuthTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const loginDiv = document.getElementById('login-form-div');
    const regDiv = document.getElementById('register-form-div');
    const alertBox = document.getElementById('auth-alert');
    if (alertBox) alertBox.style.display = 'none';

    if (tab === 'login') {
        document.getElementById('tab-login-btn').classList.add('active');
        loginDiv.style.display = 'block';
        regDiv.style.display = 'none';
    } else {
        document.getElementById('tab-register-btn').classList.add('active');
        loginDiv.style.display = 'none';
        regDiv.style.display = 'block';
    }
}

function quickFillLogin(username, password) {
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
    showToast(`Quick-selected user ${username}. Click Authenticate!`, 'info');
}

function setQuickTransferTarget(accId) {
    document.getElementById('trf-dest').value = accId;
    showToast(`Destination account set to ${accId}`, 'info');
}

function generateIdemKey(elementId) {
    const key = 'IDEM-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    const elem = document.getElementById(elementId);
    if (elem) elem.value = key;
}

function copySessionToken() {
    if (!sessionToken) {
        showToast('No active session token to copy', 'error');
        return;
    }
    navigator.clipboard.writeText(sessionToken).then(() => {
        showToast('Bearer token copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Token: ' + sessionToken.substring(0, 20) + '...', 'info');
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `alert-banner alert-${type === 'error' ? 'error' : 'success'}`;
    toast.style.marginBottom = '10px';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

async function handleLogin(e) {
    e.preventDefault();
    const alertBox = document.getElementById('auth-alert');
    alertBox.style.display = 'none';

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const resp = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || 'Authentication rejected by gateway');
        }

        sessionToken = data.token;
        currentUser = {
            id: data.customerId,
            username: data.username,
            name: data.fullName,
            accountId: data.primaryAccountId,
            accountNumber: data.accountNumber || '1000000001'
        };

        onLoginSuccess();
        showToast(`Welcome back, ${currentUser.name}! Secure banking session initialized.`, 'success');
    } catch (err) {
        alertBox.className = 'alert-banner alert-error';
        alertBox.textContent = err.message;
        alertBox.style.display = 'block';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const alertBox = document.getElementById('auth-alert');
    alertBox.style.display = 'none';

    const username = document.getElementById('reg-username').value.trim();
    const fullName = document.getElementById('reg-fullname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const depositInr = parseFloat(document.getElementById('reg-deposit').value || '0');
    const depositCents = Math.round(depositInr * 100);

    try {
        const resp = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                fullName,
                email,
                password,
                initialDepositCents: depositCents
            })
        });

        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || 'Account creation failed');
        }

        sessionToken = data.token;
        currentUser = {
            id: data.customerId,
            username: data.username,
            name: data.fullName,
            accountId: data.primaryAccountId,
            accountNumber: data.accountNumber || '1000000001'
        };

        onLoginSuccess();
        showToast(`Account successfully created for ${currentUser.name}! Routing via high-availability hash ring.`, 'success');
    } catch (err) {
        alertBox.className = 'alert-banner alert-error';
        alertBox.textContent = err.message;
        alertBox.style.display = 'block';
    }
}

function onLoginSuccess() {
    document.getElementById('auth-section').style.display = 'none';
    const dash = document.getElementById('dashboard-section');
    dash.style.display = 'block';

    // Populate user profile info
    const nameEl = document.getElementById('dash-customer-name');
    if (nameEl) nameEl.textContent = currentUser.name;
    const custIdEl = document.getElementById('dash-customer-id');
    if (custIdEl) custIdEl.textContent = currentUser.id;
    const accIdEl = document.getElementById('dash-account-id');
    if (accIdEl) accIdEl.textContent = currentUser.accountId;
    const accNumEl = document.getElementById('dash-account-number');
    if (accNumEl) accNumEl.textContent = 'A/C: ' + currentUser.accountNumber;
    const trfSourceEl = document.getElementById('trf-source');
    if (trfSourceEl) trfSourceEl.value = currentUser.accountId;

    // Set masked debit card number
    const cardEl = document.getElementById('dash-card-number');
    if (cardEl) {
        const last4 = (currentUser.accountNumber || '0001').slice(-4);
        cardEl.textContent = `•••• •••• •••• ${last4}`;
    }

    // Set avatar initials
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl) {
        const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        avatarEl.textContent = initials;
    }

    refreshBalance();
    loadBeneficiaries();
    loadBills();
    loadTransactions();
    loadNotifications();
}

function handleLogout() {
    if (sessionToken) {
        fetch('/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + sessionToken }
        }).catch(() => {});
    }
    currentUser = null;
    sessionToken = null;
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('dashboard-section').style.display = 'none';
    showToast('Signed out successfully. Session cache invalidated.', 'info');
}

async function refreshBalance() {
    if (!currentUser || !currentUser.accountId) return;

    const spinner = document.getElementById('refresh-spinner');
    if (spinner) spinner.style.transform = 'rotate(180deg)';

    try {
        const resp = await fetch(`/accounts/${currentUser.accountId}/balance`, {
            headers: {
                'Authorization': 'Bearer ' + sessionToken,
                'X-Account-Id': currentUser.accountId
            }
        });

        // Extract System Design response trace headers
        const rawServer = resp.headers.get('X-Served-By') || resp.headers.get('X-Gateway-Route') || 'node-8081';
        const rawShard = resp.headers.get('X-Shard') || 'bank-shard-0';
        const cacheHit = resp.headers.get('X-Cache-Hit') === 'true';

        lastServedBy = formatClusterNodeName(rawServer);
        lastShard = formatShardName(rawShard);

        const data = await resp.json();
        if (resp.ok) {
            const inr = data.balanceInr || (data.balanceCents / 100);
            document.getElementById('dash-balance').textContent = '₹ ' + inr.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

            // Update live badges
            const badgeServer = document.getElementById('badge-served-by');
            if (badgeServer) badgeServer.querySelector('.val').textContent = lastServedBy;

            const badgeShard = document.getElementById('badge-shard');
            if (badgeShard) badgeShard.querySelector('.val').textContent = lastShard;

            const badgeCache = document.getElementById('badge-cache');
            if (badgeCache) {
                badgeCache.querySelector('.val').textContent = cacheHit ? 'L1 Hot Cache Hit (<0.4 µs)' : 'L2 Ledger Shard Read';
                badgeCache.className = 'trace-badge badge-cache' + (cacheHit ? '' : ' miss');
            }
        }
    } catch (err) {
        console.error('Failed to refresh balance:', err);
    } finally {
        if (spinner) setTimeout(() => spinner.style.transform = 'none', 300);
    }
}

async function handleTransfer(e) {
    e.preventDefault();
    const alertBox = document.getElementById('transfer-alert');
    alertBox.style.display = 'none';

    const sourceAccountId = document.getElementById('trf-source').value;
    const destAccountId = document.getElementById('trf-dest').value.trim();
    const amountInr = parseFloat(document.getElementById('trf-amount').value);
    const amountCents = Math.round(amountInr * 100);
    const idempotencyKey = document.getElementById('trf-idem').value;

    const btn = document.getElementById('transfer-submit-btn');
    btn.disabled = true;
    btn.querySelector('span:first-child').textContent = 'Executing Saga...';

    try {
        const resp = await fetch('/transfers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey,
                'Authorization': 'Bearer ' + sessionToken,
                'X-Account-Id': sourceAccountId
            },
            body: JSON.stringify({
                sourceAccountId,
                destAccountId,
                amountCents,
                description: 'Online Fund Transfer'
            })
        });

        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || 'Transfer failed');
        }

        alertBox.className = 'alert-banner alert-success';
        const sagaNote = data.transferType === 'CROSS_SHARD' 
            ? '⚡ 2-Phase Saga Orchestration: Source debit committed, destination credited via distributed coordinator.'
            : '🔒 Single-Shard Atomic Transfer: Committed within single ACID database transaction.';
        alertBox.innerHTML = `
            <strong>Transfer ${data.status}!</strong><br>
            <span>Type: <code>${data.transferType}</code> (${data.sourceShard} → ${data.destShard})</span><br>
            <span>Snowflake Transaction ID: <code>${data.transferId}</code></span><br>
            <small style="opacity: 0.9">${sagaNote}</small>
        `;
        alertBox.style.display = 'block';

        generateIdemKey('trf-idem');
        refreshBalance();
        loadTransactions();
        loadNotifications();
        showToast(`Transferred ₹${amountInr.toFixed(2)} to ${destAccountId} successfully!`, 'success');
    } catch (err) {
        alertBox.className = 'alert-banner alert-error';
        alertBox.textContent = err.message;
        alertBox.style.display = 'block';
        showToast('Transfer failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.querySelector('span:first-child').textContent = 'Execute Fund Transfer';
    }
}

async function loadBills() {
    if (!currentUser) return;
    try {
        const resp = await fetch(`/bills?customerId=${currentUser.id}`, {
            headers: { 'Authorization': 'Bearer ' + sessionToken }
        });
        const bills = await resp.json();
        const select = document.getElementById('bill-select');
        select.innerHTML = '';

        const unpaid = Array.isArray(bills) ? bills.filter(b => b.status === 'UNPAID') : [];
        if (unpaid.length === 0) {
            select.innerHTML = '<option value="">No unpaid bills outstanding</option>';
            document.getElementById('bill-amount-display').value = '₹ 0.00';
            document.getElementById('pay-bill-btn').disabled = true;
            return;
        }

        document.getElementById('pay-bill-btn').disabled = false;
        unpaid.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.billId;
            opt.dataset.amount = b.amountInr;
            opt.textContent = `${b.billerName} (${b.billerCode}) — Due ₹ ${b.amountInr.toFixed(2)}`;
            select.appendChild(opt);
        });

        onBillSelected();
    } catch (err) {
        console.error('Failed to load bills:', err);
    }
}

function onBillSelected() {
    const select = document.getElementById('bill-select');
    const selected = select.options[select.selectedIndex];
    if (selected && selected.dataset.amount) {
        document.getElementById('bill-amount-display').value = '₹ ' + parseFloat(selected.dataset.amount).toFixed(2);
    } else {
        document.getElementById('bill-amount-display').value = '₹ 0.00';
    }
}

async function handlePayBill() {
    const alertBox = document.getElementById('bill-alert');
    alertBox.style.display = 'none';

    const billId = document.getElementById('bill-select').value;
    if (!billId) {
        showToast('Please select a valid unpaid bill', 'error');
        return;
    }

    const idempotencyKey = document.getElementById('bill-idem').value;

    try {
        const resp = await fetch('/billpayments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey,
                'Authorization': 'Bearer ' + sessionToken,
                'X-Account-Id': currentUser.accountId
            },
            body: JSON.stringify({ accountId: currentUser.accountId, billId })
        });

        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error || 'Bill payment settlement failed');
        }

        alertBox.className = 'alert-banner alert-success';
        alertBox.innerHTML = `
            <strong>Bill Settled Successfully!</strong><br>
            <span>Status: <code>${data.status}</code> • Transaction ID: <code>${data.paymentId || data.transactionId}</code></span>
        `;
        alertBox.style.display = 'block';

        generateIdemKey('bill-idem');
        refreshBalance();
        loadBills();
        loadTransactions();
        loadNotifications();
        showToast('Utility bill paid with zero duplication guarantee!', 'success');
    } catch (err) {
        alertBox.className = 'alert-banner alert-error';
        alertBox.textContent = err.message;
        alertBox.style.display = 'block';
    }
}

async function loadBeneficiaries() {
    if (!currentUser) return;
    try {
        const resp = await fetch(`/beneficiaries?customerId=${currentUser.id}`, {
            headers: { 'Authorization': 'Bearer ' + sessionToken }
        });
        const bens = await resp.json();
        const list = document.getElementById('ben-list');
        list.innerHTML = '';

        if (!Array.isArray(bens) || bens.length === 0) {
            list.innerHTML = '<li class="empty-msg">No beneficiaries registered yet.</li>';
            return;
        }

        bens.forEach(b => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>${b.name}</strong><br>
                    <small class="text-dim">A/C: <code>${b.accountNumber}</code> • Bank: ${b.bankCode}</small>
                </div>
                <button class="btn btn-chip btn-xs" onclick="setQuickTransferTarget('${b.accountNumber}')">Transfer →</button>
            `;
            list.appendChild(li);
        });
    } catch (err) {
        console.error('Failed to load beneficiaries:', err);
    }
}

async function handleAddBeneficiary(e) {
    e.preventDefault();
    const name = document.getElementById('ben-name').value.trim();
    const accountNumber = document.getElementById('ben-acc').value.trim();
    const bankCode = document.getElementById('ben-bank').value;

    try {
        const resp = await fetch(`/beneficiaries?customerId=${currentUser.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionToken
            },
            body: JSON.stringify({ name, accountNumber, bankCode })
        });

        if (resp.ok) {
            document.getElementById('ben-name').value = '';
            document.getElementById('ben-acc').value = '';
            loadBeneficiaries();
            showToast(`Beneficiary ${name} added and cached!`, 'success');
        }
    } catch (err) {
        showToast('Failed to add beneficiary: ' + err.message, 'error');
    }
}

async function loadTransactions() {
    if (!currentUser) return;
    try {
        const resp = await fetch(`/accounts/${currentUser.accountId}/transactions?page=0&size=15`, {
            headers: {
                'Authorization': 'Bearer ' + sessionToken,
                'X-Account-Id': currentUser.accountId
            }
        });
        const txs = await resp.json();
        const tbody = document.getElementById('tx-tbody');
        tbody.innerHTML = '';

        if (!Array.isArray(txs) || txs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center empty-msg">No transactions recorded in this shard yet.</td></tr>';
            return;
        }

        txs.forEach(t => {
            const tr = document.createElement('tr');
            const isCredit = t.type.includes('CREDIT') || t.type.includes('IN') || t.type.includes('DEPOSIT') || t.type.includes('REFUND');
            const typeColor = isCredit ? 'var(--success)' : 'var(--danger)';
            const dateStr = new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
                            ' ' + new Date(t.createdAt).toLocaleDateString();

            tr.innerHTML = `
                <td><code>${t.transactionId}</code></td>
                <td><span class="code-chip" style="color: ${typeColor}; border-color: ${typeColor}">${t.type}</span></td>
                <td><strong style="color: ${typeColor}">${isCredit ? '+' : '-'} ₹ ${t.amountInr.toFixed(2)}</strong></td>
                <td>₹ ${t.balanceAfterInr.toFixed(2)}</td>
                <td>${t.description || '-'}</td>
                <td class="text-dim">${dateStr}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Failed to load transactions:', err);
    }
}

async function loadNotifications() {
    if (!currentUser) return;
    try {
        const resp = await fetch(`/notifications?customerId=${currentUser.id}`, {
            headers: { 'Authorization': 'Bearer ' + sessionToken }
        });
        const notifs = await resp.json();
        const list = document.getElementById('notif-list');
        list.innerHTML = '';

        if (!Array.isArray(notifs) || notifs.length === 0) {
            list.innerHTML = '<li class="empty-msg">No recent notifications.</li>';
            return;
        }

        notifs.forEach(n => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${n.message}</span>
                <small class="text-dim">${new Date(n.createdAt).toLocaleTimeString()} • Audited</small>
            `;
            list.appendChild(li);
        });
    } catch (err) {
        console.error('Failed to load notifications:', err);
    }
}

function formatClusterNodeName(serverId) {
    if (!serverId) return 'Cluster Node 1 (Primary)';
    if (serverId.includes('8081') || serverId === 'node-8081') return 'Cluster Node 1 (Primary Zone)';
    if (serverId.includes('8082') || serverId === 'node-8082') return 'Cluster Node 2 (Secondary Zone)';
    if (serverId.includes('8083') || serverId === 'node-8083') return 'Cluster Node 3 (Tertiary Zone)';
    return serverId;
}

function formatShardName(shardId) {
    if (!shardId) return 'Partition Alpha';
    if (shardId.includes('shard-0') || shardId.endsWith('0')) return 'Partition Alpha (Shard 0)';
    if (shardId.includes('shard-1') || shardId.endsWith('1')) return 'Partition Beta (Shard 1)';
    if (shardId.includes('shard-2') || shardId.endsWith('2')) return 'Partition Gamma (Shard 2)';
    return shardId;
}

async function simulateNodeFailure(serverId) {
    try {
        const resp = await fetch(`/gateway/simulate/fail?serverId=${serverId}`, { method: 'POST' });
        const data = await resp.json();
        const friendlyName = formatClusterNodeName(serverId);
        showToast(`💥 ${friendlyName} OFFLINE! Ring dynamically shifted virtual partitions.`, 'error');
        refreshGatewayRoutes();
    } catch (err) {
        showToast('Failure simulation error: ' + err.message, 'error');
    }
}

async function simulateNodeRecovery(serverId) {
    try {
        const resp = await fetch(`/gateway/simulate/recover?serverId=${serverId}`, { method: 'POST' });
        const data = await resp.json();
        const friendlyName = formatClusterNodeName(serverId);
        showToast(`✅ ${friendlyName} ONLINE! Ring dynamically reassigned 150 virtual nodes.`, 'success');
        refreshGatewayRoutes();
    } catch (err) {
        showToast('Recovery simulation error: ' + err.message, 'error');
    }
}

async function refreshGatewayRoutes() {
    try {
        const resp = await fetch('/gateway/routes');
        if (resp.ok) {
            const data = await resp.json();
            const allServers = data.allConfiguredServers || [];
            const activeServers = data.activeServers || [];

            // Update top bar count
            const navCount = document.getElementById('nav-active-servers-count');
            if (navCount) navCount.textContent = `Servers: ${activeServers.length} Active`;

            const teleActiveNodes = document.getElementById('tele-active-nodes');
            if (teleActiveNodes) teleActiveNodes.textContent = `${activeServers.length} / ${allServers.length}`;

            // Update node badges in failover control section
            allServers.forEach(s => {
                const nodeKey = s.serverId.replace('node-', '');
                const badge = document.getElementById(`node-status-${nodeKey}`);
                if (badge) {
                    badge.className = 'node-badge' + (s.healthy ? '' : ' dead');
                    const friendly = nodeKey === '8081' ? 'Cluster Node 1' : nodeKey === '8082' ? 'Cluster Node 2' : 'Cluster Node 3';
                    badge.textContent = s.healthy ? `${friendly} (UP)` : `${friendly} (DOWN)`;
                }
            });
        }
    } catch (err) {
        // Silently skip if gateway isn't up
    }
}

async function refreshMetrics() {
    try {
        const mResp = await fetch('/admin/metrics');
        if (mResp.ok) {
            const m = await mResp.json();
            if (m.rateLimiter) {
                const elAllowed = document.getElementById('tele-rl-allowed');
                const elRejected = document.getElementById('tele-rl-rejected');
                const elRate = document.getElementById('tele-rl-rate');
                const elBuckets = document.getElementById('tele-rl-buckets');
                if (elAllowed) elAllowed.textContent = m.rateLimiter.allowedRequests;
                if (elRejected) elRejected.textContent = m.rateLimiter.rejectedRequests;
                if (elRate) elRate.textContent = m.rateLimiter.rejectionRatePercent.toFixed(1) + '%';
                if (elBuckets) elBuckets.textContent = m.rateLimiter.activeBuckets || '1';
            }
            if (m.consistentHashRing) {
                const elVnodes = document.getElementById('tele-vnodes');
                if (elVnodes) elVnodes.textContent = m.consistentHashRing.totalVirtualNodes;
            }
            if (m.keyValueStore) {
                const hitRatio = m.keyValueStore.hitRatioPercent || 0;
                const elRatio = document.getElementById('tele-kv-hitratio');
                const elHits = document.getElementById('tele-kv-hits');
                const elMisses = document.getElementById('tele-kv-misses');
                const elLat = document.getElementById('tele-kv-lat');
                const elBar = document.getElementById('tele-kv-bar');

                if (elRatio) elRatio.textContent = hitRatio.toFixed(1) + '%';
                if (elHits) elHits.textContent = m.keyValueStore.hits;
                if (elMisses) elMisses.textContent = m.keyValueStore.misses;
                if (elLat) elLat.textContent = (m.keyValueStore.avgGetLatencyNanos || 0).toFixed(0) + ' ns';
                if (elBar) elBar.style.width = Math.min(100, Math.max(0, hitRatio)) + '%';
            }
            if (m.uniqueIdGenerator) {
                const elTotal = document.getElementById('tele-snow-total');
                const elRate = document.getElementById('tele-snow-rate');
                if (elTotal) elTotal.textContent = m.uniqueIdGenerator.totalGenerated;
                if (elRate) elRate.textContent = (m.uniqueIdGenerator.generationRatePerSecond || 0).toFixed(0) + ' /s';
            }
        }
    } catch (err) {
        // Silently skip if server metrics not available
    }
}
