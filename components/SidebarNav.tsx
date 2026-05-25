/**
 * SidebarNav — desktop left navigation for Segato
 * Rendered only when width >= 1024 (desktop/Electron).
 */
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useI18n } from '../utils/i18n';
import { C, F, R, S } from '../utils/theme';
import { SIDEBAR_W } from '../utils/responsive';

interface NavItem {
  route: string;
  match: string;         // segment to test pathname against
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconActive: React.ComponentProps<typeof Ionicons>['name'];
}

const NAV_ITEMS: NavItem[] = [
  { route: '/',            match: '/(tabs)',         icon: 'wallet-outline',    iconActive: 'wallet' },
  { route: '/stats',       match: '/(tabs)/stats',   icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { route: '/budgets',     match: '/(tabs)/budgets', icon: 'pie-chart-outline', iconActive: 'pie-chart' },
  { route: '/loans',       match: '/(tabs)/loans',   icon: 'people-outline',    iconActive: 'people' },
  { route: '/config',      match: '/(tabs)/config',  icon: 'settings-outline',  iconActive: 'settings' },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { t }    = useI18n();

  const labels = [t.tabs.expenses, t.tabs.stats, t.tabs.budgets, t.tabs.loans, t.tabs.config];

  const isActive = (item: NavItem) => {
    // index matches if path is exactly /(tabs) or /(tabs)/
    if (item.route === '/') return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    return pathname.startsWith(item.match);
  };

  return (
    <View style={s.sidebar}>
      {/* Brand */}
      <View style={s.brand}>
        <View style={s.logoMark}>
          <Text style={s.logoText}>C</Text>
        </View>
        <Text style={s.appName}>Chiro</Text>
      </View>

      {/* Nav items */}
      <View style={s.nav}>
        {NAV_ITEMS.map((item, i) => {
          const active = isActive(item);
          return (
            <Pressable
              key={item.route}
              style={({ pressed }) => [
                s.navItem,
                active && s.navItemActive,
                pressed && !active && s.navItemPressed,
              ]}
              onPress={() => router.push(item.route as any)}
            >
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={20}
                color={active ? C.accent : C.textDim}
                style={s.navIcon}
              />
              <Text style={[s.navLabel, active && s.navLabelActive]}>
                {labels[i]}
              </Text>
              {active && <View style={s.activeBar} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: C.surface,
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingTop: 24,
    paddingBottom: 32,
    flexShrink: 0,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingHorizontal: S.xl,
    marginBottom: S['3xl'],
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: R.xs,
    backgroundColor: C.accentBg,
    borderWidth: 1,
    borderColor: C.accent + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: F.md, fontWeight: '900', color: C.accent },
  appName: { fontSize: F.md, fontWeight: '800', color: C.text },

  nav: { flex: 1, paddingHorizontal: S.sm, gap: 2 },

  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: S.md,
    borderRadius: R.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  navItemActive: {
    backgroundColor: C.accentBg,
  },
  navItemPressed: {
    backgroundColor: C.surfaceUp,
  },
  navIcon: { marginRight: S.sm },
  navLabel: {
    fontSize: F.base,
    fontWeight: '500',
    color: C.textDim,
    flex: 1,
  },
  navLabelActive: {
    color: C.accent,
    fontWeight: '700',
  },
  activeBar: {
    position: 'absolute',
    right: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
});
