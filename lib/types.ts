export type WorkspaceMode = "demo" | "live";

export type ActorRole = "payer" | "payee" | "arbitrator";

export type AgreementStatus =
  | "draft"
  | "awaiting_funding"
  | "active"
  | "awaiting_approval"
  | "disputed"
  | "completed";

export type MilestoneStatus =
  | "pending"
  | "submitted"
  | "released"
  | "disputed"
  | "resolved"
  | "refunded";

export type ActivityKind =
  | "draft_saved"
  | "terms_confirmed"
  | "agreement_created"
  | "funded"
  | "evidence_submitted"
  | "milestone_approved"
  | "dispute_raised"
  | "dispute_resolved"
  | "refund_issued"
  | "agreement_completed"
  | "evidence_verified";

export type ActivityOrigin = "offchain" | "demo" | "onchain";

export interface Party {
  role: ActorRole;
  name: string;
  address: string | null;
  entityType?: string;
}

export interface EvidenceRecord {
  description: string;
  uri?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  hash: string;
  submittedAt: string;
  submittedByRole: ActorRole;
  submittedByLabel: string;
}

export interface DisputeResolution {
  payeeAmountBaseUnits: string;
  payerRefundAmountBaseUnits: string;
  note: string;
  resolvedAt: string;
  arbitratorLabel: string;
}

export interface DisputeRecord {
  raisedByRole: ActorRole;
  raisedByLabel: string;
  reason: string;
  reasonHash: string;
  raisedAt: string;
  status: "open" | "resolved";
  resolution?: DisputeResolution;
}

export interface Milestone {
  id: string;
  index: number;
  description: string;
  acceptanceCriteria: string;
  amountBaseUnits: string;
  dueAt: string;
  status: MilestoneStatus;
  submittedAt?: string;
  evidence?: EvidenceRecord;
  dispute?: DisputeRecord;
  releasedAmountBaseUnits?: string;
  refundedAmountBaseUnits?: string;
  resolvedAt?: string;
}

export interface TermsParty {
  name: string;
  address: string | null;
}

export interface ApprovedTerms {
  version: "pactrail.terms.v1";
  title: string;
  summary: string;
  parties: {
    payer: TermsParty;
    payee: TermsParty;
    arbitrator: TermsParty;
  };
  token: {
    symbol: string;
    address: string | null;
    decimals: number;
  };
  totalAmountBaseUnits: string;
  milestones: Array<{
    index: number;
    description: string;
    acceptanceCriteria: string;
    amountBaseUnits: string;
    dueAt: string;
  }>;
  jurisdictionContext: string;
  chainId: number | null;
}

export interface ChainReference {
  chainId: number;
  contractAddress: `0x${string}`;
  onchainAgreementId: number;
  createdAtTxHash?: `0x${string}`;
}

export interface Agreement {
  id: string;
  mode: WorkspaceMode;
  sample: boolean;
  title: string;
  summary: string;
  payer: Party;
  payee: Party;
  arbitrator: Party;
  token: {
    symbol: string;
    address: `0x${string}` | null;
    decimals: number;
  };
  totalAmountBaseUnits: string;
  jurisdictionContext: string;
  terms: ApprovedTerms;
  termsHash: string;
  termsApprovedAt: string;
  createdAt: string;
  updatedAt: string;
  fundedAt?: string;
  completedAt?: string;
  milestones: Milestone[];
  chain: ChainReference | null;
  sourceText?: string;
  sourceSaved: boolean;
}

export interface ActivityEvent {
  id: string;
  agreementId: string;
  mode: WorkspaceMode;
  kind: ActivityKind;
  actorRole?: ActorRole;
  actorLabel: string;
  summary: string;
  detail?: string;
  at: string;
  origin: ActivityOrigin;
  txHash?: `0x${string}`;
  chainId?: number;
  blockNumber?: string;
  hashRef?: string;
}

export interface StoreState {
  version: 1;
  mode: WorkspaceMode;
  demoActor: ActorRole;
  agreements: Agreement[];
  activity: ActivityEvent[];
}

export interface AnalysisField {
  value: string | null;
  status: "extracted" | "inferred" | "missing" | "needs_review";
  confidence: number;
  source_excerpt: string | null;
}

export interface PartyExtraction {
  role: ActorRole;
  name: string | null;
  name_status: "extracted" | "inferred" | "missing" | "needs_review";
  name_confidence: number;
  source_excerpt: string | null;
  wallet: null;
  wallet_status: "needs_review";
}

export interface MilestoneExtraction {
  description: string;
  amount: string | null;
  due_date: string | null;
  acceptance_criteria: string | null;
  status: "extracted" | "inferred" | "missing" | "needs_review";
  confidence: number;
  source_excerpt: string | null;
}

export interface AgreementAnalysis {
  title: AnalysisField;
  scope: AnalysisField;
  parties: PartyExtraction[];
  currency: AnalysisField;
  total_amount: AnalysisField;
  milestones: MilestoneExtraction[];
  jurisdiction: AnalysisField;
  dispute_process: AnalysisField;
  payment_terms: AnalysisField;
  issues_for_human_review: string[];
}

export interface AnalysisResponse {
  mode: "ai" | "rules-demo";
  analysis: AgreementAnalysis;
  notice: string;
  model?: string;
}
