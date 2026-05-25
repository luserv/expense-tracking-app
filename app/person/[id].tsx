/**
 * Detalle de persona / préstamos — Segato (dark theme + responsive)
 */
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Loan, Payment, Person, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { CONTENT_MAX_W, FORM_MAX_W, useLayout } from '../../utils/responsive';
import { C, F, R, S, shadow } from '../../utils/theme';

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
  const l = useLayout();
  const isWide = !l.isPhone;

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

  // Loan modal handlers
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

  // Payment modal handlers
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

  const previewAmt = parseFloat(amount.replace(',', '.')) || 0;
  const previewRate = parseFloat(interestRate.replace(',', '.')) || 0;
  const previewInterest = previewAmt * (previewRate / 100);
  const previewTotal = previewAmt + previewInterest;
  const showPreview = previewAmt > 0 && previewRate > 0;

  const totalLoaned  = loans.reduce((s, l) => s + calcTotal(l.amount, l.interest_rate), 0);
  const totalAbonado = loans.reduce((s, l) => s + (l.total_paid ?? 0), 0);
  const totalPending = loans
    .filter(l => l.is_paid === 0)
    .reduce((s, l) => s + Math.max(0, calcTotal(l.amount, l.interest_rate) - (l.total_paid ?? 0)), 0);

  const fmt = (n: number) => '$' + n.toFixed(2);

  // Shared modal styles
  const overlayStyle = [s.overlay, isWide && s.overlayDesktop];
  const sheetStyle   = [s.sheet, isWide && s.sheetDesktop];

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Summary */}
      <View style={[s.summaryCard, l.isDesktop && { maxWidth: CONTENT_MAX_W, alignSelf: 'center', width: '100%', marginHorizontal: 0 }]}>
        <View style={s.summaryItem}>
          <Text style={s.summaryLabel}>{t.loans.totalLoaned}</Text>
          <Text style={[s.summaryValue, { color: C.accent }]}>{fmt(totalLoaned)}</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryLabel}>{t.loans.totalPaid}</Text>
          <Text style={[s.summaryValue, { color: C.income }]}>{fmt(totalAbonado)}</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryLabel}>{t.loans.outstanding}</Text>
          <Text style={[s.summaryValue, { color: totalPending > 0 ? C.warn : C.income }]}>
            {fmt(totalPending)}
          </Text>
        </View>
      </View>

      <FlatList
        data={loans}
        keyExtractor={item => item.loan_id}
        contentContainerStyle={[s.listContent, l.isDesktop && { maxWidth: CONTENT_MAX_W, width: '100%', alignSelf: 'center' }]}
        renderItem={({ item }) => {
          const total = calcTotal(item.amount, item.interest_rate);
          const outstanding = Math.max(0, total - (item.total_paid ?? 0));
          const hasInterest = item.interest_rate > 0;
          const isPaid = item.is_paid === 1 || outstanding <= 0;
          const loanPayments = payments[item.loan_id] ?? [];
          const isExpanded = expandedLoan === item.loan_id;

          return (
            <View style={[s.loanCard, isPaid && s.loanCardPaid]}>
              {/* Paid indicator strip — top border accent instead of side stripe */}
              {isPaid && <View style={s.paidTopStrip} />}

              {/* Header */}
              <View style={s.loanHeader}>
                <View style={[s.loanStatusDot, { backgroundColor: isPaid ? C.income + '22' : C.warn + '22' }]}>
                  <View style={[s.loanStatusDotInner, { backgroundColor: isPaid ? C.income : C.warn }]} />
                </View>
                <View style={s.loanInfo}>
                  <Text style={s.loanDesc}>{item.description}</Text>
                  <Text style={s.loanDate}>{isoToDisplay(item.date)}</Text>
                  {hasInterest && (
                    <Text style={s.interestLabel}>
                      {item.interest_rate}% → {fmt(item.amount)} × 0.{String(item.interest_rate).replace('.', '')} = {fmt(item.amount * item.interest_rate / 100)}
                    </Text>
                  )}
                </View>
                <View style={s.loanRight}>
                  <Text style={s.loanAmountOriginal}>{fmt(item.amount)}</Text>
                  {hasInterest && (
                    <Text style={s.loanTotal}>{t.loans.estimatedTotal}: {fmt(total)}</Text>
                  )}
                  {(item.total_paid ?? 0) > 0 && (
                    <Text style={[s.loanPaidAmount, { color: C.income }]}>{t.loans.totalPaid}: {fmt(item.total_paid ?? 0)}</Text>
                  )}
                  <Text style={[s.loanOutstanding, { color: isPaid ? C.income : C.warn }]}>
                    {t.loans.outstanding}: {fmt(outstanding)}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={s.loanActions}>
                <Pressable style={[s.actionChip, { backgroundColor: C.incomeBg, borderColor: C.income + '44' }]} onPress={() => openPaymentModal(item)}>
                  <Text style={[s.actionChipText, { color: C.income }]}>+ {t.loans.payment}</Text>
                </Pressable>
                <Pressable style={[s.actionChip, { backgroundColor: C.surfaceUp, borderColor: C.border }]} onPress={() => toggleExpand(item.loan_id)}>
                  {isExpanded
                    ? <ChevronUp size={13} color={C.textSec} strokeWidth={2.5} />
                    : <ChevronDown size={13} color={C.textSec} strokeWidth={2.5} />
                  }
                  <Text style={[s.actionChipText, { color: C.textSec }]}>{t.loans.payments}</Text>
                </Pressable>
                <Pressable style={[s.actionChip, { backgroundColor: C.accentBg, borderColor: C.accent + '44' }]} onPress={() => openEditLoan(item)}>
                  <Text style={[s.actionChipText, { color: C.accent }]}>{t.common.edit}</Text>
                </Pressable>
                <Pressable style={[s.actionChip, { backgroundColor: isPaid ? C.surfaceUp : C.incomeBg, borderColor: isPaid ? C.border : C.income + '44' }]} onPress={() => handleTogglePaid(item)}>
                  <Text style={[s.actionChipText, { color: isPaid ? C.textSec : C.income }]}>
                    {isPaid ? t.loans.markPending : t.loans.markPaid}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteLoan(item)} hitSlop={8}>
                  <Trash2 size={15} color={C.expense} />
                </Pressable>
              </View>

              {/* Payments list */}
              {isExpanded && (
                <View style={s.paymentsList}>
                  {loanPayments.length === 0 ? (
                    <Text style={s.noPaymentsText}>{t.loans.noPayments}</Text>
                  ) : (
                    loanPayments.map(pay => (
                      <View key={pay.payment_id} style={s.paymentRow}>
                        <View style={[s.paymentDot, { backgroundColor: C.income }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.paymentDate}>{isoToDisplay(pay.date)}</Text>
                          {pay.notes ? <Text style={s.paymentNotes}>{pay.notes}</Text> : null}
                        </View>
                        <Text style={[s.paymentAmount, { color: C.income }]}>+{fmt(pay.amount)}</Text>
                        <Pressable onPress={() => handleDeletePayment(pay, item.loan_id)} hitSlop={8} style={{ paddingLeft: 8 }}>
                          <Trash2 size={13} color={C.textDim} />
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
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>{t.loans.emptyLoans}</Text>
          </View>
        )}
      />

      <Pressable style={[s.fab, isWide && s.fabWide]} onPress={openCreateLoan}>
        <Plus size={24} color="#fff" strokeWidth={2.5} />
      </Pressable>

      {/* Loan modal */}
      <Modal animationType="slide" transparent visible={!!loanModal} onRequestClose={() => setLoanModal(null)}>
        <View style={overlayStyle}>
          <View style={sheetStyle}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>
              {loanModal?.mode === 'edit' ? t.common.edit : t.loans.addLoan}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.sheetContent}>
                <Text style={s.fieldLabel}>{t.loans.description} <Text style={{ color: C.expense }}>*</Text></Text>
                <TextInput style={s.input} placeholder={t.loans.descriptionPlaceholder}
                  value={desc} onChangeText={setDesc} placeholderTextColor={C.textDim} />

                <Text style={s.fieldLabel}>{t.loans.amount} <Text style={{ color: C.expense }}>*</Text></Text>
                <TextInput style={s.input} placeholder="0.00" value={amount}
                  onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={C.textDim} />

                <Text style={s.fieldLabel}>{t.loans.date} <Text style={{ color: C.expense }}>*</Text></Text>
                <TextInput style={s.input} placeholder={t.expenses.datePlaceholder} value={date}
                  onChangeText={v => formatDateInput(v, setDate)}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} maxLength={10} placeholderTextColor={C.textDim} />

                <Text style={s.fieldLabel}>{t.loans.interestRate}</Text>
                <TextInput style={s.input} placeholder="0" value={interestRate}
                  onChangeText={setInterestRate} keyboardType="decimal-pad" placeholderTextColor={C.textDim} />
                <Text style={s.interestHint}>
                  {previewAmt > 0 && previewRate > 0
                    ? `${fmt(previewAmt)} × ${previewRate}% = ${fmt(previewInterest)} de interés`
                    : `Ej: $1000 × 10% → $100 de interés`}
                </Text>

                {showPreview && (
                  <View style={s.previewBox}>
                    <Text style={s.previewLabel}>{t.loans.estimatedTotal}</Text>
                    <Text style={[s.previewValue, { color: C.warn }]}>{fmt(previewTotal)}</Text>
                    <Text style={s.previewDetail}>{fmt(previewAmt)} + {fmt(previewInterest)} de interés</Text>
                  </View>
                )}

                <View style={s.btnRow}>
                  <Pressable style={[s.btn, s.btnCancel]} onPress={() => setLoanModal(null)}>
                    <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                  </Pressable>
                  <Pressable style={[s.btn, s.btnSave]} onPress={handleSaveLoan}>
                    <Text style={s.btnSaveText}>{t.common.save}</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment modal */}
      <Modal animationType="slide" transparent visible={!!paymentModal} onRequestClose={() => setPaymentModal(null)}>
        <View style={overlayStyle}>
          <View style={sheetStyle}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{t.loans.addPayment}</Text>
            <View style={s.sheetContent}>
              {paymentModal && (
                <View style={s.paymentContext}>
                  <Text style={s.paymentContextLoan}>{paymentModal.loan.description}</Text>
                  <Text style={[s.paymentContextBalance, { color: C.warn }]}>
                    {t.loans.outstanding}: {fmt(Math.max(0, calcTotal(paymentModal.loan.amount, paymentModal.loan.interest_rate) - (paymentModal.loan.total_paid ?? 0)))}
                  </Text>
                </View>
              )}
              <Text style={s.fieldLabel}>{t.loans.paymentAmount} <Text style={{ color: C.expense }}>*</Text></Text>
              <TextInput style={s.input} placeholder="0.00" value={payAmount}
                onChangeText={setPayAmount} keyboardType="decimal-pad" placeholderTextColor={C.textDim} />

              <Text style={s.fieldLabel}>{t.loans.date} <Text style={{ color: C.expense }}>*</Text></Text>
              <TextInput style={s.input} placeholder={t.expenses.datePlaceholder} value={payDate}
                onChangeText={v => formatDateInput(v, setPayDate)}
                keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} maxLength={10} placeholderTextColor={C.textDim} />

              <Text style={s.fieldLabel}>{t.expenses.notes}</Text>
              <TextInput style={[s.input, s.textArea]} placeholder={t.expenses.notesPlaceholder}
                value={payNotes} onChangeText={setPayNotes} multiline placeholderTextColor={C.textDim} />

              <View style={s.btnRow}>
                <Pressable style={[s.btn, s.btnCancel]} onPress={() => setPaymentModal(null)}>
                  <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={[s.btn, { backgroundColor: C.income }]} onPress={handleSavePayment}>
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
  summaryLabel: { fontSize: F.xs, color: C.textDim, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, textAlign: 'center' },
  summaryValue: { fontSize: F.lg, fontWeight: '800' },

  listContent: { paddingHorizontal: S.lg, paddingTop: S.xs, paddingBottom: 100, gap: S.sm },
  emptyContainer: { alignItems: 'center', marginTop: 64 },
  emptyText: { fontSize: F.base, color: C.textDim },

  loanCard: {
    backgroundColor: C.surface, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  loanCardPaid: { borderColor: C.income + '33' },

  // Top accent strip on paid loans (replaces banned left-stripe)
  paidTopStrip: { height: 2, backgroundColor: C.income + '66' },

  loanHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: S.md, gap: S.sm },
  loanStatusDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  loanStatusDotInner: { width: 8, height: 8, borderRadius: 4 },
  loanInfo: { flex: 1 },
  loanDesc: { fontSize: F.base, fontWeight: '600', color: C.text },
  loanDate: { fontSize: F.xs, color: C.textDim, marginTop: 2 },
  interestLabel: { fontSize: F.xs, color: C.textSec, marginTop: 3 },
  loanRight: { alignItems: 'flex-end', gap: 2 },
  loanAmountOriginal: { fontSize: F.base, fontWeight: '700', color: C.text },
  loanTotal: { fontSize: F.xs, color: C.textSec },
  loanPaidAmount: { fontSize: F.xs, fontWeight: '600' },
  loanOutstanding: { fontSize: F.md, fontWeight: '800' },

  loanActions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center',
    paddingHorizontal: S.md, paddingVertical: S.sm,
    borderTopWidth: 1, borderTopColor: C.borderFaint,
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: R.sm, borderWidth: 1,
  },
  actionChipText: { fontSize: F.xs, fontWeight: '700' },

  paymentsList: {
    backgroundColor: C.surfaceUp, borderTopWidth: 1, borderTopColor: C.borderFaint,
    paddingHorizontal: S.md, paddingVertical: S.sm, gap: S.xs,
  },
  noPaymentsText: { fontSize: F.sm, color: C.textDim, textAlign: 'center', paddingVertical: 4 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: 4 },
  paymentDot: { width: 6, height: 6, borderRadius: 3 },
  paymentDate: { fontSize: F.sm, color: C.text, fontWeight: '500' },
  paymentNotes: { fontSize: F.xs, color: C.textSec },
  paymentAmount: { fontSize: F.sm, fontWeight: '700' },

  fab: {
    position: 'absolute', right: 20, bottom: 28,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.lg,
  },
  fabWide: { right: 32, bottom: 32 },

  // Sheet modals
  overlay: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end' },
  overlayDesktop: { justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    paddingTop: 12,
    borderTopWidth: 1, borderColor: C.border,
    maxHeight: '85%',
  },
  sheetDesktop: { borderRadius: R.xl, maxWidth: FORM_MAX_W, width: '100%', borderWidth: 1, maxHeight: '90%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: F.lg, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 4, paddingHorizontal: 24 },
  sheetContent: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },

  paymentContext: {
    backgroundColor: C.surfaceUp, borderRadius: R.sm, padding: S.md, marginBottom: S.xs,
    borderWidth: 1, borderColor: C.border,
  },
  paymentContextLoan: { fontSize: F.sm, fontWeight: '600', color: C.text },
  paymentContextBalance: { fontSize: F.sm, fontWeight: '700', marginTop: 2 },

  interestHint: { fontSize: F.xs, color: C.textSec, marginTop: 6, fontStyle: 'italic' },
  previewBox: {
    marginTop: S.md, backgroundColor: C.warnBg, borderRadius: R.sm,
    padding: S.md, alignItems: 'center', borderWidth: 1, borderColor: C.warn + '44',
  },
  previewLabel: { fontSize: F.xs, color: C.textSec, marginBottom: 4 },
  previewValue: { fontSize: F.xl, fontWeight: '800' },
  previewDetail: { fontSize: F.xs, color: C.textSec, marginTop: 4 },

  fieldLabel: { fontSize: F.sm, fontWeight: '600', color: C.textSec, marginTop: S.lg, marginBottom: 6 },
  input: {
    backgroundColor: C.surfaceUp, borderWidth: 1, borderColor: C.border,
    borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: F.base, color: C.text,
  },
  textArea: { height: 70, textAlignVertical: 'top', paddingTop: 10 },
  btnRow: { flexDirection: 'row', gap: S.sm, marginTop: S.xl },
  btn: { flex: 1, paddingVertical: 14, borderRadius: R.sm, alignItems: 'center' },
  btnCancel: { backgroundColor: C.surfaceUp },
  btnSave: { backgroundColor: C.accent },
  btnCancelText: { fontSize: F.base, fontWeight: '600', color: C.textSec },
  btnSaveText: { fontSize: F.base, fontWeight: '700', color: '#fff' },
});
