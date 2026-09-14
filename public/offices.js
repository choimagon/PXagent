export function officeId(value) {
  const id = typeof value === 'object' && value !== null ? value.machineId : value;
  return !id || id === 'local' ? 'local' : id;
}

export function projectOffice(snapshot, id = 'local') {
  id = officeId(id);
  const office = snapshot.offices?.[id];
  const taskOffices = new Map(snapshot.tasks.map(task => [task.id, officeId(task)]));
  const belongs = item => officeId(item) === id;
  return {
    ...snapshot,
    agentPresets: office?.agentPresets || [],
    office: { id, name: office?.name || (id === 'local' ? snapshot.computer.name : id) },
    agents: office?.agents || snapshot.agents.map(agent => id === 'local' ? agent : { ...agent, status: 'idle', activeTaskId: null, progress: 0 }),
    tasks: snapshot.tasks.filter(belongs),
    goals: (snapshot.goals || []).filter(belongs),
    letters: (snapshot.letters || []).filter(letter => (taskOffices.get(letter.taskId) || officeId(letter)) === id),
    events:(snapshot.events||[]).filter(event=>(taskOffices.get(event.taskId)||event.officeId||'local')===id),
    logs: snapshot.logs.filter(log => (taskOffices.get(log.taskId) || log.officeId || 'local') === id),
    settings: { ...snapshot.settings, paused: office?.paused ?? (id === 'local' ? snapshot.settings.paused : false) },
  };
}
