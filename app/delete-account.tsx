/**
 * Pantalla de eliminación de cuenta — accesible via:
 *   Deep link:  chiro://delete-account
 *   Web:        https://segast0.web.app/delete-account  (Firebase Hosting)
 *
 * Requerimiento de Play Store: Data safety > Account deletion URL
 */
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { auth } from '../utils/firebase';
import { useAuth } from '../utils/authContext';

export default function DeleteAccountScreen() {
  const { user, loading, signIn, deleteAccount } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('¿Estás seguro? Esta acción eliminará tu cuenta y todos tus datos de forma permanente.')
      : await new Promise<boolean>(res =>
          Alert.alert(
            'Eliminar cuenta',
            'Esta acción eliminará tu cuenta y todos tus datos de forma permanente. No se puede deshacer.',
            [
              { text: 'Cancelar', style: 'cancel', onPress: () => res(false) },
              { text: 'Eliminar', style: 'destructive', onPress: () => res(true) },
            ]
          )
        );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      setDone(true);
    } catch (e: any) {
      if (e.code === 'auth/requires-recent-login') {
        setError('Por seguridad, cerrá sesión e iniciá sesión nuevamente antes de eliminar tu cuenta.');
      } else {
        setError(e.message ?? 'Error al eliminar la cuenta.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#FF3B30" />
      </View>
    );
  }

  if (done) {
    return (
      <View style={s.center}>
        <Text style={s.icon}>✅</Text>
        <Text style={s.title}>Cuenta eliminada</Text>
        <Text style={s.subtitle}>Tu cuenta y todos tus datos han sido eliminados permanentemente.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.icon}>⚠️</Text>
        <Text style={s.title}>Eliminar cuenta</Text>
        <Text style={s.subtitle}>
          Al eliminar tu cuenta se borrarán de forma permanente:{'\n\n'}
          • Tu licencia y datos de acceso{'\n'}
          • Tu historial de uso en nuestros servidores{'\n\n'}
          Los datos locales de gastos guardados en tu dispositivo no se eliminan automáticamente — podés hacerlo desde Ajustes del dispositivo → App → Borrar datos.
        </Text>

        {!user ? (
          <>
            <Text style={s.hint}>Iniciá sesión para continuar:</Text>
            <Pressable style={[s.btn, s.signInBtn]} onPress={signIn} disabled={busy}>
              <Text style={s.btnText}>Iniciar sesión con Google</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={s.userEmail}>Cuenta: {user.email}</Text>
            <Pressable style={[s.btn, s.deleteBtn, busy && s.btnDisabled]} onPress={handleDelete} disabled={busy}>
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Eliminar mi cuenta</Text>
              }
            </Pressable>
          </>
        )}

        {error && <Text style={s.error}>{error}</Text>}

        <Pressable style={s.cancel} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={s.cancelText}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', padding: 24 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28,
    width: '100%', maxWidth: 400,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
  },
  icon:      { fontSize: 40, textAlign: 'center', marginBottom: 12 },
  title:     { fontSize: 22, fontWeight: '700', color: '#000', textAlign: 'center', marginBottom: 12 },
  subtitle:  { fontSize: 14, color: '#555', lineHeight: 22, marginBottom: 20 },
  hint:      { fontSize: 14, color: '#555', marginBottom: 12 },
  userEmail: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 16, textAlign: 'center' },
  btn:       { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  signInBtn: { backgroundColor: '#007AFF' },
  deleteBtn: { backgroundColor: '#FF3B30' },
  btnDisabled: { opacity: 0.6 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  error:     { color: '#FF3B30', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  cancel:    { alignItems: 'center', paddingVertical: 10 },
  cancelText:{ color: '#007AFF', fontSize: 15, fontWeight: '500' },
});
