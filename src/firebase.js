import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyA6Dks6vaUR5NDbxW_Arv8tDrKQpOP1D4Y",
  authDomain: "speakup-3e8cd.firebaseapp.com",
  projectId: "speakup-3e8cd",
  storageBucket: "speakup-3e8cd.firebasestorage.app",
  messagingSenderId: "249827939520",
  appId: "1:249827939520:web:1179bec7e2953841600925",
  measurementId: "G-FCWNDPK5QT"
};

const app = initializeApp(firebaseConfig);
let analytics = null;
try {
  if (typeof window !== 'undefined') analytics = getAnalytics(app);
} catch (e) {
  console.warn('Analytics no disponible:', e.message);
}
export { app, analytics };
