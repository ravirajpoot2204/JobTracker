require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const jobRoutes = require('./routes/jobRoutes');
const coverLetterRoutes = require('./routes/coverLetterRoutes');
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
const allowedOrigin = process.env.FRONTEND_URL || 'https://job-tracker-mytube.vercel.app';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'JobTracker API running' });
});

// Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/cover-letter', coverLetterRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));