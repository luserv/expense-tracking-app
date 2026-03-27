import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AdBanner from '../../components/AdBanner';
import Dropdown from '../../components/Dropdown';
import { Account, Category, Expense, LoanWithPerson, MonthSummary, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';

const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const SHORT_MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type ListItem =
  | { kind: 'expense'; data: Expense }
  | { kind: 'loan'; data: LoanWithPerson };

function calcTotal(amount: number, rate: number): number {
  if (!rate || rate <= 0) return amount;
  return amount + amount * (rate / 100);
}

function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

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

export default function HomeScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<MonthSummary>({ income: 0, expense: 0, balance: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [monthLoans, setMonthLoans] = useState<LoanWithPerson[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { expenses, fetchExpenses, createExpense, getCategories, getAccounts, getMonthSummary, searchExpenses, getLoansForMonth } = useExpenses();
  const { t, lang } = useI18n();
  const router = useRouter();

  const MONTH_NAMES = lang === 'es' ? MONTH_NAMES_ES : MONTH_NAMES_EN;
  const SHORT_MONTHS = lang === 'es' ? SHORT_MONTHS_ES : SHORT_MONTHS_EN;

  const load = useCallback(async () => {
    const [s, loans] = await Promise.all([
      getMonthSummary(year, month),
      getLoansForMonth(year, month),
    ]);
    await fetchExpenses(year, month);
    setSummary(s);
    setMonthLoans(loans);
  }, [year, month, fetchExpenses, getMonthSummary, getLoansForMonth]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      searchExpenses(trimmed).then(setSearchResults);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, searchExpenses]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const handleOpenModal = async () => {
    const [cats, accs] = await Promise.all([getCategories(), getAccounts()]);
    setCategories(cats);
    setAccounts(accs);
    setDesc('');
    setAmount('');
    setDate(isoToDisplay(todayIso()));
    setType('expense');
    setCategoryId(null);
    setAccountId(null);
    setNotes('');
    setModalVisible(true);
  };

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
    await createExpense({
      description: desc.trim(),
      amount: amt,
      date: isoDate,
      type,
      category_id: categoryId,
      account_id: accountId,
      notes: notes.trim() || null,
    });
    setModalVisible(false);
    await load();
  };

  const getCategoryColor = (item: Expense) =>
    categories.find(c => c.category_id === item.category_id)?.color ?? '#8E8E93';

  const formatDisplayDate = (isoDate: string) => {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const d = parseInt(parts[2], 10);
    const m = parseInt(parts[1], 10);
    return lang === 'es' ? `${d} ${SHORT_MONTHS[m-1]}` : `${SHORT_MONTHS[m-1]} ${d}`;
  };

  // Merge expenses + loans sorted by date desc
  const buildDisplayList = (): ListItem[] => {
    const expItems: ListItem[] = expenses.map(e => ({ kind: 'expense', data: e }));
    const loanItems: ListItem[] = monthLoans.map(l => ({ kind: 'loan', data: l }));
    return [...expItems, ...loanItems].sort((a, b) => {
      const da = a.kind === 'expense' ? a.data.date : a.data.date;
      const db2 = b.kind === 'expense' ? b.data.date : b.data.date;
      return db2.localeCompare(da);
    });
  };

  const searchList: ListItem[] = searchResults.map(e => ({ kind: 'expense', data: e }));
  const displayList: ListItem[] = searchQuery.trim() ? searchList : buildDisplayList();

  const filteredCats = categories.filter(c => c.type === type);

  return (
    <View style={styles.container}>
      {/* Month selector */}
      <View style={styles.monthRow}>
        <Pressable onPress={prevMonth} style={styles.monthBtn}>
          <ChevronLeft size={22} color="#007AFF" />
        </Pressable>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month-1]} {year}</Text>
        <Pressable onPress={nextMonth} style={styles.monthBtn}>
          <ChevronRight size={22} color="#007AFF" />
        </Pressable>
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t.summary.income}</Text>
          <Text style={[styles.summaryValue, styles.incomeColor]}>${summary.income.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t.summary.expense}</Text>
          <Text style={[styles.summaryValue, styles.expenseColor]}>${summary.expense.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t.summary.balance}</Text>
          <Text style={[styles.summaryValue, summary.balance >= 0 ? styles.incomeColor : styles.expenseColor]}>
            ${summary.balance.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={18} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t.expenses.search}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#8E8E93"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <X size={18} color="#8E8E93" />
          </Pressable>
        )}
      </View>

      {/* List */}
      <View style={{ flex: 1 }}>
        <FlatList
          data={displayList}
          keyExtractor={item =>
            item.kind === 'expense' ? item.data.expense_id : item.data.loan_id
          }
          renderItem={({ item }) => {
            if (item.kind === 'loan') {
              const loan = item.data;
              const total = calcTotal(loan.amount, loan.interest_rate);
              const hasInterest = loan.interest_rate > 0;
              return (
                <Pressable
                  style={styles.expenseItem}
                  onPress={() => router.push(`/person/${loan.person_id}`)}
                >
                  <View style={[styles.dot, styles.loanDot]} />
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseDesc} numberOfLines={1}>{loan.description}</Text>
                    <Text style={styles.loanSubtitle}>
                      👤 {loan.person_name}
                      {loan.is_paid ? ` · ${t.loans.paid}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.expenseAmount, loan.is_paid ? styles.incomeColor : styles.loanColor]}>
                      ${loan.amount.toFixed(2)}
                    </Text>
                    {hasInterest && !loan.is_paid && (
                      <Text style={styles.loanTotalEstimated}>→ ${total.toFixed(2)}</Text>
                    )}
                  </View>
                </Pressable>
              );
            }
            const exp = item.data;
            return (
              <Pressable
                style={styles.expenseItem}
                onPress={() => router.push(`/expense/${exp.expense_id}`)}
              >
                <View style={[styles.dot, { backgroundColor: getCategoryColor(exp) }]} />
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseDesc} numberOfLines={1}>{exp.description}</Text>
                  <Text style={styles.expenseDate}>{formatDisplayDate(exp.date)}</Text>
                </View>
                <Text style={[styles.expenseAmount, exp.type === 'income' ? styles.incomeColor : styles.expenseColor]}>
                  {exp.type === 'income' ? '+' : '-'}${exp.amount.toFixed(2)}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t.expenses.empty}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
        <Pressable style={styles.fab} onPress={handleOpenModal}>
          <Plus size={24} color="#fff" />
        </Pressable>
      </View>

      <AdBanner />

      {/* Add Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t.expenses.newExpense}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>

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
                placeholder={t.expenses.descriptionPlaceholder}
                value={desc}
                onChangeText={setDesc}
                placeholderTextColor="#C7C7CC"
              />

              <Text style={styles.fieldLabel}>
                {t.expenses.amount} <Text style={styles.required}>{t.common.required}</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t.expenses.amountPlaceholder}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholderTextColor="#C7C7CC"
              />

              <Text style={styles.fieldLabel}>
                {t.expenses.date} <Text style={styles.required}>{t.common.required}</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t.expenses.datePlaceholder}
                value={date}
                onChangeText={formatDateInput}
                keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
                maxLength={10}
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
                placeholder={t.expenses.notesPlaceholder}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholderTextColor="#C7C7CC"
              />

            </ScrollView>

            <View style={styles.buttonContainer}>
              <Pressable style={[styles.button, styles.buttonCancel]} onPress={() => setModalVisible(false)}>
                <Text style={styles.textCancel}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonSave]} onPress={handleSave}>
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

  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  monthBtn: { padding: 4 },
  monthLabel: { fontSize: 17, fontWeight: '600', color: '#000' },

  summaryCard: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#F2F2F7', borderRadius: 14, padding: 16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryDivider: { width: 1, backgroundColor: '#D1D1D6', marginVertical: 4 },
  incomeColor: { color: '#34C759' },
  expenseColor: { color: '#FF3B30' },
  loanColor: { color: '#FF9500' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E5E5EA', borderRadius: 10,
    paddingHorizontal: 12, marginHorizontal: 16, marginBottom: 8, height: 40,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#000' },

  listContent: { paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: '#8E8E93' },

  expenseItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA',
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  loanDot: { backgroundColor: '#FF9500' },
  expenseInfo: { flex: 1 },
  expenseDesc: { fontSize: 16, color: '#000' },
  expenseDate: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  loanSubtitle: { fontSize: 12, color: '#FF9500', marginTop: 2 },
  loanTotalEstimated: { fontSize: 11, color: '#8E8E93', marginTop: 1 },
  expenseAmount: { fontSize: 16, fontWeight: '600' },

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
    padding: 24, maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 20 },

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

  buttonContainer: { flexDirection: 'row', gap: 10, marginTop: 20 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buttonCancel: { backgroundColor: '#E5E5EA' },
  buttonSave: { backgroundColor: '#007AFF' },
  textCancel: { fontSize: 16, fontWeight: '600', color: '#000' },
  textSave: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
