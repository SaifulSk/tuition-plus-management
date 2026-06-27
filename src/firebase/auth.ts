import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

export async function registerTeacher(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, 'users', cred.user.uid), {
    role: 'teacher',
    name,
    email,
    createdAt: serverTimestamp(),
  });
  return cred.user;
}

export async function signIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, 'users', cred.user.uid));
  if (!snap.exists()) {
    // Auth account exists but Firestore profile missing (incomplete registration)
    await firebaseSignOut(auth);
    throw new Error(
      'Account setup incomplete. Please delete this account from Firebase Console (Authentication → Users) and register again.'
    );
  }
  return { user: cred.user, role: snap.data().role as 'teacher' | 'student' };
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function getUserRole(uid: string): Promise<'teacher' | 'student' | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data().role as 'teacher' | 'student';
}
