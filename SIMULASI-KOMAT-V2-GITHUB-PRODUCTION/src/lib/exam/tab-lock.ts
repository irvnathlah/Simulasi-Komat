export const EXAM_LOCK_NAME = 'mgmp-exam-exclusive';
export type TabLockState = 'waiting' | 'owner' | 'blocked' | 'unsupported' | 'error';
type Manager = Pick<LockManager, 'request' | 'query'>;

// One lifetime per effect generation. React Strict Mode/Fast Refresh may clean
// it up before the browser has dispatched the acquisition callback.
export function acquireExamTabLock(manager: Manager | undefined, notify: (state: TabLockState) => void) {
  notify('waiting');
  if (!manager) { notify('unsupported'); return () => {}; }
  const cancellation = new AbortController();
  let disposed = false, acquired = false, failed = false;
  let release!: () => void;
  // Allocate BEFORE request(): cleanup works even before acquisition begins.
  const lifetime = new Promise<void>(resolve => { release = resolve; });
  try {
    // Queue instead of a one-shot ifAvailable probe. A transient old-generation
    // lock cannot strand the UI, and a second tab remains gated until release.
    void manager.request(EXAM_LOCK_NAME, {mode:'exclusive', signal:cancellation.signal}, async lock => {
      if (disposed) return;
      if (!lock) { failed = true; notify('error'); return; }
      acquired = true;
      notify('owner');
      await lifetime;
    }).catch(() => { failed = true; if (!disposed) notify('error'); });
    // query() is only a UI hint, never permission to mount the examination.
    // A stale snapshot cannot override a successful acquisition callback.
    void Promise.resolve().then(() => manager.query()).then(snapshot => {
      if (!disposed && !acquired && !failed && snapshot.held?.some(lock => lock.name === EXAM_LOCK_NAME)) notify('blocked');
    }).catch(() => { /* Queued acquisition still controls ownership. */ });
  } catch { if (!disposed) notify('error'); }
  return () => {
    disposed = true;
    cancellation.abort(); // Remove a pending request; ignore its AbortError.
    release(); // Abort alone does not release an already granted lock.
  };
}
