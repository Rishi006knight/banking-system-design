import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 20,
    duration: '30s',
};

export default function () {
    const accNum = Math.floor(Math.random() * 400) + 1;
    const accId = 'ACC-' + String(accNum).padStart(7, '0');
    const res = http.get(`http://localhost:8080/accounts/${accId}/balance`, {
        headers: {
            'X-Benchmark-Client': 'true',
            'X-Account-Id': accId,
        },
        timeout: '3s'
    });
    check(res, {
        'status is 200': (r) => r.status === 200,
    });
    sleep(0.01);
}
