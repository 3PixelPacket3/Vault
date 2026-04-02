const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const btnPrivacyToggle = document.getElementById('btn-privacy-toggle');
const fabAddTransaction = document.getElementById('fab-add-transaction');
const transactionModal = document.getElementById('transaction-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const formTransaction = document.getElementById('form-transaction');

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    navButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(t => { t.style.display = 'none'; t.classList.remove('active'); });
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.target);
    if (target) {
      target.style.display = 'block';
      target.classList.add('active');
    }
  });
});

let privacyModeEnabled = false;
function applyPrivacyMode(enabled) {
  privacyModeEnabled = enabled;
  document.querySelectorAll('.currency').forEach(el => el.classList.toggle('currency-blur', enabled));
  btnPrivacyToggle.textContent = enabled ? '🙈' : '👁️';
  localStorage.setItem('vault_privacy_mode', String(enabled));
}

btnPrivacyToggle.addEventListener('click', () => applyPrivacyMode(!privacyModeEnabled));
document.addEventListener('DOMContentLoaded', () => applyPrivacyMode(localStorage.getItem('vault_privacy_mode') === 'true'));

fabAddTransaction.addEventListener('click', () => {
  document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
  transactionModal.style.display = 'flex';
});

function closeModal() {
  transactionModal.style.display = 'none';
  formTransaction.reset();
}

btnCloseModal.addEventListener('click', closeModal);
transactionModal.addEventListener('click', (e) => {
  if (e.target === transactionModal) closeModal();
});

window.addEventListener('vault-preferences-updated', (e) => {
  const { theme, privacyModeDefault } = e.detail;
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  if (typeof privacyModeDefault === 'boolean') applyPrivacyMode(privacyModeDefault);
});
