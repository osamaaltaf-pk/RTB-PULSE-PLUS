// Default route board — seeded into localStorage the first time the app runs.
// Every route belongs to a SOURCE (the buyer/publisher account these routes
// come from, e.g. "Cost Guide" or "Evercontractor"). This is what future
// admin-added routes must also carry, so the board can group/filter by it.
//
// Placeholders inside a url: {{CALLER_ID}} and {{ZIP}}
// `fields` lists which of those a route actually needs, in order.

const DEFAULT_CONFIG = {
  sources: [
    { id: 'cost-guide', name: 'Cost Guide', color: '#3FB8AF' },
    { id: 'evercontractor', name: 'Evercontractor', color: '#F2A93B' }
  ],
  routes: [
    {
      id: 'cg-siding',
      sourceId: 'cost-guide',
      name: 'Siding',
      url: 'https://rtb.moja.cloud/inbound_rtb/rtb_6b2efee00a1b47c5891c1f1b5294699a?CALLER_ID={{CALLER_ID}}&ZIP_CODE={{ZIP}}',
      fields: ['caller_id', 'zip']
    },
    {
      id: 'cg-bath',
      sourceId: 'cost-guide',
      name: 'Bath',
      url: 'https://rtb.moja.cloud/inbound_rtb/inbound_rtb_1774894662511_ea2800ce?CALLER_ID={{CALLER_ID}}&ZIP_CODE={{ZIP}}',
      fields: ['caller_id', 'zip']
    },
    {
      id: 'cg-roofing',
      sourceId: 'cost-guide',
      name: 'Roofing',
      url: 'https://rtb.moja.cloud/inbound_rtb/rtb_f492cc4906594d908ebf53a24c0db9ad?CALLER_ID={{CALLER_ID}}&ZIP_CODE={{ZIP}}',
      fields: ['caller_id', 'zip']
    },
    {
      id: 'cg-windows',
      sourceId: 'cost-guide',
      name: 'Windows',
      url: 'https://rtb.moja.cloud/inbound_rtb/rtb_b7820dee89bb402fbea459d2db4c41b1?CALLER_ID={{CALLER_ID}}&ZIP_CODE={{ZIP}}',
      fields: ['caller_id', 'zip']
    },
    {
      id: 'ec-bathrooms',
      sourceId: 'evercontractor',
      name: 'Bathrooms',
      url: 'https://rtb.moja.cloud/inbound_rtb/inbound_rtb_1780612426732_3aaf8557?CALLER_ID={{CALLER_ID}}',
      fields: ['caller_id']
    },
    {
      id: 'ec-roofing',
      sourceId: 'evercontractor',
      name: 'Roofing',
      url: 'https://rtb.moja.cloud/inbound_rtb/inbound_rtb_1780612109405_7672f4b1?CALLER_ID={{CALLER_ID}}',
      fields: ['caller_id']
    },
    {
      id: 'ec-windows',
      sourceId: 'evercontractor',
      name: 'Windows',
      url: 'https://rtb.moja.cloud/inbound_rtb/inbound_rtb_1780612283933_0705cdd8?CALLER_ID={{CALLER_ID}}',
      fields: ['caller_id']
    }
  ],
  // Payout display controls (admin-only)
  payoutVisible: false,   // false = show tier (1x/2x/3x), true = show actual $
  payoutRangeSize: 40     // each tier covers this many dollars: 1-40=1x, 41-80=2x …
};

const STORAGE_KEY = 'rtb_board_config_v1';

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
      return structuredClone(DEFAULT_CONFIG);
    }
    const parsed = JSON.parse(raw);
    if (!parsed.sources || !parsed.routes) throw new Error('malformed config');
    // Backfill new keys so existing saved configs still work
    if (parsed.payoutVisible  === undefined) parsed.payoutVisible  = false;
    if (parsed.payoutRangeSize === undefined) parsed.payoutRangeSize = 40;
    
    // Ensure all sources have paused status
    if (parsed.sources) {
      parsed.sources.forEach(s => {
        if (s.paused === undefined) s.paused = false;
      });
    }
    // Ensure all routes have paused status
    if (parsed.routes) {
      parsed.routes.forEach(r => {
        if (r.paused === undefined) r.paused = false;
      });
    }
    return parsed;
  } catch (e) {
    console.error('Config load failed, resetting to defaults.', e);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
    return structuredClone(DEFAULT_CONFIG);
  }
}

function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Automatic Theme management ─────────────────────────────
function initTheme() {
  let theme = 'light';
  try {
    theme = localStorage.getItem('theme') || 'light';
  } catch (e) {
    theme = 'light';
  }
  
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
  
  // Wait for DOM to wire button
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireThemeBtn);
  } else {
    wireThemeBtn();
  }

  function wireThemeBtn() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    btn.textContent = theme === 'dark' ? '🌙' : '☀️';
    btn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      const newTheme = isDark ? 'dark' : 'light';
      btn.textContent = isDark ? '🌙' : '☀️';
      try {
        localStorage.setItem('theme', newTheme);
      } catch (e) {}
    });
  }
}
initTheme();
