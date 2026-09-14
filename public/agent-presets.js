export const FIXED_AGENT_IDS = ['junior', 'misc', 'secretary'];
const entry = (profile, reasoningEffort) => ({profile, reasoningEffort});
export const AGENT_PRESETS = {
  upper: {name:'상급',agents:{chief:entry('astra','high'),dev:entry('sol','high'),writer:entry('sol','high'),format:entry('terra','high')}},
  middle: {name:'중급',agents:{chief:entry('sol','xhigh'),dev:entry('terra','xhigh'),writer:entry('terra','xhigh'),format:entry('terra','medium')}},
  lower: {name:'하급',agents:{chief:entry('terra','high'),dev:entry('terra','medium'),writer:entry('luna','xhigh'),format:entry('luna','xhigh')}},
};
export function agentPresetValues(agents) {
  return Object.fromEntries(agents.map(agent=>[agent.id,FIXED_AGENT_IDS.includes(agent.id)?entry('luna','medium'):entry(agent.profile,agent.reasoningEffort)]));
}
for(const [id,preset] of Object.entries(AGENT_PRESETS))Object.assign(preset.agents,{analyzer:entry(id==='lower'?'luna':'terra',id==='lower'?'xhigh':'high'),autoresearch:entry(id==='upper'?'sol':id==='middle'?'terra':'luna',id==='lower'?'xhigh':'high')});
