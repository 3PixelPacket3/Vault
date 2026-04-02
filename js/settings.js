import { db } from './firebase-config.js';
import {
  doc, updateDoc, collection, query, where, getDocs, writeBatch, getDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUserUid = null;
let isAdmin = false;

const btnExportCsv = document.getElementById('btn-export-csv');
const vaultLinkUidInput = document.getElementById('vault-link-uid');
const btnLinkAccount = document.getElementById('btn-link-account');
const adminSummary = document.getElementById('admin-summary');
const btnAdminUserReset = document.getElementById('btn-admin-user-reset');
const adminTargetUid = document.getElementById('admin-target-uid');

const prefCurrency = document.getElementById('pref-currency');
const prefMonthlyLimit = document.getElementById('pref-monthly-limit');
const prefTheme = document.getElementById('pref-theme');
const btnSavePreferences = document.getElementById('btn-save-preferences');

window.addEventListener('vault-authenticated', async (e) => {
  currentUserUid = e.detail.uid;
  isAdmin = !!e.detail.isAdmin;

  const prefs = e.detail.preferences || {};
  prefCurrency.value = prefs.currency || 'USD';
  prefMonthlyLimit.value = prefs.monthlySpendLimit || 3000;
  prefTheme.value = prefs.theme || 'light';

  if (isAdmin) await loadAdminSummary();
});

btnSavePreferences.addEventListener('click', async () => {
  if (!currentUserUid) return;
  const payload = {
    theme: prefTheme.value,
    currency: prefCurrency.value,
    monthlySpendLimit: Number(prefMonthlyLimit.value || 3000),
    privacyModeDefault: localStorage.getItem('vault_privacy_mode') === 'true'
  };

  await updateDoc(doc(db, 'users', currentUserUid), { preferences: payload });
  document.documentElement.setAttribute('data-theme', payload.theme);
  window.dispatchEvent(new CustomEvent('vault-preferences-updated', { detail: payload }));
  alert('Preferences saved.');
});

btnLinkAccount.addEventListener('click', async () => {
  const partnerUid = vaultLinkUidInput.value.trim();
  if (!partnerUid) return alert('Please enter a valid Partner UID.');

  try {
    const partner = await getDoc(doc(db, 'users', partnerUid));
    if (!partner.exists()) return alert('No user found for that UID.');

    await updateDoc(doc(db, 'users', currentUserUid), { vaultLink: partnerUid });
    alert('Account linked. New transactions will include linked sharing metadata.');
    vaultLinkUidInput.value = '';
  } catch (error) {
    console.error(error);
    alert('Failed to link account.');
  }
});

btnExportCsv.addEventListener('click', async () => {
  const q = query(collection(db, 'transactions'), where('ownerId', '==', currentUserUid));
  const snap = await getDocs(q);
  if (snap.empty) return alert('No transactions found to export.');

  let csv = 'Date,Merchant,Category,Type,Amount,Notes\n';
  snap.forEach((d) => {
    const t = d.data();
    const dateStr = t.date?.toDate ? t.date.toDate().toLocaleDateString() : 'Pending';
    const merchant = `"${(t.merchant || '').replace(/"/g, '""')}"`;
    const category = `"${(t.category || '').replace(/"/g, '""')}"`;
    const notes = `"${(t.notes || '').replace(/"/g, '""')}"`;
    csv += `${dateStr},${merchant},${category},${t.type},${t.amount},${notes}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Vault_Export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

async function loadAdminSummary() {
  try {
    const [userSnap, txSnap] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'transactions'))]);
    adminSummary.textContent = `Users: ${userSnap.size} • Transactions: ${txSnap.size}`;
  } catch (error) {
    adminSummary.textContent = 'Admin metrics unavailable due to Firestore rule restrictions.';
  }
}

btnAdminUserReset.addEventListener('click', async () => {
  if (!isAdmin) return alert('Unauthorized.');
  const targetUid = adminTargetUid.value.trim();
  if (!targetUid) return alert('Enter target user UID.');
  if (!confirm(`Delete all transactions for ${targetUid}?`)) return;

  const q = query(collection(db, 'transactions'), where('ownerId', '==', targetUid));
  const snap = await getDocs(q);
  if (snap.empty) return alert('No transactions found for that user.');

  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  alert('User transactions reset completed.');
  await loadAdminSummary();
});
