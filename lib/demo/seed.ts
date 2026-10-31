import { sha256, stringToBytes } from "viem";
import type {
  ActivityEvent,
  Agreement,
  DisputeRecord,
  EvidenceRecord,
  Milestone,
  Party,
  StoreState,
} from "@/lib/types";
import {
  buildApprovedTerms,
  canonicalStringify,
  type AgreementDraft,
} from "@/lib/agreement/canonical";

export const DEMO_NOW = "2026-10-30T12:00:00.000Z";

const EVIDENCE = {
  figma:
    "6308f887faa7d83a525e8b18ba9ec3a761f330655d77f58f4a248ab54da53111",
  identity:
    "6dc88f1ff0e6f5d4de3780810ba99af86d9a52a37db5edfe26804b01cb839bc0",
  cutover:
    "c870c3643765f54ffa06ef620594a2a7a9456f4624cdeae1a993082841a964e2",
  retainer:
    "21e920fa05f19e2946c5a05e0b112a8c8e57f341dc90e1411dac601680e14c4e",
};

function hashText(value: string): string {
  return sha256(stringToBytes(value));
}

function party(role: Party["role"], name: string): Party {
  return { role, name, address: null };
}

function evidence(
  description: string,
  hash: string,
  submittedAt: string,
  role: Party["role"],
  label: string,
  fileName: string,
  fileSize: number,
  uri: string,
): EvidenceRecord {
  return {
    description,
    fileName,
    fileSize,
    mimeType: fileName.endsWith(".pdf")
      ? "application/pdf"
      : fileName.endsWith(".md")
        ? "text/markdown"
        : "text/plain",
    hash,
    submittedAt,
    submittedByRole: role,
    submittedByLabel: label,
    uri,
  };
}

function seedAgreement(options: {
  id: string;
  title: string;
  summary: string;
  payer: Party;
  payee: Party;
  arbitrator: Party;
  totalAmountBaseUnits: string;
  jurisdictionContext: string;
  createdAt: string;
  fundedAt: string;
  updatedAt: string;
  completedAt?: string;
  milestones: Array<{
    description: string;
    acceptanceCriteria: string;
    amountBaseUnits: string;
    dueAt: string;
    status: Milestone["status"];
    evidence?: EvidenceRecord;
    dispute?: DisputeRecord;
    releasedAt?: string;
    releasedAmountBaseUnits?: string;
  }>;
}): Agreement {
  const token = { symbol: "USDC", address: null, decimals: 6 };
  const draft: AgreementDraft = {
    title: options.title,
    summary: options.summary,
    payer: options.payer,
    payee: options.payee,
    arbitrator: options.arbitrator,
    token,
    totalAmountBaseUnits: options.totalAmountBaseUnits,
    jurisdictionContext: options.jurisdictionContext,
    chainId: null,
    milestones: options.milestones.map((milestone, index) => ({
      id: `${options.id}_m${index + 1}`,
      description: milestone.description,
      acceptanceCriteria: milestone.acceptanceCriteria,
      amountBaseUnits: milestone.amountBaseUnits,
      dueAt: milestone.dueAt,
    })),
  };
  const terms = buildApprovedTerms(draft);
  const termsHash = `0x${hashText(canonicalStringify(terms))}`;

  return {
    id: options.id,
    mode: "demo",
    sample: true,
    title: options.title,
    summary: options.summary,
    payer: options.payer,
    payee: options.payee,
    arbitrator: options.arbitrator,
    token,
    totalAmountBaseUnits: options.totalAmountBaseUnits,
    jurisdictionContext: options.jurisdictionContext,
    terms,
    termsHash,
    termsApprovedAt: options.createdAt,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
    fundedAt: options.fundedAt,
    completedAt: options.completedAt,
    milestones: options.milestones.map((milestone, index) => ({
      id: `${options.id}_m${index + 1}`,
      index,
      description: milestone.description,
      acceptanceCriteria: milestone.acceptanceCriteria,
      amountBaseUnits: milestone.amountBaseUnits,
      dueAt: milestone.dueAt,
      status: milestone.status,
      evidence: milestone.evidence,
      dispute: milestone.dispute,
      releasedAmountBaseUnits: milestone.releasedAmountBaseUnits,
      resolvedAt: milestone.releasedAt,
    })),
    chain: null,
    sourceSaved: false,
  };
}

function event(
  id: string,
  agreementId: string,
  kind: ActivityEvent["kind"],
  actorLabel: string,
  summary: string,
  at: string,
  origin: ActivityEvent["origin"],
  options: Partial<ActivityEvent> = {},
): ActivityEvent {
  return {
    id,
    agreementId,
    mode: "demo",
    kind,
    actorLabel,
    summary,
    at,
    origin,
    ...options,
  };
}

function sampleOne(): { agreement: Agreement; events: ActivityEvent[] } {
  const id = "agr_website_redesign";
  const createdAt = "2026-10-08T09:12:00.000Z";
  const fundedAt = "2026-10-08T10:04:00.000Z";
  const releasedAt = "2026-10-20T16:20:00.000Z";
  const payer = party("payer", "Northstar Commerce Ltd");
  const payee = party("payee", "Studio Nine");
  const arbitrator = party("arbitrator", "Demo Arbitration Account");

  const agreement = seedAgreement({
    id,
    title: "Website redesign and development",
    summary:
      "Responsive marketing site redesign, storefront front end, and a production handover delivered across three milestones.",
    payer,
    payee,
    arbitrator,
    totalAmountBaseUnits: "5000000000",
    jurisdictionContext: "England and Wales · sample agreement",
    createdAt,
    fundedAt,
    updatedAt: releasedAt,
    milestones: [
      {
        description: "Design approval",
        acceptanceCriteria:
          "Approved Figma prototype, design tokens, and a written summary of the design decisions.",
        amountBaseUnits: "1000000000",
        dueAt: "2026-10-21T23:59:59.000Z",
        status: "released",
        releasedAt,
        releasedAmountBaseUnits: "1000000000",
        evidence: evidence(
          "Demo handover note for the Figma prototype, design tokens, and decision summary.",
          EVIDENCE.figma,
          "2026-10-16T14:05:00.000Z",
          "payee",
          payee.name,
          "northstar-design-handover.txt",
          82,
          "/demo/northstar-design-handover.txt",
        ),
      },
      {
        description: "Frontend implementation",
        acceptanceCriteria:
          "Responsive staging site matching the approved design and passing the browser checklist.",
        amountBaseUnits: "2000000000",
        dueAt: "2026-11-07T23:59:59.000Z",
        status: "pending",
      },
      {
        description: "Final handover",
        acceptanceCriteria:
          "Production build, source repository access, deployment notes, and recorded handover session.",
        amountBaseUnits: "2000000000",
        dueAt: "2026-11-28T23:59:59.000Z",
        status: "pending",
      },
    ],
  });

  const events = [
    event(
      "evt_web_terms",
      id,
      "terms_confirmed",
      "Parties (review)",
      "Parties approved the structured terms and SHA-256 terms hash.",
      createdAt,
      "offchain",
      { hashRef: agreement.termsHash },
    ),
    event(
      "evt_web_created",
      id,
      "agreement_created",
      payer.name,
      "Sample agreement created in the demo workspace.",
      "2026-10-08T09:20:00.000Z",
      "demo",
    ),
    event(
      "evt_web_funded",
      id,
      "funded",
      payer.name,
      "Funded the demo escrow with 5,000.00 test USDC.",
      fundedAt,
      "demo",
    ),
    event(
      "evt_web_evidence",
      id,
      "evidence_submitted",
      payee.name,
      "Submitted evidence for Design approval.",
      "2026-10-16T14:05:00.000Z",
      "demo",
      { hashRef: EVIDENCE.figma },
    ),
    event(
      "evt_web_approved",
      id,
      "milestone_approved",
      payer.name,
      "Approved Design approval and released 1,000.00 test USDC.",
      releasedAt,
      "demo",
    ),
  ];

  return { agreement, events };
}

function sampleTwo(): { agreement: Agreement; events: ActivityEvent[] } {
  const id = "agr_brand_identity";
  const createdAt = "2026-10-12T11:30:00.000Z";
  const fundedAt = "2026-10-12T12:10:00.000Z";
  const submittedAt = "2026-10-29T15:40:00.000Z";
  const payer = party("payer", "Meridian Health");
  const payee = party("payee", "Fieldnote Studio");
  const arbitrator = party("arbitrator", "Demo Arbitration Account");

  const agreement = seedAgreement({
    id,
    title: "Brand identity system",
    summary:
      "A complete identity system for Meridian Health, including discovery, core identity, and final usage guidelines.",
    payer,
    payee,
    arbitrator,
    totalAmountBaseUnits: "3200000000",
    jurisdictionContext: "Delaware, USA · sample agreement",
    createdAt,
    fundedAt,
    updatedAt: submittedAt,
    milestones: [
      {
        description: "Discovery and positioning",
        acceptanceCriteria:
          "Interview synthesis, positioning statement, and moodboard presented to the payer.",
        amountBaseUnits: "1200000000",
        dueAt: "2026-10-18T23:59:59.000Z",
        status: "released",
        releasedAt: "2026-10-17T17:15:00.000Z",
        releasedAmountBaseUnits: "1200000000",
      },
      {
        description: "Identity system delivery",
        acceptanceCriteria:
          "Primary and secondary marks, color system, typography, and usage examples in a single handover package.",
        amountBaseUnits: "1200000000",
        dueAt: "2026-11-04T23:59:59.000Z",
        status: "submitted",
        evidence: evidence(
          "Demo identity system note and logo usage summary.",
          EVIDENCE.identity,
          submittedAt,
          "payee",
          payee.name,
          "meridian-identity-evidence.txt",
          67,
          "/demo/meridian-identity-evidence.txt",
        ),
      },
      {
        description: "Final guidelines",
        acceptanceCriteria:
          "Brand guidelines document and editable source files delivered to the payer.",
        amountBaseUnits: "800000000",
        dueAt: "2026-11-20T23:59:59.000Z",
        status: "pending",
      },
    ],
  });

  const events = [
    event(
      "evt_brand_terms",
      id,
      "terms_confirmed",
      "Parties (review)",
      "Parties approved the structured terms and SHA-256 terms hash.",
      createdAt,
      "offchain",
      { hashRef: agreement.termsHash },
    ),
    event(
      "evt_brand_created",
      id,
      "agreement_created",
      payer.name,
      "Sample agreement created in the demo workspace.",
      "2026-10-12T11:36:00.000Z",
      "demo",
    ),
    event(
      "evt_brand_funded",
      id,
      "funded",
      payer.name,
      "Funded the demo escrow with 3,200.00 test USDC.",
      fundedAt,
      "demo",
    ),
    event(
      "evt_brand_released",
      id,
      "milestone_approved",
      payer.name,
      "Approved Discovery and positioning and released 1,200.00 test USDC.",
      "2026-10-17T17:15:00.000Z",
      "demo",
    ),
    event(
      "evt_brand_evidence",
      id,
      "evidence_submitted",
      payee.name,
      "Submitted evidence for Identity system delivery.",
      submittedAt,
      "demo",
      { hashRef: EVIDENCE.identity },
    ),
  ];

  return { agreement, events };
}

function sampleThree(): { agreement: Agreement; events: ActivityEvent[] } {
  const id = "agr_data_migration";
  const createdAt = "2026-09-28T08:40:00.000Z";
  const fundedAt = "2026-09-29T09:15:00.000Z";
  const submittedAt = "2026-10-27T11:20:00.000Z";
  const disputedAt = "2026-10-28T09:05:00.000Z";
  const payer = party("payer", "Atlas Freight");
  const payee = party("payee", "Kite Systems");
  const arbitrator = party("arbitrator", "Demo Arbitration Account");
  const disputeReason =
    "The cutover validation report is missing the rollback test evidence required by the acceptance criteria.";

  const agreement = seedAgreement({
    id,
    title: "Data migration and API integration",
    summary:
      "Migrate Atlas Freight operational data, connect the new API, and document the completed cutover.",
    payer,
    payee,
    arbitrator,
    totalAmountBaseUnits: "7200000000",
    jurisdictionContext: "Singapore · sample agreement",
    createdAt,
    fundedAt,
    updatedAt: disputedAt,
    milestones: [
      {
        description: "Schema migration",
        acceptanceCriteria:
          "Validated schema mapping and a successful migration rehearsal on a production-sized copy.",
        amountBaseUnits: "2400000000",
        dueAt: "2026-10-12T23:59:59.000Z",
        status: "released",
        releasedAt: "2026-10-10T14:00:00.000Z",
        releasedAmountBaseUnits: "2400000000",
      },
      {
        description: "Cutover and validation",
        acceptanceCriteria:
          "Production cutover, reconciliation report, and rollback test evidence signed off by the payer.",
        amountBaseUnits: "3200000000",
        dueAt: "2026-11-01T23:59:59.000Z",
        status: "disputed",
        evidence: evidence(
          "Demo cutover validation note and rollback reference.",
          EVIDENCE.cutover,
          submittedAt,
          "payee",
          payee.name,
          "atlas-cutover-validation.txt",
          66,
          "/demo/atlas-cutover-validation.txt",
        ),
        dispute: {
          raisedByRole: "payer",
          raisedByLabel: payer.name,
          reason: disputeReason,
          reasonHash: `0x${hashText(disputeReason)}`,
          raisedAt: disputedAt,
          status: "open",
        },
      },
      {
        description: "Documentation",
        acceptanceCriteria:
          "Runbook, API reference, and on-call escalation notes delivered and accepted.",
        amountBaseUnits: "1600000000",
        dueAt: "2026-11-15T23:59:59.000Z",
        status: "pending",
      },
    ],
  });

  const events = [
    event(
      "evt_data_terms",
      id,
      "terms_confirmed",
      "Parties (review)",
      "Parties approved the structured terms and SHA-256 terms hash.",
      createdAt,
      "offchain",
      { hashRef: agreement.termsHash },
    ),
    event(
      "evt_data_created",
      id,
      "agreement_created",
      payer.name,
      "Sample agreement created in the demo workspace.",
      "2026-09-28T08:48:00.000Z",
      "demo",
    ),
    event(
      "evt_data_funded",
      id,
      "funded",
      payer.name,
      "Funded the demo escrow with 7,200.00 test USDC.",
      fundedAt,
      "demo",
    ),
    event(
      "evt_data_released",
      id,
      "milestone_approved",
      payer.name,
      "Approved Schema migration and released 2,400.00 test USDC.",
      "2026-10-10T14:00:00.000Z",
      "demo",
    ),
    event(
      "evt_data_evidence",
      id,
      "evidence_submitted",
      payee.name,
      "Submitted evidence for Cutover and validation.",
      submittedAt,
      "demo",
      { hashRef: EVIDENCE.cutover },
    ),
    event(
      "evt_data_dispute",
      id,
      "dispute_raised",
      payer.name,
      "Disputed Cutover and validation: rollback test evidence missing.",
      disputedAt,
      "demo",
      { hashRef: `0x${hashText(disputeReason)}` },
    ),
  ];

  return { agreement, events };
}

function sampleFour(): { agreement: Agreement; events: ActivityEvent[] } {
  const id = "agr_content_retainer";
  const createdAt = "2026-08-01T10:00:00.000Z";
  const fundedAt = "2026-08-02T08:30:00.000Z";
  const completedAt = "2026-10-02T16:45:00.000Z";
  const payer = party("payer", "Lumen Labs");
  const payee = party("payee", "The Copy Desk");
  const arbitrator = party("arbitrator", "Demo Arbitration Account");

  const agreement = seedAgreement({
    id,
    title: "Quarterly content retainer",
    summary:
      "Three months of editorial content production for Lumen Labs, released monthly on accepted delivery.",
    payer,
    payee,
    arbitrator,
    totalAmountBaseUnits: "4800000000",
    jurisdictionContext: "Ontario, Canada · sample agreement",
    createdAt,
    fundedAt,
    updatedAt: completedAt,
    completedAt,
    milestones: [
      {
        description: "August content package",
        acceptanceCriteria: "Eight edited articles, source notes, and image briefs.",
        amountBaseUnits: "1600000000",
        dueAt: "2026-08-31T23:59:59.000Z",
        status: "released",
        releasedAt: "2026-08-27T12:10:00.000Z",
        releasedAmountBaseUnits: "1600000000",
        evidence: evidence(
          "Demo delivery summary for the August content package.",
          EVIDENCE.retainer,
          "2026-08-25T09:00:00.000Z",
          "payee",
          payee.name,
          "lumen-content-retainer.txt",
          60,
          "/demo/lumen-content-retainer.txt",
        ),
      },
      {
        description: "September content package",
        acceptanceCriteria: "Eight edited articles, source notes, and image briefs.",
        amountBaseUnits: "1600000000",
        dueAt: "2026-09-30T23:59:59.000Z",
        status: "released",
        releasedAt: "2026-09-26T15:35:00.000Z",
        releasedAmountBaseUnits: "1600000000",
      },
      {
        description: "October content package",
        acceptanceCriteria: "Eight edited articles, source notes, and image briefs.",
        amountBaseUnits: "1600000000",
        dueAt: "2026-10-31T23:59:59.000Z",
        status: "released",
        releasedAt: completedAt,
        releasedAmountBaseUnits: "1600000000",
      },
    ],
  });

  const events = [
    event(
      "evt_content_terms",
      id,
      "terms_confirmed",
      "Parties (review)",
      "Parties approved the structured terms and SHA-256 terms hash.",
      createdAt,
      "offchain",
      { hashRef: agreement.termsHash },
    ),
    event(
      "evt_content_created",
      id,
      "agreement_created",
      payer.name,
      "Sample agreement created in the demo workspace.",
      "2026-08-01T10:08:00.000Z",
      "demo",
    ),
    event(
      "evt_content_funded",
      id,
      "funded",
      payer.name,
      "Funded the demo escrow with 4,800.00 test USDC.",
      fundedAt,
      "demo",
    ),
    event(
      "evt_content_aug",
      id,
      "milestone_approved",
      payer.name,
      "Approved August content package and released 1,600.00 test USDC.",
      "2026-08-27T12:10:00.000Z",
      "demo",
    ),
    event(
      "evt_content_sep",
      id,
      "milestone_approved",
      payer.name,
      "Approved September content package and released 1,600.00 test USDC.",
      "2026-09-26T15:35:00.000Z",
      "demo",
    ),
    event(
      "evt_content_oct",
      id,
      "milestone_approved",
      payer.name,
      "Approved October content package and released 1,600.00 test USDC.",
      completedAt,
      "demo",
    ),
    event(
      "evt_content_completed",
      id,
      "agreement_completed",
      "PactRail",
      "All milestones settled. Agreement marked complete.",
      completedAt,
      "demo",
    ),
  ];

  return { agreement, events };
}

export function createDemoStore(now = DEMO_NOW): StoreState {
  const samples = [sampleOne(), sampleTwo(), sampleThree(), sampleFour()];
  void now;
  return {
    version: 1,
    mode: "demo",
    demoActor: "payer",
    agreements: samples.map((sample) => sample.agreement),
    activity: samples.flatMap((sample) => sample.events),
  };
}

export const SAMPLE_EVIDENCE = EVIDENCE;
