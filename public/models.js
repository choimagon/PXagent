// OpenAI official model catalog, verified 2026-09-13.
// https://developers.openai.com/api/docs/models
export const REASONING_LEVELS = {
  none: '없음 · None', low: '낮음 · Low', medium: '보통 · Medium',
  high: '높음 · High', xhigh: '매우 높음 · XHigh', max: '최대 · Max',
};
const standardEfforts = ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
export const MODEL_CATALOG = {
  luna: { label: 'Luna', id: 'gpt-5.6-luna', efforts: standardEfforts },
  terra: { label: 'Terra', id: 'gpt-5.6-terra', efforts: standardEfforts },
  sol: { label: 'Sol', id: 'gpt-5.6-sol', efforts: standardEfforts },
  astra: { label: 'Astra', id: 'gpt-6-astra', efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
};
export function defaultModels() {
  return Object.fromEntries(Object.entries(MODEL_CATALOG).map(([key, model]) => [key, model.id]));
}
export function migrateOfficeState(office) {
  const legacyProfiles = { high: 'sol', balanced: 'terra', fast: 'luna' };
  const savedModels = office.settings.models || {};
  const models = defaultModels();
  for (const [legacy, current] of Object.entries(legacyProfiles)) {
    if (savedModels[legacy]?.trim()) models[current] = savedModels[legacy].trim();
  }
  for (const key of Object.keys(MODEL_CATALOG)) {
    if (savedModels[key]?.trim()) models[key] = savedModels[key].trim();
  }
  office.settings.models = models;
  for (const agent of office.agents) {
    if (typeof agent.fixedPrompt !== 'string') agent.fixedPrompt = '';
    agent.profile = legacyProfiles[agent.profile] || agent.profile;
    if (!MODEL_CATALOG[agent.profile]) agent.profile = agent.id === 'chief' ? 'astra' : 'terra';
    if (!MODEL_CATALOG[agent.profile].efforts.includes(agent.reasoningEffort)) agent.reasoningEffort = 'medium';
  }
  office.schemaVersion = 3;
  return office;
}
