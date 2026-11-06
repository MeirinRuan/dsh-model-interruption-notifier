/** Reduce committed turn outcomes into the latest resumable failure, without changing model history. */
export function reduceFailure(state, event) {
  if (event.type === 'turn/start' || event.type === 'user/message') return null;
  if (event.type !== 'turn/end') return state;
  const {reason} = event.data;
  return reason.kind === 'error'
    ? {seq: event.seq, time: event.time, message: reason.error.message, code: reason.error.code}
    : null;
}

/** Select undismissed failures in ordinary conversations, oldest first. */
export function failureCandidates(rows, projections, statuses, dismissed) {
  return Object.values(rows).flatMap(row => {
    if (row.origin === 'subagent') return [];
    const failure = projections[row.id]?.values?.modelInterruption;
    if (!failure || statuses.get(row.id)?.running || row.running || dismissed.get(row.id) === failure.seq) return [];
    return [{sessionId: row.id, ...failure}];
  }).sort((a, b) => a.time - b.time);
}
