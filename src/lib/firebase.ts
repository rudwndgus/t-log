import { getApp, getApps, initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { getFirestore, initializeFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim()
}

const forceLocalMode = import.meta.env.VITE_FORCE_LOCAL_MODE === 'true'
export const isFirebaseConfigured = !forceLocalMode && Object.values(firebaseConfig).every(Boolean) && !firebaseConfig.projectId?.includes('your-project')
const hasExistingApp = getApps().length > 0
export const firebaseApp = isFirebaseConfigured ? (hasExistingApp ? getApp() : initializeApp(firebaseConfig)) : null
export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const db = firebaseApp ? (hasExistingApp ? getFirestore(firebaseApp) : initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true })) : null

if (auth) void setPersistence(auth, browserLocalPersistence)
