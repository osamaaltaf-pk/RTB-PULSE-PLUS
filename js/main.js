(() => {
  const config = loadConfig();
  const form        = document.getElementById('query-form');
  const callerInput = document.getElementById('caller-id');
  const zipInput    = document.getElementById('zip');
  const zipField    = document.getElementById('zip-field');
  const resultsEl   = document.getElementById('results');
  const runBtn      = document.getElementById('run-btn');
  const runDot      = document.getElementById('run-dot');
  const summaryBar  = document.getElementById('summary-bar');

  const anyRouteNeedsZip = config.routes.some(r => r.fields.includes('zip'));
  if (anyRouteNeedsZip) zipField.style.display = '';

  // ── Phone number cleaning (mirrors RTB Pulse panel.js) ───
  // Strip all non-digits, remove leading 1 from 11-digit numbers, cap at 10 digits.

  function cleanPhone(val) {
    let digits = String(val).replace(/[^\d]/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }
    if (digits.length > 10) {
      digits = digits.substring(0, 10);
    }
    return digits;
  }

  // Live-clean the caller-id input as the user types
  callerInput.addEventListener('input', () => {
    const cleaned = cleanPhone(callerInput.value);
    if (callerInput.value !== cleaned) callerInput.value = cleaned;
  });

  // ── Utilities ────────────────────────────────────────────

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  // ── Paste handler (📋 buttons on inputs) ─────────────────
  // Mirrors RTB Pulse: phone fields get cleanPhone(), zip gets plain trim().

  async function handlePaste(targetId, type) {
    try {
      const text = await navigator.clipboard.readText();
      const input = document.getElementById(targetId);
      if (!input) return;
      if (type === 'phone') {
        input.value = cleanPhone(text);
        showToast('📋 Pasted & cleaned');
      } else {
        input.value = text.trim();
        showToast('📋 Pasted');
      }
      input.dispatchEvent(new Event('input'));
    } catch {
      showToast('❌ Clipboard permission denied');
    }
  }

  // Wire all paste buttons declared in HTML
  document.querySelectorAll('.paste-btn').forEach(btn => {
    btn.addEventListener('click', () =>
      handlePaste(btn.dataset.target, btn.dataset.type)
    );
  });

  // ── Route number extraction ───────────────────────────────
  // Strip +1 or leading 1 (11-digit) from the RTB response number field.

  function extractPhoneNumber(raw) {
    const s = String(raw || '');
    if (s.startsWith('+1')) return s.slice(2);
    if (s.startsWith('1') && s.length === 11) return s.slice(1);
    return s;
  }

  function fillTemplate(url, callerId, zip) {
    return url
      .replaceAll('{{CALLER_ID}}', encodeURIComponent(callerId))
      .replaceAll('{{ZIP}}', encodeURIComponent(zip || ''));
  }

  function sourceById(id) {
    return config.sources.find(s => s.id === id) || { id, name: id, color: '#5B636F' };
  }

  // ── Skeleton card (shown while fetching) ─────────────────

  function routeCardSkeleton(route) {
    const card = document.createElement('div');
    card.className = 'result-card loading';
    card.id = `row-${route.id}`;
    card.innerHTML = `
      <div class="card-header">
        <div class="card-dot spin"></div>
        <span class="card-label">${escapeHtml(route.name)}</span>
        <span class="card-meta">Fetching…</span>
      </div>
      <div class="card-body">
        <div class="skeleton-line" style="width:82%"></div>
        <div class="skeleton-line" style="width:55%"></div>
      </div>
    `;
    return card;
  }

  // ── Wire copy buttons inside a card ──────────────────────

  function wireCopyButtons(card) {
    card.querySelectorAll('.copy-num-btn').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        copyText(btn.dataset.copy);
        showToast('📋 Number copied');
      })
    );
    card.querySelectorAll('.copy-bid-btn').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        copyText(btn.dataset.copy);
        showToast('📋 Payout copied');
      })
    );
    card.querySelectorAll('.copy-both-btn').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        copyText(btn.dataset.copy);
        showToast('📋 Copied number & bid');
      })
    );
    card.querySelectorAll('.card-url-btn').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        copyText(btn.dataset.url);
        showToast('🔗 URL copied');
      })
    );
  }

  // ── Update a card with the final result ──────────────────

  function updateRow(route, outcome) {
    const card = document.getElementById(`row-${route.id}`);
    if (!card) return;

    // ── Skipped ──
    if (outcome.kind === 'skipped') {
      card.className = 'result-card no-routes';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-dot gray"></div>
          <span class="card-label">${escapeHtml(route.name)}</span>
          <span class="card-meta">Skipped</span>
        </div>
        <div class="card-body">
          <div class="no-routes-msg">${escapeHtml(outcome.reason)}</div>
        </div>
      `;
      return;
    }

    // ── Error ──
    if (outcome.kind === 'error') {
      card.className = 'result-card errored';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-dot red"></div>
          <span class="card-label">${escapeHtml(route.name)}</span>
          <span class="card-meta">Error</span>
        </div>
        <div class="card-body">
          <div class="no-routes-msg" style="color:var(--red)">⚠️ ${escapeHtml(outcome.message)}</div>
        </div>
      `;
      return;
    }

    // ── Success ──
    const json = outcome.data;
    const eligibleRoutes = Array.isArray(json?.eligible_routes) ? json.eligible_routes : [];
    const hasRoutes = eligibleRoutes.length > 0;
    const allocTime  = json?.allocation_time_seconds ?? 60;
    const reqId      = json?.request_id ? json.request_id.substring(0, 8) + '…' : '';
    const ts         = json?.timestamp ? new Date(json.timestamp).toLocaleTimeString() : '';
    const totalRts   = json?.total_routes;

    card.className = `result-card ${hasRoutes ? 'has-routes' : 'no-routes'}`;

    // "Copy Both" value: one line per eligible route — "NUMBER - $PAYOUT"
    const copyBothVal = eligibleRoutes
      .map(rt => `${extractPhoneNumber(rt.number || '')} - $${(rt.payout || 0).toFixed(2)}`)
      .join('\n');

    // Meta pills for footer
    const pills = [];
    if (totalRts !== undefined) pills.push(`${totalRts} route${totalRts !== 1 ? 's' : ''}`);
    if (allocTime)              pills.push(`${allocTime}s window`);
    if (reqId)                  pills.push(`ID: ${reqId}`);
    if (ts)                     pills.push(ts);

    // Route rows HTML
    const routesHtml = hasRoutes
      ? eligibleRoutes.map(rt => {
          const num    = escapeHtml(extractPhoneNumber(rt.number || ''));
          const payout = `$${(rt.payout || 0).toFixed(2)}`;
          return `
            <div class="route-result-row">
              <!-- ROUTE NUMBER -->
              <div style="display:flex; flex-direction:column; gap:3px; width:100%;">
                <span class="route-box-label">Route Number</span>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                  <span class="route-number-display">${num}</span>
                  <button class="copy-num-btn" data-copy="${num}" title="Copy number">📋 Copy</button>
                </div>
              </div>
              <!-- divider -->
              <div style="height:1px; background:var(--border-soft); width:100%;"></div>
              <!-- ALLOCATION + BID PAYOUT -->
              <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; width:100%;">
                <div style="display:flex; flex-direction:column; gap:3px;">
                  <span class="route-box-label">Allocation</span>
                  <span class="route-alloc-badge">⏳ ${allocTime}s</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:3px; align-items:flex-end;">
                  <span class="route-box-label">Bid Payout</span>
                  <div style="display:flex; align-items:center; gap:5px;">
                    <span class="route-payout-badge">${escapeHtml(payout)}</span>
                    <button class="copy-bid-btn" data-copy="${escapeHtml(payout)}" title="Copy bid">📋 Copy</button>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="no-routes-msg">No eligible routes</div>`;

    card.innerHTML = `
      <div class="card-header">
        <div class="card-dot ${hasRoutes ? 'green' : 'gray'}"></div>
        <span class="card-label">${escapeHtml(route.name)}</span>
        <span class="card-meta">${hasRoutes
          ? eligibleRoutes.length + ' route' + (eligibleRoutes.length > 1 ? 's' : '')
          : 'No match'
        }</span>
        ${hasRoutes
          ? `<button class="copy-both-btn" data-copy="${escapeHtml(copyBothVal)}" title="Copy number &amp; bid">📋 Copy Both</button>`
          : ''}
        <button class="card-url-btn" data-url="${escapeHtml(route.url)}" title="Copy URL">🔗</button>
      </div>
      <div class="card-body">${routesHtml}</div>
      ${pills.length
        ? `<div class="card-footer">${pills.map(p => `<span class="meta-pill">${escapeHtml(p)}</span>`).join('')}</div>`
        : ''}
    `;

    wireCopyButtons(card);
  }

  // ── Board render (groups by source) ──────────────────────

  function renderBoard() {
    resultsEl.innerHTML = '';
    summaryBar.style.display = 'none';

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
          <span class="source-badge">
            <span class="source-swatch" style="background:${source.color}"></span>
            ${escapeHtml(source.name)}
          </span>
          <span class="source-count">${routes.length}</span>
          <div class="source-line"></div>
        </div>
        <div class="route-list" data-role="list"></div>
      `;
      const list = group.querySelector('[data-role=list]');
      routes.forEach(r => list.appendChild(routeCardSkeleton(r)));
      resultsEl.appendChild(group);
    }

    // Routes whose source was deleted / unknown
    const orphan = config.routes.filter(r => !config.sources.some(s => s.id === r.sourceId));
    if (orphan.length) {
      const group = document.createElement('div');
      group.className = 'source-group';
      group.innerHTML = `
        <div class="source-head">
          <span class="source-badge"><span class="source-swatch" style="background:#5B636F"></span>Unassigned</span>
          <span class="source-count">${orphan.length}</span>
          <div class="source-line"></div>
        </div>
        <div class="route-list" data-role="list"></div>
      `;
      const list = group.querySelector('[data-role=list]');
      orphan.forEach(r => list.appendChild(routeCardSkeleton(r)));
      resultsEl.appendChild(group);
    }
  }

  // ── Summary bar ───────────────────────────────────────────

  function updateSummaryBar(results, elapsedMs) {
    const fired      = config.routes.length;
    const totalHits  = results.reduce((s, r) => s + (r.eligible_routes?.length || 0), 0);
    const maxPayout  = results.reduce((max, r) => {
      const top = (r.eligible_routes || []).reduce((m, rt) => Math.max(m, rt.payout || 0), 0);
      return Math.max(max, top);
    }, 0);
    const elapsed = (elapsedMs / 1000).toFixed(1);

    document.getElementById('sum-fired').textContent   = fired;
    document.getElementById('sum-routes').textContent  = totalHits;
    document.getElementById('sum-payout').textContent  = maxPayout > 0 ? `$${maxPayout.toFixed(2)}` : '$0';
    document.getElementById('sum-time').textContent    = elapsed + 's';
    summaryBar.style.display = 'grid';
  }

  // ── Run all route checks in parallel ─────────────────────

  async function runCheck(callerId, zip) {
    renderBoard();
    runBtn.disabled = true;
    runDot.style.display = '';
    const t0 = Date.now();
    const okData = [];  // collect successful response bodies for summary

    const jobs = config.routes.map(async route => {
      if (route.fields.includes('caller_id') && !callerId) {
        return updateRow(route, { kind: 'skipped', reason: 'Caller ID required for this route' });
      }
      if (route.fields.includes('zip') && !zip) {
        return updateRow(route, { kind: 'skipped', reason: 'Zip code required for this route' });
      }
      const targetUrl = fillTemplate(route.url, callerId, zip);
      try {
        const res  = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`, { signal: AbortSignal.timeout(20000) });
        const body = await res.json();
        if (!res.ok || body.__proxyError) {
          return updateRow(route, { kind: 'error', message: body.__proxyError || `HTTP ${res.status}` });
        }
        okData.push(body);
        return updateRow(route, { kind: 'ok', data: body });
      } catch (e) {
        return updateRow(route, {
          kind: 'error',
          message: e.name === 'TimeoutError' ? 'Timed out after 20s' : e.message
        });
      }
    });

    await Promise.all(jobs);
    updateSummaryBar(okData, Date.now() - t0);
    runBtn.disabled = false;
    runDot.style.display = 'none';
  }

  // ── Form submit ───────────────────────────────────────────

  form.addEventListener('submit', e => {
    e.preventDefault();
    const callerId = callerInput.value.trim();
    const zip      = zipInput.value.trim();
    if (!callerId) { callerInput.focus(); return; }
    runCheck(callerId, zip);
  });

  renderBoard();
})();
