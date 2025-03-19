# Gmail Email Summarizer with ChatGPT

![Gmail Email Summarizer](https://img.shields.io/badge/App-Gmail%20Email%20Summarizer-blue)

This application allows you to get AI-powered summaries of your Gmail emails. It:
- Connects to your Gmail account securely through Google login
- Shows your recent emails
- Creates concise summaries of your emails using ChatGPT
- Helps identify newsletter type and unsubscribe links
- Lets you manage emails by marking them as read or deleting them

## Features

- **Sign in with Google**: Connect securely to your Gmail account
- **Email Filtering**: View all emails, unread only, today's emails, or this week's emails
- **AI Summaries**: Get concise summaries of your emails powered by ChatGPT
- **Newsletter Detection**: Automatically detects newsletter emails and finds unsubscribe links
- **Email Management**: Mark emails as read or delete them directly from the app
- **Dark Mode**: Switch between light and dark themes for comfortable viewing

## Installation Guide for Non-Technical Users

### Prerequisites

Before you begin, you need to have the following installed on your computer:

1. **Node.js**: This is the software that runs the application.
   - Download from [Node.js official website](https://nodejs.org/)
   - Choose the "LTS" (Long Term Support) version for your operating system
   - Follow the installation instructions (just click "Next" through the installer)

### Step 1: Download the Application

1. Download this application to your computer:
   - Click the green "Code" button at the top of this page
   - Select "Download ZIP"
   - Extract the ZIP file to a folder on your computer

### Step 2: Set Up the Application

1. Open the Terminal app from Applications/Utilities

2. Navigate to the application folder:
   ```
   cd path/to/extracted/folder
   ```
   Replace "path/to/extracted/folder" with the actual path where you extracted the ZIP file

3. Install dependencies:
   ```
   npm install
   ```
   This will install all the necessary components for the application.

4. Set up the backend:
   ```
   cd backend
   npm install
   cd ..
   ```
   This installs the server-side components.

## Running the Application

Once installation is complete, you can run the application:

1. From the main application folder, run:
   ```
   npm start
   ```
   or use the provided script:
   ```
   ./start.sh
   ```

2. The application will start and automatically open in your web browser
   - If it doesn't open automatically, go to `http://localhost:5173` in your browser

## How to Use the Application

### Signing In

1. When you first open the application, you'll see a login screen
2. Click "Sign in with Google"
3. Select your Google account and grant the requested permissions
   - The app needs access to your Gmail to read and modify emails
   - The app only accesses your data while you're using it and doesn't store emails on any server

### Viewing and Managing Emails

Once signed in, you'll see:

1. **Header bar**: Shows your profile picture and has buttons for dark mode and logout
2. **Filter buttons**: Choose between All, Unread, Today, or This Week emails
3. **Email list**: Shows your emails with their summaries

For each email, you can:
- Click on it to expand and view the full content
- Click "Mark as read" to mark an unread email as read
- Click "Delete email" to delete an email
- Click "View in Gmail" to open the email in your Gmail account
- Click "Unsubscribe" if available for newsletter emails

### Email Summaries

Each email will have:
- A brief AI-generated summary highlighting the important points
- For newsletters, a label indicating the type of newsletter
- When available, an unsubscribe link is extracted automatically

### Using Filters

Use the buttons at the top to filter emails:
- **All**: Shows all recent emails
- **Unread**: Shows only unread emails
- **Today**: Shows emails received today
- **This Week**: Shows emails from the last 7 days

### Refreshing Emails

Click the "Refresh" button in the top right corner to load the latest emails from your Gmail account.

## Troubleshooting

If you experience issues:

1. **Application doesn't start**:
   - Make sure Node.js is installed correctly
   - Check that you've run the installation commands correctly

2. **Can't sign in with Google**:
   - Verify your Google Client ID is correctly set in the `.env` file
   - Make sure you've set up the OAuth consent screen and credentials correctly

3. **No email summaries appear**:
   - Check that your OpenAI API key is correctly set in the `.env` file
   - Ensure your OpenAI account has available credits

4. **Permission errors**:
   - Make sure you've granted the necessary permissions during the Google sign-in process

## Security Notes

- This application uses client-side authentication with Google
- No email data is stored on any server
- Summaries are generated using the OpenAI API and are not stored
- Use `dangerouslyAllowBrowser: true` for the OpenAI client is only for demonstration
- In a production environment, API requests to OpenAI should be proxied through a backend server

## Support

If you need help, please open an issue on this GitHub repository, and we'll do our best to assist you.