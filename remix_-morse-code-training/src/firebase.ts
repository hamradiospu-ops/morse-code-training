import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs,
  serverTimestamp
} from 'firebase/firestore';

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyCRlIOdZaS6QJd_pkhf3F97RnB9tOt2dBg",
  authDomain: "gen-lang-client-0848807019.firebaseapp.com",
  projectId: "gen-lang-client-0848807019",
  storageBucket: "gen-lang-client-0848807019.firebasestorage.app",
  messagingSenderId: "578908169856",
  appId: "1:578908169856:web:27150dc323cadace616865"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
// Force account selection screen
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore (utilizing custom databaseId if specified, falling back to default)
const databaseId = "ai-studio-remixmorsecodetr-69bccb06-1655-4f78-a605-280daf30822d";
export const db = getFirestore(app, databaseId);

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp
};
export type { FirebaseUser };
