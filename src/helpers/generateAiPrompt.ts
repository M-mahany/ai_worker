export const llmPrompt = (transcript: string) => {
  return `You are an expert operational analyst. Your task is to extract **only actionable, strategic insights** from the following transcript, categorized strictly by **the 7 predefined labels below**. You are NOT allowed to create new or modified categories.

---

## ✅ ALLOWED Categories (use **exact spelling** and casing):

1. **Customer Satisfaction**: Evidence of positive/negative experiences
2. **Customer Complaints**: Specific issues raised by customers
3. **Employee Sentiment**: Staff morale, concerns, suggestions
4. **Maintenance/Equipment**: Functionality or repair needs
5. **Product Feedback**: Comments about merchandise/selection
6. **Operational Red Flags**: Safety, compliance, or service issues

⚠️ **Do not** use **any other categories** or generalize insights into business concepts outside of these 7. If the insight cannot be categorized strictly into one of these, **it must be discarded**.

---

## 📌 Transcript Format:

The transcript is a JSON array of speech segments. Each segment contains:
- \`start\` and \`end\` fields in seconds (e.g. 7199.604). Use these **as-is**.
- \`text\`: The actual spoken quote (verbatim).
- Ignore segments where \`text\` is empty, just "...", or clearly non-informative.

---

## 🧠 For every accepted insight, return:

- \`category\`: One of the exact categories above  
- \`evidence\`:  
  - \`start\`: Value from \`start\` field (in seconds)  
  - \`end\`: Value from \`end\` field (in seconds)  
  - \`quote\`: Verbatim text from \`text\` field  
- \`recommendation\`:  
  - \`root_cause\`: What's causing the issue or opportunity  
  - \`action_steps\`: Specific actions store management should take  
  - \`business_impact\`: Expected value of action  
  - \`success_metrics\`: Measurable outcomes to track success  
  - \`timeline\`: Feasible timeline to implement

---

## 📌 Transcript:

\`\`\`json
${transcript}
\`\`\`

---

## 📤 Output Format (Respond **only** in this strict JSON):

\`\`\`json
  {
      "customer_satisfaction": {
        "evidence": {
            start: number;   // from transcript
            end: number;     // from transcript
            quote: string;   // verbatim from transcript
          },
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "customer_complaints": {
          "evidence": {
            start: number;   // from transcript
            end: number;     // from transcript
            quote: string;   // verbatim from transcript
          },
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "employee_sentiment": {
          "evidence": {
            start: number;   // from transcript
            end: number;     // from transcript
            quote: string;   // verbatim from transcript
          },
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "maintenance_or_equipment_issues": {
          "evidence": {
            start: number;   // from transcript
            end: number;     // from transcript
            quote: string;   // verbatim from transcript
          },
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "product_feedback": {
          "evidence": {
            start: number;   // from transcript
            end: number;     // from transcript
            quote: string;   // verbatim from transcript
          },
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "operational_red_flags": {
          "evidence": {
            start: number;   // from transcript
            end: number;     // from transcript
            quote: string;   // verbatim from transcript
          },
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "improvement_suggestions": {
          "evidence": {
            start: number;   // from transcript
            end: number;     // from transcript
            quote: string;   // verbatim from transcript
          },
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      }
  }
\`\`\`

If there are **no matching insights**, return:

\`\`\`json
{}
\`\`\`

---

## ❌ Strict Rules:
- DO NOT invent new categories. **Only** use the 7 listed categories.
- DO NOT summarize or generalize insights into broader topics like "Workforce Management" or "Market Research".
- DO NOT include any content outside the exact JSON block.
- DO NOT include generic strategic advice.
- **Only return insights that fit the exact, predefined categories**.
- If an insight does not fit the categories, **skip it entirely**.
- Double-check each insight for compliance **before returning**.
- DO NOT Invent quotes or timestamps  
`;
};
