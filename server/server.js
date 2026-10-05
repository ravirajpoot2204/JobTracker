require('dotenv').config();

// ---- Global safety net (prevents Gmail errors from killing the server) ----
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err.message);
});

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const jobRoutes = require('./routes/jobRoutes');
const coverLetterRoutes = require('./routes/coverLetterRoutes');
const resumeRoutes = require('./routes/resumeRoutes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://job-tracker-mytube.vercel.app',
  'https://jobtrackerrs.netlify.app',
  
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    console.warn('⚠️ CORS blocked:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'JobTracker API running' });
});

// Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/cover-letter', coverLetterRoutes);
app.use('/api/resume', resumeRoutes);
const cron = require('node-cron');
const { checkForApplicationEmails } = require('./services/emailWatcher');

cron.schedule('*/10 * * * *', async () => {
  console.log('Running email check...');
  try {
    await checkForApplicationEmails();
  } catch (err) {
    console.error('❌ Cron email check failed:', err.message);
  }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));