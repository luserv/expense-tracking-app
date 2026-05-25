/**
 * Estadísticas anuales — Segato
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AccountWithBalance, CategoryBreakdown, MonthRow, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { CONTENT_MAX_W, useLayout } from '../../utils/responsive';
import { C, F, R, S, shadow } from '../../utils/theme';

const fmt = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BarFill({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={bar.track}>
      <View style={[bar.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
    </View>
  );
}

const bar = StyleSheet.create({
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.surfaceHigh, overflow: 'hidden' },
  fill:  { height: 8, borderRadius: 4 },
});

function SectionHeading({ label }: { label: string }) {
  return <Text style={s.sectionHead}>{label}</Text>;
}

export default function StatsScreen() {
  const { getYearSummary, getAccountsWithBalance, getCategoryBreakdown } = useExpenses();
  const { t } = useI18n();
  const [year, setYear]         = useState(new Date().getFullYear());
  const [rows, setRows]         = useState<MonthRow[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const l = useLayout();

  const load = useCallback(async () => {
    const [data, accs, cats] = await Promise.all([
      getYearSummary(year),
      getAccountsWithBalance(),
      getCategoryBreakdown(year),
    ]);
    setRows(data);
    setAccounts(accs);
    setBreakdown(cats.filter(c => c.type === 'expense').sort((a, b) => b.total - a.total));
  }, [year, getYearSummary, getAccountsWithBalance, getCategoryBreakdown]);

  useEffect(() => { load(); }, [load]);

  const totalIncome  = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const totalBalance = totalIncome - totalExpense;
  const hasData      = rows.some(r => r.income > 0 || r.expense > 0);
  const maxCat       = breakdown.length > 0 ? breakdown[0].total : 1;
  const totalCat     = breakdown.reduce((s, c) => s + c.total, 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={[s.content, { paddingHorizontal: l.px, paddingTop: l.px }]}>
        <View style={l.isDesktop ? { maxWidth: CONTENT_MAX_W, width: '100%', alignSelf: 'center' } : {}}>

        {/* Year selector */}
        <View style={s.yearRow}>
          <TouchableOpacity onPress={() => setYear(y => y-1)} style={s.yearArrow} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.yearArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.yearText}>{year}</Text>
          <TouchableOpacity onPress={() => setYear(y => y+1)} style={s.yearArrow} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.yearArrowText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Annual totals */}
        <View style={s.totalsRow}>
          <View style={[s.totalCard, { borderColor: C.income + '44' }]}>
            <Text style={s.totalLabel}>{t.stats.income}</Text>
            <Text style={[s.totalAmt, { color: C.income }]}>{fmt(totalIncome)}</Text>
          </View>
          <View style={[s.totalCard, { borderColor: C.border }]}>
            <Text style={s.totalLabel}>{t.stats.balance}</Text>
            <Text style={[s.totalAmt, { color: totalBalance >= 0 ? C.income : C.expense }]}>
              {fmt(totalBalance)}
            </Text>
          </View>
          <View style={[s.totalCard, { borderColor: C.expense + '44' }]}>
            <Text style={s.totalLabel}>{t.stats.expense}</Text>
            <Text style={[s.totalAmt, { color: C.expense }]}>{fmt(totalExpense)}</Text>
          </View>
        </View>

        {/* Account balances */}
        {accounts.length > 0 && (
          <>
            <SectionHeading label={t.stats.accountBalances} />
            <View style={s.card}>
              {accounts.map((a, i) => (
                <View key={a.account_id} style={[s.accRow, i < accounts.length - 1 && s.rowSep]}>
                  <View style={[s.accDot, {
                    backgroundColor: a.account_type === 'liability' ? C.expense + '22' : C.income + '22',
                  }]}>
                    <Text style={{ fontSize: F.xs, fontWeight: '700', color: a.account_type === 'liability' ? C.expense : C.income }}>
                      {a.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.accName}>{a.name}</Text>
                    <Text style={s.accType}>
                      {a.account_type === 'liability' ? 'Pasivo' : 'Activo'} · {a.currency}
                    </Text>
                  </View>
                  <Text style={[s.accBalance, { color: a.balance >= 0 ? C.income : C.expense }]}>
                    {fmt(a.balance)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Category breakdown */}
        <SectionHeading label={t.stats.topCategories} />
        {breakdown.length === 0 ? (
          <Text style={s.empty}>{t.stats.noBreakdown}</Text>
        ) : (
          <View style={s.card}>
            {breakdown.slice(0, 8).map((c, i) => (
              <View key={c.category_id} style={[s.catRow, i < breakdown.length - 1 && s.rowSep]}>
                <View style={[s.catChip, { backgroundColor: c.category_color + '22' }]}>
                  <Text style={{ fontSize: F.xs, fontWeight: '800', color: c.category_color }}>
                    {c.category_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={s.catHeader}>
                    <Text style={s.catName}>{c.category_name}</Text>
                    <Text style={[s.catAmt, { color: C.expense }]}>{fmt(c.total)}</Text>
                  </View>
                  <View style={s.catBarRow}>
                    <BarFill value={c.total} max={maxCat} color={c.category_color} />
                    <Text style={s.catPct}>
                      {totalCat > 0 ? Math.round((c.total / totalCat) * 100) : 0}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Monthly table */}
        <SectionHeading label={t.stats.monthly} />
        {!hasData ? (
          <Text style={s.empty}>{t.stats.noData}</Text>
        ) : (
          <View style={s.card}>
            {/* Header row */}
            <View style={[s.tableRow, s.tableHeaderRow]}>
              <Text style={[s.cell, s.cellMonth, s.headerCell]}></Text>
              <Text style={[s.cell, s.cellNum, s.headerCell]}>{t.stats.income}</Text>
              <Text style={[s.cell, s.cellNum, s.headerCell]}>{t.stats.expense}</Text>
              <Text style={[s.cell, s.cellNum, s.headerCell]}>{t.stats.balance}</Text>
            </View>
            {rows.map((r, i) => {
              const active = r.income > 0 || r.expense > 0;
              return (
                <View key={r.month} style={[s.tableRow, i < rows.length - 1 && s.rowSep]}>
                  <Text style={[s.cell, s.cellMonth, !active && { color: C.textDim }]}>
                    {t.stats.months[r.month - 1]}
                  </Text>
                  <Text style={[s.cell, s.cellNum, { color: active ? C.income : C.textDim }]}>
                    {active ? fmt(r.income) : '—'}
                  </Text>
                  <Text style={[s.cell, s.cellNum, { color: active ? C.expense : C.textDim }]}>
                    {active ? fmt(r.expense) : '—'}
                  </Text>
                  <Text style={[s.cell, s.cellNum, {
                    color: !active ? C.textDim : r.balance >= 0 ? C.income : C.expense,
                  }]}>
                    {active ? fmt(r.balance) : '—'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: S['4xl'] },

  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: S.xl, gap: S.lg },
  yearArrow: { padding: 4 },
  yearArrowText: { fontSize: 30, color: C.textSec, lineHeight: 36 },
  yearText: { fontSize: F['2xl'], fontWeight: '800', color: C.text, minWidth: 72, textAlign: 'center' },

  totalsRow: { flexDirection: 'row', gap: S.sm, marginBottom: S.xl },
  totalCard: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: R.md, padding: S.md,
    alignItems: 'center', borderWidth: 1,
  },
  totalLabel: { fontSize: F.xs, color: C.textDim, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  totalAmt: { fontSize: F.sm, fontWeight: '800' },

  sectionHead: {
    fontSize: F.xs, fontWeight: '700', color: C.textDim,
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: S.sm, marginTop: S['2xl'] - 4,
  },

  card: {
    backgroundColor: C.surface,
    borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },

  rowSep: { borderBottomWidth: 1, borderBottomColor: C.borderFaint },

  // Accounts
  accRow: { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.sm },
  accDot: { width: 36, height: 36, borderRadius: R.xs, alignItems: 'center', justifyContent: 'center' },
  accName: { fontSize: F.base, fontWeight: '600', color: C.text },
  accType: { fontSize: F.xs, color: C.textDim, marginTop: 2 },
  accBalance: { fontSize: F.md, fontWeight: '700' },

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.sm },
  catChip: { width: 36, height: 36, borderRadius: R.xs, alignItems: 'center', justifyContent: 'center' },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  catName: { fontSize: F.sm, fontWeight: '600', color: C.text },
  catAmt: { fontSize: F.sm, fontWeight: '700' },
  catBarRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  catPct: { fontSize: F.xs, color: C.textDim, width: 28, textAlign: 'right', fontWeight: '600' },

  // Monthly table
  tableRow: { flexDirection: 'row', paddingVertical: 11, paddingHorizontal: S.md },
  tableHeaderRow: { backgroundColor: C.surfaceUp },
  headerCell: { color: C.textDim, fontWeight: '700', fontSize: F.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  cell: { fontSize: F.sm, color: C.text },
  cellMonth: { flex: 1.4, fontWeight: '600' },
  cellNum: { flex: 2, textAlign: 'right' },

  empty: { textAlign: 'center', color: C.textDim, marginTop: S.xl, fontSize: F.base, marginBottom: S.xl },
});
