const express = require('express');
const router = express.Router();
const {
  generateResume,
  downloadResume,
  sendResume,
} = require('../controllers/resumeController');

router.post('/generate', generateResume);
router.post('/download', downloadResume);
router.post('/send', sendResume);

module.exports = router;