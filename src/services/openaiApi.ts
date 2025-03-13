import OpenAI from 'openai';
import { Email } from '../types';

// Initialize OpenAI client
// Note: In a production app, you would store this key securely on a server
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for demo purposes
});

export const summarizeEmail = async (email: Email): Promise<{summary: string, newsletterType: string | null, unsubscribeLink: string | null}> => {
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
          content: "You will be provided with a newsletter email and your task is to summarise the email as follows:\n\n " +
                "-Under 'Overall Summary', summarize the newsletter in details. If it contains multiple sections, summarize each section separately rather than providing a single overall summary. Include key points, important details, and any action items mentioned in each section.\n\n " +
                "-What type of newsletter it is under 'Newsletter Type'\n\n" +
                "-The link to unsubscribe from the newsletter. It's a URL after some text that says unsubscribe or change email preferences. Return nothing if you can't find it"
        },
        {
          role: "user",
          content: content
        }
      ],
      temperature: 0.7,
      top_p: 1
    });

    const responseContent = response.choices[0].message.content || "No summary available";
    const { overallSummary, newsletterType, unsubscribeLink } = extractBodyDataComponents(responseContent);

    return {
      summary: overallSummary || responseContent, // Fallback to full response if parsing fails
      newsletterType,
      unsubscribeLink
    };
  } catch (error) {
    console.error('Error summarizing email with OpenAI:', error);
    return {
      summary: "Error generating summary. Please try again.",
      newsletterType: null,
      unsubscribeLink: null
    };
  }
};

const extractBodyDataComponents = (bodyData: string) => {
  const overallSummaryMatch = bodyData.match(/Overall Summary:\s*(.*?)(?=\s*Newsletter Type:)/s);
  const newsletterTypeMatch = bodyData.match(/Newsletter Type:\s*(.*?)(?=\s*Unsubscribe Link:)/s);
  const unsubscribeLinkMatch = bodyData.match(/Unsubscribe Link:\s*(https?:\/\/\S+)/);

  const overallSummary = overallSummaryMatch ? overallSummaryMatch[1].trim() : null;
  const newsletterType = newsletterTypeMatch ? newsletterTypeMatch[1].trim() : null;
  const unsubscribeLink = unsubscribeLinkMatch ? unsubscribeLinkMatch[1].trim() : null;

  return {
    overallSummary,
    newsletterType,
    unsubscribeLink
  };
};