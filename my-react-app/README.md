# CSUF Parking Availability Web App

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- Mapbox account ([Sign up free](https://account.mapbox.com/))
- CSUF Parking and Transportation Department WEB API URL /GetAllLotCountsWithLevel

### 1. Backend Setup

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your actual values
```

**Important `.env` values:**
```env
PARKING_API_URL=CSUF Parking and Transportation API URL
FRONTEND_URL=http://localhost:5173
```
The parking API is not included to avoid accidental DOS and excessive calls. If necessary to test web app, contact Andrew Lee or the department

**Start backend:**
```bash
npm run dev  # Development with auto-reload
# or
npm start    # Do not recommend for local hosting, only for production
```

Backend runs on `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Mapbox token
```

**Important `.env` values:**
```env
VITE_MAPBOX_TOKEN=pk.your-mapbox-token-here
VITE_API_URL=http://localhost:3001/api
```

**Start frontend:**
```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

If building for production:
```bash
npm run build
```

Build will be in /dist, but note that Mapbox key will be vulnerable and should be limited to only accept from the frontend URL.