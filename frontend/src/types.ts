export interface User {
  id: string;
  username: string;
  name: string;
  accountId: string;
  accountNumber: string;
}

export interface Balance {
  accountId: string;
  balanceCents: number;
  balanceInr: number;
  currency: string;
  cached: boolean;
  shardId?: string;
}

export interface Transaction {
  transactionId: string;
  accountId: string;
  type: 'CREDIT' | 'DEBIT';
  amountCents: number;
  amountInr: number;
  balanceAfterCents: number;
  balanceAfterInr: number;
  description: string;
  idempotencyKey?: string;
  createdAt: number;
}

export interface Bill {
  billId: string;
  customerId: string;
  billerCode: string;
  billerName: string;
  amountCents: number;
  amountInr: number;
  status: 'UNPAID' | 'PAID';
  paidAt?: number | null;
}

export interface Beneficiary {
  beneficiaryId: string;
  customerId: string;
  name: string;
  accountNumber: string;
  bankCode: string;
}

export interface AccountNotification {
  notificationId?: string;
  customerId?: string;
  message: string;
  read?: boolean;
  createdAt: number;
}

export interface TransferResult {
  transferId: string;
  sourceAccountId: string;
  destAccountId: string;
  amountCents: number;
  amountInr: number;
  status: string;
  transferType?: string;
  idempotencyKey?: string;
  timestamp?: number;
}
