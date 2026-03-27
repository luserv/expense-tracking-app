import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { downloadDB, uploadDB } from '../../utils/driveSync';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../utils/authContext';
import { Account, Category, DB_NAME, useExpenses } from '../../utils/context';
import { Lang, useI18n } from '../../utils/i18n';

const PAYPAL_ME = process.env.EXPO_PUBLIC_PAYPAL_ME ?? 'https://paypal.me/TUUSUARIO';
const LICENSE_PRICE = process.env.EXPO_PUBLIC_LICENSE_PRICE ?? '4.99';
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'tu@email.com';
const DB_PATH = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;

const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

const PRESET_COLORS = [
  '#FF6B6B','#FF9500','#F7B731','#34C759','#4ECDC4',
  '#45B7D1','#007AFF','#5856D6','#8E44AD','#DDA0DD',
  '#96CEB4','#27AE60','#BDC3C7','#FF3B30','#FF2D55',
];

export default function Config() {
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Category modal
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catColor, setCatColor] = useState(PRESET_COLORS[0]);

  // Account modal
  const [accModalVisible, setAccModalVisible] = useState(false);
  const [accName, setAccName] = useState('');
  const [accCurrency, setAccCurrency] = useState('USD');

  const { getCategories, createCategory, getAccounts, createAccount } = useExpenses();
  const { t, lang, setLang } = useI18n();
  const { user, licensed, signOutUser, driveToken } = useAuth();
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronFS;

  const loadData = async () => {
    const [cats, accs] = await Promise.all([getCategories(), getAccounts()]);
    setCategories(cats);
    setAccounts(accs);
  };

  useEffect(() => { loadData(); }, []);

  // ── DB export ───────────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      setIsLoading(true);
      setStatus(null);

      if (typeof window !== 'undefined' && (window as any).electronFS) {
        const result = await (window as any).electronFS.exportDB();
        if (result.canceled) return;
        if (result.error) { setStatus(t.config.exportErrorPrefix + result.error); return; }
        setStatus(t.config.exportSuccess);
        return;
      }

      const dbInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (!dbInfo.exists) { setStatus(t.config.dbNotFound); return; }

      const exportPath = `${FileSystem.cacheDirectory}gastos_backup_${Date.now()}.db`;
      await FileSystem.copyAsync({ from: DB_PATH, to: exportPath });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { setStatus(t.config.sharingUnavailable); return; }

      await Sharing.shareAsync(exportPath, {
        mimeType: 'application/octet-stream',
        dialogTitle: t.config.exportBtn,
        UTI: 'public.database',
      });
      setStatus(t.config.exportSuccess);
    } catch (e) {
      setStatus(t.config.exportErrorPrefix + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsLoading(false);
    }
  };

  // ── DB import ───────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (typeof window !== 'undefined' && (window as any).electronFS) {
      if (!confirm(t.config.importConfirm)) return;
      try {
        setIsLoading(true);
        setStatus(null);
        const result = await (window as any).electronFS.importDB();
        if (result.canceled) return;
        if (result.error) { setStatus(t.config.importErrorPrefix + result.error); return; }
        setStatus(t.config.importSuccess);
        await loadData();
      } catch (e) {
        setStatus(t.config.importErrorPrefix + (e instanceof Error ? e.message : String(e)));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    Alert.alert(t.config.importTitle, t.config.importConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.config.importContinue, style: 'destructive', onPress: async () => {
          try {
            setIsLoading(true);
            setStatus(null);
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (result.canceled) { setIsLoading(false); return; }
            const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
            const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
            if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
            await FileSystem.copyAsync({ from: result.assets[0].uri, to: DB_PATH });
            setStatus(t.config.importSuccess);
            Alert.alert(t.config.importSuccessTitle, t.config.importSuccessMsg);
          } catch (e) {
            setStatus(t.config.importErrorPrefix + (e instanceof Error ? e.message : String(e)));
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  // ── Drive upload ────────────────────────────────────────────────────────────

  const handleDriveUpload = async () => {
    if (!driveToken) { setStatus(t.drive.signInRequired); return; }
    try {
      setIsLoading(true);
      setStatus(null);
      let base64: string;
      if (typeof window !== 'undefined' && (window as any).electronDrive) {
        base64 = await (window as any).electronDrive.readDBAsBase64();
      } else {
        base64 = await FileSystem.readAsStringAsync(DB_PATH, { encoding: FileSystem.EncodingType.Base64 });
      }
      await uploadDB(driveToken, base64);
      setStatus(t.drive.uploadSuccess);
    } catch (e: any) {
      if (e.message === 'TOKEN_EXPIRED') setStatus(t.drive.tokenExpired);
      else setStatus(t.drive.errorPrefix + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Drive restore ────────────────────────────────────────────────────────────

  const handleDriveRestore = async () => {
    if (!driveToken) { setStatus(t.drive.signInRequired); return; }

    const doRestore = async () => {
      try {
        setIsLoading(true);
        setStatus(null);
        const base64 = await downloadDB(driveToken);
        if (typeof window !== 'undefined' && (window as any).electronDrive) {
          const result = await (window as any).electronDrive.writeDBFromBase64(base64);
          if (result?.error) throw new Error(result.error);
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
      } finally {
        setIsLoading(false);
      }
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

  // ── Add category ────────────────────────────────────────────────────────────

  const handleOpenCatModal = () => {
    setCatName(''); setCatType('expense'); setCatColor(PRESET_COLORS[0]);
    setCatModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) return;
    await createCategory({ name: catName.trim(), color: catColor, type: catType, icon: null });
    setCatModalVisible(false);
    const cats = await getCategories();
    setCategories(cats);
  };

  // ── Add account ─────────────────────────────────────────────────────────────

  const handleOpenAccModal = () => {
    setAccName(''); setAccCurrency('USD');
    setAccModalVisible(true);
  };

  const handleSaveAccount = async () => {
    if (!accName.trim()) return;
    await createAccount(accName.trim(), accCurrency.trim() || 'USD');
    setAccModalVisible(false);
    const accs = await getAccounts();
    setAccounts(accs);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.config.title}</Text>

      {/* ── Idioma ── */}
      <View style={[styles.card, { marginBottom: 16 }]}>
        <Text style={styles.cardTitle}>{t.config.language}</Text>
        <Text style={styles.cardDesc}>{t.config.languageDesc}</Text>
        <View style={styles.langRow}>
          {LANGUAGES.map(l => (
            <Pressable
              key={l.code}
              style={[styles.langBtn, lang === l.code && styles.langBtnActive]}
              onPress={() => setLang(l.code)}
            >
              <Text style={styles.langFlag}>{l.flag}</Text>
              <Text style={[styles.langLabel, lang === l.code && styles.langLabelActive]}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Categorías ── */}
      <View style={[styles.card, { marginBottom: 16 }]}>
        <Text style={styles.cardTitle}>{t.config.categories}</Text>
        <Text style={styles.cardDesc}>{t.config.categoriesDesc}</Text>
        <View style={styles.chipList}>
          {categories.map(c => (
            <View key={c.category_id} style={[styles.chip, { borderColor: c.color }]}>
              <View style={[styles.chipDot, { backgroundColor: c.color }]} />
              <Text style={styles.chipText}>{c.name}</Text>
            </View>
          ))}
        </View>
        <Pressable style={[styles.button, styles.buttonAdd]} onPress={handleOpenCatModal}>
          <Text style={styles.buttonText}>{t.config.addCategory}</Text>
        </Pressable>
      </View>

      {/* ── Cuentas ── */}
      <View style={[styles.card, { marginBottom: 16 }]}>
        <Text style={styles.cardTitle}>{t.config.accounts}</Text>
        <Text style={styles.cardDesc}>{t.config.accountsDesc}</Text>
        {accounts.map(a => (
          <View key={a.account_id} style={styles.accountRow}>
            <Text style={styles.accountName}>{a.name}</Text>
            <Text style={styles.accountCurrency}>{a.currency}</Text>
          </View>
        ))}
        <Pressable style={[styles.button, styles.buttonAdd]} onPress={handleOpenAccModal}>
          <Text style={styles.buttonText}>{t.config.addAccount}</Text>
        </Pressable>
      </View>

      {/* ── Cuenta de usuario ── */}
      <View style={[styles.card, { marginBottom: 16 }]}>
        <Text style={styles.cardTitle}>Cuenta</Text>
        <Text style={styles.accountEmail}>{user?.email}</Text>
        <Text style={styles.accountLicense}>
          {licensed ? '✅ Licencia activa' : '🔒 Plan gratuito'}
        </Text>
        <Pressable style={[styles.button, styles.buttonSignOut]} onPress={signOutUser}>
          <Text style={styles.buttonText}>Cerrar sesión</Text>
        </Pressable>
      </View>

      {/* ── Upgrade ── */}
      {!licensed && user && !isElectron && (
        <View style={[styles.card, { marginBottom: 16 }]}>
          <Text style={styles.cardTitle}>Quitar anuncios</Text>
          <Text style={styles.cardDesc}>
            Paga una vez y elimina los anuncios para siempre. Precio: ${LICENSE_PRICE} USD.
          </Text>
          <Text style={styles.upgradeStep}>1. Copia tu ID de usuario:</Text>
          <TextInput
            style={styles.uidInput}
            value={user.uid}
            editable={false}
            selectTextOnFocus
          />
          <Text style={styles.upgradeStep}>2. Paga con PayPal:</Text>
          <Pressable style={[styles.button, styles.buttonPayPal]} onPress={() => Linking.openURL(PAYPAL_ME)}>
            <Text style={styles.buttonText}>Pagar con PayPal — ${LICENSE_PRICE}</Text>
          </Pressable>
          <Text style={styles.upgradeHint}>
            3. Envía el comprobante junto con tu ID al correo{' '}
            <Text style={styles.upgradeLink} onPress={() => Linking.openURL(
              `mailto:${SUPPORT_EMAIL}?subject=Licencia%20Gastos&body=ID%3A%20${user.uid}`
            )}>
              {SUPPORT_EMAIL}
            </Text>
            {' '}y activamos tu licencia en menos de 24 h.
          </Text>
        </View>
      )}

      {/* ── Google Drive ── */}
      {driveToken && (
        <View style={[styles.card, { marginBottom: 16 }]}>
          <Text style={styles.cardTitle}>{t.drive.title}</Text>
          <Text style={styles.cardDesc}>{t.drive.desc}</Text>
          <Pressable style={[styles.button, styles.buttonDriveUpload, isLoading && styles.buttonDisabled]} onPress={handleDriveUpload} disabled={isLoading}>
            <Text style={styles.buttonText}>{isLoading ? t.drive.uploading : t.drive.upload}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonDriveRestore, isLoading && styles.buttonDisabled]} onPress={handleDriveRestore} disabled={isLoading}>
            <Text style={styles.buttonText}>{isLoading ? t.drive.restoring : t.drive.restore}</Text>
          </Pressable>
          {status && (
            <View style={[styles.statusBox, status.toLowerCase().startsWith('error') && styles.statusBoxError]}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Base de datos ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.config.database}</Text>
        <Text style={styles.cardDesc}>{t.config.databaseDesc}</Text>
        <Pressable style={[styles.button, styles.buttonExport, isLoading && styles.buttonDisabled]} onPress={handleExport} disabled={isLoading}>
          <Text style={styles.buttonText}>{t.config.exportBtn}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonImport, isLoading && styles.buttonDisabled]} onPress={handleImport} disabled={isLoading}>
          <Text style={styles.buttonText}>{t.config.importBtn}</Text>
        </Pressable>
        {status && (
          <View style={[styles.statusBox, status.toLowerCase().startsWith('error') && styles.statusBoxError]}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        )}
      </View>

      {/* ── Modal: nueva categoría ── */}
      <Modal animationType="slide" transparent visible={catModalVisible} onRequestClose={() => setCatModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t.config.addCategory}</Text>

            <Text style={styles.fieldLabel}>{t.config.categoryName}</Text>
            <TextInput
              style={styles.input}
              value={catName}
              onChangeText={setCatName}
              placeholder={t.config.categoryName}
              placeholderTextColor="#C7C7CC"
            />

            <Text style={styles.fieldLabel}>{t.expenses.type}</Text>
            <View style={styles.typeRow}>
              {(['expense', 'income'] as const).map(tp => (
                <Pressable
                  key={tp}
                  style={[styles.typeChip, catType === tp && (tp === 'expense' ? styles.typeChipExpense : styles.typeChipIncome)]}
                  onPress={() => setCatType(tp)}
                >
                  <Text style={[styles.typeChipText, catType === tp && styles.typeChipTextActive]}>
                    {tp === 'expense' ? t.common.expense : t.common.income}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t.config.colorLabel}</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map(color => (
                <Pressable
                  key={color}
                  style={[styles.colorSwatch, { backgroundColor: color }, catColor === color && styles.colorSwatchSelected]}
                  onPress={() => setCatColor(color)}
                />
              ))}
            </View>

            <View style={styles.buttonContainer}>
              <Pressable style={[styles.button, styles.buttonCancel]} onPress={() => setCatModalVisible(false)}>
                <Text style={styles.textCancel}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonSave]} onPress={handleSaveCategory}>
                <Text style={styles.textSave}>{t.common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: nueva cuenta ── */}
      <Modal animationType="slide" transparent visible={accModalVisible} onRequestClose={() => setAccModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t.config.addAccount}</Text>

            <Text style={styles.fieldLabel}>{t.config.accountName}</Text>
            <TextInput
              style={styles.input}
              value={accName}
              onChangeText={setAccName}
              placeholder={t.config.accountName}
              placeholderTextColor="#C7C7CC"
            />

            <Text style={styles.fieldLabel}>{t.config.currencyLabel}</Text>
            <TextInput
              style={styles.input}
              value={accCurrency}
              onChangeText={setAccCurrency}
              placeholder="USD"
              autoCapitalize="characters"
              maxLength={5}
              placeholderTextColor="#C7C7CC"
            />

            <View style={styles.buttonContainer}>
              <Pressable style={[styles.button, styles.buttonCancel]} onPress={() => setAccModalVisible(false)}>
                <Text style={styles.textCancel}>{t.common.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonSave]} onPress={handleSaveAccount}>
                <Text style={styles.textSave}>{t.common.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#000', marginBottom: 24 },

  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#333', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: '#8E8E93', marginBottom: 16, lineHeight: 20 },

  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#C7C7CC', backgroundColor: '#F9F9F9',
  },
  langBtnActive: { borderColor: '#007AFF', backgroundColor: '#E5F0FF' },
  langFlag: { fontSize: 20 },
  langLabel: { fontSize: 15, color: '#333', fontWeight: '500' },
  langLabelActive: { color: '#007AFF', fontWeight: '700' },

  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, color: '#333' },

  accountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  accountName: { fontSize: 15, color: '#000' },
  accountCurrency: { fontSize: 13, color: '#8E8E93' },
  accountEmail: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 4 },
  accountLicense: { fontSize: 13, color: '#8E8E93', marginBottom: 16 },

  button: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonAdd: { backgroundColor: '#007AFF' },
  buttonSignOut: { backgroundColor: '#FF3B30' },
  buttonExport: { backgroundColor: '#007AFF' },
  buttonImport: { backgroundColor: '#34C759' },
  buttonPayPal: { backgroundColor: '#003087' },
  buttonDriveUpload: { backgroundColor: '#1A73E8' },
  buttonDriveRestore: { backgroundColor: '#34A853' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  statusBox: { marginTop: 8, padding: 12, backgroundColor: '#E8F5E9', borderRadius: 8 },
  statusBoxError: { backgroundColor: '#FFEBEE' },
  statusText: { fontSize: 14, color: '#333' },

  upgradeStep: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 8 },
  uidInput: {
    borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#555',
    backgroundColor: '#F9F9F9', fontFamily: 'monospace', marginBottom: 12,
  },
  upgradeHint: { fontSize: 13, color: '#8E8E93', lineHeight: 20, marginTop: 8 },
  upgradeLink: { color: '#007AFF', textDecorationLine: 'underline' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 16, color: '#000', backgroundColor: '#F9F9F9',
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#C7C7CC', alignItems: 'center', backgroundColor: '#F9F9F9',
  },
  typeChipExpense: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  typeChipIncome: { backgroundColor: '#34C759', borderColor: '#34C759' },
  typeChipText: { fontSize: 15, color: '#333', fontWeight: '500' },
  typeChipTextActive: { color: '#fff', fontWeight: '700' },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#000' },

  buttonContainer: { flexDirection: 'row', gap: 10, marginTop: 20 },
  buttonCancel: { backgroundColor: '#E5E5EA' },
  buttonSave: { backgroundColor: '#007AFF' },
  textCancel: { fontSize: 16, fontWeight: '600', color: '#000' },
  textSave: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
