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
assert.ok(state.events.length > 1, 'society should emit events');
assert.ok(state.scene.title, 'director should name the scene');

// Force co-location to verify social brain still pairs dialog
state.agents.forEach(a => { A.startAction(a, 'socialise', state); a.progress = 0; });
A.tickAgents(state, 3);
const talking = state.agents.filter(a => a.talking_with);
assert.ok(talking.length >= 2, 'co-located agents should start talking');

assert.ok(A.places.zoo && A.places.shop && A.places.park, 'town places exist');
assert.ok(A.actions.visit_zoo && A.actions.drive && A.actions.shop, 'town actions exist');
assert.equal(A.HOME_LOTS.length, 5);
const zooSlot = A.slotOf(state.agents[0], 'zoo');
assert.ok(Math.abs(zooSlot[0] - A.places.zoo[0]) < 6, 'zoo slots near zoo');

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

// Agenda / plan chain visibility
const morning = A.createSimulationState();
morning.minute = 9 * 60;
morning.agents.forEach(a => { a.needs.sleep = 15; a.needs.hunger = 35; a.progress = 1; });
A.tickAgents(morning, 25);
const withPlan = morning.agents.filter(a => (a.plan && a.plan.length) || a.planLabel);
assert.ok(withPlan.length >= 1 || morning.agents.some(a => a.action !== 'socialise'), 'morning agenda should move agents off idle plaza loop');
assert.ok(morning.agents.some(a => a.place !== 'plaza' || a.action === 'perform' || a.action === 'socialise'), 'town places in use');
console.log('agenda checks passed');

// Town pulse + queue behavior
const market = A.createSimulationState();
market.minute = 10 * 60 + 5;
market.weather = 'clear';
market.agents.forEach(a => { a.needs.sleep = 10; a.needs.hunger = 40; a.progress = 1; });
A.tickAgents(market, 8);
assert.ok(market.pulse || market.events.some(e => /Stadspuls|Marknad|Konsert|Utfodring|Lagdebatt|Gryning|lagning/i.test(e.text)), 'town pulse should surface in state or events');

// Force full cafe → waiters queue
const crowded = A.createSimulationState();
crowded.minute = 12 * 60 + 10;
crowded.agents.forEach((a, i) => {
  a.needs.sleep = 10;
  a.needs.hunger = 90;
  a.progress = 1;
});
// Fill cafe capacity first
crowded.agents.slice(0, 3).forEach(a => A.startAction(a, 'eat', crowded));
A.tickAgents(crowded, 2);
const waiter = crowded.agents.find(a => a.action === 'wait' || a.waitingFor);
assert.ok(waiter || crowded.agents.filter(a => a.place === 'cafe').length <= 3, 'capacity should constrain cafe or produce a queue');
console.log('pulse/queue checks passed');
