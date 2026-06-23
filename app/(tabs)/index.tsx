/**
 * Pantalla principal — Segato
 */
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList, Modal, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AdBanner from '../../components/AdBanner';
import Dropdown from '../../components/Dropdown';
import Loader from '../../components/Loader';
import { Account, Bill, Category, Expense, LoanWithPerson, MonthSummary, Tag, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { CONTENT_MAX_W, useLayout } from '../../utils/responsive';
import { C, F, R, S, shadow } from '../../utils/theme';

const MONTH_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTH_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const SHORT_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type ListItem = { kind: 'expense'; data: Expense } | { kind: 'loan'; data: LoanWithPerson };

function calcTotal(a: number, r: number) { return !r || r <= 0 ? a : a + a * (r / 100); }
function todayIso() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; }
function displayToIso(d: string) { const [dd,mm,yy] = d.split('/'); if (!dd||!mm||!yy||yy.length!==4) return ''; return `${yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`; }
function isoToDisplay(i: string) { const [y,m,d] = i.split('-'); return `${d}/${m}/${y}`; }
function daysUntil(iso: string) { const t = new Date(); t.setHours(0,0,0,0); const g = new Date(iso+'T00:00:00'); return Math.ceil((g.getTime()-t.getTime())/(86400000)); }

function Avatar({ label, color, size = 40 }: { label: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: R.sm, backgroundColor: color+'22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color }}>{label.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary]             = useState<MonthSummary>({ income: 0, expense: 0, balance: 0 });
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<Expense[]>([]);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [accounts, setAccounts]           = useState<Account[]>([]);
  const [monthLoans, setMonthLoans]       = useState<LoanWithPerson[]>([]);
  const [dueBills, setDueBills]           = useState<Bill[]>([]);
  const [allTags, setAllTags]             = useState<Tag[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const [modalVisible, setModalVisible]   = useState(false);
  const [txType, setTxType]               = useState<'expense' | 'income' | 'transfer'>('expense');
  const [desc, setDesc]                   = useState('');
  const [amount, setAmount]               = useState('');
  const [date, setDate]                   = useState('');
  const [categoryId, setCategoryId]       = useState<string | null>(null);
  const [accountId, setAccountId]         = useState<string | null>(null);
  const [destAccountId, setDestAccountId] = useState<string | null>(null);
  const [notes, setNotes]                 = useState('');
  const [selTagIds, setSelTagIds]         = useState<string[]>([]);

  const { expenses, fetchExpenses, createExpense, createTransfer, getCategories, getAccounts, getMonthSummary, searchExpenses, getLoansForMonth, getDueBills, getTags, setTagsForExpense, dbRevision } = useExpenses();
  const { t, lang } = useI18n();
  const router = useRouter();
  const layout = useLayout();

  const MONTHS = lang === 'es' ? MONTH_ES : MONTH_EN;
  const SHORTS = lang === 'es' ? SHORT_ES : SHORT_EN;
  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = useCallback(async () => {
    try {
      const [s, loans, bills] = await Promise.all([getMonthSummary(year, month), getLoansForMonth(year, month), getDueBills()]);
      await fetchExpenses(year, month);
      setSummary(s); setMonthLoans(loans); setDueBills(bills);
    } finally {
      setInitialLoading(false);
    }
  }, [year, month, fetchExpenses, getMonthSummary, getLoansForMonth, getDueBills]);

  useEffect(() => { load(); }, [load]);
  // Recargar cuando se importan datos de otro dispositivo (sync).
  useEffect(() => { if (dbRevision > 0) load(); }, [dbRevision]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    const t = setTimeout(() => searchExpenses(q).then(setSearchResults), 200);
    return () => clearTimeout(t);
  }, [searchQuery, searchExpenses]);

  const prevMonth = () => { if (month===1) { setYear(y=>y-1); setMonth(12); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===12) { setYear(y=>y+1); setMonth(1); } else setMonth(m=>m+1); };

  const handleOpenModal = async () => {
    const [cats, accs, tags] = await Promise.all([getCategories(), getAccounts(), getTags()]);
    setCategories(cats); setAccounts(accs); setAllTags(tags);
    setDesc(''); setAmount(''); setDate(isoToDisplay(todayIso()));
    setTxType('expense'); setCategoryId(null); setAccountId(null); setDestAccountId(null); setNotes(''); setSelTagIds([]);
    setModalVisible(true);
  };

  const formatDateInput = (text: string) => {
    const d = text.replace(/\D/g,'').slice(0,8);
    let f = d;
    if (d.length>4) f = `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
    else if (d.length>2) f = `${d.slice(0,2)}/${d.slice(2)}`;
    setDate(f);
  };

  const handleSave = async () => {
    if (!desc.trim()) { alert(t.expenses.descriptionRequired); return; }
    const amt = parseFloat(amount.replace(',','.'));
    if (!amt||amt<=0) { alert(t.expenses.amountRequired); return; }
    const isoDate = displayToIso(date);
    if (!isoDate) { alert(t.expenses.dateRequired); return; }
    if (txType==='transfer') {
      if (!accountId||!destAccountId) { alert(t.expenses.accountRequired); return; }
      await createTransfer({ description: desc.trim(), amount: amt, date: isoDate, account_id: accountId, destination_account_id: destAccountId, notes: notes.trim()||null });
    } else {
      const created = await createExpense({ description: desc.trim(), amount: amt, date: isoDate, type: txType, category_id: categoryId, account_id: accountId, notes: notes.trim()||null });
      if (created && selTagIds.length>0) await setTagsForExpense(created.expense_id, selTagIds);
    }
    setModalVisible(false); await load();
  };

  const toggleTag = (id: string) => setSelTagIds(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);
  const getCat = (item: Expense) => categories.find(c=>c.category_id===item.category_id);
  const getAccName = (id?: string|null) => accounts.find(a=>a.account_id===id)?.name ?? '';
  const fmtDate = (iso: string) => { const [,m,d] = iso.split('-'); const di=parseInt(d,10); const mi=parseInt(m,10); return lang==='es'?`${di} ${SHORTS[mi-1]}`:`${SHORTS[mi-1]} ${di}`; };

  const buildList = (): ListItem[] =>
    [...expenses.map(e=>({kind:'expense' as const,data:e})), ...monthLoans.map(l=>({kind:'loan' as const,data:l}))]
      .sort((a,b)=>b.data.date.localeCompare(a.data.date));

  const displayList: ListItem[] = searchQuery.trim() ? searchResults.map(e=>({kind:'expense',data:e})) : buildList();
  const filteredCats = categories.filter(c => txType!=='transfer' && c.type===(txType==='expense'?'expense':'income'));
  const balColor = summary.balance>=0 ? C.income : C.expense;

  // Responsive values
  const px = layout.px;
  const isWide = !layout.isPhone; // tablet + desktop

  // On desktop/tablet: 2-column transaction list
  const itemPad = isWide ? 20 : 16;

  if (initialLoading) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Loader label={t.common.loading} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Scrollable header + list */}
      <FlatList
        data={displayList}
        keyExtractor={item => item.kind==='expense' ? item.data.expense_id : item.data.loan_id}
        contentContainerStyle={[s.listContent, { paddingHorizontal: 0, paddingBottom: 100 }]}
        ListHeaderComponent={() => (
          <View style={[s.header, { paddingHorizontal: px }]}>
            {/* Month selector */}
            <View style={s.monthRow}>
              <Pressable onPress={prevMonth} hitSlop={12} style={s.monthArrow}>
                <Ionicons name="chevron-back-outline" size={20} color={C.textSec} />
              </Pressable>
              <Text style={s.monthLabel}>{MONTHS[month-1]} {year}</Text>
              <Pressable onPress={nextMonth} hitSlop={12} style={s.monthArrow}>
                <Ionicons name="chevron-forward-outline" size={20} color={C.textSec} />
              </Pressable>
            </View>

            {/* Summary card */}
            <View style={[s.summaryCard, isWide && s.summaryCardWide]}>
              <View style={s.summaryPill}>
                <Text style={s.summaryLabel}>{t.summary.income}</Text>
                <Text style={[s.summaryValue, { color: C.income }]}>{fmt(summary.income)}</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryCenter}>
                <Text style={s.summaryLabel}>{t.summary.balance}</Text>
                <Text style={[isWide ? s.summaryBalanceWide : s.summaryBalance, { color: balColor }]}>
                  {fmt(summary.balance)}
                </Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryPill}>
                <Text style={s.summaryLabel}>{t.summary.expense}</Text>
                <Text style={[s.summaryValue, { color: C.expense }]}>{fmt(summary.expense)}</Text>
              </View>
            </View>

            {/* Bills bar */}
            {dueBills.length > 0 && (
              <Pressable style={s.billsBar} onPress={() => router.push('/(tabs)/config')}>
                <Ionicons name="notifications-outline" size={14} color={C.warn} />
                <Text style={s.billsBarText} numberOfLines={1}>
                  {dueBills.slice(0,2).map(b=>{const d=daysUntil(b.next_date);return `${b.name} ${d<=0?`(${t.bills.overdue})`:`(${d}d)`}`;}).join('  ·  ')}
                  {dueBills.length>2&&`  +${dueBills.length-2}`}
                </Text>
              </Pressable>
            )}

            {/* Search */}
            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={16} color={C.textDim} style={{ marginRight: S.sm }} />
              <TextInput
                style={s.searchInput}
                placeholder={t.expenses.search}
                placeholderTextColor={C.textDim}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length>0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
                  <Ionicons name="close-outline" size={16} color={C.textDim} />
                </Pressable>
              )}
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          if (item.kind==='loan') {
            const loan = item.data;
            const total = calcTotal(loan.amount, loan.interest_rate);
            return (
              <Pressable style={({ pressed }) => [s.row, { paddingHorizontal: itemPad }, pressed && s.rowPressed]} onPress={() => router.push(`/person/${loan.person_id}`)} android_ripple={{ color: C.surfaceHigh }}>
                <Avatar label={loan.person_name} color={C.loan} />
                <View style={s.rowBody}>
                  <Text style={s.rowTitle} numberOfLines={1}>{loan.description}</Text>
                  <Text style={[s.rowSub, { color: C.loan }]}>{loan.person_name}{loan.is_paid ? ` · ${t.loans.paid}` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.rowAmount, { color: loan.is_paid ? C.income : C.loan }]}>{fmt(loan.amount)}</Text>
                  {loan.interest_rate>0&&!loan.is_paid&&<Text style={s.rowAmountSub}>→ {fmt(total)}</Text>}
                </View>
              </Pressable>
            );
          }

          const exp = item.data;
          const isTransfer = !!exp.transfer_pair_id;

          if (isTransfer) {
            return (
              <Pressable style={({ pressed }) => [s.row, { paddingHorizontal: itemPad }, pressed && s.rowPressed]} onPress={() => router.push(`/expense/${exp.expense_id}`)} android_ripple={{ color: C.surfaceHigh }}>
                <View style={s.transferAvatar}><Ionicons name="swap-horizontal-outline" size={17} color={C.transfer} /></View>
                <View style={s.rowBody}>
                  <Text style={s.rowTitle} numberOfLines={1}>{exp.description}</Text>
                  <Text style={[s.rowSub, { color: C.transfer }]}>{getAccName(exp.account_id)} → {getAccName(exp.destination_account_id)}</Text>
                </View>
                <Text style={[s.rowAmount, { color: C.transfer }]}>{fmt(exp.amount)}</Text>
              </Pressable>
            );
          }

          const cat = getCat(exp);
          const catColor = cat?.color ?? C.textDim;
          const isIncome = exp.type==='income';
          return (
            <Pressable style={({ pressed }) => [s.row, { paddingHorizontal: itemPad }, pressed && s.rowPressed]} onPress={() => router.push(`/expense/${exp.expense_id}`)} android_ripple={{ color: C.surfaceHigh }}>
              <Avatar label={cat?.name ?? exp.description} color={catColor} />
              <View style={s.rowBody}>
                <Text style={s.rowTitle} numberOfLines={1}>{exp.description}</Text>
                <Text style={s.rowSub}>{fmtDate(exp.date)}</Text>
              </View>
              <Text style={[s.rowAmount, { color: isIncome ? C.income : C.expense }]}>
                {isIncome?'+':'-'}{fmt(exp.amount)}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={() => <View style={s.empty}><Text style={s.emptyText}>{t.expenses.empty}</Text></View>}
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [s.fab, pressed && { opacity: 0.88 }, isWide && s.fabWide]}
        onPress={handleOpenModal}
        android_ripple={{ color: C.accentPress, borderless: false, radius: 28 }}
      >
        <Ionicons name="add-outline" size={26} color="#fff" />
      </Pressable>

      <AdBanner />

      {/* ── Modal ── */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={s.overlay}>
          <View style={[s.sheet, layout.isDesktop && s.sheetDesktop]}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{t.expenses.newExpense}</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.sheetContent, layout.isDesktop && s.sheetContentDesktop]}>

              <View style={s.typeRow}>
                {(['expense','income','transfer'] as const).map(tp => {
                  const active = tp===txType;
                  const color = tp==='expense'?C.expense:tp==='income'?C.income:C.transfer;
                  return (
                    <Pressable key={tp} style={[s.typeChip, active&&{backgroundColor:color+'22',borderColor:color}]} onPress={() => { setTxType(tp); setCategoryId(null); setDestAccountId(null); }}>
                      <Text style={[s.typeChipText, active&&{color,fontWeight:'700'}]}>{tp==='expense'?t.common.expense:tp==='income'?t.common.income:t.common.transfer}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* On desktop: 2-col grid for form fields */}
              {layout.isDesktop ? (
                <View style={s.formGrid}>
                  <View style={s.formCol}>
                    <Text style={s.fieldLabel}>{t.expenses.description} <Text style={s.req}>*</Text></Text>
                    <TextInput style={s.input} placeholder={t.expenses.descriptionPlaceholder} placeholderTextColor={C.textDim} value={desc} onChangeText={setDesc} />
                    <Text style={s.fieldLabel}>{t.expenses.amount} <Text style={s.req}>*</Text></Text>
                    <TextInput style={s.input} placeholder="0.00" placeholderTextColor={C.textDim} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                    <Text style={s.fieldLabel}>{t.expenses.date} <Text style={s.req}>*</Text></Text>
                    <TextInput style={s.input} placeholder={t.expenses.datePlaceholder} placeholderTextColor={C.textDim} value={date} onChangeText={formatDateInput} keyboardType={Platform.OS==='web'?'default':'numeric'} maxLength={10} />
                  </View>
                  <View style={s.formCol}>
                    {txType!=='transfer' && (<>
                      <Text style={s.fieldLabel}>{t.expenses.category}</Text>
                      <Dropdown options={filteredCats.map(c=>({label:c.name,value:c.category_id}))} value={categoryId} onSelect={setCategoryId} allowNull />
                    </>)}
                    <Text style={s.fieldLabel}>{txType==='transfer'?t.expenses.accountFrom:t.expenses.account}</Text>
                    <Dropdown options={accounts.map(a=>({label:a.name,value:a.account_id}))} value={accountId} onSelect={setAccountId} allowNull={txType!=='transfer'} />
                    {txType==='transfer' && (<>
                      <Text style={s.fieldLabel}>{t.expenses.accountTo}</Text>
                      <Dropdown options={accounts.filter(a=>a.account_id!==accountId).map(a=>({label:a.name,value:a.account_id}))} value={destAccountId} onSelect={setDestAccountId} allowNull={false} />
                    </>)}
                    <Text style={s.fieldLabel}>{t.expenses.notes}</Text>
                    <TextInput style={[s.input, s.textArea]} placeholder={t.expenses.notesPlaceholder} placeholderTextColor={C.textDim} value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={s.fieldLabel}>{t.expenses.description} <Text style={s.req}>*</Text></Text>
                  <TextInput style={s.input} placeholder={t.expenses.descriptionPlaceholder} placeholderTextColor={C.textDim} value={desc} onChangeText={setDesc} />
                  <Text style={s.fieldLabel}>{t.expenses.amount} <Text style={s.req}>*</Text></Text>
                  <TextInput style={s.input} placeholder="0.00" placeholderTextColor={C.textDim} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
                  <Text style={s.fieldLabel}>{t.expenses.date} <Text style={s.req}>*</Text></Text>
                  <TextInput style={s.input} placeholder={t.expenses.datePlaceholder} placeholderTextColor={C.textDim} value={date} onChangeText={formatDateInput} keyboardType={Platform.OS==='web'?'default':'numeric'} maxLength={10} />
                  {txType!=='transfer' && (<>
                    <Text style={s.fieldLabel}>{t.expenses.category}</Text>
                    <Dropdown options={filteredCats.map(c=>({label:c.name,value:c.category_id}))} value={categoryId} onSelect={setCategoryId} allowNull />
                  </>)}
                  <Text style={s.fieldLabel}>{txType==='transfer'?t.expenses.accountFrom:t.expenses.account}</Text>
                  <Dropdown options={accounts.map(a=>({label:a.name,value:a.account_id}))} value={accountId} onSelect={setAccountId} allowNull={txType!=='transfer'} />
                  {txType==='transfer' && (<>
                    <Text style={s.fieldLabel}>{t.expenses.accountTo}</Text>
                    <Dropdown options={accounts.filter(a=>a.account_id!==accountId).map(a=>({label:a.name,value:a.account_id}))} value={destAccountId} onSelect={setDestAccountId} allowNull={false} />
                  </>)}
                  <Text style={s.fieldLabel}>{t.expenses.notes}</Text>
                  <TextInput style={[s.input, s.textArea]} placeholder={t.expenses.notesPlaceholder} placeholderTextColor={C.textDim} value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
                </>
              )}

              {txType!=='transfer' && allTags.length>0 && (<>
                <Text style={s.fieldLabel}>{t.expenses.tags}</Text>
                <View style={s.tagRow}>
                  {allTags.map(tag => {
                    const sel = selTagIds.includes(tag.tag_id);
                    return (
                      <Pressable key={tag.tag_id} style={[s.tagChip, sel&&{backgroundColor:tag.color+'22',borderColor:tag.color}]} onPress={() => toggleTag(tag.tag_id)}>
                        <Text style={[s.tagChipText, sel&&{color:tag.color,fontWeight:'700'}]}>{tag.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>)}
            </ScrollView>

            <View style={[s.sheetActions, layout.isDesktop && s.sheetActionsDesktop]}>
              <Pressable style={[s.btn, s.btnCancel]} onPress={() => setModalVisible(false)}>
                <Text style={s.btnCancelText}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={[s.btn, s.btnSave]} onPress={handleSave}>
                <Text style={s.btnSaveText}>{t.common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: { paddingTop: S.lg, paddingBottom: 4 },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.lg, marginBottom: S.md },
  monthArrow: { padding: 4 },
  monthLabel: { fontSize: F.md, fontWeight: '600', color: C.text, minWidth: 160, textAlign: 'center' },

  summaryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: R.md,
    padding: S.lg, marginBottom: S.sm,
    borderWidth: 1, borderColor: C.border,
  },
  summaryCardWide: { padding: 20 },
  summaryPill: { flex: 1, alignItems: 'center' },
  summaryCenter: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: F.xs, color: C.textDim, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  summaryValue: { fontSize: F.md, fontWeight: '700' },
  summaryBalance: { fontSize: F.lg, fontWeight: '800' },
  summaryBalanceWide: { fontSize: F.xl, fontWeight: '800' },
  summaryDivider: { width: 1, height: 36, backgroundColor: C.border },

  billsBar: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.warnBg, borderRadius: R.sm,
    paddingHorizontal: S.md, paddingVertical: 10, marginBottom: S.sm,
    borderWidth: 1, borderColor: C.warn+'44',
  },
  billsBarText: { flex: 1, fontSize: F.sm, color: C.warn, fontWeight: '500' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: R.sm,
    paddingHorizontal: S.md, height: 42, marginBottom: 4,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: F.base, color: C.text },

  listContent: { paddingTop: 4 },
  empty: { alignItems: 'center', paddingTop: 64 },
  emptyText: { fontSize: F.base, color: C.textDim },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint,
    backgroundColor: C.bg, gap: S.md,
  },
  rowPressed: { backgroundColor: C.surfaceHigh },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: F.base, fontWeight: '600', color: C.text, marginBottom: 3 },
  rowSub: { fontSize: F.sm, color: C.textSec },
  rowAmount: { fontSize: F.md, fontWeight: '700' },
  rowAmountSub: { fontSize: F.xs, color: C.textDim, marginTop: 2 },

  transferAvatar: { width: 40, height: 40, borderRadius: R.sm, backgroundColor: C.transferBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  fab: {
    position: 'absolute', right: 20, bottom: 28,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    ...shadow.lg,
  },
  fabWide: { right: 32, bottom: 32 },

  // Sheet
  overlay: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    paddingTop: 12, maxHeight: '93%',
    borderTopWidth: 1, borderColor: C.border,
    width: '100%',
  },
  sheetDesktop: {
    borderRadius: R.xl, maxHeight: '88%',
    maxWidth: 720, width: '100%',
    marginBottom: 32,
    borderWidth: 1,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: F.lg, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 4, paddingHorizontal: 24 },
  sheetContent: { paddingHorizontal: 24, paddingBottom: 8 },
  sheetContentDesktop: { paddingHorizontal: 32 },

  // Desktop 2-col form
  formGrid: { flexDirection: 'row', gap: 20, marginTop: 4 },
  formCol: { flex: 1 },

  typeRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 4 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' },
  typeChipText: { fontSize: F.sm, color: C.textSec, fontWeight: '500' },

  fieldLabel: { fontSize: F.sm, fontWeight: '600', color: C.textSec, marginTop: S.lg, marginBottom: 6 },
  req: { color: C.expense },
  input: { backgroundColor: C.surfaceUp, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: F.base, color: C.text },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 10 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.full, borderWidth: 1.5, borderColor: C.border },
  tagChipText: { fontSize: F.sm, color: C.textSec },

  sheetActions: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 24, paddingVertical: 16,
    paddingBottom: Platform.OS==='ios' ? 32 : 16,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  sheetActionsDesktop: { paddingHorizontal: 32 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: R.sm, alignItems: 'center' },
  btnCancel: { backgroundColor: C.surfaceUp },
  btnSave: { backgroundColor: C.accent },
  btnCancelText: { fontSize: F.base, fontWeight: '600', color: C.textSec },
  btnSaveText: { fontSize: F.base, fontWeight: '700', color: '#fff' },
});
