import type {
  User,
  Balance,
  Transaction,
  Bill,
  Beneficiary,
  AccountNotification,
  TransferResult
} from './types';

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

export async function loginApi(username: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await handleResponse<any>(res);
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
  const res = await fetch(`/accounts/${encodeURIComponent(accountId)}/balance`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    }
  });
  return handleResponse<Balance>(res);
}

export async function getTransactionsApi(accountId: string, token: string, size = 20): Promise<Transaction[]> {
  const res = await fetch(`/accounts/${encodeURIComponent(accountId)}/transactions?page=0&size=${size}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    }
  });
  return handleResponse<Transaction[]>(res);
}

export async function getBillsApi(customerId: string, accountId: string, token: string): Promise<Bill[]> {
  const res = await fetch(`/bills?customerId=${encodeURIComponent(customerId)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    }
  });
  return handleResponse<Bill[]>(res);
}

export async function payBillApi(billId: string, accountId: string, token: string): Promise<Bill> {
  const res = await fetch('/billpayments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId,
      'Idempotency-Key': generateUUID()
    },
    body: JSON.stringify({
      billId,
      accountId
    })
  });
  return handleResponse<Bill>(res);
}

export async function getBeneficiariesApi(customerId: string, accountId: string, token: string): Promise<Beneficiary[]> {
  const res = await fetch(`/beneficiaries?customerId=${encodeURIComponent(customerId)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    }
  });
  return handleResponse<Beneficiary[]>(res);
}

export async function addBeneficiaryApi(
  customerId: string,
  beneficiary: { name: string; accountNumber: string; bankCode: string },
  accountId: string,
  token: string
): Promise<Beneficiary> {
  const res = await fetch(`/beneficiaries?customerId=${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Account-Id': accountId
    },
    body: JSON.stringify(beneficiary)
  });
  return handleResponse<Beneficiary>(res);
}

export async function getNotificationsApi(customerId: string, accountId: string, token: string): Promise<AccountNotification[]> {
  const res = await fetch(`/notifications?customerId=${encodeURIComponent(customerId)}`, {
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
  const amountCents = Math.round(amountInr * 100);
  const idempotencyKey = generateUUID();
  const res = await fetch('/transfers', {
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
  return handleResponse<TransferResult>(res);
}
