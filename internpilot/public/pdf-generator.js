/**
 * InternPilot - CareerMatch AI PDF Report Generator & Print Engine
 * 
 * Generates an executive, multi-page vector PDF containing all 14 required sections:
 * 1. InternPilot branding and report title
 * 2. Report generation date & timestamp
 * 3. Internship role and company name
 * 4. Overall skill match percentage and level
 * 5. Explainable skill matching formula & score breakdown
 * 6. Matched skills table with importance and verification reasons
 * 7. Partially matched skills table with concrete resume evidence snippets
 * 8. Missing skill gaps table with role-specific "why needed" explanations
 * 9. Required versus preferred skill classification summary
 * 10. Key job responsibilities and prerequisite qualifications
 * 11. Personalized learning roadmap with estimated study hours and topics
 * 12. Learning milestones and live completion status ([COMPLETED] / [PENDING])
 * 13. Recommended student portfolio projects with deliverables and relevance
 * 14. Comprehensive verification disclaimer
 * 
 * Works 100% offline with ZERO external network dependencies and ZERO npm dependencies.
 * Compatible with Node.js automated test suites and modern web browsers.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CareerMatchPdf = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {

  // A4 Dimensions in points (72 pt / inch)
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 40;
  const MARGIN_RIGHT = 40;
  const MARGIN_TOP = 45;
  const MARGIN_BOTTOM = 45;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  // Approximate character widths for standard Type 1 Helvetica font (ratio of fontSize)
  function estimateCharWidth(ch, isBold) {
    if (ch === ' ' || ch === '.' || ch === ',' || ch === ':' || ch === ';' || ch === '!' || ch === '|' || ch === 'i' || ch === 'l' || ch === 'I') {
      return (isBold ? 0.35 : 0.28);
    }
    if (ch === 'm' || ch === 'M' || ch === 'W' || ch === 'w' || ch === '@' || ch === '%') {
      return (isBold ? 0.85 : 0.75);
    }
    if (ch >= 'A' && ch <= 'Z') {
      return (isBold ? 0.65 : 0.58);
    }
    return (isBold ? 0.55 : 0.48);
  }

  function measureStringWidth(text, fontSize, isBold) {
    let w = 0;
    const str = String(text || '');
    for (let i = 0; i < str.length; i++) {
      w += estimateCharWidth(str[i], isBold) * fontSize;
    }
    return w;
  }

  function wrapText(text, maxWidth, fontSize, isBold) {
    const rawLines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const result = [];

    for (const rawLine of rawLines) {
      if (!rawLine.trim()) {
        result.push('');
        continue;
      }
      const words = rawLine.split(/\s+/);
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = measureStringWidth(testLine, fontSize, isBold);

        if (testWidth <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) {
            result.push(currentLine);
            currentLine = word;
          } else {
            // A single word is longer than maxWidth; split word
            let sub = '';
            for (let i = 0; i < word.length; i++) {
              if (measureStringWidth(sub + word[i], fontSize, isBold) > maxWidth) {
                result.push(sub);
                sub = word[i];
              } else {
                sub += word[i];
              }
            }
            currentLine = sub;
          }
        }
      }
      if (currentLine) {
        result.push(currentLine);
      }
    }
    return result;
  }

  function sanitizePdfText(str) {
    return String(str || '')
      .replace(/—/g, ' - ')
      .replace(/–/g, '-')
      .replace(/×/g, 'x')
      .replace(/✓/g, '[MATCHED]')
      .replace(/⚡/g, '[PARTIAL]')
      .replace(/✕/g, '[GAP]')
      .replace(/★/g, '*')
      .replace(/☆/g, 'o')
      .replace(/•/g, '*')
      .replace(/○/g, 'o')
      .replace(/💡/g, '')
      .replace(/🎯/g, '')
      .replace(/⏱/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  // Pure Vector PDF Document Builder
  class PdfDocument {
    constructor() {
      this.pages = [];
      this.currentPage = null;
      this.y = PAGE_HEIGHT - MARGIN_TOP;
      this.meta = {
        title: "InternPilot CareerMatch Analysis Report",
        creator: "InternPilot CareerMatch AI Engine"
      };
      this.addNewPage();
    }

    addNewPage() {
      if (this.currentPage) {
        // Draw page divider baseline if needed
      }
      this.currentPage = {
        ops: []
      };
      this.pages.push(this.currentPage);
      this.y = PAGE_HEIGHT - MARGIN_TOP - 30; // Leave room for running header
    }

    ensureSpace(neededHeight) {
      if (this.y - neededHeight < MARGIN_BOTTOM + 35) {
        this.addNewPage();
        return true;
      }
      return false;
    }

    rect(x, y, w, h, fillRgb = null, strokeRgb = null, lineWidth = 1) {
      let op = `q\n`;
      if (fillRgb) op += `${fillRgb[0]} ${fillRgb[1]} ${fillRgb[2]} rg\n`;
      if (strokeRgb) {
        op += `${strokeRgb[0]} ${strokeRgb[1]} ${strokeRgb[2]} RG\n`;
        op += `${lineWidth} w\n`;
      }
      op += `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re\n`;
      if (fillRgb && strokeRgb) op += `B\n`;
      else if (fillRgb) op += `f\n`;
      else if (strokeRgb) op += `S\n`;
      op += `Q\n`;
      this.currentPage.ops.push(op);
    }

    line(x1, y1, x2, y2, strokeRgb, lineWidth = 1) {
      const op = `q\n${lineWidth} w\n${strokeRgb[0]} ${strokeRgb[1]} ${strokeRgb[2]} RG\n${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\nQ\n`;
      this.currentPage.ops.push(op);
    }

    text(str, x, y, options = {}) {
      const font = options.font || 'F1'; // F1: Helvetica, F2: Bold, F3: Oblique
      const size = options.size || 10;
      const color = options.color || [0.1, 0.1, 0.1];
      const clean = sanitizePdfText(str);

      const op = `BT\n/${font} ${size} Tf\n${color[0]} ${color[1]} ${color[2]} rg\n1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm\n(${clean}) Tj\nET\n`;
      this.currentPage.ops.push(op);
    }

    // High-level rendering helpers
    drawRunningHeader(pageIndex, totalPages, reportTitle) {
      const headerY = PAGE_HEIGHT - MARGIN_TOP + 12;
      // Brand badge
      this.rect(MARGIN_LEFT, headerY - 3, 50, 16, [0.04, 0.06, 0.11], null);
      this.text("PILOT AI", MARGIN_LEFT + 7, headerY + 1, { font: "F2", size: 8, color: [0.18, 0.83, 0.75] });

      this.text("InternPilot — CareerMatch AI Report", MARGIN_LEFT + 58, headerY + 1, { font: "F2", size: 9, color: [0.2, 0.25, 0.32] });
      
      const pageNumStr = `Page ${pageIndex + 1} of ${totalPages}`;
      const pageNumWidth = measureStringWidth(pageNumStr, 8.5, false);
      this.text(pageNumStr, PAGE_WIDTH - MARGIN_RIGHT - pageNumWidth, headerY + 1, { font: "F1", size: 8.5, color: [0.45, 0.5, 0.58] });

      // Accent divider line
      this.line(MARGIN_LEFT, headerY - 8, PAGE_WIDTH - MARGIN_RIGHT, headerY - 8, [0.18, 0.83, 0.75], 1.5);
    }

    drawRunningFooter(pageIndex, totalPages) {
      const footerY = MARGIN_BOTTOM - 15;
      this.line(MARGIN_LEFT, footerY + 14, PAGE_WIDTH - MARGIN_RIGHT, footerY + 14, [0.85, 0.88, 0.92], 0.75);

      const disclaimer = "Confidential CareerMatch AI Report. For educational & career guidance. Verify employers independently.";
      this.text(disclaimer, MARGIN_LEFT, footerY + 2, { font: "F3", size: 7.5, color: [0.5, 0.55, 0.6] });

      const brand = "internpilot.ai";
      const brandWidth = measureStringWidth(brand, 7.5, false);
      this.text(brand, PAGE_WIDTH - MARGIN_RIGHT - brandWidth, footerY + 2, { font: "F1", size: 7.5, color: [0.5, 0.55, 0.6] });
    }

    buildBuffer() {
      const totalPages = this.pages.length;

      // Add running headers and footers to every page
      this.pages.forEach((page, pIdx) => {
        const tempOps = [...page.ops];
        page.ops = [];
        
        // Push running header
        this.currentPage = page;
        this.drawRunningHeader(pIdx, totalPages, this.meta.title);
        
        // Push original page ops
        page.ops.push(...tempOps);

        // Push running footer
        this.drawRunningFooter(pIdx, totalPages);
      });

      const objects = [];
      const addObject = (content) => {
        objects.push(content);
        return objects.length;
      };

      const catalogId = 1;
      const pagesId = 2;
      const font1Id = 3;
      const font2Id = 4;
      const font3Id = 5;

      objects.push(null); // idx 0 -> obj 1 (Catalog)
      objects.push(null); // idx 1 -> obj 2 (Pages root)

      // Fonts
      objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
      objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
      objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>`);

      const pageObjIds = [];

      this.pages.forEach((page) => {
        const streamContent = page.ops.join('\n');
        const streamLen = typeof Buffer !== "undefined"
          ? Buffer.byteLength(streamContent, 'utf-8')
          : new TextEncoder().encode(streamContent).length;

        const contentId = addObject(`<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream`);
        const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R /F3 ${font3Id} 0 R >> >> /Contents ${contentId} 0 R >>`);
        pageObjIds.push(pageId);
      });

      objects[0] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
      objects[1] = `<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`;

      let pdf = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
      const xref = [0];

      objects.forEach((objContent, idx) => {
        const objId = idx + 1;
        const offset = typeof Buffer !== "undefined"
          ? Buffer.byteLength(pdf, 'utf-8')
          : new TextEncoder().encode(pdf).length;
        xref.push(offset);
        pdf += `${objId} 0 obj\n${objContent}\nendobj\n`;
      });

      const startXref = typeof Buffer !== "undefined"
        ? Buffer.byteLength(pdf, 'utf-8')
        : new TextEncoder().encode(pdf).length;

      pdf += `xref\n0 ${objects.length + 1}\n`;
      pdf += `0000000000 65535 f \n`;
      for (let i = 1; i <= objects.length; i++) {
        const offStr = String(xref[i]).padStart(10, '0');
        pdf += `${offStr} 00000 n \n`;
      }

      pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
      pdf += `startxref\n${startXref}\n%%EOF\n`;

      if (typeof Buffer !== "undefined") {
        return Buffer.from(pdf, 'utf-8');
      } else {
        return new TextEncoder().encode(pdf);
      }
    }
  }

  // Section Heading Helper
  function renderSectionHeader(doc, title, subtitle = null) {
    doc.ensureSpace(subtitle ? 38 : 28);
    doc.y -= 8;
    // Colored marker
    doc.rect(MARGIN_LEFT, doc.y - 10, 4, 14, [0.05, 0.58, 0.53], null);
    doc.text(title, MARGIN_LEFT + 10, doc.y, { font: "F2", size: 12, color: [0.04, 0.06, 0.11] });
    doc.y -= 14;

    if (subtitle) {
      doc.text(subtitle, MARGIN_LEFT + 10, doc.y + 2, { font: "F3", size: 8.5, color: [0.4, 0.45, 0.52] });
      doc.y -= 12;
    }
    doc.line(MARGIN_LEFT, doc.y + 4, PAGE_WIDTH - MARGIN_RIGHT, doc.y + 4, [0.88, 0.90, 0.93], 0.75);
    doc.y -= 8;
  }

  // Compile full 15-section CareerMatch PDF
  function buildCareerMatchPdf(analysis) {
    const data = analysis || {};
    const role = data.role || "Internship Role";
    const company = data.company || "Company";
    const percent = data.percent !== null && data.percent !== undefined ? data.percent : 0;
    const level = (data.level || (percent >= 65 ? "good" : percent >= 35 ? "moderate" : "low")).toUpperCase();
    const scoreBreakdown = data.scoreBreakdown || `Match % = (Matched + 0.5 × Partial) / Total Weighted Skills × 100`;

    const matched = Array.isArray(data.matched) ? data.matched : [];
    const partial = Array.isArray(data.partial) ? data.partial : [];
    const missing = Array.isArray(data.missing) ? data.missing : [];
    const requiredSkills = Array.isArray(data.requiredSkills) ? data.requiredSkills : [];
    const preferredSkills = Array.isArray(data.preferredSkills) ? data.preferredSkills : [];
    const responsibilities = Array.isArray(data.responsibilities) ? data.responsibilities : [];
    const qualifications = Array.isArray(data.qualifications) ? data.qualifications : [];
    const roadmap = Array.isArray(data.roadmap) ? data.roadmap : [];
    const projects = Array.isArray(data.projects) ? data.projects : [];
    const scam = data.scamAssessment || { riskScore: 0, level: "low", reasons: [] };
    const activityProgress = data.activityProgress || {};

    const doc = new PdfDocument();

    // ==========================================
    // 1 & 2. HERO / DOCUMENT TITLE & BANNER
    // ==========================================
    const heroHeight = 84;
    doc.rect(MARGIN_LEFT, doc.y - heroHeight, CONTENT_WIDTH, heroHeight, [0.04, 0.06, 0.11], [0.18, 0.83, 0.75], 1.5);

    // Title line
    doc.text("CAREERMATCH AI — SKILL GAP ANALYSIS REPORT", MARGIN_LEFT + 16, doc.y - 22, { font: "F2", size: 14, color: [0.18, 0.83, 0.75] });
    
    // Subtitle
    const genDate = data.savedAt ? new Date(data.savedAt) : new Date();
    const dateFormatted = genDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    doc.text(`Generated on: ${dateFormatted}`, MARGIN_LEFT + 16, doc.y - 36, { font: "F1", size: 8.5, color: [0.75, 0.8, 0.88] });

    // Target Role & Company
    doc.text(`Target Internship: `, MARGIN_LEFT + 16, doc.y - 54, { font: "F2", size: 10, color: [1, 1, 1] });
    doc.text(`${role} at ${company}`, MARGIN_LEFT + 108, doc.y - 54, { font: "F1", size: 10, color: [0.85, 0.9, 0.98] });

    // Status pill
    let pillColor = [0.13, 0.69, 0.30]; // green
    if (percent < 35) pillColor = [0.86, 0.15, 0.15]; // red
    else if (percent < 65) pillColor = [0.85, 0.47, 0.02]; // amber

    doc.rect(PAGE_WIDTH - MARGIN_RIGHT - 145, doc.y - 70, 130, 48, [0.08, 0.12, 0.22], pillColor, 1.5);
    doc.text(`${percent}% MATCH`, PAGE_WIDTH - MARGIN_RIGHT - 132, doc.y - 42, { font: "F2", size: 16, color: pillColor });
    doc.text(`Level: ${level}`, PAGE_WIDTH - MARGIN_RIGHT - 132, doc.y - 58, { font: "F1", size: 9, color: [0.9, 0.9, 0.9] });

    doc.y -= (heroHeight + 16);

    // ==========================================
    // 3, 4 & 5. COMPETENCY BREAKDOWN & FORMULA
    // ==========================================
    doc.ensureSpace(80);
    renderSectionHeader(doc, "1. Competency Alignment Breakdown & Scoring Formula");

    const totalCompetencies = matched.length + partial.length + missing.length;
    const mCount = matched.length;
    const pCount = partial.length;
    const gCount = missing.length;

    // Visual segmented bar
    const barW = CONTENT_WIDTH;
    const barH = 14;
    doc.rect(MARGIN_LEFT, doc.y - barH, barW, barH, [0.92, 0.94, 0.96], [0.8, 0.83, 0.88], 0.5);

    if (totalCompetencies > 0) {
      const mW = (mCount / totalCompetencies) * barW;
      const pW = (pCount / totalCompetencies) * barW;
      const gW = Math.max(0, barW - mW - pW);

      let curX = MARGIN_LEFT;
      if (mW > 0) {
        doc.rect(curX, doc.y - barH, mW, barH, [0.05, 0.58, 0.53], null);
        curX += mW;
      }
      if (pW > 0) {
        doc.rect(curX, doc.y - barH, pW, barH, [0.85, 0.47, 0.02], null);
        curX += pW;
      }
      if (gW > 0) {
        doc.rect(curX, doc.y - barH, gW, barH, [0.86, 0.15, 0.15], null);
      }
    }
    doc.y -= (barH + 10);

    // Legend line
    doc.rect(MARGIN_LEFT, doc.y - 2, 8, 8, [0.05, 0.58, 0.53], null);
    doc.text(`Matched (${mCount})`, MARGIN_LEFT + 12, doc.y + 4, { font: "F1", size: 8.5, color: [0.2, 0.25, 0.3] });

    doc.rect(MARGIN_LEFT + 100, doc.y - 2, 8, 8, [0.85, 0.47, 0.02], null);
    doc.text(`Partial 0.5x (${pCount})`, MARGIN_LEFT + 112, doc.y + 4, { font: "F1", size: 8.5, color: [0.2, 0.25, 0.3] });

    doc.rect(MARGIN_LEFT + 220, doc.y - 2, 8, 8, [0.86, 0.15, 0.15], null);
    doc.text(`Missing Gaps (${gCount})`, MARGIN_LEFT + 232, doc.y + 4, { font: "F1", size: 8.5, color: [0.2, 0.25, 0.3] });

    doc.y -= 18;

    // Formula Callout Box
    const formulaLines = wrapText(`Formula & Scoring: ${scoreBreakdown}`, CONTENT_WIDTH - 24, 8.5, false);
    const boxH = formulaLines.length * 12 + 16;
    doc.rect(MARGIN_LEFT, doc.y - boxH, CONTENT_WIDTH, boxH, [0.96, 0.97, 0.99], [0.85, 0.88, 0.94], 1);
    doc.text("Explainable Calculation Methodology:", MARGIN_LEFT + 12, doc.y - 12, { font: "F2", size: 8.5, color: [0.05, 0.58, 0.53] });
    formulaLines.forEach((fl, flIdx) => {
      doc.text(fl, MARGIN_LEFT + 12, doc.y - 24 - (flIdx * 12), { font: "F1", size: 8, color: [0.25, 0.3, 0.38] });
    });
    doc.y -= (boxH + 14);

    // ==========================================
    // 6. MATCHED SKILLS (1.0x CREDIT)
    // ==========================================
    doc.ensureSpace(60);
    renderSectionHeader(doc, `2. Matched Competencies (${matched.length}) — Full Credit (1.0x)`, "Skills verified directly from candidate resume content.");

    if (matched.length === 0) {
      doc.text("No direct competency matches found in the uploaded resume.", MARGIN_LEFT + 8, doc.y, { font: "F3", size: 8.5, color: [0.5, 0.55, 0.6] });
      doc.y -= 16;
    } else {
      matched.forEach((s) => {
        const name = typeof s === "object" ? (s.name || s.skill || "Skill") : String(s);
        const imp = typeof s === "object" && s.importance === "preferred" ? "Preferred" : "Required";
        const reason = typeof s === "object" ? (s.reason || "Competency verified on candidate resume.") : "Verified competency.";
        const reasonLines = wrapText(reason, CONTENT_WIDTH - 150, 8, false);

        const rowH = Math.max(22, reasonLines.length * 10 + 12);
        doc.ensureSpace(rowH + 4);

        doc.rect(MARGIN_LEFT, doc.y - rowH, CONTENT_WIDTH, rowH, [0.96, 0.99, 0.97], [0.8, 0.92, 0.85], 0.5);
        doc.text("[MATCHED] " + name, MARGIN_LEFT + 8, doc.y - 13, { font: "F2", size: 9, color: [0.05, 0.5, 0.3] });
        
        // Importance badge
        doc.text(`[${imp.toUpperCase()}]`, MARGIN_LEFT + 130, doc.y - 13, { font: "F2", size: 7.5, color: imp === "Required" ? [0.1, 0.35, 0.65] : [0.5, 0.35, 0.1] });

        reasonLines.forEach((rl, rIdx) => {
          doc.text(rl, MARGIN_LEFT + 190, doc.y - 12 - (rIdx * 10), { font: "F1", size: 8, color: [0.25, 0.3, 0.35] });
        });

        doc.y -= (rowH + 4);
      });
      doc.y -= 8;
    }

    // ==========================================
    // 7. PARTIALLY MATCHED SKILLS (0.5x CREDIT)
    // ==========================================
    doc.ensureSpace(60);
    renderSectionHeader(doc, `3. Partially Matched Skills (${partial.length}) — Half Credit (0.5x)`, "Candidate demonstrates related foundational concept accelerating proficiency.");

    if (partial.length === 0) {
      doc.text("No partial skill matches. Skills were either fully matched or gaps.", MARGIN_LEFT + 8, doc.y, { font: "F3", size: 8.5, color: [0.5, 0.55, 0.6] });
      doc.y -= 16;
    } else {
      partial.forEach((s) => {
        const name = typeof s === "object" ? (s.name || s.skill || "Skill") : String(s);
        const imp = typeof s === "object" && s.importance === "preferred" ? "Preferred" : "Required";
        const evidence = typeof s === "object" ? (s.foundationEvidence || `Candidate's experience in ${s.foundationSkill || 'foundational tools'} applies here.`) : "Foundational knowledge applies.";
        const reason = typeof s === "object" ? (s.reason || "Contextual role competency.") : "";

        const textBlock = `Evidence: "${evidence}" | Context: ${reason}`;
        const lines = wrapText(textBlock, CONTENT_WIDTH - 150, 8, false);
        const rowH = Math.max(26, lines.length * 10 + 14);

        doc.ensureSpace(rowH + 4);
        doc.rect(MARGIN_LEFT, doc.y - rowH, CONTENT_WIDTH, rowH, [0.99, 0.98, 0.94], [0.95, 0.88, 0.7], 0.5);
        doc.text("[PARTIAL] " + name, MARGIN_LEFT + 8, doc.y - 13, { font: "F2", size: 9, color: [0.75, 0.42, 0.02] });
        doc.text(`[${imp.toUpperCase()}]`, MARGIN_LEFT + 130, doc.y - 13, { font: "F2", size: 7.5, color: imp === "Required" ? [0.1, 0.35, 0.65] : [0.5, 0.35, 0.1] });

        lines.forEach((l, lIdx) => {
          doc.text(l, MARGIN_LEFT + 190, doc.y - 12 - (lIdx * 10), { font: "F1", size: 8, color: [0.3, 0.25, 0.15] });
        });

        doc.y -= (rowH + 4);
      });
      doc.y -= 8;
    }

    // ==========================================
    // 8. MISSING SKILLS / GAPS
    // ==========================================
    doc.ensureSpace(60);
    renderSectionHeader(doc, `4. Missing Skill Gaps (${missing.length})`, "Key skills required or preferred for this role not evidenced on resume.");

    if (missing.length === 0) {
      doc.text("Zero skill gaps! Candidate resume covers all listed competencies.", MARGIN_LEFT + 8, doc.y, { font: "F2", size: 8.5, color: [0.05, 0.58, 0.53] });
      doc.y -= 16;
    } else {
      missing.forEach((s) => {
        const name = typeof s === "object" ? (s.name || s.skill || "Skill") : String(s);
        const imp = typeof s === "object" && s.importance === "preferred" ? "Preferred" : "Required";
        const reason = typeof s === "object" ? (s.reason || "Competency expected for internship duties.") : "Required role competency.";
        const lines = wrapText(`Why Needed: ${reason}`, CONTENT_WIDTH - 150, 8, false);
        const rowH = Math.max(22, lines.length * 10 + 12);

        doc.ensureSpace(rowH + 4);
        doc.rect(MARGIN_LEFT, doc.y - rowH, CONTENT_WIDTH, rowH, [0.99, 0.96, 0.96], [0.95, 0.82, 0.82], 0.5);
        doc.text("[GAP] " + name, MARGIN_LEFT + 8, doc.y - 13, { font: "F2", size: 9, color: [0.82, 0.15, 0.15] });
        doc.text(`[${imp.toUpperCase()}]`, MARGIN_LEFT + 130, doc.y - 13, { font: "F2", size: 7.5, color: imp === "Required" ? [0.8, 0.15, 0.15] : [0.5, 0.35, 0.1] });

        lines.forEach((l, lIdx) => {
          doc.text(l, MARGIN_LEFT + 190, doc.y - 12 - (lIdx * 10), { font: "F1", size: 8, color: [0.35, 0.15, 0.15] });
        });

        doc.y -= (rowH + 4);
      });
      doc.y -= 8;
    }

    // ==========================================
    // 9. REQUIRED VERSUS PREFERRED CLASSIFICATION
    // ==========================================
    doc.ensureSpace(70);
    renderSectionHeader(doc, "5. Required vs. Preferred Skill Classification");

    const reqList = requiredSkills.length > 0 ? requiredSkills : matched.concat(partial, missing).filter(s => typeof s === "object" && s.importance === "required").map(s => s.name);
    const prefList = preferredSkills.length > 0 ? preferredSkills : matched.concat(partial, missing).filter(s => typeof s === "object" && s.importance === "preferred").map(s => s.name);

    const colW = (CONTENT_WIDTH - 12) / 2;
    doc.rect(MARGIN_LEFT, doc.y - 48, colW, 48, [0.97, 0.98, 1.0], [0.82, 0.88, 0.98], 0.75);
    doc.text("[REQUIRED] Core Role Prerequisites", MARGIN_LEFT + 10, doc.y - 14, { font: "F2", size: 8.5, color: [0.1, 0.25, 0.55] });
    const reqText = reqList.length > 0 ? reqList.join(", ") : "None explicitly partitioned";
    const reqLines = wrapText(reqText, colW - 20, 8, false);
    reqLines.slice(0, 2).forEach((l, idx) => {
      doc.text(l, MARGIN_LEFT + 10, doc.y - 26 - (idx * 10), { font: "F1", size: 7.5, color: [0.2, 0.3, 0.45] });
    });

    doc.rect(MARGIN_LEFT + colW + 12, doc.y - 48, colW, 48, [0.99, 0.98, 0.95], [0.95, 0.88, 0.75], 0.75);
    doc.text("[PREFERRED] Advantageous Extras", MARGIN_LEFT + colW + 22, doc.y - 14, { font: "F2", size: 8.5, color: [0.6, 0.35, 0.05] });
    const prefText = prefList.length > 0 ? prefList.join(", ") : "None explicitly partitioned";
    const prefLines = wrapText(prefText, colW - 20, 8, false);
    prefLines.slice(0, 2).forEach((l, idx) => {
      doc.text(l, MARGIN_LEFT + colW + 22, doc.y - 26 - (idx * 10), { font: "F1", size: 7.5, color: [0.4, 0.3, 0.15] });
    });

    doc.y -= 58;

    // ==========================================
    // 10. RESPONSIBILITIES & QUALIFICATIONS
    // ==========================================
    if (responsibilities.length > 0 || qualifications.length > 0) {
      doc.ensureSpace(80);
      renderSectionHeader(doc, "6. Job Posting Intelligence: Responsibilities & Qualifications");

      if (responsibilities.length > 0) {
        doc.text("Key Role Responsibilities:", MARGIN_LEFT + 6, doc.y, { font: "F2", size: 9, color: [0.1, 0.15, 0.25] });
        doc.y -= 12;
        responsibilities.forEach((r) => {
          const rLines = wrapText(`•  ${r}`, CONTENT_WIDTH - 20, 8, false);
          doc.ensureSpace(rLines.length * 10 + 4);
          rLines.forEach((rl, rIdx) => {
            doc.text(rl, MARGIN_LEFT + 12, doc.y - (rIdx * 10), { font: "F1", size: 8, color: [0.25, 0.3, 0.38] });
          });
          doc.y -= (rLines.length * 10 + 3);
        });
        doc.y -= 6;
      }

      if (qualifications.length > 0) {
        doc.ensureSpace(30);
        doc.text("Prerequisite Qualifications:", MARGIN_LEFT + 6, doc.y, { font: "F2", size: 9, color: [0.1, 0.15, 0.25] });
        doc.y -= 12;
        qualifications.forEach((q) => {
          const qLines = wrapText(`•  ${q}`, CONTENT_WIDTH - 20, 8, false);
          doc.ensureSpace(qLines.length * 10 + 4);
          qLines.forEach((ql, qIdx) => {
            doc.text(ql, MARGIN_LEFT + 12, doc.y - (qIdx * 10), { font: "F1", size: 8, color: [0.25, 0.3, 0.38] });
          });
          doc.y -= (qLines.length * 10 + 3);
        });
        doc.y -= 6;
      }
    }

    // ==========================================
    // 11 & 12. PERSONALIZED LEARNING ROADMAP & LIVE MILESTONES
    // ==========================================
    if (roadmap.length > 0) {
      doc.ensureSpace(80);
      renderSectionHeader(doc, "7. Personalized Learning Roadmap & Live Progress Milestones", "Targeted pathways to close competency gaps before interviews.");

      roadmap.forEach((step, sIdx) => {
        const stepNum = sIdx + 1;
        const skillName = step.skill || `Skill ${stepNum}`;
        const hours = step.estimatedHours || "10–14 hours";
        const priority = step.importance || "High Priority";
        const why = step.whyItMatters || "Crucial qualification for this internship.";
        const topics = Array.isArray(step.topics) ? step.topics : [];
        const activities = Array.isArray(step.practicalActivities) ? step.practicalActivities : [];

        // Estimate total card height
        const whyLines = wrapText(`Why it matters: ${why}`, CONTENT_WIDTH - 24, 8, false);
        const cardNeeded = 50 + (whyLines.length * 10) + (topics.length * 10) + (activities.length * 12);
        doc.ensureSpace(Math.min(cardNeeded, 140));

        // Step card frame
        doc.rect(MARGIN_LEFT, doc.y - 20, CONTENT_WIDTH, 20, [0.08, 0.12, 0.2], null);
        doc.text(`STEP ${stepNum}: ${skillName.toUpperCase()}`, MARGIN_LEFT + 10, doc.y - 14, { font: "F2", size: 9, color: [0.18, 0.83, 0.75] });
        doc.text(`Est. Hours: ${hours}  |  ${priority}`, PAGE_WIDTH - MARGIN_RIGHT - 180, doc.y - 14, { font: "F1", size: 8, color: [0.9, 0.95, 1.0] });
        doc.y -= 24;

        if (step.foundationNote) {
          doc.ensureSpace(16);
          doc.text(`💡 Fast-Track Advantage: ${step.foundationNote}`, MARGIN_LEFT + 8, doc.y, { font: "F3", size: 8, color: [0.05, 0.58, 0.53] });
          doc.y -= 12;
        }

        whyLines.forEach(wl => {
          doc.ensureSpace(10);
          doc.text(wl, MARGIN_LEFT + 8, doc.y, { font: "F1", size: 8, color: [0.3, 0.35, 0.4] });
          doc.y -= 10;
        });

        if (topics.length > 0) {
          doc.ensureSpace(14);
          doc.text("Key Topics to Master: " + topics.join(" • "), MARGIN_LEFT + 8, doc.y, { font: "F2", size: 8, color: [0.15, 0.2, 0.3] });
          doc.y -= 12;
        }

        // Live Activities Checkbox States
        if (activities.length > 0) {
          doc.ensureSpace(activities.length * 12 + 14);
          doc.text("Practical Milestones & Verification Status:", MARGIN_LEFT + 8, doc.y, { font: "F2", size: 8, color: [0.1, 0.4, 0.35] });
          doc.y -= 10;

          activities.forEach((act, actIdx) => {
            const actKey = `cm_act_${encodeURIComponent(skillName)}_${actIdx}`;
            // Check status from activityProgress snapshot or local state
            const isCompleted = activityProgress[actKey] === "done" || activityProgress[actKey] === true;

            const mark = isCompleted ? "[COMPLETED]" : "[PENDING]";
            const actText = `${mark}  ${act}`;
            const actLines = wrapText(actText, CONTENT_WIDTH - 20, 8, false);

            doc.ensureSpace(actLines.length * 10 + 2);
            actLines.forEach((al, aIdx) => {
              doc.text(al, MARGIN_LEFT + 14, doc.y - (aIdx * 10), { font: isCompleted ? "F2" : "F1", size: 7.8, color: isCompleted ? [0.05, 0.45, 0.4] : [0.35, 0.4, 0.48] });
            });
            doc.y -= (actLines.length * 10 + 2);
          });
        }
        doc.y -= 10;
      });
    }

    // ==========================================
    // 13. RECOMMENDED STUDENT PORTFOLIO PROJECTS
    // ==========================================
    if (projects.length > 0) {
      doc.ensureSpace(80);
      renderSectionHeader(doc, "8. Recommended Practical Student Portfolio Projects", "Portfolio artifacts demonstrating verified capability for this role.");

      projects.forEach((proj, pIdx) => {
        const title = proj.title || `Portfolio Project ${pIdx + 1}`;
        const diff = proj.difficulty || "Intermediate";
        const desc = proj.description || "";
        const skillsList = Array.isArray(proj.skillsCovered) ? proj.skillsCovered.join(", ") : (proj.skillsCovered || "Fullstack");
        const deliverable = proj.deliverable || "GitHub repo with README and live demo.";
        const relevance = proj.relevance || "Direct demonstration of required role skills.";

        const descLines = wrapText(desc, CONTENT_WIDTH - 20, 8, false);
        const delivLines = wrapText(`Deliverable: ${deliverable}`, CONTENT_WIDTH - 20, 8, false);
        const relLines = wrapText(`Role Relevance: ${relevance}`, CONTENT_WIDTH - 20, 8, false);
        const cardH = 34 + (descLines.length * 10) + (delivLines.length * 10) + (relLines.length * 10);

        doc.ensureSpace(Math.min(cardH, 110));
        doc.rect(MARGIN_LEFT, doc.y - cardH, CONTENT_WIDTH, cardH, [0.97, 0.98, 0.99], [0.85, 0.88, 0.94], 0.75);

        doc.text(`Project ${pIdx + 1}: ${title}`, MARGIN_LEFT + 10, doc.y - 14, { font: "F2", size: 9, color: [0.08, 0.15, 0.3] });
        doc.text(`[${diff.toUpperCase()}]`, PAGE_WIDTH - MARGIN_RIGHT - 110, doc.y - 14, { font: "F2", size: 8, color: [0.75, 0.45, 0.05] });

        let curY = doc.y - 24;
        descLines.forEach(dl => {
          doc.text(dl, MARGIN_LEFT + 10, curY, { font: "F1", size: 8, color: [0.25, 0.3, 0.38] });
          curY -= 10;
        });

        doc.text(`Skills Exercised: ${skillsList}`, MARGIN_LEFT + 10, curY, { font: "F2", size: 8, color: [0.05, 0.58, 0.53] });
        curY -= 10;

        delivLines.forEach(dl => {
          doc.text(dl, MARGIN_LEFT + 10, curY, { font: "F1", size: 7.8, color: [0.35, 0.4, 0.48] });
          curY -= 10;
        });

        relLines.forEach(rl => {
          doc.text(rl, MARGIN_LEFT + 10, curY, { font: "F3", size: 7.8, color: [0.2, 0.35, 0.5] });
          curY -= 10;
        });

        doc.y -= (cardH + 8);
      });
    }

    // ==========================================
    // 14. COMPREHENSIVE VERIFICATION DISCLAIMER
    // ==========================================
    doc.ensureSpace(50);
    const disclaimerBoxH = 42;
    doc.rect(MARGIN_LEFT, doc.y - disclaimerBoxH, CONTENT_WIDTH, disclaimerBoxH, [0.96, 0.97, 0.98], [0.85, 0.88, 0.92], 0.75);
    doc.text("LEGAL & ACCURACY DISCLAIMER", MARGIN_LEFT + 12, doc.y - 12, { font: "F2", size: 8, color: [0.35, 0.4, 0.48] });

    const discLines = wrapText(
      "InternPilot provides heuristic warning signs and AI competency alignments, not guaranteed employment verification or legal endorsement. Always verify the employer independently before sharing personal data or signing agreements. All analysis processed locally.",
      CONTENT_WIDTH - 24,
      7.5,
      false
    );
    discLines.forEach((dl, dlIdx) => {
      doc.text(dl, MARGIN_LEFT + 12, doc.y - 22 - (dlIdx * 9), { font: "F1", size: 7.2, color: [0.45, 0.5, 0.58] });
    });
    doc.y -= (disclaimerBoxH + 10);

    return doc.buildBuffer();
  }

  // Generate a browser Blob from CareerMatch analysis
  function generateCareerMatchPdfBlob(analysis) {
    const buffer = buildCareerMatchPdf(analysis);
    if (typeof Blob !== "undefined") {
      return new Blob([buffer], { type: "application/pdf" });
    }
    return buffer;
  }

  // Trigger instant browser download with meaningful filename
  function downloadCareerMatchPdf(analysis, customFilename = null) {
    const role = (analysis && analysis.role) ? analysis.role.replace(/[^a-zA-Z0-9_-]+/g, "_") : "Internship";
    const filename = customFilename || `InternPilot_CareerMatch_${role}.pdf`;

    const blob = generateCareerMatchPdfBlob(analysis);

    if (typeof window !== "undefined" && window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, filename);
      return filename;
    }

    if (typeof document !== "undefined") {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 2000);
      return filename;
    }

    return blob;
  }

  // Generate high-resolution printable HTML view
  function printCareerMatchReport(analysis) {
    if (typeof window === "undefined") return;

    const role = (analysis && analysis.role) || "Internship Role";
    const company = (analysis && analysis.company) || "Company";
    const percent = (analysis && analysis.percent !== undefined) ? analysis.percent : 0;
    const dateStr = new Date(analysis.savedAt || Date.now()).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
    });

    const printWin = window.open("", "_blank");
    if (!printWin) {
      alert("Please allow popups to print the report.");
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>InternPilot Report - ${role} at ${company}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0d9488; padding-bottom: 12px; margin-bottom: 20px; }
          .brand { font-size: 20px; font-weight: 800; color: #0a0f1d; }
          .badge { background: #0d9488; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; }
          h2 { font-size: 16px; color: #0f172a; border-left: 4px solid #0d9488; padding-left: 8px; margin-top: 20px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; font-size: 12px; }
          th { background: #f1f5f9; font-weight: 700; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
          .matched { color: #059669; font-weight: 600; }
          .partial { color: #d97706; font-weight: 600; }
          .missing { color: #dc2626; font-weight: 600; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="background: #0d9488; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
        </div>
        <div class="header">
          <div>
            <div class="brand">InternPilot — CareerMatch AI</div>
            <div style="color: #64748b; font-size: 11px;">Generated on: ${dateStr}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: bold;">${role}</div>
            <div style="color: #64748b;">${company}</div>
          </div>
        </div>

        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 14px; font-weight: bold;">Competency Alignment Fit:</div>
            <div style="color: #64748b; font-size: 11px;">Formula: ${analysis.scoreBreakdown || "Weighted matched + partial"}</div>
          </div>
          <div class="badge" style="font-size: 16px; padding: 6px 14px;">${percent}% MATCH</div>
        </div>

        <h2>1. Competency Alignment Matrix</h2>
        <table>
          <thead>
            <tr><th>Competency</th><th>Classification</th><th>Status</th><th>Verification / Evidence</th></tr>
          </thead>
          <tbody>
            ${(analysis.matched || []).map(s => `<tr><td class="matched">${s.name || s}</td><td>${s.importance || "Required"}</td><td>✓ Matched (1.0x)</td><td>${s.reason || "Verified"}</td></tr>`).join("")}
            ${(analysis.partial || []).map(s => `<tr><td class="partial">${s.name || s}</td><td>${s.importance || "Required"}</td><td>⚡ Partial (0.5x)</td><td>${s.foundationEvidence || "Foundation in resume"}</td></tr>`).join("")}
            ${(analysis.missing || []).map(s => `<tr><td class="missing">${s.name || s}</td><td>${s.importance || "Required"}</td><td>✕ Skill Gap</td><td>${s.reason || "Key requirement"}</td></tr>`).join("")}
          </tbody>
        </table>

        <h2>2. Personalized Learning Roadmap</h2>
        ${(analysis.roadmap || []).map((r, i) => `
          <div class="card">
            <div style="font-weight: bold; color: #0f172a;">Step ${i + 1}: ${r.skill} (${r.estimatedHours || "10-14 hours"})</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Why needed: ${r.whyItMatters || ""}</div>
            <div style="font-size: 11px; margin-top: 6px;"><strong>Practical Milestones:</strong></div>
            <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 11px;">
              ${(r.practicalActivities || []).map((a, ai) => {
                const key = `cm_act_${encodeURIComponent(r.skill)}_${ai}`;
                const done = analysis.activityProgress && analysis.activityProgress[key] === "done";
                return `<li>${done ? "<strong>[✓ Done]</strong>" : "[○ Pending]"} ${a}</li>`;
              }).join("")}
            </ul>
          </div>
        `).join("")}

        <h2>3. Recommended Student Portfolio Projects</h2>
        ${(analysis.projects || []).map(p => `
          <div class="card">
            <div style="font-weight: bold;">${p.title} <span style="font-size: 10px; color: #d97706;">(${p.difficulty})</span></div>
            <div style="font-size: 11px; margin-top: 4px;">${p.description}</div>
            <div style="font-size: 11px; margin-top: 4px;"><strong>Deliverable:</strong> ${p.deliverable}</div>
          </div>
        `).join("")}

        <div style="margin-top: 30px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
          Disclaimer: InternPilot provides heuristic warning signs and AI recommendations, not guaranteed hiring verification. Always research employers independently.
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  return {
    PdfDocument,
    buildCareerMatchPdf,
    generateCareerMatchPdfBlob,
    downloadCareerMatchPdf,
    printCareerMatchReport
  };
});
