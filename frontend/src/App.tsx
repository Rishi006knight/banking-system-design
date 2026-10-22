import React, { useState, useEffect, useCallback } from 'react';
import type {
  User,
  Balance,
  Transaction,
  Bill,
  Beneficiary,
  AccountNotification
} from './types';
import {
  loginApi,
  getBalanceApi,
  getTransactionsApi,
  getBillsApi,
  payBillApi,
  getBeneficiariesApi,
  addBeneficiaryApi,
  getNotificationsApi,
  executeTransferApi
} from './api';

export const App: React.FC = () => {
  // Auth state
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('esss_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('esss_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('aarav.sharma1');
  const [loginPassword, setLoginPassword] = useState('Password@123');
  const [loginLoading, setLoginLoading] = useState(false);

  // Core Banking Data State
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [, setNotifications] = useState<AccountNotification[]>([]);

  // Action States
  const [refreshing, setRefreshing] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Transfer Form Inputs
  const [targetAccount, setTargetAccount] = useState('');
  const [targetName, setTargetName] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDescription, setTransferDescription] = useState('');

  // Add Beneficiary State
  const [showAddBene, setShowAddBene] = useState(false);
  const [newBeneName, setNewBeneName] = useState('');
  const [newBeneAccount, setNewBeneAccount] = useState('');

  // Card Controls
  const [isCardFrozen, setIsCardFrozen] = useState(false);

  // Helpers
  const showBanner = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Just now';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  // Load Customer Banking Data
  const loadBankingData = useCallback(async (currUser: User, currToken: string) => {
    try {
      const [balData, txData, billData, beneData, notifData] = await Promise.all([
        getBalanceApi(currUser.accountId, currToken).catch(() => null),
        getTransactionsApi(currUser.accountId, currToken).catch(() => []),
        getBillsApi(currUser.id, currUser.accountId, currToken).catch(() => []),
        getBeneficiariesApi(currUser.id, currUser.accountId, currToken).catch(() => []),
        getNotificationsApi(currUser.id, currUser.accountId, currToken).catch(() => [])
      ]);

      if (balData) setBalance(balData);
      setTransactions(txData);
      setBills(billData);
      setBeneficiaries(beneData);
      setNotifications(notifData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to synchronize account data';
      showBanner('error', msg);
    }
  }, []);

  useEffect(() => {
    if (user && token) {
      loadBankingData(user, token);
    }
  }, [user, token, loadBankingData]);

  // Handle Login
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setStatusMessage(null);
    try {
      const res = await loginApi(loginUsername, loginPassword);
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('esss_token', res.token);
      localStorage.setItem('esss_user', JSON.stringify(res.user));
      showBanner('success', `Welcome back, ${res.user.name}. Session verified.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify your login.';
      showBanner('error', msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const selectDemoAccount = (username: string) => {
    setLoginUsername(username);
    setLoginPassword('Password@123');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setBalance(null);
    setTransactions([]);
    setBills([]);
    setBeneficiaries([]);
    setNotifications([]);
    localStorage.removeItem('esss_token');
    localStorage.removeItem('esss_user');
    showBanner('success', 'Logged out securely. Have a great day!');
  };

  // Refresh Balance Manually
  const handleRefresh = async () => {
    if (!user || !token) return;
    setRefreshing(true);
    try {
      const bal = await getBalanceApi(user.accountId, token);
      setBalance(bal);
      const tx = await getTransactionsApi(user.accountId, token);
      setTransactions(tx);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh balance';
      showBanner('error', msg);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Quick Select Recipient
  const handleSelectRecipient = (bene: Beneficiary) => {
    setTargetAccount(bene.accountNumber);
    setTargetName(bene.name);
    setTransferDescription(`Transfer to ${bene.name}`);
  };

  // Execute Transfer
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) return;

    const amountNum = parseFloat(transferAmount);
    if (!targetAccount.trim()) {
      showBanner('error', 'Please provide a valid destination account number');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      showBanner('error', 'Please enter a valid transfer amount greater than 0');
      return;
    }
    if (balance && amountNum > balance.balanceInr) {
      showBanner('error', 'Insufficient funds for this transaction');
      return;
    }

    setTransferLoading(true);
    try {
      const result = await executeTransferApi(
        user.accountId,
        targetAccount.trim(),
        amountNum,
        transferDescription.trim() || `Instant Transfer to ${targetName || targetAccount}`,
        token
      );

      showBanner(
        'success',
        `₹ ${amountNum.toLocaleString('en-IN')} transferred successfully! Ref No: ${result.transferId}`
      );

      // Reset form
      setTransferAmount('');
      setTransferDescription('');
      setTargetAccount('');
      setTargetName('');

      // Refresh balance and ledger
      handleRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer execution failed';
      showBanner('error', msg);
    } finally {
      setTransferLoading(false);
    }
  };

  // Pay Utility Bill
  const handlePayBill = async (bill: Bill) => {
    if (!user || !token) return;
    setPayingBillId(bill.billId);
    try {
      await payBillApi(bill.billId, user.accountId, token);
      showBanner('success', `Bill paid successfully: ${bill.billerName} (${formatCurrency(bill.amountInr)})`);
      // Update bill status locally
      setBills((prev) =>
        prev.map((b) => (b.billId === bill.billId ? { ...b, status: 'PAID', paidAt: Date.now() } : b))
      );
      // Refresh balance
      handleRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bill payment failed';
      showBanner('error', msg);
    } finally {
      setPayingBillId(null);
    }
  };

  // Add Beneficiary
  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) return;
    if (!newBeneName.trim() || !newBeneAccount.trim()) {
      showBanner('error', 'Please provide both beneficiary name and account number');
      return;
    }

    try {
      const created = await addBeneficiaryApi(
        user.id,
        {
          name: newBeneName.trim(),
          accountNumber: newBeneAccount.trim(),
          bankCode: 'ESSS'
        },
        user.accountId,
        token
      );
      setBeneficiaries((prev) => [...prev, created]);
      showBanner('success', `Beneficiary ${created.name} registered successfully`);
      setNewBeneName('');
      setNewBeneAccount('');
      setShowAddBene(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register beneficiary';
      showBanner('error', msg);
    }
  };

  return (
    <div className="app-container">
      {/* Brand Navigation Header */}
      <header className="bank-header">
        <div className="brand-wrapper">
          <div className="brand-monogram">ESSS</div>
          <div className="brand-info">
            <h1>Erode SSS Bank</h1>
            <div className="brand-sub">Premier Commercial Digital Banking</div>
          </div>
        </div>

        <div className="header-badges">
          <div className="sec-badge">
            <span className="sec-dot"></span>
            256-Bit SSL Encrypted
          </div>
        </div>

        {user && (
          <div className="user-profile-bar">
            <div className="user-avatar">{user.name.charAt(0)}</div>
            <div className="user-meta">
              <div className="user-name">{user.name}</div>
              <div className="user-acc-num">{user.accountId}</div>
            </div>
            <button className="btn-signout" onClick={handleLogout} title="Sign Out of NetBanking">
              Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Global Status Banner */}
      {statusMessage && (
        <div className={`alert-banner ${statusMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          <span>{statusMessage.type === 'success' ? '✓' : '⚠'}</span>
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* View 1: Customer Login Portal */}
      {!user ? (
        <div className="auth-hero">
          <div className="auth-card">
            <div className="auth-header">
              <h2>Secure Customer NetBanking</h2>
              <p>Sign in to your authenticated commercial banking dashboard</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Username / Customer ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Enter your customer username"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your secure password"
                  required
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loginLoading}>
                {loginLoading ? 'Authenticating...' : 'Sign In to Account'}
              </button>
            </form>

            <div className="demo-credentials-box">
              <div className="demo-title">
                <span>⚡</span> Quick Select Verified Customer
              </div>
              <div className="demo-account-pills">
                <div
                  className="demo-pill"
                  onClick={() => selectDemoAccount('aarav.sharma1')}
                  title="Select Aarav Sharma"
                >
                  <div className="demo-pill-name">Aarav Sharma</div>
                  <div className="demo-pill-meta">ACC-0000001 (Platinum Savings)</div>
                </div>
                <div
                  className="demo-pill"
                  onClick={() => selectDemoAccount('diya.patel2')}
                  title="Select Diya Patel"
                >
                  <div className="demo-pill-name">Diya Patel</div>
                  <div className="demo-pill-meta">ACC-0000002 (Corporate Gold)</div>
                </div>
                <div
                  className="demo-pill"
                  onClick={() => selectDemoAccount('kavya.nair4')}
                  title="Select Kavya Nair"
                >
                  <div className="demo-pill-name">Kavya Nair</div>
                  <div className="demo-pill-meta">ACC-0000004 (Retail Premier)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* View 2: Commercial Banking Dashboard */
        <div className="dashboard-grid">
          {/* Top Left: Virtual Debit Card & Live Balance */}
          <div className="glass-card">
            <div className="card-title-row">
              <h2>Platinum Debit & Primary Account</h2>
              <button
                className="btn-refresh"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Sync balance from Core Banking"
              >
                <span className={refreshing ? 'spinning' : ''}>↻</span> Refresh
              </button>
            </div>

            {/* Virtual EMV Debit Card */}
            <div className="platinum-card">
              <div className="card-top">
                <div className="card-issuer">ERODE SSS BANK</div>
                <div className="card-tier">{isCardFrozen ? 'CARD FROZEN' : 'PLATINUM'}</div>
              </div>

              <div className="emv-chip"></div>

              <div className="card-number-masked">
                •••• •••• •••• {user.accountNumber ? user.accountNumber.slice(-4) : '0001'}
              </div>

              <div className="card-bottom">
                <div>
                  <div className="card-holder-label">Cardholder</div>
                  <div className="card-holder-name">{user.name}</div>
                </div>
                <div className="card-network-logo">VISA</div>
              </div>
            </div>

            {/* Live Balance Row */}
            <div className="balance-display-box">
              <div>
                <div className="balance-meta-label">
                  <span>Available Balance</span>
                  <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 700 }}>● Live</span>
                </div>
                <div className="balance-amount">
                  {balance ? formatCurrency(balance.balanceInr) : '₹ 0.00'}
                </div>
              </div>

              <button
                onClick={() => setIsCardFrozen(!isCardFrozen)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isCardFrozen ? '1px solid #10b981' : '1px solid #f43f5e',
                  background: isCardFrozen ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                  color: isCardFrozen ? '#34d399' : '#fb7185'
                }}
              >
                {isCardFrozen ? 'Unfreeze Card' : 'Freeze Card'}
              </button>
            </div>

            {/* Account Specs */}
            <div className="account-specs-row">
              <div className="spec-cell">
                <div className="spec-label">Account Number</div>
                <div className="spec-val">{user.accountId}</div>
              </div>
              <div className="spec-cell">
                <div className="spec-label">IFSC Code</div>
                <div className="spec-val">ESSS0001001</div>
              </div>
              <div className="spec-cell">
                <div className="spec-label">Branch</div>
                <div className="spec-val">Erode Central</div>
              </div>
            </div>
          </div>

          {/* Top Right: Instant Fund Transfer Form */}
          <div className="glass-card">
            <div className="card-title-row">
              <h2>Instant Fund Transfer</h2>
              <div className="card-subtitle">Zero Fee 24x7 IMPS / NEFT</div>
            </div>

            {/* Quick Beneficiary Selector */}
            {beneficiaries.length > 0 && (
              <div>
                <div className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px' }}>
                  Quick Recipients
                </div>
                <div className="recipient-pills-row">
                  {beneficiaries.map((b) => (
                    <button
                      key={b.beneficiaryId || b.accountNumber}
                      type="button"
                      className="pill-recipient"
                      onClick={() => handleSelectRecipient(b)}
                    >
                      {b.name} ({b.accountNumber})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleTransfer}>
              <div className="form-group">
                <label className="form-label">Beneficiary Account Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={targetAccount}
                  onChange={(e) => setTargetAccount(e.target.value)}
                  placeholder="e.g. ACC-0000002"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Amount (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="form-input"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="Enter amount to send"
                  required
                />
                <div className="amount-chips">
                  {['500', '1000', '5000', '10000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className="chip-btn"
                      onClick={() => setTransferAmount(amt)}
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks / Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                  placeholder="e.g. Rent, Freelance, Monthly allowance"
                />
              </div>

              <button type="submit" className="btn-primary" disabled={transferLoading}>
                {transferLoading ? 'Authorizing & Processing...' : 'Authorize Instant Transfer'}
              </button>
            </form>
          </div>

          {/* Bottom Left: Utility Bill Settlement Card */}
          <div className="glass-card">
            <div className="card-title-row">
              <h2>Utility Bill Settlement</h2>
              <div className="card-subtitle">BBPS Integrated Payments</div>
            </div>

            <div className="bills-container">
              {bills.length === 0 ? (
                <div className="empty-state">No pending utility bills found for your account.</div>
              ) : (
                bills.map((bill) => (
                  <div key={bill.billId} className="bill-item">
                    <div className="bill-details">
                      <h4>{bill.billerName}</h4>
                      <div className="bill-meta">
                        Invoice ID: {bill.billId} &bull; Code: {bill.billerCode}
                      </div>
                    </div>

                    <div className="bill-action">
                      <div className="bill-price">{formatCurrency(bill.amountInr)}</div>
                      {bill.status === 'PAID' ? (
                        <div className="bill-paid-badge">✓ Paid</div>
                      ) : (
                        <button
                          className="btn-pay-bill"
                          disabled={payingBillId === bill.billId}
                          onClick={() => handlePayBill(bill)}
                        >
                          {payingBillId === bill.billId ? 'Processing...' : 'Pay Invoice'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Right: Beneficiaries Management */}
          <div className="glass-card">
            <div className="card-title-row">
              <h2>Registered Beneficiaries</h2>
              <button
                className="chip-btn"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => setShowAddBene(!showAddBene)}
              >
                {showAddBene ? 'Cancel' : '+ Add Beneficiary'}
              </button>
            </div>

            {showAddBene && (
              <form
                onSubmit={handleAddBeneficiary}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newBeneName}
                    onChange={(e) => setNewBeneName(e.target.value)}
                    placeholder="Recipient Name"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Account Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newBeneAccount}
                    onChange={(e) => setNewBeneAccount(e.target.value)}
                    placeholder="ACC-XXXXXXX"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ padding: '10px 16px' }}>
                  Save Beneficiary
                </button>
              </form>
            )}

            <div className="bills-container">
              {beneficiaries.length === 0 ? (
                <div className="empty-state">No beneficiaries registered yet.</div>
              ) : (
                beneficiaries.map((b) => (
                  <div key={b.beneficiaryId || b.accountNumber} className="bill-item">
                    <div>
                      <h4 style={{ fontSize: '0.92rem' }}>{b.name}</h4>
                      <div className="bill-meta" style={{ fontFamily: 'var(--font-mono)' }}>
                        {b.accountNumber} &bull; Bank: {b.bankCode}
                      </div>
                    </div>
                    <button
                      className="chip-btn"
                      style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
                      onClick={() => handleSelectRecipient(b)}
                    >
                      Send Money
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Full Width: Live Account Statement Ledger */}
          <div className="glass-card full-width">
            <div className="card-title-row">
              <h2>Account Statement & Recent Transactions</h2>
              <div className="card-subtitle">Real-time Core Banking Ledger</div>
            </div>

            <div className="tx-table-wrapper">
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Reference ID</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Closing Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                        No transactions recorded on this account yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.transactionId}>
                        <td style={{ color: 'var(--text-muted)' }}>{formatDate(tx.createdAt)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                          {tx.transactionId}
                        </td>
                        <td style={{ fontWeight: 600 }}>{tx.description}</td>
                        <td>
                          <span className={`tx-badge ${tx.type === 'CREDIT' ? 'tx-credit' : 'tx-debit'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={tx.type === 'CREDIT' ? 'tx-amount-credit' : 'tx-amount-debit'}>
                          {tx.type === 'CREDIT' ? '+' : '-'} {formatCurrency(tx.amountInr)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(tx.balanceAfterInr)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
