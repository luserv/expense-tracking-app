import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Loader from '../components/Loader';
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

  // Mientras se restaura la sesión / se inicia sesión, mostrar el loader de marca
  // en lugar de dejar pasar la pantalla por defecto.
  if (loading) return <Loader />;

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
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
                <Stack.Screen
                  name="delete-account"
                  options={{ headerShown: true, title: 'Eliminar cuenta', headerBackTitle: '' }}
                />
              </Stack>
            </AuthGate>
          </GestureHandlerRootView>
        </ExpensesProvider>
      </AuthProvider>
    </I18nProvider>
    </SafeAreaProvider>
  );
}
