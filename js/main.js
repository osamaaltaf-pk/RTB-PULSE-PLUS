(() => {
  const config = loadConfig();
  const form = document.getElementById('query-form');
  const callerInput = document.getElementById('caller-id');
  const zipInput = document.getElementById('zip');
  const zipField = document.getElementById('zip-field');
  const resultsEl = document.getElementById('results');
  const runBtn = document.getElementById('run-btn');
  const runDot = document.getElementById('run-dot');

  const anyRouteNeedsZip = config.routes.some(r => r.fields.includes('zip'));
  if (anyRouteNeedsZip) zipField.style.display = '';

  function sourceById(id) {
    return config.sources.find(s => s.id === id) || { id, name: id, color: '#5B636F' };
  }

  function fillTemplate(url, callerId, zip) {
    return url
      .replaceAll('{{CALLER_ID}}', encodeURIComponent(callerId))
      .replaceAll('{{ZIP}}', encodeURIComponent(zip || ''));
  }

  function extractSummary(json) {
    // Best-effort read of common RTB payload shapes — falls back gracefully.
    if (!json || typeof json !== 'object') return { payout: null, status: 'none', note: 'No data' };
    const routes = Array.isArray(json.eligible_routes) ? json.eligible_routes : null;
    if (routes && routes.length > 0) {
      const best = routes.reduce((a, b) => (Number(b.payout) > Number(a.payout) ? b : a), routes[0]);
      return {
        payout: best.payout ?? null,
        status: 'eligible',
        note: `${routes.length} eligible route${routes.length > 1 ? 's' : ''} · best payout $${best.payout ?? '—'}`
      };
    }
    if (routes && routes.length === 0) {
      return { payout: null, status: 'none', note: json.total_routes != null ? `0 of ${json.total_routes} routes eligible` : 'No eligible routes' };
    }
    if (json.success === false) {
      return { payout: null, status: 'error', note: json.error || json.message || 'Buyer returned failure' };
    }
    if (typeof json.payout !== 'undefined') {
      return { payout: json.payout, status: Number(json.payout) > 0 ? 'eligible' : 'none', note: `Payout $${json.payout}` };
    }
    return { payout: null, status: 'none', note: 'No route data in response' };
  }

  function routeRowSkeleton(route) {
    const row = document.createElement('div');
    row.className = 'route-row';
    row.id = `row-${route.id}`;
    row.innerHTML = `
      <div class="route-top">
        <span class="status-dot pending" data-role="dot"></span>
        <span class="route-name">${escapeHtml(route.name)}</span>
        <span class="route-summary" data-role="summary">Checking…</span>
        <span class="route-payout" data-role="payout"></span>
        <button class="route-toggle" data-role="toggle" style="display:none">raw</button>
      </div>
      <div class="route-raw" data-role="raw" style="display:none"></div>
    `;
    return row;
  }

  function updateRow(route, outcome) {
    const row = document.getElementById(`row-${route.id}`);
    if (!row) return;
    const dot = row.querySelector('[data-role=dot]');
    const summary = row.querySelector('[data-role=summary]');
    const payoutEl = row.querySelector('[data-role=payout]');
    const toggle = row.querySelector('[data-role=toggle]');
    const raw = row.querySelector('[data-role=raw]');

    row.classList.remove('is-eligible', 'is-none', 'is-error');
    dot.classList.remove('pending', 'eligible', 'none', 'error');

    if (outcome.kind === 'skipped') {
      dot.classList.add('none');
      summary.textContent = outcome.reason;
      row.classList.add('is-none');
      return;
    }

    if (outcome.kind === 'error') {
      dot.classList.add('error');
      summary.textContent = outcome.message;
      row.classList.add('is-error');
      return;
    }

    const { status, note, payout } = extractSummary(outcome.data);
    dot.classList.add(status);
    row.classList.add(status === 'eligible' ? 'is-eligible' : status === 'error' ? 'is-error' : 'is-none');
    summary.textContent = note;
    if (payout != null) {
      payoutEl.textContent = `$${payout}`;
      payoutEl.classList.toggle('zero', Number(payout) === 0);
    }
    toggle.style.display = '';
    raw.textContent = JSON.stringify(outcome.data, null, 2);
    toggle.addEventListener('click', () => {
      const open = raw.style.display !== 'none';
      raw.style.display = open ? 'none' : 'block';
      toggle.textContent = open ? 'raw' : 'hide';
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderBoard() {
    resultsEl.innerHTML = '';
    if (config.routes.length === 0) {
      resultsEl.innerHTML = `<div class="empty-state"><div class="big">No routes configured</div>Add buyer routes from Manage routes to get started.</div>`;
      return;
    }
    for (const source of config.sources) {
      const routes = config.routes.filter(r => r.sourceId === source.id);
      if (routes.length === 0) continue;
      const group = document.createElement('div');
      group.className = 'source-group';
      group.innerHTML = `
        <div class="source-head">
          <span class="source-badge"><span class="source-swatch" style="background:${source.color}"></span>${escapeHtml(source.name)}</span>
          <span class="source-count">${routes.length}</span>
          <div class="source-line"></div>
        </div>
        <div class="route-list" data-role="list"></div>
      `;
      const list = group.querySelector('[data-role=list]');
      routes.forEach(r => list.appendChild(routeRowSkeleton(r)));
      resultsEl.appendChild(group);
    }
    // Routes whose source was deleted/unknown
    const orphan = config.routes.filter(r => !config.sources.some(s => s.id === r.sourceId));
    if (orphan.length) {
      const group = document.createElement('div');
      group.className = 'source-group';
      group.innerHTML = `<div class="source-head"><span class="source-badge"><span class="source-swatch" style="background:#5B636F"></span>Unassigned</span><span class="source-count">${orphan.length}</span><div class="source-line"></div></div><div class="route-list" data-role="list"></div>`;
      const list = group.querySelector('[data-role=list]');
      orphan.forEach(r => list.appendChild(routeRowSkeleton(r)));
      resultsEl.appendChild(group);
    }
  }

  async function runCheck(callerId, zip) {
    renderBoard();
    runBtn.disabled = true;
    runDot.style.display = '';

    const jobs = config.routes.map(async route => {
      if (route.fields.includes('caller_id') && !callerId) {
        return updateRow(route, { kind: 'skipped', reason: 'Caller ID required for this route' });
      }
      if (route.fields.includes('zip') && !zip) {
        return updateRow(route, { kind: 'skipped', reason: 'Zip code required for this route' });
      }
      const targetUrl = fillTemplate(route.url, callerId, zip);
      try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`, { signal: AbortSignal.timeout(20000) });
        const body = await res.json();
        if (!res.ok || body.__proxyError) {
          return updateRow(route, { kind: 'error', message: body.__proxyError || `HTTP ${res.status}` });
        }
        return updateRow(route, { kind: 'ok', data: body });
      } catch (e) {
        return updateRow(route, { kind: 'error', message: e.name === 'TimeoutError' ? 'Timed out after 20s' : e.message });
      }
    });

    await Promise.all(jobs);
    runBtn.disabled = false;
    runDot.style.display = 'none';
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const callerId = callerInput.value.trim();
    const zip = zipInput.value.trim();
    if (!callerId) {
      callerInput.focus();
      return;
    }
    runCheck(callerId, zip);
  });

  renderBoard();
})();
