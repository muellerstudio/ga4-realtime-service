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

// Poll interval (10 seconds)
const POLL_INTERVAL_MS = 10_000;

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
    const propertyId = `properties/${GA4_PROPERTY_ID.replace('properties/', '')}`;
    console.log('Attempting to fetch data for property:', propertyId);
    
    const [response] = await analyticsDataClient.runRealtimeReport({
      property: propertyId,
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' }  // Add another common metric
      ],
      dimensions: [
        { name: 'unifiedScreenName' }  // This is more reliable than pageTitle
      ],
    });

    latestReport = response;
    console.log(`Successfully fetched GA4 realtime data at ${new Date().toISOString()}`);
  } catch (error: any) {
    console.error('Error fetching GA4 realtime data:', {
      message: error.message,
      code: error.code,
      details: error.details,
      propertyId: GA4_PROPERTY_ID
    });
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