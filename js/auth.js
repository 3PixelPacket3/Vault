import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// --- DOM Elements ---
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const adminCheck = document.getElementById('auth-is-admin');
const adminCodeInput = document.getElementById('auth-admin-code');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnLogout = document.getElementById('btn-logout');
const adminConsole = document.getElementById('admin-console');

// --- Admin UI Toggle ---
// Show the admin code input only if the checkbox is checked
adminCheck.addEventListener('change', (e) => {
    adminCodeInput.style.display = e.target.checked ? 'block' : 'none';
});

// --- Email/Password Form Handler ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const wantsAdmin = adminCheck.checked;
    const adminCode = adminCodeInput.value;

    try {
        // 1. Attempt standard login
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        // 2. If user doesn't exist, handle sign-up
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Validate Admin Code (4535521)
                let isAdmin = false;
                if (wantsAdmin && adminCode === '4535521') {
                    isAdmin = true;
                } else if (wantsAdmin && adminCode !== '4535521') {
                    alert("Invalid Admin Code. Registering as standard user.");
                }

                // Create the required Firestore user schema
                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    isAdmin: isAdmin,
                    vaultLink: "",
                    preferences: {
                        theme: "light",
                        privacyModeDefault: false
                    }
                });
            } catch (signupError) {
                alert("Sign Up Error: " + signupError.message);
            }
        } else {
            alert("Login Error: " + error.message);
        }
    }
});

// --- Google OAuth Handler ---
btnGoogleLogin.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Check if this is a first-time Google login by looking for their Firestore doc
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
            await setDoc(userDocRef, {
                email: user.email,
                isAdmin: false, // Standard user by default for OAuth
                vaultLink: "",
                preferences: { theme: "light", privacyModeDefault: false }
            });
        }
    } catch (error) {
        alert("Google Sign-In Error: " + error.message);
    }
});

// --- Secure Logout ---
btnLogout.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error);
    }
});

// --- Global Auth State Observer ---
// This acts as our routing layer and UI gatekeeper
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Hide Auth, Show Main App
        authScreen.style.display = 'none';
        authScreen.classList.remove('active');
        mainApp.style.display = 'block';
        mainApp.classList.add('active');
        
        // Fetch user document to check Admin status
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().isAdmin) {
            adminConsole.style.display = 'block'; // Reveal Admin Tools for authorized users
        } else {
            adminConsole.style.display = 'none';
        }
        
        // Dispatch a custom event so the rest of the app knows it can start fetching data
        window.dispatchEvent(new CustomEvent('vault-authenticated', { detail: { uid: user.uid } }));
    } else {
        // Reset UI to login state
        authScreen.style.display = 'block';
        authScreen.classList.add('active');
        mainApp.style.display = 'none';
        mainApp.classList.remove('active');
        adminConsole.style.display = 'none';
        
        // Clear any form inputs
        loginForm.reset();
        adminCodeInput.style.display = 'none';
    }
});
