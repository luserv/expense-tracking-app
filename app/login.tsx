// Web / Electron: Firebase signInWithPopup
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../utils/authContext';
import { C, F, R, S, shadow } from '../utils/theme';

export default function LoginScreen() {
  const { user, isGuest, loading, signIn, continueAsGuest } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    if (!loading && (user || isGuest)) router.replace('/');
  }, [user, isGuest, loading]);

  const handleSignIn = async () => {
    setError(null); setBusy(true);
    try { await signIn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.card}>
        {/* Logo mark */}
        <View style={s.logoWrap}>
          <Image source={require('../assets/Chiro/chiro-simbolo-azul-512.png')} style={s.logoMark} resizeMode="contain" />
        </View>

        <Text style={s.appName}>Chiro</Text>
        <Text style={s.tagline}>Tu control de gastos, siempre contigo.</Text>

        <Pressable
          style={({ pressed }) => [s.primaryBtn, busy && s.btnDisabled, pressed && { opacity: 0.88 }]}
          onPress={handleSignIn}
          disabled={busy}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryBtnText}>Continuar con Google</Text>
          }
        </Pressable>

        <Text style={s.hint}>Activa el backup en Google Drive</Text>

        <Pressable style={s.ghostBtn} onPress={continueAsGuest}>
          <Text style={s.ghostBtnText}>Continuar sin iniciar sesión</Text>
        </Pressable>

        {error && <Text style={s.error}>{error}</Text>}

        <Text style={s.disclaimer}>
          Al iniciar sesión aceptas que tus datos de licencia se almacenen de forma segura.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: S.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  card: {
    backgroundColor: C.surface,
    borderRadius: R.xl, padding: 32,
    width: '100%', maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    ...shadow.md,
  },

  logoWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: C.accentBg,
    borderWidth: 1, borderColor: C.accent + '44',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: S.lg,
  },
  logoMark: { width: 52, height: 52 },

  appName: { fontSize: F['2xl'], fontWeight: '800', color: C.text, marginBottom: S.xs },
  tagline: { fontSize: F.base, color: C.textSec, textAlign: 'center', marginBottom: S['3xl'], lineHeight: 22 },

  primaryBtn: {
    backgroundColor: C.accent, borderRadius: R.sm,
    paddingVertical: 15, width: '100%',
    alignItems: 'center', marginBottom: S.xs,
  },
  btnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: '#fff', fontSize: F.base, fontWeight: '700' },

  hint: { fontSize: F.xs, color: C.textDim, textAlign: 'center', marginBottom: S.lg },

  ghostBtn: { width: '100%', alignItems: 'center', paddingVertical: 13 },
  ghostBtnText: { color: C.textSec, fontSize: F.base, fontWeight: '500' },

  error: { color: C.expense, fontSize: F.sm, textAlign: 'center', marginBottom: S.sm, marginTop: S.xs },
  disclaimer: { fontSize: F.xs, color: C.textDim, textAlign: 'center', marginTop: S.sm, lineHeight: 18 },
});
