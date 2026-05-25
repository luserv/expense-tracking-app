import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Modal, Platform, Pressable,
  StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { PersonWithTotal, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { CONTENT_MAX_W, FORM_MAX_W, useLayout } from '../../utils/responsive';
import { C, F, R, S, shadow } from '../../utils/theme';

export default function LoansScreen() {
  const [persons, setPersons] = useState<PersonWithTotal[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [personName, setPersonName] = useState('');

  const { getPersons, createPerson, deletePerson } = useExpenses();
  const { t } = useI18n();
  const router = useRouter();
  const l = useLayout();
  const isWide = !l.isPhone;

  const load = useCallback(async () => { setPersons(await getPersons()); }, [getPersons]);
  useEffect(() => { load(); }, [load]);

  const handleAddPerson = async () => {
    if (!personName.trim()) { alert(t.loans.nameRequired); return; }
    await createPerson(personName.trim());
    setModalVisible(false); setPersonName(''); await load();
  };

  const handleDeletePerson = (item: PersonWithTotal) => {
    const doDelete = async () => { await deletePerson(item.person_id); await load(); };
    if (Platform.OS === 'web') { if (confirm(t.loans.deletePersonConfirm)) doDelete(); }
    else Alert.alert(t.common.delete, t.loans.deletePersonConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: doDelete },
    ]);
  };

  const totalPendingAll = persons.reduce((s, p) => s + p.total_pending, 0);
  const totalLoanedAll  = persons.reduce((s, p) => s + p.total_loaned, 0);
  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Summary */}
      <View style={[s.summaryCard, l.isDesktop && { maxWidth: CONTENT_MAX_W, alignSelf: 'center', width: '100%', marginHorizontal: 0 }]}>
        <View style={s.summaryItem}>
          <Text style={s.summaryLabel}>{t.loans.totalLoaned}</Text>
          <Text style={[s.summaryValue, { color: C.accent }]}>{fmt(totalLoanedAll)}</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryLabel}>{t.loans.totalPending}</Text>
          <Text style={[s.summaryValue, { color: totalPendingAll > 0 ? C.warn : C.income }]}>
            {fmt(totalPendingAll)}
          </Text>
        </View>
      </View>

      <FlatList
        data={persons}
        keyExtractor={item => item.person_id}
        contentContainerStyle={[s.listContent, l.isDesktop && { maxWidth: CONTENT_MAX_W, width: '100%', alignSelf: 'center' }]}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
            onPress={() => router.push(`/person/${item.person_id}`)}
            android_ripple={{ color: C.surfaceHigh }}
          >
            <View style={[s.avatar, { backgroundColor: C.accentBg }]}>
              <Text style={[s.avatarText, { color: C.accent }]}>{item.name[0].toUpperCase()}</Text>
            </View>
            <View style={s.rowBody}>
              <Text style={s.rowName}>{item.name}</Text>
              <Text style={[s.rowSub, { color: item.total_pending > 0 ? C.warn : C.income }]}>
                {item.total_pending > 0 ? `${t.loans.pending}: ${fmt(item.total_pending)}` : t.loans.paid}
              </Text>
            </View>
            <Pressable style={s.deleteBtn} onPress={() => handleDeletePerson(item)} hitSlop={10}>
              <Trash2 size={18} color={C.textDim} />
            </Pressable>
            <ChevronRight size={18} color={C.textDim} />
          </Pressable>
        )}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Text style={s.emptyText}>{t.loans.empty}</Text>
          </View>
        )}
      />

      <Pressable
        style={({ pressed }) => [s.fab, isWide && s.fabWide, pressed && { opacity: 0.88 }]}
        onPress={() => { setPersonName(''); setModalVisible(true); }}
      >
        <Plus size={26} color="#fff" strokeWidth={2.5} />
      </Pressable>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={[s.overlay, isWide && s.overlayDesktop]}>
          <View style={[s.sheet, isWide && s.sheetDesktop]}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{t.loans.addPerson}</Text>
            <View style={s.sheetContent}>
              <Text style={s.fieldLabel}>{t.loans.personName} <Text style={{ color: C.expense }}>*</Text></Text>
              <TextInput
                style={s.input}
                placeholder={t.loans.personNamePlaceholder}
                placeholderTextColor={C.textDim}
                value={personName} onChangeText={setPersonName}
                autoFocus
              />
              <View style={s.btnRow}>
                <Pressable style={[s.btn, s.btnCancel]} onPress={() => setModalVisible(false)}>
                  <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={[s.btn, s.btnSave]} onPress={handleAddPerson}>
                  <Text style={s.btnSaveText}>{t.common.save}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: R.md,
    marginHorizontal: S.lg, marginTop: S.lg, marginBottom: S.xs,
    padding: S.lg, borderWidth: 1, borderColor: C.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 36, backgroundColor: C.border },
  summaryLabel: { fontSize: F.xs, color: C.textDim, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  summaryValue: { fontSize: F.xl, fontWeight: '800' },

  listContent: { paddingTop: S.xs, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 64 },
  emptyText: { fontSize: F.base, color: C.textDim },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: S.lg, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
    backgroundColor: C.bg, gap: S.md,
  },
  rowPressed: { backgroundColor: C.surfaceHigh },
  avatar: { width: 42, height: 42, borderRadius: R.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: F.md, fontWeight: '800' },
  rowBody: { flex: 1 },
  rowName: { fontSize: F.base, fontWeight: '600', color: C.text },
  rowSub: { fontSize: F.sm, marginTop: 3 },
  deleteBtn: { paddingHorizontal: 6 },

  fab: {
    position: 'absolute', right: 20, bottom: 28,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.lg,
  },
  fabWide: { right: 32, bottom: 32 },

  overlay: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end' },
  overlayDesktop: { justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    paddingTop: 12,
    borderTopWidth: 1, borderColor: C.border,
  },
  sheetDesktop: { borderRadius: R.xl, maxWidth: FORM_MAX_W, width: '100%', borderWidth: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: F.lg, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 4, paddingHorizontal: 24 },
  sheetContent: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  fieldLabel: { fontSize: F.sm, fontWeight: '600', color: C.textSec, marginTop: S.lg, marginBottom: 6 },
  input: {
    backgroundColor: C.surfaceUp, borderWidth: 1, borderColor: C.border,
    borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: F.base, color: C.text,
  },
  btnRow: { flexDirection: 'row', gap: S.sm, marginTop: S.xl },
  btn: { flex: 1, paddingVertical: 14, borderRadius: R.sm, alignItems: 'center' },
  btnCancel: { backgroundColor: C.surfaceUp },
  btnSave: { backgroundColor: C.accent },
  btnCancelText: { fontSize: F.base, fontWeight: '600', color: C.textSec },
  btnSaveText: { fontSize: F.base, fontWeight: '700', color: '#fff' },
});
