import { db } from './firebase-config.js';
import {
    doc, getDoc, setDoc, onSnapshot, collection, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUserUid = null;
let sharedWithUids = [];
let currentBudgetDocRef = null;

// --- DOM Elements ---
const leftToBudgetEl = document.getElementById('left-to-budget');
const budgetCategoriesEl = document.getElementById('budget-categories');

// --- State ---
let totalIncomeThisMonth = 0;
let currentTargets = {};

// Wait for auth.js to confirm login
window.addEventListener('vault-authenticated', async (e) => {
    currentUserUid = e.detail.uid;
    
    // Check for shared access for Vault Link
    const userDoc = await getDoc(doc(db, "users", currentUserUid));
    if (userDoc.exists() && userDoc.data().vaultLink) {
        sharedWithUids.push(userDoc.data().vaultLink);
    }
    
    initBudgeting();
});

async function initBudgeting() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JS months are 0-indexed
    
    // Format: YYYY-MM_UID
    const budgetId = `${year}-${month.toString().padStart(2, '0')}_${currentUserUid}`;
    currentBudgetDocRef = doc(db, "budgets", budgetId);

    // 1. Ensure Budget Document Exists
    const budgetSnap = await getDoc(currentBudgetDocRef);
    if (!budgetSnap.exists()) {
        // Generate a fresh template. (Future iteration can pull last month's data here).
        await setDoc(currentBudgetDocRef, {
            ownerId: currentUserUid,
            sharedWith: sharedWithUids,
            month: month,
            year: year,
            targets: {
                "Housing": 0,
                "Food": 0,
                "Transportation": 0,
                "Utilities": 0,
                "Personal": 0
            }
        });
    }

    // 2. Listen to this month's Income
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const incomeQuery = query(
        collection(db, "transactions"),
        where("ownerId", "==", currentUserUid),
        where("type", "==", "income"),
        where("date", ">=", Timestamp.fromDate(startOfMonth)),
        where("date", "<=", Timestamp.fromDate(endOfMonth))
    );

    onSnapshot(incomeQuery, (snapshot) => {
        totalIncomeThisMonth = 0;
        snapshot.forEach(doc => {
            totalIncomeThisMonth += doc.data().amount;
        });
        updateLeftToBudget();
    });

    // 3. Listen to Budget Targets
    onSnapshot(currentBudgetDocRef, (docSnap) => {
        if (docSnap.exists()) {
            currentTargets = docSnap.data().targets || {};
            renderBudgetCategories();
            updateLeftToBudget();
        }
    });
}

function updateLeftToBudget() {
    const totalTargets = Object.values(currentTargets).reduce((sum, val) => sum + val, 0);
    const left = totalIncomeThisMonth - totalTargets;
    
    leftToBudgetEl.textContent = `$${left.toFixed(2)}`;
    
    // Zero-Based Visual Feedback: 
    // Green = unassigned funds, Red = over-budgeted, Black = Perfect Zero
    if (left > 0) {
        leftToBudgetEl.style.color = '#28a745'; 
    } else if (left < 0) {
        leftToBudgetEl.style.color = '#dc3545';
    } else {
        leftToBudgetEl.style.color = 'var(--text-main)';
    }
    
    // Re-enforce Privacy Mode if active
    if (localStorage.getItem('vault_privacy_mode') === 'true') {
        leftToBudgetEl.classList.add('currency-blur');
    }
}

function renderBudgetCategories() {
    budgetCategoriesEl.innerHTML = ''; 
    
    for (const [category, amount] of Object.entries(currentTargets)) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.marginBottom = '12px';
        row.style.paddingBottom = '8px';
        row.style.borderBottom = '1px solid var(--border-color)';
        
        row.innerHTML = `
            <span style="font-weight: 500;">${category}</span>
            <input type="number" data-category="${category}" value="${amount}" step="0.01" 
                   style="width: 120px; padding: 8px; margin: 0; text-align: right;" class="target-input">
        `;
        budgetCategoriesEl.appendChild(row);
    }

    // Bind change events to instantly sync to Firestore
    document.querySelectorAll('.target-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const cat = e.target.getAttribute('data-category');
            const newVal = parseFloat(e.target.value) || 0;
            
            // Merge the specific target update into the budget document
            await setDoc(currentBudgetDocRef, {
                targets: { [cat]: newVal }
            }, { merge: true });
        });
    });
}
