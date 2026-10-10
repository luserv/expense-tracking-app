/**
 * Detalle/edición de transacción — Segato
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Dropdown from '../../components/Dropdown';
import { Account, Category, Tag, useExpenses } from '../../utils/context';
import { useI18n } from '../../utils/i18n';
import { FORM_MAX_W, useLayout } from '../../utils/responsive';
import { C, F, R, S } from '../../utils/theme';

function displayToIso(display: string) {
  const [d, m, y] = display.split('/');
  if (!d || !m || !y || y.length !== 4) return '';
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}
function isoToDisplay(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { getExpense, updateExpense, updateTransfer, deleteExpense, getCategories, getAccounts, getTags, getTagsForExpense, setTagsForExpense } = useExpenses();

  const [loading, setLoading]       = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [allTags, setAllTags]       = useState<Tag[]>([]);
  const [selTagIds, setSelTagIds]   = useState<string[]>([]);

  const [isTransfer, setIsTransfer]       = useState(false);
  const [transferPairId, setTransferPairId] = useState<string | null>(null);
  const [desc, setDesc]                   = useState('');
  const [amount, setAmount]               = useState('');
  const [date, setDate]                   = useState('');
  const [type, setType]                   = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId]       = useState<string | null>(null);
  const [accountId, setAccountId]         = useState<string | null>(null);
  const [destAccountId, setDestAccountId] = useState<string | null>(null);
  const [notes, setNotes]                 = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([getExpense(id), getCategories(), getAccounts(), getTags(), getTagsForExpense(id)])
      .then(([expense, cats, accs, tags, expTags]) => {
        if (expense) {
          setDesc(expense.description); setAmount(String(expense.amount));
          setDate(isoToDisplay(expense.date)); setType(expense.type);
          setCategoryId(expense.category_id ?? null); setAccountId(expense.account_id ?? null);
          setDestAccountId(expense.destination_account_id ?? null);
          setNotes(expense.notes ?? ''); setIsTransfer(!!expense.transfer_pair_id);
          setTransferPairId(expense.transfer_pair_id ?? null);
        }
        setCategories(cats); setAccounts(accs); setAllTags(tags);
        setSelTagIds(expTags.map(t => t.tag_id)); setLoading(false);
      });
  }, [id]);

  const formatDateInput = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let f = digits;
    if (digits.length > 4) f = `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
    else if (digits.length > 2) f = `${digits.slice(0,2)}/${digits.slice(2)}`;
    setDate(f);
  };

  const handleSave = async () => {
    if (!desc.trim()) { alert(t.expenses.descriptionRequired); return; }
    const amt = parseFloat(amount.replace(',', '.'));
    if (!amt || amt <= 0) { alert(t.expenses.amountRequired); return; }
    const isoDate = displayToIso(date);
    if (!isoDate) { alert(t.expenses.dateRequired); return; }
    if (isTransfer && transferPairId) {
      await updateTransfer(transferPairId, { description: desc.trim(), amount: amt, date: isoDate, notes: notes.trim() || null });
    } else {
      const ok = await updateExpense(id!, {
        description: desc.trim(), amount: amt, date: isoDate,
        type, category_id: categoryId, account_id: accountId,
        destination_account_id: null, notes: notes.trim() || null,
      });
      if (ok) await setTagsForExpense(id!, selTagIds);
    }
    router.back();
  };

  const handleDelete = () => {
    const msg = isTransfer ? t.expenses.deleteTransferConfirm : t.expenses.deleteConfirm;
    const doDelete = async () => { await deleteExpense(id!); router.back(); };
    if (Platform.OS === 'web') { if (confirm(msg)) doDelete(); }
    else Alert.alert(t.common.delete, msg, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: doDelete },
    ]);
  };

  const toggleTag = (tagId: string) => {
    setSelTagIds(prev => prev.includes(tagId) ? prev.filter(x => x !== tagId) : [...prev, tagId]);
  };

  const l = useLayout();
  const isWide = !l.isPhone;

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  const filteredCats = categories.filter(c => c.type === type);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={[s.content, { paddingHorizontal: l.px, paddingTop: l.px }]}>
        <View style={isWide ? { maxWidth: FORM_MAX_W, width: '100%', alignSelf: 'center' } : {}}>
        <Text style={s.pageTitle}>
          {isTransfer ? `↔ ${t.common.transfer}` : t.expenses.editExpense}
        </Text>

        {/* Type chips (non-transfers) */}
        {!isTransfer && (
          <>
            <Text style={s.fieldLabel}>{t.expenses.type}</Text>
            <View style={s.typeRow}>
              {(['expense', 'income'] as const).map(tp => {
                const active = type === tp;
                const color = tp === 'expense' ? C.expense : C.income;
                return (
                  <Pressable
                    key={tp}
                    style={[s.typeChip, active && { backgroundColor: color + '22', borderColor: color }]}
                    onPress={() => { setType(tp); setCategoryId(null); }}
                  >
                    <Text style={[s.typeChipText, active && { color, fontWeight: '700' }]}>
                      {tp === 'expense' ? t.common.expense : t.common.income}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Transfer accounts info */}
        {isTransfer && (
          <View style={s.transferBox}>
            <View style={s.transferRow}>
              <Text style={s.transferLabel}>{t.expenses.accountFrom}</Text>
              <Text style={s.transferValue}>{accounts.find(a => a.account_id === accountId)?.name ?? '—'}</Text>
            </View>
            <View style={s.transferArrowRow}>
              <Text style={s.transferArrow}>↓</Text>
            </View>
            <View style={s.transferRow}>
              <Text style={s.transferLabel}>{t.expenses.accountTo}</Text>
              <Text style={s.transferValue}>{accounts.find(a => a.account_id === destAccountId)?.name ?? '—'}</Text>
            </View>
            <Text style={s.transferHint}>
              {t.common.transfer} · {t.expenses.transferHint}
            </Text>
          </View>
        )}

        {/* Description */}
        <Text style={s.fieldLabel}>{t.expenses.description} <Text style={{ color: C.expense }}>*</Text></Text>
        <TextInput style={s.input} value={desc} onChangeText={setDesc} placeholder={t.expenses.descriptionPlaceholder} placeholderTextColor={C.textDim} />

        {/* Amount */}
        <Text style={s.fieldLabel}>{t.expenses.amount} <Text style={{ color: C.expense }}>*</Text></Text>
        <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textDim} />

        {/* Date */}
        <Text style={s.fieldLabel}>{t.expenses.date} <Text style={{ color: C.expense }}>*</Text></Text>
        <TextInput style={s.input} value={date} onChangeText={formatDateInput} keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'} maxLength={10} placeholder={t.expenses.datePlaceholder} placeholderTextColor={C.textDim} />

        {/* Category */}
        {!isTransfer && (
          <>
            <Text style={s.fieldLabel}>{t.expenses.category}</Text>
            <Dropdown options={filteredCats.map(c => ({ label: c.name, value: c.category_id }))} value={categoryId} onSelect={setCategoryId} allowNull />
          </>
        )}

        {/* Account */}
        {!isTransfer && (
          <>
            <Text style={s.fieldLabel}>{t.expenses.account}</Text>
            <Dropdown options={accounts.map(a => ({ label: a.name, value: a.account_id }))} value={accountId} onSelect={setAccountId} allowNull />
          </>
        )}

        {/* Notes */}
        <Text style={s.fieldLabel}>{t.expenses.notes}</Text>
        <TextInput style={[s.input, s.textArea]} value={notes} onChangeText={setNotes} placeholder={t.expenses.notesPlaceholder} multiline numberOfLines={3} placeholderTextColor={C.textDim} />

        {/* Tags */}
        {!isTransfer && allTags.length > 0 && (
          <>
            <Text style={s.fieldLabel}>{t.expenses.tags}</Text>
            <View style={s.tagRow}>
              {allTags.map(tag => {
                const sel = selTagIds.includes(tag.tag_id);
                return (
                  <Pressable
                    key={tag.tag_id}
                    style={[s.tagChip, sel && { backgroundColor: tag.color + '22', borderColor: tag.color }]}
                    onPress={() => toggleTag(tag.tag_id)}
                  >
                    <Text style={[s.tagChipText, sel && { color: tag.color, fontWeight: '700' }]}>{tag.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Actions */}
        <Pressable
          style={({ pressed }) => [s.btnSave, pressed && { opacity: 0.88 }]}
          onPress={handleSave}
        >
          <Text style={s.btnSaveText}>{t.common.save}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.btnDelete, pressed && { backgroundColor: C.expenseBg }]}
          onPress={handleDelete}
        >
          <Text style={s.btnDeleteText}>{t.common.delete}</Text>
        </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: S['4xl'] },
  pageTitle: { fontSize: F.xl, fontWeight: '800', color: C.text, marginBottom: S.xl },

  typeRow: { flexDirection: 'row', gap: S.sm, marginBottom: 4 },
  typeChip: {
    flex: 1, paddingVertical: 10, borderRadius: R.sm,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center',
  },
  typeChipText: { fontSize: F.sm, color: C.textSec, fontWeight: '500' },

  transferBox: {
    backgroundColor: C.transferBg, borderRadius: R.md,
    padding: S.md, marginBottom: 4,
    borderWidth: 1, borderColor: C.transfer + '44',
  },
  transferRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  transferLabel: { fontSize: F.sm, color: C.transfer, fontWeight: '600' },
  transferValue: { fontSize: F.sm, color: C.text, fontWeight: '600' },
  transferArrowRow: { alignItems: 'center', paddingVertical: 2 },
  transferArrow: { fontSize: 18, color: C.transfer },
  transferHint: { fontSize: F.xs, color: C.transfer + 'AA', marginTop: S.xs },

  fieldLabel: { fontSize: F.sm, fontWeight: '600', color: C.textSec, marginTop: S.lg, marginBottom: 6 },
  input: {
    backgroundColor: C.surfaceUp, borderWidth: 1, borderColor: C.border,
    borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: F.base, color: C.text,
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 10 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: 4 },
  tagChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: R.full, borderWidth: 1.5, borderColor: C.border,
  },
  tagChipText: { fontSize: F.sm, color: C.textSec },

  btnSave: {
    marginTop: S['3xl'], backgroundColor: C.accent,
    paddingVertical: 15, borderRadius: R.sm, alignItems: 'center',
  },
  btnSaveText: { color: '#fff', fontSize: F.base, fontWeight: '700' },
  btnDelete: {
    marginTop: S.sm, paddingVertical: 15, borderRadius: R.sm,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.expense + '66',
  },
  btnDeleteText: { color: C.expense, fontSize: F.base, fontWeight: '600' },
});
