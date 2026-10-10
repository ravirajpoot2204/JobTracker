const express = require('express');
const router = express.Router();
const adminKey = require('../middleware/adminKey');
const {
  createJob,
  getJobs,
  getStats,
  binJob,
  restoreJob,
  permanentDeleteJob,
  updateJobStatus,
  sendFollowUp,
  analyzeJob,
  generateCoverLetterForJob,
  downloadCoverLetterPDF,
} = require('../controllers/jobController');
const { checkForApplicationEmails } = require('../services/emailWatcher');

// ---------- Public ----------
router.get('/', getJobs);
router.get('/stats', getStats);
router.post('/', createJob);
router.post('/check-emails', async (req, res) => {
  try {
    await checkForApplicationEmails();
    res.json({ success: true, message: 'Email check complete' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- Admin-protected ----------
// Bin
router.patch('/:id/bin', adminKey, binJob);
router.patch('/:id/restore', adminKey, restoreJob);
router.delete('/:id/permanent', adminKey, permanentDeleteJob);

// Status update (drag-and-drop on Kanban)
router.patch('/:id/status', adminKey, updateJobStatus);

// Cover letter generation and PDF
router.post('/:id/generate-cover-letter', adminKey, generateCoverLetterForJob);
router.get('/:id/cover-letter-pdf', adminKey, downloadCoverLetterPDF);

// Follow-up
router.post('/:id/follow-up', adminKey, async (req, res) => {
  try {
    const result = await sendFollowUp(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// JD analyzer
router.post('/:id/analyze-jd', adminKey, analyzeJob);

module.exports = router;