"use client";

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg, #0a0a14)',
        color: 'var(--color-text, #f0f0ff)',
        fontFamily: 'inherit',
        padding: '2rem',
        textAlign: 'center',
        gap: '1.5rem',
      }}
    >
      {/* Glowing 404 */}
      <div
        style={{
          fontSize: 'clamp(5rem, 20vw, 10rem)',
          fontWeight: 800,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 60%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 0 40px rgba(139,92,246,0.4))',
          userSelect: 'none',
        }}
      >
        404
      </div>

      {/* Message */}
      <div style={{ maxWidth: '400px' }}>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            margin: '0 0 0.75rem',
            color: 'var(--color-text, #f0f0ff)',
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--color-text-secondary, #a0a0c0)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>

      {/* Back to dashboard */}
      <Link
        href="/import"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.65rem 1.5rem',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.9rem',
          textDecoration: 'none',
          boxShadow: '0 4px 20px rgba(139,92,246,0.35)',
          transition: 'opacity 0.2s',
        }}
        onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')}
        onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
