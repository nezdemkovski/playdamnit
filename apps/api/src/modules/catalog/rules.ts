import { ENDED_STATUSES, GRADABLE_STATUSES } from "@/modules/userGame/rules";
import { textLimits } from "@/utils/limits";

/** The first year the charts' year picker offers; the last is next year (announced games) */
export const CHART_FIRST_YEAR = 1980;

/**
 * The rules clients would otherwise copy, served with the catalog lookups: which statuses take
 * a grade or keep an end date, the charts' year range and the text limits the API validates.
 */
export const catalogRules = (now = new Date()) => ({
  gradableStatuses: GRADABLE_STATUSES,
  endedStatuses: ENDED_STATUSES,
  chartYears: { from: CHART_FIRST_YEAR, to: now.getUTCFullYear() + 1 },
  limits: textLimits(),
});
