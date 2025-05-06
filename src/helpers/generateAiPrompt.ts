export const llmPrompt = (transcript: string) => {
  return `You are an expert AI analyst. Analyze this 24-hour retail store transcript to extract REAL insights. 

## Rules:
1. Use ONLY data present in the transcript
2. Never invent examples or metrics
3. Follow this JSON format EXACTLY:

{
  "confidence": 0.92,
  "sentiment_distribution": {
    "positive": 35,
    "neutral": 50, 
    "negative": 15
  },
  "complaint_rate": 18.7,
  "complaints": [
    {"phrase": "long checkout lines", "count": 12},
    {"phrase": "missing products", "count": 7}
  ],
  "escalation_signals_rate": 8.2,
  "escalation_phrases": [
    {"phrase": "speak to manager", "count": 5}
  ],
  "top_issues": [
    {"phrase": "out of stock items", "count": 15}
  ],
  "nugget_ratio": 62.4,
  "overall_sentiment": "Neutral",
  "customer_questions_or_concerns": 42,
  "quantified_issues": [
    {"phrase": "broken freezer", "count": 3}
  ],
  "summary": "Customers expressed frustration with inventory...",
  "recommendations": [
    "Increase stock checks for top-selling items",
    "Add express checkout lanes during peak hours"
  ]
}

## Transcript Analysis:
\`\`\`
${transcript}
\`\`\`

Generate JSON analysis using the above format. Replace all example values with ACTUAL data from the transcript.`;
};