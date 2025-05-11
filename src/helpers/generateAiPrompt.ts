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

## 🧠 For every accepted insight, return:

- \`category\`: One of the exact categories above  
- \`evidence\`: A **critical** object containing the **exact timestamps** from the transcript and the associated quote. This structure is essential to ensure that the **timing of the evidence** is accurately captured for context.
  - \`start\`: The **start timestamp** when the phrase begins in the format "hh:mm:ss". This timestamp is critical for identifying when the event or statement occurred.
  - \`end\`: The **end timestamp** when the phrase ends in the format "hh:mm:ss". This helps mark the duration of the statement or event.
  - \`quote\`: The **exact quote** or paraphrased phrase directly from the transcript that corresponds to the timestamps. This is the specific line of dialogue or statement from the transcript.  
- \`recommendation\`:  
  - \`root_cause\`: What's causing the issue or opportunity  
  - \`action_steps\`: Specific actions store management should take  
  - \`business_impact\`: Expected value of action  
  - \`success_metrics\`: Measurable outcomes to track success  
  - \`timeline\`: Feasible timeline to implement

---

## 📌 Transcript:
\`\`\`
${transcript}
\`\`\`

---

## 📤 Output Format (Respond **only** in this strict JSON):

\`\`\`json
  {
      "customer_satisfaction": {
        "evidence": {
          "start": "hh:mm:ss",
          "end": "hh:mm:ss", 
          "quote": "string" 
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
        "evidence": "string",
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "employee_sentiment": {
        "evidence": "string",
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "maintenance_or_equipment_issues": {
        "evidence": "string",
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "product_feedback": {
        "evidence": "string",
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "operational_red_flags": {
        "evidence": "string",
        "recommendation": {
          "root_cause": "string",
          "action_steps": ["string"],
          "business_impact": "string",
          "success_metrics": "string",
          "timeline": "string"
        }
      },
      "improvement_suggestions": {
        "evidence": "string",
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
`;
};
