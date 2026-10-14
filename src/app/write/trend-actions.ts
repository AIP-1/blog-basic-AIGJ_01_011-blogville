"use server";

import { isTrendPeriod, parseKeywords, type TrendResult } from "@/lib/keyword-trend";
import { requireMember } from "@/server/dal";
import { getKeywordTrend } from "@/server/keyword-trend";

/** 🔎 키워드 도우미: 회원만 (네이버 한 달 호출 한도를 아끼려고) */
export async function compareKeywords(raw: string[], period: string): Promise<TrendResult> {
  await requireMember();
  const keywords = parseKeywords(Array.isArray(raw) ? raw.filter((k) => typeof k === "string") : []);
  if (!keywords || !isTrendPeriod(period)) return { status: "invalid" };
  return getKeywordTrend(keywords, period);
}

