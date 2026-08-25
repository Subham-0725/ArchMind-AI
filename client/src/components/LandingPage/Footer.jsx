import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function Footer() {
  const shouldReduceMotion = useReducedMotion();

  const footerLinks = {
    "Core Modules": [
      { name: "AST Topology Visualizer", href: "#" },
      { name: "Database ERD Generator", href: "#" },
      { name: "DevOps Manifest Synthesizer", href: "#" },
      { name: "Repo-Aware RAG Assistant", href: "#" },
      { name: "AST Security Audit", href: "#" },
    ],
    "Resources & Docs": [
      { name: "Documentation", href: "#" },
      { name: "C4 Architecture Guide", href: "#" },
      { name: "CLI & API Reference", href: "#" },
      { name: "Open Source Engine", href: "#" },
      { name: "Changelog", version: "v2.4.0", href: "#" },
    ],
    "Company & Legal": [
      { name: "About Us", href: "#" },
      { name: "Security & Sandboxing", href: "#" },
      { name: "Privacy Policy", href: "#" },
      { name: "Terms of Service", href: "#" },
      { name: "Contact Engineering", href: "#" },
    ],
  };

  const socialLinks = [
    {
      label: "GitHub",
      href: "https://github.com",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      ),
    },
    {
      label: "Discord",
      href: "#",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      ),
    },
    {
      label: "X",
      href: "#",
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
  ];

  return (
    <footer className="relative z-10 overflow-hidden">
      {/* =========================================================
          ATMOSPHERIC FOOTER BACKGROUND
      ========================================================== */}

      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

        {/* Main glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-cyan-500/[0.035] blur-[120px]" />

        {/* Side glow */}
        <div className="absolute bottom-0 right-[-10%] w-[450px] h-[350px] rounded-full bg-indigo-500/[0.025] blur-[120px]" />

        {/* Blueprint grid */}
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(56,189,248,0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(56,189,248,0.8) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#04060b] to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        {/* =========================================================
            MAIN FOOTER GRID
        ========================================================== */}

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 pb-12"
        >
          {/* =====================================================
              BRAND
          ====================================================== */}

          <div className="md:col-span-4">
            <div className="space-y-5">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <motion.div
                  whileHover={
                    shouldReduceMotion
                      ? undefined
                      : {
                          rotate: 4,
                          scale: 1.04,
                        }
                  }
                  transition={{ duration: 0.2 }}
                  className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-500 p-[1px] shadow-[0_0_20px_rgba(6,182,212,0.18)]"
                >
                  <div className="w-full h-full rounded-[10px] bg-[#070c18] flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-cyan-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
                    </svg>
                  </div>
                </motion.div>

                <div>
                  <div className="text-lg font-bold tracking-tight text-white">
                    ArchMind AI
                  </div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-500/60">
                    Architecture Intelligence
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="max-w-sm text-xs sm:text-sm leading-relaxed text-slate-500">
                Synthesizing raw codebase complexity into deterministic
                architectural clarity for modern engineering teams.
              </p>

              {/* Social Links */}
              <div className="flex items-center gap-2 pt-1">
                {socialLinks.map((social) => (
                  <motion.a
                    key={social.label}
                    href={social.href}
                    target={
                      social.href.startsWith("http") ? "_blank" : undefined
                    }
                    rel={
                      social.href.startsWith("http") ? "noreferrer" : undefined
                    }
                    aria-label={social.label}
                    whileHover={
                      shouldReduceMotion
                        ? undefined
                        : {
                            y: -2,
                            scale: 1.04,
                          }
                    }
                    whileTap={
                      shouldReduceMotion
                        ? undefined
                        : {
                            scale: 0.96,
                          }
                    }
                    transition={{ duration: 0.18 }}
                    className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-slate-500 transition-colors duration-200 hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] hover:text-cyan-300"
                  >
                    {social.icon}

                    <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md border border-white/10 bg-[#080d18] px-2 py-1 text-[9px] font-mono text-slate-300 opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100">
                      {social.label}
                    </span>
                  </motion.a>
                ))}
              </div>
            </div>
          </div>

          {/* =====================================================
              LINK COLUMNS
          ====================================================== */}

          {Object.entries(footerLinks).map(([title, links], columnIndex) => (
            <motion.div
              key={title}
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 12,
                    }
              }
              whileInView={
                shouldReduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      y: 0,
                    }
              }
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.4,
                delay: shouldReduceMotion ? 0 : columnIndex * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="md:col-span-2"
            >
              <div className="space-y-4">
                {/* Column Heading */}
                <div className="flex items-center gap-2">
                  <span className="h-px w-4 bg-cyan-500/40" />

                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-slate-500">
                    {title}
                  </h4>
                </div>

                {/* Links */}
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        className="group inline-flex items-center gap-2 text-xs text-slate-500 transition-all duration-200 hover:translate-x-0.5 hover:text-cyan-300"
                      >
                        {/* Tiny indicator */}
                        <span className="h-px w-0 bg-cyan-400 transition-all duration-200 group-hover:w-2" />

                        <span className="relative">
                          {link.name}

                          {/* Hover underline */}
                          <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-cyan-400/70 transition-all duration-200 group-hover:w-full" />
                        </span>

                        {link.version && (
                          <span className="rounded border border-cyan-500/20 bg-cyan-500/[0.06] px-1.5 py-0.5 text-[8px] font-mono text-cyan-500/80">
                            {link.version}
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* =========================================================
            DIVIDER
        ========================================================== */}

        <div className="relative h-px bg-white/[0.07]">
          <div className="absolute left-0 top-0 h-px w-20 bg-gradient-to-r from-cyan-500/60 to-transparent" />
        </div>

        {/* =========================================================
            TELEMETRY BAR
        ========================================================== */}

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="pt-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 text-[10px] sm:text-[11px] font-mono"
        >
          {/* Copyright */}
          <div className="text-slate-600">
            © 2026 <span className="text-slate-400">ARCHMIND AI</span>{" "}
            <span className="mx-1 text-slate-700">•</span>
            SYSTEM STATUS: <span className="text-emerald-500/80">OPTIMAL</span>
          </div>

          {/* System Status */}
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.035] px-3 py-1.5 text-emerald-400/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>

            <span>ALL SYSTEMS OPERATIONAL</span>
          </div>

          {/* Metrics */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-slate-600">
            <span>
              Latency:{" "}
              <strong className="font-normal text-slate-400">12ms</strong>
            </span>

            <span>
              Region:{" "}
              <strong className="font-normal text-cyan-500/80">
                us-east-1
              </strong>
            </span>

            <span>
              Indexed:{" "}
              <strong className="font-normal text-blue-400/80">
                4.2M LOC/s
              </strong>
            </span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
