const express = require('express');
const router = express.Router();
const { generateCoverLetter } = require('../services/aiService');
const { generateCoverLetterPDF } = require('../services/pdfService');
const baseCV = require('../config/baseCV');

router.post('/generate', async (req, res) => {
  try {
    const { company, role, jobDescription } = req.body;
    if (!company || !role || !jobDescription) {
      return res.status(400).json({ message: 'Company, role, and job description are required' });
    }

    const jobInfo = { company, role, snippet: jobDescription };
    const coverLetterData = await generateCoverLetter(baseCV, jobInfo);
    const text = coverLetterData.coverLetterText || '';
    if (!text) {
      return res.status(500).json({ message: 'AI failed to generate cover letter' });
    }
    res.json({ coverLetterText: text });
  } catch (error) {
    console.error('❌ generate cover letter error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post('/download', async (req, res) => {
  try {
    const { text, company, role, recipientName, street, city, state, zip } = req.body;
    if (!text) return res.status(400).json({ message: 'Text is required' });

    const pdfBuffer = await generateCoverLetterPDF({
      letterBody: text,
      company: company || '',
      role: role || '',
      recipientName: recipientName || 'Hiring Manager',
      street: street || '',
      city: city || '',
      state: state || '',
      zip: zip || '',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="CoverLetter.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ download cover letter error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;