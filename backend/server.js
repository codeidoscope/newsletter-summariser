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
      // Backup corrupt file and start fresh
      const backupPath = `${trackingDataPath}.backup-${Date.now()}`;
      await fs.copyFile(trackingDataPath, backupPath);
      console.log(`Backed up corrupt file to ${backupPath}`);
      
      // Start with fresh file
      await fs.writeFile(trackingDataPath, '[]');
      return [];
    }
  } catch (error) {
    console.error('Error reading tracking data:', error);
    return [];
  }
}

// Safely write tracking data
async function writeTrackingData(data) {
  try {
    // Make sure data is an array
    const trackingArray = Array.isArray(data) ? data : [];
    await fs.writeFile(
      trackingDataPath, 
      JSON.stringify(trackingArray, null, 2)
    );
    return true;
  } catch (error) {
    console.error('Error writing tracking data:', error);
    return false;
  }
}

// Simplified tracking endpoint
app.post('/api/track/:eventType', async (req, res) => {
  try {
    const { eventType } = req.params;
    const { data } = req.body;
    
    // Read existing tracking data
    const trackingData = await readTrackingData();
    
    // Add new event (simplified structure)
    trackingData.push({
      type: eventType,
      timestamp: new Date().toISOString(),
      data: data || {}
    });
    
    // Write updated data back to file
    await writeTrackingData(trackingData);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`Error tracking ${req.params.eventType}:`, error);
    res.status(500).json({ error: `Failed to track ${req.params.eventType}` });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});