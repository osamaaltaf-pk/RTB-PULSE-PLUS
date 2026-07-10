// defaults.js for Chrome Extension Side Panel (uses chrome.storage.local asynchronously)

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
  payoutVisible: false,
  payoutRangeSize: 40
};

const STORAGE_KEY = 'rtb_board_config_v1';

async function loadConfig() {
  try {
    const res = await chrome.storage.local.get([STORAGE_KEY]);
    let data = res[STORAGE_KEY];
    if (!data) {
      data = structuredClone(DEFAULT_CONFIG);
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    }
    // Deep backfill and ensure keys are set
    if (data.payoutVisible === undefined) data.payoutVisible = false;
    if (data.payoutRangeSize === undefined) data.payoutRangeSize = 40;
    
    // Ensure all sources have paused status
    if (data.sources) {
      data.sources.forEach(s => {
        if (s.paused === undefined) s.paused = false;
      });
    }
    // Ensure all routes have paused status
    if (data.routes) {
      data.routes.forEach(r => {
        if (r.paused === undefined) r.paused = false;
      });
    }
    return data;
  } catch (e) {
    console.error("Failed to load config from chrome storage:", e);
    return structuredClone(DEFAULT_CONFIG);
  }
}

async function saveConfig(configObj) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: configObj });
  } catch (e) {
    console.error("Failed to save config to chrome storage:", e);
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Automatic Theme management ─────────────────────────────
async function initTheme() {
  let theme = 'light';
  try {
    const res = await chrome.storage.local.get(['theme']);
    theme = res.theme || 'light';
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
    btn.addEventListener('click', async () => {
      const isDark = document.body.classList.toggle('dark-theme');
      const newTheme = isDark ? 'dark' : 'light';
      btn.textContent = isDark ? '🌙' : '☀️';
      try {
        await chrome.storage.local.set({ theme: newTheme });
      } catch (e) {}
    });
  }
}
initTheme();
