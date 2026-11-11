import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { generateProjectDraft, projectAiStatus } from '../server/project-ai.mjs';

// Explicit live check: two gateway requests. Never used by npm test or doctor.
const configuration = projectAiStatus();
if (!configuration.configured) {
  console.error(JSON.stringify({ completed: false, code: configuration.issue, message: 'Astropods access is not configured. Follow docs/astropods-setup.md. No network requests were made.' }));
  process.exit(2);
}

const cases = [
  { name: 'all-sources', sourceIds: ['rescue-plan', 'supply-register', 'observation-notes'] },
  { name: 'observation-only', sourceIds: ['observation-notes'] },
];
const output = resolve('output/ai-smoke-latest.json');
const report = { mode: 'live_configured_astropods_gateway', generatedAt: new Date().toISOString(), completed: false, contentReview: 'required', results: [] };

function redact(value) {
  let text = JSON.stringify(value, null, 2);
  for (const key of ['ASTRO_GATEWAY_API_KEY', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_CLIENT_ID']) {
    const secret = process.env[key]?.trim();
    if (secret) text = text.split(secret).join('[REDACTED]');
  }
  return text;
}

try {
  for (const selected of cases) {
    const start = Date.now();
    const draft = await generateProjectDraft(selected.sourceIds);
    const citationsValid = draft.task.sourceIds.every(id => selected.sourceIds.includes(id));
    const budget = draft.budgetAudit;
    const budgetValid = selected.name === 'all-sources'
      ? budget.targetCents === 10000 && budget.itemizedCents === 6400 && budget.unallocatedCents === 3600
      : budget.targetCents === null && budget.itemizedCents === null && budget.unallocatedCents === null && budget.lineItems.length === 0;
    if (!citationsValid || !budgetValid) throw new Error('AI_CHECK_FAILED');
    report.results.push({ ...selected, durationMs: Date.now() - start, structuralChecksPassed: true, draft });
    console.log(redact({ case: selected.name, structuralChecksPassed: true, generation: draft.generation, contentReview: 'required' }));
  }
  report.completed = true;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, redact(report) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ completed: true, requestsCompleted: report.results.length, contentReview: 'required', output }));
} catch (error) {
  report.completed = false;
  report.failureCode = error.code || 'AI_CHECK_FAILED';
  try {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, redact(report) + '\n', { mode: 0o600 });
  } catch { /* The terminal still reports failure when local evidence cannot be saved. */ }
  console.error(JSON.stringify({ completed: false, requestsCompleted: report.results.length, code: error.code || 'AI_CHECK_FAILED', message: 'Live AI verification did not finish. Review the configuration or provider status; no generated content is claimed as verified.' }));
  process.exitCode = 1;
}
