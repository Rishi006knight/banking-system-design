
export const GATEWAY_URL = (() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('gateway')) return params.get('gateway').replace(/\/$/, '');
  if (localStorage.getItem('GATEWAY_URL')) return localStorage.getItem('GATEWAY_URL').replace(/\/$/, '');
  if (window.GATEWAY_URL) return window.GATEWAY_URL.replace(/\/$/, '');
  if (window.location.port === '8080' || window.location.hostname.includes('onrender.com')) {
    return window.location.origin;
  }
  return 'http://localhost:8080';
})();
export class ApiClient {
  constructor() {
    this.baseUrl = GATEWAY_URL;
    this.isOffline = false;
    this.onOfflineStateChange = null;
    this.onTrace = null;
  }
  setToken(token) {
    this.token = token;
  }
  async request(endpoint, options = {}) {
    const start = performance.now();
    const headers = new Headers(options.headers || {});
    if (this.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });
      const latency = Math.round(performance.now() - start);
      const servedBy = response.headers.get('X-Served-By') || 'node:8081';
      const shard = response.headers.get('X-Shard') || '0';
      const cacheHit = response.headers.get('X-Cache-Hit') === 'true' || response.headers.get('X-Cache-Hit') === 'HIT';
      const retryAfter = response.headers.get('Retry-After');
      if (this.isOffline) {
        this.isOffline = false;
        if (this.onOfflineStateChange) this.onOfflineStateChange(false);
      }
      if (response.status === 429) {
        const errData = await response.json().catch(() => ({}));
        const err = new Error(errData.error || `Rate limited · retry in ${retryAfter || 12}s`);
        err.status = 429;
        err.retryAfter = retryAfter ? parseInt(retryAfter, 10) : 12;
        throw err;
      }
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const err = new Error(errData.error || errData.message || `HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }
      const data = await response.json().catch(() => ({}));
      return { data, headers: response.headers, latency, status: response.status };
    } catch (err) {
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        if (!this.isOffline) {
          this.isOffline = true;
          if (this.onOfflineStateChange) this.onOfflineStateChange(true);
        }
      }
      throw err;
    }
  }
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }
  post(endpoint, body = {}, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: JSON.stringify(body)
    });
  }
}
export const api = new ApiClient();
