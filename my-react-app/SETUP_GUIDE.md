# Quick Setup Guide - CSUF Parking App

## What I've Built for You

A complete, production-ready parking availability monitoring system with:

✅ **Secure Backend** - Node.js/Express API with data scraping
✅ **AWS Aurora Database** - MySQL with proper schema and views
✅ **Interactive Map** - Mapbox GL JS with color-coded polygons
✅ **React Frontend** - Modern UI with filtering capabilities
✅ **Security First** - Rate limiting, CORS, input validation, SSL/TLS

## File Structure

```
parking-app/
├── backend/
│   ├── config/
│   │   └── database.js           # Aurora connection with SSL
│   ├── database/
│   │   └── schema.sql             # Complete database schema
│   ├── routes/
│   │   └── parking.js             # API endpoints with validation
│   ├── scripts/
│   │   └── initDatabase.js        # DB initialization script
│   ├── services/
│   │   └── scraper.js             # Secure web scraper
│   ├── server.js                  # Main Express server
│   ├── package.json               # Dependencies
│   └── .env.example               # Environment template
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ParkingMap.jsx    # Mapbox map component
│   │   │   └── ParkingMap.css    # Map styling
│   │   ├── App.jsx                # Main app component
│   │   └── App.css                # App styling
│   ├── package.json               # Dependencies
│   └── .env.example               # Environment template
├── README.md                      # Complete documentation
├── AWS_DEPLOYMENT.md              # AWS deployment guide
└── .gitignore                     # Security protection
```

## Installation (5 Minutes)

### 1. Install Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
```env
DB_HOST=your-aurora-endpoint.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=your-password
DB_NAME=parking_app
ADMIN_API_KEY=generate-with: openssl rand -hex 32
FRONTEND_URL=http://localhost:5173
```

Initialize database:
```bash
npm run init-db
npm run dev
```

### 2. Install Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env`:
```env
VITE_MAPBOX_TOKEN=pk.your-mapbox-token
VITE_API_URL=http://localhost:3001/api
```

Start frontend:
```bash
npm run dev
```

Open http://localhost:5173

## Next Steps

### 1. Get Mapbox Token (Free)
1. Sign up at https://account.mapbox.com/
2. Copy your default public token
3. Add to frontend `.env`

### 2. Setup AWS Aurora
Follow the detailed guide in `AWS_DEPLOYMENT.md`

Or for testing, use local MySQL:
```bash
# Install MySQL locally
mysql -u root -p
CREATE DATABASE parking_app;

# Update .env
DB_HOST=localhost
DB_USER=root
```

### 3. Add Parking Lot Coordinates

The database has lot names and capacities, but needs coordinates for the map.

**Option A: Use Mapbox Studio**
1. Go to https://studio.mapbox.com/
2. Create dataset
3. Draw polygons for each lot
4. Export as GeoJSON

**Option B: Use Google Maps**
1. Find coordinates for each lot
2. Update database:
```sql
UPDATE parking_lots 
SET 
  latitude = 33.8820,
  longitude = -117.8850,
  polygon_coordinates = '[
    {"lat": 33.8820, "lng": -117.8850},
    {"lat": 33.8825, "lng": -117.8850},
    {"lat": 33.8825, "lng": -117.8845},
    {"lat": 33.8820, "lng": -117.8845}
  ]'
WHERE name = 'Nutwood Structure';
```

### 4. Customize

**Change scraping interval** (default: 5 min)
`backend/server.js`:
```javascript
startScheduledScraping(10); // Every 10 minutes
```

**Change map center/zoom**
`frontend/src/components/ParkingMap.jsx`:
```javascript
center: [-117.885, 33.882], // CSUF coordinates
zoom: 15
```

**Add more permit types**
`frontend/src/App.jsx`:
```javascript
const [permitFilters, setPermitFilters] = useState({
  A: true,
  B: true,
  Student: true,
  Faculty: true,
  Staff: true  // Add new type
});
```

## API Usage Examples

```javascript
// Get all parking lots
fetch('http://localhost:3001/api/parking/lots')
  .then(r => r.json())
  .then(data => console.log(data));

// Get specific lot
fetch('http://localhost:3001/api/parking/lots/1')
  .then(r => r.json())
  .then(data => console.log(data));

// Get announcements
fetch('http://localhost:3001/api/parking/announcements')
  .then(r => r.json())
  .then(data => console.log(data));

// Manual refresh (requires API key)
fetch('http://localhost:3001/api/parking/refresh', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-admin-key'
  }
});
```

## Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate strong `ADMIN_API_KEY`
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Enable SSL/TLS for database connection
- [ ] Configure production CORS origins
- [ ] Set up SSL certificates (Let's Encrypt)
- [ ] Disable Aurora public access after setup
- [ ] Configure security groups properly
- [ ] Enable CloudWatch monitoring
- [ ] Set up automated backups
- [ ] Add `.env` to `.gitignore` (already done)
- [ ] Never commit secrets to Git

## Color Coding Guide

The map uses color to show availability:

- 🟢 **Green**: 0-50% occupied (plenty of space)
- 🟡 **Yellow**: 50-80% occupied (moderate)
- 🟠 **Orange**: 80-100% occupied (limited)
- 🔴 **Red**: Full or Closed
- ⚪ **Gray**: Filtered out

Formula: `occupancy = (total - available) / total * 100`

## Database Schema

**parking_lots**: Stores lot information
- `id`, `name`, `total_spots`
- `latitude`, `longitude`, `polygon_coordinates`
- `permit_types` (JSON array)
- `is_structure`, `has_levels`

**parking_snapshots**: Historical availability data
- `id`, `parking_lot_id`, `available_spots`
- `occupancy_percentage` (auto-calculated)
- `status`, `source_timestamp`, `scraped_at`

**service_announcements**: Service messages
- `id`, `message`, `priority`
- `start_date`, `end_date`, `is_active`

## Troubleshooting

**"Cannot connect to database"**
- Check Aurora endpoint is correct
- Verify security group allows your IP
- Test: `mysql -h endpoint -u admin -p`

**"CORS error"**
- Verify `FRONTEND_URL` in backend .env
- Check browser console for exact error

**"Map not loading"**
- Check Mapbox token is valid
- Verify token in browser network tab
- Ensure using `pk.` token (not `sk.`)

**"No parking data showing"**
- Check backend logs: `npm run dev`
- Verify database has data: `SELECT * FROM parking_snapshots;`
- Check scraper is running

## Support

Check these files for detailed info:
- `README.md` - Complete documentation
- `AWS_DEPLOYMENT.md` - Production deployment guide
- Backend code comments - Implementation details

## License

MIT License - Free to use and modify

---

**You're all set!** The scraper will automatically fetch data every 5 minutes and store it in your database. The frontend will display it on an interactive map with color-coded availability.
