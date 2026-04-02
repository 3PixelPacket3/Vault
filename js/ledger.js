import { db } from './firebase-config.js';
import {
  collection, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUserUid = null;
let allTransactions = [];
let currency = 'USD';

const ledgerList = document.getElementById('ledger-list');
const ledgerSearch = document.getElementById('ledger-search');

const fmt = (amount) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

window.addEventListener('vault-authenticated', (e) => {
  currentUserUid = e.detail.uid;
  currency = e.detail.preferences?.currency || 'USD';
  setupLedgerListener();
});

window.addEventListener('vault-preferences-updated', (e) => {
  currency = e.detail.currency || currency;
  renderLedger(ledgerSearch.value);
});

function setupLedgerListener() {
  const q = query(collection(db, 'transactions'), where('ownerId', '==', currentUserUid), orderBy('date', 'desc'));
  onSnapshot(q, (snapshot) => {
    allTransactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLedger(ledgerSearch.value);
  });
}

function renderLedger(searchTerm) {
  ledgerList.innerHTML = '';
  const s = searchTerm.toLowerCase();
  const filtered = allTransactions.filter(t => !s || t.merchant?.toLowerCase().includes(s) || t.category?.toLowerCase().includes(s));

  if (!filtered.length) {
    ledgerList.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No transactions found.</p>';
    return;
  }

  filtered.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'transaction-row';
    const isExpense = t.type === 'expense';
    const dateString = t.date?.toDate ? t.date.toDate().toLocaleDateString() : 'Pending';

    row.innerHTML = `
      <div>
        <div><strong>${t.merchant}</strong></div>
        <div style="font-size:.85rem;color:var(--text-muted);">${dateString} • ${t.category}</div>
      </div>
      <div>
        <div class="currency" style="font-weight:700;color:${isExpense ? '#dc3545' : '#28a745'};text-align:right;">${isExpense ? '-' : '+'}${fmt(t.amount)}</div>
        <div class="transaction-actions">
          <button data-edit="${t.id}" class="secondary">Edit</button>
          <button data-del="${t.id}" class="danger-btn">Delete</button>
        </div>
      </div>
    `;

    ledgerList.appendChild(row);
  });

  if (localStorage.getItem('vault_privacy_mode') === 'true') {
    ledgerList.querySelectorAll('.currency').forEach(el => el.classList.add('currency-blur'));
  }
}

ledgerSearch.addEventListener('input', (e) => renderLedger(e.target.value));

ledgerList.addEventListener('click', async (e) => {
  const delId = e.target.getAttribute('data-del');
  if (delId) {
    if (!confirm('Delete this transaction?')) return;
    await deleteDoc(doc(db, 'transactions', delId));
    return;
  }

  const editId = e.target.getAttribute('data-edit');
  if (!editId) return;
  const tx = allTransactions.find(t => t.id === editId);
  if (!tx) return;

  const merchant = prompt('Merchant/Source', tx.merchant || '');
  if (!merchant) return;
  const category = prompt('Category', tx.category || '');
  if (!category) return;
  const amount = Number(prompt('Amount', tx.amount));
  if (!Number.isFinite(amount) || amount <= 0) return alert('Invalid amount');

  await updateDoc(doc(db, 'transactions', editId), { merchant: merchant.trim(), category: category.trim(), amount });
});
