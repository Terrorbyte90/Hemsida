import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTIES, TOPICS, scoreAnswers} from './valkompass-model.mjs';

test('100 syntetiska väljarscenarier ger giltiga, fullständiga resultat', () => {
  for (let i = 0; i < 100; i++) {
    const answers = Object.fromEntries(TOPICS.map((t, j) => [t, ((i + j) % 5) - 2]));
    const priorities = Object.fromEntries(TOPICS.map((t, j) => [t, 1 + ((i + j) % 5)]));
    const result = scoreAnswers(answers, priorities);
    assert.deepEqual(Object.keys(result), PARTIES);
    assert.ok(Object.values(result).every(v => Number.isInteger(v) && v >= 0 && v <= 100));
  }
});
