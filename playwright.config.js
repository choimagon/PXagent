import {tmpdir} from 'node:os';
import path from 'node:path';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui',
  timeout: 30_000,
  workers: 1,
  use: { baseURL:'http://127.0.0.1:3211', browserName:'chromium', launchOptions:{executablePath:process.env.CHROME_PATH || (process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined)}, viewport:{width:1440,height:1050}, screenshot:'only-on-failure', trace:'retain-on-failure' },
  webServer:{command:'node server.mjs',url:'http://127.0.0.1:3211',env:{OFFICE_EXECUTOR:'demo',PORT:'3211',HOST:'127.0.0.1',DATA_DIR:path.join(tmpdir(),'px-office-ui-tests-'+process.pid),DEMO_STEP_MS:'350',OFFICE_PASSWORD:'',LLM_BASE_URL:''},reuseExistingServer:false},
});
