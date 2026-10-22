import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 20,
    duration: '30s',
};

export default function () {
    const accNum = Math.floor(Math.random() * 400) + 1;
    const accId = 'ACC-' + String(accNum).padStart(7, '0');
    const vuId = __VU;
    const clientIp = `10.0.${Math.floor(vuId / 254)}.${(vuId % 254) + 1}`;
    const res = http.get(`http://localhost:8080/accounts/${accId}/balance`, {
        headers: {
            'X-Forwarded-For': clientIp,
            'X-Account-Id': accId,
        },
        timeout: '3s'
    });
    check(res, {
        'status is 200': (r) => r.status === 200,
    });
    sleep(0.01);
}
