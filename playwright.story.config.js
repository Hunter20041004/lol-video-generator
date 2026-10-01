const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests/e2e', timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:49765', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --hostname 127.0.0.1 --port 49765', url: 'http://127.0.0.1:49765', reuseExistingServer: process.env.MATCH_STORY_TEST_REUSE_SERVER === '1', timeout: 30000 } });
