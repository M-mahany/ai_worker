export const llmPrompt = (transcript: string) => {
  return `You are an expert AI analyst assigned to extract actionable business insights from a 24-hour continuous retail store conversation transcript.

Your job is to analyze customer interactions individually and collectively, and deliver key metrics, insights, and recommended operational improvements.

---

## KPIs to Extract:

1. **Sentiment Distribution**
   - Output % of Positive, Neutral, and Negative conversation segments.

2. **Complaint Rate**
   - (Number of complaints / Total conversations) × 100%.
   - Output complaint types with their count as objects (e.g., { "phrase": string, "count": number }).

3. **Escalation Signals**
   - % of conversations with escalation phrases.
   - Output escalation phrases with their count as objects (e.g., { "phrase": string, "count": number }).

4. **Top Issues / Topics**
   - Most frequently mentioned keywords or themes.
   - Output each issue with a count (e.g., { "phrase": string, "count": number }).

5. **Nugget Ratio**
   - % of conversations containing valuable insights (complaints, requests, positive feedback).

---

## Additional Metrics:

- **Overall Sentiment**: Summarize the dominant tone across all conversations (Positive, Neutral, or Negative).
- **Customer Questions or Concerns**: Total number of questions or concerns raised by customers.
- **Quantified Issues**: List key customer concerns with text and count values.

---

## Summary:

- Output a short paragraph summarizing the overall customer experience based on the extracted data.

---

## Recommendations:

- Output 3 to 5 prioritized action items, ordered by impact or urgency.
- Focus recommendations on improvements related to staffing, customer service, product availability, facilities, or operational efficiency.

---

## NOTE:

- A "conversation" is defined as a complete customer interaction episode, not individual utterances.
- Ensure consistent formatting and strict adherence to the requested JSON structure.
- Only return the requested data, without any examples or hypothetical scenarios.

---

## Transcript for Analysis:

\`\`\`
${transcript}
\`\`\`

---

## Output Format:

Return a JSON object structured exactly like this:

\`\`\`json
{
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
