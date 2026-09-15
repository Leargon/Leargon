import { useRef, useState } from 'react';
import type { AdvisorAnswer, AdvisorPrefill, AdvisorRecommendation } from '../api/generated/model';

/**
 * State of the advisor panel inside a creation wizard: the answers (kept here so they survive wizard steps
 * being unmounted) and the latest recommendation. An allowed recommendation is handed to [apply] once per
 * distinct placement — so fields the user edits afterwards are not overwritten by re-evaluations — and
 * `null` when the answers no longer lead to an allowed recommendation. The placement itself always comes from
 * the server's prefill; the wizard only copies it into its fields.
 */
export function useAdvisorDecision(apply: (prefill: AdvisorPrefill | null) => void) {
  const [answers, setAnswers] = useState<AdvisorAnswer[]>([]);
  const [recommendation, setRecommendation] = useState<AdvisorRecommendation | null>(null);
  const applied = useRef<string | null>(null);

  const onRecommendation = (rec: AdvisorRecommendation | null) => {
    setRecommendation(rec);
    const prefill = rec?.allowed ? rec.prefill : null;
    const signature = prefill ? JSON.stringify(prefill) : null;
    if (signature === applied.current) return;
    applied.current = signature;
    apply(prefill);
  };

  const reset = () => {
    setAnswers([]);
    setRecommendation(null);
    applied.current = null;
  };

  return {
    answers,
    setAnswers,
    recommendation,
    /** The allowed recommendation's placement, or null. */
    decided: recommendation?.allowed ? recommendation.prefill : null,
    onRecommendation,
    reset,
  };
}

export type AdvisorDecision = ReturnType<typeof useAdvisorDecision>;
