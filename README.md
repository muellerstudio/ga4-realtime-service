# GA4 Realtime Service

A microservice that polls Google Analytics 4 (GA4) real-time data and exposes it via a REST API endpoint. This service is designed to provide real-time analytics data for web applications, specifically configured to work with [listical.vercel.app](https://listical.vercel.app).

## Features

- Polls GA4 real-time data every 4 minutes (to stay within quota limits)
- Exposes real-time analytics via a REST API endpoint
- Tracks multiple metrics including:
  - Active Users
  - Screen Page Views
  - Event Count
- Provides dimensional data for:
  - Unified Screen Name
  - Device Category
  - Country
  - Minutes Ago
- CORS enabled for secure access
- TypeScript implementation
- Environment variable configuration

## Prerequisites

- Node.js (>= 14.0.0)
- Google Analytics 4 Property
- Google Service Account with appropriate permissions
- `.env` file with required credentials

## Installation

1. Clone the repository:

    git clone <repository-url>
    cd ga4-realtime-service

2. Install dependencies:

    npm install

3. Create a `.env` file in the root directory using `.env.example` as a template:

    GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=your-private-key
    GA4_PROPERTY_ID=your-ga4-property-id
    PORT=3001

## Configuration

### Google Analytics Setup

1. Create a Google Analytics 4 property if you haven't already
2. Create a service account in Google Cloud Console
3. Grant appropriate permissions to the service account in GA4
4. Download the service account credentials
5. Add the required credentials to your `.env` file

### Environment Variables

- `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL`: Your Google service account email
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Your Google service account private key
- `GA4_PROPERTY_ID`: Your GA4 property ID (can be with or without 'properties/' prefix)
- `PORT`: Port number for the service (defaults to 3001)

## Usage

### Development

    npm run dev

### Production

    npm run build
    npm start

### API Endpoint

#### GET /api/realtime

Returns the latest GA4 real-time data.

Response format:

    {
      "dimensionHeaders": [...],
      "metricHeaders": [...],
      "rows": [...],
      "rowCount": number,
      "metadata": {...}
    }

## Error Handling

- The service validates required environment variables on startup
- Failed GA4 API requests are logged with error details
- Returns 503 status if data is not yet available

## Security

- CORS is configured to only allow requests from `listical.vercel.app`
- Environment variables are used for sensitive credentials
- Service account credentials are required for GA4 access

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Acknowledgments

- [@google-analytics/data](https://www.npmjs.com/package/@google-analytics/data) for GA4 API access
- [Express](https://expressjs.com/) for the web server framework
- [TypeScript](https://www.typescriptlang.org/) for type safety
