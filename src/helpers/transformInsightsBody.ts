export interface InsightResponse {
  customer_satisfaction: {
    evidence: {
      start: number;
      end: number;
      quote: string;
    };
    recommendation: {
      root_cause: string;
      action_steps: string[];
      business_impact: string;
      success_metrics: string;
      timeline: string;
    };
  };
  customer_complaints: {
    evidence: {
      start: number;
      end: number;
      quote: string;
    };
    recommendation: {
      root_cause: string;
      action_steps: string[];
      business_impact: string;
      success_metrics: string;
      timeline: string;
    };
  };
  employee_sentiment: {
    evidence: {
      start: number;
      end: number;
      quote: string;
    };
    recommendation: {
      root_cause: string;
      action_steps: string[];
      business_impact: string;
      success_metrics: string;
      timeline: string;
    };
  };
  maintenance_or_equipment_issues: {
    evidence: {
      start: number;
      end: number;
      quote: string;
    };
    recommendation: {
      root_cause: string;
      action_steps: string[];
      business_impact: string;
      success_metrics: string;
      timeline: string;
    };
  };
  product_feedback: {
    evidence: {
      start: number;
      end: number;
      quote: string;
    };
    recommendation: {
      root_cause: string;
      action_steps: string[];
      business_impact: string;
      success_metrics: string;
      timeline: string;
    };
  };
  operational_red_flags: {
    evidence: {
      start: number;
      end: number;
      quote: string;
    };
    recommendation: {
      root_cause: string;
      action_steps: string[];
      business_impact: string;
      success_metrics: string;
      timeline: string;
    };
  };
  improvement_suggestions: {
    evidence: {
      start: number;
      end: number;
      quote: string;
    };
    recommendation: {
      root_cause: string;
      action_steps: string[];
      business_impact: string;
      success_metrics: string;
      timeline: string;
    };
  };
}

const mainKeys = [
  "customer_satisfaction",
  "customer_complaints",
  "employee_sentiment",
  "maintenance_or_equipment_issues",
  "product_feedback",
  "operational_red_flags",
  "improvement_suggestions",
];

export const transformInsightsBody = (llmInsights: InsightResponse) => {
  const result: Partial<InsightResponse> = {};
  mainKeys.forEach((key) => {
    result[key as keyof InsightResponse] = {
      evidence: {
        start: 0,
        end: 0,
        quote: "",
      },
      recommendation: {
        root_cause: "",
        action_steps: [],
        business_impact: "",
        success_metrics: "",
        timeline: "",
      },
    };
  });
  Object.entries(llmInsights).forEach(([key, value]) => {
    result[key as keyof InsightResponse] = {
      evidence: {
        start: value?.evidence?.start || 0,
        end: value?.evidence?.end || 0,
        quote: value?.evidence?.quote || "",
      },
      recommendation: {
        root_cause: value?.recommendation?.root_cause || "",
        action_steps: value?.recommendation?.action_steps || [],
        business_impact: value?.recommendation?.business_impact || "",
        success_metrics: value?.recommendation?.success_metrics || "",
        timeline: value?.recommendation?.timeline || "",
      },
    };
  });
  return result;
};
