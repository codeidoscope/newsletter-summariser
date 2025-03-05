import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5175;

// Middleware
app.use(cors());
app.use(express.json());

// Path to tracking data file
const trackingDataPath = path.join(__dirname, 'tracking_data.json');

// Initialize tracking_data.json if it doesn't exist
async function initTrackingFile() {
  try {
    await fs.access(trackingDataPath);
  } catch (error) {
    // File doesn't exist, create it with empty array
    await fs.writeFile(trackingDataPath, JSON.stringify([]));
    console.log('Created tracking_data.json file');
  }
}

// API endpoints
app.post('/api/track/login', async (req, res) => {
  try {
    const { email, name, timestamp } = req.body;
    
    if (!email || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Read existing tracking data
    const data = await fs.readFile(trackingDataPath, 'utf8');
    const trackingData = JSON.parse(data || '[]');
    
    // Add new login event
    trackingData.push({
      email,
      name,
      event: 'login',
      timestamp,
      ip: req.ip || req.connection.remoteAddress
    });
    
    // Write updated data back to file
    await fs.writeFile(trackingDataPath, JSON.stringify(trackingData, null, 2));
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking login:', error);
    res.status(500).json({ error: 'Failed to track login' });
  }
});

// Initialize and start the server
initTrackingFile().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});