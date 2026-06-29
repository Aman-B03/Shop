import { useState, useEffect } from 'react';
import { onSyncEvent, type SyncEvent } from '../sync';

// ─── Online Status ───────────────────────────────────────────────────────────
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return isOnline;
}

// ─── Sync Status ─────────────────────────────────────────────────────────────
export function useSyncStatus() {
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);

  useEffect(() => {
    const unsub = onSyncEvent((event) => setLastEvent(event));
    return unsub;
  }, []);

  return lastEvent;
}
