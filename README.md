# Gmail Email Summarizer with ChatGPT

This application allows users to:
1. Sign in with their Google account
2. Access their Gmail emails
3. Get AI-powered summaries of their emails using ChatGPT
4. View both the original emails and their summaries

## Setup Instructions

### Prerequisites
- Node.js and npm installed
- Google Cloud Platform account
- OpenAI API key

### Google API Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Gmail API and Google OAuth2 API
4. Create OAuth credentials (OAuth client ID)
   - Application type: Web application
   - Authorized JavaScript origins: http://localhost:5173 (for development)
   - Authorized redirect URIs: http://localhost:5173 (for development)
5. Note your Client ID

### OpenAI API Setup
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Note your API key

### Application Setup
1. Clone this repository
2. Create a `.env` file in the root directory based on `.env.example`
3. Add your Google Client ID and OpenAI API key to the `.env` file
4. Install dependencies:
   ```
   npm install
   ```
5. Start the development server:
   ```
   npm run dev
   ```

## Security Notes
- This application uses `dangerouslyAllowBrowser: true` for the OpenAI client, which is not recommended for production applications
- In a production environment, API requests to OpenAI should be proxied through a backend server
- The application does not store any email data or credentials

## Features
- Google OAuth authentication
- Gmail API integration
- Email summarization with ChatGPT
- Responsive UI with Tailwind CSS
- TypeScript for type safety