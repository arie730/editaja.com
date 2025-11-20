"use client";

import { useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all hover:scale-110"
        aria-label="Send Feedback"
        title="Send Feedback"
      >
        <span className="material-symbols-outlined text-2xl">feedback</span>
      </button>

      <FeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        user={user}
      />
    </>
  );
}

