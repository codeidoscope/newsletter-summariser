import OpenAI from 'openai';
import { Email } from '../types';

// Initialize OpenAI client
// Note: In a production app, you would store this key securely on a server
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for demo purposes
});

export const summarizeEmail = async (email: Email): Promise<string> => {
  try {
    const content = `
      Subject: ${email.subject}
      From: ${email.from}
      Date: ${email.date}
      
      ${email.body || email.snippet}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that summarizes emails concisely. Focus on key points, action items, and important details. Keep summaries under 100 words."
        },
        {
          role: "user",
          content: `Please summarize this email: ${content}`
        }
      ],
      max_tokens: 150
    });

    return response.choices[0].message.content || "No summary available";
  } catch (error) {
    console.error('Error summarizing email with OpenAI:', error);
    return "Error generating summary. Please try again.";
  }
};