import type { Lead, LeadScoreBreakdown, LeadTemperature } from "@/types";

export function temperatureFromScore(score: number): LeadTemperature {
  if (score >= 70) return "HOT";
  if (score >= 40) return "WARM";
  return "COLD";
}

export function computeLeadScore(lead: Partial<Lead> & {
  companySize?: string;
  decisionAuthority?: string;
}): LeadScoreBreakdown {
  let budgetFit = 10;
  if (lead.budgetMax && lead.budgetMax >= 10000) budgetFit = 25;
  else if (lead.budgetMax && lead.budgetMax >= 5000) budgetFit = 20;
  else if (lead.budgetMax && lead.budgetMax >= 3000) budgetFit = 15;
  else if (lead.budgetMin && lead.budgetMin >= 1000) budgetFit = 12;

  let urgency = 8;
  const timeline = (lead.timeline ?? "").toLowerCase();
  if (timeline.includes("immediately")) urgency = 20;
  else if (timeline.includes("30")) urgency = 16;
  else if (timeline.includes("3 month")) urgency = 10;

  let serviceFit = 10;
  const interest = (lead.serviceInterest ?? "").toLowerCase();
  if (interest.includes("ai") || interest.includes("automation") || interest.includes("rag")) {
    serviceFit = 18;
  } else if (interest) {
    serviceFit = 14;
  }

  let decisionAuthority = 8;
  const auth = (lead.decisionAuthority ?? "").toLowerCase();
  if (auth.includes("yes") || auth.includes("decide")) decisionAuthority = 15;
  else if (auth.includes("team")) decisionAuthority = 10;

  let companySize = 8;
  const size = lead.companySize ?? "";
  if (size.includes("500") || size.includes("201")) companySize = 12;
  else if (size.includes("51") || size.includes("11")) companySize = 10;

  let profileCompleteness = 0;
  if (lead.firstName) profileCompleteness += 2;
  if (lead.lastName) profileCompleteness += 2;
  if (lead.email) profileCompleteness += 2;
  if (lead.companyName) profileCompleteness += 2;
  if (lead.phone) profileCompleteness += 1;
  if (lead.needDescription && lead.needDescription.length > 20) profileCompleteness += 3;
  if (lead.country) profileCompleteness += 1;
  if (lead.serviceInterest) profileCompleteness += 2;
  profileCompleteness = Math.min(profileCompleteness, 15);

  const total = Math.min(
    100,
    budgetFit + urgency + serviceFit + decisionAuthority + companySize + profileCompleteness
  );

  return {
    budgetFit,
    urgency,
    serviceFit,
    decisionAuthority,
    companySize,
    profileCompleteness,
    total,
  };
}

export function parseBudgetRange(label: string): { budgetMin?: number; budgetMax?: number; estimatedValue?: number } {
  if (label.includes("More than $10,000")) return { budgetMin: 10000, budgetMax: 25000, estimatedValue: 15000 };
  if (label.includes("$5,000")) return { budgetMin: 5000, budgetMax: 10000, estimatedValue: 7500 };
  if (label.includes("$3,000")) return { budgetMin: 3000, budgetMax: 5000, estimatedValue: 4000 };
  if (label.includes("$1,000")) return { budgetMin: 1000, budgetMax: 3000, estimatedValue: 2000 };
  if (label.includes("Less than")) return { budgetMin: 0, budgetMax: 1000, estimatedValue: 800 };
  return {};
}
