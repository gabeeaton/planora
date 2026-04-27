const { onUserDeleted } = require("firebase-functions/v2/identity");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

// Delete all Firestore data when a user is deleted from Firebase Auth.
// Covers: userProfiles, tasks, taskHistory.
exports.onUserDeleted = onUserDeleted(async (event) => {
  const uid = event.data.uid;
  const db = getFirestore();

  // Firestore has a max 500 writes per batch — chunk if needed
  const deleteCollection = async (query) => {
    const snap = await query.get();
    if (snap.empty) return;
    const chunks = [];
    for (let i = 0; i < snap.docs.length; i += 400) {
      chunks.push(snap.docs.slice(i, i + 400));
    }
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  };

  await Promise.all([
    // Profile document (also contains chat history)
    db.doc(`userProfiles/${uid}`).delete().catch(() => {}),

    // Tasks flat collection filtered by userId
    deleteCollection(db.collection("tasks").where("userId", "==", uid)),

    // Task history flat collection filtered by userId
    deleteCollection(db.collection("taskHistory").where("userId", "==", uid)),
  ]);
});
