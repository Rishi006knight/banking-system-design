import http from 'k6/http';
import { check, sleep } from 'k6';

const vus = parseInt(__ENV.VUS || '50', 10);
const duration = __ENV.DURATION || '20s';
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8080';

export const options = {
    vus: vus,
    duration: duration,
};

// Target a fixed set of hot accounts to measure warm cache saturation
const HOT_ACCOUNTS = ['ACC-0000001', 'ACC-0000002', 'ACC-0000003'];

export default function () {
    const accId = HOT_ACCOUNTS[Math.floor(Math.random() * HOT_ACCOUNTS.length)];
    const vuId = __VU;
    const clientIp = `10.1.0.${vuId % 200 + 1}`;

    const res = http.get(`${BASE_URL}/accounts/${accId}/balance`, {
        headers: {
            'X-Account-Id': accId,
            'X-Forwarded-For': clientIp,
        },
    });

    const isHit = res.headers['X-Cache-Hit'] === 'true';

    check(res, {
        'status is 200': (r) => r.status === 200,
        'cache hit header present on proposed system': (r) => res.headers['X-Cache-Hit'] !== undefined || BASE_URL.includes('8090'),
    });

    sleep(0.01);
}
