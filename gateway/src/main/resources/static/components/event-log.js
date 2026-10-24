export class EventLogStream {
  constructor(container) {
    this.container = container;
    this.events = [];
    this.maxEvents = 30;
    this.render();
  }
  addEvent({ action, details, timestamp = Date.now() }) {
    const formatted = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      action: (action || 'EVENT').toUpperCase(),
      details: details || ''
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
    return `${d.toTimeString().split(' ')[0]}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  }
  getPillClass(action) {
    if (['SYSTEM_BOOT', 'NODE_REJOINED'].includes(action)) return 'event-pill-grey';
    if (['LOGIN_ALLOWED', 'CACHE_HIT', 'SAGA_COMPLETED'].includes(action)) return 'event-pill-green';
    if (['LOGIN_THROTTLED', 'NODE_DOWN'].includes(action)) return 'event-pill-red';
    if (['CACHE_MISS', 'SAGA_STEP'].includes(action)) return 'event-pill-orange';
    if (['RING_ROUTE', 'TRANSFER_INITIATED'].includes(action)) return 'event-pill-blue';
    return 'event-pill-grey';
  }
  render() {
    if (!this.container) return;
    if (this.events.length === 0) {
      this.container.innerHTML = `
        <div style="font-family: var(--font-mono); font-size: 11px; color: var(--muted); text-align: center; padding: 12px;">
          Live audit feed active. Ready for transactions...
        </div>
      `;
      return;
    }
    const rowsHtml = this.events.map(e => `
      <div class="event-row">
        <div class="event-header">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="event-pill ${this.getPillClass(e.action)}">${e.action}</span>
            <span style="color: var(--muted); font-size: 10px;">[${this.formatTime(e.timestamp)}]</span>
          </div>
        </div>
        <div style="color: var(--ink); word-break: break-word;">${e.details}</div>
      </div>
    `).join('');
    this.container.innerHTML = rowsHtml;
  }
}
