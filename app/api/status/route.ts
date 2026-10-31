import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      aiConfigured: Boolean(process.env.OPENAI_API_KEY ?? process.env.PACTRAIL_AI_API_KEY),
      aiModel: process.env.PACTRAIL_AI_MODEL ?? "gpt-4o-mini",
      version: "0.1.0",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
