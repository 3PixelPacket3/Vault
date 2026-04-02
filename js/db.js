import { db } from './firebase-config.js';
import {
  collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp,
  getDoc, doc, arrayUnion, updateDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUserUid = null;
let sharedWithUids = [];
let monthlyLimit = 3000;
let currency = 'USD';

const formTransaction = document.getElementById('form-transaction');
const transactionModal = document.getElementById('transaction-modal');
const recentActivityContainer = document.getElementById('recent-activity');
const netBalanceDisplay = document.getElementById('net-balance');
const monthIncomeDisplay = document.getElementById('month-income');
const monthExpenseDisplay = document.getElementById('month-expense');
const spendProgressBar = document.getElementById('spend-progress');
const spendProgressLabel = document.getElementById('spend-progress-label');

const fmt = (amount) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

window.addEventListener('vault-authenticated', async (e) => {
  currentUserUid = e.detail.uid;
  currency = e.detail.preferences?.currency || 'USD';
  monthlyLimit = e.detail.preferences?.monthlySpendLimit || 3000;

  sharedWithUids = [];
  const userDoc = await getDoc(doc(db, 'users', currentUserUid));
  if (userDoc.exists() && userDoc.data().vaultLink) sharedWithUids.push(userDoc.data().vaultLink);
  setupRealtimeListeners();
});

window.addEventListener('vault-preferences-updated', (e) => {
  currency = e.detail.currency || currency;
  monthlyLimit = Number(e.detail.monthlySpendLimit || monthlyLimit);
});

formTransaction.addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('trans-amount').value);
  const type = document.getElementById('trans-type').value;
  const merchant = document.getElementById('trans-merchant').value.trim();
  const category = document.getElementById('trans-category').value.trim();
  const notes = document.getElementById('trans-notes').value.trim();
  const selectedDate = document.getElementById('trans-date').value;

  if (!currentUserUid || !merchant || !category || !Number.isFinite(amount) || amount <= 0) {
    return alert('Please provide valid transaction details.');
  }

  try {
    await addDoc(collection(db, 'transactions'), {
      ownerId: currentUserUid,
      sharedWith: sharedWithUids,
      amount,
      type,
      merchant,
      category,
      notes,
      date: selectedDate ? new Date(`${selectedDate}T12:00:00`) : serverTimestamp(),
      createdAt: serverTimestamp(),
      tags: []
    });

    if (sharedWithUids.length) {
      await Promise.all(sharedWithUids.map(async uid => {
        const u = doc(db, 'users', uid);
        await updateDoc(u, { linkedBy: arrayUnion(currentUserUid) });
      }));
    }

    formTransaction.reset();
    transactionModal.style.display = 'none';
  } catch (error) {
    console.error(error);
    alert('Failed to save transaction.');
  }
});

function setupRealtimeListeners() {
  const q = query(collection(db, 'transactions'), where('ownerId', '==', currentUserUid), orderBy('date', 'desc'));

  onSnapshot(q, (snapshot) => {
    let net = 0;
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    recentActivityContainer.innerHTML = '';
    let count = 0;

    snapshot.forEach((d) => {
      const data = d.data();
      if (data.type === 'income') net += data.amount;
      if (data.type === 'expense') net -= data.amount;

      const txDate = data.date?.toDate ? data.date.toDate() : (data.date ? new Date(data.date) : null);
      if (txDate && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        if (data.type === 'income') monthlyIncome += data.amount;
        if (data.type === 'expense') monthlyExpense += data.amount;
      }

      if (count < 7) {
        const activityEl = document.createElement('div');
        activityEl.className = 'transaction-row';
        const isExpense = data.type === 'expense';
        activityEl.innerHTML = `
          <span><strong>${data.merchant}</strong><br><small>${data.category}</small></span>
          <span class="currency" style="color:${isExpense ? '#dc3545' : '#28a745'};font-weight:700;">${isExpense ? '-' : '+'}${fmt(data.amount)}</span>
        `;
        recentActivityContainer.appendChild(activityEl);
        count++;
      }
    });

    if (!count) recentActivityContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No recent activity.</p>';

    netBalanceDisplay.textContent = fmt(net);
    monthIncomeDisplay.textContent = fmt(monthlyIncome);
    monthExpenseDisplay.textContent = fmt(monthlyExpense);

    const pct = Math.min((monthlyExpense / monthlyLimit) * 100, 100);
    spendProgressBar.style.width = `${pct}%`;
    spendProgressBar.style.backgroundColor = pct >= 90 ? '#dc3545' : 'var(--accent-color)';
    spendProgressLabel.textContent = `${fmt(monthlyExpense)} of ${fmt(monthlyLimit)} limit`;

    if (localStorage.getItem('vault_privacy_mode') === 'true') {
      document.querySelectorAll('.currency').forEach(el => el.classList.add('currency-blur'));
    }
  });
}
