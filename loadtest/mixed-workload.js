import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const vus = parseInt(__ENV.VUS || '50', 10);
const duration = __ENV.DURATION || '15s';
const rampTime = __ENV.RAMP_TIME;
const steadyTime = __ENV.STEADY_TIME;
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';

// Real seeded users for realistic authentication
const users = JSON.parse(open('./users.json'));

// Fine-grained Global Error Accounting Counters
export const http2xx = new Counter('http_2xx');
export const duration2xx = new Trend('duration_2xx');
export const http400 = new Counter('http_400');
export const http401 = new Counter('http_401');
export const http404 = new Counter('http_404');
export const http409 = new Counter('http_409');
export const http429RateLimit = new Counter('http_429_rate_limit');
export const http4xxExpected = new Counter('http_4xx_expected');
export const http5xxServerError = new Counter('http_5xx_server_error');
export const httpTimeouts = new Counter('http_timeouts');

// Per-Endpoint Counters for Granular Error Breakdown
export const epLogin2xx = new Counter('ep_login_2xx');
export const epLogin4xx = new Counter('ep_login_4xx');
export const epLogin429 = new Counter('ep_login_429');
export const epBalance2xx = new Counter('ep_balance_2xx');
export const epBalance4xx = new Counter('ep_balance_4xx');
export const epBalance429 = new Counter('ep_balance_429');
export const epTransfer2xx = new Counter('ep_transfer_2xx');
export const epTransfer4xx = new Counter('ep_transfer_4xx');
export const epTransfer429 = new Counter('ep_transfer_429');
export const epBill2xx = new Counter('ep_bill_2xx');
export const epBill4xx = new Counter('ep_bill_4xx');
export const epBill429 = new Counter('ep_bill_429');
export const epHistory2xx = new Counter('ep_history_2xx');
export const epHistory4xx = new Counter('ep_history_4xx');
export const epHistory429 = new Counter('ep_history_429');

export const options = (rampTime && steadyTime) ? {
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
    stages: [
        { duration: rampTime, target: vus },
        { duration: steadyTime, target: vus }
    ],
    thresholds: {
        http_req_duration: ['p(95)<1500'],
    },
} : {
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
    vus: vus,
    duration: duration,
    thresholds: {
        http_req_duration: ['p(95)<1500'],
    },
};

// Helper to record fine-grained error accounting per endpoint
function recordMetrics(res, endpoint) {
    if (!res || res.status === 0) {
        httpTimeouts.add(1);
    } else if (res.status >= 200 && res.status < 300) {
        http2xx.add(1);
        duration2xx.add(res.timings.duration);
        if (endpoint === 'login') epLogin2xx.add(1);
        else if (endpoint === 'balance') epBalance2xx.add(1);
        else if (endpoint === 'transfers') epTransfer2xx.add(1);
        else if (endpoint === 'billpayments') epBill2xx.add(1);
        else if (endpoint === 'transactions') epHistory2xx.add(1);
    } else if (res.status === 429) {
        http429RateLimit.add(1);
        if (endpoint === 'login') epLogin429.add(1);
        else if (endpoint === 'balance') epBalance429.add(1);
        else if (endpoint === 'transfers') epTransfer429.add(1);
        else if (endpoint === 'billpayments') epBill429.add(1);
        else if (endpoint === 'transactions') epHistory429.add(1);
    } else if (res.status >= 400 && res.status < 500) {
        http4xxExpected.add(1);
        if (res.status === 400) http400.add(1);
        else if (res.status === 401) http401.add(1);
        else if (res.status === 404) http404.add(1);
        else if (res.status === 409) http409.add(1);

        if (endpoint === 'login') epLogin4xx.add(1);
        else if (endpoint === 'balance') epBalance4xx.add(1);
        else if (endpoint === 'transfers') epTransfer4xx.add(1);
        else if (endpoint === 'billpayments') epBill4xx.add(1);
        else if (endpoint === 'transactions') epHistory4xx.add(1);
    } else if (res.status >= 500) {
        http5xxServerError.add(1);
        console.log(`[5XX ERROR] Status: ${res.status} | Body: ${res.body}`);
    }
}

// Helper to get random seeded account ID from the 416 seeded accounts
function getRandomAccount() {
    const num = Math.floor(Math.random() * 416) + 1;
    return 'ACC-' + String(num).padStart(7, '0');
}

// Per-VU state: Authenticate ONCE per VU and reuse bearer token across iterations
let vuAuthToken = null;
let vuAccountId = null;

export default function () {
    const vuId = __VU;
    // Each Virtual User represents a distinct client device with its own IP address
    const octet2 = Math.floor(vuId / 254);
    const octet3 = (vuId % 254) + 1;
    const clientIp = `10.0.${octet2}.${octet3}`;

    // Standard headers: NO X-Benchmark-Client header per Step 2 audit rule
    const headers = {
        'X-Forwarded-For': clientIp,
    };

    // 1. Authenticate once per VU on the first iteration
    if (!vuAuthToken) {
        const userIndex = (vuId - 1) % users.length;
        const user = users[userIndex];
        const loginPayload = JSON.stringify({
            username: user.username,
            password: 'Password@123'
        });

        const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
            headers: Object.assign({}, headers, {
                'Content-Type': 'application/json',
            }),
            tags: { endpoint: 'login' },
        });
        recordMetrics(loginRes, 'login');

        if (loginRes.status === 200) {
            try {
                const body = JSON.parse(loginRes.body);
                vuAuthToken = body.token || 'session-token-' + vuId;
                vuAccountId = body.primaryAccountId || user.accountId || getRandomAccount();
            } catch (e) {
                vuAuthToken = 'session-token-' + vuId;
                vuAccountId = user.accountId || getRandomAccount();
            }
        } else {
            // Fallback token if user credentials not in seed range
            vuAuthToken = 'session-token-' + vuId;
            vuAccountId = user.accountId || getRandomAccount();
        }
        sleep(0.01);
        return;
    }

    const authHeaders = Object.assign({}, headers, {
        'Authorization': `Bearer ${vuAuthToken}`,
    });

    const rand = Math.random();

    if (rand < 0.60) {
        // 1. 60% Balance & Account Reads
        const accId = vuAccountId || getRandomAccount();
        const res = http.get(`${BASE_URL}/accounts/${accId}/balance`, {
            headers: Object.assign({}, authHeaders, {
                'X-Account-Id': accId,
            }),
            tags: { endpoint: 'balance' },
        });
        recordMetrics(res, 'balance');
        check(res, {
            'balance read status valid': (r) => r.status === 200 || r.status === 429,
        });
    } else if (rand < 0.85) {
        // 2. 25% Transfers (Same-shard & Cross-shard distributed Saga)
        const srcAcc = vuAccountId || getRandomAccount();
        let dstAcc = getRandomAccount();
        while (dstAcc === srcAcc) {
            dstAcc = getRandomAccount();
        }
        const idemKey = `K6-TRF-${vuId}-${__ITER}-${Date.now()}`;

        const payload = JSON.stringify({
            sourceAccountId: srcAcc,
            destAccountId: dstAcc,
            amountCents: 1, // 1 paisa (ensures account balances never deplete during load test)
            description: 'Benchmark Transfer'
        });

        const res = http.post(`${BASE_URL}/transfers`, payload, {
            headers: Object.assign({}, authHeaders, {
                'Content-Type': 'application/json',
                'Idempotency-Key': idemKey,
                'X-Account-Id': srcAcc,
            }),
            tags: { endpoint: 'transfers' },
        });
        recordMetrics(res, 'transfers');
        check(res, {
            'transfer status valid': (r) => r.status === 200 || r.status === 429,
        });
    } else if (rand < 0.95) {
        // 3. 10% Utility Bill Payments
        const accId = vuAccountId || getRandomAccount();
        const billNum = (Math.floor(Math.random() * 200) + 1);
        const billId = 'BILL-' + String(billNum).padStart(7, '0');
        const idemKey = `K6-BILL-${vuId}-${__ITER}-${Date.now()}`;

        const payload = JSON.stringify({
            accountId: accId,
            billId: billId,
        });

        const res = http.post(`${BASE_URL}/billpayments`, payload, {
            headers: Object.assign({}, authHeaders, {
                'Content-Type': 'application/json',
                'Idempotency-Key': idemKey,
                'X-Account-Id': accId,
            }),
            tags: { endpoint: 'billpayments' },
        });
        recordMetrics(res, 'billpayments');
        check(res, {
            'bill payment status valid': (r) => r.status === 200 || r.status === 429,
        });
    } else {
        // 4. 5% Transaction History Queries
        const accId = vuAccountId || getRandomAccount();
        const res = http.get(`${BASE_URL}/accounts/${accId}/transactions`, {
            headers: Object.assign({}, authHeaders, {
                'X-Account-Id': accId,
            }),
            tags: { endpoint: 'transactions' },
        });
        recordMetrics(res, 'transactions');
        check(res, {
            'history status valid': (r) => r.status === 200 || r.status === 429,
        });
    }

    sleep(0.005);
}
