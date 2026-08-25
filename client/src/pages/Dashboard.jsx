// src/pages/Dashboard.jsx
import React from "react";
import { useUser, UserButton } from "@clerk/clerk-react";

function Dashboard() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#04060b] flex items-center justify-center text-cyan-400 font-mono">
        Loading ArchMind Workspace...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04060b] text-slate-100 p-8">
      <header className="flex items-center justify-between border-b border-white/10 pb-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">ArchMind Dashboard</h1>
          <p className="text-sm text-slate-400">
            Welcome back, {user?.firstName || user?.username || "Engineer"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Back to Landing
          </a>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="rounded-2xl border border-cyan-500/20 bg-[#080d1a] p-6">
        <h2 className="text-lg font-semibold text-cyan-300 mb-2">
          Repository Analysis Ready
        </h2>
        <p className="text-sm text-slate-400">
          Upload a ZIP file or connect a GitHub repository to generate
          architecture topology and AST maps.
        </p>
      </main>
    </div>
  );
}

export default Dashboard;
