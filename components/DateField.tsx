/**
 * Campo de fecha con 3 segmentos editables por separado (Día / Mes / Año).
 * Permite cambiar solo una parte sin retipear toda la fecha.
 * value y onChange usan ISO 'YYYY-MM-DD' ('' si está incompleta).
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useI18n } from '../utils/i18n';
import { C, F, R, S } from '../utils/theme';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const { t } = useI18n();
  const init = ISO.test(value) ? value.split('-') : ['', '', ''];
  const [yr, setYr] = useState(init[0]);
  const [mon, setMon] = useState(init[1]);
  const [day, setDay] = useState(init[2]);
  // Última fecha que emitimos: si el value que llega es la nuestra, no resincronizamos
  // (así borrar un solo campo no dispara el "value vacío → limpiar todo").
  const lastEmit = useRef<string>(ISO.test(value) ? value : '');

  useEffect(() => {
    if (value === lastEmit.current) return; // round-trip de nuestro propio onChange
    if (ISO.test(value)) {
      const [y, m, d] = value.split('-');
      setYr(y); setMon(m); setDay(d);
    } else if (!value) {
      setYr(''); setMon(''); setDay('');
    }
    lastEmit.current = value;
  }, [value]);

  const emit = (d: string, m: string, y: string) => {
    const iso = d && m && y.length === 4 ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
    lastEmit.current = iso;
    onChange(iso);
  };

  return (
    <View style={s.row}>
      <View style={s.seg}>
        <Text style={s.lbl}>{t.common.day}</Text>
        <TextInput style={s.input} value={day} keyboardType="number-pad" maxLength={2}
          placeholder="DD" placeholderTextColor={C.textDim}
          onChangeText={v => { const x = v.replace(/\D/g, '').slice(0, 2); setDay(x); emit(x, mon, yr); }} />
      </View>
      <View style={s.seg}>
        <Text style={s.lbl}>{t.common.month}</Text>
        <TextInput style={s.input} value={mon} keyboardType="number-pad" maxLength={2}
          placeholder="MM" placeholderTextColor={C.textDim}
          onChangeText={v => { const x = v.replace(/\D/g, '').slice(0, 2); setMon(x); emit(day, x, yr); }} />
      </View>
      <View style={[s.seg, { flex: 1.5 }]}>
        <Text style={s.lbl}>{t.common.year}</Text>
        <TextInput style={s.input} value={yr} keyboardType="number-pad" maxLength={4}
          placeholder="AAAA" placeholderTextColor={C.textDim}
          onChangeText={v => { const x = v.replace(/\D/g, '').slice(0, 4); setYr(x); emit(day, mon, x); }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: S.sm },
  seg: { flex: 1 },
  lbl: { fontSize: F.xs, color: C.textDim, marginBottom: 4, textAlign: 'center' },
  input: {
    backgroundColor: C.surfaceUp, borderWidth: 1, borderColor: C.border,
    borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 12,
    fontSize: F.base, color: C.text, textAlign: 'center',
  },
});
