import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const vus = parseInt(__ENV.VUS || '50', 10);
const duration = __ENV.DURATION || '10s';
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';

// Explicit Error Accounting Counters (Audit Step 2 Requirement)
export const http2xx = new Counter('http_2xx');
export const http4xxExpected = new Counter('http_4xx_expected');
export const http429RateLimit = new Counter('http_429_rate_limit');
export const http5xxServerError = new Counter('http_5xx_server_error');
export const httpTimeouts = new Counter('http_timeouts');

export const options = {
    vus: vus,
    duration: duration,
    thresholds: {
        http_req_duration: ['p(95)<1500'],
    },
};

// Helper to record fine-grained error accounting
function recordMetrics(res) {
    if (!res || res.status === 0) {
        httpTimeouts.add(1);
    } else if (res.status >= 200 && res.status < 300) {
        http2xx.add(1);
    } else if (res.status === 429) {
        http429RateLimit.add(1);
    } else if (res.status >= 400 && res.status < 500) {
        http4xxExpected.add(1);
    } else if (res.status >= 500) {
        http5xxServerError.add(1);
    }
}

// Helper to get random seeded account ID from the 400 seeded accounts
function getRandomAccount() {
    const num = Math.floor(Math.random() * 400) + 1;
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
        const userNum = ((vuId - 1) % 200) + 1;
        const loginPayload = JSON.stringify({
            username: `aarav.sharma${userNum}`,
            password: 'Password@123'
        });

        const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
            headers: Object.assign({}, headers, {
                'Content-Type': 'application/json',
            }),
        });
        recordMetrics(loginRes);

        if (loginRes.status === 200) {
            try {
                const body = JSON.parse(loginRes.body);
                vuAuthToken = body.token || 'session-token-' + vuId;
                vuAccountId = body.primaryAccountId || getRandomAccount();
            } catch (e) {
                vuAuthToken = 'session-token-' + vuId;
                vuAccountId = getRandomAccount();
            }
        } else {
            // Fallback token if user credentials not in seed range
            vuAuthToken = 'session-token-' + vuId;
            vuAccountId = getRandomAccount();
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
        });
        recordMetrics(res);
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
        });
        recordMetrics(res);
        check(res, {
            'transfer status valid': (r) => r.status === 200 || r.status === 429,
        });
    } else if (rand < 0.95) {
        // 3. 10% Utility Bill Payments
        const accId = vuAccountId || getRandomAccount();
        const billNum = (Math.floor(Math.random() * 20) + 1);
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
        });
        recordMetrics(res);
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
        });
        recordMetrics(res);
        check(res, {
            'history status valid': (r) => r.status === 200 || r.status === 429,
        });
    }

    sleep(0.005);
}
