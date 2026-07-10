(() => {
  const SESSION_KEY = 'rtb_admin_unlocked';
  let config = loadConfig();

  const gate = document.getElementById('gate');
  const gateForm = document.getElementById('gate-form');
  const gatePassword = document.getElementById('gate-password');
  const gateErr = document.getElementById('gate-err');
  const adminContent = document.getElementById('admin-content');
  const toastEl = document.getElementById('toast');

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function unlock() {
    gate.style.display = 'none';
    adminContent.style.display = '';
    renderTable();
  }

  if (sessionStorage.getItem(SESSION_KEY) === '1') unlock();

  gateForm.addEventListener('submit', async e => {
    e.preventDefault();
    gateErr.style.display = 'none';
    const submitBtn = gateForm.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: gatePassword.value })
      });
      const body = await res.json();
      if (res.ok && body.ok) {
        sessionStorage.setItem(SESSION_KEY, '1');
        unlock();
      } else {
        gateErr.textContent = body.error || 'Incorrect password.';
        gateErr.style.display = 'block';
      }
    } catch (err) {
      gateErr.textContent = 'Could not reach the server. Try again.';
      gateErr.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  // ── Table render ─────────────────────────────────────────

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function sourceById(id) {
    return config.sources.find(s => s.id === id);
  }

  function renderTable() {
    const tbody = document.getElementById('route-tbody');
    tbody.innerHTML = '';
    if (config.routes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--muted-2); text-align:center; padding:30px;">No routes yet — add one above.</td></tr>`;
      return;
    }
    // group by source order, unknown sources last
    const ordered = [...config.sources.map(s => s.id), ...config.routes.filter(r => !sourceById(r.sourceId)).map(r => r.sourceId)];
    const sorted = [...config.routes].sort((a, b) => ordered.indexOf(a.sourceId) - ordered.indexOf(b.sourceId));

    for (const route of sorted) {
      const source = sourceById(route.sourceId) || { name: route.sourceId, color: '#5B636F' };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="source-badge"><span class="source-swatch" style="background:${source.color}"></span>${escapeHtml(source.name)}</span></td>
        <td><strong>${escapeHtml(route.name)}</strong></td>
        <td class="url-cell">${escapeHtml(route.url)}</td>
        <td>${route.fields.map(f => `<span class="field-tag">${f === 'caller_id' ? 'Caller ID' : 'Zip'}</span>`).join('')}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${route.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${route.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('[data-action=edit]').forEach(btn =>
      btn.addEventListener('click', () => openRouteModal(btn.dataset.id))
    );
    tbody.querySelectorAll('[data-action=delete]').forEach(btn =>
      btn.addEventListener('click', () => {
        const route = config.routes.find(r => r.id === btn.dataset.id);
        if (!route) return;
        if (!confirm(`Delete route "${route.name}"? This can't be undone here — export a backup first if unsure.`)) return;
        config.routes = config.routes.filter(r => r.id !== btn.dataset.id);
        saveConfig(config);
        renderTable();
        toast('Route deleted');
      })
    );
  }

  // ── Route modal ──────────────────────────────────────────

  const routeBackdrop = document.getElementById('route-modal-backdrop');
  const routeForm = document.getElementById('route-form');
  const routeModalTitle = document.getElementById('route-modal-title');
  const routeIdInput = document.getElementById('route-id');
  const routeSourceSelect = document.getElementById('route-source');
  const routeNameInput = document.getElementById('route-name');
  const routeUrlInput = document.getElementById('route-url');
  const routeFieldCaller = document.getElementById('route-field-caller');
  const routeFieldZip = document.getElementById('route-field-zip');

  function populateSourceSelect() {
    routeSourceSelect.innerHTML = config.sources
      .map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
      .join('');
  }

  function openRouteModal(routeId) {
    populateSourceSelect();
    if (routeId) {
      const route = config.routes.find(r => r.id === routeId);
      routeModalTitle.textContent = 'Edit route';
      routeIdInput.value = route.id;
      routeSourceSelect.value = route.sourceId;
      routeNameInput.value = route.name;
      routeUrlInput.value = route.url;
      routeFieldCaller.checked = route.fields.includes('caller_id');
      routeFieldZip.checked = route.fields.includes('zip');
    } else {
      routeModalTitle.textContent = 'Add route';
      routeIdInput.value = '';
      routeNameInput.value = '';
      routeUrlInput.value = '';
      routeFieldCaller.checked = true;
      routeFieldZip.checked = false;
    }
    routeBackdrop.classList.add('open');
    routeNameInput.focus();
  }

  function closeRouteModal() {
    routeBackdrop.classList.remove('open');
  }

  document.getElementById('add-route-btn').addEventListener('click', () => {
    if (config.sources.length === 0) {
      toast('Add a source first');
      return;
    }
    openRouteModal(null);
  });
  document.getElementById('route-cancel-btn').addEventListener('click', closeRouteModal);
  routeBackdrop.addEventListener('click', e => { if (e.target === routeBackdrop) closeRouteModal(); });

  routeForm.addEventListener('submit', e => {
    e.preventDefault();
    const fields = [];
    if (routeFieldCaller.checked) fields.push('caller_id');
    if (routeFieldZip.checked) fields.push('zip');

    const url = routeUrlInput.value.trim();
    if (!routeNameInput.value.trim() || !url) return;
    if (fields.includes('caller_id') && !url.includes('{{CALLER_ID}}')) {
      toast('URL must contain {{CALLER_ID}}');
      return;
    }
    if (fields.includes('zip') && !url.includes('{{ZIP}}')) {
      toast('URL must contain {{ZIP}}');
      return;
    }

    if (routeIdInput.value) {
      const route = config.routes.find(r => r.id === routeIdInput.value);
      route.sourceId = routeSourceSelect.value;
      route.name = routeNameInput.value.trim();
      route.url = url;
      route.fields = fields;
      toast('Route updated');
    } else {
      config.routes.push({
        id: uid('route'),
        sourceId: routeSourceSelect.value,
        name: routeNameInput.value.trim(),
        url,
        fields
      });
      toast('Route added');
    }
    saveConfig(config);
    renderTable();
    closeRouteModal();
  });

  // ── Source modal ─────────────────────────────────────────

  const sourceBackdrop = document.getElementById('source-modal-backdrop');
  const sourceForm = document.getElementById('source-form');

  document.getElementById('add-source-btn').addEventListener('click', () => {
    document.getElementById('source-name').value = '';
    document.getElementById('source-color').value = '#3FB8AF';
    sourceBackdrop.classList.add('open');
    document.getElementById('source-name').focus();
  });
  document.getElementById('source-cancel-btn').addEventListener('click', () => sourceBackdrop.classList.remove('open'));
  sourceBackdrop.addEventListener('click', e => { if (e.target === sourceBackdrop) sourceBackdrop.classList.remove('open'); });

  sourceForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('source-name').value.trim();
    if (!name) return;
    config.sources.push({
      id: uid('src'),
      name,
      color: document.getElementById('source-color').value
    });
    saveConfig(config);
    sourceBackdrop.classList.remove('open');
    toast(`Source "${name}" added`);
    renderTable();
  });

  // ── Backup export / import ───────────────────────────────

  document.getElementById('export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rtb-route-board-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const importFile = document.getElementById('import-file');
  document.getElementById('import-btn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.sources || !parsed.routes) throw new Error('Missing sources/routes');
        if (!confirm('Replace the current route board with this backup?')) return;
        config = parsed;
        saveConfig(config);
        renderTable();
        toast('Backup imported');
      } catch (err) {
        toast('Invalid backup file');
      }
      importFile.value = '';
    };
    reader.readAsText(file);
  });
})();
