// Add this at the very top of your server.js file
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5175;

// Email configuration - Use environment variables
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;

// Log the email configuration values for debugging
console.log('Email configuration:');
console.log('- EMAIL_USER:', EMAIL_USER);
console.log('- EMAIL_PASS:', EMAIL_PASS ? '[CONFIGURED]' : '[NOT CONFIGURED]');
console.log('- EMAIL_RECIPIENT:', EMAIL_RECIPIENT);

// Create nodemailer transporter with more detailed configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // use SSL
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  debug: true, // Show debug output
  logger: true // Log information about the mail
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('Transporter verification error:', error);
  } else {
    console.log('Server is ready to send emails');
    console.log('Using email account:', EMAIL_USER);
    console.log('Recipient configured as:', EMAIL_RECIPIENT);
  }
});

// CORS configuration - FIXED VERSION
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests from your frontend origin
    // In development, this is typically http://localhost:5173
    const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
    
    // During development or for requests like Beacon API that may not include origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Apply CORS options to all routes
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Improved middleware for Beacon API - FIXED VERSION
app.use((req, res, next) => {
  // The Beacon API can send data with different content types
  if (req.method === 'POST') {
    // Check for signs this is a beacon request
    const isBeacon = 
      (req.headers['sec-fetch-mode'] === 'no-cors') || 
      (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) ||
      ((req.get('User-Agent') || '').includes('Mozilla') && req.get('Origin') === null);
    
    if (isBeacon) {
      console.log('Detected potential beacon request:', req.url);
      
      // Important: Mark the request as already consumed to prevent the json middleware from trying to read it again
      req._body = true;
      
      // Collect the raw body data
      let data = '';
      req.on('data', chunk => {
        data += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          // Parse the data if possible
          if (data) {
            console.log('Received beacon data:', data.length > 200 ? data.substring(0, 200) + '...' : data); // Log first 200 chars only
            req.body = JSON.parse(data);
            console.log('Parsed beacon data:', req.body);
          } else {
            req.body = {};
          }
          
          // For beacon requests on email endpoint, immediately process them with higher priority
          if (req.url === '/api/send-tracking-data') {
            console.log('Processing high-priority email beacon request');
            req.isBeaconEmail = true;
          }
          
          next();
        } catch (e) {
          console.error('Error parsing beacon data:', e);
          // Don't fail the request if parsing fails
          req.body = {};
          next();
        }
      });
    } else {
      next();
    }
  } else {
    next();
  }
});

// Standard JSON parsing middleware - MUST come after the beacon middleware
app.use(express.json());

// Path to tracking data file
const trackingDataPath = path.join(__dirname, 'tracking_data.json');

// Simple write lock to prevent concurrent writes
let isWriting = false;
let pendingWrites = [];

// Function to execute next write operation from the queue
async function processNextWrite() {
  if (pendingWrites.length === 0 || isWriting) {
    return;
  }

  isWriting = true;
  const nextWrite = pendingWrites.shift();

  try {
    await nextWrite();
  } catch (error) {
    console.error('Error in queued write operation:', error);
  } finally {
    isWriting = false;
    // Process next write in queue if any
    processNextWrite();
  }
}

// Safely read tracking data file
async function readTrackingData() {
  try {
    // Check if file exists
    try {
      await fs.access(trackingDataPath);
    } catch (error) {
      // File doesn't exist, create it with empty array
      await fs.writeFile(trackingDataPath, '[]');
      console.log('Created tracking_data.json file');
      return [];
    }

    // Read and parse file
    const data = await fs.readFile(trackingDataPath, 'utf8');
    
    // Handle empty file case
    if (!data.trim()) {
      return [];
    }
    
    try {
      return JSON.parse(data);
    } catch (parseError) {
      console.error('Error parsing tracking data JSON:', parseError);

      // Backup corrupt file
      const backupPath = `${trackingDataPath}.backup-${Date.now()}`;
      await fs.copyFile(trackingDataPath, backupPath);
      console.log(`Backed up corrupt file to ${backupPath}`);
      
      // Try to recover data from corrupt JSON instead of starting with empty array
      let recoveredData = [];
      try {
        // Attempt to recover valid data by finding the most complete valid JSON in the file
        // This handles cases where the file was cut off during write or has trailing content
        if (data.startsWith('[') && data.includes('}]')) {
          // Find the last valid closing array bracket
          const lastValidPos = data.lastIndexOf('}]') + 2;
          const possiblyValidJson = data.substring(0, lastValidPos);

          try {
            recoveredData = JSON.parse(possiblyValidJson);
            console.log(`Recovered ${recoveredData.length} tracking entries from corrupt file`);
          } catch (e) {
            // Still couldn't parse, try more aggressive recovery by parsing entries individually
            const matches = data.match(/\{.*?\}/g);
            if (matches) {
              for (const match of matches) {
                try {
                  // Try to parse each entry and add valid ones
                  const entry = JSON.parse(match);
                  if (entry && typeof entry === 'object') {
                    recoveredData.push(entry);
                  }
                } catch (e) {
                  // Skip invalid entries
                }
              }
              console.log(`Recovered ${recoveredData.length} individual tracking entries`);
            }
          }
        }
      } catch (recoveryError) {
        console.error('Failed to recover data from corrupt file:', recoveryError);
      }

      // Write recovered data back to the file
      if (recoveredData.length > 0) {
        await fs.writeFile(trackingDataPath, JSON.stringify(recoveredData, null, 2));
        return recoveredData;
      } else {
        // Only create empty file if recovery completely failed
        await fs.writeFile(trackingDataPath, '[]');
        return [];
      }
    }
  } catch (error) {
    console.error('Error reading tracking data:', error);
    return [];
  }
}

// Safely write tracking data with lock mechanism
async function writeTrackingData(data) {
  return new Promise((resolve, reject) => {
    // Add this write operation to the queue
    pendingWrites.push(async () => {
      try {
        // Make sure data is an array
        const trackingArray = Array.isArray(data) ? data : [];

        // Write data to file
        await fs.writeFile(
          trackingDataPath,
          JSON.stringify(trackingArray, null, 2)
        );

        resolve(true);
      } catch (error) {
        console.error('Error writing tracking data:', error);
        reject(error);
      }
    });
    
    // Try to process the queue
    processNextWrite();
  });
}

// Updated endpoint for tracking events
app.post('/api/track/:eventType', async (req, res) => {
  try {
    const { eventType } = req.params;
    const { data } = req.body;
    
    console.log(`Received ${eventType} tracking event`);
    
    // Read existing tracking data
    const trackingData = await readTrackingData();
    
    // Add new event with more metadata
    trackingData.push({
      type: eventType,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      data: data || {}
    });
    
    // Write updated data back to file
    await writeTrackingData(trackingData);
    
    // Since this might be a beacon request that doesn't care about the response,
    // respond as quickly as possible
    res.status(200).send();
  } catch (error) {
    console.error(`Error tracking ${req.params.eventType}:`, error);
    res.status(500).json({ error: `Failed to track ${req.params.eventType}` });
  }
});

// Helper function to process email sending (used by both normal and beacon paths)
async function processEmailSending(userEmail, reason) {
  // Read tracking data
  const trackingData = await readTrackingData();
  
  if (trackingData.length === 0) {
    console.log('No tracking data to send');
    return { success: true, message: 'No tracking data to send' };
  }
  
  console.log(`Sending tracking data email with ${trackingData.length} events`);
  
  // Prepare email content
  const subject = `Tracking Data Report - ${reason || 'User Action'} - ${new Date().toISOString()}`;
  
  // Create a summary of the tracking data
  const eventsCount = trackingData.length;
  const eventTypes = {};
  trackingData.forEach(event => {
    eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
  });
  
  // Get the last 10 events for a preview
  const recentEvents = trackingData.slice(-10);
  
  // Format the email content
  const htmlContent = `
    <h2>Tracking Data Report</h2>
    <p><strong>Reason:</strong> ${reason || 'User Action'}</p>
    <p><strong>User:</strong> ${userEmail || 'Unknown'}</p>
    <p><strong>Date:</strong> ${new Date().toISOString()}</p>
    <p><strong>Total Events:</strong> ${eventsCount}</p>
    
    <h3>Event Types Summary:</h3>
    <ul>
      ${Object.entries(eventTypes).map(([type, count]) => 
        `<li>${type}: ${count} events</li>`
      ).join('')}
    </ul>
    
    <h3>Recent Events (Last 10):</h3>
    <pre>${JSON.stringify(recentEvents, null, 2)}</pre>
    
    <p>Full tracking data is attached as JSON.</p>
  `;
  
  // Log that we're attempting to send
  console.log(`Attempting to send tracking data email to ${EMAIL_RECIPIENT}`);
  console.log(`Email subject: ${subject}`);
  console.log(`Tracking data has ${eventsCount} events`);
  
  // Prepare email
  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_RECIPIENT,
    subject: subject,
    html: htmlContent,
    attachments: [
      {
        filename: 'tracking_data.json',
        content: JSON.stringify(trackingData, null, 2)
      }
    ]
  };
  
  // Send the email
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    
    // Backup the tracking data with a timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const backupPath = `${trackingDataPath}.${timestamp}`;
    await fs.copyFile(trackingDataPath, backupPath);
    
    console.log(`Tracking data sent via email and backed up to ${backupPath}`);
    
    return { success: true, eventsCount, messageId: info.messageId };
  } catch (emailError) {
    console.error('Failed to send email:', emailError);
    throw emailError;
  }
}

// Improved email sending endpoint with beacon support
app.post('/api/send-tracking-data', async (req, res) => {
  try {
    const { userEmail, reason } = req.body;
    console.log(`Received request to send tracking data for ${userEmail} with reason: ${reason}`);
    console.log(`Is beacon request: ${req.isBeaconEmail ? 'Yes' : 'No'}`);
    
    // For beacon requests, respond immediately to avoid browser timeout
    if (req.isBeaconEmail) {
      res.status(202).send(); // Accepted status, tells browser the request was received
      
      // Then process the email sending asynchronously
      processEmailSending(userEmail, reason).catch(err => {
        console.error('Background email sending failed:', err);
      });
    } else {
      // For regular requests, process normally
      try {
        const result = await processEmailSending(userEmail, reason);
        res.status(200).json({ 
          success: true, 
          message: 'Tracking data sent via email',
          eventsCount: result.eventsCount
        });
      } catch (error) {
        console.error('Failed to send email:', error);
        res.status(500).json({
          error: 'Failed to send tracking data email',
          details: error.message
        });
      }
    }
  } catch (error) {
    console.error('Error in send-tracking-data endpoint:', error);
    // Only send error response if it's not a beacon request (which already received a response)
    if (!req.isBeaconEmail) {
      res.status(500).json({ 
        error: 'Failed to process tracking data request',
        details: error.message 
      });
    }
  }
});

// New endpoint to clear tracking data after sending
app.post('/api/clear-tracking-data', async (req, res) => {
  try {
    // Check if it's a beacon request
    const isBeacon = req.isBeaconEmail || false;
    
    // Write empty array to file
    await writeTrackingData([]);
    
    // For beacon requests, respond immediately
    if (isBeacon) {
      res.status(202).send();
    } else {
      res.status(200).json({ 
        success: true, 
        message: 'Tracking data cleared' 
      });
    }
  } catch (error) {
    console.error('Error clearing tracking data:', error);
    
    // Only send error response if it's not a beacon request
    if (!req.isBeaconEmail) {
      res.status(500).json({ 
        error: 'Failed to clear tracking data',
        details: error.message 
      });
    }
  }
});

// Endpoint to check email configuration
app.get('/api/check-email-config', (req, res) => {
  const isConfigured = EMAIL_USER && 
                      EMAIL_PASS && 
                      EMAIL_RECIPIENT;
  
  res.status(200).json({
    configured: isConfigured,
    user: Boolean(EMAIL_USER),
    recipient: Boolean(EMAIL_RECIPIENT),
    // Don't return the password status for security reasons
  });
});

// Test endpoint to send a simple email
app.get('/api/test-email', async (req, res) => {
  try {
    // Prepare a simple test email
    const mailOptions = {
      from: EMAIL_USER,
      to: EMAIL_RECIPIENT,
      subject: 'Email Test for Gmail Summarizer',
      html: `
        <h2>This is a test email</h2>
        <p>If you're receiving this email, the email functionality is working correctly.</p>
        <p>Current configuration:</p>
        <ul>
          <li>Sender: ${EMAIL_USER}</li>
          <li>Recipient: ${EMAIL_RECIPIENT}</li>
          <li>Server time: ${new Date().toISOString()}</li>
        </ul>
      `
    };
    
    // Log that we're attempting to send
    console.log(`Attempting to send test email from ${EMAIL_USER} to ${EMAIL_RECIPIENT}`);
    
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    
    // Log the result
    console.log('Test email sent successfully');
    console.log('Message ID:', info.messageId);
    
    res.status(200).json({ 
      success: true, 
      message: 'Test email sent',
      details: {
        messageId: info.messageId,
        response: info.response
      }
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error.message,
      stack: error.stack
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  
  // Log email configuration status
  const isEmailConfigured = EMAIL_USER && EMAIL_PASS && EMAIL_RECIPIENT;
  
  if (isEmailConfigured) {
    console.log('Email functionality is configured and enabled');
  } else {
    console.warn('Email functionality is NOT properly configured. Please check your .env file and ensure EMAIL_USER, EMAIL_PASS, and EMAIL_RECIPIENT are set.');
  }
});