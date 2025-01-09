import express, { RequestHandler } from 'express';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import dotenv from 'dotenv';

// Load environment variables from .env (if local). 
// On Render, you'll rely on Render's environment variable system instead of .env.
dotenv.config();

// These are environment variables we expect to set (either locally or on Render)
const PORT = process.env.PORT || 3001;

// Instead of using a local JSON file, we'll read the private key and client email 
// from environment variables (see instructions below).
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ? process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.split('\\n').join('\n')
  : undefined;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '';

// Initialize the GA4 API client with credentials
const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: {
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  },
});

// Add validation
if (!CLIENT_EMAIL || !PRIVATE_KEY || !GA4_PROPERTY_ID) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Express app
const app = express();

// We'll store the latest real-time data in memory
let latestReport: any = null;

// Poll interval (4 minutes)
const POLL_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

// Add this near the top for debugging
console.log('Initializing with:', {
  clientEmail: CLIENT_EMAIL,
  propertyId: GA4_PROPERTY_ID,
  // Don't log the full private key, just check if it exists
  hasPrivateKey: !!PRIVATE_KEY
});

// Function to query GA4 real-time data
async function fetchGa4Realtime() {
  try {
    const formattedPropertyId = GA4_PROPERTY_ID.startsWith('properties/') 
      ? GA4_PROPERTY_ID 
      : `properties/${GA4_PROPERTY_ID}`;
    
    const [response] = await analyticsDataClient.runRealtimeReport({
      property: formattedPropertyId,
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'eventCount' }
      ],
      dimensions: [
        { name: 'unifiedScreenName' },
        { name: 'deviceCategory' },
        { name: 'country' },
        { name: 'minutesAgo' }
      ],
      minuteRanges: [
        {
          name: 'last_30_min',
          startMinutesAgo: 29,
          endMinutesAgo: 0
        }
      ]
    });

    latestReport = response;
    console.log(`Successfully fetched GA4 realtime data at ${new Date().toISOString()}`);
  } catch (error: any) {
    if (error.code === 8) { // RESOURCE_EXHAUSTED
      console.warn('Hit GA4 quota limit, will retry next interval', {
        message: error.message,
        nextRetry: new Date(Date.now() + POLL_INTERVAL_MS).toISOString()
      });
    } else {
      console.error('Error fetching GA4 realtime data:', {
        message: error.message,
        code: error.code,
        details: error.details
      });
    }
  }
}

// Initial fetch on startup
fetchGa4Realtime();

// Schedule repeated polling
setInterval(fetchGa4Realtime, POLL_INTERVAL_MS);

// Update the endpoint with RequestHandler type
const realtimeHandler: RequestHandler = (_req, res) => {
  if (!latestReport) {
    res
      .status(503)
      .json({ error: 'Data not yet available. Please try again soon.' });
  } else {
    res.json(latestReport);
  }
};

app.get('/api/realtime', realtimeHandler);

// Start the Express server
app.listen(PORT, () => {
  console.log(`GA4 Realtime Service listening on port ${PORT}`);
});