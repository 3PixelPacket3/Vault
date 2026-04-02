const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {logger} = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function assertAdmin(auth) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Authentication required.');
  const userDoc = await db.collection('users').doc(auth.uid).get();
  if (!userDoc.exists || !userDoc.data().isAdmin) {
    throw new HttpsError('permission-denied', 'Admin permissions required.');
  }
}

exports.adminSummary = onCall(async (request) => {
  await assertAdmin(request.auth);
  const [users, transactions, budgets] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('transactions').count().get(),
    db.collection('budgets').count().get()
  ]);

  return {
    userCount: users.data().count,
    transactionCount: transactions.data().count,
    budgetCount: budgets.data().count
  };
});

exports.adminResetUserTransactions = onCall(async (request) => {
  await assertAdmin(request.auth);
  const targetUid = (request.data?.targetUid || '').trim();
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required.');

  const snap = await db.collection('transactions').where('ownerId', '==', targetUid).get();
  const batch = db.batch();
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  logger.info('Admin reset completed', {actor: request.auth.uid, targetUid, deleted: snap.size});
  return {deleted: snap.size};
});
