import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useI18n } from '../../utils/i18n';

export default function TabsLayout() {
  const { t } = useI18n();

  return (
    <Tabs>
      <Tabs.Screen name="index" options={{
        headerTitle: t.tabs.expenses,
        tabBarLabel: t.tabs.expenses,
        tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="stats" options={{
        headerTitle: t.tabs.stats,
        tabBarLabel: t.tabs.stats,
        tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="loans" options={{
        headerTitle: t.tabs.loans,
        tabBarLabel: t.tabs.loans,
        tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="config" options={{
        headerTitle: t.tabs.config,
        tabBarLabel: t.tabs.config,
        tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
