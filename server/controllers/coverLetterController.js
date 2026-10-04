const { generateCoverLetter, analyzeJobDescription } = require('../services/aiService');
const { generateCoverLetterPDF } = require('../services/pdfService');
const baseCV = require('../config/baseCV');

const generateCoverLetterText = async (req, res) => {
  try {
    const { company, role, jobDescription } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ message: 'Job description is required' });
    }

    let finalCompany = company && company.trim();
    let finalRole = role && role.trim();
    let extracted = false;

    if (!finalCompany || !finalRole) {
      const analysis = await analyzeJobDescription(jobDescription);
      const aiCompany = analysis?.company;
      const aiRole = analysis?.role;

      // Detect "not found"
      const missingCompany =
        !aiCompany ||
        aiCompany === 'Unknown' ||
        aiCompany.toLowerCase() === 'the company';

      const missingRole =
        !aiRole ||
        aiRole.toLowerCase() === 'the role' ||
        aiRole === 'Unknown';

      if (!finalCompany) finalCompany = missingCompany ? '' : aiCompany;
      if (!finalRole) finalRole = missingRole ? '' : aiRole;

      if (!finalCompany || !finalRole) extracted = false;
      else extracted = true;
    }

    // If still missing, return early and ask frontend for input
    if (!finalCompany || !finalRole) {
      return res.status(200).json({
        needsInput: true,
        missing: {
          company: !finalCompany,
          role: !finalRole,
        },
        message: 'Could not detect company or role from job description. Please enter manually.',
      });
    }

    const coverLetterData = await generateCoverLetter(baseCV, {
      company: finalCompany,
      role: finalRole,
      snippet: jobDescription,
    });

    const text = coverLetterData.coverLetterText || '';
    if (!text) return res.status(500).json({ message: 'AI failed to generate cover letter' });

    res.json({
      coverLetterText: text,
      company: finalCompany,
      role: finalRole,
      extracted,
    });
  } catch (err) {
    console.error('❌ cover letter generate error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const downloadCoverLetter = async (req, res) => {
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
    res.setHeader('Content-Disposition', `attachment; filename="Ravi_Rajpoot_CoverLetter_${(company || 'Company').replace(/[^a-z0-9]+/gi, '_')}_${(role || 'Role').replace(/[^a-z0-9]+/gi, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('❌ cover letter download error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateCoverLetterText, downloadCoverLetter };