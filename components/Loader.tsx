/**
 * Loader — indicador de carga con la marca Chiro.
 *
 * - `fullscreen` (default): pantalla completa con logo + spinner. Para el arranque,
 *   el login y la restauración de sesión.
 * - `fullscreen={false}`: spinner centrado e inline, para recargas dentro de una pantalla.
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, Text, View } from 'react-native';
import { C, F, S } from '../utils/theme';

export default function Loader({
  fullscreen = true,
  label,
}: {
  fullscreen?: boolean;
  label?: string;
}) {
  if (!fullscreen) {
    return (
      <View style={s.inline}>
        <ActivityIndicator size="large" color={C.accent} />
        {label ? <Text style={s.label}>{label}</Text> : null}
      </View>
    );
  }

  return <BrandedLoader label={label} />;
}

function BrandedLoader({ label }: { label?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <View style={s.full}>
      <Animated.Image
        source={require('../assets/Chiro/chiro-simbolo-azul-512.png')}
        style={[s.logo, { transform: [{ scale }], opacity }]}
        resizeMode="contain"
      />
      <ActivityIndicator size="small" color={C.accent} style={{ marginTop: S.xl }} />
      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  full: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: S.xl },
  inline: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, minHeight: 160 },
  logo: { width: 88, height: 88 },
  label: { marginTop: S.md, fontSize: F.sm, color: C.textSec, textAlign: 'center' },
});
