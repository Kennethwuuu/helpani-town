import { existsSync } from 'node:fs';
import { projectAiStatus } from '../server/project-ai.mjs';
import { paypalConfigured } from '../server/paypal.mjs';

const [major, minor] = process.versions.node.split('.').map(Number);
const runtimeReady = major > 22 || (major === 22 && minor >= 13);
const dependenciesReady = existsSync(new URL('../node_modules/ag-grid-community/dist/ag-grid-community.min.js', import.meta.url));
const ai = projectAiStatus();
const report = {
  mode: 'local_configuration_only',
  networkRequestsMade: 0,
  node: { version: process.versions.node, supported: runtimeReady },
  dependencies: { agGridInstalled: dependenciesReady },
  paypal: { environment: 'sandbox', credentialsPresent: paypalConfigured(), authenticationVerified: false },
  astropods: { ...ai, liveGenerationVerified: false },
  nextSteps: [
    ...(!runtimeReady ? ['Install Node.js 22.13 or newer.'] : []),
    ...(!dependenciesReady ? ['Run npm ci.'] : []),
    ...(!paypalConfigured() ? ['Configure Sandbox credentials in private .env to enable payments.'] : []),
    ...(!ai.configured ? ['Follow docs/astropods-setup.md to obtain gateway access; local budget checks remain available.'] : ['Run npm run check:ai when ready for two live draft operations (up to four Gateway requests with bounded format retries).']),
  ],
};
console.log(JSON.stringify(report, null, 2));
if (!runtimeReady || !dependenciesReady) process.exitCode = 1;
