import type {
  User,
  Balance,
  Transaction,
  Bill,
  Beneficiary,
  AccountNotification,
  TransferResult,
  TelemetryEvent,
  SystemMetrics
} from './types';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

type TelemetryListener = (event: TelemetryEvent) => void;
const telemetryListeners: TelemetryListener[] = [];

export function subscribeTelemetry(listener: TelemetryListener): () => void {
  telemetryListeners.push(listener);
  return () => {
    const idx = telemetryListeners.indexOf(listener);
    if (idx !== -1) telemetryListeners.splice(idx, 1);
  };
}

export function emitTelemetry(event: TelemetryEvent) {
  telemetryListeners.forEach((l) => {
    try {
      l(event);
    } catch (e) {
      console.error(e);
    }
  });
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'req-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errorMsg = data && data.error ? data.error : `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return data as T;
}

function recordApiTelemetry(
  action: string,
  res: Response,
  startTime: number,
  details: string
) {
  const latencyMs = Math.round(performance.now() - startTime);
  const node = res.headers.get('x-served-by') || 'node-gateway';
  const shard = res.headers.get('x-shard') || res.headers.get('x-gateway-route') || 'ring-routed';
  const cacheHit = res.headers.get('x-cache-hit') === 'true';

  emitTelemetry({
    id: generateUUID(),
    timestamp: Date.now(),
    action,
    status: res.status,
    latencyMs,
    node,
    shard,
    cacheHit,
    details
  });
}

export async function loginApi(username: string, password: string): Promise<{ token: string; user: User }> {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await handleResponse<any>(res);
  recordApiTelemetry('POST /auth/login', res, start, `Session authenticated for ${username}`);

  const user: User = {
    id: data.customerId || data.id || 'CUST-0000001',
    username: data.username || username,
    name: data.fullName || data.name || username,
    accountId: data.primaryAccountId || data.accountId || 'ACC-0000001',
    accountNumber: data.primaryAccountId || data.accountNumber || 'ACC-0000001'
  };
  return { token: data.token, user };
}

export async function getBalanceApi(accountId: string, token: string): Promise<Balance> {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/accounts/${encodeURIComponent(accountId)}/balance`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    }
  });
  const data = await handleResponse<Balance>(res);
  recordApiTelemetry(
    `GET /accounts/${accountId}/balance`,
    res,
    start,
    `Balance: INR ${data.balanceInr.toLocaleString('en-IN')} (Cache: ${res.headers.get('x-cache-hit') === 'true' ? 'HIT' : 'MISS'})`
  );
  return data;
}

export async function getTransactionsApi(accountId: string, token: string, size = 20): Promise<Transaction[]> {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/accounts/${encodeURIComponent(accountId)}/transactions?page=0&size=${size}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    }
  });
  const data = await handleResponse<Transaction[]>(res);
  recordApiTelemetry(`GET /accounts/${accountId}/transactions`, res, start, `Ledger loaded ${data.length} transactions`);
  return data;
}

export async function getBillsApi(customerId: string, accountId: string, token: string): Promise<Bill[]> {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/bills?customerId=${encodeURIComponent(customerId)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    }
  });
  const data = await handleResponse<Bill[]>(res);
  recordApiTelemetry('GET /bills', res, start, `Retrieved ${data.length} utility bills`);
  return data;
}

export async function payBillApi(billId: string, accountId: string, token: string): Promise<Bill> {
  const start = performance.now();
  const idemKey = generateUUID();
  const res = await fetch(`${API_BASE}/billpayments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId,
      'Idempotency-Key': idemKey
    },
    body: JSON.stringify({
      billId,
      accountId
    })
  });
  const data = await handleResponse<Bill>(res);
  recordApiTelemetry(
    'POST /billpayments',
    res,
    start,
    `Invoice ${billId} settled | Idempotency: ${idemKey.slice(0, 8)}...`
  );
  return data;
}

export async function getBeneficiariesApi(customerId: string, accountId: string, token: string): Promise<Beneficiary[]> {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/beneficiaries?customerId=${encodeURIComponent(customerId)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    }
  });
  const data = await handleResponse<Beneficiary[]>(res);
  recordApiTelemetry('GET /beneficiaries', res, start, `Loaded ${data.length} beneficiaries`);
  return data;
}

export async function addBeneficiaryApi(
  customerId: string,
  beneficiary: { name: string; accountNumber: string; bankCode: string },
  accountId: string,
  token: string
): Promise<Beneficiary> {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/beneficiaries?customerId=${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    },
    body: JSON.stringify(beneficiary)
  });
  const data = await handleResponse<Beneficiary>(res);
  recordApiTelemetry('POST /beneficiaries', res, start, `Beneficiary registered: ${beneficiary.name}`);
  return data;
}

export async function getNotificationsApi(customerId: string, accountId: string, token: string): Promise<AccountNotification[]> {
  const res = await fetch(`${API_BASE}/notifications?customerId=${encodeURIComponent(customerId)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    }
  });
  return handleResponse<AccountNotification[]>(res);
}

export async function executeTransferApi(
  sourceAccountId: string,
  destAccountId: string,
  amountInr: number,
  description: string,
  token: string
): Promise<TransferResult> {
  const start = performance.now();
  const amountCents = Math.round(amountInr * 100);
  const idempotencyKey = generateUUID();
  const res = await fetch(`${API_BASE}/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': sourceAccountId,
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      sourceAccountId,
      destAccountId,
      amountCents,
      description: description || 'Digital Fund Transfer'
    })
  });
  const data = await handleResponse<TransferResult>(res);
  recordApiTelemetry(
    'POST /transfers',
    res,
    start,
    `Transfer ${data.transferId} [${data.status}] | ${sourceAccountId} -> ${destAccountId} (INR ${amountInr}) | Type: ${data.transferType || 'ACID'}`
  );
  return data;
}

export async function fetchLiveSystemMetrics(): Promise<SystemMetrics | null> {
  try {
    const [gwRes, adminRes] = await Promise.all([
      fetch(`${API_BASE}/gateway/metrics`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${API_BASE}/admin/metrics`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    ]);

    if (!adminRes && !gwRes) return null;

    return {
      rateLimiter: (adminRes?.rateLimiter) || (gwRes?.rateLimiter) || {
        totalRequests: 0,
        allowedRequests: 0,
        rejectedRequests: 0,
        rejectionRatePercent: 0,
        activeBuckets: 0
      },
      keyValueStore: (adminRes?.keyValueStore) || {
        hits: 0,
        misses: 0,
        hitRatioPercent: 0,
        avgGetLatencyNanos: 0,
        activeKeys: 0
      },
      uniqueIdGenerator: (adminRes?.uniqueIdGenerator) || {
        totalGenerated: 0,
        generationRatePerSecond: 0
      },
      consistentHashRing: (adminRes?.consistentHashRing) || {
        nodeCount: 3,
        physicalNodes: ['bank-shard-0', 'bank-shard-1', 'bank-shard-2'],
        virtualNodesPerNode: 150,
        totalVirtualNodes: 450
      },
      activeServerCount: gwRes?.activeServerCount ?? 3,
      totalServerCount: gwRes?.totalServerCount ?? 3
    };
  } catch (e) {
    console.error('Failed to fetch live system metrics', e);
    return null;
  }
}
