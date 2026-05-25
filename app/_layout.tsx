import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../utils/authContext';
import { ExpensesProvider } from '../utils/context';
import { I18nProvider } from '../utils/i18n';
import { C } from '../utils/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isGuest, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inLogin = segments[0] === 'login';
    const hasAccess = !!user || isGuest;
    if (!hasAccess && !inLogin) router.replace('/login');
    if (hasAccess && inLogin) router.replace('/');
  }, [user, isGuest, loading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ExpensesProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar barStyle="light-content" backgroundColor={C.bg} />
            <AuthGate>
              <Stack screenOptions={{
                contentStyle: { backgroundColor: C.bg },
                headerStyle: { backgroundColor: C.surface },
                headerTintColor: C.text,
                headerShadowVisible: false,
                headerTitleStyle: { fontWeight: '700', fontSize: 17 },
              }}>
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  gestureEnabled: true,
                }} />
                <Stack.Screen
                  name="expense/[id]"
                  options={{ headerShown: true, title: '' }}
                />
                <Stack.Screen
                  name="person/[id]"
                  options={{ headerShown: true, title: '' }}
                />
              </Stack>
            </AuthGate>
          </GestureHandlerRootView>
        </ExpensesProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
