const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'simulering-memory.js'), 'utf8');
const context = { window: {}, console };
vm.runInNewContext(source, context);
const Memory = context.window.CityMemory;

assert.ok(Memory, 'CityMemory must be available to the browser');

const agent = { memory: [], relationships: { noor: 0 }, place: 'plaza', action: 'socialise', stuck: 0 };
Memory.remember(agent, { kind: 'conversation', with: 'Noor', text: 'Noor vill öppna biblioteket senare.', importance: 0.9 });
assert.equal(agent.memory.length, 1);
assert.equal(Memory.recall(agent, 'Noor').length, 1);
assert.match(Memory.context(agent, 'Noor'), /biblioteket/);

const moved = Memory.recoverIfStuck({ ...agent, stuck: 4, progress: 0 }, { hour: 23 });
assert.equal(moved.action, 'sleep');
assert.equal(moved.reason, 'stuck-recovery');

console.log('simulering-memory: 3 assertions passed');
