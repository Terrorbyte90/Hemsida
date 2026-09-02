import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAnswers, buildProfile, PARTY_POSITIONS, PARTY_SOURCES, PARTIES, TOPICS } from './valkompass-model.mjs';

test('prioriteringar påverkar resultatet proportionellt', () => {
  const answers = { ekonomi: 2, klimat: -2 };
  const priorities = { ekonomi: 5, klimat: 1 };
  const scores = scoreAnswers(answers, priorities);
  assert.ok(scores.M > scores.MP);
});

test('acceptansfrågor kan sänka ett parti utan att döljas', () => {
  const result = scoreAnswers({ ekonomi: 2, accept_M: -2 }, { ekonomi: 3, accept_M: 4 });
  const withoutAcceptance = scoreAnswers({ ekonomi: 2 }, { ekonomi: 3, accept_M: 4 });
  assert.ok(result.M < withoutAcceptance.M);
});

test('profilen redovisar starkaste områden och kompromissgränser', () => {
  const profile = buildProfile({ ekonomi: 2, klimat: -2 }, { ekonomi: 5, klimat: 1 }, {});
  assert.equal(profile.priorities[0].key, 'ekonomi');
  assert.equal(profile.stance.ekonomi, 'för');
});

test('en idealiserad partiprofil matchar partiet självt', () => {
  for (const party of ['S','M','SD','V','C','MP','KD','L']) {
    const answers = Object.fromEntries(TOPICS.map(topic => [topic, PARTY_POSITIONS[topic][party]]));
    const result = scoreAnswers(answers, Object.fromEntries(TOPICS.map(topic => [topic, 3])));
    assert.equal(Math.max(...Object.values(result)), result[party]);
  }
});

test('varje riksdagsparti har spårbar primärkälla och position i varje ämne', () => {
  for (const party of PARTIES) {
    assert.match(PARTY_SOURCES[party], /^https:\/\//);
    for (const topic of TOPICS) assert.equal(typeof PARTY_POSITIONS[topic][party], 'number');
  }
});
