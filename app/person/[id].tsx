/**
 * Detalle de persona / préstamos — Segato (dark theme + responsive)
 */
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { DateField } from '../../components/DateField';
import { Installment, Loan, LoanFrequency, Person, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { buildLoanReportHtml, delayDays, exportLoanReport } from '../../utils/loanReport';
import { computeEffectiveAmounts } from '../../utils/repo/installments';
import { CONTENT_MAX_W, FORM_MAX_W, useLayout } from '../../utils/responsive';
import { C, F, R, S, shadow } from '../../utils/theme';

const FREQUENCIES: { value: LoanFrequency; es: string }[] = [
  { value: 'monthly', es: 'Mensual' },
  { value: 'biweekly', es: 'Quincenal' },
  { value: 'weekly', es: 'Semanal' },
];

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
type PayModal = { loan: Loan; inst: Installment; mode: 'pay' | 'edit'; cascadeFromId?: string; effectiveBalance?: number };

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { t } = useI18n();
  const { getPerson, getLoansByPerson, createLoan, updateLoan, deleteLoan,
          getInstallments, payInstallment, payInstallmentCascade, unpayInstallment } = useExpenses();
  const l = useLayout();
  const isWide = !l.isPhone;

  const [person, setPerson] = useState<Person | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<Record<string, Installment[]>>({});
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  // Loan modal
  const [loanModal, setLoanModal] = useState<LoanModal | null>(null);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [numInstallments, setNumInstallments] = useState('1');
  const [frequency, setFrequency] = useState<LoanFrequency>('monthly');
  const [firstDue, setFirstDue] = useState('');

  // Pay-installment modal
  const [payModal, setPayModal] = useState<PayModal | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const [p, ls] = await Promise.all([getPerson(id), getLoansByPerson(id)]);
    setPerson(p);
    setLoans(ls);
    if (p) navigation.setOptions({ title: p.name });
  }, [id, getPerson, getLoansByPerson, navigation]);

  useEffect(() => { load(); }, [load]);

  const loadInstallments = async (loanId: string) => {
    const ins = await getInstallments(loanId);
    setInstallments(prev => ({ ...prev, [loanId]: ins }));
  };

  const toggleExpand = async (loanId: string) => {
    if (expandedLoan === loanId) {
      setExpandedLoan(null);
    } else {
      setExpandedLoan(loanId);
      await loadInstallments(loanId);
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
    setDesc(''); setAmount(''); setDate(todayIso()); setInterestRate('');
    setNumInstallments('1'); setFrequency('monthly'); setFirstDue('');
    setLoanModal({ mode: 'create' });
  };

  const openEditLoan = (loan: Loan) => {
    setDesc(loan.description);
    setAmount(String(loan.amount));
    setDate(loan.date);
    setInterestRate(loan.interest_rate > 0 ? String(loan.interest_rate) : '');
    setNumInstallments(String(loan.months || 1));
    setFrequency(loan.frequency ?? 'monthly');
    setFirstDue(loan.first_due_date ?? '');
    setLoanModal({ mode: 'edit', loan });
  };

  const handleSaveLoan = async () => {
    if (!desc.trim()) { alert(t.loans.descriptionRequired); return; }
    const amt = parseFloat(amount.replace(',', '.'));
    if (!amt || amt <= 0) { alert(t.loans.amountRequired); return; }
    const isoDate = date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) { alert(t.loans.dateRequired); return; }
    const rate = parseFloat(interestRate.replace(',', '.')) || 0;
    const n = Math.max(1, parseInt(numInstallments, 10) || 1);
    const firstDueIso = /^\d{4}-\d{2}-\d{2}$/.test(firstDue) ? firstDue : null;
    const data = {
      description: desc.trim(), amount: amt, date: isoDate,
      interest_rate: rate, interest_type: 'simple' as const,
      months: n, frequency, first_due_date: firstDueIso,
    };
    const editingId = loanModal?.mode === 'edit' ? loanModal.loan.loan_id : null;
    if (editingId) {
      // Editar regenera el cronograma (nuevas fechas/montos), conservando lo ya pagado por cuota.
      await updateLoan(editingId, data);
    } else {
      await createLoan({ person_id: id!, ...data });
    }
    setLoanModal(null);
    await load();
    if (editingId && expandedLoan === editingId) await loadInstallments(editingId);
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

  // mode 'pay' = abono en cascada (vuelca excedente a las siguientes cuotas).
  // mode 'edit' = corregir monto/fecha SOLO de esta cuota (sin cascada).
  const openPay = async (loan: Loan, inst: Installment, mode: 'pay' | 'edit') => {
    const list = await getInstallments(loan.loan_id);
    const fresh = list.find(i => i.installment_id === inst.installment_id) ?? inst;
    if (mode === 'edit') {
      setPayAmount(fresh.paid_amount.toFixed(2));
      setPayDate(fresh.paid_date ?? todayIso());
      setPayModal({ loan, inst: fresh, mode });
    } else {
      const today = todayIso();
      // Monto efectivo: incluye arrastre de cuotas vencidas con pago parcial previas.
      const effective = computeEffectiveAmounts(list, today);
      const effInst = effective.find(i => i.installment_id === inst.installment_id) ?? fresh;
      const loanTotal = loan.amount + loan.amount * (loan.interest_rate || 0) / 100;
      const sumPaid = list.reduce((s, i) => s + i.paid_amount, 0);
      const loanOutstanding = Math.max(0, Math.round((loanTotal - sumPaid) * 100) / 100);
      const cuotaEffective = Math.max(0, Math.round((effInst.amount - fresh.paid_amount) * 100) / 100);
      const toPayDefault = Math.min(cuotaEffective, loanOutstanding);
      setPayAmount(toPayDefault.toFixed(2));
      setPayDate(today);
      // Cascada desde la primera cuota con saldo para pagar el arrastre primero.
      const firstOutstanding = list.find(i => i.paid_amount < i.amount) ?? fresh;
      setPayModal({ loan, inst: fresh, mode, cascadeFromId: firstOutstanding.installment_id, effectiveBalance: toPayDefault });
    }
  };

  const handlePay = async () => {
    if (!payModal) return;
    const amt = parseFloat(payAmount.replace(',', '.'));
    if (!amt || amt <= 0) { alert(t.loans.amountRequired); return; }
    const isoDate = payDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) { alert(t.loans.dateRequired); return; }
    if (payModal.mode === 'pay') {
      await payInstallmentCascade(payModal.cascadeFromId ?? payModal.inst.installment_id, amt, isoDate);
    } else {
      await payInstallment(payModal.inst.installment_id, amt, isoDate);
    }
    const loanId = payModal.loan.loan_id;
    setPayModal(null);
    await load();
    await loadInstallments(loanId);
    if (expandedLoan !== loanId) setExpandedLoan(loanId);
  };

  const handleClearInstallment = async (loan: Loan, inst: Installment) => {
    await unpayInstallment(inst.installment_id);
    await load();
    await loadInstallments(loan.loan_id);
  };

  const handleReport = async (loan: Loan) => {
    if (!person) return;
    try {
      const ins = await getInstallments(loan.loan_id);
      const html = buildLoanReportHtml(person, loan, ins);
      await exportLoanReport(html, `prestamo-${person.name}-${loan.description}`.replace(/\s+/g, '_'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (Platform.OS === 'web') alert('Error al generar el reporte: ' + msg);
      else Alert.alert('Error', 'No se pudo generar el reporte: ' + msg);
    }
  };

  const previewAmt = parseFloat(amount.replace(',', '.')) || 0;
  const previewRate = parseFloat(interestRate.replace(',', '.')) || 0;
  const previewInterest = previewAmt * (previewRate / 100);
  const previewTotal = previewAmt + previewInterest;
  const showPreview = previewAmt > 0 && previewRate > 0;
  const freqLabels: Record<LoanFrequency, string> = {
    monthly: t.loans.freqMonthly, biweekly: t.loans.freqBiweekly, weekly: t.loans.freqWeekly,
  };
  const nInst = Math.max(1, parseInt(numInstallments, 10) || 1);
  const perInstallment = previewTotal / nInst;

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
          const loanInstallments = installments[item.loan_id] ?? [];
          const isExpanded = expandedLoan === item.loan_id;

          return (
            <View style={[s.loanCard, isPaid && s.loanCardPaid]}>
              {isPaid && <View style={s.paidTopStrip} />}

              {/* Header */}
              <View style={s.loanHeader}>
                <View style={[s.loanStatusDot, { backgroundColor: isPaid ? C.income + '22' : C.warn + '22' }]}>
                  <View style={[s.loanStatusDotInner, { backgroundColor: isPaid ? C.income : C.warn }]} />
                </View>
                <View style={s.loanInfo}>
                  <Text style={s.loanDesc}>{item.description}</Text>
                  <Text style={s.loanDate}>{isoToDisplay(item.date)} · {item.months || 1} {t.loans.installmentsShort}</Text>
                  {hasInterest && (
                    <Text style={s.interestLabel}>
                      {item.interest_rate}% · {fmt(item.amount * item.interest_rate / 100)} {t.loans.interestWord}
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
                <Pressable style={[s.actionChip, { backgroundColor: C.surfaceUp, borderColor: C.border }]} onPress={() => toggleExpand(item.loan_id)}>
                  {isExpanded
                    ? <Ionicons name="chevron-up-outline" size={13} color={C.textSec} />
                    : <Ionicons name="chevron-down-outline" size={13} color={C.textSec} />}
                  <Text style={[s.actionChipText, { color: C.textSec }]}>{t.loans.installments}</Text>
                </Pressable>
                <Pressable style={[s.actionChip, { backgroundColor: C.accentBg, borderColor: C.accent + '44' }]} onPress={() => openEditLoan(item)}>
                  <Text style={[s.actionChipText, { color: C.accent }]}>{t.common.edit}</Text>
                </Pressable>
                <Pressable style={[s.actionChip, { backgroundColor: C.surfaceUp, borderColor: C.border }]} onPress={() => handleReport(item)}>
                  <Ionicons name="document-text-outline" size={13} color={C.textSec} />
                  <Text style={[s.actionChipText, { color: C.textSec }]}>{t.loans.report}</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteLoan(item)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={15} color={C.expense} />
                </Pressable>
              </View>

              {/* Installments list */}
              {isExpanded && (
                <View style={s.paymentsList}>
                  {(() => {
                    const today2 = todayIso();
                    const effList = computeEffectiveAmounts(loanInstallments, today2);
                    const next = effList.find(i => i.paid_amount < i.amount);
                    return next ? (
                      <Text style={s.nextDue}>
                        {t.loans.nextDue}: {t.loans.installmentLabel} {next.number} · {isoToDisplay(next.due_date)} · {t.loans.outstanding} {fmt(next.amount - next.paid_amount)}
                      </Text>
                    ) : null;
                  })()}
                  {loanInstallments.length === 0 ? (
                    <Text style={s.noPaymentsText}>{t.loans.noInstallments}</Text>
                  ) : (
                    (() => {
                      const today2 = todayIso();
                      const effList = computeEffectiveAmounts(loanInstallments, today2);
                      return loanInstallments.map((inst, idx) => {
                      const eff = effList[idx];
                      const carry = Math.round((eff.amount - inst.amount) * 100) / 100;
                      const displayAmt = carry > 0 ? eff.amount : inst.amount;
                      const carryStr = carry > 0 ? ` (+${fmt(carry)} ${t.loans.carryOver})` : '';
                      const settled = inst.paid_amount >= inst.amount;
                      const partial = inst.paid_amount > 0 && !settled;
                      const d = delayDays(inst.due_date, inst.paid_date);
                      const dColor = d === null ? C.textDim : d > 0 ? C.expense : C.income;
                      const dText = d === null ? '' : d > 0 ? `${d}${t.loans.daysLate}` : d < 0 ? `${-d}${t.loans.daysEarly}` : t.loans.onTime;
                      const dotColor = settled ? C.income : partial ? C.warn : carry > 0 ? C.warn : C.textDim;
                      return (
                        <View key={inst.installment_id} style={s.instRow}>
                          <View style={[s.instDot, { backgroundColor: dotColor + '22' }]}>
                            <Text style={[s.instNum, { color: dotColor }]}>{inst.number}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.instDue}>{t.loans.dueOn} {isoToDisplay(inst.due_date)}</Text>
                            <Text style={s.instMeta}>
                              {settled
                                ? t.loans.settled
                                : partial
                                  ? `${t.loans.partial} ${fmt(inst.paid_amount)}/${fmt(displayAmt)}${carryStr}`
                                  : `${fmt(displayAmt)}${carryStr}`}
                              {inst.paid_date ? ` · ${t.loans.paidOn} ${isoToDisplay(inst.paid_date)}` : ''}
                              {dText ? <Text style={{ color: dColor }}>{`  ${dText}`}</Text> : null}
                            </Text>
                          </View>
                          {settled ? (
                            <View style={s.instActions}>
                              <Pressable onPress={() => openPay(item, inst, 'edit')} hitSlop={6} style={s.instAction}>
                                <Text style={[s.actionChipText, { color: C.accent }]}>{t.common.edit}</Text>
                              </Pressable>
                              <Pressable onPress={() => handleClearInstallment(item, inst)} hitSlop={6} style={s.instAction}>
                                <Text style={[s.actionChipText, { color: C.textDim }]}>{t.loans.undo}</Text>
                              </Pressable>
                            </View>
                          ) : (
                            <View style={s.instActions}>
                              {partial && (
                                <>
                                  <Pressable onPress={() => openPay(item, inst, 'edit')} hitSlop={6} style={s.instAction}>
                                    <Text style={[s.actionChipText, { color: C.accent }]}>{t.common.edit}</Text>
                                  </Pressable>
                                  <Pressable onPress={() => handleClearInstallment(item, inst)} hitSlop={6} style={s.instAction}>
                                    <Text style={[s.actionChipText, { color: C.textDim }]}>{t.loans.undo}</Text>
                                  </Pressable>
                                </>
                              )}
                              <Pressable onPress={() => openPay(item, inst, 'pay')} style={s.instPayBtn}>
                                <Text style={[s.actionChipText, { color: C.income }]}>{t.loans.pay}</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    });
                    })()
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
        <Ionicons name="add-outline" size={24} color="#fff" />
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
                <DateField value={date} onChange={setDate} />

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

                {(
                  <>
                    <Text style={s.fieldLabel}>{t.loans.numInstallments}</Text>
                    <TextInput style={s.input} placeholder="1" value={numInstallments}
                      onChangeText={v => setNumInstallments(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad" placeholderTextColor={C.textDim} />

                    <Text style={s.fieldLabel}>{t.loans.frequency}</Text>
                    <View style={s.freqRow}>
                      {FREQUENCIES.map(f => {
                        const active = frequency === f.value;
                        return (
                          <Pressable key={f.value} onPress={() => setFrequency(f.value)}
                            style={[s.freqChip, active && s.freqChipActive]}>
                            <Text style={[s.freqChipText, active && { color: C.accent, fontWeight: '700' }]}>
                              {freqLabels[f.value]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={s.fieldLabel}>{t.loans.firstDueDate}</Text>
                    <DateField value={firstDue} onChange={setFirstDue} />
                    <Text style={s.interestHint}>
                      {previewAmt > 0
                        ? `${nInst} ${t.loans.installmentsShort} × ${fmt(perInstallment)}`
                        : t.loans.firstDueHint}
                    </Text>
                  </>
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

      {/* Pay installment modal */}
      <Modal animationType="slide" transparent visible={!!payModal} onRequestClose={() => setPayModal(null)}>
        <View style={overlayStyle}>
          <View style={sheetStyle}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{payModal?.mode === 'edit' ? t.loans.editPayment : t.loans.payInstallment}</Text>
            <View style={s.sheetContent}>
              {payModal && (
                <View style={s.paymentContext}>
                  <Text style={s.paymentContextLoan}>{payModal.loan.description} · {t.loans.installmentLabel} {payModal.inst.number}</Text>
                  <Text style={[s.paymentContextBalance, { color: C.warn }]}>
                    {t.loans.dueOn} {isoToDisplay(payModal.inst.due_date)} · {fmt(payModal.effectiveBalance ?? Math.max(0, payModal.inst.amount - payModal.inst.paid_amount))}
                  </Text>
                </View>
              )}
              <Text style={s.fieldLabel}>{t.loans.paymentAmount} <Text style={{ color: C.expense }}>*</Text></Text>
              <TextInput style={s.input} placeholder="0.00" value={payAmount}
                onChangeText={setPayAmount} keyboardType="decimal-pad" placeholderTextColor={C.textDim} />

              <Text style={s.fieldLabel}>{t.loans.paidDate} <Text style={{ color: C.expense }}>*</Text></Text>
              <DateField value={payDate} onChange={setPayDate} />
              <Text style={s.interestHint}>{payModal?.mode === 'pay' ? t.loans.cascadeHint : t.loans.partialHint}</Text>

              <View style={s.btnRow}>
                <Pressable style={[s.btn, s.btnCancel]} onPress={() => setPayModal(null)}>
                  <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={[s.btn, { backgroundColor: C.income }]} onPress={handlePay}>
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

  // Cuotas
  instRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: 6 },
  instDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  instNum: { fontSize: F.xs, fontWeight: '800' },
  instDue: { fontSize: F.sm, color: C.text, fontWeight: '600' },
  instMeta: { fontSize: F.xs, color: C.textSec, marginTop: 2 },
  nextDue: { fontSize: F.xs, fontWeight: '700', color: C.warn, marginBottom: 4 },
  instActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  instAction: { paddingHorizontal: 8, paddingVertical: 4 },
  instPayBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.sm, borderWidth: 1, borderColor: C.income + '44', backgroundColor: C.incomeBg },

  // Selector de frecuencia
  freqRow: { flexDirection: 'row', gap: 6 },
  freqChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceUp },
  freqChipActive: { borderColor: C.accent, backgroundColor: C.accentBg },
  freqChipText: { fontSize: F.sm, color: C.textSec },

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
