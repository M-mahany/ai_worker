export interface InsightResponse {
  confidence: number;
  sentiment_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  complaint_rate: number;
  complaints: Array<{
    phrase: string;
    count: number;
  }>;
  escalation_signals_rate: number;
  escalation_phrases: Array<{
    phrase: string;
    count: number;
  }>;
  top_issues: Array<{
    phrase: string;
    count: number;
  }>;
  nugget_ratio: number;
  overall_sentiment: string;
  customer_questions_or_concerns: number;
  quantified_issues: Array<{
    phrase: string;
    count: number;
  }>;
  summary: string;
  recommendations: string[];
}

export const transformInsightsBody = (llmInsights: InsightResponse) => {
  return {
    confidence: llmInsights.confidence,
    sentimentDistribution: {
      positive: llmInsights?.sentiment_distribution?.positive || 0,
      neutral: llmInsights?.sentiment_distribution?.neutral || 0,
      negative: llmInsights?.sentiment_distribution?.negative || 0,
    },
    complaintRate: llmInsights?.complaint_rate || 0,
    complaints: llmInsights?.complaints || [],
    escalationSignalsRate: llmInsights?.escalation_signals_rate || 0,
    escalationPhrases: llmInsights?.escalation_phrases || [],
    topIssues: llmInsights?.top_issues || [],
    nuggetRatio: llmInsights?.nugget_ratio || 0,
    overallSentiment: llmInsights?.overall_sentiment || "",
    customerQuestionsOrConcerns:
      llmInsights?.customer_questions_or_concerns || 0,
    quantifiedIssues: llmInsights?.quantified_issues || [],
    summary: llmInsights?.summary || "",
    recommendations: llmInsights?.recommendations || [],
  };
};
