// --- DOM Elements ---
const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const btnPrivacyToggle = document.getElementById('btn-privacy-toggle');
const fabAddTransaction = document.getElementById('fab-add-transaction');
const transactionModal = document.getElementById('transaction-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const formTransaction = document.getElementById('form-transaction');

// --- Tab Navigation Logic ---
navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active states from all buttons and sections
        navButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(t => {
            t.style.display = 'none';
            t.classList.remove('active');
        });

        // Add active state to clicked button
        btn.classList.add('active');

        // Reveal the target section
        const targetId = btn.getAttribute('data-target');
        const targetTab = document.getElementById(targetId);
        if (targetTab) {
            targetTab.style.display = 'block';
            // Slight delay allows CSS transitions to catch the active class if added later
            setTimeout(() => targetTab.classList.add('active'), 10);
        }
    });
});

// --- Privacy Mode Logic ---
let privacyModeEnabled = false;

function togglePrivacy() {
    privacyModeEnabled = !privacyModeEnabled;
    const currencyElements = document.querySelectorAll('.currency');
    
    currencyElements.forEach(el => {
        if (privacyModeEnabled) {
            el.classList.add('currency-blur');
        } else {
            el.classList.remove('currency-blur');
        }
    });

    // Update the UI icon
    btnPrivacyToggle.textContent = privacyModeEnabled ? '🙈' : '👁️';
    
    // Save preference to localStorage (Approved non-sensitive UI cache)
    localStorage.setItem('vault_privacy_mode', privacyModeEnabled);
}

btnPrivacyToggle.addEventListener('click', togglePrivacy);

// Initialize Privacy Mode on load if previously set
document.addEventListener('DOMContentLoaded', () => {
    const savedPrivacy = localStorage.getItem('vault_privacy_mode');
    if (savedPrivacy === 'true') {
        togglePrivacy(); // Run once to apply the blur on startup
    }
});

// --- Transaction Modal Logic ---
fabAddTransaction.addEventListener('click', () => {
    transactionModal.style.display = 'flex';
});

btnCloseModal.addEventListener('click', () => {
    transactionModal.style.display = 'none';
    formTransaction.reset();
});

// Close modal if clicking outside the white form container
transactionModal.addEventListener('click', (e) => {
    if (e.target === transactionModal) {
        transactionModal.style.display = 'none';
        formTransaction.reset();
    }
});
