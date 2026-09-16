const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'simulering-agents.js'), 'utf8');
const context = { window: {}, console };
vm.runInNewContext(source, context);
const A = context.window.CityAgents;
assert.ok(A, 'CityAgents must load');

const state = A.createSimulationState();
assert.equal(state.agents.length, 5);
assert.equal(state.agents[0].place, 'plaza');

const noon = { ...state, minute: 10 * 60 };
state.agents.forEach(agent => {
  const action = A.choose(agent, noon);
  assert.notEqual(action, 'sleep', `${agent.name} should not sleep at 10:00`);
});

const night = { ...state, minute: 2 * 60 };
assert.equal(A.choose(state.agents[0], night), 'sleep');

A.tickAgents(state, 40);
const talking = state.agents.filter(a => a.talking_with);
assert.ok(talking.length >= 2, 'co-located agents should start talking');
assert.ok(state.events.length > 1, 'society should emit events');
assert.ok(state.scene.title, 'director should name the scene');

const mira = state.agents[0];
const slot = A.slotOf(mira, 'home');
assert.equal(slot[0], A.HOME_X[0]);
assert.notDeepEqual(A.slotOf(state.agents[1], 'plaza'), A.slotOf(mira, 'plaza'));

const remote = {
  mode: 'live', minute: 800, day: 20, weather: 'rain',
  agents: state.agents.map(a => ({ ...a, thought: 'remote-tanke', action: a.action, place: a.place })),
  events: [{ time: '13:20', text: 'remote' }],
  scene: { title: 'Regn', copy: 'Takdropp.', phase: 'dag' }
};
A.applyRemote(state, remote);
assert.equal(state.mode, 'live');
assert.equal(state.agents[0].color, '#76d6c6');
assert.equal(state.scene.title, 'Regn');

console.log('simulering-agents: assertions passed');
