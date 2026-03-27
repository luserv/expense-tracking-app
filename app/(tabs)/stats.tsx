import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useExpenses, MonthRow } from '../../utils/context';
import { useI18n } from '../../utils/i18n';

const fmt = (n: number) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StatsScreen() {
  const { getYearSummary } = useExpenses();
  const { t } = useI18n();
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<MonthRow[]>([]);

  const load = useCallback(async () => {
    const data = await getYearSummary(year);
    setRows(data);
  }, [year, getYearSummary]);

  useEffect(() => { load(); }, [load]);

  const hasData = rows.some(r => r.income > 0 || r.expense > 0);
  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const totalBalance = totalIncome - totalExpense;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Year selector */}
      <View style={styles.yearRow}>
        <TouchableOpacity onPress={() => setYear(y => y - 1)} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.yearText}>{year}</Text>
        <TouchableOpacity onPress={() => setYear(y => y + 1)} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Annual totals */}
      <Text style={styles.sectionTitle}>{t.stats.annual}</Text>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.incomeCard]}>
          <Text style={styles.cardLabel}>{t.stats.income}</Text>
          <Text style={[styles.cardAmount, styles.incomeText]}>{fmt(totalIncome)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.expenseCard]}>
          <Text style={styles.cardLabel}>{t.stats.expense}</Text>
          <Text style={[styles.cardAmount, styles.expenseText]}>{fmt(totalExpense)}</Text>
        </View>
        <View style={[styles.summaryCard, styles.balanceCard]}>
          <Text style={styles.cardLabel}>{t.stats.balance}</Text>
          <Text style={[styles.cardAmount, totalBalance >= 0 ? styles.incomeText : styles.expenseText]}>
            {fmt(totalBalance)}
          </Text>
        </View>
      </View>

      {/* Monthly breakdown */}
      <Text style={styles.sectionTitle}>{t.stats.monthly}</Text>
      {!hasData ? (
        <Text style={styles.empty}>{t.stats.noData}</Text>
      ) : (
        <View style={styles.table}>
          {/* Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cell, styles.cellMonth, styles.headerText]}></Text>
            <Text style={[styles.cell, styles.cellNum, styles.headerText]}>{t.stats.income}</Text>
            <Text style={[styles.cell, styles.cellNum, styles.headerText]}>{t.stats.expense}</Text>
            <Text style={[styles.cell, styles.cellNum, styles.headerText]}>{t.stats.balance}</Text>
          </View>
          {rows.map((r, i) => {
            const active = r.income > 0 || r.expense > 0;
            return (
              <View key={r.month} style={[styles.tableRow, i % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
                <Text style={[styles.cell, styles.cellMonth, !active && styles.dimText]}>
                  {t.stats.months[r.month - 1]}
                </Text>
                <Text style={[styles.cell, styles.cellNum, active ? styles.incomeText : styles.dimText]}>
                  {active ? fmt(r.income) : '—'}
                </Text>
                <Text style={[styles.cell, styles.cellNum, active ? styles.expenseText : styles.dimText]}>
                  {active ? fmt(r.expense) : '—'}
                </Text>
                <Text style={[styles.cell, styles.cellNum,
                  !active ? styles.dimText : r.balance >= 0 ? styles.incomeText : styles.expenseText]}>
                  {active ? fmt(r.balance) : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 32 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  arrow: { padding: 8 },
  arrowText: { fontSize: 28, color: '#555', lineHeight: 32 },
  yearText: { fontSize: 22, fontWeight: '700', marginHorizontal: 20, color: '#222' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  summaryCard: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  incomeCard: { backgroundColor: '#e8f5e9' },
  expenseCard: { backgroundColor: '#fce4ec' },
  balanceCard: { backgroundColor: '#e3f2fd' },
  cardLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
  cardAmount: { fontSize: 13, fontWeight: '700' },
  incomeText: { color: '#2e7d32' },
  expenseText: { color: '#c62828' },
  table: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff', elevation: 1 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12 },
  tableHeader: { backgroundColor: '#eeeeee' },
  rowEven: { backgroundColor: '#fff' },
  rowOdd: { backgroundColor: '#fafafa' },
  headerText: { fontWeight: '700', color: '#444', fontSize: 12 },
  cell: { fontSize: 13 },
  cellMonth: { flex: 1.2, fontWeight: '600', color: '#333' },
  cellNum: { flex: 2, textAlign: 'right' },
  dimText: { color: '#bbb' },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 15 },
});
