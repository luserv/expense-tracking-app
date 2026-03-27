import { getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB-dFd0BZJY38tU8nOY788oyFT8OevUDck",
  authDomain: "segast0.firebaseapp.com",
  projectId: "segast0",
  storageBucket: "segast0.firebasestorage.app",
  messagingSenderId: "282199354699",
  appId: "1:282199354699:web:0cf2417fc5e93bb47accce"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

function createAuth() {
  // Si ya fue inicializado (hot reload), reusar
  try {
    if (Platform.OS === 'web') {
      return initializeAuth(app, { persistence: browserLocalPersistence });
    } else {
      const { getReactNativePersistence } = require('firebase/auth');
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    }
  } catch {
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db_firebase = getFirestore(app);
