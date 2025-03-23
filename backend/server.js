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

// Email log path for debugging
const emailLogPath = path.join(__dirname, 'email_logs.json');

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
// async function processEmailSending(userEmail, reason) {
//   // Debug log for diagnostics
//   console.log('================== PROCESS EMAIL SENDING STARTED ==================');
//   console.log(`User: ${userEmail}, Reason: ${reason}`);
//   console.log(`Timestamp: ${new Date().toISOString()}`);
  
//   // ADD THIS DEBUG SECTION AT THE BEGINNING
//   console.log('================== EMAIL CONFIG CHECK ==================');
//   console.log('EMAIL_USER:', process.env.EMAIL_USER || 'Not configured');
//   console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Is configured' : 'Not configured');
//   console.log('EMAIL_RECIPIENT:', process.env.EMAIL_RECIPIENT || 'Not configured');
    
//   if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_RECIPIENT) {
//     console.error('EMAIL CONFIGURATION ERROR: Missing required email settings');
//     return { 
//       success: false, 
//       message: 'Email configuration is incomplete. Check server logs for details.' 
//     };
//   }

//   // Read tracking data
//   console.log('Reading tracking data file...');
//   const trackingData = await readTrackingData();
//   console.log(`Loaded tracking data with ${trackingData.length} events`);
  
//   if (trackingData.length === 0) {
//     console.log('No tracking data to send');
//     return { success: true, message: 'No tracking data to send' };
//   }
  
//   console.log(`Preparing email with ${trackingData.length} events`);
  
//   // Prepare email content
//   const subject = `Tracking Data Report - ${reason || 'User Action'} - ${new Date().toISOString()}`;
  
//   // Create a summary of the tracking data
//   const eventsCount = trackingData.length;
//   const eventTypes = {};
//   trackingData.forEach(event => {
//     eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
//   });
  
//   // Get the last 10 events for a preview
//   const recentEvents = trackingData.slice(-10);
  
//   // Format the email content
//   const htmlContent = `
//     <h2>Tracking Data Report</h2>
//     <p><strong>Reason:</strong> ${reason || 'User Action'}</p>
//     <p><strong>User:</strong> ${userEmail || 'Unknown'}</p>
//     <p><strong>Date:</strong> ${new Date().toISOString()}</p>
//     <p><strong>Total Events:</strong> ${eventsCount}</p>
    
//     <h3>Event Types Summary:</h3>
//     <ul>
//       ${Object.entries(eventTypes).map(([type, count]) => 
//         `<li>${type}: ${count} events</li>`
//       ).join('')}
//     </ul>
    
//     <h3>Recent Events (Last 10):</h3>
//     <pre>${JSON.stringify(recentEvents, null, 2)}</pre>
    
//     <p>Full tracking data is attached as JSON.</p>
//   `;
  
//   // Log email preparation details
//   console.log(`================== EMAIL PREPARATION COMPLETE ==================`);
//   console.log(`Email subject: ${subject}`);
//   console.log(`Email recipient: ${EMAIL_RECIPIENT}`);
//   console.log(`Tracking data has ${eventsCount} events`);
  
//   // Prepare email
//   const mailOptions = {
//     from: EMAIL_USER,
//     to: EMAIL_RECIPIENT,
//     subject: subject,
//     html: htmlContent,
//     attachments: [
//       {
//         filename: 'tracking_data.json',
//         content: JSON.stringify(trackingData, null, 2)
//       }
//     ]
//   };
  
//   // Send the email
//   try {
//     console.log('================== ATTEMPTING TO SEND EMAIL ==================');
//     console.log(`From: ${EMAIL_USER}`);
//     console.log(`To: ${EMAIL_RECIPIENT}`);
//     console.log(`Attachment size: ${JSON.stringify(trackingData).length} bytes`);
    
//     const info = await transporter.sendMail(mailOptions);
    
//     console.log('================== EMAIL SENT SUCCESSFULLY ==================');
//     console.log('Message ID:', info.messageId);
//     console.log('Response:', info.response);
    
//     // Log to a file for debugging
//     const logEntry = {
//       timestamp: new Date().toISOString(),
//       success: true,
//       userEmail,
//       reason,
//       messageId: info.messageId,
//       eventsCount
//     };
    
//     try {
//       let logs = [];
//       try {
//         const existingLogsData = await fs.readFile(emailLogPath, 'utf8');
//         logs = JSON.parse(existingLogsData);
//       } catch (e) {
//         // File might not exist yet, that's okay
//       }
      
//       logs.push(logEntry);
//       await fs.writeFile(emailLogPath, JSON.stringify(logs, null, 2));
//       console.log('Email log entry written to:', emailLogPath);
//     } catch (logError) {
//       console.error('Error writing to email log file:', logError);
//     }
    
//     // Backup the tracking data with a timestamp
//     const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
//     const backupPath = `${trackingDataPath}.${timestamp}`;
//     await fs.copyFile(trackingDataPath, backupPath);
    
//     console.log(`================== TRACKING DATA BACKED UP ==================`);
//     console.log(`Backup path: ${backupPath}`);
//     console.log(`Tracking data sent via email and backed up to ${backupPath}`);
    
//     return { success: true, eventsCount, messageId: info.messageId };
//   } catch (emailError) {
//     console.error('================== EMAIL SENDING FAILED ==================');
//     console.error('Error details:', emailError);
//     console.error('Error message:', emailError.message);
//     console.error('Error stack:', emailError.stack);
    
//     // Check if we have specific SMTP error information
//     if (emailError.code) {
//       console.error('Error code:', emailError.code);
//     }
//     if (emailError.command) {
//       console.error('SMTP command:', emailError.command);
//     }
    
//     // Log failure to file
//     const logEntry = {
//       timestamp: new Date().toISOString(),
//       success: false,
//       userEmail,
//       reason,
//       error: emailError.message
//     };
    
//     try {
//       let logs = [];
//       try {
//         const existingLogsData = await fs.readFile(emailLogPath, 'utf8');
//         logs = JSON.parse(existingLogsData);
//       } catch (e) {
//         // File might not exist yet, that's okay
//       }
      
//       logs.push(logEntry);
//       await fs.writeFile(emailLogPath, JSON.stringify(logs, null, 2));
//       console.log('Email error log entry written to:', emailLogPath);
//     } catch (logError) {
//       console.error('Error writing error to email log file:', logError);
//     }
    
//     throw emailError;
//   }
// }

/// NEW ONE
// Helper function to process email sending with additional debugging
async function processEmailSending(userEmail, reason) {
  try {
    // Debug log for diagnostics
    console.log('================== PROCESS EMAIL SENDING STARTED ==================');
    console.log(`User: ${userEmail}, Reason: ${reason}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    
    // CRITICAL: Verify email config is present and correct
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
    
    try {
      let logs = [];
      try {
        const existingLogsData = await fs.readFile(emailLogPath, 'utf8');
        logs = JSON.parse(existingLogsData);
      } catch (e) {
        // File might not exist yet, that's okay
      }
      
      logs.push(logEntry);
      await fs.writeFile(emailLogPath, JSON.stringify(logs, null, 2));
      console.log('Email log entry written to:', emailLogPath);
    } catch (logError) {
      console.error('Error writing to email log file:', logError);
    }
    
    // Backup the tracking data with a timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const backupPath = `${trackingDataPath}.${timestamp}`;
    await fs.copyFile(trackingDataPath, backupPath);
    
    console.log(`================== TRACKING DATA BACKED UP ==================`);
    console.log(`Backup path: ${backupPath}`);
    console.log(`Tracking data sent via email and backed up to ${backupPath}`);
    
    return { success: true, eventsCount, messageId: info.messageId };
  } catch (emailError) {
    console.error('================== EMAIL SENDING FAILED ==================');
    console.error('Error details:', emailError);
    console.error('Error message:', emailError.message);
    console.error('Error stack:', emailError.stack);
    
    // Check if we have specific SMTP error information
    if (emailError.code) {
      console.error('Error code:', emailError.code);
    }
    if (emailError.command) {
      console.error('SMTP command:', emailError.command);
    }
    if (emailError.response) {
      console.error('SMTP response:', emailError.response);
    }
    
    // Log failure to file
    const logEntry = {
      timestamp: new Date().toISOString(),
      success: false,
      userEmail,
      reason,
      error: emailError.message
    };
    
    try {
      let logs = [];
      try {
        const existingLogsData = await fs.readFile(emailLogPath, 'utf8');
        logs = JSON.parse(existingLogsData);
      } catch (e) {
        // File might not exist yet, that's okay
      }
      
      logs.push(logEntry);
      await fs.writeFile(emailLogPath, JSON.stringify(logs, null, 2));
      console.log('Email error log entry written to:', emailLogPath);
    } catch (logError) {
      console.error('Error writing error to email log file:', logError);
    }
    
    throw emailError;
  }
}
/// END NEW ONE

// Improved email sending endpoint with beacon support
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

// New endpoint to clear tracking data after sending
app.post('/api/clear-tracking-data', async (req, res) => {
  try {
    console.log('Clearing tracking data');
    
    // Write empty array to file
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

// Add debug endpoint for email logs
app.get('/api/email-logs', async (req, res) => {
  try {
    let logs = [];
    try {
      const existingLogsData = await fs.readFile(emailLogPath, 'utf8');
      logs = JSON.parse(existingLogsData);
    } catch (e) {
      // File might not exist yet, that's okay
    }
    
    res.status(200).json({
      logs: logs.slice(-20) // Return only the most recent 20 logs
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve email logs',
      details: error.message
    });
  }
});

app.get('/api/test-email-settings', (req, res) => {
  const emailSettings = {
    configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_RECIPIENT),
    emailUser: process.env.EMAIL_USER || 'Not configured',
    emailRecipient: process.env.EMAIL_RECIPIENT || 'Not configured',
    emailPassConfigured: !!process.env.EMAIL_PASS,
    environment: process.env.NODE_ENV || 'development',
    serverTime: new Date().toISOString()
  };
  
  console.log('Email settings check:', emailSettings);
  
  res.status(200).json({
    success: true,
    emailSettings: {
      ...emailSettings,
      // Don't return the actual email password, even if it's masked
      emailPass: emailSettings.emailPassConfigured ? '[CONFIGURED]' : 'Not configured'
    }
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

// Add debug HTML page
app.get('/debug-email', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Debugging</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        button { padding: 10px 20px; margin: 10px 0; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; max-height: 400px; }
        .success { color: green; }
        .error { color: red; }
      </style>
    </head>
    <body>
      <h1>Email Debugging Tool</h1>
      <div>
        <h3>Email Configuration</h3>
        <p>Email User: ${EMAIL_USER || 'Not Configured'}</p>
        <p>Email Recipient: ${EMAIL_RECIPIENT || 'Not Configured'}</p>
        <p>Email Password: ${EMAIL_PASS ? 'Configured' : 'Not Configured'}</p>
      </div>
      
      <div>
        <h3>Actions</h3>
        <button id="testEmail">Send Test Email</button>
        <button id="checkLogs">Check Email Logs</button>
        <button id="simulateBeacon">Simulate Beacon Send</button>
      </div>
      
      <div id="result" style="margin-top: 20px;"></div>
      
      <script>
        document.getElementById('testEmail').addEventListener('click', async () => {
          try {
            document.getElementById('result').innerHTML = '<p>Sending test email...</p>';
            const response = await fetch('/api/test-email');
            const data = await response.json();
            document.getElementById('result').innerHTML = 
              '<h3 class="success">Test Result:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
          } catch (error) {
            document.getElementById('result').innerHTML = 
              '<h3 class="error">Error:</h3><pre>' + error.message + '</pre>';
          }
        });
        
        document.getElementById('checkLogs').addEventListener('click', async () => {
          try {
            document.getElementById('result').innerHTML = '<p>Checking email logs...</p>';
            const response = await fetch('/api/email-logs');
            const data = await response.json();
            document.getElementById('result').innerHTML = 
              '<h3>Email Logs:</h3><pre>' + JSON.stringify(data.logs, null, 2) + '</pre>';
          } catch (error) {
            document.getElementById('result').innerHTML = 
              '<h3 class="error">Error:</h3><pre>' + error.message + '</pre>';
          }
        });
        
        document.getElementById('simulateBeacon').addEventListener('click', () => {
          try {
            document.getElementById('result').innerHTML = '<p>Simulating beacon request...</p>';
            
            const data = {
              userEmail: 'test@example.com',
              reason: 'Debug Tool Beacon Test',
              timestamp: new Date().toISOString()
            };
            
            // Use Beacon API
            const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
            const result = navigator.sendBeacon('/api/send-tracking-data', blob);
            
            document.getElementById('result').innerHTML = 
              '<h3 class="' + (result ? 'success' : 'error') + '">Beacon Result:</h3>' +
              '<p>Beacon queued: ' + (result ? 'Successfully' : 'Failed') + '</p>' +
              '<p>Check the email logs after a few seconds to see if the email was sent.</p>';
          } catch (error) {
            document.getElementById('result').innerHTML = 
              '<h3 class="error">Error:</h3><pre>' + error.message + '</pre>';
          }
        });
      </script>
    </body>
    </html>
  `);
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