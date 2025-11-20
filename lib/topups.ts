import { db } from "./firebase";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  orderBy, 
  where, 
  limit,
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";
import { addUserTokens } from "./tokens";

export interface TopupTransaction {
  id: string;
  userId: string;
  userEmail?: string;
  packageId: string;
  diamonds: number;
  bonus?: number;
  price: number;
  status: "pending" | "settlement" | "expire" | "cancel" | "deny" | "refund";
  paymentMethod?: string;
  orderId: string;
  transactionId?: string;
  midtransTransactionId?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  completedAt?: Timestamp | Date;
}

// Save topup transaction to Firestore
export const saveTopupTransaction = async (transaction: Omit<TopupTransaction, "id" | "createdAt" | "updatedAt">): Promise<string> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const transactionsRef = collection(db, "topupTransactions");
    const newDocRef = doc(transactionsRef);
    
    await setDoc(newDocRef, {
      ...transaction,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return newDocRef.id;
  } catch (error: any) {
    console.error("Error saving topup transaction:", error);
    throw error;
  }
};

// Update topup transaction status
export const updateTopupTransaction = async (
  transactionId: string,
  updates: Partial<Pick<TopupTransaction, "status" | "transactionId" | "midtransTransactionId" | "paymentMethod" | "completedAt">>
): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const transactionRef = doc(db, "topupTransactions", transactionId);
    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp(),
    };

    // If status is settlement, set completedAt
    if (updates.status === "settlement" && !updates.completedAt) {
      updateData.completedAt = serverTimestamp();
    }

    await setDoc(transactionRef, updateData, { merge: true });
  } catch (error: any) {
    console.error("Error updating topup transaction:", error);
    throw error;
  }
};

// Get topup transaction by order ID
export const getTopupTransactionByOrderId = async (orderId: string): Promise<TopupTransaction | null> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const transactionsRef = collection(db, "topupTransactions");
    const q = query(transactionsRef, where("orderId", "==", orderId), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
    } as TopupTransaction;
  } catch (error: any) {
    console.error("Error getting topup transaction:", error);
    throw error;
  }
};

// Get all topup transactions (for admin)
export const getAllTopupTransactions = async (limitCount: number = 100): Promise<TopupTransaction[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const transactionsRef = collection(db, "topupTransactions");
    const q = query(transactionsRef, orderBy("createdAt", "desc"), limit(limitCount));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      } as TopupTransaction;
    });
  } catch (error: any) {
    console.error("Error getting topup transactions:", error);
    throw error;
  }
};

// Get topup transactions by user ID
export const getTopupTransactionsByUserId = async (userId: string): Promise<TopupTransaction[]> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const transactionsRef = collection(db, "topupTransactions");
    const q = query(
      transactionsRef, 
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      } as TopupTransaction;
    });
  } catch (error: any) {
    console.error("Error getting user topup transactions:", error);
    throw error;
  }
};

// Complete topup transaction (add diamonds to user account)
export const completeTopupTransaction = async (
  transactionId: string,
  orderId: string
): Promise<void> => {
  if (!db) {
    throw new Error("Firestore not initialized");
  }

  try {
    const transactionRef = doc(db, "topupTransactions", transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      throw new Error("Transaction not found");
    }

    const transactionData = transactionSnap.data() as TopupTransaction;

    // Check if already completed
    if (transactionData.status === "settlement") {
      console.log("Transaction already completed");
      return;
    }

    // Add diamonds to user account
    const totalDiamonds = transactionData.diamonds + (transactionData.bonus || 0);
    await addUserTokens(transactionData.userId, totalDiamonds);

    // Update transaction status
    await updateTopupTransaction(transactionId, {
      status: "settlement",
      completedAt: serverTimestamp() as any,
    });

    console.log(`Topup completed: Added ${totalDiamonds} diamonds to user ${transactionData.userId}`);
  } catch (error: any) {
    console.error("Error completing topup transaction:", error);
    throw error;
  }
};



