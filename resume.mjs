/** Submit one user-confirmed continuation through the normal Session prompt path.
 * @param sessions - Client Session acquisition service.
 * @param item - Exact failed Session and turn-end sequence shown in the reminder.
 * @returns accepted after prompt admission, or stale if that failure is no longer current.
 */
export function resumeFailure(sessions, item) {
  return sessions.using(item.sessionId, {source: 'controllerOperation'}, async reference => {
    const {session} = await reference.ready;
    if (session.getSnapshot().running || session.projections.faceOf('modelInterruption').getSnapshot()?.seq !== item.seq) {
      return {status: 'stale'};
    }
    const result = await session.prompt([{type: 'text', text: '继续'}], 'queue');
    if (!result.ok) throw new Error(result.error.message);
    return {status: 'accepted'};
  });
}
