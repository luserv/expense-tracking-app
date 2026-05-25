/**
 * Configuración — Segato
 */
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { downloadDB, uploadDB } from '../../utils/driveSync';
import {
  Alert,
  Linking,
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
import { useAuth } from '../../utils/authContext';
import { Account, Bill, Category, DB_NAME, Tag, useExpenses } from '../../utils/context';
import { Lang, useI18n } from '../../utils/i18n';
import { CONTENT_MAX_W, FORM_MAX_W, useLayout } from '../../utils/responsive';
import { C, F, R, S } from '../../utils/theme';

const PAYPAL_ME     = process.env.EXPO_PUBLIC_PAYPAL_ME      ?? 'https://paypal.me/TUUSUARIO';
const LICENSE_PRICE = process.env.EXPO_PUBLIC_LICENSE_PRICE  ?? '4.99';
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL  ?? 'tu@email.com';
const DB_PATH       = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

const PRESET_COLORS = [
  '#F64458','#FB923C','#F59E0B','#10D982','#14B8A6',
  '#38BDF8','#5B7CF6','#8B5CF6','#EC4899','#A78BFA',
  '#10D982','#64748B','#94A3B8','#F43F5E','#E879F9',
];

const FREQUENCIES: Array<{ value: Bill['frequency']; labelEs: string; labelEn: string }> = [
  { value: 'daily',   labelEs: 'Diario',   labelEn: 'Daily' },
  { value: 'weekly',  labelEs: 'Semanal',  labelEn: 'Weekly' },
  { value: 'monthly', labelEs: 'Mensual',  labelEn: 'Monthly' },
  { value: 'yearly',  labelEs: 'Anual',    labelEn: 'Yearly' },
];

function todayIso() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}
function displayToIso(s: string) {
  const [d, m, y] = s.split('/');
  if (!d || !m || !y || y.length !== 4) return '';
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}
function isoToDisplay(s: string) {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}
function daysUntil(isoDate: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(isoDate + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[s.card, style]}>{children}</View>;
}
function CardHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <View style={s.cardHeader}>
      <Text style={s.cardTitle}>{title}</Text>
      {desc ? <Text style={s.cardDesc}>{desc}</Text> : null}
    </View>
  );
}

export default function Config() {
  const [status, setStatus]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [bills, setBillsState]      = useState<Bill[]>([]);
  const [tags, setTagsState]        = useState<Tag[]>([]);

  // Category modal
  const [catModal, setCatModal]   = useState(false);
  const [catName, setCatName]     = useState('');
  const [catType, setCatType]     = useState<'expense' | 'income'>('expense');
  const [catColor, setCatColor]   = useState(PRESET_COLORS[0]);

  // Account modal
  const [accModal, setAccModal]   = useState(false);
  const [accName, setAccName]     = useState('');
  const [accCurrency, setAccCurrency] = useState('USD');
  const [accType, setAccType]     = useState<'asset' | 'liability'>('asset');

  // Bill modal
  const [billModal, setBillModal] = useState(false);
  const [billEditId, setBillEditId] = useState<string | null>(null);
  const [billName, setBillName]   = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billType, setBillType]   = useState<'expense' | 'income'>('expense');
  const [billFreq, setBillFreq]   = useState<Bill['frequency']>('monthly');
  const [billNextDate, setBillNextDate] = useState('');
  const [billNotes, setBillNotes] = useState('');

  // Tag modal
  const [tagModal, setTagModal] = useState(false);
  const [tagName, setTagName]   = useState('');
  const [tagColor, setTagColor] = useState(PRESET_COLORS[6]);

  const {
    getCategories, createCategory,
    getAccounts, createAccount,
    getBills, createBill, updateBill, deleteBill, payBill, skipBill,
    getTags, createTag, deleteTag,
  } = useExpenses();
  const { t, lang, setLang } = useI18n();
  const { user, licensed, signOutUser, driveToken } = useAuth();
  const l = useLayout();
  const isWide = !l.isPhone;
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronFS;

  const freqLabel = (f: Bill['frequency']) => {
    const item = FREQUENCIES.find(x => x.value === f);
    return lang === 'es' ? item?.labelEs : item?.labelEn;
  };

  const loadData = async () => {
    const [cats, accs, b, tgs] = await Promise.all([getCategories(), getAccounts(), getBills(), getTags()]);
    setCategories(cats); setAccounts(accs); setBillsState(b); setTagsState(tgs);
  };
  useEffect(() => { loadData(); }, []);

  // DB export
  const handleExport = async () => {
    try {
      setIsLoading(true); setStatus(null);
      if (typeof window !== 'undefined' && (window as any).electronFS) {
        const r = await (window as any).electronFS.exportDB();
        if (r.canceled) return;
        if (r.error) { setStatus(t.config.exportErrorPrefix + r.error); return; }
        setStatus(t.config.exportSuccess); return;
      }
      const dbInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (!dbInfo.exists) { setStatus(t.config.dbNotFound); return; }
      const exportPath = `${FileSystem.cacheDirectory}gastos_backup_${Date.now()}.db`;
      await FileSystem.copyAsync({ from: DB_PATH, to: exportPath });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { setStatus(t.config.sharingUnavailable); return; }
      await Sharing.shareAsync(exportPath, { mimeType: 'application/octet-stream', dialogTitle: t.config.exportBtn, UTI: 'public.database' });
      setStatus(t.config.exportSuccess);
    } catch (e) {
      setStatus(t.config.exportErrorPrefix + (e instanceof Error ? e.message : String(e)));
    } finally { setIsLoading(false); }
  };

  const handleImport = async () => {
    if (typeof window !== 'undefined' && (window as any).electronFS) {
      if (!confirm(t.config.importConfirm)) return;
      try {
        setIsLoading(true); setStatus(null);
        const r = await (window as any).electronFS.importDB();
        if (r.canceled) return;
        if (r.error) { setStatus(t.config.importErrorPrefix + r.error); return; }
        setStatus(t.config.importSuccess); await loadData();
      } catch (e) {
        setStatus(t.config.importErrorPrefix + (e instanceof Error ? e.message : String(e)));
      } finally { setIsLoading(false); }
      return;
    }
    Alert.alert(t.config.importTitle, t.config.importConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.config.importContinue, style: 'destructive', onPress: async () => {
        try {
          setIsLoading(true); setStatus(null);
          const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
          if (r.canceled) { setIsLoading(false); return; }
          const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
          const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
          if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
          await FileSystem.copyAsync({ from: r.assets[0].uri, to: DB_PATH });
          setStatus(t.config.importSuccess);
          Alert.alert(t.config.importSuccessTitle, t.config.importSuccessMsg);
        } catch (e) {
          setStatus(t.config.importErrorPrefix + (e instanceof Error ? e.message : String(e)));
        } finally { setIsLoading(false); }
      }},
    ]);
  };

  const handleDriveUpload = async () => {
    if (!driveToken) { setStatus(t.drive.signInRequired); return; }
    try {
      setIsLoading(true); setStatus(null);
      let base64: string;
      if (typeof window !== 'undefined' && (window as any).electronDrive) {
        base64 = await (window as any).electronDrive.readDBAsBase64();
      } else {
        base64 = await FileSystem.readAsStringAsync(DB_PATH, { encoding: FileSystem.EncodingType.Base64 });
      }
      await uploadDB(driveToken, base64); setStatus(t.drive.uploadSuccess);
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') setStatus(t.drive.tokenExpired);
      else setStatus(t.drive.errorPrefix + e.message);
    } finally { setIsLoading(false); }
  };

  const handleDriveRestore = async () => {
    if (!driveToken) { setStatus(t.drive.signInRequired); return; }
    const doRestore = async () => {
      try {
        setIsLoading(true); setStatus(null);
        const base64 = await downloadDB(driveToken);
        if (typeof window !== 'undefined' && (window as any).electronDrive) {
          const r = await (window as any).electronDrive.writeDBFromBase64(base64);
          if (r?.error) throw new Error(r.error);
        } else {
          const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
          const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
          if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
          await FileSystem.writeAsStringAsync(DB_PATH, base64, { encoding: FileSystem.EncodingType.Base64 });
        }
        setStatus(t.drive.restoreSuccess);
      } catch (e: any) {
        if (e.message === 'TOKEN_EXPIRED') setStatus(t.drive.tokenExpired);
        else if (e.message === 'NO_BACKUP') setStatus(t.drive.notFound);
        else setStatus(t.drive.errorPrefix + e.message);
      } finally { setIsLoading(false); }
    };
    if (typeof window !== 'undefined' && (window as any).electronDrive) {
      if (confirm(t.config.importConfirm)) doRestore();
    } else {
      Alert.alert(t.config.importTitle, t.config.importConfirm, [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.config.importContinue, style: 'destructive', onPress: doRestore },
      ]);
    }
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) return;
    await createCategory({ name: catName.trim(), color: catColor, type: catType, icon: null });
    setCatModal(false);
    setCategories(await getCategories());
  };

  const handleSaveAccount = async () => {
    if (!accName.trim()) return;
    await createAccount(accName.trim(), accCurrency.trim() || 'USD', accType);
    setAccModal(false);
    setAccounts(await getAccounts());
  };

  const handleSaveBill = async () => {
    if (!billName.trim()) { alert(t.bills.nameRequired); return; }
    const amt = parseFloat(billAmount.replace(',', '.'));
    if (!amt || amt <= 0) { alert(t.bills.amountRequired); return; }
    const isoDate = displayToIso(billNextDate);
    if (!isoDate) { alert(t.bills.dateRequired); return; }
    const data = { name: billName.trim(), amount: amt, type: billType, frequency: billFreq, next_date: isoDate, active: 1, notes: billNotes.trim() || null, category_id: null, account_id: null };
    if (billEditId) await updateBill(billEditId, data);
    else await createBill(data);
    setBillModal(false);
    setBillsState(await getBills());
  };

  const handleDeleteBill = (id: string) => {
    const doDelete = async () => { await deleteBill(id); setBillsState(await getBills()); };
    if (Platform.OS === 'web') { if (confirm(t.bills.deleteConfirm)) doDelete(); }
    else Alert.alert(t.common.delete, t.bills.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: doDelete },
    ]);
  };

  const handleSaveTag = async () => {
    if (!tagName.trim()) { alert(t.tags.nameRequired); return; }
    await createTag(tagName.trim(), tagColor);
    setTagModal(false);
    setTagsState(await getTags());
  };

  const handleDeleteTag = (id: string) => {
    const doDelete = async () => { await deleteTag(id); setTagsState(await getTags()); };
    if (Platform.OS === 'web') { if (confirm(t.tags.deleteConfirm)) doDelete(); }
    else Alert.alert(t.common.delete, t.tags.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: doDelete },
    ]);
  };

  const formatDateBill = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let f = digits;
    if (digits.length > 4) f = `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
    else if (digits.length > 2) f = `${digits.slice(0,2)}/${digits.slice(2)}`;
    setBillNextDate(f);
  };

  // Shared modal styles
  const overlayStyle = [s.overlay, isWide && s.overlayDesktop];
  const sheetStyle   = [s.sheet, isWide && s.sheetDesktop];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={[s.content, { paddingHorizontal: l.px, paddingTop: l.px }]}>
        <View style={l.isDesktop ? { maxWidth: CONTENT_MAX_W, width: '100%', alignSelf: 'center' } : {}}>
          <Text style={s.pageTitle}>{t.config.title}</Text>

          {/* On wide screens: 2-col grid for non-primary cards */}
          {isWide ? (
            <>
              {/* Row 1: Language + Account (user) side by side */}
              <View style={s.cardRow}>
                {/* Language */}
                <SectionCard style={s.cardHalf}>
                  <CardHeader title={t.config.language} desc={t.config.languageDesc} />
                  <View style={s.langRow}>
                    {LANGS.map(l => (
                      <Pressable
                        key={l.code}
                        style={[s.langBtn, lang === l.code && s.langBtnActive]}
                        onPress={() => setLang(l.code)}
                      >
                        <Text style={s.langFlag}>{l.flag}</Text>
                        <Text style={[s.langLabel, lang === l.code && { color: C.accent, fontWeight: '700' }]}>{l.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </SectionCard>

                {/* User account */}
                <SectionCard style={s.cardHalf}>
                  <CardHeader title={lang === 'es' ? 'Cuenta' : 'Account'} />
                  <Text style={s.userEmail}>{user?.email}</Text>
                  <View style={[s.licenseBadge, licensed ? s.licensedBadge : s.freeBadge]}>
                    <Text style={[s.licenseBadgeText, { color: licensed ? C.income : C.textSec }]}>
                      {licensed ? (lang === 'es' ? 'Licencia activa' : 'Active license') : (lang === 'es' ? 'Plan gratuito' : 'Free plan')}
                    </Text>
                  </View>
                  <Pressable style={[s.addRowBtn, { borderColor: C.expense + '44' }]} onPress={signOutUser}>
                    <Text style={[s.addRowBtnText, { color: C.expense }]}>{lang === 'es' ? 'Cerrar sesión' : 'Sign out'}</Text>
                  </Pressable>
                </SectionCard>
              </View>

              {/* Row 2: Categories + Accounts side by side */}
              <View style={s.cardRow}>
                {/* Categories */}
                <SectionCard style={s.cardHalf}>
                  <CardHeader title={t.config.categories} desc={t.config.categoriesDesc} />
                  <View style={s.chipRow}>
                    {categories.map(c => (
                      <View key={c.category_id} style={[s.catChip, { backgroundColor: c.color + '1A', borderColor: c.color + '55' }]}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.color }} />
                        <Text style={[s.chipText, { color: c.color }]}>{c.name}</Text>
                      </View>
                    ))}
                  </View>
                  <Pressable style={s.addRowBtn} onPress={() => { setCatName(''); setCatType('expense'); setCatColor(PRESET_COLORS[0]); setCatModal(true); }}>
                    <Text style={s.addRowBtnText}>{t.config.addCategory}</Text>
                  </Pressable>
                </SectionCard>

                {/* Accounts */}
                <SectionCard style={s.cardHalf}>
                  <CardHeader title={t.config.accounts} desc={t.config.accountsDesc} />
                  {accounts.map((a, i) => (
                    <View key={a.account_id} style={[s.accRow, i < accounts.length - 1 && s.rowSep]}>
                      <View style={[s.accAvatar, { backgroundColor: a.account_type === 'liability' ? C.expenseBg : C.accentBg }]}>
                        <Text style={{ fontSize: F.sm, fontWeight: '800', color: a.account_type === 'liability' ? C.expense : C.accent }}>
                          {a.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.accName}>{a.name}</Text>
                        <Text style={s.accMeta}>
                          {a.account_type === 'liability'
                            ? (lang === 'es' ? 'Pasivo' : 'Liability')
                            : (lang === 'es' ? 'Activo' : 'Asset')
                          } · {a.currency}
                        </Text>
                      </View>
                    </View>
                  ))}
                  <Pressable style={s.addRowBtn} onPress={() => { setAccName(''); setAccCurrency('USD'); setAccType('asset'); setAccModal(true); }}>
                    <Text style={s.addRowBtnText}>{t.config.addAccount}</Text>
                  </Pressable>
                </SectionCard>
              </View>

              {/* Bills — full width */}
              <SectionCard>
                <CardHeader
                  title={t.bills.title}
                  desc={lang === 'es' ? 'Gestioná tus facturas y pagos recurrentes.' : 'Manage your recurring bills and payments.'}
                />
                <BillsList bills={bills} lang={lang} t={t} freqLabel={freqLabel} getBills={getBills} setBillsState={setBillsState}
                  payBill={payBill} skipBill={skipBill} handleDeleteBill={handleDeleteBill}
                  onEdit={(bill) => { setBillEditId(bill.bill_id); setBillName(bill.name); setBillAmount(String(bill.amount)); setBillType(bill.type); setBillFreq(bill.frequency); setBillNextDate(isoToDisplay(bill.next_date)); setBillNotes(bill.notes ?? ''); setBillModal(true); }}
                />
                <Pressable style={s.addRowBtn} onPress={() => { setBillEditId(null); setBillName(''); setBillAmount(''); setBillType('expense'); setBillFreq('monthly'); setBillNextDate(isoToDisplay(todayIso())); setBillNotes(''); setBillModal(true); }}>
                  <Text style={s.addRowBtnText}>{t.bills.add}</Text>
                </Pressable>
              </SectionCard>

              {/* Tags — full width */}
              <SectionCard>
                <CardHeader
                  title={t.tags.title}
                  desc={lang === 'es' ? 'Etiquetá tus transacciones para organizarlas mejor.' : 'Tag your transactions for better organization.'}
                />
                {tags.length === 0 ? (
                  <Text style={s.emptyHint}>{t.tags.empty}</Text>
                ) : (
                  <View style={s.chipRow}>
                    {tags.map(tag => (
                      <Pressable
                        key={tag.tag_id}
                        style={[s.tagChip, { backgroundColor: tag.color + '1A', borderColor: tag.color + '66' }]}
                        onLongPress={() => handleDeleteTag(tag.tag_id)}
                      >
                        <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: tag.color }]} />
                        <Text style={[s.chipText, { color: tag.color }]}>{tag.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {tags.length > 0 && (
                  <Text style={s.hintText}>{lang === 'es' ? 'Mantené presionada una etiqueta para eliminarla.' : 'Long-press a tag to delete it.'}</Text>
                )}
                <Pressable style={[s.addRowBtn, { borderColor: C.transfer + '44' }]} onPress={() => { setTagName(''); setTagColor(PRESET_COLORS[6]); setTagModal(true); }}>
                  <Text style={[s.addRowBtnText, { color: C.transfer }]}>{t.tags.add}</Text>
                </Pressable>
              </SectionCard>

              {/* Row 3: Drive + Database side by side */}
              {(driveToken || true) && (
                <View style={s.cardRow}>
                  {driveToken && (
                    <SectionCard style={s.cardHalf}>
                      <CardHeader title={t.drive.title} desc={t.drive.desc} />
                      <Pressable style={[s.addRowBtn, { borderColor: '#1A73E8' + '66' }]} onPress={handleDriveUpload} disabled={isLoading}>
                        <Text style={[s.addRowBtnText, { color: '#1A73E8' }]}>{isLoading ? t.drive.uploading : t.drive.upload}</Text>
                      </Pressable>
                      <Pressable style={[s.addRowBtn, { borderColor: '#34A853' + '66' }]} onPress={handleDriveRestore} disabled={isLoading}>
                        <Text style={[s.addRowBtnText, { color: '#34A853' }]}>{isLoading ? t.drive.restoring : t.drive.restore}</Text>
                      </Pressable>
                      {status && <StatusBox status={status} />}
                    </SectionCard>
                  )}
                  <SectionCard style={driveToken ? s.cardHalf : { flex: 1 }}>
                    <CardHeader title={t.config.database} desc={t.config.databaseDesc} />
                    <Pressable style={s.addRowBtn} onPress={handleExport} disabled={isLoading}>
                      <Text style={s.addRowBtnText}>{t.config.exportBtn}</Text>
                    </Pressable>
                    <Pressable style={[s.addRowBtn, { borderColor: C.income + '44' }]} onPress={handleImport} disabled={isLoading}>
                      <Text style={[s.addRowBtnText, { color: C.income }]}>{t.config.importBtn}</Text>
                    </Pressable>
                    {status && <StatusBox status={status} />}
                  </SectionCard>
                </View>
              )}

              {/* Upgrade — full width */}
              {!licensed && user && !isElectron && (
                <SectionCard>
                  <CardHeader
                    title={lang === 'es' ? 'Quitar anuncios' : 'Remove ads'}
                    desc={lang === 'es' ? `Pago único, sin suscripción. $${LICENSE_PRICE} USD.` : `One-time payment, no subscription. $${LICENSE_PRICE} USD.`}
                  />
                  <Text style={s.upgradeStep}>1. {lang === 'es' ? 'Copiá tu ID:' : 'Copy your ID:'}</Text>
                  <TextInput style={s.uidInput} value={user.uid} editable={false} selectTextOnFocus />
                  <Text style={s.upgradeStep}>2. {lang === 'es' ? 'Pagá con PayPal:' : 'Pay with PayPal:'}</Text>
                  <Pressable style={[s.addRowBtn, { backgroundColor: '#003087', borderColor: '#003087' }]} onPress={() => Linking.openURL(PAYPAL_ME)}>
                    <Text style={[s.addRowBtnText, { color: '#fff' }]}>PayPal — ${LICENSE_PRICE}</Text>
                  </Pressable>
                  <Text style={s.upgradeHint}>
                    3.{' '}
                    <Text style={{ color: C.textSec }}>{lang === 'es' ? 'Enviá el comprobante + ID a ' : 'Send receipt + ID to '}</Text>
                    <Text style={{ color: C.accent, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
                      {SUPPORT_EMAIL}
                    </Text>
                  </Text>
                </SectionCard>
              )}
            </>
          ) : (
            /* Phone: single column stacked layout */
            <>
              {/* Language */}
              <SectionCard>
                <CardHeader title={t.config.language} desc={t.config.languageDesc} />
                <View style={s.langRow}>
                  {LANGS.map(l => (
                    <Pressable
                      key={l.code}
                      style={[s.langBtn, lang === l.code && s.langBtnActive]}
                      onPress={() => setLang(l.code)}
                    >
                      <Text style={s.langFlag}>{l.flag}</Text>
                      <Text style={[s.langLabel, lang === l.code && { color: C.accent, fontWeight: '700' }]}>{l.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </SectionCard>

              {/* Bills */}
              <SectionCard>
                <CardHeader
                  title={t.bills.title}
                  desc={lang === 'es' ? 'Gestioná tus facturas y pagos recurrentes.' : 'Manage your recurring bills and payments.'}
                />
                <BillsList bills={bills} lang={lang} t={t} freqLabel={freqLabel} getBills={getBills} setBillsState={setBillsState}
                  payBill={payBill} skipBill={skipBill} handleDeleteBill={handleDeleteBill}
                  onEdit={(bill) => { setBillEditId(bill.bill_id); setBillName(bill.name); setBillAmount(String(bill.amount)); setBillType(bill.type); setBillFreq(bill.frequency); setBillNextDate(isoToDisplay(bill.next_date)); setBillNotes(bill.notes ?? ''); setBillModal(true); }}
                />
                <Pressable style={s.addRowBtn} onPress={() => { setBillEditId(null); setBillName(''); setBillAmount(''); setBillType('expense'); setBillFreq('monthly'); setBillNextDate(isoToDisplay(todayIso())); setBillNotes(''); setBillModal(true); }}>
                  <Text style={s.addRowBtnText}>{t.bills.add}</Text>
                </Pressable>
              </SectionCard>

              {/* Tags */}
              <SectionCard>
                <CardHeader
                  title={t.tags.title}
                  desc={lang === 'es' ? 'Etiquetá tus transacciones para organizarlas mejor.' : 'Tag your transactions for better organization.'}
                />
                {tags.length === 0 ? (
                  <Text style={s.emptyHint}>{t.tags.empty}</Text>
                ) : (
                  <View style={s.chipRow}>
                    {tags.map(tag => (
                      <Pressable
                        key={tag.tag_id}
                        style={[s.tagChip, { backgroundColor: tag.color + '1A', borderColor: tag.color + '66' }]}
                        onLongPress={() => handleDeleteTag(tag.tag_id)}
                      >
                        <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: tag.color }]} />
                        <Text style={[s.chipText, { color: tag.color }]}>{tag.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {tags.length > 0 && (
                  <Text style={s.hintText}>{lang === 'es' ? 'Mantené presionada una etiqueta para eliminarla.' : 'Long-press a tag to delete it.'}</Text>
                )}
                <Pressable style={[s.addRowBtn, { borderColor: C.transfer + '44' }]} onPress={() => { setTagName(''); setTagColor(PRESET_COLORS[6]); setTagModal(true); }}>
                  <Text style={[s.addRowBtnText, { color: C.transfer }]}>{t.tags.add}</Text>
                </Pressable>
              </SectionCard>

              {/* Categories */}
              <SectionCard>
                <CardHeader title={t.config.categories} desc={t.config.categoriesDesc} />
                <View style={s.chipRow}>
                  {categories.map(c => (
                    <View key={c.category_id} style={[s.catChip, { backgroundColor: c.color + '1A', borderColor: c.color + '55' }]}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.color }} />
                      <Text style={[s.chipText, { color: c.color }]}>{c.name}</Text>
                    </View>
                  ))}
                </View>
                <Pressable style={s.addRowBtn} onPress={() => { setCatName(''); setCatType('expense'); setCatColor(PRESET_COLORS[0]); setCatModal(true); }}>
                  <Text style={s.addRowBtnText}>{t.config.addCategory}</Text>
                </Pressable>
              </SectionCard>

              {/* Accounts */}
              <SectionCard>
                <CardHeader title={t.config.accounts} desc={t.config.accountsDesc} />
                {accounts.map((a, i) => (
                  <View key={a.account_id} style={[s.accRow, i < accounts.length - 1 && s.rowSep]}>
                    <View style={[s.accAvatar, { backgroundColor: a.account_type === 'liability' ? C.expenseBg : C.accentBg }]}>
                      <Text style={{ fontSize: F.sm, fontWeight: '800', color: a.account_type === 'liability' ? C.expense : C.accent }}>
                        {a.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.accName}>{a.name}</Text>
                      <Text style={s.accMeta}>
                        {a.account_type === 'liability'
                          ? (lang === 'es' ? 'Pasivo' : 'Liability')
                          : (lang === 'es' ? 'Activo' : 'Asset')
                        } · {a.currency}
                      </Text>
                    </View>
                  </View>
                ))}
                <Pressable style={s.addRowBtn} onPress={() => { setAccName(''); setAccCurrency('USD'); setAccType('asset'); setAccModal(true); }}>
                  <Text style={s.addRowBtnText}>{t.config.addAccount}</Text>
                </Pressable>
              </SectionCard>

              {/* User account */}
              <SectionCard>
                <CardHeader title={lang === 'es' ? 'Cuenta' : 'Account'} />
                <Text style={s.userEmail}>{user?.email}</Text>
                <View style={[s.licenseBadge, licensed ? s.licensedBadge : s.freeBadge]}>
                  <Text style={[s.licenseBadgeText, { color: licensed ? C.income : C.textSec }]}>
                    {licensed ? (lang === 'es' ? 'Licencia activa' : 'Active license') : (lang === 'es' ? 'Plan gratuito' : 'Free plan')}
                  </Text>
                </View>
                <Pressable style={[s.addRowBtn, { borderColor: C.expense + '44' }]} onPress={signOutUser}>
                  <Text style={[s.addRowBtnText, { color: C.expense }]}>{lang === 'es' ? 'Cerrar sesión' : 'Sign out'}</Text>
                </Pressable>
              </SectionCard>

              {/* Upgrade */}
              {!licensed && user && !isElectron && (
                <SectionCard>
                  <CardHeader
                    title={lang === 'es' ? 'Quitar anuncios' : 'Remove ads'}
                    desc={lang === 'es' ? `Pago único, sin suscripción. $${LICENSE_PRICE} USD.` : `One-time payment, no subscription. $${LICENSE_PRICE} USD.`}
                  />
                  <Text style={s.upgradeStep}>1. {lang === 'es' ? 'Copiá tu ID:' : 'Copy your ID:'}</Text>
                  <TextInput style={s.uidInput} value={user.uid} editable={false} selectTextOnFocus />
                  <Text style={s.upgradeStep}>2. {lang === 'es' ? 'Pagá con PayPal:' : 'Pay with PayPal:'}</Text>
                  <Pressable style={[s.addRowBtn, { backgroundColor: '#003087', borderColor: '#003087' }]} onPress={() => Linking.openURL(PAYPAL_ME)}>
                    <Text style={[s.addRowBtnText, { color: '#fff' }]}>PayPal — ${LICENSE_PRICE}</Text>
                  </Pressable>
                  <Text style={s.upgradeHint}>
                    3.{' '}
                    <Text style={{ color: C.textSec }}>{lang === 'es' ? 'Enviá el comprobante + ID a ' : 'Send receipt + ID to '}</Text>
                    <Text style={{ color: C.accent, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
                      {SUPPORT_EMAIL}
                    </Text>
                  </Text>
                </SectionCard>
              )}

              {/* Google Drive */}
              {driveToken && (
                <SectionCard>
                  <CardHeader title={t.drive.title} desc={t.drive.desc} />
                  <Pressable style={[s.addRowBtn, { borderColor: '#1A73E8' + '66' }]} onPress={handleDriveUpload} disabled={isLoading}>
                    <Text style={[s.addRowBtnText, { color: '#1A73E8' }]}>{isLoading ? t.drive.uploading : t.drive.upload}</Text>
                  </Pressable>
                  <Pressable style={[s.addRowBtn, { borderColor: '#34A853' + '66' }]} onPress={handleDriveRestore} disabled={isLoading}>
                    <Text style={[s.addRowBtnText, { color: '#34A853' }]}>{isLoading ? t.drive.restoring : t.drive.restore}</Text>
                  </Pressable>
                  {status && <StatusBox status={status} />}
                </SectionCard>
              )}

              {/* Database */}
              <SectionCard>
                <CardHeader title={t.config.database} desc={t.config.databaseDesc} />
                <Pressable style={s.addRowBtn} onPress={handleExport} disabled={isLoading}>
                  <Text style={s.addRowBtnText}>{t.config.exportBtn}</Text>
                </Pressable>
                <Pressable style={[s.addRowBtn, { borderColor: C.income + '44' }]} onPress={handleImport} disabled={isLoading}>
                  <Text style={[s.addRowBtnText, { color: C.income }]}>{t.config.importBtn}</Text>
                </Pressable>
                {status && <StatusBox status={status} />}
              </SectionCard>
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Modal: Category ── */}
      <Modal animationType="slide" transparent visible={catModal} onRequestClose={() => setCatModal(false)}>
        <View style={overlayStyle}>
          <View style={sheetStyle}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{t.config.addCategory}</Text>
            <View style={s.sheetContent}>
              <Text style={s.fieldLabel}>{t.config.categoryName}</Text>
              <TextInput style={s.input} value={catName} onChangeText={setCatName} placeholder={t.config.categoryName} placeholderTextColor={C.textDim} />
              <Text style={s.fieldLabel}>{t.expenses.type}</Text>
              <View style={s.typeRow}>
                {(['expense', 'income'] as const).map(tp => {
                  const active = catType === tp;
                  const color = tp === 'expense' ? C.expense : C.income;
                  return (
                    <Pressable key={tp} style={[s.typeChip, active && { backgroundColor: color + '22', borderColor: color }]} onPress={() => setCatType(tp)}>
                      <Text style={[s.typeChipText, active && { color, fontWeight: '700' }]}>
                        {tp === 'expense' ? t.common.expense : t.common.income}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.fieldLabel}>{t.config.colorLabel}</Text>
              <View style={s.colorGrid}>
                {PRESET_COLORS.map(c => (
                  <Pressable key={c} style={[s.colorSwatch, { backgroundColor: c }, catColor === c && s.colorSelected]} onPress={() => setCatColor(c)} />
                ))}
              </View>
              <View style={s.btnRow}>
                <Pressable style={[s.btn, s.btnCancel]} onPress={() => setCatModal(false)}>
                  <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={[s.btn, s.btnSave]} onPress={handleSaveCategory}>
                  <Text style={s.btnSaveText}>{t.common.save}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Account ── */}
      <Modal animationType="slide" transparent visible={accModal} onRequestClose={() => setAccModal(false)}>
        <View style={overlayStyle}>
          <View style={sheetStyle}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{t.config.addAccount}</Text>
            <View style={s.sheetContent}>
              <Text style={s.fieldLabel}>{t.config.accountName}</Text>
              <TextInput style={s.input} value={accName} onChangeText={setAccName} placeholder={t.config.accountName} placeholderTextColor={C.textDim} />
              <Text style={s.fieldLabel}>{t.config.currencyLabel}</Text>
              <TextInput style={s.input} value={accCurrency} onChangeText={setAccCurrency} placeholder="USD" autoCapitalize="characters" maxLength={5} placeholderTextColor={C.textDim} />
              <Text style={s.fieldLabel}>{t.config.accountType}</Text>
              <View style={s.typeRow}>
                {(['asset', 'liability'] as const).map(at => {
                  const active = accType === at;
                  return (
                    <Pressable key={at} style={[s.typeChip, active && { backgroundColor: C.accentBg, borderColor: C.accent }]} onPress={() => setAccType(at)}>
                      <Text style={[s.typeChipText, active && { color: C.accent, fontWeight: '700' }]}>
                        {at === 'asset' ? t.config.accountTypeAsset : t.config.accountTypeLiability}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={s.btnRow}>
                <Pressable style={[s.btn, s.btnCancel]} onPress={() => setAccModal(false)}>
                  <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={[s.btn, s.btnSave]} onPress={handleSaveAccount}>
                  <Text style={s.btnSaveText}>{t.common.save}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Bill ── */}
      <Modal animationType="slide" transparent visible={billModal} onRequestClose={() => setBillModal(false)}>
        <View style={overlayStyle}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={sheetStyle}>
              <View style={s.handle} />
              <Text style={s.sheetTitle}>{billEditId ? t.bills.edit : t.bills.add}</Text>
              <View style={s.sheetContent}>
                <Text style={s.fieldLabel}>{t.bills.name} <Text style={{ color: C.expense }}>*</Text></Text>
                <TextInput style={s.input} value={billName} onChangeText={setBillName} placeholder={t.bills.namePlaceholder} placeholderTextColor={C.textDim} />
                <Text style={s.fieldLabel}>{t.bills.amount} <Text style={{ color: C.expense }}>*</Text></Text>
                <TextInput style={s.input} value={billAmount} onChangeText={setBillAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textDim} />
                <Text style={s.fieldLabel}>{t.expenses.type}</Text>
                <View style={s.typeRow}>
                  {(['expense', 'income'] as const).map(tp => {
                    const active = billType === tp;
                    const color = tp === 'expense' ? C.expense : C.income;
                    return (
                      <Pressable key={tp} style={[s.typeChip, active && { backgroundColor: color + '22', borderColor: color }]} onPress={() => setBillType(tp)}>
                        <Text style={[s.typeChipText, active && { color, fontWeight: '700' }]}>
                          {tp === 'expense' ? t.common.expense : t.common.income}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={s.fieldLabel}>{t.bills.frequency}</Text>
                <View style={s.freqRow}>
                  {FREQUENCIES.map(f => (
                    <Pressable key={f.value} style={[s.freqChip, billFreq === f.value && s.freqChipActive]} onPress={() => setBillFreq(f.value)}>
                      <Text style={[s.freqChipText, billFreq === f.value && { color: C.accent, fontWeight: '700' }]}>
                        {lang === 'es' ? f.labelEs : f.labelEn}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={s.fieldLabel}>{t.bills.nextDate} <Text style={{ color: C.expense }}>*</Text></Text>
                <TextInput
                  style={s.input} value={billNextDate} onChangeText={formatDateBill}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
                  maxLength={10} placeholder="DD/MM/AAAA" placeholderTextColor={C.textDim}
                />
                <View style={s.btnRow}>
                  <Pressable style={[s.btn, s.btnCancel]} onPress={() => setBillModal(false)}>
                    <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                  </Pressable>
                  <Pressable style={[s.btn, s.btnSave]} onPress={handleSaveBill}>
                    <Text style={s.btnSaveText}>{t.common.save}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal: Tag ── */}
      <Modal animationType="slide" transparent visible={tagModal} onRequestClose={() => setTagModal(false)}>
        <View style={overlayStyle}>
          <View style={sheetStyle}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{t.tags.add}</Text>
            <View style={s.sheetContent}>
              <Text style={s.fieldLabel}>{t.tags.name} <Text style={{ color: C.expense }}>*</Text></Text>
              <TextInput style={s.input} value={tagName} onChangeText={setTagName} placeholder={t.tags.namePlaceholder} placeholderTextColor={C.textDim} autoFocus />
              <Text style={s.fieldLabel}>{t.config.colorLabel}</Text>
              <View style={s.colorGrid}>
                {PRESET_COLORS.map(c => (
                  <Pressable key={c} style={[s.colorSwatch, { backgroundColor: c }, tagColor === c && s.colorSelected]} onPress={() => setTagColor(c)} />
                ))}
              </View>
              <View style={s.btnRow}>
                <Pressable style={[s.btn, s.btnCancel]} onPress={() => setTagModal(false)}>
                  <Text style={s.btnCancelText}>{t.common.cancel}</Text>
                </Pressable>
                <Pressable style={[s.btn, { backgroundColor: C.transfer }]} onPress={handleSaveTag}>
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

/** Extracted bill list rows to avoid duplicating JSX between phone/wide layouts */
function BillsList({ bills, lang, t, freqLabel, getBills, setBillsState, payBill, skipBill, handleDeleteBill, onEdit }: {
  bills: Bill[];
  lang: string;
  t: any;
  freqLabel: (f: Bill['frequency']) => string | undefined;
  getBills: () => Promise<Bill[]>;
  setBillsState: (b: Bill[]) => void;
  payBill: (bill: Bill) => Promise<any>;
  skipBill: (id: string, freq: Bill['frequency'], date: string) => Promise<any>;
  handleDeleteBill: (id: string) => void;
  onEdit: (bill: Bill) => void;
}) {
  function daysUntil(isoDate: string) {
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(isoDate + 'T00:00:00');
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
  if (bills.length === 0) return <Text style={s.emptyHint}>{t.bills.empty}</Text>;
  return (
    <>
      {bills.map(bill => {
        const days = daysUntil(bill.next_date);
        const isDue = days <= 0;
        const isSoon = days <= 7 && days > 0;
        const dotColor = isDue ? C.expense : isSoon ? C.warn : C.income;
        return (
          <View key={bill.bill_id} style={s.billRow}>
            <View style={[s.billDot, { backgroundColor: dotColor + '22', borderColor: dotColor + '66' }]}>
              <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.billName}>{bill.name}</Text>
              <Text style={[s.billMeta, isDue && { color: C.expense }]}>
                {freqLabel(bill.frequency)} · ${bill.amount.toFixed(2)} · {isDue ? `${t.bills.overdue} (${Math.abs(days)}d)` : `${t.bills.due} ${days}d`}
              </Text>
            </View>
            <View style={s.billActions}>
              <Pressable style={[s.billActionBtn, { backgroundColor: C.incomeBg, borderColor: C.income + '44' }]} onPress={() => { payBill(bill).then(() => getBills().then(setBillsState)); }}>
                <Text style={[s.billActionText, { color: C.income }]}>{t.bills.pay}</Text>
              </Pressable>
              <Pressable style={[s.billActionBtn, { backgroundColor: C.surfaceUp, borderColor: C.border }]} onPress={() => { skipBill(bill.bill_id, bill.frequency, bill.next_date).then(() => getBills().then(setBillsState)); }}>
                <Text style={[s.billActionText, { color: C.textSec }]}>{t.bills.skip}</Text>
              </Pressable>
              <Pressable onPress={() => onEdit(bill)} hitSlop={8}>
                <Text style={s.iconLink}>✎</Text>
              </Pressable>
              <Pressable onPress={() => handleDeleteBill(bill.bill_id)} hitSlop={8}>
                <Text style={[s.iconLink, { color: C.expense }]}>✕</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
  );
}

function StatusBox({ status }: { status: string }) {
  const isError = status.toLowerCase().startsWith('error') || status.toLowerCase().includes('error');
  return (
    <View style={[s.statusBox, isError ? { backgroundColor: C.expenseBg, borderColor: C.expense + '44' } : { backgroundColor: C.incomeBg, borderColor: C.income + '44' }]}>
      <Text style={[s.statusText, { color: isError ? C.expense : C.income }]}>{status}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: S['4xl'], gap: S.sm },

  pageTitle: { fontSize: F['2xl'], fontWeight: '800', color: C.text, marginBottom: S.sm },

  // 2-col card row (tablet+)
  cardRow: { flexDirection: 'row', gap: S.sm },
  cardHalf: { flex: 1 },

  card: {
    backgroundColor: C.surface,
    borderRadius: R.md, padding: S.lg,
    borderWidth: 1, borderColor: C.border,
  },
  cardHeader: { marginBottom: S.md },
  cardTitle: { fontSize: F.md, fontWeight: '700', color: C.text, marginBottom: 4 },
  cardDesc: { fontSize: F.sm, color: C.textSec, lineHeight: 20 },

  emptyHint: { fontSize: F.sm, color: C.textDim, marginBottom: S.md, textAlign: 'center' },

  langRow: { flexDirection: 'row', gap: S.sm },
  langBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: S.xs, paddingVertical: 11, borderRadius: R.sm,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surfaceUp,
  },
  langBtnActive: { borderColor: C.accent, backgroundColor: C.accentBg },
  langFlag: { fontSize: 18 },
  langLabel: { fontSize: F.base, color: C.textSec, fontWeight: '500' },

  // Bills
  billRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: S.sm,
    borderBottomWidth: 1, borderBottomColor: C.borderFaint },
  billDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  billName: { fontSize: F.sm, fontWeight: '600', color: C.text },
  billMeta: { fontSize: F.xs, color: C.textSec, marginTop: 2 },
  billActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  billActionBtn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: R.xs, borderWidth: 1 },
  billActionText: { fontSize: F.xs, fontWeight: '700' },
  iconLink: { fontSize: 17, color: C.accent, paddingHorizontal: 3 },

  // Tags / categories chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginBottom: S.sm },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: F.sm, fontWeight: '600' },
  hintText: { fontSize: F.xs, color: C.textDim, marginBottom: S.xs },

  rowSep: { borderBottomWidth: 1, borderBottomColor: C.borderFaint },

  // Accounts
  accRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingVertical: S.sm },
  accAvatar: { width: 36, height: 36, borderRadius: R.xs, alignItems: 'center', justifyContent: 'center' },
  accName: { fontSize: F.base, fontWeight: '600', color: C.text },
  accMeta: { fontSize: F.xs, color: C.textSec, marginTop: 2 },

  // User
  userEmail: { fontSize: F.base, fontWeight: '600', color: C.text, marginBottom: S.xs },
  licenseBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full, marginBottom: S.md, borderWidth: 1 },
  licensedBadge: { backgroundColor: C.incomeBg, borderColor: C.income + '44' },
  freeBadge: { backgroundColor: C.surfaceUp, borderColor: C.border },
  licenseBadgeText: { fontSize: F.xs, fontWeight: '700' },

  // Upgrade
  upgradeStep: { fontSize: F.sm, fontWeight: '600', color: C.textSec, marginBottom: S.xs, marginTop: S.sm },
  uidInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: R.sm,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: F.xs, color: C.textSec,
    backgroundColor: C.surfaceUp, fontFamily: 'monospace',
    marginBottom: S.sm,
  },
  upgradeHint: { fontSize: F.sm, color: C.textSec, lineHeight: 20, marginTop: S.sm },

  addRowBtn: {
    borderWidth: 1, borderColor: C.border,
    borderRadius: R.sm, paddingVertical: 12,
    alignItems: 'center', marginTop: S.sm,
  },
  addRowBtnText: { fontSize: F.sm, fontWeight: '700', color: C.accent },

  statusBox: { marginTop: S.sm, padding: S.sm, borderRadius: R.xs, borderWidth: 1 },
  statusText: { fontSize: F.sm },

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
  typeRow: { flexDirection: 'row', gap: S.sm },
  typeChip: {
    flex: 1, paddingVertical: 10, borderRadius: R.sm,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center',
  },
  typeChipText: { fontSize: F.sm, color: C.textSec, fontWeight: '500' },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs },
  freqChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: R.full, borderWidth: 1.5, borderColor: C.border,
  },
  freqChipActive: { borderColor: C.accent, backgroundColor: C.accentBg },
  freqChipText: { fontSize: F.sm, color: C.textSec, fontWeight: '500' },
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
