import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAN5fNV03gonmU9QSihteRbgxUF4OJL9_I",
  authDomain: "tuition-plus-management.firebaseapp.com",
  projectId: "tuition-plus-management",
  storageBucket: "tuition-plus-management.firebasestorage.app",
  messagingSenderId: "923204243083",
  appId: "1:923204243083:web:545ae36cabccb0055fce8e",
  measurementId: "G-BXMYPCEYBP"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
