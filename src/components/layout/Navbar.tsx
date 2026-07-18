"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui";

interface WorkspaceInfo {
  id: string;
  name: string;
  role: string;
}

interface UserInfo {
  email: string;
  workspaces: WorkspaceInfo[];
  activeWorkspaceId: string;
}

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const menuRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) {
          setUser({
            email: data.user.email,
            workspaces: data.workspaces,
            activeWorkspaceId: data.activeWorkspaceId,
          });
        }
      })
      .catch(() => {});
  }, []);

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
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } catch {}
    router.push("/sign-in");
  };

  const handleSwitchWorkspace = async (workspaceId: string) => {
    // Get current session ID from cookie — we need a small helper
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      // We'll just redirect and let the next page load handle it
    } catch {}
    router.refresh();
  };

  const activeWs = user?.workspaces.find(w => w.id === user.activeWorkspaceId);
  const initial = user?.email?.charAt(0).toUpperCase() || "U";

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
              {initial}
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
                minWidth: 200,
                zIndex: 1000,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              {user && (
                <>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a4a", fontSize: 13, color: "#a0a0c0" }}>
                    {user.email}
                  </div>
                  {user.workspaces.length > 1 && (
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid #2a2a4a", fontSize: 12 }}>
                      <div style={{ color: "#a0a0c0", marginBottom: 4 }}>Workspaces:</div>
                      {user.workspaces.map(ws => (
                        <div
                          key={ws.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 4, padding: "2px 0",
                            color: ws.id === user.activeWorkspaceId ? "#8b5cf6" : "#e0e0f0",
                            fontWeight: ws.id === user.activeWorkspaceId ? 600 : 400,
                          }}
                        >
                          {ws.name} {ws.id === user.activeWorkspaceId ? "(active)" : ""}
                          <span style={{ fontSize: 10, color: "#a0a0c0", marginLeft: "auto" }}>{ws.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
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
