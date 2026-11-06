import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { failureCandidates, reduceFailure } from '../projection.mjs';

const failure = Object.freeze({
  seq: 42,
  time: 1000,
  message: 'Model connection interrupted',
  code: 'ECONNRESET',
});

function endEvent(reason, { seq = 42, time = 1000 } = {}) {
  return { type: 'turn/end', seq, time, data: { reason } };
}

function projection(value) {
  return { values: { modelInterruption: value } };
}

describe('reduceFailure', () => {
  it('records the failure sequence, time, message and code', () => {
    const event = endEvent({
      kind: 'error',
      error: { message: failure.message, code: failure.code },
    });

    assert.deepEqual(reduceFailure(null, event), failure);
  });

  it('replaces an earlier failure with the latest failed turn', () => {
    const event = endEvent({
      kind: 'error',
      error: { message: 'Rate limit reached', code: 'RATE_LIMIT' },
    }, { seq: 51, time: 2000 });

    assert.deepEqual(reduceFailure(failure, event), {
      seq: 51,
      time: 2000,
      message: 'Rate limit reached',
      code: 'RATE_LIMIT',
    });
  });

  for (const kind of ['completed', 'aborted']) {
    it(`does not notify for a ${kind} turn and clears an earlier failure`, () => {
      const event = endEvent({ kind });

      assert.equal(reduceFailure(null, event), null);
      assert.equal(reduceFailure(failure, event), null);
    });
  }

  for (const type of ['turn/start', 'user/message']) {
    it(`clears the failure on ${type}`, () => {
      assert.equal(reduceFailure(failure, { type, seq: 43, time: 1100 }), null);
      assert.equal(reduceFailure(null, { type, seq: 43, time: 1100 }), null);
    });
  }

  it('preserves the original state reference for unrelated events', () => {
    const event = { type: 'assistant/message', seq: 43, time: 1100 };

    assert.equal(reduceFailure(failure, event), failure);
    assert.equal(reduceFailure(null, event), null);
  });
});

describe('failureCandidates', () => {
  it('returns a failed root session with its original session id', () => {
    const rows = { original: { id: 'original', origin: 'user' } };
    const projections = { original: projection(failure) };

    assert.deepEqual(failureCandidates(rows, projections, new Map(), new Map()), [
      { sessionId: 'original', ...failure },
    ]);
  });

  it('keeps failures attached to their session when another session is present', () => {
    const rows = {
      selected: { id: 'selected', origin: 'user' },
      original: { id: 'original', origin: 'user' },
    };
    const projections = {
      selected: projection(null),
      original: projection(failure),
    };

    assert.deepEqual(failureCandidates(rows, projections, new Map(), new Map()), [
      { sessionId: 'original', ...failure },
    ]);
  });

  it('ignores subagents but includes ordinary forked conversations', () => {
    const rows = {
      root: { id: 'root', origin: 'user' },
      subagent: { id: 'subagent', origin: 'subagent' },
      child: { id: 'child', origin: 'user', parentId: 'root' },
    };
    const projections = Object.fromEntries(
      Object.keys(rows).map((id) => [id, projection(failure)]),
    );

    assert.deepEqual(failureCandidates(rows, projections, new Map(), new Map()), [
      { sessionId: 'root', ...failure },
      { sessionId: 'child', ...failure },
    ]);
  });

  it('ignores missing and cleared projections', () => {
    const rows = {
      missing: { id: 'missing', origin: 'user' },
      cleared: { id: 'cleared', origin: 'user' },
    };
    const projections = { cleared: projection(null), orphan: projection(failure) };

    assert.deepEqual(failureCandidates(rows, projections, new Map(), new Map()), []);
  });

  it('hides a failure while its session is running', () => {
    const rows = { root: { id: 'root', origin: 'user' } };
    const projections = { root: projection(failure) };
    const statuses = new Map([['root', { running: true }]]);

    assert.deepEqual(failureCandidates(rows, projections, statuses, new Map()), []);
    statuses.set('root', { running: false });
    assert.deepEqual(failureCandidates(rows, projections, statuses, new Map()), [
      { sessionId: 'root', ...failure },
    ]);
  });

  it('sorts failures across sessions by ascending time', () => {
    const rows = {
      latest: { id: 'latest', origin: 'user' },
      earliest: { id: 'earliest', origin: 'user' },
      middle: { id: 'middle', origin: 'user' },
    };
    const projections = {
      latest: projection({ ...failure, seq: 1, time: 3000 }),
      earliest: projection({ ...failure, seq: 99, time: 1000 }),
      middle: projection({ ...failure, seq: 50, time: 2000 }),
    };

    assert.deepEqual(failureCandidates(rows, projections, new Map(), new Map()), [
      { sessionId: 'earliest', ...failure, seq: 99, time: 1000 },
      { sessionId: 'middle', ...failure, seq: 50, time: 2000 },
      { sessionId: 'latest', ...failure, seq: 1, time: 3000 },
    ]);
  });

  it('suppresses only the dismissed sequence in the matching session', () => {
    const rows = {
      dismissed: { id: 'dismissed', origin: 'user' },
      other: { id: 'other', origin: 'user' },
    };
    const projections = {
      dismissed: projection(failure),
      other: projection(failure),
    };
    const dismissed = new Map([['dismissed', failure.seq]]);

    assert.deepEqual(failureCandidates(rows, projections, new Map(), dismissed), [
      { sessionId: 'other', ...failure },
    ]);

    projections.dismissed = projection({ ...failure, seq: 43, time: 2000 });
    assert.deepEqual(failureCandidates(rows, projections, new Map(), dismissed), [
      { sessionId: 'other', ...failure },
      { sessionId: 'dismissed', ...failure, seq: 43, time: 2000 },
    ]);
  });

  it('produces one candidate per session across repeated reads and hides it after dismissal', () => {
    const rows = { root: { id: 'root', origin: 'user' } };
    const projections = { root: projection(failure) };
    const dismissed = new Map();
    const expected = [{ sessionId: 'root', ...failure }];

    assert.deepEqual(failureCandidates(rows, projections, new Map(), dismissed), expected);
    assert.deepEqual(failureCandidates(rows, projections, new Map(), dismissed), expected);
    dismissed.set('root', failure.seq);
    assert.deepEqual(failureCandidates(rows, projections, new Map(), dismissed), []);
  });

  it('removes the candidate when a new turn clears the projection', () => {
    const rows = { root: { id: 'root', origin: 'user' } };
    const projections = { root: projection(failure) };

    assert.equal(failureCandidates(rows, projections, new Map(), new Map()).length, 1);
    projections.root = projection(reduceFailure(failure, {
      type: 'turn/start', seq: 43, time: 1100,
    }));
    assert.deepEqual(failureCandidates(rows, projections, new Map(), new Map()), []);
  });
});
