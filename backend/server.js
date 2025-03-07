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