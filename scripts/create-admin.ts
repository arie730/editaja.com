/**
 * Script to create an admin user in Firestore
 * 
 * Usage:
 * 1. Make sure you have Firebase initialized
 * 2. Run: npx ts-node scripts/create-admin.ts <email> <uid>
 * 
 * Or use Firebase Console:
 * 1. Go to Firestore Database
 * 2. Create a collection named "admins"
 * 3. Add a document with document ID = user's UID
 * 4. Add field: isAdmin = true
 * 5. Add field: email = user's email
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function createAdmin(uid: string, email: string) {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    await setDoc(doc(db, "admins", uid), {
      email,
      isAdmin: true,
      createdAt: serverTimestamp(),
    });

    console.log(`✅ Admin user created successfully!`);
    console.log(`   UID: ${uid}`);
    console.log(`   Email: ${email}`);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  }
}

// Get arguments from command line
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: npx ts-node scripts/create-admin.ts <uid> <email>");
  console.log("Example: npx ts-node scripts/create-admin.ts abc123 user@example.com");
  process.exit(1);
}

const [uid, email] = args;
createAdmin(uid, email);







