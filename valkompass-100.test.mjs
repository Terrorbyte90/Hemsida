import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTIES, TOPICS, PARTY_POSITIONS, scoreAnswers} from './valkompass-model.mjs';

test('100 syntetiska väljarscenarier ger giltiga, fullständiga resultat', () => {
  for (let i = 0; i < 100; i++) {
    const answers = Object.fromEntries(TOPICS.map((t, j) => [t, ((i + j) % 5) - 2]));
    const priorities = Object.fromEntries(TOPICS.map((t, j) => [t, 1 + ((i + j) % 5)]));
    const result = scoreAnswers(answers, priorities);
    assert.deepEqual(Object.keys(result), PARTIES);
    assert.ok(Object.values(result).every(v => Number.isInteger(v) && v >= 0 && v <= 100));
  }
});

test('100 kalibreringskörningar ger förväntad toppmatchning', () => {
  let approved = 0;
  for (let run = 0; run < 100; run++) {
    for (const party of PARTIES) {
      const answers = Object.fromEntries(TOPICS.map(topic => [topic, PARTY_POSITIONS[topic][party]]));
      const result = scoreAnswers(answers, Object.fromEntries(TOPICS.map(topic => [topic, 1 + ((run + topic.length) % 5)])));
      assert.equal(Math.max(...Object.values(result)), result[party]);
    }
    approved++;
  }
  assert.equal(approved, 100);
});
