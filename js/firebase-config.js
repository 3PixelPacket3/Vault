// Import the core Firebase SDK and specific services via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Your exact web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDBnCwb2jPl1Lhvfkp3-AlptUs9Ml4SbJ4",
  authDomain: "project-vault-1a4b2.firebaseapp.com",
  projectId: "project-vault-1a4b2",
  storageBucket: "project-vault-1a4b2.firebasestorage.app",
  messagingSenderId: "759309573270",
  appId: "1:759309573270:web:89b99e30566c29bae1b6b7"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Authentication and Firestore services
const auth = getAuth(app);
const db = getFirestore(app);

// Export for use across our module architecture
export { app, auth, db };
