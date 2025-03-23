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
  debug: false, // Show debug output
  logger: false // Log information about the mail
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

// CORS configuration with improved handling for Beacon API
const corsOptions = {
  origin: '*', // During debugging, allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Apply CORS options to all routes
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// IMPORTANT: Apply JSON middleware first to parse standard JSON requests
app.use(express.json());

// Then add Beacon API middleware to handle special beacon requests
app.use((req, res, next) => {
  // Only apply special handling for POST requests to specific endpoints
  if (req.method === 'POST' && 
     (req.url === '/api/send-tracking-data' || req.url.endsWith('/send-tracking-data'))) {
    
    console.log('Detected potential tracking request:', req.url);
    console.log('Content-Type:', req.headers['content-type']);
    
    // Check if the body has already been parsed
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Body already parsed:', req.body);
      // The request body has already been parsed by json middleware
      next();
      return;
    }
    
    // If content-type is not application/json or body wasn't parsed, try to extract body
    let rawData = '';
    req.on('data', chunk => {
      rawData += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        if (rawData) {
          console.log('Raw data received:', rawData);
          try {
            req.body = JSON.parse(rawData);
            console.log('Parsed beacon data:', req.body);
          } catch (parseError) {
            console.error('Error parsing data:', parseError);
            req.body = {};
          }
        }
        next();
      } catch (e) {
        console.error('Error processing request data:', e);
        req.body = {};
        next();
      }
    });
  } else {
    next();
  }
});

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
    pendingWrites.push(async () => {
      try {
        const trackingArray = Array.isArray(data) ? data : [];

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
    
    processNextWrite();
  });
}

// Updated endpoint for tracking events
app.post('/api/track/:eventType', async (req, res) => {
  try {
    const { eventType } = req.params;
    const { data } = req.body;
    
    console.log(`Received ${eventType} tracking event`);
    
    const trackingData = await readTrackingData();
    trackingData.push({
      type: eventType,
      timestamp: new Date().toISOString(),
      data: data || {}
    });
    
    await writeTrackingData(trackingData);
    
    // Since this might be a beacon request that doesn't care about the response,
    // respond as quickly as possible
    res.status(200).send();
  } catch (error) {
    console.error(`Error tracking ${req.params.eventType}:`, error);
    res.status(500).json({ error: `Failed to track ${req.params.eventType}` });
  }
});

// Helper function to process email sending with additional debugging
async function processEmailSending(userEmail, reason) {
  try {
    // Debug log for diagnostics
    console.log('================== PROCESS EMAIL SENDING STARTED ==================');
    console.log(`User: ${userEmail}, Reason: ${reason}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    
    // Verify email config is present and correct
    console.log('================== EMAIL CONFIG CHECK ==================');
    console.log('EMAIL_USER:', process.env.EMAIL_USER || 'Not configured');
    console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Is configured' : 'Not configured');
    console.log('EMAIL_RECIPIENT:', process.env.EMAIL_RECIPIENT || 'Not configured');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_RECIPIENT) {
      console.error('EMAIL CONFIGURATION ERROR: Missing required email settings');
      return { 
        success: false, 
        message: 'Email configuration is incomplete. Check server logs for details.' 
      };
    }

    // Read tracking data
    console.log('Reading tracking data file...');
    const trackingData = await readTrackingData();
    console.log(`Loaded tracking data with ${trackingData.length} events`);
    
    if (trackingData.length === 0) {
      console.log('No tracking data to send');
      return { success: true, message: 'No tracking data to send' };
    }
    
    console.log(`Preparing email with ${trackingData.length} events`);
    
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
      <p><strong>User:</strong> ${process.env.EMAIL_USER}</p>
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
    
    // Log email preparation details
    console.log(`================== EMAIL PREPARATION COMPLETE ==================`);
    console.log(`Email subject: ${subject}`);
    console.log(`Email recipient: ${EMAIL_RECIPIENT}`);
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
    
    // CRITICAL: Debug the nodemailer transporter status before sending
    console.log('================== VERIFYING TRANSPORTER ==================');
    try {
      const verifyResult = await transporter.verify();
      console.log('Transporter verification result:', verifyResult);
    } catch (verifyError) {
      console.error('Transporter verification failed:', verifyError);
      throw new Error(`Email transporter verification failed: ${verifyError.message}`);
    }
    
    // Send the email with additional logging
    console.log('================== ATTEMPTING TO SEND EMAIL ==================');
    console.log(`From: ${EMAIL_USER}`);
    console.log(`To: ${EMAIL_RECIPIENT}`);
    console.log(`Attachment size: ${JSON.stringify(trackingData).length} bytes`);
    
    let info;
    try {
      console.log('Calling transporter.sendMail...');
      info = await transporter.sendMail(mailOptions);
      console.log('sendMail completed successfully');
    } catch (sendError) {
      console.error('ERROR INSIDE SENDMAIL:', sendError);
      throw sendError; // Re-throw to be caught by the outer try/catch
    }
    
    console.log('================== EMAIL SENT SUCCESSFULLY ==================');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    
    // Log to a file for debugging
    const logEntry = {
      timestamp: new Date().toISOString(),
      success: true,
      userEmail,
      reason,
      messageId: info.messageId,
      eventsCount
    };
    
    // Backup the tracking data with a timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const backupPath = `${trackingDataPath}.${timestamp}`;
    await fs.copyFile(trackingDataPath, backupPath);
    
    return { success: true, eventsCount, messageId: info.messageId };
  } catch (emailError) {
    console.error('================== EMAIL SENDING FAILED ==================');
    console.error('Error details:', emailError);
    
    throw emailError;
  }
}

// Email sending endpoint with beacon support
app.post('/api/send-tracking-data', async (req, res) => {
  try {
    console.log('============= /api/send-tracking-data RECEIVED =============');
    console.log('Headers:', req.headers);
    console.log('Request body:', req.body);
    
    // Check if the body is empty or undefined
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('Request body is empty or undefined');
      return res.status(400).json({ 
        error: 'Missing request body',
        details: 'Request body is required'
      });
    }
    
    // Check if we have the required fields
    const { userEmail, reason } = req.body;
    
    if (!userEmail) {
      console.error('Missing userEmail in request body');
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'userEmail is required'
      });
    }
    
    console.log(`Received request to send tracking data for ${userEmail} with reason: ${reason || 'No reason provided'}`);
    
    // For beacon requests, respond immediately to avoid browser timeout
    const isBeaconRequest = req.headers['content-type']?.includes('text/plain') || 
                           req.get('sec-fetch-mode') === 'no-cors';
                           
    console.log(`Is beacon request: ${isBeaconRequest ? 'Yes' : 'No'}`);
    
    if (isBeaconRequest) {
      // Send a 202 Accepted status for beacon requests
      res.status(202).send(); 
      
      // Then process the email sending asynchronously
      processEmailSending(userEmail, reason || 'Beacon Request')
        .then(result => {
          console.log('Background email processing completed successfully:', result);
        })
        .catch(err => {
          console.error('Background email sending failed:', err);
          console.error('Error details:', err.stack);
        });
    } else {
      // For regular requests, process normally and wait for the result
      try {
        console.log('Processing email synchronously...');
        const result = await processEmailSending(userEmail, reason || 'Manual Request');
        console.log('Email processing result:', result);
        
        res.status(200).json({ 
          success: true, 
          message: 'Tracking data sent via email',
          eventsCount: result.eventsCount
        });
      } catch (error) {
        console.error('Failed to send email:', error);
        console.error('Error stack:', error.stack);
        
        // Check email configuration
        console.log('Email configuration check:');
        console.log('- EMAIL_USER:', process.env.EMAIL_USER || 'Not set');
        console.log('- EMAIL_PASS:', process.env.EMAIL_PASS ? 'Is set' : 'Not set');
        console.log('- EMAIL_RECIPIENT:', process.env.EMAIL_RECIPIENT || 'Not set');
        
        res.status(500).json({
          error: 'Failed to send tracking data email',
          details: error.message
        });
      }
    }
  } catch (error) {
    console.error('Error in send-tracking-data endpoint:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Failed to process tracking data request',
      details: error.message 
    });
  }
});

// Clear tracking data after sending
app.post('/api/clear-tracking-data', async (req, res) => {
  try {
    console.log('Clearing tracking data');
    
    await writeTrackingData([]);
    
    res.status(200).json({ 
      success: true, 
      message: 'Tracking data cleared' 
    });
  } catch (error) {
    console.error('Error clearing tracking data:', error);
    res.status(500).json({ 
      error: 'Failed to clear tracking data',
      details: error.message 
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