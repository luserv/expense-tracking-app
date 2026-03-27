import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Dropdown from '../../components/Dropdown';
import { Account, Category, Expense, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';

function displayToIso(display: string): string {
  const parts = display.split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return '';
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { getExpense, updateExpense, deleteExpense, getCategories, getAccounts } = useExpenses();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([getExpense(id), getCategories(), getAccounts()]).then(([expense, cats, accs]) => {
      if (expense) {
        setDesc(expense.description);
        setAmount(String(expense.amount));
        setDate(isoToDisplay(expense.date));
        setType(expense.type);
        setCategoryId(expense.category_id ?? null);
        setAccountId(expense.account_id ?? null);
        setNotes(expense.notes ?? '');
      }
      setCategories(cats);
      setAccounts(accs);
      setLoading(false);
    });
  }, [id]);

  const formatDateInput = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0,2)}/${digits.slice(2)}`;
    setDate(formatted);
  };

  const handleSave = async () => {
    if (!desc.trim()) { alert(t.expenses.descriptionRequired); return; }
    const amt = parseFloat(amount.replace(',', '.'));
    if (!amt || amt <= 0) { alert(t.expenses.amountRequired); return; }
    const isoDate = displayToIso(date);
    if (!isoDate) { alert(t.expenses.dateRequired); return; }

    const ok = await updateExpense(id!, {
      description: desc.trim(),
      amount: amt,
      date: isoDate,
      type,
      category_id: categoryId,
      account_id: accountId,
      notes: notes.trim() || null,
    });
    if (ok) router.back();
  };

  const handleDelete = () => {
    const doDelete = async () => {
      await deleteExpense(id!);
      router.back();
    };

    if (Platform.OS === 'web') {
      if (confirm(t.expenses.deleteConfirm)) doDelete();
    } else {
      Alert.alert(t.common.delete, t.expenses.deleteConfirm, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.delete, style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  if (loading) return <View style={styles.container} />;

  const filteredCats = categories.filter(c => c.type === type);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{t.expenses.editExpense}</Text>

      <Text style={styles.fieldLabel}>{t.expenses.type}</Text>
      <View style={styles.typeRow}>
        {(['expense', 'income'] as const).map(tp => (
          <Pressable
            key={tp}
            style={[
              styles.typeChip,
              type === tp && (tp === 'expense' ? styles.typeChipExpense : styles.typeChipIncome),
            ]}
            onPress={() => { setType(tp); setCategoryId(null); }}
          >
            <Text style={[styles.typeChipText, type === tp && styles.typeChipTextActive]}>
              {tp === 'expense' ? t.common.expense : t.common.income}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>
        {t.expenses.description} <Text style={styles.required}>{t.common.required}</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={desc}
        onChangeText={setDesc}
        placeholder={t.expenses.descriptionPlaceholder}
        placeholderTextColor="#C7C7CC"
      />

      <Text style={styles.fieldLabel}>
        {t.expenses.amount} <Text style={styles.required}>{t.common.required}</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={t.expenses.amountPlaceholder}
        placeholderTextColor="#C7C7CC"
      />

      <Text style={styles.fieldLabel}>
        {t.expenses.date} <Text style={styles.required}>{t.common.required}</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={date}
        onChangeText={formatDateInput}
        keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
        maxLength={10}
        placeholder={t.expenses.datePlaceholder}
        placeholderTextColor="#C7C7CC"
      />

      <Text style={styles.fieldLabel}>{t.expenses.category}</Text>
      <Dropdown
        options={filteredCats.map(c => ({ label: c.name, value: c.category_id }))}
        value={categoryId}
        onSelect={setCategoryId}
        allowNull
      />

      <Text style={styles.fieldLabel}>{t.expenses.account}</Text>
      <Dropdown
        options={accounts.map(a => ({ label: a.name, value: a.account_id }))}
        value={accountId}
        onSelect={setAccountId}
        allowNull
      />

      <Text style={styles.fieldLabel}>{t.expenses.notes}</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        placeholder={t.expenses.notesPlaceholder}
        multiline
        numberOfLines={3}
        placeholderTextColor="#C7C7CC"
      />

      <Pressable style={styles.btnSave} onPress={handleSave}>
        <Text style={styles.btnSaveText}>{t.common.save}</Text>
      </Pressable>

      <Pressable style={styles.btnDelete} onPress={handleDelete}>
        <Text style={styles.btnDeleteText}>{t.common.delete}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 48 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 20 },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#C7C7CC', alignItems: 'center', backgroundColor: '#F9F9F9',
  },
  typeChipExpense: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  typeChipIncome: { backgroundColor: '#34C759', borderColor: '#34C759' },
  typeChipText: { fontSize: 15, color: '#333', fontWeight: '500' },
  typeChipTextActive: { color: '#fff', fontWeight: '700' },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 6 },
  required: { color: '#FF3B30' },
  input: {
    borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 16, color: '#000', backgroundColor: '#F9F9F9',
  },
  textArea: { height: 80, textAlignVertical: 'top' },

  btnSave: {
    marginTop: 28, backgroundColor: '#007AFF',
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
  },
  btnSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDelete: {
    marginTop: 12, backgroundColor: '#fff',
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FF3B30',
  },
  btnDeleteText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
});
