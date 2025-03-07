export interface Email {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  from: string;
  date: string;
  body?: string;
  summary?: string;
  newsletterType?: string;
  unsubscribeLink?: string;
  isLoading?: boolean;
}

export interface UserProfile {
  email: string;
  name: string;
  picture: string;
}