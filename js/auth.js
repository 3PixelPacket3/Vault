import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const adminCheck = document.getElementById('auth-is-admin');
const adminCodeInput = document.getElementById('auth-admin-code');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnLogout = document.getElementById('btn-logout');
const adminConsole = document.getElementById('admin-console');
const btnForgotPassword = document.getElementById('btn-forgot-password');
const welcomeEmail = document.getElementById('welcome-email');
const createAccountCheck = document.getElementById('auth-create-account');

adminCheck.addEventListener('change', (e) => {
  adminCodeInput.style.display = e.target.checked ? 'block' : 'none';
});

const defaultPreferences = {
  theme: 'light',
  privacyModeDefault: false,
  currency: 'USD',
  monthlySpendLimit: 3000
};

async function ensureUserDoc(user, isAdmin = false) {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      isAdmin,
      vaultLink: '',
      createdAt: new Date().toISOString(),
      preferences: defaultPreferences
    });
    return { isAdmin, preferences: defaultPreferences, email: user.email };
  }

  const data = userSnap.data();
  if (!data.preferences) {
    await setDoc(userRef, { preferences: defaultPreferences }, { merge: true });
    data.preferences = defaultPreferences;
  }
  return data;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const wantsAdmin = adminCheck.checked;
  const adminCode = adminCodeInput.value;

  try {
    if (createAccountCheck.checked) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const isAdmin = wantsAdmin && adminCode === '4535521';
      if (wantsAdmin && !isAdmin) alert('Invalid Admin Code. Creating standard user.');
      await ensureUserDoc(userCredential.user, isAdmin);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    alert(`Authentication error: ${error.message}`);
  }
});

btnGoogleLogin.addEventListener('click', async () => {
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await ensureUserDoc(result.user, false);
  } catch (error) {
    alert('Google Sign-In Error: ' + error.message);
  }
});

btnForgotPassword.addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) return alert('Enter your email first, then click Forgot password.');
  try {
    await sendPasswordResetEmail(auth, email);
    alert('Password reset email sent.');
  } catch (error) {
    alert(`Failed to send reset email: ${error.message}`);
  }
});

btnLogout.addEventListener('click', async () => {
  try { await signOut(auth); } catch (error) { console.error(error); }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authScreen.style.display = 'none';
    mainApp.style.display = 'block';
    const profile = await ensureUserDoc(user, false);
    adminConsole.style.display = profile.isAdmin ? 'block' : 'none';
    welcomeEmail.textContent = user.email;

    window.dispatchEvent(new CustomEvent('vault-preferences-updated', {
      detail: profile.preferences || defaultPreferences
    }));

    window.dispatchEvent(new CustomEvent('vault-authenticated', {
      detail: {
        uid: user.uid,
        isAdmin: !!profile.isAdmin,
        email: user.email,
        preferences: profile.preferences || defaultPreferences
      }
    }));
  } else {
    authScreen.style.display = 'block';
    mainApp.style.display = 'none';
    adminConsole.style.display = 'none';
    welcomeEmail.textContent = '';
    loginForm.reset();
    adminCodeInput.style.display = 'none';
  }
});
