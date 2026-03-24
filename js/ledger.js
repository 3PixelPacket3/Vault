import { db } from './firebase-config.js';
import {
    collection, query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUserUid = null;
let allTransactions = [];

// --- DOM Elements ---
const ledgerList = document.getElementById('ledger-list');
const ledgerSearch = document.getElementById('ledger-search');

// Wait for auth.js to confirm login
window.addEventListener('vault-authenticated', (e) => {
    currentUserUid = e.detail.uid;
    setupLedgerListener();
});

function setupLedgerListener() {
    const q = query(
        collection(db, "transactions"),
        where("ownerId", "==", currentUserUid),
        orderBy("date", "desc")
    );

    onSnapshot(q, (snapshot) => {
        allTransactions = [];
        snapshot.forEach((doc) => {
            allTransactions.push({ id: doc.id, ...doc.data() });
        });
        
        // Render initially without filters
        renderLedger('');
    });
}

function renderLedger(searchTerm) {
    ledgerList.innerHTML = ''; // Clear current list
    const lowerSearch = searchTerm.toLowerCase();

    // Filter logic
    const filtered = allTransactions.filter(t => {
        if (!searchTerm) return true;
        const merchantMatch = t.merchant.toLowerCase().includes(lowerSearch);
        const categoryMatch = t.category.toLowerCase().includes(lowerSearch);
        return merchantMatch || categoryMatch;
    });

    if (filtered.length === 0) {
        ledgerList.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 20px;">No transactions found.</p>';
        return;
    }

    // Render loop
    filtered.forEach(data => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '12px 0';
        row.style.borderBottom = '1px solid var(--border-color)';

        const amountColor = data.type === 'expense' ? '#dc3545' : '#28a745';
        const amountPrefix = data.type === 'expense' ? '-' : '+';
        
        // Safely handle Firestore timestamps
        const dateString = data.date ? data.date.toDate().toLocaleDateString() : 'Pending';

        row.innerHTML = `
            <div>
                <span style="font-weight: 600;">${data.merchant}</span>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                    ${dateString} • ${data.category}
                </div>
            </div>
            <span class="currency" style="color: ${amountColor}; font-weight: 700;">
                ${amountPrefix}$${data.amount.toFixed(2)}
            </span>
        `;
        
        ledgerList.appendChild(row);
    });

    // Re-enforce Privacy Mode if active
    if (localStorage.getItem('vault_privacy_mode') === 'true') {
        ledgerList.querySelectorAll('.currency').forEach(el => el.classList.add('currency-blur'));
    }
}

// --- Search Event Listener ---
ledgerSearch.addEventListener('input', (e) => {
    renderLedger(e.target.value);
});
