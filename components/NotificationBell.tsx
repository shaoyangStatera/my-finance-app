import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useColors } from '@/contexts/ThemeContext';
import { radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export function NotificationBell({ tint = 'dark' }: { tint?: 'dark' | 'light' }) {
  const { isAuthenticated } = useAuth();
  const { notifications, unreadCount, markRead } = useNotifications();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) return null;

  const iconColor = tint === 'light' ? 'rgba(255,255,255,0.88)' : colors.textSecondary;

  const handleOpen = () => {
    setOpen(true);
    if (unreadCount > 0) markRead();
  };

  return (
    <>
      <Pressable onPress={handleOpen} style={staticBellStyles.btn} hitSlop={10}>
        <Ionicons name="notifications-outline" size={22} color={iconColor} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={staticBellStyles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable style={staticBellStyles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={styles.panel}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifications</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={staticBellStyles.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {notifications.length === 0 ? (
                <Text style={styles.empty}>No recent activity</Text>
              ) : (
                notifications.slice(0, 20).map((n) => {
                  const isRead = (n as typeof n & { isRead?: boolean }).isRead;
                  return (
                    <View key={n._id} style={[styles.item, !isRead && styles.itemUnread]}>
                      <Text style={staticBellStyles.itemIcon}>
                        {n.type === 'cpf' ? '🏦' : n.type === 'investment' ? '📈' : '💳'}
                      </Text>
                      <View style={staticBellStyles.itemContent}>
                        <Text style={styles.itemMsg}>{n.message}</Text>
                        <Text style={styles.itemTime}>
                          {new Date(n.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      {!isRead && <View style={styles.dot} />}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    badge:        { position: 'absolute', top: 2, right: 2, backgroundColor: c.negative, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    panel:        { width: 320, maxHeight: 420, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.borderLight, overflow: 'hidden', ...shadow.elevated },
    panelHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight },
    panelTitle:   { ...typography.bodyMedium, color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
    empty:        { ...typography.caption, color: c.textMuted, padding: spacing.lg, textAlign: 'center' },
    item:         { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 10, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight },
    itemUnread:   { backgroundColor: c.accentLight },
    itemMsg:      { ...typography.body, color: c.text, fontSize: 13, lineHeight: 18 },
    itemTime:     { ...typography.caption, color: c.textMuted, marginTop: 2 },
    dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, marginTop: 4 },
  });
}

const staticBellStyles = StyleSheet.create({
  btn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badgeText:  { color: '#fff', fontSize: 9, fontWeight: '700' },
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 80, paddingRight: spacing.md },
  list:       { maxHeight: 360 },
  itemIcon:   { fontSize: 16, width: 24, textAlign: 'center', marginTop: 1 },
  itemContent: { flex: 1 },
});
