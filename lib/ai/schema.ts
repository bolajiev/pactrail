import { z } from "zod";

const statusSchema = z.enum(["extracted", "inferred", "missing", "needs_review"]);

export const analysisFieldSchema = z.object({
  value: z.string().max(2000).nullable(),
  status: statusSchema,
  confidence: z.number().min(0).max(1),
  source_excerpt: z.string().max(1200).nullable(),
});

export const partyExtractionSchema = z.object({
  role: z.enum(["payer", "payee", "arbitrator"]),
  name: z.string().max(300).nullable(),
  name_status: statusSchema,
  name_confidence: z.number().min(0).max(1),
  source_excerpt: z.string().max(1200).nullable(),
  wallet: z.null(),
  wallet_status: z.literal("needs_review"),
});

export const milestoneExtractionSchema = z.object({
  description: z.string().max(500),
  amount: z.string().max(80).nullable(),
  due_date: z.string().max(80).nullable(),
  acceptance_criteria: z.string().max(1000).nullable(),
  status: statusSchema,
  confidence: z.number().min(0).max(1),
  source_excerpt: z.string().max(1200).nullable(),
});

export const agreementAnalysisSchema = z.object({
  title: analysisFieldSchema,
  scope: analysisFieldSchema,
  parties: z.array(partyExtractionSchema).max(3),
  currency: analysisFieldSchema,
  total_amount: analysisFieldSchema,
  milestones: z.array(milestoneExtractionSchema).max(32),
  jurisdiction: analysisFieldSchema,
  dispute_process: analysisFieldSchema,
  payment_terms: analysisFieldSchema,
  issues_for_human_review: z.array(z.string().max(500)).max(20),
});

export type AgreementAnalysisInput = z.infer<typeof agreementAnalysisSchema>;

export const analysisRequestSchema = z.object({
  text: z.string().min(20, "Paste more agreement text.").max(100_000, "Agreement text is too long."),
});

export const analysisResponseSchema = z.object({
  mode: z.enum(["ai", "rules-demo"]),
  analysis: agreementAnalysisSchema,
  notice: z.string(),
  model: z.string().optional(),
});
