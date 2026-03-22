import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import parkingRoutes from './routes/parking.js';
import { startScheduledScraping } from './services/scraper.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// http stuff
app.use(helmet());

// cors
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Vite default port
  optionsSuccessStatus: 200,
  credentials: true
};
app.use(cors(corsOptions));

// rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// setup api and stuff
app.use('/api/parking', parkingRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// start api
app.listen(PORT, () => {
  console.log(`Port: ${PORT}`);
  
  startScheduledScraping();
});

export default app;
