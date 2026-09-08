// AI deep-scan: catches campaign issues the 6 fixed alert-engine rules
// don't have a rule for, by comparing each campaign's own recent metrics
// against its own trailing baseline and letting an LLM judge what's
// actually worth flagging — instead of hand-writing a new fixed rule for
// every metric now available (ROAS, quality rankings, placement, funnel
// steps). Runs once per user per day in alert-dispatch, only on campaigns
// whose numbers already moved (see DEVIATION_THRESHOLDS) — never sends the
// full raw dataset to the model, just the deltas worth explaining.
import { chatCompletion } from './openai.ts';
import { computeCtr, computeCpm, computeRoas, pctChange } from './metrics.ts';

export interface WindowAggregate {
  cost: number;
  purchaseValue: number;
  clicks: number;
  impressions: number;
  frequencySum: number;
  frequencyDays: number;
}

export interface CampaignAiCandidate {
  campaign: string;
  client: string;
  platform: string | null;
  objective: string | null;
  daysLeft: number;
  qualityRanking: string | null;
  engagementRanking: string | null;
  conversionRanking: string | null;
  recent: WindowAggregate;
  prior: WindowAggregate;
}

export interface AiFinding {
  campaign: string;
  severity: 'critical' | 'warning' | 'info';
  finding: string;
  recommendation: string;
}

const DEVIATION_THRESHOLDS = {
  roasDropPct: 25,
  ctrDropPct: 25,
  cpmIncreasePct: 25,
};

function isBelowAverage(ranking: string | null): boolean {
  return !!ranking && /below_average/i.test(ranking);
}

// Returns only the campaigns worth sending to the model, each tagged with
// *why* (the specific deltas), so the prompt stays short and grounded.
export function findDeviatingCampaigns(
  candidates: CampaignAiCandidate[],
): Array<CampaignAiCandidate & { reasons: string[] }> {
  const out: Array<CampaignAiCandidate & { reasons: string[] }> = [];
  for (const c of candidates) {
    const reasons: string[] = [];
    const rRoas = computeRoas(c.recent.cost, c.recent.purchaseValue);
    const pRoas = computeRoas(c.prior.cost, c.prior.purchaseValue);
    if (rRoas !== null && pRoas !== null && pRoas > 0) {
      const change = pctChange(rRoas, pRoas);
      if (change <= -DEVIATION_THRESHOLDS.roasDropPct) {
        reasons.push(`ROAS dropped ${Math.abs(change).toFixed(0)}% (${pRoas.toFixed(2)} → ${rRoas.toFixed(2)})`);
      }
    }
    // computeCtr/computeCpm default to 0 (not null) when impressions are 0 —
    // guard on impressions directly instead of a null sentinel (same net
    // behavior as the old local ctr()/cpm() helpers, which returned null
    // precisely when impressions <= 0).
    if (c.recent.impressions > 0 && c.prior.impressions > 0) {
      const rCtr = computeCtr(c.recent.clicks, c.recent.impressions);
      const pCtr = computeCtr(c.prior.clicks, c.prior.impressions);
      if (pCtr > 0) {
        const change = pctChange(rCtr, pCtr);
        if (change <= -DEVIATION_THRESHOLDS.ctrDropPct) {
          reasons.push(`CTR dropped ${Math.abs(change).toFixed(0)}% (${pCtr.toFixed(2)}% → ${rCtr.toFixed(2)}%)`);
        }
      }
      const rCpm = computeCpm(c.recent.cost, c.recent.impressions);
      const pCpm = computeCpm(c.prior.cost, c.prior.impressions);
      if (pCpm > 0) {
        const change = pctChange(rCpm, pCpm);
        if (change >= DEVIATION_THRESHOLDS.cpmIncreasePct) {
          reasons.push(`CPM up ${change.toFixed(0)}% ($${pCpm.toFixed(2)} → $${rCpm.toFixed(2)})`);
        }
      }
    }
    if (isBelowAverage(c.qualityRanking)) reasons.push(`Quality ranking: ${c.qualityRanking}`);
    if (isBelowAverage(c.engagementRanking)) reasons.push(`Engagement rate ranking: ${c.engagementRanking}`);
    if (isBelowAverage(c.conversionRanking)) reasons.push(`Conversion rate ranking: ${c.conversionRanking}`);

    if (reasons.length > 0) out.push({ ...c, reasons });
  }
  return out;
}

export async function generateAiInsights(
  deviating: Array<CampaignAiCandidate & { reasons: string[] }>,
): Promise<AiFinding[]> {
  if (deviating.length === 0) return [];

  const payload = deviating.slice(0, 25).map((c) => ({
    campaign: c.campaign,
    client: c.client,
    platform: c.platform,
    objective: c.objective,
    days_left: c.daysLeft,
    deviations: c.reasons,
  }));

  const result = await chatCompletion({
    model: 'gpt-4o-mini',
    maxTokens: 1200,
    temperature: 0.3,
    jsonMode: true,
    messages: [
      {
        role: 'system',
        content: 'You are a paid-media analyst reviewing campaigns whose metrics already deviated from their own ' +
          'recent baseline (the deviations are pre-computed and given to you — do not invent numbers). For each ' +
          'campaign, decide if it is worth flagging to the account manager, and if so, write one concrete finding ' +
          '(what changed and the likely cause, in plain language) and one specific recommendation (a concrete next ' +
          'action, not generic advice like "monitor closely"). Skip campaigns whose deviations are minor or expected ' +
          '(e.g., normal end-of-schedule wind-down). Severity: "critical" only for deviations threatening the ' +
          "campaign's core outcome (ROAS collapse, quality ranking failure); \"warning\" for real but recoverable " +
          'issues; "info" for a heads-up worth noting. ' +
          'Respond ONLY with a JSON object: {"findings": [{"campaign": string, "severity": "critical"|"warning"|"info", ' +
          '"finding": string, "recommendation": string}]}. Return an empty array if nothing is worth flagging.',
      },
      {
        role: 'user',
        content: JSON.stringify(payload),
      },
    ],
  });

  if (!result.ok) {
    console.error('generateAiInsights: chatCompletion failed', result.error);
    return [];
  }
  try {
    const parsed = JSON.parse(result.content);
    const findings = Array.isArray(parsed?.findings) ? parsed.findings : [];
    return findings.filter((f: any) =>
      f && typeof f.campaign === 'string' && typeof f.finding === 'string' && typeof f.recommendation === 'string' &&
      ['critical', 'warning', 'info'].includes(f.severity));
  } catch (e) {
    console.error('generateAiInsights: failed to parse model output', e, result.content.slice(0, 300));
    return [];
  }
}
