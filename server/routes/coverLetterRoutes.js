const express = require('express');
const router = express.Router();
const {
  generateCoverLetterText,
  downloadCoverLetter,
} = require('../controllers/coverLetterController');

router.post('/generate', generateCoverLetterText);
router.post('/download', downloadCoverLetter);

module.exports = router;