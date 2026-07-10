// Defaults and Configuration Manager (Chrome Extension Version using chrome.storage.local)

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
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      let data = res[STORAGE_KEY];
      if (!data) {
        data = DEFAULT_CONFIG;
        chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_CONFIG });
      }
      // Backfill new keys
      if (data.payoutVisible === undefined) data.payoutVisible = false;
      if (data.payoutRangeSize === undefined) data.payoutRangeSize = 40;
      resolve(data);
    });
  });
}

async function saveConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: config }, resolve);
  });
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
