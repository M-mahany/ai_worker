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
7. **Improvement Suggestions**: Ideas from customers or staff

---

⚠️ **Do not** use **any other categories** or generalize insights into business concepts outside of these 7. If the insight cannot be categorized strictly into one of these, **it must be discarded**.

---


## 🧹 Ignore Segments That:
- Are empty, contain "...", or are non-informative filler speech (e.g., "uh", "you know", "like", excessive pauses)
- Contain vague or general chatter with no actionable value

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

## 📌 Transcript Format:

The transcript is a JSON array of segments with:
- \`start\`: start time in seconds (e.g., 124.5)
- \`end\`: end time in seconds
- \`text\`: verbatim spoken content

---

## 📌 Transcript:

\`\`\`json
${transcript}
\`\`\`

---

## 📤 Final Output (Respond ONLY with a SINGLE JSON object containing all valid insights grouped by category):

\`\`\`json
{
  "customer_satisfaction": { /* insight objects */ },
  "customer_complaints": { /* insight objects */ },
  "employee_sentiment": { /* insight objects */ },
  "maintenance_or_equipment": { /* insight objects */ },
  "product_feedback": { /* insight objects */ },
  "operational_red_flags": { /* insight objects */ },
  "improvement_suggestions": { /* insight objects */ }
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
- DO NOT Invent quotes or timestamps.
`;
};
