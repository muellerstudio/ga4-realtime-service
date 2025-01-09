import express, { RequestHandler } from 'express';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const PORT = process.env.PORT || 3001;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ? process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.split('\\n').join('\n')
  : undefined;
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '';

// Initialize the GA4 API client
const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: {
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  },
});

const app = express();
app.use(cors({
  origin: 'https://listical.vercel.app'
}));

// Store latest report in memory
let latestReport: any = null;

// Poll every 4 minutes to stay within quota
const POLL_INTERVAL_MS = 4 * 60 * 1000;

// Add validation
if (!CLIENT_EMAIL || !PRIVATE_KEY || !GA4_PROPERTY_ID) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Add debug logging
console.log('Initializing with:', {
  clientEmail: CLIENT_EMAIL,
  propertyId: GA4_PROPERTY_ID,
  hasPrivateKey: !!PRIVATE_KEY
});

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
    console.error('Error fetching GA4 realtime data:', error);
  }
}

// Initial fetch
fetchGa4Realtime();

// Schedule polling
setInterval(fetchGa4Realtime, POLL_INTERVAL_MS);

// API endpoint
app.get('/api/realtime', (_req, res) => {
  if (!latestReport) {
    res.status(503).json({ error: 'Data not yet available' });
  } else {
    res.json(latestReport);
  }
});

app.listen(PORT, () => {
  console.log(`GA4 Realtime Service listening on port ${PORT}`);
});