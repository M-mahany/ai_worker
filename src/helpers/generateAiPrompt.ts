export const llmPrompt = (transcript: string) => {
  return `You are an expert AI analyst. Your task is to extract real, actionable business insights from a **24-hour retail store conversation transcript**. Avoid assumptions or made-up data.

---

## 🎯 Your Objectives:

Analyze each customer **conversation** (a full interaction, not individual lines) to extract the following key performance indicators (KPIs), metrics, and insights. Focus **only on the actual transcript content**—do **not** fabricate information or add sample data.

---

## 📊 KPIs to Extract:

1. **Sentiment Distribution**
   - Return the % of Positive, Neutral, and Negative conversations.
   
2. **Complaint Rate**
   - Formula: (Number of complaint-containing conversations ÷ Total conversations) × 100%
   - Return actual complaint phrases with their counts:
     \`[{ "phrase": "example complaint", "count": 2 }]\`

3. **Escalation Signals**
   - % of conversations with escalation triggers (e.g., “speak to a manager”, “this is unacceptable”)
   - Return actual escalation phrases and counts.

4. **Top Issues / Topics**
   - Identify frequently mentioned problems or topics.
   - Return each phrase/topic with a count.

5. **Nugget Ratio**
   - % of conversations that contain actionable value (e.g., complaints, feedback, product requests)

---

## ➕ Additional Metrics:

- **Overall Sentiment**: One-word summary (Positive, Neutral, or Negative).
- **Customer Questions/Concerns**: Count total customer questions or concerns.
- **Quantified Issues**: Return major concerns with phrasing and counts.
- **Confidence Level**: Score from 0-1 rating your confidence in analysis accuracy based on:
  - Clarity of conversation content
  - Specificity of measurable indicators
  - Presence of unambiguous sentiment signals

---

## 📝 Summary:

Briefly summarize the **overall customer experience** in a paragraph, based only on the transcript.

---

## ✅ Recommendations:

Give **3 to 5 prioritized, realistic** recommendations for:
- Staffing, customer service, product availability, facilities, or operations.
- Avoid generalities. Base each recommendation strictly on the data.

---

## 🚫 Do NOT:
- Do **not** invent confidence scores - base strictly on:
  1) % of conversations with clear sentiment signals
  2) Explicit complaint/escalation phrasing
  3) Numeric data availability
- Do **not** include confidence if transcript is too vague/ambiguous
- Do **not** use confidence as average - weight by data quality
- Do **not** invent or assume examples.
- Do **not** include placeholder/sample data.
- Do **not** change the output format or add extra fields.

---

## 📌 Transcript:

\`\`\`
${transcript}
\`\`\`

---

## 📦 Output Format:

Return this JSON format EXACTLY:

\`\`\`json
{
  "confidence": number,
  "sentiment_distribution": {
    "positive": number,
    "neutral": number,
    "negative": number
  },
  "complaint_rate": number,
  "complaints": [
    {
      "phrase": "string",
      "count": number
    }
  ],
  "escalation_signals_rate": number,
  "escalation_phrases": [
    {
      "phrase": "string",
      "count": number
    }
  ],
  "top_issues": [
    {
      "phrase": "string",
      "count": number
    }
  ],
  "nugget_ratio": number,
  "overall_sentiment": "string",
  "customer_questions_or_concerns": number,
  "quantified_issues": [
    {
      "phrase": "string",
      "count": number
    }
  ],
  "summary": "string",
  "recommendations": [
    "string",
    "string",
    "string"
  ]
}
\`\`\`
`;
};
