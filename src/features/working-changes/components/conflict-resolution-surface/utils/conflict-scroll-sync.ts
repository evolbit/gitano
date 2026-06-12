const SCROLL_SYNC_TOLERANCE_PX = 1;

type PendingSyncedScrollTopRef = {
  current: number | null;
};

export type ConflictScrollHandle = {
  setScrollTop: (scrollTop: number) => void;
};

function scrollTopMatches(left: number, right: number) {
  return Math.abs(left - right) < SCROLL_SYNC_TOLERANCE_PX;
}

export function applySyncedScrollTop({
  currentScrollTop,
  pendingSyncedScrollTopRef,
  scrollTop,
  setScrollTop,
}: {
  currentScrollTop: number;
  pendingSyncedScrollTopRef: PendingSyncedScrollTopRef;
  scrollTop: number;
  setScrollTop: (scrollTop: number) => void;
}) {
  if (scrollTopMatches(currentScrollTop, scrollTop)) return false;

  markPendingSyncedScrollTop(pendingSyncedScrollTopRef, scrollTop);
  setScrollTop(scrollTop);
  window.requestAnimationFrame(() => {
    clearPendingSyncedScrollTop(pendingSyncedScrollTopRef, scrollTop);
  });
  return true;
}

export function shouldIgnoreSyncedScrollEvent(
  pendingSyncedScrollTopRef: PendingSyncedScrollTopRef,
  scrollTop: number,
) {
  const pendingScrollTop = pendingSyncedScrollTopRef.current;

  if (pendingScrollTop === null) return false;

  pendingSyncedScrollTopRef.current = null;
  return scrollTopMatches(scrollTop, pendingScrollTop);
}

export function markPendingSyncedScrollTop(
  pendingSyncedScrollTopRef: PendingSyncedScrollTopRef,
  scrollTop: number,
) {
  pendingSyncedScrollTopRef.current = scrollTop;
}

export function clearPendingSyncedScrollTop(
  pendingSyncedScrollTopRef: PendingSyncedScrollTopRef,
  scrollTop: number,
) {
  if (
    pendingSyncedScrollTopRef.current !== null &&
    scrollTopMatches(pendingSyncedScrollTopRef.current, scrollTop)
  ) {
    pendingSyncedScrollTopRef.current = null;
  }
}
