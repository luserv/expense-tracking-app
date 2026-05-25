/**
 * Presupuestos y Alcancías — Segato
 */
import { ChevronLeft, ChevronRight, Minus, Pencil, PiggyBank as PiggyBankIcon, Plus, Trash2, Wallet } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import Dropdown from '../../components/Dropdown';
import { BudgetWithProgress, Category, PiggyBank, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { CONTENT_MAX_W, FORM_MAX_W, useLayout } from '../../utils/responsive';
import { C, F, R, S, shadow } from '../../utils/theme';

const PRESET_COLORS = [
  '#F64458','#FB923C','#F59E0B','#10D982','#14B8A6',
  '#38BDF8','#5B7CF6','#8B5CF6','#EC4899','#A78BFA',
];

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = value > max;
  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct * 100}%` as any, backgroundColor: over ? C.expense : color }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: { height: 10, borderRadius: 5, backgroundColor: C.surfaceHigh, overflow: 'hidden', marginTop: 8 },
  fill:  { height: 10, borderRadius: 5 },
});

const MONTH_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTH_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function BudgetsScreen() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [budgets, setBudgets]     = useState<BudgetWithProgress[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgetModal, setBudgetModal] = useState(false);
  const [selCatId, setSelCatId]   = useState<string | null>(null);
  const [budgetLimit, setBudgetLimit] = useState('');

  const [pigs, setPigs]         = useState<PiggyBank[]>([]);
  const [pigModal, setPigModal] = useState(false);
  const [pigEditId, setPigEditId] = useState<string | null>(null);
  const [pigName, setPigName]   = useState('');
  const [pigTarget, setPigTarget] = useState('');
  const [pigColor, setPigColor] = useState(PRESET_COLORS[4]);
  const [pigNotes, setPigNotes] = useState('');

  const [fundModal, setFundModal] = useState(false);
  const [fundAction, setFundAction] = useState<'add' | 'withdraw'>('add');
  const [fundPigId, setFundPigId] = useState<string | null>(null);
  const [fundAmt, setFundAmt]   = useState('');

  const {
    getBudgetsWithProgress, setBudget, deleteBudget,
    getCategories,
    getPiggyBanks, createPiggyBank, updatePiggyBank, deletePiggyBank,
    addToPiggyBank, withdrawFromPiggyBank,
  } = useExpenses();
  const { t, lang } = useI18n();
  const l = useLayout();
  const isWide = !l.isPhone;

  const MONTHS = lang === 'es' ? MONTH_ES : MONTH_EN;

  const loadAll = useCallback(async () => {
    const [b, cats, p] = await Promise.all([
      getBudgetsWithProgress(year, month),
      getCategories(),
      getPiggyBanks(),
    ]);
    setBudgets(b);
    setCategories(cats.filter(c => c.type === 'expense'));
    setPigs(p);
  }, [year, month, getBudgetsWithProgress, getCategories, getPiggyBanks]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const prevMonth = () => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); };

  const handleSaveBudget = async () => {
    if (!selCatId) { alert(t.budgets.categoryRequired); return; }
    const amt = parseFloat(budgetLimit.replace(',', '.'));
    if (!amt || amt <= 0) { alert(t.budgets.limitRequired); return; }
    await setBudget(selCatId, amt, year, month);
    setBudgetModal(false);
    await loadAll();
  };

  const handleDeleteBudget = (id: string) => {
    const doDelete = async () => { await deleteBudget(id); await loadAll(); };
    if (Platform.OS === 'web') { if (confirm(t.budgets.deleteConfirm)) doDelete(); }
    else Alert.alert(t.common.delete, t.budgets.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: doDelete },
    ]);
  };

  const handleSavePig = async () => {
    if (!pigName.trim()) { alert(t.piggyBanks.nameRequired); return; }
    const target = parseFloat(pigTarget.replace(',', '.'));
    if (!target || target <= 0) { alert(t.piggyBanks.targetRequired); return; }
    if (pigEditId) {
      const existing = pigs.find(p => p.piggy_bank_id === pigEditId);
      await updatePiggyBank(pigEditId, {
        name: pigName.trim(), target_amount: target,
        current_amount: existing?.current_amount ?? 0,
        color: pigColor, notes: pigNotes.trim() || null, account_id: null,
      });
    } else {
      await createPiggyBank({ name: pigName.trim(), target_amount: target, current_amount: 0, color: pigColor, notes: pigNotes.trim() || null, account_id: null });
    }
    setPigModal(false);
    await loadAll();
  };

  const handleDeletePig = (id: string) => {
    const doDelete = async () => { await deletePiggyBank(id); await loadAll(); };
    if (Platform.OS === 'web') { if (confirm(t.piggyBanks.deleteConfirm)) doDelete(); }
    else Alert.alert(t.common.delete, t.piggyBanks.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: doDelete },
    ]);
  };

  const openFundModal = (id: string, action: 'add' | 'withdraw') => {
    setFundPigId(id); setFundAction(action); setFundAmt(''); setFundModal(true);
  };

  const handleFund = async () => {
    const amt = parseFloat(fundAmt.replace(',', '.'));
    if (!amt || amt <= 0) return;
    if (fundAction === 'add') await addToPiggyBank(fundPigId!, amt);
    else await withdrawFromPiggyBank(fundPigId!, amt);
    setFundModal(false);
    await loadAll();
  };

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent    = budgets.reduce((s, b) => s + b.spent, 0);
  const usedCatIds    = new Set(budgets.map(b => b.category_id));
  const availableCats = categories.filter(c => !usedCatIds.has(c.category_id));
  const overBudget    = totalSpent > totalBudgeted && budgets.length > 0;

  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Responsive sheet styles
  const overlayStyle = [s.overlay, isWide && s.overlayDesktop];
  const sheetStyle   = [s.sheet, isWide && s.sheetDesktop];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={[s.content, { paddingHorizontal: l.px, paddingTop: l.px }]}>
        <View style={l.isDesktop ? { maxWidth: CONTENT_MAX_W, width: '100%', alignSelf: 'center' } : {}}>

          {/* Month selector */}
          <View style={s.monthRow}>
            <Pressable onPress={prevMonth} hitSlop={12} style={s.monthArrow}>
              <ChevronLeft size={20} color={C.textSec} />
            </Pressable>
            <Text style={s.monthLabel}>{MONTHS[month-1]} {year}</Text>
            <Pressable onPress={nextMonth} hitSlop={12} style={s.monthArrow}>
              <ChevronRight size={20} color={C.textSec} />
            </Pressable>
          </View>

          {/* Budget summary */}
          {budgets.length > 0 && (
            <View style={s.summaryCard}>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>{t.budgets.spent}</Text>
                <Text style={[s.summaryValue, { color: overBudget ? C.expense : C.text }]}>{fmt(totalSpent)}</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>{t.budgets.limit}</Text>
                <Text style={s.summaryValue}>{fmt(totalBudgeted)}</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>{t.budgets.remaining}</Text>
                <Text style={[s.summaryValue, { color: (totalBudgeted - totalSpent) < 0 ? C.expense : C.income }]}>
                  {fmt(Math.max(0, totalBudgeted - totalSpent))}
                </Text>
              </View>
            </View>
          )}

          {/* Budgets section */}
          <View style={s.sectionRow}>
            <View style={s.sectionLeft}>
              <Wallet size={16} color={C.accent} />
              <Text style={s.sectionTitle}>{t.budgets.title}</Text>
            </View>
            {availableCats.length > 0 && (
              <Pressable
                style={s.addBtn}
                onPress={() => { setSelCatId(null); setBudgetLimit(''); setBudgetModal(true); }}
                android_ripple={{ color: C.accentPress, borderless: false }}
              >
                <Plus size={14} color="#fff" strokeWidth={2.5} />
              </Pressable>
            )}
          </View>

          {budgets.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>{t.budgets.noBudgets}</Text>
              {availableCats.length > 0 && (
                <Pressable
                  style={s.emptyBtn}
                  onPress={() => { setSelCatId(null); setBudgetLimit(''); setBudgetModal(true); }}
                >
                  <Text style={s.emptyBtnText}>{t.budgets.addBudget}</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={isWide ? s.cardGrid : null}>
              {budgets.map(b => {
                const exceeded = b.spent > b.amount;
                const pctNum = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
                return (
                  <View key={b.budget_id} style={[s.budgetCard, isWide && s.cardGridItem]}>
                    <View style={s.budgetHeader}>
                      <View style={[s.catAvatar, { backgroundColor: b.category_color + '22' }]}>
                        <Text style={{ fontSize: F.sm, fontWeight: '700', color: b.category_color }}>
                          {b.category_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.budgetName}>{b.category_name}</Text>
                        <Text style={[s.budgetSub, exceeded && { color: C.expense }]}>
                          {exceeded ? `⚠ ${t.budgets.exceeded}` : `${pctNum}% ${t.budgets.of} ${fmt(b.amount)}`}
                        </Text>
                      </View>
                      <Pressable onPress={() => handleDeleteBudget(b.budget_id)} hitSlop={10}>
                        <Trash2 size={16} color={C.textDim} />
                      </Pressable>
                    </View>
                    <ProgressBar value={b.spent} max={b.amount} color={b.category_color} />
                    <View style={s.budgetFooter}>
                      <Text style={[s.budgetSpent, exceeded && { color: C.expense }]}>
                        {fmt(b.spent)}
                      </Text>
                      <Text style={s.budgetLimit}>/ {fmt(b.amount)}</Text>
                      {!exceeded && (
                        <Text style={[s.budgetRemain, { color: C.income }]}>
                          {fmt(b.amount - b.spent)} {t.budgets.remaining}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Piggy banks section */}
          <View style={[s.sectionRow, { marginTop: S.xl }]}>
            <View style={s.sectionLeft}>
              <PiggyBankIcon size={16} color={C.transfer} />
              <Text style={s.sectionTitle}>{t.piggyBanks.title}</Text>
            </View>
            <Pressable
              style={[s.addBtn, { backgroundColor: C.transfer }]}
              onPress={() => { setPigEditId(null); setPigName(''); setPigTarget(''); setPigColor(PRESET_COLORS[4]); setPigNotes(''); setPigModal(true); }}
            >
              <Plus size={14} color="#fff" strokeWidth={2.5} />
            </Pressable>
          </View>

          {pigs.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>{t.piggyBanks.empty}</Text>
              <Pressable
                style={[s.emptyBtn, { backgroundColor: C.transfer }]}
                onPress={() => { setPigEditId(null); setPigName(''); setPigTarget(''); setPigColor(PRESET_COLORS[4]); setPigNotes(''); setPigModal(true); }}
              >
                <Text style={s.emptyBtnText}>{t.piggyBanks.add}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={isWide ? s.cardGrid : null}>
              {pigs.map(p => {
                const pct = p.target_amount > 0 ? Math.min(p.current_amount / p.target_amount, 1) : 0;
                const done = p.current_amount >= p.target_amount;
                return (
                  <View key={p.piggy_bank_id} style={[s.pigCard, isWide && s.cardGridItem]}>
                    <View style={s.pigHeader}>
                      <View style={[s.catAvatar, { backgroundColor: p.color + '22' }]}>
                        <Text style={{ fontSize: F.sm, fontWeight: '700', color: p.color }}>
                          {p.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.budgetName}>{p.name}</Text>
                        <Text style={s.budgetSub}>
                          {fmt(p.current_amount)} / {fmt(p.target_amount)} · {Math.round(pct * 100)}%
                        </Text>
                      </View>
                      <Pressable onPress={() => { setPigEditId(p.piggy_bank_id); setPigName(p.name); setPigTarget(String(p.target_amount)); setPigColor(p.color); setPigNotes(p.notes ?? ''); setPigModal(true); }} hitSlop={10} style={{ marginRight: S.xs }}>
                        <Pencil size={16} color={C.textDim} />
                      </Pressable>
                      <Pressable onPress={() => handleDeletePig(p.piggy_bank_id)} hitSlop={10}>
                        <Trash2 size={16} color={C.textDim} />
                      </Pressable>
                    </View>

                    {done ? (
                      <Text style={s.goalDone}>{t.piggyBanks.completed}</Text>
                    ) : (
                      <View style={pb.track}>
                        <View style={[pb.fill, { width: `${pct * 100}%` as any, backgroundColor: p.color }]} />
                      </View>
                    )}

                    <View style={s.pigActions}>
                      <Pressable
                        style={[s.fundBtn, { backgroundColor: C.incomeBg, borderColor: C.income + '44' }]}
                        onPress={() => openFundModal(p.piggy_bank_id, 'add')}
                      >
                        <Plus size={13} color={C.income} strokeWidth={2.5} />
                        <Text style={[s.fundBtnText, { color: C.income }]}>{t.piggyBanks.addFunds}</Text>
                      </Pressable>
                      <Pressable
                        style={[s.fundBtn, { backgroundColor: C.warnBg, borderColor: C.warn + '44' }]}
                        onPress={() => openFundModal(p.piggy_bank_id, 'withdraw')}
                      >
                        <Minus size={13} color={C.warn} strokeWidth={2.5} />
                        <Text style={[s.fundBtnText, { color: C.warn }]}>{t.piggyBanks.withdrawFunds}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── Modal: New budget ── */}
      <Modal animationType="slide" transparent visible={budgetModal} onRequestClose={() => setBudgetModal(false)}>
        <View style={overlayStyle}>
          <View style={sheetStyle}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{t.budgets.addBudget}</Text>
            <View style={s.sheetContent}>
              <Text style={s.fieldLabel}>{t.budgets.selectCategory}</Text>
              <Dropdown
                options={availableCats.map(c => ({ label: c.name, value: c.category_id }))}
                value={selCatId} onSelect={setSelCatId} allowNull={false}
              />
              <Text style={s.fieldLabel}>{t.budgets.limit} <Text style={{ color: C.expense }}>*</Text></Text>
              <TextInput
                style={s.input}
                placeholder={t.budgets.limitPlaceholder}
                placeholderTextColor={C.textDim}
                value={budgetLimit} onChangeText={setBudgetLimit}
                keyboardType="decimal-pad"
              />
              <View style={s.btnRow}>
                <Pressable style={[s.btn, s.btnCancel]} onPress={() => setBudgetModal(false)}>
                  <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={[s.btn, s.btnSave]} onPress={handleSaveBudget}>
                  <Text style={s.btnSaveText}>{t.common.save}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Piggy bank ── */}
      <Modal animationType="slide" transparent visible={pigModal} onRequestClose={() => setPigModal(false)}>
        <View style={overlayStyle}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={sheetStyle}>
              <View style={s.handle} />
              <Text style={s.sheetTitle}>{pigEditId ? t.piggyBanks.edit : t.piggyBanks.add}</Text>
              <View style={s.sheetContent}>
                <Text style={s.fieldLabel}>{t.piggyBanks.name} <Text style={{ color: C.expense }}>*</Text></Text>
                <TextInput
                  style={s.input} placeholder={t.piggyBanks.namePlaceholder}
                  placeholderTextColor={C.textDim} value={pigName} onChangeText={setPigName}
                />
                <Text style={s.fieldLabel}>{t.piggyBanks.target} <Text style={{ color: C.expense }}>*</Text></Text>
                <TextInput
                  style={s.input} placeholder={t.piggyBanks.targetPlaceholder}
                  placeholderTextColor={C.textDim} value={pigTarget} onChangeText={setPigTarget}
                  keyboardType="decimal-pad"
                />
                <Text style={s.fieldLabel}>{lang === 'es' ? 'Color' : 'Color'}</Text>
                <View style={s.colorGrid}>
                  {PRESET_COLORS.map(c => (
                    <Pressable
                      key={c}
                      style={[s.colorSwatch, { backgroundColor: c }, pigColor === c && s.colorSelected]}
                      onPress={() => setPigColor(c)}
                    />
                  ))}
                </View>
                <View style={s.btnRow}>
                  <Pressable style={[s.btn, s.btnCancel]} onPress={() => setPigModal(false)}>
                    <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                  </Pressable>
                  <Pressable style={[s.btn, { backgroundColor: C.transfer }]} onPress={handleSavePig}>
                    <Text style={s.btnSaveText}>{t.common.save}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal: Fund ── */}
      <Modal animationType="slide" transparent visible={fundModal} onRequestClose={() => setFundModal(false)}>
        <View style={overlayStyle}>
          <View style={sheetStyle}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>
              {fundAction === 'add' ? t.piggyBanks.addFunds : t.piggyBanks.withdrawFunds}
            </Text>
            <View style={s.sheetContent}>
              <Text style={s.fieldLabel}>{t.piggyBanks.fundAmount}</Text>
              <TextInput
                style={s.input} placeholder="0.00" placeholderTextColor={C.textDim}
                value={fundAmt} onChangeText={setFundAmt}
                keyboardType="decimal-pad" autoFocus
              />
              <View style={s.btnRow}>
                <Pressable style={[s.btn, s.btnCancel]} onPress={() => setFundModal(false)}>
                  <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={[s.btn, { backgroundColor: fundAction === 'add' ? C.income : C.warn }]} onPress={handleFund}>
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
  content: { paddingBottom: S['4xl'] },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.lg, marginBottom: S.lg },
  monthArrow: { padding: 4 },
  monthLabel: { fontSize: F.md, fontWeight: '600', color: C.text, minWidth: 160, textAlign: 'center' },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: R.md,
    padding: S.lg, marginBottom: S.xl,
    borderWidth: 1, borderColor: C.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 36, backgroundColor: C.border },
  summaryLabel: { fontSize: F.xs, color: C.textDim, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  summaryValue: { fontSize: F.md, fontWeight: '700', color: C.text },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: S.xs },
  sectionTitle: { fontSize: F.base, fontWeight: '700', color: C.text },
  addBtn: {
    width: 32, height: 32, borderRadius: R.full,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyCard: {
    backgroundColor: C.surface, borderRadius: R.md,
    padding: S['2xl'], alignItems: 'center', marginBottom: S.sm,
    borderWidth: 1, borderColor: C.border,
  },
  emptyText: { fontSize: F.base, color: C.textDim, marginBottom: S.md },
  emptyBtn: { backgroundColor: C.accent, paddingHorizontal: S.lg, paddingVertical: 10, borderRadius: R.sm },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: F.sm },

  // 2-col card grid for tablet+
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  cardGridItem: { width: '49%' },

  budgetCard: {
    backgroundColor: C.surface, borderRadius: R.md,
    padding: S.md, marginBottom: S.sm,
    borderWidth: 1, borderColor: C.border,
  },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  catAvatar: { width: 38, height: 38, borderRadius: R.xs, alignItems: 'center', justifyContent: 'center' },
  budgetName: { fontSize: F.base, fontWeight: '600', color: C.text },
  budgetSub: { fontSize: F.xs, color: C.textSec, marginTop: 2 },
  budgetFooter: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 },
  budgetSpent: { fontSize: F.sm, fontWeight: '700', color: C.text },
  budgetLimit: { fontSize: F.sm, color: C.textDim },
  budgetRemain: { fontSize: F.xs, fontWeight: '600', marginLeft: 'auto' as any },

  pigCard: {
    backgroundColor: C.surface, borderRadius: R.md,
    padding: S.md, marginBottom: S.sm,
    borderWidth: 1, borderColor: C.border,
  },
  pigHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm },
  goalDone: { fontSize: F.sm, color: C.income, fontWeight: '700', marginVertical: S.xs },
  pigActions: { flexDirection: 'row', gap: S.sm, marginTop: S.sm },
  fundBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: R.sm, borderWidth: 1,
  },
  fundBtnText: { fontSize: F.sm, fontWeight: '700' },

  // Sheet
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
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  colorSwatch: { width: 34, height: 34, borderRadius: 17 },
  colorSelected: { borderWidth: 3, borderColor: C.text },
  btnRow: { flexDirection: 'row', gap: S.sm, marginTop: S.xl },
  btn: { flex: 1, paddingVertical: 14, borderRadius: R.sm, alignItems: 'center' },
  btnCancel: { backgroundColor: C.surfaceUp },
  btnSave: { backgroundColor: C.accent },
  btnCancelText: { fontSize: F.base, fontWeight: '600', color: C.textSec },
  btnSaveText: { fontSize: F.base, fontWeight: '700', color: '#fff' },
});
