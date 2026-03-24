import { db } from './firebase-config.js';
import {
    collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, getDoc, doc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUserUid = null;
let sharedWithUids = [];

// --- DOM Elements ---
const formTransaction = document.getElementById('form-transaction');
const transactionModal = document.getElementById('transaction-modal');
const recentActivityContainer = document.getElementById('recent-activity');
const netBalanceDisplay = document.getElementById('net-balance');
const spendProgressBar = document.getElementById('spend-progress');

// --- Initialization ---
// Wait for auth.js to confirm the user is logged in
window.addEventListener('vault-authenticated', async (e) => {
    currentUserUid = e.detail.uid;

    // Fetch user profile to get vaultLink (Shared Access Support)
    const userDoc = await getDoc(doc(db, "users", currentUserUid));
    if (userDoc.exists()) {
        const vaultLink = userDoc.data().vaultLink;
        if (vaultLink) {
            sharedWithUids.push(vaultLink);
        }
    }

    // Begin syncing data
    setupRealtimeListeners();
});

// --- Write: Add New Transaction ---
formTransaction.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('trans-amount').value);
    const type = document.getElementById('trans-type').value;
    const merchant = document.getElementById('trans-merchant').value;
    const category = document.getElementById('trans-category').value;

    try {
        await addDoc(collection(db, "transactions"), {
            ownerId: currentUserUid,
            sharedWith: sharedWithUids,
            amount: amount,
            type: type,
            merchant: merchant,
            category: category,
            date: serverTimestamp(),
            tags: []
        });

        // Reset form and close modal; onSnapshot will handle the UI update
        formTransaction.reset();
        transactionModal.style.display = 'none';
    } catch (error) {
        console.error("Error adding transaction: ", error);
        alert("Failed to save transaction. Ensure you have network connectivity.");
    }
});

// --- Read: Cloud-First Realtime Sync ---
function setupRealtimeListeners() {
    // Query transactions owned by the user, ordered by newest first
    const q = query(
        collection(db, "transactions"),
        where("ownerId", "==", currentUserUid),
        orderBy("date", "desc")
    );

    onSnapshot(q, (snapshot) => {
        let netBalance = 0;
        let monthlySpend = 0;
        const currentMonth = new Date().getMonth();
        
        recentActivityContainer.innerHTML = ''; // Clear stale data
        let count = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            
            // 1. Calculate Balances
            if (data.type === 'income') {
                netBalance += data.amount;
            } else if (data.type === 'expense') {
                netBalance -= data.amount;
                
                // If the transaction happened this month, add to Monthly Spend tracker
                if (data.date && data.date.toDate().getMonth() === currentMonth) {
                    monthlySpend += data.amount;
                }
            }

            // 2. Render Top 5 Recent Activities for the Dashboard Widget
            if (count < 5) {
                const activityEl = document.createElement('div');
                activityEl.style.display = 'flex';
                activityEl.style.justifyContent = 'space-between';
                activityEl.style.padding = '12px 0';
                activityEl.style.borderBottom = '1px solid var(--border-color)';
                
                const amountColor = data.type === 'expense' ? '#dc3545' : '#28a745';
                const amountPrefix = data.type === 'expense' ? '-' : '+';
                
                activityEl.innerHTML = `
                    <span style="font-weight: 500;">${data.merchant} <br><small style="color: var(--text-muted); font-weight: normal;">${data.category}</small></span>
                    <span class="currency" style="color: ${amountColor}; font-weight: 700;">${amountPrefix}$${data.amount.toFixed(2)}</span>
                `;
                recentActivityContainer.appendChild(activityEl);
                count++;
            }
        });

        if (count === 0) {
            recentActivityContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No recent activity.</p>';
        }

        // 3. Update Dashboard UI
        netBalanceDisplay.textContent = `$${netBalance.toFixed(2)}`;
        
        // Update Progress Bar (Default visual limit set to $3000 for Dashboard; logic expands in plan.js)
        const spendPercentage = Math.min((monthlySpend / 3000) * 100, 100);
        spendProgressBar.style.width = `${spendPercentage}%`;
        spendProgressBar.style.backgroundColor = spendPercentage >= 90 ? '#dc3545' : 'var(--accent-color)';

        // 4. Re-enforce Privacy Mode if active
        if (localStorage.getItem('vault_privacy_mode') === 'true') {
            document.querySelectorAll('.currency').forEach(el => el.classList.add('currency-blur'));
        }
    });
}
