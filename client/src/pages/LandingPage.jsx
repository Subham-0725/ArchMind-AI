import React, { memo, useEffect, useRef } from "react";
import { ReactLenis } from "lenis/react";

import Navbar from "../components/layout/Navbar";
import HeroSection from "../components/LandingPage/HeroSection";
import FeaturesSection from "../components/LandingPage/FeaturesSection";
import WorkflowSection from "../components/LandingPage/WorkflowSection";
import CtaSection from "../components/LandingPage/CtaSection";
import Footer from "../components/LandingPage/Footer";

/* =========================================================================
   PERFORMANCE HELPERS
   ========================================================================= */

const getDeviceProfile = () => {
  if (typeof window === "undefined") {
    return {
      particles: 0,
      dpr: 1,
      fps: 30,
      enabled: false,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;

  /*
   * Conservative performance classification.
   * The background should never compete with the actual application.
   */

  const lowPower = reducedMotion || memory <= 2 || cores <= 2;

  if (lowPower) {
    return {
      particles: 0,
      dpr: 1,
      fps: 20,
      enabled: false,
    };
  }

  // Mobile / touch devices
  if (coarsePointer || width < 768) {
    return {
      particles: Math.min(14, Math.max(8, Math.floor(width / 55))),
      dpr: 1,
      fps: 24,
      enabled: true,
    };
  }

  // Tablets / small laptops
  if (width < 1280) {
    return {
      particles: Math.min(26, Math.max(14, Math.floor(width / 45))),
      dpr: 1.1,
      fps: 30,
      enabled: true,
    };
  }

  // Desktop
  return {
    particles: Math.min(40, Math.max(22, Math.floor(width / 42))),
    dpr: Math.min(window.devicePixelRatio || 1, 1.25),
    fps: 30,
    enabled: true,
  };
};

/* =========================================================================
   HIGH-PERFORMANCE PARTICLE FIELD

   Important:
   - No React state
   - No per-frame DOM updates
   - Limited particle count
   - Limited DPR
   - ~30 FPS cap
   - Pauses when tab is hidden
   - Pauses when canvas isn't visible
   ========================================================================= */

const ParticleField = memo(() => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || typeof window === "undefined") {
      return undefined;
    }

    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    if (!ctx) {
      return undefined;
    }

    let animationFrame = null;
    let resizeTimer = null;

    let width = 0;
    let height = 0;

    let particles = [];

    let isVisible = true;
    let isRunning = false;

    let lastFrameTime = 0;

    const profile = getDeviceProfile();

    /*
     * Disable the canvas entirely on reduced-motion / low-power devices.
     */
    if (!profile.enabled) {
      canvas.style.display = "none";

      return undefined;
    }

    const LINK_DISTANCE = width < 768 ? 80 : 105;
    const LINK_DISTANCE_SQ = LINK_DISTANCE * LINK_DISTANCE;

    const MOUSE_RADIUS = width < 768 ? 0 : 110;
    const MOUSE_RADIUS_SQ = MOUSE_RADIUS * MOUSE_RADIUS;

    const mouse = {
      x: -9999,
      y: -9999,
    };

    /* ---------------------------------------------------------------------
       PARTICLE INITIALIZATION
       --------------------------------------------------------------------- */

    const createParticles = () => {
      particles = Array.from({ length: profile.particles }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,

        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,

        radius: Math.random() * 0.9 + 0.45,
        opacity: Math.random() * 0.25 + 0.1,
      }));
    };

    /* ---------------------------------------------------------------------
       RESPONSIVE CANVAS RESIZE
       --------------------------------------------------------------------- */

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      const dpr = profile.dpr;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      createParticles();
    };

    const handleResize = () => {
      clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {
        resizeCanvas();
      }, 120);
    };

    resizeCanvas();

    /* ---------------------------------------------------------------------
       MOUSE INTERACTION
       --------------------------------------------------------------------- */

    let mouseRAF = null;
    let pendingMouseEvent = null;

    const handleMouseMove = (event) => {
      /*
       * Don't update particle calculations multiple times per frame.
       */
      pendingMouseEvent = event;

      if (mouseRAF) return;

      mouseRAF = requestAnimationFrame(() => {
        if (pendingMouseEvent) {
          mouse.x = pendingMouseEvent.clientX;
          mouse.y = pendingMouseEvent.clientY;
        }

        mouseRAF = null;
      });
    };

    const handleMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    /*
     * Mouse interaction isn't worth the cost on touch devices.
     */
    if (!window.matchMedia("(pointer: coarse)").matches) {
      window.addEventListener("mousemove", handleMouseMove, { passive: true });

      window.addEventListener("mouseleave", handleMouseLeave);
    }

    /* ---------------------------------------------------------------------
       VISIBILITY
       --------------------------------------------------------------------- */

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;

      if (!isVisible) {
        isRunning = false;

        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
      } else {
        startAnimation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    /* ---------------------------------------------------------------------
       INTERSECTION OBSERVER
       --------------------------------------------------------------------- */

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;

        if (isVisible && !document.hidden) {
          startAnimation();
        } else {
          isRunning = false;

          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
          }
        }
      },
      {
        threshold: 0,
      },
    );

    observer.observe(canvas);

    /* ---------------------------------------------------------------------
       RENDER LOOP
       --------------------------------------------------------------------- */

    const frameInterval = 1000 / profile.fps;

    const render = (timestamp) => {
      if (!isVisible || document.hidden) {
        isRunning = false;
        animationFrame = null;
        return;
      }

      /*
       * FPS limiter.
       * The background does not need 60 FPS.
       */
      if (timestamp - lastFrameTime < frameInterval) {
        animationFrame = requestAnimationFrame(render);
        return;
      }

      lastFrameTime = timestamp;

      ctx.clearRect(0, 0, width, height);

      const count = particles.length;

      for (let i = 0; i < count; i++) {
        const particle = particles[i];

        particle.x += particle.vx;
        particle.y += particle.vy;

        /* Wrap around edges */
        if (particle.x < -10) {
          particle.x = width + 10;
        } else if (particle.x > width + 10) {
          particle.x = -10;
        }

        if (particle.y < -10) {
          particle.y = height + 10;
        } else if (particle.y > height + 10) {
          particle.y = -10;
        }

        /* ---------------------------------------------------------------
           Mouse attraction / repulsion
           --------------------------------------------------------------- */

        if (MOUSE_RADIUS > 0) {
          const dx = particle.x - mouse.x;
          const dy = particle.y - mouse.y;

          const distanceSq = dx * dx + dy * dy;

          if (distanceSq < MOUSE_RADIUS_SQ) {
            const distance = Math.sqrt(distanceSq) || 1;

            const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS;

            particle.x += (dx / distance) * force * 0.28;

            particle.y += (dy / distance) * force * 0.28;
          }
        }

        /* ---------------------------------------------------------------
           Particle
           --------------------------------------------------------------- */

        ctx.beginPath();

        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);

        ctx.fillStyle = `rgba(34,211,238,${particle.opacity})`;

        ctx.fill();

        /* ---------------------------------------------------------------
           Connections
           --------------------------------------------------------------- */

        for (let j = i + 1; j < count; j++) {
          const other = particles[j];

          const dx = particle.x - other.x;
          const dy = particle.y - other.y;

          const distanceSq = dx * dx + dy * dy;

          if (distanceSq < LINK_DISTANCE_SQ) {
            const distance = Math.sqrt(distanceSq);

            const alpha = (1 - distance / LINK_DISTANCE) * 0.09;

            ctx.beginPath();

            ctx.moveTo(particle.x, particle.y);

            ctx.lineTo(other.x, other.y);

            ctx.strokeStyle = `rgba(6,182,212,${alpha})`;

            ctx.lineWidth = 0.55;

            ctx.stroke();
          }
        }
      }

      animationFrame = requestAnimationFrame(render);
    };

    /* ---------------------------------------------------------------------
       START / STOP
       --------------------------------------------------------------------- */

    function startAnimation() {
      if (isRunning || !isVisible || document.hidden) {
        return;
      }

      isRunning = true;
      lastFrameTime = performance.now();

      animationFrame = requestAnimationFrame(render);
    }

    startAnimation();

    /* ---------------------------------------------------------------------
       CLEANUP
       --------------------------------------------------------------------- */

    return () => {
      clearTimeout(resizeTimer);

      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      if (mouseRAF) {
        cancelAnimationFrame(mouseRAF);
      }

      window.removeEventListener("resize", handleResize);

      window.removeEventListener("mousemove", handleMouseMove);

      window.removeEventListener("mouseleave", handleMouseLeave);

      document.removeEventListener("visibilitychange", handleVisibilityChange);

      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-20 h-full w-full"
    />
  );
});

ParticleField.displayName = "ParticleField";

/* =========================================================================
   LANDING PAGE
   ========================================================================= */

export default function LandingPage() {
  const handleAnalyze = (repoUrl) => {
    console.log("Analyzing Repository:", repoUrl);
  };

  /*
   * Lenis:
   *
   * Keep the effect subtle.
   * Aggressive smoothing often feels laggy rather than smooth.
   */
  const lenisOptions = {
    lerp: 0.075,
    duration: 1.05,

    smoothWheel: true,

    wheelMultiplier: 0.95,

    /*
     * Lower touch multiplier.
     * High values can make mobile scrolling feel floaty.
     */
    touchMultiplier: 1.15,

    infinite: false,

    /*
     * Prevent unnecessary overscroll behavior.
     */
    syncTouch: false,
  };

  return (
    <ReactLenis root options={lenisOptions}>
      <div
        className="
          relative
          min-h-screen
          overflow-x-hidden
          bg-[#04060b]
          text-slate-100
          antialiased
          selection:bg-cyan-400/20
          selection:text-cyan-200
        "
      >
        {/* ===============================================================
            BASE BACKGROUND
            =============================================================== */}

        <div
          aria-hidden="true"
          className="
            fixed
            inset-0
            -z-50
            bg-[#04060b]
          "
        />

        {/* ===============================================================
            AURORA LIGHT SYSTEM
            =============================================================== */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            fixed
            inset-0
            -z-40
            overflow-hidden
            contain-strict
          "
        >
          {/* Cyan */}
          <div
            className="
              absolute
              -top-[240px]
              left-[10%]
              h-[720px]
              w-[720px]
              rounded-full
              opacity-[0.22]
              blur-[105px]
              will-change-transform
              animate-aurora-cyan
            "
            style={{
              background:
                "radial-gradient(circle, rgba(6,182,212,0.55) 0%, rgba(6,182,212,0.1) 48%, transparent 70%)",
            }}
          />

          {/* Indigo */}
          <div
            className="
              absolute
              top-[20%]
              -right-[220px]
              h-[680px]
              w-[680px]
              rounded-full
              opacity-[0.18]
              blur-[115px]
              will-change-transform
              animate-aurora-indigo
            "
            style={{
              background:
                "radial-gradient(circle, rgba(99,102,241,0.5) 0%, rgba(99,102,241,0.08) 48%, transparent 70%)",
            }}
          />

          {/* Sky + Violet */}
          <div
            className="
              absolute
              bottom-[-280px]
              left-[18%]
              h-[650px]
              w-[650px]
              rounded-full
              opacity-[0.13]
              blur-[110px]
              will-change-transform
              animate-aurora-slow
            "
            style={{
              background:
                "radial-gradient(circle, rgba(14,165,233,0.42) 0%, rgba(139,92,246,0.12) 48%, transparent 70%)",
            }}
          />
        </div>

        {/* ===============================================================
            PARTICLE NETWORK
            =============================================================== */}

        <ParticleField />

        {/* ===============================================================
            BLUEPRINT GRID
            =============================================================== */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            fixed
            inset-0
            -z-30
            opacity-[0.024]
            animate-grid-drift
          "
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(56,189,248,0.55) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(56,189,248,0.55) 1px,
                transparent 1px
              )
            `,
            backgroundSize: "52px 52px",
          }}
        />

        {/* ===============================================================
            CENTER ATMOSPHERIC GLOW
            =============================================================== */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            fixed
            inset-0
            -z-25
            opacity-70
          "
          style={{
            background:
              "radial-gradient(circle at 50% 14%, rgba(8,145,178,0.065), transparent 36%)",
          }}
        />

        {/* ===============================================================
            VIGNETTE
            =============================================================== */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            fixed
            inset-0
            -z-10
          "
          style={{
            background:
              "radial-gradient(ellipse 85% 65% at 50% 18%, transparent 28%, rgba(4,6,11,0.86) 100%)",
          }}
        />

        {/* ===============================================================
            LASER SCAN
            =============================================================== */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            fixed
            left-0
            right-0
            -z-10
            h-px
            opacity-30
            animate-laser-scan
            bg-gradient-to-r
            from-transparent
            via-cyan-400/45
            to-transparent
            shadow-[0_0_14px_rgba(34,211,238,0.55)]
          "
        />

        {/* ===============================================================
            TOP BORDER
            =============================================================== */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            fixed
            top-0
            left-0
            right-0
            -z-10
            h-px
            bg-gradient-to-r
            from-transparent
            via-cyan-500/35
            to-transparent
          "
        />

        {/* ===============================================================
            NAVBAR
            =============================================================== */}

        <Navbar />

        {/* ===============================================================
            MAIN CONTENT
            =============================================================== */}

        <main className="relative z-10">
          <HeroSection onAnalyze={handleAnalyze} />

          <FeaturesSection />

          <WorkflowSection />

          <CtaSection onAnalyze={handleAnalyze} />

          <Footer />
        </main>

        {/* ===============================================================
            BOTTOM FADE
            =============================================================== */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            fixed
            bottom-0
            left-0
            right-0
            h-32
            -z-10
            bg-gradient-to-t
            from-[#04060b]
            to-transparent
          "
        />
      </div>
    </ReactLenis>
  );
}
