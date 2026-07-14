"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        setError("Invalid access code");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        router.push("/import");
      } else {
        setError("Invalid access code");
      }
    } catch {
      setError("Something went wrong. Try again.");
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#0a0a14",
        backgroundImage:
          "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.18) 0%, transparent 70%)",
        padding: "2rem",
      }}
    >
      <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
        <img
          src="/logo-horizontal.png"
          alt="CreativeLead"
          style={{ height: "36px", objectFit: "contain" }}
        />
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "2rem",
          borderRadius: "10px",
          border: "1px solid #2a2a4a",
          boxShadow: "0 8px 40px rgba(0, 0, 0, 0.6)",
          backgroundColor: "#111120",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#f0f0ff",
            textAlign: "center",
            margin: 0,
          }}
        >
          Enter Access Code
        </h1>

        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter access code"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid #2a2a4a",
            backgroundColor: "#0a0a14",
            color: "#f0f0ff",
            fontSize: "1rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.875rem", margin: 0, textAlign: "center" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "8px",
            border: "none",
            background: loading
              ? "#6d5bb5"
              : "linear-gradient(135deg, #8b5cf6, #6366f1)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.95rem",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "opacity 0.2s",
          }}
        >
          {loading ? "Verifying..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
