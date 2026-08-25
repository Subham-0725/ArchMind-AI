import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export default function CtaSection({ onAnalyze }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [focused, setFocused] = useState(false);

  const shouldReduceMotion = useReducedMotion();

  const trustBadges = [
    "Free for Open Source",
    "No Credit Card Required",
    "Read-Only Code Sandboxing",
    "Deployable Manifests in 10s",
  ];

  const handleSubmit = (e) => {
    e.preventDefault();

    const value = repoUrl.trim();

    if (value && onAnalyze) {
      onAnalyze(value);
    }
  };

  const reveal = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 18,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.55,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <section
      id="contact"
      className="
        relative z-10
        py-20 sm:py-28
        px-4 sm:px-6 lg:px-8
        overflow-hidden
      "
    >
      {/* =========================================================
          STATIC ATMOSPHERIC LIGHT
          Much cheaper than animating blur continuously.
      ========================================================== */}

      <div
        className="
          absolute
          left-1/2 top-1/2
          -translate-x-1/2 -translate-y-1/2
          w-[700px] h-[350px]
          rounded-full
          bg-cyan-500/[0.055]
          blur-[100px]
          pointer-events-none
        "
      />

      <div
        className="
          absolute
          left-[15%] top-[25%]
          w-[250px] h-[250px]
          rounded-full
          bg-indigo-500/[0.035]
          blur-[90px]
          pointer-events-none
        "
      />

      {/* =========================================================
          CTA CARD
      ========================================================== */}

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{
          once: true,
          amount: 0.2,
        }}
        variants={reveal}
        className="
          relative
          max-w-5xl
          mx-auto
          overflow-hidden
          rounded-[28px]
          border border-white/[0.09]
          bg-[#080C16]/95
          backdrop-blur-xl
          px-6 py-10
          sm:px-12 sm:py-14
          text-center
          shadow-[0_20px_60px_rgba(0,0,0,0.55)]
        "
      >
        {/* =======================================================
            STATIC TOP EDGE LIGHT
        ======================================================== */}

        <div
          className="
            absolute
            top-0 left-1/2
            -translate-x-1/2
            w-[35%]
            h-px
            bg-gradient-to-r
            from-transparent
            via-cyan-400/60
            to-transparent
          "
        />

        {/* =======================================================
            CORNER BRACKETS
        ======================================================== */}

        <div className="absolute top-4 left-4 text-cyan-400/50 font-mono text-lg">
          ┌
        </div>

        <div className="absolute top-4 right-4 text-cyan-400/50 font-mono text-lg">
          ┐
        </div>

        <div className="absolute bottom-4 left-4 text-cyan-400/50 font-mono text-lg">
          └
        </div>

        <div className="absolute bottom-4 right-4 text-cyan-400/50 font-mono text-lg">
          ┘
        </div>

        {/* =======================================================
            STATUS BADGE
        ======================================================== */}

        <motion.div
          variants={reveal}
          className="
            inline-flex
            items-center
            gap-2
            px-3.5 py-1.5
            mb-7
            rounded-full
            border border-cyan-400/20
            bg-cyan-400/[0.045]
            text-cyan-300
            text-[10px] sm:text-[11px]
            font-mono
            tracking-wider
          "
        >
          <span
            className="
              w-1.5 h-1.5
              rounded-full
              bg-cyan-400
              shadow-[0_0_7px_rgba(34,211,238,0.7)]
            "
          />
          ZERO-CONFIGURATION INGESTION
        </motion.div>

        {/* =======================================================
            HEADING
        ======================================================== */}

        <motion.h2
          variants={reveal}
          className="
            text-3xl
            sm:text-5xl
            font-extrabold
            tracking-tight
            leading-[1.08]
            text-white
          "
        >
          Ready to eliminate
          <br className="hidden sm:block" />
          <span
            className="
              text-transparent
              bg-clip-text
              bg-gradient-to-r
              from-white
              via-cyan-100
              to-slate-400
            "
          >
            architectural blindspots?
          </span>
        </motion.h2>

        {/* =======================================================
            DESCRIPTION
        ======================================================== */}

        <motion.p
          variants={reveal}
          className="
            max-w-2xl
            mx-auto
            mt-5
            text-xs sm:text-sm
            leading-relaxed
            text-slate-400
          "
        >
          Stop reverse-engineering code manually. Turn any GitHub repository or
          ZIP archive into an interactive architecture map, living ERD, and
          production-ready DevOps manifests in seconds.
        </motion.p>

        {/* =======================================================
            INPUT
        ======================================================== */}

        <motion.form
          variants={reveal}
          onSubmit={handleSubmit}
          className={`
            relative
            max-w-2xl
            mx-auto
            mt-9
            flex
            items-center
            p-1.5
            rounded-2xl
            bg-[#090E19]
            border
            transition-[border-color,box-shadow]
            duration-200
            ${
              focused
                ? "border-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.12)]"
                : "border-white/10"
            }
          `}
        >
          {/* Terminal prefix */}

          <div
            className="
              hidden sm:flex
              items-center
              gap-1.5
              pl-3
              pr-2
              shrink-0
              font-mono
              text-xs
            "
          >
            <span className="text-cyan-400 font-bold">$</span>

            <span className="text-slate-500">git clone</span>
          </div>

          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="https://github.com/your-team/repository"
            className="
              min-w-0
              flex-1
              bg-transparent
              px-3
              py-3
              text-xs sm:text-sm
              text-slate-100
              placeholder:text-slate-600
              outline-none
              font-mono
            "
          />

          {/* =====================================================
              CTA BUTTON
          ====================================================== */}

          <motion.button
            type="submit"
            whileHover={
              shouldReduceMotion
                ? undefined
                : {
                    y: -1,
                  }
            }
            whileTap={
              shouldReduceMotion
                ? undefined
                : {
                    scale: 0.97,
                  }
            }
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 0.4,
            }}
            className="
              relative
              shrink-0
              flex
              items-center
              justify-center
              gap-2
              px-4 sm:px-6
              py-2.5
              rounded-xl
              overflow-hidden
              bg-linear-to-r
              from-cyan-500
              via-blue-600
              to-indigo-600
              text-white
              text-[10px] sm:text-xs
              font-mono
              font-bold
              tracking-wider
              uppercase
              shadow-[0_0_18px_rgba(6,182,212,0.22)]
              transition-shadow
              duration-200
              hover:shadow-[0_0_25px_rgba(6,182,212,0.32)]
            "
          >
            <span className="relative z-10">
              <span className="hidden sm:inline">Start Free Analysis</span>

              <span className="sm:hidden">Analyze</span>
            </span>

            <span className="relative z-10">→</span>
          </motion.button>
        </motion.form>

        {/* =======================================================
            TRUST BADGES
        ======================================================== */}

        <motion.div
          variants={reveal}
          className="
            flex
            flex-wrap
            justify-center
            gap-2
            mt-7
          "
        >
          {trustBadges.map((badge, index) => (
            <motion.div
              key={badge}
              initial={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : 8,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{ once: true }}
              transition={{
                duration: 0.3,
                delay: shouldReduceMotion ? 0 : 0.35 + index * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : {
                      y: -2,
                    }
              }
              className="
                inline-flex
                items-center
                gap-1.5
                px-3 py-1.5
                rounded-full
                border border-white/[0.07]
                bg-white/2.5
                text-[10px] sm:text-[11px]
                font-mono
                text-slate-400
                transition-colors
                duration-200
                hover:border-cyan-400/20
                hover:text-slate-300
              "
            >
              <span className="text-emerald-400">✓</span>

              {badge}
            </motion.div>
          ))}
        </motion.div>

        {/* =======================================================
            SECURITY STATUS
        ======================================================== */}

        <motion.div
          variants={reveal}
          className="
            flex
            items-center
            justify-center
            gap-2
            mt-8
            text-[9px] sm:text-[10px]
            font-mono
            tracking-wider
            uppercase
            text-slate-600
          "
        >
          <span
            className="
              w-1.5 h-1.5
              rounded-full
              bg-emerald-400
              shadow-[0_0_6px_rgba(52,211,153,0.7)]
            "
          />
          Secure analysis environment · Read-only execution
        </motion.div>
      </motion.div>
    </section>
  );
}
