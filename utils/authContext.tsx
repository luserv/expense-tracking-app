import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { auth, db_firebase } from './firebase';

const GUEST_KEY = 'auth_guest_mode';
const DRIVE_TOKEN_KEY = 'drive_access_token';
const DRIVE_TOKEN_EXPIRY_KEY = 'drive_token_expiry';
/** Margen: 55 min. Los tokens de Google duran 1 h; refrescamos antes de que expiren. */
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

interface AuthState {
  user: User | null;
  isGuest: boolean;
  licensed: boolean;
  loading: boolean;
  driveToken: string | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  setDriveToken: (token: string | null) => void;
  refreshDriveToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isGuest: false,
  licensed: false,
  loading: true,
  driveToken: null,
  signIn: async () => {},
  signOutUser: async () => {},
  deleteAccount: async () => {},
  continueAsGuest: async () => {},
  setDriveToken: () => {},
  refreshDriveToken: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [licensed, setLicensed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [driveToken, setDriveToken] = useState<string | null>(null);

  const checkLicense = useCallback(async (uid: string) => {
    try {
      const snap = await getDoc(doc(db_firebase, 'licenses', uid));
      setLicensed(snap.exists() && snap.data()?.licensed === true);
    } catch {
      setLicensed(false);
    }
  }, []);

  /** Guarda el token en estado y lo persiste en AsyncStorage con timestamp de expiración. */
  const persistDriveToken = useCallback(async (token: string | null) => {
    setDriveToken(token);
    if (token) {
      const expiry = String(Date.now() + TOKEN_LIFETIME_MS);
      await AsyncStorage.setItem(DRIVE_TOKEN_KEY, token);
      await AsyncStorage.setItem(DRIVE_TOKEN_EXPIRY_KEY, expiry);
    } else {
      await AsyncStorage.removeItem(DRIVE_TOKEN_KEY);
      await AsyncStorage.removeItem(DRIVE_TOKEN_EXPIRY_KEY);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setIsGuest(false);
        await AsyncStorage.removeItem(GUEST_KEY);
        await checkLicense(u.uid);

        if (Platform.OS === 'android') {
          // Android: GoogleSignin maneja el refresh automáticamente
          try {
            const { GoogleSignin } = require('@react-native-google-signin/google-signin');
            const tokens = await GoogleSignin.getTokens();
            await persistDriveToken(tokens.accessToken);
          } catch {}
        } else {
          // Web/Electron: restaurar token persistido si no expiró
          try {
            const stored = await AsyncStorage.getItem(DRIVE_TOKEN_KEY);
            const expiry = await AsyncStorage.getItem(DRIVE_TOKEN_EXPIRY_KEY);
            if (stored && expiry && Date.now() < Number(expiry)) {
              setDriveToken(stored);
            }
          } catch {}
        }
      } else {
        setLicensed(false);
        // Restaurar modo invitado si estaba activo
        const guest = await AsyncStorage.getItem(GUEST_KEY);
        if (guest === 'true') setIsGuest(true);
      }
      setLoading(false);
    });
    return unsub;
  }, [checkLicense, persistDriveToken]);

  const signIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');

    if (Platform.OS === 'web') {
      // Electron: flujo OAuth propio con BrowserWindow (signInWithPopup no funciona en Electron)
      const isElectron = typeof window !== 'undefined' && !!(window as any).electronFS;
      if (isElectron) {
        const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
        const redirectUri = 'http://localhost';
        const scopes = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.file'].join(' ');
        const nonce = Math.random().toString(36).substring(2);
        const authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth` +
          `?client_id=${encodeURIComponent(clientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=token%20id_token` +
          `&scope=${encodeURIComponent(scopes)}` +
          `&nonce=${nonce}`;
        const electronAuth = (window as any).electronAuth;
        if (!electronAuth) throw new Error('Reiniciá la aplicación para aplicar los cambios.');
        const { access_token, id_token } = await electronAuth.googleOAuth({ authUrl, redirectUri });
        const credential = GoogleAuthProvider.credential(id_token, access_token);
        await signInWithCredential(auth, credential);
        await persistDriveToken(access_token);
        return;
      }
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) await persistDriveToken(credential.accessToken);
      return;
    }

    // Android: OAuth se maneja desde login.native.tsx via GoogleSignin
    throw new Error('USE_GOOGLE_SIGNIN');
  }, [persistDriveToken]);

  const signOutUser = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
      } catch {}
    }
    await signOut(auth);
    setIsGuest(false);
    await persistDriveToken(null);
    await AsyncStorage.removeItem(GUEST_KEY);
  }, [persistDriveToken]);

  const deleteAccount = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No hay sesión activa.');

    // 1. Borrar datos de Firestore (licencia)
    try {
      await deleteDoc(doc(db_firebase, 'licenses', currentUser.uid));
    } catch {
      // Si no existe el doc, continuar igual
    }

    // 2. En Android: revocar acceso de Google para que el SDK limpie la sesión
    if (Platform.OS === 'android') {
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        await GoogleSignin.revokeAccess();
        await GoogleSignin.signOut();
      } catch {}
    }

    // 3. Eliminar el usuario de Firebase Auth
    // Puede fallar con auth/requires-recent-login si la sesión es antigua
    await currentUser.delete();

    // 4. Limpiar estado local
    await persistDriveToken(null);
    await AsyncStorage.removeItem(GUEST_KEY);
  }, [persistDriveToken]);

  const continueAsGuest = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, 'true');
    setIsGuest(true);
  }, []);

  /**
   * Refresca el Drive access token sin interacción del usuario cuando es posible.
   * - Android: GoogleSignin maneja el refresh automáticamente.
   * - Electron/Web: revisa el token persistido; si expiró retorna null.
   */
  const refreshDriveToken = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === 'android') {
      try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        const tokens = await GoogleSignin.getTokens();
        await persistDriveToken(tokens.accessToken);
        return tokens.accessToken;
      } catch {
        return null;
      }
    }

    // Web/Electron: chequear token persistido
    try {
      const stored = await AsyncStorage.getItem(DRIVE_TOKEN_KEY);
      const expiry = await AsyncStorage.getItem(DRIVE_TOKEN_EXPIRY_KEY);
      if (stored && expiry && Date.now() < Number(expiry)) {
        setDriveToken(stored);
        return stored;
      }
    } catch {}

    return null;
  }, [persistDriveToken]);

  return (
    <AuthContext.Provider value={{ user, isGuest, licensed, loading, driveToken, signIn, signOutUser, deleteAccount, continueAsGuest, setDriveToken, refreshDriveToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
