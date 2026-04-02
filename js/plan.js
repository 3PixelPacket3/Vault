import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc, onSnapshot, collection, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUserUid = null;
let sharedWithUids = [];
let currentBudgetDocRef = null;
let totalIncomeThisMonth = 0;
let currentTargets = {};
let currency = 'USD';

const leftToBudgetEl = document.getElementById('left-to-budget');
const budgetCategoriesEl = document.getElementById('budget-categories');
const fmt = (amount) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

window.addEventListener('vault-authenticated', async (e) => {
  currentUserUid = e.detail.uid;
  currency = e.detail.preferences?.currency || 'USD';
  sharedWithUids = [];

  const userDoc = await getDoc(doc(db, 'users', currentUserUid));
  if (userDoc.exists() && userDoc.data().vaultLink) sharedWithUids.push(userDoc.data().vaultLink);
  initBudgeting();
});

window.addEventListener('vault-preferences-updated', (e) => {
  currency = e.detail.currency || currency;
  updateLeftToBudget();
});

async function initBudgeting() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const budgetId = `${year}-${month.toString().padStart(2, '0')}_${currentUserUid}`;
  currentBudgetDocRef = doc(db, 'budgets', budgetId);

  const budgetSnap = await getDoc(currentBudgetDocRef);
  if (!budgetSnap.exists()) {
    await setDoc(currentBudgetDocRef, {
      ownerId: currentUserUid,
      sharedWith: sharedWithUids,
      month,
      year,
      targets: { Housing: 0, Food: 0, Transportation: 0, Utilities: 0, Savings: 0, Personal: 0 }
    });
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const incomeQuery = query(
    collection(db, 'transactions'),
    where('ownerId', '==', currentUserUid),
    where('type', '==', 'income'),
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<=', Timestamp.fromDate(end))
  );

  onSnapshot(incomeQuery, (snapshot) => {
    totalIncomeThisMonth = snapshot.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
    updateLeftToBudget();
  });

  onSnapshot(currentBudgetDocRef, (d) => {
    if (!d.exists()) return;
    currentTargets = d.data().targets || {};
    renderBudgetCategories();
    updateLeftToBudget();
  });
}

function updateLeftToBudget() {
  const totalTargets = Object.values(currentTargets).reduce((sum, val) => sum + Number(val || 0), 0);
  const left = totalIncomeThisMonth - totalTargets;
  leftToBudgetEl.textContent = fmt(left);
  leftToBudgetEl.style.color = left > 0 ? '#28a745' : left < 0 ? '#dc3545' : 'var(--text-main)';
  if (localStorage.getItem('vault_privacy_mode') === 'true') leftToBudgetEl.classList.add('currency-blur');
}

function renderBudgetCategories() {
  budgetCategoriesEl.innerHTML = '';
  for (const [category, amount] of Object.entries(currentTargets)) {
    const row = document.createElement('div');
    row.className = 'transaction-row';
    row.innerHTML = `
      <span>${category}</span>
      <input class="target-input" data-category="${category}" type="number" step="0.01" value="${Number(amount || 0)}" style="width:120px;text-align:right;margin:0;">
    `;
    budgetCategoriesEl.appendChild(row);
  }

  document.querySelectorAll('.target-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const cat = e.target.getAttribute('data-category');
      const val = parseFloat(e.target.value) || 0;
      await setDoc(currentBudgetDocRef, { targets: { [cat]: val } }, { merge: true });
    });
  });
}
