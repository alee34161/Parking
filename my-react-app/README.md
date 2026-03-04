# CSUF Parking Availability Web App

A secure, real-time parking availability monitoring system for Cal State Fullerton, built with React, Express, and AWS Aurora.

## 🏗️ Architecture

```
┌─────────────────┐
│  React Frontend │ (Vite + Mapbox GL JS)
└────────┬────────┘
         │ HTTPS REST API
         ↓
┌─────────────────┐
│ Express Backend │ (Node.js)
└────────┬────────┘
         │ Scrapes every 5 min
         ↓
┌─────────────────┐
│  AWS Aurora DB  │ (MySQL)
└─────────────────┘
```

## 🔒 Security Features

- ✅ Backend-only scraping (hidden from users)
- ✅ CORS protection (whitelisted domains)
- ✅ Rate limiting (100 req/15min per IP)
- ✅ Helmet.js security headers
- ✅ Input validation & sanitization
- ✅ SQL injection prevention
- ✅ Environment variable protection
- ✅ SSL/TLS database connections

## 📋 Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- AWS Account with RDS Aurora MySQL cluster
- Mapbox account ([Sign up free](https://account.mapbox.com/))

## 🚀 Quick Start

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
DB_HOST=your-aurora-cluster.cluster-xxxxx.us-west-2.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=your-secure-password
DB_NAME=parking_app
ADMIN_API_KEY=generate-with-openssl-rand-hex-32
FRONTEND_URL=http://localhost:5173
```

**Initialize database:**
```bash
npm run init-db
```

**Start backend:**
```bash
npm run dev  # Development with auto-reload
# or
npm start    # Production
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

## 🗺️ Adding Parking Lot Polygons

The database is pre-populated with lot names and capacities, but you need to add coordinates for the map.

### Option 1: Using Mapbox Studio (Recommended)

1. Go to [Mapbox Studio](https://studio.mapbox.com/)
2. Create a new dataset
3. Draw polygons for each parking lot
4. Export as GeoJSON
5. Update database:

```sql
UPDATE parking_lots 
SET 
  polygon_coordinates = '[{"lat": 33.8820, "lng": -117.8850}, ...]',
  latitude = 33.8820,
  longitude = -117.8850
WHERE name = 'Nutwood Structure';
```

### Option 2: Google Earth

1. Open Google Earth
2. Draw polygons around parking lots
3. Right-click → Copy coordinates
4. Convert to JSON format and update database

### Example Polygon Format

```json
[
  {"lat": 33.8820, "lng": -117.8850},
  {"lat": 33.8825, "lng": -117.8850},
  {"lat": 33.8825, "lng": -117.8845},
  {"lat": 33.8820, "lng": -117.8845}
]
```

## 🌐 AWS Aurora Setup

### 1. Create Aurora Cluster

1. Go to AWS RDS Console
2. Click "Create database"
3. Choose:
   - Engine: Aurora MySQL
   - Version: MySQL 8.0 compatible
   - Template: Dev/Test or Production
4. Settings:
   - DB cluster identifier: `parking-app-db`
   - Master username: `admin`
   - Auto generate password or set manually
5. Instance configuration:
   - Choose instance size (db.t3.medium for dev)
6. Connectivity:
   - VPC: Default or custom
   - Public access: Yes (for development)
   - Security group: Create new allowing MySQL (3306)
7. Additional configuration:
   - Initial database name: `parking_app`

### 2. Security Group Rules

Allow inbound MySQL from:
- Your development IP
- Your backend server IP (EC2 or Lambda)

```
Type: MySQL/Aurora
Protocol: TCP
Port: 3306
Source: Your-IP/32 or Backend-Security-Group
```

### 3. Connection String

Copy the cluster endpoint from RDS console:
```
parking-app-db.cluster-xxxxx.us-west-2.rds.amazonaws.com
```

## 📊 API Endpoints

### Public Endpoints

```
GET  /api/parking/lots              - Get all lots with latest data
GET  /api/parking/lots/:id          - Get specific lot details
GET  /api/parking/lots/:id/history  - Get historical data (?hours=24)
GET  /api/parking/announcements     - Get active announcements
GET  /api/parking/stats             - Get system statistics
GET  /health                        - Health check
```

### Protected Endpoints

```
POST /api/parking/refresh           - Trigger manual scrape
Header: X-API-Key: your-admin-key
```

## 🚢 Deployment to AWS

### Option 1: EC2 + RDS Aurora

**Backend (EC2):**
```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-instance

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Clone and setup
git clone your-repo
cd backend
npm install
npm run init-db

# Use PM2 for process management
npm install -g pm2
pm2 start server.js
pm2 startup
pm2 save
```

**Frontend (S3 + CloudFront):**
```bash
# Build frontend
cd frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name

# Configure CloudFront distribution
# Point to S3 bucket, enable HTTPS
```

### Option 2: Elastic Beanstalk + RDS Aurora

```bash
# Install EB CLI
pip install awsebcli

# Initialize
cd backend
eb init -p node.js-18 parking-backend

# Create environment
eb create parking-backend-env --database.engine aurora-mysql

# Deploy
eb deploy
```

### Option 3: Lambda + API Gateway (Serverless)

Use Serverless Framework or AWS SAM for serverless deployment.

## 🔧 Configuration

### Scraping Interval

Change in `backend/server.js`:
```javascript
startScheduledScraping(5); // Every 5 minutes
```

### Rate Limiting

Adjust in `backend/server.js`:
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // requests per window
});
```

### CORS Origins

Update in `backend/server.js`:
```javascript
const corsOptions = {
  origin: ['https://yourapp.com', 'https://www.yourapp.com']
};
```

## 📱 Map Color Coding

- 🟢 **Green** (0-50% occupied): Plenty of spots
- 🟡 **Yellow** (50-80% occupied): Moderate availability
- 🟠 **Orange** (80-100% occupied): Limited spots
- 🔴 **Red** (100% or closed): Full or closed
- ⚪ **Gray**: Filtered out

## 🛠️ Troubleshooting

### Database Connection Failed

```bash
# Test connection
mysql -h your-aurora-endpoint -u admin -p

# Check security group allows your IP
# Verify SSL/TLS settings
```

### CORS Errors

- Ensure `FRONTEND_URL` in backend `.env` matches your frontend URL
- Check browser console for specific CORS error

### Map Not Loading

- Verify `VITE_MAPBOX_TOKEN` is correct
- Check browser console for Mapbox errors
- Ensure token has correct scopes

### No Data Showing

- Check backend logs: `npm run dev`
- Verify scraper is running
- Check database for records: `SELECT * FROM parking_snapshots LIMIT 10;`

## 📈 Monitoring

### Database Queries

```sql
-- Check latest data
SELECT * FROM latest_parking_availability;

-- Count snapshots per lot
SELECT pl.name, COUNT(ps.id) as snapshots
FROM parking_lots pl
LEFT JOIN parking_snapshots ps ON pl.id = ps.parking_lot_id
GROUP BY pl.name;

-- Average occupancy by hour
SELECT 
  HOUR(scraped_at) as hour,
  AVG(occupancy_percentage) as avg_occupancy
FROM parking_snapshots
WHERE scraped_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY HOUR(scraped_at)
ORDER BY hour;
```

### Backend Logs

```bash
# View PM2 logs
pm2 logs

# View last 100 lines
pm2 logs --lines 100
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file

## 🙏 Acknowledgments

- CSUF Parking Services for providing public data
- Mapbox for mapping platform
- AWS for infrastructure

---

**Security Note:** Never commit `.env` files or expose API keys. Always use environment variables for sensitive data.
