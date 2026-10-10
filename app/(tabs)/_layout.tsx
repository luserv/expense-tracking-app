import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SidebarNav from '../../components/SidebarNav';
import { useI18n } from '../../utils/i18n';
import { SIDEBAR_W, useLayout } from '../../utils/responsive';
import { C } from '../../utils/theme';

function TabIcon({ name, focused }: { name: React.ComponentProps<typeof Ionicons>['name']; focused: boolean }) {
  return (
    <View style={[ic.wrap, focused && ic.wrapActive]}>
      <Ionicons name={name} size={22} color={focused ? C.accent : C.textDim} />
    </View>
  );
}

const ic = StyleSheet.create({
  wrap:       { width: 42, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  wrapActive: { backgroundColor: C.accentBg },
});

export default function TabsLayout() {
  const { t } = useI18n();
  const { isDesktop } = useLayout();
  const insets = useSafeAreaInsets();

  const BAR_H = Platform.OS === 'ios' ? 50 + insets.bottom : 56 + insets.bottom;

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isDesktop
          ? { display: 'none' }
          : {
              backgroundColor: C.surface,
              borderTopWidth: 1,
              borderTopColor: C.border,
              height: BAR_H,
              paddingBottom: insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 8 : 10),
              paddingTop: 6,
              elevation: 0,
            },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: t.tabs.expenses,
        tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'wallet' : 'wallet-outline'} focused={focused} />,
      }} />
      <Tabs.Screen name="stats" options={{
        title: t.tabs.stats,
        tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} focused={focused} />,
      }} />
      <Tabs.Screen name="budgets" options={{
        title: t.tabs.budgets,
        tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'pie-chart' : 'pie-chart-outline'} focused={focused} />,
      }} />
      <Tabs.Screen name="loans" options={{
        title: t.tabs.loans,
        tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} />,
      }} />
      <Tabs.Screen name="config" options={{
        title: t.tabs.config,
        tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} />,
      }} />
    </Tabs>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
        <SidebarNav />
        <View style={{ flex: 1 }}>{tabs}</View>
      </View>
    );
  }

  return tabs;
}
