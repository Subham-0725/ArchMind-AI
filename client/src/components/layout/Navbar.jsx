import React, { useState, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";

const Navbar = () => {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");
  const [hoveredTab, setHoveredTab] = useState(null);

  const navRef = useRef(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Scroll direction awareness
  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    setScrolled(latest > 20);

    if (latest > previous && latest > 140) {
      setHidden(true);
      setMobileMenuOpen(false);
    } else {
      setHidden(false);
    }
  });

  const navLinks = [
    { name: "Home", href: "#home" },
    { name: "About Us", href: "#about" },
    { name: "Services", href: "#services" },
    { name: "Contact Us", href: "#contact" },
  ];

  return (
    <motion.header
      ref={navRef}
      variants={{
        visible: { y: 0, opacity: 1 },
        hidden: { y: -100, opacity: 0 },
      }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-3.5 sm:pt-5 pointer-events-none"
    >
      <motion.nav
        aria-label="Main Navigation"
        animate={{
          backgroundColor: scrolled
            ? "rgba(6, 10, 20, 0.88)"
            : "rgba(9, 14, 28, 0.72)",
          borderColor: scrolled
            ? "rgba(6, 182, 212, 0.3)"
            : "rgba(255, 255, 255, 0.08)",
          boxShadow: scrolled
            ? "0 16px 40px -8px rgba(0, 0, 0, 0.8), 0 0 25px 0 rgba(6, 182, 212, 0.12)"
            : "0 8px 32px -4px rgba(0, 0, 0, 0.45)",
        }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-5xl rounded-full backdrop-blur-2xl border px-3 sm:px-4 py-2 flex items-center justify-between relative pointer-events-auto select-none"
      >
        {/* =========================================================
            1. BRAND LOGO & ENGINE INDICATOR
        ========================================================== */}
        <a
          href="#home"
          className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-full pl-1"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="relative flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-500 p-[1px] shadow-[0_0_14px_rgba(6,182,212,0.35)]"
          >
            <div className="w-full h-full bg-[#070b16] rounded-[11px] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-cyan-400/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <svg
                className="w-4 h-4 text-cyan-400 transition-transform duration-300 group-hover:rotate-45"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
              </svg>
            </div>
          </motion.div>

          <div className="flex items-center gap-1.5">
            <span className="text-sm sm:text-base font-bold tracking-tight text-white transition-colors duration-200 group-hover:text-cyan-200">
              ArchMind
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              AI
            </span>
          </div>
        </a>

        {/* =========================================================
            2. REFINED CENTER NAV PILLS
        ========================================================== */}
        <div
          onMouseLeave={() => setHoveredTab(null)}
          className="hidden md:flex items-center gap-1 bg-[#050813]/60 border border-white/5 rounded-full p-1 shadow-inner relative"
        >
          {navLinks.map((link) => {
            const isActive = activeTab === link.name;
            const isHovered = hoveredTab === link.name;

            return (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setActiveTab(link.name)}
                onMouseEnter={() => setHoveredTab(link.name)}
                className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors duration-200 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isActive
                    ? "text-cyan-100 font-semibold"
                    : isHovered
                      ? "text-slate-100"
                      : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {/* Active Pill Glow */}
                {isActive && (
                  <motion.div
                    layoutId="activePill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 bg-gradient-to-r from-cyan-500/25 via-blue-500/20 to-indigo-500/25 border border-cyan-400/40 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.3)] z-[-1]"
                  />
                )}

                {/* Hover Pill Trace */}
                {isHovered && !isActive && (
                  <motion.div
                    layoutId="hoverPill"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    className="absolute inset-0 bg-white/[0.06] rounded-full z-[-1]"
                  />
                )}

                {link.name}
              </a>
            );
          })}
        </div>

        {/* =========================================================
            3. RIGHT AUTH ACTION (UNIFIED CAPSULE)
        ========================================================== */}
        <div className="hidden md:flex items-center">
          {/* SIGNED OUT STATE */}
          <SignedOut>
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="group relative inline-flex items-center justify-center px-4.5 py-1.5 text-xs font-medium text-slate-200 rounded-full overflow-hidden border border-white/10 hover:border-cyan-500/40 bg-white/[0.03] hover:bg-cyan-500/[0.08] hover:text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 pointer-events-none" />

                <span className="flex items-center gap-2 relative z-10">
                  <span>Login</span>
                  <svg
                    className="w-3.5 h-3.5 text-cyan-400 transition-transform duration-200 group-hover:translate-x-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </span>
              </motion.button>
            </SignInButton>
          </SignedOut>

          {/* SIGNED IN STATE: Cohesive Integrated Hub */}
          <SignedIn>
            <div className="flex items-center gap-2.5 pl-3 pr-1.5 py-1 rounded-full bg-[#050813]/80 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <a
                href="/dashboard"
                className="flex items-center gap-1.5 text-xs font-mono font-medium text-cyan-300 hover:text-white transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Dashboard</span>
                <span className="text-[10px] text-cyan-400">➔</span>
              </a>

              <span className="w-px h-4 bg-white/10" />

              {/* Styled User Profile Button */}
              <div className="flex items-center justify-center ring-1 ring-cyan-500/40 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-6.5 h-6.5",
                    },
                  }}
                />
              </div>
            </div>
          </SignedIn>
        </div>

        {/* =========================================================
            4. MOBILE HAMBURGER TOGGLE
        ========================================================== */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle mobile menu"
          className="md:hidden flex items-center justify-center w-8.5 h-8.5 rounded-full text-slate-300 hover:text-white bg-white/[0.04] border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <div className="w-4 h-4 flex flex-col justify-around">
            <motion.span
              animate={
                mobileMenuOpen ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }
              }
              transition={{ duration: 0.2 }}
              className="w-full h-0.5 bg-current rounded-full origin-center"
            />
            <motion.span
              animate={
                mobileMenuOpen
                  ? { opacity: 0, scale: 0 }
                  : { opacity: 1, scale: 1 }
              }
              transition={{ duration: 0.15 }}
              className="w-full h-0.5 bg-current rounded-full"
            />
            <motion.span
              animate={
                mobileMenuOpen ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }
              }
              transition={{ duration: 0.2 }}
              className="w-full h-0.5 bg-current rounded-full origin-center"
            />
          </div>
        </motion.button>
      </motion.nav>

      {/* =========================================================
          5. MOBILE STAGGERED DRAWER
      ========================================================== */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden absolute top-[62px] left-4 right-4 bg-[#080d1a]/95 backdrop-blur-2xl border border-cyan-500/25 rounded-2xl p-3.5 shadow-[0_20px_45px_rgba(0,0,0,0.85)] flex flex-col gap-1.5 pointer-events-auto overflow-hidden"
          >
            <div className="flex flex-col gap-1">
              {navLinks.map((link, idx) => {
                const isActive = activeTab === link.name;
                return (
                  <motion.a
                    key={link.name}
                    href={link.href}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.2 }}
                    onClick={() => {
                      setActiveTab(link.name);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                        : "text-slate-300 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    {link.name}
                  </motion.a>
                );
              })}
            </div>

            {/* Mobile Auth Hub */}
            <div className="pt-2 mt-1 border-t border-white/10">
              <SignedOut>
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-indigo-500/15 border border-cyan-500/30 text-cyan-300 hover:text-white text-sm font-medium transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                  >
                    <span>Login</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </button>
                </SignInButton>
              </SignedOut>

              <SignedIn>
                <div className="flex items-center justify-between px-3.5 py-2 bg-[#050813] rounded-xl border border-cyan-500/20 shadow-inner">
                  <a
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-sm font-mono font-medium text-cyan-300 hover:text-white"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Workspace Dashboard</span>
                    <span>➔</span>
                  </a>
                  <div className="ring-1 ring-cyan-500/40 rounded-full">
                    <UserButton afterSignOutUrl="/" />
                  </div>
                </div>
              </SignedIn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Navbar;
