"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/sign-in");
  };

  return (
    <header className="navbar">
      <div className="navbar-logo">
        <img src="/logo-horizontal.png" alt="Creative Lead" />
      </div>
      <ul className="navbar-links">
        <li>
          <Link href="/import" className={`navbar-link ${pathname === "/import" ? "active" : ""}`}>
            Import
          </Link>
        </li>
        <li>
          <Link href="/pipeline" className={`navbar-link ${pathname === "/pipeline" ? "active" : ""}`}>
            Pipeline
          </Link>
        </li>
        <li>
          <Link href="/downloads" className={`navbar-link ${pathname === "/downloads" ? "active" : ""}`}>
            Downloads
          </Link>
        </li>
        <li>
          <Link href="/recommendations" className={`navbar-link ${pathname === "/recommendations" ? "active" : ""}`}>
            Recommendations
          </Link>
        </li>
        <li>
          <Link href="/outreach" className={`navbar-link ${pathname === "/outreach" ? "active" : ""}`}>
            Outreach
          </Link>
        </li>
        <li>
          <Link href="/campaigns" className={`navbar-link ${pathname === "/campaigns" ? "active" : ""}`}>
            Campaigns
          </Link>
        </li>
        <li>
          <Link href="/settings" className={`navbar-link ${pathname === "/settings" ? "active" : ""}`}>
            Settings
          </Link>
        </li>
        <li>
          <Badge variant="navbar">v1.0</Badge>
        </li>
        <li ref={menuRef} style={{ marginLeft: "1rem", display: "flex", alignItems: "center", position: "relative" }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              borderRadius: "50%",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: "#8b5cf6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              U
            </div>
          </button>
          {showMenu && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: 8,
                backgroundColor: "#1a1a2e",
                border: "1px solid #2a2a4a",
                borderRadius: 8,
                padding: "4px 0",
                minWidth: 140,
                zIndex: 1000,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a4a", fontSize: 13, color: "#a0a0c0" }}>
                Authenticated
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </li>
      </ul>
    </header>
  );
};
