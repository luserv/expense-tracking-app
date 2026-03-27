import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PersonWithTotal, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';

export default function LoansScreen() {
  const [persons, setPersons] = useState<PersonWithTotal[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [personName, setPersonName] = useState('');

  const { getPersons, createPerson, deletePerson } = useExpenses();
  const { t } = useI18n();
  const router = useRouter();

  const load = useCallback(async () => {
    setPersons(await getPersons());
  }, [getPersons]);

  useEffect(() => { load(); }, [load]);

  const handleAddPerson = async () => {
    if (!personName.trim()) { alert(t.loans.nameRequired); return; }
    await createPerson(personName.trim());
    setModalVisible(false);
    setPersonName('');
    await load();
  };

  const handleDeletePerson = (item: PersonWithTotal) => {
    const doDelete = async () => {
      await deletePerson(item.person_id);
      await load();
    };
    if (Platform.OS === 'web') {
      if (confirm(t.loans.deletePersonConfirm)) doDelete();
    } else {
      Alert.alert(t.common.delete, t.loans.deletePersonConfirm, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.delete, style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const totalPendingAll = persons.reduce((s, p) => s + p.total_pending, 0);
  const totalLoanedAll = persons.reduce((s, p) => s + p.total_loaned, 0);

  return (
    <View style={styles.container}>
      {/* Global summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t.loans.totalLoaned}</Text>
          <Text style={[styles.summaryValue, styles.loanedColor]}>${totalLoanedAll.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t.loans.totalPending}</Text>
          <Text style={[styles.summaryValue, totalPendingAll > 0 ? styles.pendingColor : styles.paidColor]}>
            ${totalPendingAll.toFixed(2)}
          </Text>
        </View>
      </View>

      <FlatList
        data={persons}
        keyExtractor={item => item.person_id}
        renderItem={({ item }) => (
          <Pressable style={styles.personItem} onPress={() => router.push(`/person/${item.person_id}`)}>
            <View style={styles.personAvatar}>
              <Text style={styles.personInitial}>{item.name[0].toUpperCase()}</Text>
            </View>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>{item.name}</Text>
              <Text style={[styles.personTotal, item.total_pending > 0 ? styles.pendingColor : styles.paidColor]}>
                {item.total_pending > 0
                  ? `${t.loans.pending}: $${item.total_pending.toFixed(2)}`
                  : t.loans.paid}
              </Text>
            </View>
            <Pressable style={styles.deleteBtn} onPress={() => handleDeletePerson(item)} hitSlop={8}>
              <Trash2 size={18} color="#FF3B30" />
            </Pressable>
            <ChevronRight size={18} color="#C7C7CC" />
          </Pressable>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t.loans.empty}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />

      <Pressable style={styles.fab} onPress={() => { setPersonName(''); setModalVisible(true); }}>
        <Plus size={24} color="#fff" />
      </Pressable>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t.loans.addPerson}</Text>

            <Text style={styles.fieldLabel}>
              {t.loans.personName} <Text style={styles.required}>{t.common.required}</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t.loans.personNamePlaceholder}
              value={personName}
              onChangeText={setPersonName}
              placeholderTextColor="#C7C7CC"
              autoFocus
            />

            <View style={styles.buttonContainer}>
              <Pressable style={[styles.button, styles.buttonCancel]} onPress={() => setModalVisible(false)}>
                <Text style={styles.textCancel}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonSave]} onPress={handleAddPerson}>
                <Text style={styles.textSave}>{t.common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  summaryCard: {
    flexDirection: 'row',
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    backgroundColor: '#F2F2F7', borderRadius: 14, padding: 16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#D1D1D6', marginVertical: 4 },
  summaryLabel: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  loanedColor: { color: '#007AFF' },
  pendingColor: { color: '#FF9500' },
  paidColor: { color: '#34C759' },

  listContent: { paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: '#8E8E93' },

  personItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA',
  },
  personAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  personInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  personInfo: { flex: 1 },
  personName: { fontSize: 16, fontWeight: '600', color: '#000' },
  personTotal: { fontSize: 13, marginTop: 2 },
  deleteBtn: { paddingHorizontal: 8 },

  fab: {
    position: 'absolute', right: 16, bottom: 32,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 20 },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 8, marginBottom: 6 },
  required: { color: '#FF3B30' },
  input: {
    borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 16, color: '#000', backgroundColor: '#F9F9F9',
  },

  buttonContainer: { flexDirection: 'row', gap: 10, marginTop: 20 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buttonCancel: { backgroundColor: '#E5E5EA' },
  buttonSave: { backgroundColor: '#007AFF' },
  textCancel: { fontSize: 16, fontWeight: '600', color: '#000' },
  textSave: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
