import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { Loan, Payment, Person, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';

function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function displayToIso(display: string): string {
  const parts = display.split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function calcTotal(amount: number, rate: number): number {
  if (!rate || rate <= 0) return amount;
  return amount + amount * (rate / 100);
}

type LoanModal = { mode: 'create' } | { mode: 'edit'; loan: Loan };
type PaymentModal = { loan: Loan };

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { t } = useI18n();
  const { getPerson, getLoansByPerson, createLoan, updateLoan, updateLoanPaid, deleteLoan,
          getPaymentsByLoan, createPayment, deletePayment } = useExpenses();

  const [person, setPerson] = useState<Person | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment[]>>({});
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  // Loan modal
  const [loanModal, setLoanModal] = useState<LoanModal | null>(null);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [interestRate, setInterestRate] = useState('');

  // Payment modal
  const [paymentModal, setPaymentModal] = useState<PaymentModal | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const [p, ls] = await Promise.all([getPerson(id), getLoansByPerson(id)]);
    setPerson(p);
    setLoans(ls);
    if (p) navigation.setOptions({ title: p.name });
  }, [id, getPerson, getLoansByPerson, navigation]);

  useEffect(() => { load(); }, [load]);

  const loadPayments = async (loanId: string) => {
    const ps = await getPaymentsByLoan(loanId);
    setPayments(prev => ({ ...prev, [loanId]: ps }));
  };

  const toggleExpand = async (loanId: string) => {
    if (expandedLoan === loanId) {
      setExpandedLoan(null);
    } else {
      setExpandedLoan(loanId);
      await loadPayments(loanId);
    }
  };

  const formatDateInput = (text: string, setter: (v: string) => void) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setter(formatted);
  };

  // ── Loan modal ──────────────────────────────────────────────────────────────

  const openCreateLoan = () => {
    setDesc(''); setAmount(''); setDate(isoToDisplay(todayIso())); setInterestRate('');
    setLoanModal({ mode: 'create' });
  };

  const openEditLoan = (loan: Loan) => {
    setDesc(loan.description);
    setAmount(String(loan.amount));
    setDate(isoToDisplay(loan.date));
    setInterestRate(loan.interest_rate > 0 ? String(loan.interest_rate) : '');
    setLoanModal({ mode: 'edit', loan });
  };

  const handleSaveLoan = async () => {
    if (!desc.trim()) { alert(t.loans.descriptionRequired); return; }
    const amt = parseFloat(amount.replace(',', '.'));
    if (!amt || amt <= 0) { alert(t.loans.amountRequired); return; }
    const isoDate = displayToIso(date);
    if (!isoDate) { alert(t.loans.dateRequired); return; }
    const rate = parseFloat(interestRate.replace(',', '.')) || 0;
    const data = { description: desc.trim(), amount: amt, date: isoDate,
                   interest_rate: rate, interest_type: 'simple' as const, months: 1 };
    if (loanModal?.mode === 'edit') {
      await updateLoan(loanModal.loan.loan_id, data);
    } else {
      await createLoan({ person_id: id!, ...data });
    }
    setLoanModal(null);
    await load();
  };

  const handleDeleteLoan = (loan: Loan) => {
    const doDelete = async () => { await deleteLoan(loan.loan_id); await load(); };
    if (Platform.OS === 'web') {
      if (confirm(t.loans.deleteConfirm)) doDelete();
    } else {
      Alert.alert(t.common.delete, t.loans.deleteConfirm, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.delete, style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleTogglePaid = async (loan: Loan) => {
    await updateLoanPaid(loan.loan_id, loan.is_paid === 0);
    await load();
  };

  // ── Payment modal ───────────────────────────────────────────────────────────

  const openPaymentModal = (loan: Loan) => {
    setPayAmount(''); setPayDate(isoToDisplay(todayIso())); setPayNotes('');
    setPaymentModal({ loan });
  };

  const handleSavePayment = async () => {
    if (!paymentModal) return;
    const amt = parseFloat(payAmount.replace(',', '.'));
    if (!amt || amt <= 0) { alert(t.loans.amountRequired); return; }
    const isoDate = displayToIso(payDate);
    if (!isoDate) { alert(t.loans.dateRequired); return; }
    await createPayment({
      loan_id: paymentModal.loan.loan_id,
      amount: amt,
      date: isoDate,
      notes: payNotes.trim() || null,
    });
    setPaymentModal(null);
    await load();
    await loadPayments(paymentModal.loan.loan_id);
    if (expandedLoan !== paymentModal.loan.loan_id) setExpandedLoan(paymentModal.loan.loan_id);
  };

  const handleDeletePayment = (pay: Payment, loanId: string) => {
    const doDelete = async () => {
      await deletePayment(pay.payment_id);
      await load();
      await loadPayments(loanId);
    };
    if (Platform.OS === 'web') {
      if (confirm(t.loans.deleteConfirm)) doDelete();
    } else {
      Alert.alert(t.common.delete, t.loans.deleteConfirm, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.delete, style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const previewAmt = parseFloat(amount.replace(',', '.')) || 0;
  const previewRate = parseFloat(interestRate.replace(',', '.')) || 0;
  const previewInterest = previewAmt * (previewRate / 100);
  const previewTotal = previewAmt + previewInterest;
  const showPreview = previewAmt > 0 && previewRate > 0;

  const totalLoaned = loans.reduce((s, l) => s + calcTotal(l.amount, l.interest_rate), 0);
  const totalAbonado = loans.reduce((s, l) => s + l.total_paid, 0);
  const totalPending = loans
    .filter(l => l.is_paid === 0)
    .reduce((s, l) => s + Math.max(0, calcTotal(l.amount, l.interest_rate) - l.total_paid), 0);

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t.loans.totalLoaned}</Text>
          <Text style={[styles.summaryValue, styles.loanedColor]}>${totalLoaned.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t.loans.totalPaid}</Text>
          <Text style={[styles.summaryValue, styles.paidColor]}>${totalAbonado.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t.loans.outstanding}</Text>
          <Text style={[styles.summaryValue, totalPending > 0 ? styles.pendingColor : styles.paidColor]}>
            ${totalPending.toFixed(2)}
          </Text>
        </View>
      </View>

      <FlatList
        data={loans}
        keyExtractor={item => item.loan_id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const total = calcTotal(item.amount, item.interest_rate);
          const outstanding = Math.max(0, total - item.total_paid);
          const hasInterest = item.interest_rate > 0;
          const isPaid = item.is_paid === 1 || outstanding <= 0;
          const loanPayments = payments[item.loan_id] ?? [];
          const isExpanded = expandedLoan === item.loan_id;

          return (
            <View style={styles.loanCard}>
              {/* Header row */}
              <View style={styles.loanRow}>
                <View style={[styles.statusBar, { backgroundColor: isPaid ? '#34C759' : '#FF9500' }]} />
                <View style={styles.loanInfo}>
                  <Text style={styles.loanDesc}>{item.description}</Text>
                  <Text style={styles.loanDate}>{isoToDisplay(item.date)}</Text>
                  {hasInterest && (
                    <Text style={styles.interestLabel}>
                      {item.interest_rate}% → ${item.amount.toFixed(2)} × 0.{String(item.interest_rate).replace('.', '')} = ${(item.amount * item.interest_rate / 100).toFixed(2)}
                    </Text>
                  )}
                </View>
                <View style={styles.loanRight}>
                  <Text style={styles.loanAmountOriginal}>${item.amount.toFixed(2)}</Text>
                  {hasInterest && (
                    <Text style={styles.loanTotal}>{t.loans.estimatedTotal}: ${total.toFixed(2)}</Text>
                  )}
                  {item.total_paid > 0 && (
                    <Text style={styles.loanPaidAmount}>{t.loans.totalPaid}: ${item.total_paid.toFixed(2)}</Text>
                  )}
                  <Text style={[styles.loanOutstanding, isPaid ? styles.paidColor : styles.pendingColor]}>
                    {t.loans.outstanding}: ${outstanding.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.loanActions}>
                <Pressable style={styles.abonoBtn} onPress={() => openPaymentModal(item)}>
                  <Text style={styles.abonoBtnText}>+ {t.loans.payment}</Text>
                </Pressable>
                <Pressable
                  style={styles.expandBtn}
                  onPress={() => toggleExpand(item.loan_id)}
                >
                  <Text style={styles.expandBtnText}>
                    {t.loans.payments} {isExpanded ? '▲' : '▼'}
                  </Text>
                </Pressable>
                <Pressable style={styles.editBtn} onPress={() => openEditLoan(item)}>
                  <Text style={styles.editBtnText}>{t.common.edit}</Text>
                </Pressable>
                {!isPaid && (
                  <Pressable style={styles.markPaidBtn} onPress={() => handleTogglePaid(item)}>
                    <Text style={styles.markPaidText}>{t.loans.markPaid}</Text>
                  </Pressable>
                )}
                {isPaid && item.is_paid === 1 && (
                  <Pressable style={styles.markPaidBtn} onPress={() => handleTogglePaid(item)}>
                    <Text style={styles.markPaidText}>{t.loans.markPending}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => handleDeleteLoan(item)}>
                  <Text style={styles.deleteBtnText}>{t.common.delete}</Text>
                </Pressable>
              </View>

              {/* Payments list */}
              {isExpanded && (
                <View style={styles.paymentsList}>
                  {loanPayments.length === 0 ? (
                    <Text style={styles.noPaymentsText}>{t.loans.noPayments}</Text>
                  ) : (
                    loanPayments.map(pay => (
                      <View key={pay.payment_id} style={styles.paymentRow}>
                        <View style={styles.paymentDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paymentDate}>{isoToDisplay(pay.date)}</Text>
                          {pay.notes ? <Text style={styles.paymentNotes}>{pay.notes}</Text> : null}
                        </View>
                        <Text style={styles.paymentAmount}>+${pay.amount.toFixed(2)}</Text>
                        <Pressable onPress={() => handleDeletePayment(pay, item.loan_id)} hitSlop={8} style={{ paddingLeft: 8 }}>
                          <Text style={styles.deleteBtnText}>✕</Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t.loans.emptyLoans}</Text>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={openCreateLoan}>
        <Plus size={24} color="#fff" />
      </Pressable>

      {/* Loan modal */}
      <Modal animationType="slide" transparent visible={!!loanModal} onRequestClose={() => setLoanModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {loanModal?.mode === 'edit' ? t.common.edit : t.loans.addLoan}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>{t.loans.description} <Text style={styles.required}>{t.common.required}</Text></Text>
              <TextInput style={styles.input} placeholder={t.loans.descriptionPlaceholder}
                value={desc} onChangeText={setDesc} placeholderTextColor="#C7C7CC" />

              <Text style={styles.fieldLabel}>{t.loans.amount} <Text style={styles.required}>{t.common.required}</Text></Text>
              <TextInput style={styles.input} placeholder="0.00" value={amount}
                onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor="#C7C7CC" />

              <Text style={styles.fieldLabel}>{t.loans.date} <Text style={styles.required}>{t.common.required}</Text></Text>
              <TextInput style={styles.input} placeholder={t.expenses.datePlaceholder} value={date}
                onChangeText={v => formatDateInput(v, setDate)}
                keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} maxLength={10} placeholderTextColor="#C7C7CC" />

              <Text style={styles.fieldLabel}>{t.loans.interestRate}</Text>
              <TextInput style={styles.input} placeholder="0" value={interestRate}
                onChangeText={setInterestRate} keyboardType="decimal-pad" placeholderTextColor="#C7C7CC" />
              <Text style={styles.interestHint}>
                {previewAmt > 0 && previewRate > 0
                  ? `$${previewAmt.toFixed(2)} × ${previewRate}% = $${previewInterest.toFixed(2)} de interés`
                  : `Ej: $1000 × 10% → $1000 × 0.10 = $100 de interés`}
              </Text>

              {showPreview && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>{t.loans.estimatedTotal}</Text>
                  <Text style={styles.previewValue}>${previewTotal.toFixed(2)}</Text>
                  <Text style={styles.previewDetail}>${previewAmt.toFixed(2)} + ${previewInterest.toFixed(2)} de interés</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.buttonContainer}>
              <Pressable style={[styles.button, styles.buttonCancel]} onPress={() => setLoanModal(null)}>
                <Text style={styles.textCancel}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonSave]} onPress={handleSaveLoan}>
                <Text style={styles.textSave}>{t.common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment modal */}
      <Modal animationType="slide" transparent visible={!!paymentModal} onRequestClose={() => setPaymentModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t.loans.addPayment}</Text>
            {paymentModal && (
              <View style={styles.paymentContext}>
                <Text style={styles.paymentContextLoan}>{paymentModal.loan.description}</Text>
                <Text style={styles.paymentContextBalance}>
                  {t.loans.outstanding}: ${Math.max(0, calcTotal(paymentModal.loan.amount, paymentModal.loan.interest_rate) - paymentModal.loan.total_paid).toFixed(2)}
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>{t.loans.paymentAmount} <Text style={styles.required}>{t.common.required}</Text></Text>
            <TextInput style={styles.input} placeholder="0.00" value={payAmount}
              onChangeText={setPayAmount} keyboardType="decimal-pad" placeholderTextColor="#C7C7CC" />

            <Text style={styles.fieldLabel}>{t.loans.date} <Text style={styles.required}>{t.common.required}</Text></Text>
            <TextInput style={styles.input} placeholder={t.expenses.datePlaceholder} value={payDate}
              onChangeText={v => formatDateInput(v, setPayDate)}
              keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} maxLength={10} placeholderTextColor="#C7C7CC" />

            <Text style={styles.fieldLabel}>{t.expenses.notes}</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder={t.expenses.notesPlaceholder}
              value={payNotes} onChangeText={setPayNotes} multiline placeholderTextColor="#C7C7CC" />

            <View style={styles.buttonContainer}>
              <Pressable style={[styles.button, styles.buttonCancel]} onPress={() => setPaymentModal(null)}>
                <Text style={styles.textCancel}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonSave]} onPress={handleSavePayment}>
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
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  summaryCard: {
    flexDirection: 'row',
    marginHorizontal: 16, marginTop: 16, marginBottom: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#E5E5EA', marginVertical: 2 },
  summaryLabel: { fontSize: 11, color: '#8E8E93', marginBottom: 4, textAlign: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  loanedColor: { color: '#007AFF' },
  pendingColor: { color: '#FF9500' },
  paidColor: { color: '#34C759' },

  listContent: { paddingBottom: 100, paddingHorizontal: 16, gap: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: '#8E8E93' },

  loanCard: {
    backgroundColor: '#fff', borderRadius: 14,
    overflow: 'hidden',
  },
  loanRow: { flexDirection: 'row', padding: 14 },
  statusBar: { width: 4, borderRadius: 2, marginRight: 12, alignSelf: 'stretch', minHeight: 40 },
  loanInfo: { flex: 1 },
  loanDesc: { fontSize: 15, fontWeight: '600', color: '#000' },
  loanDate: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  interestLabel: { fontSize: 11, color: '#8E8E93', marginTop: 3 },
  loanRight: { alignItems: 'flex-end', gap: 2 },
  loanAmountOriginal: { fontSize: 15, fontWeight: '600', color: '#333' },
  loanTotal: { fontSize: 11, color: '#8E8E93' },
  loanPaidAmount: { fontSize: 11, color: '#34C759', fontWeight: '600' },
  loanOutstanding: { fontSize: 16, fontWeight: '800' },

  loanActions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F2F2F7',
    paddingTop: 10,
  },
  abonoBtn: { backgroundColor: '#34C759', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  abonoBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  expandBtn: { backgroundColor: '#F2F2F7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  expandBtnText: { fontSize: 12, fontWeight: '600', color: '#333' },
  editBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  editBtnText: { fontSize: 12, fontWeight: '600', color: '#007AFF' },
  markPaidBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  markPaidText: { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  deleteBtnText: { fontSize: 12, fontWeight: '600', color: '#FF3B30' },

  paymentsList: {
    backgroundColor: '#F9F9F9', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA',
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
  },
  noPaymentsText: { fontSize: 13, color: '#8E8E93', textAlign: 'center', paddingVertical: 4 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paymentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' },
  paymentDate: { fontSize: 13, color: '#333', fontWeight: '500' },
  paymentNotes: { fontSize: 11, color: '#8E8E93' },
  paymentAmount: { fontSize: 13, fontWeight: '700', color: '#34C759' },

  fab: {
    position: 'absolute', right: 16, bottom: 32,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 16 },

  paymentContext: {
    backgroundColor: '#F2F2F7', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  paymentContextLoan: { fontSize: 14, fontWeight: '600', color: '#000' },
  paymentContextBalance: { fontSize: 13, color: '#FF9500', fontWeight: '700', marginTop: 2 },

  interestHint: { fontSize: 12, color: '#8E8E93', marginTop: 6, fontStyle: 'italic' },
  previewBox: {
    marginTop: 16, backgroundColor: '#FFF3E0', borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FFE0B2',
  },
  previewLabel: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  previewValue: { fontSize: 22, fontWeight: '800', color: '#FF9500' },
  previewDetail: { fontSize: 12, color: '#8E8E93', marginTop: 4 },

  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 14, marginBottom: 6 },
  required: { color: '#FF3B30' },
  input: {
    borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: '#000', backgroundColor: '#F9F9F9',
  },
  textArea: { height: 70, textAlignVertical: 'top' },

  buttonContainer: { flexDirection: 'row', gap: 10, marginTop: 20 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  buttonCancel: { backgroundColor: '#E5E5EA' },
  buttonSave: { backgroundColor: '#007AFF' },
  textCancel: { fontSize: 16, fontWeight: '600', color: '#000' },
  textSave: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
