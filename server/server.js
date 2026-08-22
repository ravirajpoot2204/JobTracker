require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const jobRoutes = require('./routes/jobRoutes');
const cron = require('node-cron');
const { checkForApplicationEmails } = require('./services/emailWatcher');
const app = express();
const coverLetterRoutes = require('./routes/coverLetterRoutes');
// Run every 10 minutes
// cron.schedule('*/10 * * * *', () => {
//   console.log('Running email check...');
//   checkForApplicationEmails();
// });

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'JobTracker API running' });
});

// Temporary test route – remove after confirming Gmail works
app.get('/api/test-gmail', async (req, res) => {
  try {
    const result = await require('./services/gmailService').sendEmail({
      to: process.env.GMAIL_USER_EMAIL,
      subject: 'JobTracker Test Email',
      body: 'This is a test email from your JobTracker backend.',
    });
    res.json({ success: true, result });
  } catch (error) {
    console.error('Gmail test error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Routes
app.use('/api/jobs', jobRoutes);

app.use('/api/cover-letter', coverLetterRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));