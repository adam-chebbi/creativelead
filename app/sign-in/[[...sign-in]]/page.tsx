"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "expired") setError("Link expired. Please request a new one.");
    else if (err === "invalid_token") setError("Invalid link. Please request a new one.");
    else if (err === "server_error") setError("Something went wrong. Please try again.");
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setError("Failed to send sign-in link. Try again.");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="sign-in-page">
        <div className="sign-in-card">
          <h1>Check your email</h1>
          <p>We sent a sign-in link to <strong>{email}</strong></p>
          <p className="sign-in-hint">The link expires in 15 minutes. No password needed.</p>
          <button className="btn btn-ghost" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sign-in-page">
      <div className="sign-in-card">
        <h1>Sign in to CreativeLead</h1>
        <p>Enter your email to receive a magic sign-in link.</p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={loading}
            required
            autoFocus
          />

          {error && <p className="sign-in-error">{error}</p>}

          <button type="submit" disabled={loading || !email.trim()}>
            {loading ? "Sending..." : "Send Magic Link"}
          </button>
        </form>
      </div>
    </div>
  );
}
