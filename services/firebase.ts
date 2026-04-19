import { initializeApp } from "firebase/app";
import { getFirestore, getDocFromServer, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from '../firebase-applet-config.json';
import { UserProfile } from "../types";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Sync user profile to Firestore
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      const profile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        email: user.email || ''
      };
      await setDoc(userRef, profile);
    }
    return user;
  } catch (error: any) {
    console.error("Login failed:", error);
    
    // Silence the popup closed by user error as it's common and noisy
    if (error.code === 'auth/popup-closed-by-user') {
      return null;
    }
    
    if (error instanceof Error) {
      alert("登入失敗: " + error.message + "\n\n提示：請確保您的瀏覽器允許彈出視窗，或嘗試點擊右上角的「在新視窗開啟」後再試一次。");
    }
    throw error;
  }
};

export const logout = () => auth.signOut();

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
