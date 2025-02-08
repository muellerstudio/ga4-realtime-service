import express, { Request, Response } from 'express';
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
  origin: 'https://listical.site'
}));

// Store latest report and total visitors in memory
let latestReport: any = null;
let totalVisitors: number = 0;
let totalVisitorsLastUpdated: Date | null = null;

// Poll every 10 seconds for realtime data
const POLL_INTERVAL_SECONDS = 10;
const POLL_INTERVAL_MS = POLL_INTERVAL_SECONDS * 1000;

// Poll every minute for total visitors
const TOTAL_VISITORS_POLL_INTERVAL = 60 * 1000; // 1 minute

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

// --- New Helper Function ---
function getFormattedPropertyId(): string {
  return GA4_PROPERTY_ID.startsWith('properties/') 
    ? GA4_PROPERTY_ID 
    : `properties/${GA4_PROPERTY_ID}`;
}

async function fetchGa4Realtime() {
  try {
    const formattedPropertyId = getFormattedPropertyId();
    
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
        { name: 'city' }
      ],
      minuteRanges: [
        {
          name: 'last_5_min',
          startMinutesAgo: 5,
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

async function fetchTotalVisitors() {
  try {
    const formattedPropertyId = getFormattedPropertyId();
    
    const [response] = await analyticsDataClient.runReport({
      property: formattedPropertyId,
      dateRanges: [
        {
          startDate: '2020-01-01',
          endDate: 'today'
        }
      ],
      metrics: [
        { name: 'totalUsers' }
      ]
    });

    if (response.rows && response.rows[0]?.metricValues?.[0]?.value) {
      totalVisitors = parseInt(response.rows[0].metricValues[0].value);
      totalVisitorsLastUpdated = new Date();
      console.log(`Successfully updated total visitors (${totalVisitors}) at ${totalVisitorsLastUpdated.toISOString()}`);
    }
  } catch (error: any) {
    console.error('Error fetching total visitors:', error);
  }
}

// Initial fetch
fetchGa4Realtime();
fetchTotalVisitors();

// Schedule polling
setInterval(fetchGa4Realtime, POLL_INTERVAL_MS);
setInterval(fetchTotalVisitors, TOTAL_VISITORS_POLL_INTERVAL);

// API endpoint
app.get('/api/realtime', (_req: Request, res: Response) => {
  if (!latestReport) {
    res.status(503).json({ error: 'Data not yet available' });
  } else {
    res.json({
      ...latestReport,
      totalVisitors,
      totalVisitorsLastUpdated
    });
  }
});

app.listen(PORT, () => {
  console.log(`GA4 Realtime Service listening on port ${PORT}`);
});