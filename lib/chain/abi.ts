import { parseAbi } from "viem";

export const escrowAbi = parseAbi([
  "function createAgreement(address payee, address arbitrator, address token, uint256 totalAmount, bytes32 termsHash, uint64[] dueAts, uint256[] amounts) returns (uint256 agreementId)",
  "function fundAgreement(uint256 agreementId)",
  "function submitMilestoneEvidence(uint256 agreementId, uint256 milestoneId, bytes32 evidenceHash, string evidenceUri)",
  "function approveMilestone(uint256 agreementId, uint256 milestoneId)",
  "function raiseDispute(uint256 agreementId, uint256 milestoneId, bytes32 reasonHash)",
  "function resolveDispute(uint256 agreementId, uint256 milestoneId, uint256 payeeAmount, uint256 payerRefundAmount)",
  "function getAgreement(uint256 agreementId) view returns ((address payer, address payee, address arbitrator, address token, uint256 totalAmount, bytes32 termsHash, uint64 createdAt, uint64 fundedAt, uint8 status))",
  "function getMilestone(uint256 agreementId, uint256 milestoneId) view returns ((uint256 amount, uint64 dueAt, uint8 status, bytes32 evidenceHash, string evidenceUri, uint64 submittedAt, uint64 resolvedAt, uint256 releasedAmount, uint256 refundedAmount, bytes32 disputeReasonHash))",
  "function getMilestones(uint256 agreementId) view returns ((uint256 amount, uint64 dueAt, uint8 status, bytes32 evidenceHash, string evidenceUri, uint64 submittedAt, uint64 resolvedAt, uint256 releasedAmount, uint256 refundedAmount, bytes32 disputeReasonHash)[])",
  "function milestoneCount(uint256 agreementId) view returns (uint256)",
  "function nextAgreementId() view returns (uint256)",
  "event AgreementCreated(uint256 indexed agreementId, address indexed payer, address indexed payee, address arbitrator, address token, uint256 totalAmount, bytes32 termsHash, uint256 milestoneCount)",
  "event AgreementFunded(uint256 indexed agreementId, address indexed payer, uint256 amount)",
  "event EvidenceSubmitted(uint256 indexed agreementId, uint256 indexed milestoneId, bytes32 evidenceHash, string evidenceUri, uint64 submittedAt)",
  "event MilestoneApproved(uint256 indexed agreementId, uint256 indexed milestoneId, address indexed payer, address payee, uint256 amount)",
  "event DisputeRaised(uint256 indexed agreementId, uint256 indexed milestoneId, address indexed raisedBy, bytes32 reasonHash)",
  "event DisputeResolved(uint256 indexed agreementId, uint256 indexed milestoneId, address indexed arbitrator, uint256 payeeAmount, uint256 payerRefundAmount)",
  "event RefundIssued(uint256 indexed agreementId, uint256 indexed milestoneId, address indexed payer, uint256 amount)",
  "event AgreementCompleted(uint256 indexed agreementId, uint64 completedAt)",
] as const);

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const);

export const ONCHAIN_AGREEMENT_STATUS = [
  "None",
  "Created",
  "Funded",
  "Completed",
] as const;

export const ONCHAIN_MILESTONE_STATUS = [
  "None",
  "Pending",
  "Submitted",
  "Released",
  "Disputed",
  "Resolved",
] as const;
