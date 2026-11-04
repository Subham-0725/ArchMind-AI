// server/src/services/reports/pdfReport.service.js
//
// Publication-Quality PDF Report Generation Service for ArchMind AI.
// Streams comprehensive, professionally formatted repository intelligence reports
// directly to the HTTP response stream with strict secret redaction, robust pagination,
// visual architecture diagrams, and zero empty pages.

import PDFDocument from "pdfkit";
import { collectReportData } from "./reportData.service.js";

// ── COLOR PALETTE & DESIGN SYSTEM ─────────────────────────────────────────────
const COLORS = {
  navy: "#0f172a", // Slate-900: Primary headings and branding
  navyLight: "#1e293b", // Slate-800
  cyan: "#0891b2", // Cyan-600: Accent highlights, section banners
  cyanLight: "#e0f2fe", // Sky-100: Soft badge fill
  cyanDark: "#0e7490", // Cyan-700
  body: "#334155", // Slate-700: High-readability body text
  muted: "#64748b", // Slate-500: Secondary text, captions, metadata
  cardBg: "#f8fafc", // Slate-50: Card and table header fill
  cardBgAlt: "#f1f5f9", // Slate-100
  codeBg: "#f1f5f9", // Slate-100 for code snippets
  border: "#cbd5e1", // Slate-300: Crisp borders
  borderLight: "#e2e8f0", // Slate-200: Subtle divider lines
  white: "#ffffff",

  // Severity & Status
  criticalText: "#991b1b",
  criticalBg: "#fee2e2",
  highText: "#c2410c",
  highBg: "#ffedd5",
  mediumText: "#b45309",
  mediumBg: "#fef3c7",
  lowText: "#1d4ed8",
  lowBg: "#dbeafe",
  validText: "#15803d",
  validBg: "#dcfce7",
};

const GEOMETRY = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  marginLeft: 45,
  marginRight: 45,
  marginTop: 40,
  marginBottom: 40,
  contentWidth: 505.28, // 595.28 - 90
  maxContentY: 750, // Leaves 51pt safety margin before PDFKit auto page-break (801.89)
  headerY: 45,
};

// ── LAYOUT COORDINATOR & HELPERS ─────────────────────────────────────────────

/**
 * Ensures sufficient vertical space on current page; adds a new page only if needed.
 *
 * @param {PDFKit.PDFDocument} doc
 * @param {number} neededHeight
 * @param {Object} state - { currentY, pageNumber }
 * @returns {boolean} true if a page break occurred
 */
function ensureSpace(doc, neededHeight, state) {
  if (state.currentY + neededHeight > GEOMETRY.maxContentY) {
    doc.addPage();
    state.currentY = GEOMETRY.headerY;
    state.pageNumber++;
    return true;
  }
  return false;
}

/**
 * Draws a section header with accent bar, title, and optional subtitle.
 * Includes orphan-guard: breaks to a new page if the header and its first element cannot fit.
 */
function drawSectionHeader(doc, title, subtitle, state, firstElementHeight = 40) {
  const headerHeight = subtitle ? 52 : 38;
  const totalNeeded = headerHeight + firstElementHeight;

  ensureSpace(doc, totalNeeded, state);

  const startY = state.currentY;

  // Primary accent bar
  doc.rect(GEOMETRY.marginLeft, startY, 4, subtitle ? 28 : 20).fill(COLORS.cyan);

  // Section Title
  doc
    .fillColor(COLORS.navy)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(title, GEOMETRY.marginLeft + 12, startY + 2);

  if (subtitle) {
    doc
      .fillColor(COLORS.muted)
      .fontSize(8.5)
      .font("Helvetica")
      .text(subtitle, GEOMETRY.marginLeft + 12, startY + 18, {
        width: GEOMETRY.contentWidth - 16,
      });
    state.currentY += 34;
  } else {
    state.currentY += 26;
  }

  // Thin separator rule
  doc.rect(GEOMETRY.marginLeft, state.currentY, GEOMETRY.contentWidth, 0.75).fill(COLORS.borderLight);
  state.currentY += 10;
}

/**
 * Draws an inline informational/empty callout box.
 */
function drawCallout(doc, type, message, state) {
  ensureSpace(doc, 36, state);

  const y = state.currentY;
  const isWarning = type === "warning";
  const isSuccess = type === "success";

  const bgColor = isSuccess ? COLORS.validBg : isWarning ? COLORS.mediumBg : COLORS.cardBg;
  const borderColor = isSuccess ? "#86efac" : isWarning ? "#fde68a" : COLORS.borderLight;
  const textColor = isSuccess ? COLORS.validText : isWarning ? COLORS.mediumText : COLORS.muted;

  doc.rect(GEOMETRY.marginLeft, y, GEOMETRY.contentWidth, 26).fillAndStroke(bgColor, borderColor);

  doc
    .fillColor(textColor)
    .fontSize(8.5)
    .font("Helvetica-Oblique")
    .text(message, GEOMETRY.marginLeft + 12, y + 8, {
      width: GEOMETRY.contentWidth - 24,
    });

  state.currentY += 34;
}

/**
 * Draws a grid of 2–4 metric summary cards.
 */
function drawMetricGrid(doc, cards, state) {
  ensureSpace(doc, 64, state);

  const cardCount = cards.length;
  const gap = 8;
  const cardWidth = (GEOMETRY.contentWidth - gap * (cardCount - 1)) / cardCount;
  const cardHeight = 52;
  const y = state.currentY;

  cards.forEach((card, i) => {
    const x = GEOMETRY.marginLeft + i * (cardWidth + gap);

    // Card background & border
    doc.rect(x, y, cardWidth, cardHeight).fillAndStroke(COLORS.cardBg, COLORS.borderLight);

    // Metric Label
    doc
      .fillColor(COLORS.muted)
      .fontSize(7)
      .font("Helvetica-Bold")
      .text(card.label.toUpperCase(), x + 8, y + 8, { width: cardWidth - 16, ellipsis: true });

    // Metric Value
    doc
      .fillColor(card.valueColor || COLORS.navy)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(card.value, x + 8, y + 21, { width: cardWidth - 16, ellipsis: true });

    // Subtitle / helper note
    if (card.subtext) {
      doc
        .fillColor(COLORS.muted)
        .fontSize(6.5)
        .font("Helvetica")
        .text(card.subtext, x + 8, y + 38, { width: cardWidth - 16, ellipsis: true });
    }
  });

  state.currentY += cardHeight + 8;
}

/**
 * Draws a 2-column key-value specification table.
 */
function drawKeyValueTable(doc, rows, state) {
  const rowHeight = 17;
  const neededHeight = rows.length * rowHeight + 12;
  ensureSpace(doc, Math.min(neededHeight, 100), state);

  const colWidthKey = 145;
  const colWidthVal = GEOMETRY.contentWidth - colWidthKey - 16;

  rows.forEach((row, idx) => {
    ensureSpace(doc, rowHeight, state);
    const y = state.currentY;

    // Alternating row background
    if (idx % 2 === 0) {
      doc.rect(GEOMETRY.marginLeft, y, GEOMETRY.contentWidth, rowHeight).fill(COLORS.cardBg);
    }

    doc
      .fillColor(COLORS.navyLight)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text(row.key, GEOMETRY.marginLeft + 8, y + 4, { width: colWidthKey, ellipsis: true });

    doc
      .fillColor(row.valueColor || COLORS.body)
      .fontSize(8)
      .font("Helvetica")
      .text(row.value, GEOMETRY.marginLeft + colWidthKey + 8, y + 4, {
        width: colWidthVal,
        ellipsis: true,
      });

    state.currentY += rowHeight;
  });

  state.currentY += 8;
}

/**
 * Draws a formatted table with column definitions, text wrapping, and automated pagination with repeated headers.
 */
function drawTable(doc, columns, rows, state) {
  const headerHeight = 20;

  function renderHeader(y) {
    doc.rect(GEOMETRY.marginLeft, y, GEOMETRY.contentWidth, headerHeight).fill(COLORS.navy);
    let curX = GEOMETRY.marginLeft + 8;

    columns.forEach((col) => {
      doc
        .fillColor(COLORS.white)
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .text(col.header.toUpperCase(), curX, y + 6, {
          width: col.width - 8,
          align: col.align || "left",
          ellipsis: true,
        });
      curX += col.width;
    });

    return y + headerHeight;
  }

  ensureSpace(doc, headerHeight + 24, state);
  state.currentY = renderHeader(state.currentY);

  rows.forEach((row, rowIdx) => {
    const rowHeight = row._height || 18;

    if (ensureSpace(doc, rowHeight, state)) {
      state.currentY = renderHeader(state.currentY);
    }

    const y = state.currentY;

    // Zebra striping
    if (rowIdx % 2 === 1) {
      doc.rect(GEOMETRY.marginLeft, y, GEOMETRY.contentWidth, rowHeight).fill(COLORS.cardBg);
    }
    // Bottom border per row
    doc.rect(GEOMETRY.marginLeft, y + rowHeight - 0.5, GEOMETRY.contentWidth, 0.5).fill(COLORS.borderLight);

    let curX = GEOMETRY.marginLeft + 8;
    columns.forEach((col) => {
      const cellValue = String(row[col.key] ?? "");
      const isBadge = col.badge === true;

      if (isBadge) {
        const badgeColor = row[`${col.key}Color`] || COLORS.cyan;
        const badgeBg = row[`${col.key}Bg`] || COLORS.cyanLight;
        doc.rect(curX, y + 3, col.width - 12, rowHeight - 6).fillAndStroke(badgeBg, badgeColor);
        doc
          .fillColor(badgeColor)
          .fontSize(6.5)
          .font("Helvetica-Bold")
          .text(cellValue, curX, y + 5, {
            width: col.width - 12,
            align: "center",
            ellipsis: true,
          });
      } else {
        doc
          .fillColor(row[`${col.key}Color`] || COLORS.body)
          .fontSize(7.5)
          .font(col.bold ? "Helvetica-Bold" : "Helvetica")
          .text(cellValue, curX, y + 5, {
            width: col.width - 8,
            align: col.align || "left",
            ellipsis: true,
          });
      }
      curX += col.width;
    });

    state.currentY += rowHeight;
  });

  state.currentY += 8;
}

/**
 * Draws an architecture flow diagram box illustrating system component connectivity.
 */
function drawArchitectureDiagramBox(doc, tiers, summary, state) {
  const boxHeight = 68;
  ensureSpace(doc, boxHeight + 10, state);

  const startY = state.currentY;

  // Background canvas container
  doc.rect(GEOMETRY.marginLeft, startY, GEOMETRY.contentWidth, boxHeight).fillAndStroke(COLORS.cardBg, COLORS.borderLight);

  // 3 Component Nodes across the box
  const nodeWidth = 135;
  const nodeHeight = 44;
  const gap = 45;
  const nodeY = startY + 12;

  const feName = tiers.frontend.length > 0 ? tiers.frontend[0].label : "Client App (SPA)";
  const feTech = tiers.frontend.length > 0 && tiers.frontend[0].technologies?.length > 0 ? tiers.frontend[0].technologies.slice(0, 2).join(", ") : "React / Vite";

  const beName = tiers.backend.length > 0 ? tiers.backend[0].label : "API Server";
  const beTech = tiers.backend.length > 0 && tiers.backend[0].technologies?.length > 0 ? tiers.backend[0].technologies.slice(0, 2).join(", ") : "Node.js / Express";

  const dbName = tiers.database.length > 0 ? tiers.database[0].label : "Database";
  const dbTech = tiers.database.length > 0 && tiers.database[0].technologies?.length > 0 ? tiers.database[0].technologies.slice(0, 2).join(", ") : "MongoDB / Mongoose";

  const nodes = [
    { label: "FRONTEND TIER", title: feName, sub: feTech, x: GEOMETRY.marginLeft + 12 },
    { label: "BACKEND TIER", title: beName, sub: beTech, x: GEOMETRY.marginLeft + 12 + nodeWidth + gap },
    { label: "DATABASE TIER", title: dbName, sub: dbTech, x: GEOMETRY.marginLeft + 12 + (nodeWidth + gap) * 2 },
  ];

  nodes.forEach((n) => {
    // Node Box
    doc.rect(n.x, nodeY, nodeWidth, nodeHeight).fillAndStroke(COLORS.white, COLORS.border);
    doc.rect(n.x, nodeY, nodeWidth, 2).fill(COLORS.cyan);

    doc.fillColor(COLORS.muted).fontSize(6).font("Helvetica-Bold").text(n.label, n.x + 6, nodeY + 6, { width: nodeWidth - 12 });
    doc.fillColor(COLORS.navy).fontSize(8).font("Helvetica-Bold").text(n.title, n.x + 6, nodeY + 16, { width: nodeWidth - 12, ellipsis: true });
    doc.fillColor(COLORS.cyanDark).fontSize(7).font("Helvetica").text(n.sub, n.x + 6, nodeY + 28, { width: nodeWidth - 12, ellipsis: true });
  });

  // Connecting Arrows
  // Arrow 1: Frontend -> Backend
  const arrow1X = GEOMETRY.marginLeft + 12 + nodeWidth + 6;
  doc.fillColor(COLORS.muted).fontSize(6).font("Helvetica").text("HTTP / REST", arrow1X, nodeY + 12, { width: gap - 12, align: "center" });
  doc.strokeColor(COLORS.cyan).lineWidth(1)
    .moveTo(arrow1X, nodeY + 24)
    .lineTo(arrow1X + gap - 12, nodeY + 24)
    .stroke();

  // Arrow 2: Backend -> Database
  const arrow2X = GEOMETRY.marginLeft + 12 + (nodeWidth + gap) + nodeWidth + 6;
  doc.fillColor(COLORS.muted).fontSize(6).font("Helvetica").text("ORM / ODM", arrow2X, nodeY + 12, { width: gap - 12, align: "center" });
  doc.strokeColor(COLORS.cyan).lineWidth(1)
    .moveTo(arrow2X, nodeY + 24)
    .lineTo(arrow2X + gap - 12, nodeY + 24)
    .stroke();

  state.currentY += boxHeight + 10;
}

/**
 * Draws a detailed security finding card with monospace code evidence block.
 */
function drawDetailedFindingCard(doc, finding, state) {
  const hasEvidence = Boolean(finding.redactedEvidence);
  const cardHeight = hasEvidence ? 82 : 68;
  ensureSpace(doc, cardHeight + 8, state);

  const y = state.currentY;
  const sev = finding.severity || "Medium";

  let badgeText = COLORS.mediumText;
  let badgeBg = COLORS.mediumBg;
  let borderColor = "#fde68a";

  if (sev === "Critical") {
    badgeText = COLORS.criticalText;
    badgeBg = COLORS.criticalBg;
    borderColor = "#fca5a5";
  } else if (sev === "High") {
    badgeText = COLORS.highText;
    badgeBg = COLORS.highBg;
    borderColor = "#fdba74";
  } else if (sev === "Low") {
    badgeText = COLORS.lowText;
    badgeBg = COLORS.lowBg;
    borderColor = "#bfdbfe";
  }

  // Card background & left accent
  doc.rect(GEOMETRY.marginLeft, y, GEOMETRY.contentWidth, cardHeight).fillAndStroke(COLORS.white, COLORS.borderLight);
  doc.rect(GEOMETRY.marginLeft, y, 4, cardHeight).fill(badgeText);

  // Severity pill
  doc.rect(GEOMETRY.marginLeft + 12, y + 8, 48, 14).fillAndStroke(badgeBg, borderColor);
  doc
    .fillColor(badgeText)
    .fontSize(6.5)
    .font("Helvetica-Bold")
    .text(sev.toUpperCase(), GEOMETRY.marginLeft + 12, y + 11, {
      width: 48,
      align: "center",
    });

  // Finding Title & Rule ID
  doc
    .fillColor(COLORS.navy)
    .fontSize(8.5)
    .font("Helvetica-Bold")
    .text(finding.title, GEOMETRY.marginLeft + 66, y + 10, {
      width: GEOMETRY.contentWidth - 76,
      ellipsis: true,
    });

  // Location & Rule ID
  const loc = `${finding.filePath}:${finding.startLine}`;
  doc
    .fillColor(COLORS.muted)
    .fontSize(7.5)
    .font("Helvetica")
    .text(`Location: `, GEOMETRY.marginLeft + 12, y + 26, { continued: true });
  doc
    .fillColor(COLORS.cyanDark)
    .font("Helvetica-Bold")
    .text(loc, { continued: true });
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .text(`  |  Rule ID: [${finding.ruleId}]`);

  // Risk Explanation
  const exp = finding.explanation || finding.description || "Identified security exposure.";
  doc
    .fillColor(COLORS.muted)
    .fontSize(7.5)
    .font("Helvetica")
    .text(`Risk: `, GEOMETRY.marginLeft + 12, y + 38, { continued: true });
  doc
    .fillColor(COLORS.body)
    .font("Helvetica")
    .text(exp, { width: GEOMETRY.contentWidth - 80, ellipsis: true });

  // Code Evidence Box (if present)
  if (hasEvidence) {
    const codeBoxY = y + 50;
    doc.rect(GEOMETRY.marginLeft + 12, codeBoxY, GEOMETRY.contentWidth - 24, 15).fillAndStroke(COLORS.codeBg, COLORS.borderLight);
    doc
      .fillColor(COLORS.navyLight)
      .fontSize(6.5)
      .font("Courier")
      .text(finding.redactedEvidence.slice(0, 100), GEOMETRY.marginLeft + 18, codeBoxY + 4, {
        width: GEOMETRY.contentWidth - 36,
        ellipsis: true,
      });

    // Remediation snippet
    const rec = finding.recommendation || "Follow secure credential management practices.";
    doc
      .fillColor(COLORS.muted)
      .fontSize(7)
      .font("Helvetica")
      .text(`Remediation: `, GEOMETRY.marginLeft + 12, y + 68, { continued: true });
    doc
      .fillColor(COLORS.validText)
      .font("Helvetica-Bold")
      .text(rec, { width: GEOMETRY.contentWidth - 80, ellipsis: true });
  } else {
    // Remediation snippet
    const rec = finding.recommendation || "Follow secure coding practices.";
    doc
      .fillColor(COLORS.muted)
      .fontSize(7.5)
      .font("Helvetica")
      .text(`Remediation: `, GEOMETRY.marginLeft + 12, y + 50, { continued: true });
    doc
      .fillColor(COLORS.validText)
      .font("Helvetica-Bold")
      .text(rec, { width: GEOMETRY.contentWidth - 80, ellipsis: true });
  }

  state.currentY += cardHeight + 8;
}

/**
 * Draws an actionable recommendation card.
 */
function drawRecommendationCard(doc, rec, idx, state) {
  const cardHeight = 56;
  ensureSpace(doc, cardHeight + 8, state);

  const y = state.currentY;
  const isP0 = rec.priority.startsWith("P0");
  const isP1 = rec.priority.startsWith("P1");
  const prioColor = isP0 ? COLORS.criticalText : isP1 ? COLORS.highText : COLORS.cyanDark;
  const prioBg = isP0 ? COLORS.criticalBg : isP1 ? COLORS.highBg : COLORS.cyanLight;

  // Background
  doc.rect(GEOMETRY.marginLeft, y, GEOMETRY.contentWidth, cardHeight).fillAndStroke(COLORS.white, COLORS.borderLight);
  doc.rect(GEOMETRY.marginLeft, y, 4, cardHeight).fill(prioColor);

  // Priority Pill
  doc.rect(GEOMETRY.marginLeft + 10, y + 8, 64, 14).fill(prioBg);
  doc.fillColor(prioColor).fontSize(6.5).font("Helvetica-Bold").text(rec.priority, GEOMETRY.marginLeft + 10, y + 11, {
    width: 64,
    align: "center",
  });

  // Category
  doc.fillColor(COLORS.navy).fontSize(8.5).font("Helvetica-Bold").text(rec.category, GEOMETRY.marginLeft + 80, y + 10, {
    width: GEOMETRY.contentWidth - 90,
    ellipsis: true,
  });

  // Observation
  doc.fillColor(COLORS.muted).fontSize(7.5).font("Helvetica").text("Observation: ", GEOMETRY.marginLeft + 10, y + 26, { continued: true });
  doc.fillColor(COLORS.body).font("Helvetica").text(rec.observation, { width: GEOMETRY.contentWidth - 80, ellipsis: true });

  // Action
  doc.fillColor(COLORS.cyanDark).fontSize(7.5).font("Helvetica-Bold").text("Action: ", GEOMETRY.marginLeft + 10, y + 38, { continued: true });
  doc.fillColor(COLORS.body).font("Helvetica").text(rec.action, { width: GEOMETRY.contentWidth - 80, ellipsis: true });

  state.currentY += cardHeight + 8;
}

// ── MAIN STREAMING FUNCTION ──────────────────────────────────────────────────

/**
 * Generates and streams a comprehensive repository analysis report to a writable stream.
 *
 * @param {Object|string} projectOrId - Project document or Project ID
 * @param {import('stream').Writable} outputStream - HTTP response or file stream
 * @param {Object} [options]
 * @returns {Promise<void>}
 */
export async function streamProjectPdfReport(projectOrId, outputStream, options = {}) {
  // 1. Prepare normalized, redacted report data
  const data = await collectReportData(projectOrId, options);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: {
          top: GEOMETRY.marginTop,
          bottom: GEOMETRY.marginBottom,
          left: GEOMETRY.marginLeft,
          right: GEOMETRY.marginRight,
        },
        bufferPages: true,
        info: {
          Title: `ArchMind AI Intelligence Report - ${data.metadata.projectName}`,
          Author: "ArchMind AI Platform",
          Subject: "Repository Architecture, Security & DevOps Intelligence Report",
          CreationDate: new Date(),
        },
      });

      doc.on("error", (err) => {
        reject(err);
      });

      doc.pipe(outputStream);

      const state = {
        currentY: GEOMETRY.headerY,
        pageNumber: 1,
      };

      // ── COVER / HEADER BANNER (Page 1) ────────────────────────────────────
      const bannerHeight = 96;
      doc
        .rect(GEOMETRY.marginLeft, state.currentY, GEOMETRY.contentWidth, bannerHeight)
        .fillAndStroke(COLORS.navy, COLORS.navyLight);

      // Accent top strip
      doc.rect(GEOMETRY.marginLeft, state.currentY, GEOMETRY.contentWidth, 3).fill(COLORS.cyan);

      // Header Tagline
      doc
        .fillColor(COLORS.cyan)
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .text("ARCHMIND AI • REPOSITORY INTELLIGENCE REPORT", GEOMETRY.marginLeft + 16, state.currentY + 14);

      // Project Name
      doc
        .fillColor(COLORS.white)
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(data.metadata.projectName, GEOMETRY.marginLeft + 16, state.currentY + 28, {
          width: 380,
          ellipsis: true,
        });

      // Metadata subtitle
      const sourceLabel = data.metadata.source.toUpperCase();
      const rawDate = data.metadata.generatedAt ? new Date(data.metadata.generatedAt) : new Date();
      const validDate = !isNaN(rawDate.getTime()) ? rawDate : new Date();
      const dateStr = validDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      doc
        .fillColor(COLORS.border)
        .fontSize(7.5)
        .font("Helvetica")
        .text(
          `Source: ${sourceLabel}  |  Branch: ${data.metadata.defaultBranch}  |  Analysis: v${data.metadata.analysisVersion}  |  Date: ${dateStr}`,
          GEOMETRY.marginLeft + 16,
          state.currentY + 54,
          { width: 380, ellipsis: true }
        );

      doc
        .fillColor(COLORS.muted)
        .fontSize(7)
        .font("Helvetica")
        .text(`Repository: ${data.metadata.repoUrl}`, GEOMETRY.marginLeft + 16, state.currentY + 70, {
          width: 380,
          ellipsis: true,
        });

      // Health Score Pill in Header
      const scoreBoxX = GEOMETRY.marginLeft + GEOMETRY.contentWidth - 92;
      const scoreBoxY = state.currentY + 16;
      doc.rect(scoreBoxX, scoreBoxY, 78, 64).fillAndStroke(COLORS.navyLight, COLORS.cyan);
      doc
        .fillColor(COLORS.cyan)
        .fontSize(6.5)
        .font("Helvetica-Bold")
        .text("HEALTH SCORE", scoreBoxX, scoreBoxY + 8, { width: 78, align: "center" });
      doc
        .fillColor(data.health.color)
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(`${data.health.score}`, scoreBoxX, scoreBoxY + 20, { width: 78, align: "center" });
      doc
        .fillColor(COLORS.border)
        .fontSize(6)
        .font("Helvetica")
        .text(data.health.label.toUpperCase(), scoreBoxX, scoreBoxY + 44, { width: 78, align: "center" });

      state.currentY += bannerHeight + 14;

      // ── SECTION 1: EXECUTIVE REPOSITORY OVERVIEW ──────────────────────────
      drawSectionHeader(doc, "1. Executive Repository Overview", "High-level summary of architecture, code volume, and detected stack", state);

      drawMetricGrid(
        doc,
        [
          {
            label: "Health Posture",
            value: `${data.health.score}/100`,
            valueColor: data.health.color,
            subtext: data.health.label,
          },
          {
            label: "Codebase Scale",
            value: `${data.overview.totalFiles} files`,
            subtext: data.overview.totalSizeFormatted,
          },
          {
            label: "Security Audit",
            value: `${data.security.totalFindings} findings`,
            valueColor: data.security.totalFindings > 0 ? COLORS.criticalText : COLORS.validText,
            subtext: `${data.security.severityCounts.Critical} Critical • ${data.security.severityCounts.High} High`,
          },
          {
            label: "Interface & Data",
            value: `${data.apiRoutes.totalCount} routes`,
            subtext: `${data.database.entityCount} Data Models`,
          },
        ],
        state
      );

      // Explanatory note
      doc.fillColor(COLORS.muted).fontSize(7).font("Helvetica-Oblique")
        .text("* Health Score evaluates security vulnerability posture, test coverage, and deployment readiness.", GEOMETRY.marginLeft + 4, state.currentY);
      state.currentY += 12;

      const overviewRows = [
        {
          key: "Primary Language",
          value: `${data.overview.primaryLanguage} ${
            data.overview.secondaryLanguages.length > 0 ? `(Secondary: ${data.overview.secondaryLanguages.join(", ")})` : ""
          }`,
        },
        {
          key: "Frameworks & Libraries",
          value: data.overview.frameworks.length > 0 ? data.overview.frameworks.join(", ") : "Not detected in codebase",
        },
        {
          key: "Databases & Storage",
          value: data.overview.databases.length > 0 ? data.overview.databases.join(", ") : "Not detected in codebase",
        },
        {
          key: "DevOps & Deployment",
          value: data.overview.devops.length > 0 ? data.overview.devops.join(", ") : (data.devops.hasDetectedDevops ? "Docker / CI Detected" : "Not detected in codebase"),
        },
        {
          key: "Repository Volume",
          value: `${data.overview.totalFiles} files across ${data.overview.totalDirs} directories (${data.overview.totalSizeFormatted})`,
        },
        {
          key: "Ingestion Details",
          value: `Source: ${data.metadata.source.toUpperCase()}  |  Default Branch: ${data.metadata.defaultBranch}`,
        },
      ];

      drawKeyValueTable(doc, overviewRows, state);

      // ── SECTION 2: REPOSITORY STRUCTURE & MANIFESTS ───────────────────────
      drawSectionHeader(doc, "2. Repository Structure & Key Manifests", "Structural organization, top directories, and detected build manifests", state);

      if (data.structure.modules.length > 0) {
        doc.fillColor(COLORS.navy).fontSize(8).font("Helvetica-Bold").text("Identified Monorepo / Sub-projects:", GEOMETRY.marginLeft, state.currentY);
        state.currentY += 12;

        const modCols = [
          { key: "name", header: "Module Name", width: 130, bold: true },
          { key: "path", header: "Root Path", width: 140 },
          { key: "type", header: "Identified Role", width: 235 },
        ];
        drawTable(doc, modCols, data.structure.modules, state);
      }

      if (data.structure.directories.length > 0) {
        const dirCols = [
          { key: "path", header: "Root Directory", width: 150, bold: true },
          { key: "count", header: "Files Count", width: 90, align: "center" },
          { key: "role", header: "Component Role", width: 265 },
        ];
        drawTable(doc, dirCols, data.structure.directories, state);
      }

      const structRows = [
        {
          key: "Detected Manifests",
          value: data.structure.manifests.length > 0 ? data.structure.manifests.join(" • ") : "None detected",
        },
        {
          key: "Automated Test Suite",
          value: data.structure.hasTests ? "Test files detected (__tests__, spec, or test directories)" : "No test harness files detected",
          valueColor: data.structure.hasTests ? COLORS.validText : COLORS.highText,
        },
      ];
      drawKeyValueTable(doc, structRows, state);

      // ── SECTION 3: SYSTEM TOPOLOGY & ARCHITECTURE ─────────────────────────
      drawSectionHeader(doc, "3. System Topology & Architecture Analysis", "Component breakdown and architectural boundaries", state);

      if (data.architecture.hasArchitecture) {
        doc
          .fillColor(COLORS.body)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `Architecture Analysis identified ${data.architecture.nodeCount} system component(s) across ` +
              `[${data.overview.primaryLanguage || "General"}] modules. Primary pattern: ${data.architecture.summary}.`,
            GEOMETRY.marginLeft,
            state.currentY,
            { width: GEOMETRY.contentWidth }
          );
        state.currentY += 14;

        // Visual Component Diagram Box
        drawArchitectureDiagramBox(doc, data.architecture.tiers, data.architecture.summary, state);

        if (data.structure.entryPoints.length > 0) {
          doc
            .fillColor(COLORS.navy)
            .fontSize(8)
            .font("Helvetica-Bold")
            .text("Primary Entry Points:", GEOMETRY.marginLeft, state.currentY);
          state.currentY += 12;

          data.structure.entryPoints.slice(0, 5).forEach((ep) => {
            ensureSpace(doc, 12, state);
            doc.fillColor(COLORS.cyan).fontSize(8).font("Helvetica-Bold").text("•", GEOMETRY.marginLeft + 4, state.currentY);
            doc.fillColor(COLORS.body).fontSize(7.5).font("Helvetica").text(ep, GEOMETRY.marginLeft + 14, state.currentY);
            state.currentY += 12;
          });
          state.currentY += 6;
        }

        // Tiers breakdown table
        const tierRows = [
          {
            key: "Frontend Tier",
            value: data.architecture.tiers.frontend.length > 0 ? data.architecture.tiers.frontend.map((n) => n.label).join(", ") : "Not detected in codebase",
          },
          {
            key: "Backend Tier",
            value: data.architecture.tiers.backend.length > 0 ? data.architecture.tiers.backend.map((n) => n.label).join(", ") : "Not detected in codebase",
          },
          {
            key: "Database Tier",
            value: data.architecture.tiers.database.length > 0 ? data.architecture.tiers.database.map((n) => n.label).join(", ") : "Not detected in codebase",
          },
        ];
        drawKeyValueTable(doc, tierRows, state);
      } else {
        drawCallout(doc, "info", "No multi-tier architecture topology nodes were mapped for this repository.", state);
      }

      // ── SECTION 4: DATABASE SCHEMA & DATA MODELS ──────────────────────────
      drawSectionHeader(doc, "4. Database Schema & Data Models", "Entity definitions, extracted fields, and schema relationships", state);

      if (!data.database.hasDatabase) {
        drawCallout(
          doc,
          "info",
          "No persistent database entities, Mongoose models, or SQL tables were identified in this codebase.",
          state
        );
      } else {
        doc
          .fillColor(COLORS.body)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `Extracted ${data.database.entityCount} data model(s) utilizing [${data.database.type}] schema definitions.`,
            GEOMETRY.marginLeft,
            state.currentY
          );
        state.currentY += 14;

        // Model Catalog Table (All models without truncation)
        const dbCols = [
          { key: "name", header: "Model / Entity", width: 140, bold: true },
          { key: "tableName", header: "Collection / Table", width: 130 },
          { key: "fieldsSummary", header: "Key Identifiers & Types", width: 165 },
          { key: "fieldCount", header: "Fields", width: 70, align: "center" },
        ];

        const dbRows = data.database.entities.map((ent) => {
          const keyFieldNames = ent.fields
            .filter((f) => f.isPrimary || f.isRequired || f.isUnique || f.isForeign)
            .map((f) => `${f.name} (${f.type})`)
            .slice(0, 3)
            .join(", ");

          return {
            name: ent.name,
            tableName: ent.tableName,
            fieldsSummary: keyFieldNames ? `${keyFieldNames}...` : `${ent.fieldCount} fields`,
            fieldCount: `${ent.fieldCount}`,
          };
        });

        drawTable(doc, dbCols, dbRows, state);

        // Relationships & ERD Ledger Table (if present)
        if (data.database.relationships.length > 0) {
          ensureSpace(doc, 36, state);
          doc
            .fillColor(COLORS.navy)
            .fontSize(8.5)
            .font("Helvetica-Bold")
            .text("Detected Schema Relationships & Foreign Keys:", GEOMETRY.marginLeft, state.currentY);
          state.currentY += 12;

          const relCols = [
            { key: "sourceEntity", header: "Source Model", width: 110, bold: true },
            { key: "type", header: "Relationship Type", width: 100, align: "center" },
            { key: "targetEntity", header: "Target Model", width: 110, bold: true },
            { key: "foreignKey", header: "Foreign Key / Ref", width: 100 },
            { key: "status", header: "Extraction Method", width: 85, align: "center" },
          ];

          drawTable(doc, relCols, data.database.relationships, state);
        }
      }

      // ── SECTION 5: API ROUTE INTELLIGENCE ─────────────────────────────────
      drawSectionHeader(doc, "5. API Route Intelligence & Endpoints", "HTTP routes, controller bindings, and authentication requirements", state);

      if (!data.apiRoutes.hasApiRoutes) {
        drawCallout(doc, "info", "No RESTful HTTP route handlers or API controller definitions were detected.", state);
      } else {
        const mb = data.apiRoutes.methodBreakdown;
        const methodSummary = `Identified ${data.apiRoutes.totalCount} API endpoint(s) across backend controller definitions (GET: ${mb.GET}, POST: ${mb.POST}, PUT: ${mb.PUT}, DELETE: ${mb.DELETE}, PATCH: ${mb.PATCH}):`;

        doc.fillColor(COLORS.body).fontSize(8).font("Helvetica").text(methodSummary, GEOMETRY.marginLeft, state.currentY);
        state.currentY += 14;

        const apiCols = [
          { key: "method", header: "Method", width: 60, badge: true },
          { key: "path", header: "Route Path", width: 235 },
          { key: "handler", header: "Controller Handler", width: 130 },
          { key: "auth", header: "Auth Status", width: 80, badge: true },
        ];

        // Render all routes with clean pagination
        const apiRows = data.apiRoutes.routes.map((r) => {
          const m = r.method.toUpperCase();
          let mColor = COLORS.cyan;
          let mBg = COLORS.cyanLight;
          if (m === "POST") {
            mColor = COLORS.highText;
            mBg = COLORS.highBg;
          } else if (m === "DELETE") {
            mColor = COLORS.criticalText;
            mBg = COLORS.criticalBg;
          } else if (m === "PUT" || m === "PATCH") {
            mColor = COLORS.mediumText;
            mBg = COLORS.mediumBg;
          }

          const isAuth = r.authRequired;

          return {
            method: m,
            methodColor: mColor,
            methodBg: mBg,
            path: r.path,
            handler: r.handler || "Route Handler",
            auth: isAuth ? "REQUIRED" : "PUBLIC",
            authColor: isAuth ? COLORS.validText : COLORS.muted,
            authBg: isAuth ? COLORS.validBg : COLORS.cardBgAlt,
          };
        });

        drawTable(doc, apiCols, apiRows, state);
      }

      // ── SECTION 6: SECURITY AUDIT & SECRET FINDINGS ───────────────────────
      drawSectionHeader(doc, "6. Security Audit & Vulnerability Findings", "Deterministic secret scanning and AST static code vulnerability findings", state);

      const secSummaryCards = [
        {
          label: "Critical",
          value: `${data.security.severityCounts.Critical}`,
          valueColor: data.security.severityCounts.Critical > 0 ? COLORS.criticalText : COLORS.muted,
          subtext: "Immediate action",
        },
        {
          label: "High Severity",
          value: `${data.security.severityCounts.High}`,
          valueColor: data.security.severityCounts.High > 0 ? COLORS.highText : COLORS.muted,
          subtext: "Remediate soon",
        },
        {
          label: "Medium / Low",
          value: `${data.security.severityCounts.Medium + data.security.severityCounts.Low}`,
          valueColor: COLORS.navy,
          subtext: "Quality improvements",
        },
        {
          label: "Files Audited",
          value: `${data.security.auditStats.filesScanned || data.overview.totalFiles}`,
          subtext: "AST coverage",
        },
      ];
      drawMetricGrid(doc, secSummaryCards, state);

      if (!data.security.hasSecurityFindings) {
        drawCallout(
          doc,
          "success",
          "Security Scan Passed: Zero hardcoded API keys, tokens, or critical AST security vulnerabilities detected.",
          state
        );
      } else {
        // Render rich detailed cards for top priority findings
        const cardFindings = data.security.findings.slice(0, 6);
        cardFindings.forEach((f) => {
          drawDetailedFindingCard(doc, f, state);
        });

        // If there are more findings, render the rest in a clean table ledger so nothing is dropped
        if (data.security.findings.length > 6) {
          ensureSpace(doc, 36, state);
          doc.fillColor(COLORS.navy).fontSize(8.5).font("Helvetica-Bold")
            .text("Additional Identified Security Observations:", GEOMETRY.marginLeft, state.currentY);
          state.currentY += 12;

          const remCols = [
            { key: "severity", header: "Severity", width: 60, badge: true },
            { key: "title", header: "Rule / Finding Title", width: 175 },
            { key: "location", header: "File Location", width: 140 },
            { key: "action", header: "Recommended Action", width: 130 },
          ];

          const remRows = data.security.findings.slice(6).map((f) => {
            const sev = f.severity;
            return {
              severity: sev.toUpperCase(),
              severityColor: sev === "Critical" ? COLORS.criticalText : sev === "High" ? COLORS.highText : COLORS.mediumText,
              severityBg: sev === "Critical" ? COLORS.criticalBg : sev === "High" ? COLORS.highBg : COLORS.mediumBg,
              title: f.title,
              location: `${f.filePath}:${f.startLine}`,
              action: f.recommendation.slice(0, 50) + "...",
            };
          });

          drawTable(doc, remCols, remRows, state);
        }
      }

      // ── SECTION 7: CODE QUALITY & REVIEW FINDINGS ─────────────────────────
      if (data.codeReview.hasCodeReview) {
        drawSectionHeader(doc, "7. AI Code Review & Quality Analysis", "Automated code quality, performance, and maintainability review", state);

        doc
          .fillColor(COLORS.body)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `Automated Code Review evaluated key source files. Overall Quality Score: ${data.codeReview.overallScore}/100.`,
            GEOMETRY.marginLeft,
            state.currentY
          );
        state.currentY += 14;

        data.codeReview.items.slice(0, 4).forEach((item) => {
          drawDetailedFindingCard(
            doc,
            {
              title: item.title,
              severity: item.severity || "Medium",
              filePath: item.filePath,
              startLine: item.startLine,
              explanation: item.explanation || item.description,
              recommendation: item.recommendation || item.suggestedImprovement,
            },
            state
          );
        });
      }

      // ── SECTION 8: DEVOPS & INFRASTRUCTURE ARTIFACTS ──────────────────────
      drawSectionHeader(doc, "8. DevOps & Infrastructure Artifacts", "Detected repository manifests and generated deployment pipelines", state);

      if (!data.devops.hasDevops) {
        drawCallout(
          doc,
          "info",
          "No containerization or deployment manifests were detected in the source repository, and no DevOps artifacts have been generated in this workspace yet.",
          state
        );
      } else {
        // 1. Detected Manifests in Source
        if (data.devops.hasDetectedDevops || data.devops.hasDetectedDevOps) {
          doc.fillColor(COLORS.navy).fontSize(8).font("Helvetica-Bold")
            .text("Detected in Source Codebase:", GEOMETRY.marginLeft, state.currentY);
          state.currentY += 10;

          data.devops.detectedFiles.forEach((file) => {
            ensureSpace(doc, 12, state);
            doc.fillColor(COLORS.cyan).fontSize(8).font("Helvetica-Bold").text("•", GEOMETRY.marginLeft + 4, state.currentY);
            doc.fillColor(COLORS.body).fontSize(7.5).font("Helvetica").text(file, GEOMETRY.marginLeft + 14, state.currentY);
            state.currentY += 12;
          });
          state.currentY += 8;
        }

        // 2. Generated Artifacts
        if (data.devops.hasGeneratedDevops) {
          doc.fillColor(COLORS.navy).fontSize(8).font("Helvetica-Bold")
            .text("Generated Workspace DevOps Artifacts:", GEOMETRY.marginLeft, state.currentY);
          state.currentY += 12;

          const devopsCols = [
            { key: "type", header: "Artifact Type", width: 100, bold: true },
            { key: "filePath", header: "Target Path", width: 175 },
            { key: "version", header: "Version", width: 65, align: "center" },
            { key: "status", header: "Validation Status", width: 165, badge: true },
          ];

          const devopsRows = data.devops.generatedArtifacts.map((art) => {
            const isValid = art.valid;
            return {
              type: art.artifactType.toUpperCase(),
              filePath: art.filePath,
              version: `v${art.version}`,
              status: isValid ? "VALIDATION PASSED" : "HAS WARNINGS",
              statusColor: isValid ? COLORS.validText : COLORS.highText,
              statusBg: isValid ? COLORS.validBg : COLORS.highBg,
            };
          });

          drawTable(doc, devopsCols, devopsRows, state);

          // Highlight key directives from primary Dockerfile/CI
          const primaryArtifact = data.devops.generatedArtifacts[0];
          if (primaryArtifact && primaryArtifact.keyDirectives.length > 0) {
            ensureSpace(doc, 36, state);
            doc
              .fillColor(COLORS.navy)
              .fontSize(8)
              .font("Helvetica-Bold")
              .text(`Key Directives Excerpt (${primaryArtifact.filePath}):`, GEOMETRY.marginLeft, state.currentY);
            state.currentY += 12;

            primaryArtifact.keyDirectives.slice(0, 4).forEach((dir) => {
              ensureSpace(doc, 10, state);
              doc.fillColor(COLORS.muted).fontSize(7).font("Courier").text(`  ${dir}`, GEOMETRY.marginLeft + 8, state.currentY);
              state.currentY += 10;
            });
            state.currentY += 6;
          }
        }
      }

      // ── SECTION 9: ACTIONABLE RECOMMENDATIONS & NEXT STEPS ────────────────
      drawSectionHeader(doc, "9. Actionable Engineering Recommendations", "Targeted remediation steps grounded in repository findings", state);

      data.recommendations.forEach((rec, idx) => {
        drawRecommendationCard(doc, rec, idx, state);
      });

      // ── RUNNING HEADERS & FOOTERS (Post-processing Loop) ──────────────────
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = range.start; i < range.start + totalPages; i++) {
        doc.switchToPage(i);

        // Temporarily set bottom margin to 0 to prevent PDFKit from triggering auto page-break
        const prevBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        // Top Running Header (Pages 2+)
        if (i > range.start) {
          doc.rect(GEOMETRY.marginLeft, 22, GEOMETRY.contentWidth, 0.75).fill(COLORS.borderLight);
          doc
            .fillColor(COLORS.muted)
            .fontSize(7)
            .font("Helvetica")
            .text("ArchMind AI • Repository Intelligence Report", GEOMETRY.marginLeft, 13, {
              lineBreak: false,
            });
          doc
            .fillColor(COLORS.muted)
            .fontSize(7)
            .font("Helvetica")
            .text(data.metadata.projectName, GEOMETRY.marginLeft, 13, {
              width: GEOMETRY.contentWidth,
              align: "right",
              lineBreak: false,
            });
        }

        // Bottom Running Footer (All Pages)
        const footerY = 804;
        doc.rect(GEOMETRY.marginLeft, footerY - 8, GEOMETRY.contentWidth, 0.75).fill(COLORS.borderLight);

        doc
          .fillColor(COLORS.muted)
          .fontSize(7.5)
          .font("Helvetica")
          .text("ArchMind AI Platform • Confidential & Proprietary", GEOMETRY.marginLeft, footerY, {
            lineBreak: false,
          });

        doc
          .fillColor(COLORS.muted)
          .fontSize(7.5)
          .font("Helvetica")
          .text(`Page ${i + 1} of ${totalPages}`, GEOMETRY.marginLeft, footerY, {
            width: GEOMETRY.contentWidth,
            align: "right",
            lineBreak: false,
          });

        // Restore margin
        doc.page.margins.bottom = prevBottomMargin;
      }

      doc.end();

      outputStream.on("finish", () => {
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}
