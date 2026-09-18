"use client";

import { useState } from "react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <button
      className="logout-button"
      type="button"
      onClick={logout}
      disabled={loading}
      title="Sair"
    >
      {loading ? "..." : "↪"}
    </button>
  );
}
