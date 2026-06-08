import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  getNotifications as apiFetchNotifications,
  markNotificationsRead as apiMarkRead,
} from '@/lib/api';
import type { AppNotification } from '@/lib/types';
import { useAuth } from './AuthContext';

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  reload: () => Promise<void>;
  markRead: (ids?: string[]) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const POLL_INTERVAL_MS = 60_000; // poll every 60s when app is active

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isGuest } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async () => {
    if (!isAuthenticated || isGuest) {
      setNotifications([]);
      return;
    }
    try {
      setLoading(true);
      const data = await apiFetchNotifications(50);
      setNotifications(data);
    } catch {
      // silently fail — notifications are not critical
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isGuest]);

  const markRead = useCallback(async (ids?: string[]) => {
    if (!isAuthenticated || isGuest) return;
    try {
      await apiMarkRead(ids);
      // Optimistically mark as read in local state
      setNotifications((prev) =>
        prev.map((n) =>
          !ids || ids.includes(n._id)
            ? { ...n, readBy: [...(n.readBy ?? []), '__local__'], isRead: true } as AppNotification & { isRead: boolean }
            : n,
        ),
      );
    } catch {
      // silently fail
    }
  }, [isAuthenticated, isGuest]);

  // Load on mount and on auth change
  useEffect(() => {
    reload();
  }, [reload]);

  // Poll while app is active
  useEffect(() => {
    if (!isAuthenticated || isGuest) return;

    pollRef.current = setInterval(reload, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        reload();
        if (!pollRef.current) {
          pollRef.current = setInterval(reload, POLL_INTERVAL_MS);
        }
      } else {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    });

    return () => {
      sub.remove();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isAuthenticated, isGuest, reload]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !(n as AppNotification & { isRead?: boolean }).isRead).length,
    [notifications],
  );

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, reload, markRead }),
    [notifications, unreadCount, loading, reload, markRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
