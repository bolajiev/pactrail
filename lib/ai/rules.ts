import type {
  AgreementAnalysis,
  AnalysisField,
  MilestoneExtraction,
  PartyExtraction,
} from "@/lib/types";

const STATUS = {
  extracted: "extracted",
  inferred: "inferred",
  missing: "missing",
  needs_review: "needs_review",
} as const;

function makeField(
  value: string | null,
  status: AnalysisField["status"],
  confidence: number,
  sourceExcerpt: string | null,
): AnalysisField {
  return {
    value: value ? value.trim() : null,
    status,
    confidence: value ? confidence : 0,
    source_excerpt: sourceExcerpt ? sourceExcerpt.trim().slice(0, 900) : null,
  };
}

function sourceLine(text: string, index: number, length = 900): string {
  const start = Math.max(0, text.lastIndexOf("\n", index) + 1);
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end).trim().slice(0, length);
}

function firstMatch(text: string, patterns: RegExp[]): { match: RegExpMatchArray; line: string } | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.index !== undefined) {
      return { match, line: sourceLine(text, match.index) };
    }
  }
  return null;
}

function parseAmount(value: string): string | null {
  const clean = value.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,6})?$/.test(clean)) return null;
  return clean;
}

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseDueDate(fragment: string): { iso: string; explicit: boolean } | null {
  const isoMatch = fragment.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const date = new Date(
      Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), 23, 59, 59),
    );
    if (!Number.isNaN(date.getTime())) return { iso: date.toISOString(), explicit: true };
  }

  const dayFirst = fragment.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase()];
    if (month !== undefined) {
      const date = new Date(
        Date.UTC(Number(dayFirst[3]), month, Number(dayFirst[1]), 23, 59, 59),
      );
      if (!Number.isNaN(date.getTime())) return { iso: date.toISOString(), explicit: true };
    }
  }

  const monthFirst = fragment.match(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    if (month !== undefined) {
      const date = new Date(
        Date.UTC(Number(monthFirst[3]), month, Number(monthFirst[2]), 23, 59, 59),
      );
      if (!Number.isNaN(date.getTime())) return { iso: date.toISOString(), explicit: true };
    }
  }

  const withinDays = fragment.match(/\bwithin\s+(\d{1,3})\s+days?\b/i);
  if (withinDays) {
    const date = new Date(Date.now() + Number(withinDays[1]) * 86_400_000);
    date.setUTCHours(23, 59, 59, 0);
    return { iso: date.toISOString(), explicit: false };
  }

  return null;
}

function titleFromText(text: string): AnalysisField {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 3);
  if (!firstLine || firstLine.length > 160) {
    return makeField(null, STATUS.needs_review, 0, firstLine ?? null);
  }
  const cleaned = firstLine
    .replace(/\s+(agreement|contract)$/i, "")
    .replace(/[#*_]/g, "")
    .trim();
  const sentence = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  return makeField(sentence, STATUS.extracted, 0.82, firstLine);
}

function scopeFromText(text: string): AnalysisField {
  const lines = text.split("\n");
  const headingIndex = lines.findIndex((line) => /scope(?:\s+of\s+work)?/i.test(line));
  if (headingIndex >= 0) {
    const paragraph: string[] = [];
    for (let index = headingIndex + 1; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) {
        if (paragraph.length) break;
        continue;
      }
      if (/^\d+\.\s/.test(line) || /^(fees?|payment|milestones?|disputes?|governing law)\b/i.test(line)) {
        break;
      }
      paragraph.push(line);
    }
    if (paragraph.length) {
      return makeField(paragraph.join(" ").slice(0, 900), STATUS.extracted, 0.78, paragraph[0]);
    }
  }

  const sentence = text.match(/(?:shall|will)\s+(?:design|develop|deliver|provide|build)[^.\n]+/i);
  if (sentence) {
    return makeField(sentence[0], STATUS.inferred, 0.55, sourceLine(text, sentence.index ?? 0));
  }
  return makeField(null, STATUS.missing, 0, null);
}

function extractParty(
  text: string,
  role: "payer" | "payee" | "arbitrator",
  patterns: RegExp[],
): PartyExtraction {
  const found = firstMatch(text, patterns);
  if (found) {
    let name = found.match[1]
      .trim()
      .replace(/[.;,]+$/, "")
      .replace(/\s{2,}/g, " ");
    name = name.split(/\s+\((?:sample|demo)\)/i)[0].trim();
    if (name.length > 0 && name.length <= 200 && !/[$€£]/.test(name)) {
      return {
        role,
        name,
        name_status: STATUS.extracted,
        name_confidence: 0.86,
        source_excerpt: found.line,
        wallet: null,
        wallet_status: "needs_review",
      };
    }
  }
  return {
    role,
    name: null,
    name_status: STATUS.missing,
    name_confidence: 0,
    source_excerpt: null,
    wallet: null,
    wallet_status: "needs_review",
  };
}

function extractMilestones(text: string): MilestoneExtraction[] {
  const lines = text.split("\n");
  const results: MilestoneExtraction[] = [];
  let inSchedule = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/milestone schedule|payment schedule|milestones/i.test(line) && line.length < 80) {
      inSchedule = true;
      continue;
    }
    if (!line) continue;
    if (/^\d+\.\s+[A-Z][A-Za-z ]+(?:of|and)?[A-Za-z ]*$/.test(line) && !line.includes("$")) {
      if (results.length > 0 && !/milestone/i.test(line)) inSchedule = false;
    }

    const numbered = line.match(/^(?:milestone\s+)?(\d{1,2})[.):]\s+(.+)$/i);
    const bullet = line.match(/^[-•*]\s+(.+)$/);
    if (!numbered && !bullet) continue;

    const body = (numbered?.[2] ?? bullet?.[1] ?? "").trim();
    const amountMatch = body.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    if (!amountMatch && !inSchedule) continue;
    if (!amountMatch) continue;

    const amount = parseAmount(amountMatch[1]);
    const dueFragment = body.match(/\b(?:due|by|on or before)\s+([^.;\n]+)/i)?.[1] ?? body;
    const due = parseDueDate(dueFragment);
    const acceptance =
      body.match(/acceptance(?:\s+criteria)?\s*:\s*([^.\n]+(?:\.[^.\n]+)?)/i)?.[1]?.trim() ?? null;

    const amountIndex = body.indexOf(amountMatch[0]);
    let description =
      amountIndex > 0
        ? body.slice(0, amountIndex)
        : body
            .replace(/\$\s*[\d,]+(?:\.\d{1,2})?/, "")
            .replace(/\b(?:due|by|on or before)\s+[^.;\n]+/i, "")
            .replace(/acceptance(?:\s+criteria)?\s*:\s*[^.\n]+(?:\.[^.\n]+)?/i, "");
    description = description
      .replace(/[\s:;,.([{—–-]+$/g, "")
      .replace(/^[\s:;,.—–-]+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!description) description = `Milestone ${results.length + 1}`;

    results.push({
      description: description.slice(0, 300),
      amount,
      due_date: due?.iso ?? null,
      acceptance_criteria: acceptance?.slice(0, 900) ?? null,
      status: due?.explicit === false ? STATUS.inferred : STATUS.extracted,
      confidence: amount && due?.explicit ? 0.9 : 0.68,
      source_excerpt: line.slice(0, 900),
    });
    if (results.length >= 32) break;
  }

  return results;
}

function extractTotal(text: string): AnalysisField {
  const patterns = [
    /(?:total (?:project )?(?:fee|price|amount)|aggregate (?:fee|amount)|contract (?:price|value)|total)[^.\n]{0,90}?\$\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\$\s*([\d,]+(?:\.\d{1,2})?)[^.\n]{0,60}?(?:total|in aggregate)/i,
  ];
  const found = firstMatch(text, patterns);
  if (found) {
    const amount = parseAmount(found.match[1]);
    if (amount) return makeField(amount, STATUS.extracted, 0.9, found.line);
  }

  const allDollarValues = Array.from(text.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g))
    .map((match) => parseAmount(match[1]))
    .filter((value): value is string => Boolean(value));
  if (allDollarValues.length > 0) {
    const largest = allDollarValues.sort(
      (left, right) => Number(right.replace(/,/g, "")) - Number(left.replace(/,/g, "")),
    )[0];
    const index = text.indexOf(`$${largest}`);
    return makeField(
      largest,
      STATUS.inferred,
      0.48,
      index >= 0 ? sourceLine(text, index) : null,
    );
  }
  return makeField(null, STATUS.missing, 0, null);
}

export function extractAgreementWithRules(text: string): AgreementAnalysis {
  const title = titleFromText(text);
  const scope = scopeFromText(text);
  const payer = extractParty(text, "payer", [
    /\b(?:payer|client|customer|buyer|company)\b[^\n:]{0,30}[:\-]\s*([^\n]{2,200})/i,
    /\bbetween\s+([^\n,]{2,120}?)\s*(?:\(|,)\s*(?:the\s+)?(?:client|payer|customer|buyer)/i,
  ]);
  const payee = extractParty(text, "payee", [
    /\b(?:payee|contractor|developer|supplier|consultant|service provider)\b[^\n:]{0,30}[:\-]\s*([^\n]{2,200})/i,
    /\band\s+([^\n,]{2,120}?)\s*\((?:"|“)?(?:contractor|payee|developer|supplier)/i,
  ]);
  const arbitrator = extractParty(text, "arbitrator", [
    /\b(?:arbitrator|arbiter|mediator)\b[^\n:]{0,30}[:\-]\s*([^\n]{2,200})/i,
  ]);

  const currency = /\bUSDC\b/i.test(text)
    ? makeField("USDC", STATUS.extracted, 0.95, sourceLine(text, text.search(/\bUSDC\b/i)))
    : /\bUSDT\b/i.test(text)
      ? makeField("USDT", STATUS.extracted, 0.9, sourceLine(text, text.search(/\bUSDT\b/i)))
      : /\bDAI\b/i.test(text)
        ? makeField("DAI", STATUS.extracted, 0.85, sourceLine(text, text.search(/\bDAI\b/i)))
        : makeField(null, STATUS.missing, 0, null);

  const total = extractTotal(text);
  const milestones = extractMilestones(text);
  if (milestones.length === 0 && total.value) {
    milestones.push({
      description: "Full delivery",
      amount: total.value,
      due_date: null,
      acceptance_criteria: null,
      status: STATUS.needs_review,
      confidence: 0.3,
      source_excerpt: total.source_excerpt,
    });
  }

  const jurisdiction =
    firstMatch(text, [/governed by the laws of\s+([^.\n]+)/i, /governing law[^\n:]{0,20}[:\-]\s*([^\n]+)/i]) ??
    null;
  const disputeLines = Array.from(text.matchAll(/^.*(?:dispute|arbitrat)[^\n]*$/gim))
    .map((match) => match[0].trim())
    .filter(
      (line) =>
        line.length > 28 &&
        !/^(?:arbitrator|arbiter|mediator)\s*[:–-]/i.test(line) &&
        !/^\d+\.\s*disputes?$/i.test(line),
    );
  const dispute = disputeLines[0]
    ? { match: [disputeLines[0]] as unknown as RegExpMatchArray, line: disputeLines[0] }
    : firstMatch(text, [/(?:dispute|arbitrat)[^\n]*/i]);
  const payment = firstMatch(text, [/(?:payment|acceptance)[^\n]*(?:released|paid|payable)[^\n]*/i]);

  const issues: string[] = [];
  if (!payer.name) issues.push("Payer was not identified in the text.");
  if (!payee.name) issues.push("Payee was not identified in the text.");
  if (!arbitrator.name) issues.push("No named arbitrator or dispute-resolution person was found.");
  if (!total.value) issues.push("The total agreement amount was not found.");
  if (!currency.value) issues.push("The settlement currency was not found.");
  if (milestones.length === 0) issues.push("No payment milestones were found.");
  if (!jurisdiction) issues.push("No governing-law or jurisdiction clause was found.");
  if (milestones.some((milestone) => !milestone.due_date)) {
    issues.push("At least one milestone has no explicit deadline.");
  }
  if (milestones.some((milestone) => !milestone.acceptance_criteria)) {
    issues.push("Some milestones have no explicit acceptance criteria.");
  }
  issues.push("Every proposed field must be reviewed and approved by the parties before escrow is created.");

  return {
    title,
    scope,
    parties: [payer, payee, arbitrator],
    currency,
    total_amount: total,
    milestones,
    jurisdiction: jurisdiction
      ? makeField(jurisdiction.match[1], STATUS.extracted, 0.82, jurisdiction.line)
      : makeField(null, STATUS.missing, 0, null),
    dispute_process: dispute
      ? makeField(dispute.match[0].slice(0, 500), STATUS.extracted, 0.72, dispute.line)
      : makeField(null, STATUS.missing, 0, null),
    payment_terms: payment
      ? makeField(payment.match[0].slice(0, 500), STATUS.extracted, 0.7, payment.line)
      : makeField(null, STATUS.missing, 0, null),
    issues_for_human_review: issues,
  };
}
