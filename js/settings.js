import { db } from './firebase-config.js';
import {
    doc, updateDoc, collection, query, where, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

let currentUserUid = null;

// --- DOM Elements ---
const btnExportCsv = document.getElementById('btn-export-csv');
const vaultLinkUidInput = document.getElementById('vault-link-uid');
const btnLinkAccount = document.getElementById('btn-link-account');
const btnAdminReset = document.getElementById('btn-admin-reset');

// Wait for auth.js to confirm login
window.addEventListener('vault-authenticated', (e) => {
    currentUserUid = e.detail.uid;
});

// --- Vault Link: Shared Access Architecture ---
btnLinkAccount.addEventListener('click', async () => {
    const partnerUid = vaultLinkUidInput.value.trim();
    if (!partnerUid) {
        alert("Please enter a valid Partner UID.");
        return;
    }

    try {
        const userRef = doc(db, "users", currentUserUid);
        await updateDoc(userRef, {
            vaultLink: partnerUid
        });
        alert("Account linked successfully! Transactions created from now on will be shared. Please refresh the page.");
        vaultLinkUidInput.value = '';
    } catch (error) {
        console.error("Error linking account:", error);
        alert("Failed to link account. Ensure you have network connectivity.");
    }
});

// --- Data Portability: CSV Export ---
btnExportCsv.addEventListener('click', async () => {
    try {
        const q = query(
            collection(db, "transactions"), 
            where("ownerId", "==", currentUserUid)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("No transactions found to export.");
            return;
        }

        // Initialize CSV headers
        let csvContent = "Date,Merchant,Category,Type,Amount\n";

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const dateStr = data.date ? data.date.toDate().toLocaleDateString() : 'Pending';
            
            // Escape double quotes and commas in strings for clean CSV formatting
            const merchant = `"${data.merchant.replace(/"/g, '""')}"`;
            const category = `"${data.category.replace(/"/g, '""')}"`;
            
            csvContent += `${dateStr},${merchant},${category},${data.type},${data.amount}\n`;
        });

        // Create Blob and trigger native browser download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Vault_Export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error("Error exporting data:", error);
        alert("Failed to export data.");
    }
});

// --- Admin Console: Global System Reset ---
if (btnAdminReset) {
    btnAdminReset.addEventListener('click', async () => {
        const confirmReset = confirm("WARNING: This will permanently delete all your transaction history. This action cannot be undone. Proceed?");
        if (!confirmReset) return;

        try {
            // Use writeBatch for efficient mass deletion
            const batch = writeBatch(db);
            const q = query(
                collection(db, "transactions"), 
                where("ownerId", "==", currentUserUid)
            );
            const querySnapshot = await getDocs(q);
            
            querySnapshot.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

            await batch.commit();
            alert("Global System Reset complete. All transactions have been wiped.");
            
            // Note: onSnapshot listeners in db.js and ledger.js will automatically 
            // clear the UI since the database is now empty.
        } catch (error) {
            console.error("Error during system reset:", error);
            alert("Failed to reset system.");
        }
    });
}
