import http from 'k6/http';
import { check } from 'k6';

export const options = {
    scenarios: {
        abusive_burst: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 100,
            maxDuration: '30s',
        },
    },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';

export default function () {
    const payload = JSON.stringify({
        username: 'attacker.bot',
        password: 'WrongPassword123'
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': '192.168.1.100' // Single fixed IP to trigger Token Bucket exhaustion
        },
    };

    const start = Date.now();
    const res = http.post(`${BASE_URL}/auth/login`, payload, params);
    const duration = Date.now() - start;

    const retryAfter = res.headers['Retry-After'] || '';

    // Print CSV row for each request so it can be parsed into abusive_login_results.csv
    console.log(`TRACE_REQ:${__ITER + 1},192.168.1.100,/auth/login,${res.status},${res.status === 429 ? 'REJECTED_RATE_LIMITED' : 'ALLOWED'},${retryAfter},${duration}`);

    check(res, {
        'status is 200/401 (allowed) or 429 (rate limited)': (r) => r.status === 200 || r.status === 401 || r.status === 429,
        'rate limited returns Retry-After header': (r) => r.status !== 429 || r.headers['Retry-After'] !== undefined,
    });
}
