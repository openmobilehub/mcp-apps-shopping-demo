// Seed the Firestore `products` collection from SEED_PRODUCTS — the same array the
// static loader serves — so the Firestore catalog matches the data the demo ships
// with. Idempotent: upserts by id (merge), so re-running updates existing docs
// without creating duplicates.
//
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json npm run seed:catalog
// (or with FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY set).
import { getDb } from "../firebase-admin.js";
import { SEED_PRODUCTS } from "../catalog-seed.js";

async function main() {
  const db = getDb();
  const col = db.collection("products");
  for (const p of SEED_PRODUCTS) {
    const { id, ...fields } = p;
    await col.doc(id).set(fields, { merge: true }); // idempotent upsert by id
    console.log(`seeded ${id}`);
  }
  console.log(`done — ${SEED_PRODUCTS.length} products`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
