const express = require('express');
const router = express.Router();
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

router.post('/', createJob);
router.post('/check-emails', async (req, res) => {
  try {
    await checkForApplicationEmails();
    res.json({ success: true, message: 'Email check complete' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', getJobs);
router.get('/stats', getStats);

// Bin
router.patch('/:id/bin', binJob);
router.patch('/:id/restore', restoreJob);
router.delete('/:id/permanent', permanentDeleteJob);

// Status update
router.patch('/:id/status', updateJobStatus);

// Cover letter
router.post('/:id/generate-cover-letter', generateCoverLetterForJob);
router.get('/:id/cover-letter-pdf', downloadCoverLetterPDF);
router.post('/download-cover-letter', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: 'Text required' });
  const pdfBuffer = await generateCoverLetterPDF(text);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="CoverLetter.pdf"');
  res.send(pdfBuffer);
});
// Follow-up
router.post('/:id/follow-up', async (req, res) => {
  try {
    const result = await sendFollowUp(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Optional: JD analyzer
router.post('/:id/analyze-jd', analyzeJob);

module.exports = router;