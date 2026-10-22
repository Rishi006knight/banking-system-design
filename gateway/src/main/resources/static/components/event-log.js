
export class EventLogStream {
  constructor(containerElement) {
    this.container = containerElement;
    this.events = [];
    this.maxEvents = 50;
    this.init();
  }
  init() {
    this.render();
  }
  addEvent(event) {
    const formatted = {
      id: event.id || 'evt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: event.timestamp || Date.now(),
      action: event.action || 'EVENT',
      status: event.status || 200,
      latencyMs: event.latencyMs !== undefined ? event.latencyMs : 0,
      node: event.node || 'gateway:8080',
      shard: event.shard || 'cluster',
      cacheHit: event.cacheHit,
      details: event.details || ''
    };
    this.events = [formatted, ...this.events.slice(0, this.maxEvents - 1)];
    this.render();
  }
  clear() {
    this.events = [];
    this.render();
  }
  formatTime(ts) {
    const d = new Date(ts);
    return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }
  getColor(action, status) {
    const act = (action || '').toUpperCase();
    if (status === 429 || act.includes('THROTTLE') || act.includes('DROP') || act.includes('KILL') || act.includes('FAIL')) {
      return { border: '#d64545', bg: '#fbe7e7', text: '#d64545' }; // Red
    }
    if (act.includes('DEBIT') || act.includes('CREDIT_PENDING') || act.includes('MISS') || act.includes('STEP')) {
      return { border: '#e8832a', bg: '#fef3e7', text: '#e8832a' }; // Orange
    }
    if (act.includes('HIT') || act.includes('ALLOW') || act.includes('COMPLETE') || act.includes('REVIVE') || status === 200) {
      return { border: '#2e9e5b', bg: '#ecfdf5', text: '#2e9e5b' }; // Green
    }
    return { border: '#1f6fd1', bg: '#e8f0fb', text: '#1f6fd1' }; // Blue
  }
  render() {
    if (!this.container) return;
    if (this.events.length === 0) {
      this.container.innerHTML = `
        <div style="color: #9aa3b2; font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 12px; text-align: center;">
          Streaming event telemetry log initialized. Awaiting user actions...
        </div>
      `;
      return;
    }
    const html = this.events.map(e => {
      const c = this.getColor(e.action, e.status);
      return `
        <div class="log-row" style="
          border-left: 3px solid ${c.border}; background: #ffffff; border-radius: 4px;
          padding: 6px 8px; margin-bottom: 5px; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 800; color: ${c.text}; font-size: 10px; background: ${c.bg}; padding: 1px 5px; border-radius: 3px;">
                ${e.action}
              </span>
              <span style="color: #64748b; font-size: 10px;">[${this.formatTime(e.timestamp)}]</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: #1f6fd1; font-size: 10px;">${e.node}</span>
              ${e.latencyMs !== undefined ? `<span style="color: #2e9e5b; font-size: 10px; font-weight: 700;">${e.latencyMs}ms</span>` : ''}
            </div>
          </div>
          <div style="color: #1f2937; font-size: 11px; word-break: break-word;">
            ${e.details}
          </div>
        </div>
      `;
    }).join('');
    this.container.innerHTML = html;
  }
}
