const { generateTailoredCV, analyzeJobDescription } = require('../services/aiService');
const { generateResumePDF } = require('../services/pdfService');
const { sendEmailWithAttachment } = require('../services/gmailService');
const baseCV = require('../config/baseCV');

const safe = (s) => (s || 'Unknown').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

// Known correct links for each project (overrides whatever AI produces)
const PROJECT_LINKS = {
  'youtube clone': 'https://youtubeclonesss.netlify.app',
  'job tracker': 'https://jobtrackerrs.netlify.app/',
  'lead management': 'https://lead-manager-eta-black.vercel.app',
};

const applyProjectLinks = (cvData) => {
  if (!cvData || !Array.isArray(cvData.projects)) return cvData;
  cvData.projects = cvData.projects.map((p) => {
    const key = (p.name || '').toLowerCase();
    for (const [match, link] of Object.entries(PROJECT_LINKS)) {
      if (key.includes(match)) {
        return { ...p, link };
      }
    }
    return p;
  });
  return cvData;
};

// Normalize AI output so PDF generator always gets the right shape
const normalizeCvData = (cvData) => {
  if (!cvData || typeof cvData !== 'object') cvData = {};

  if (typeof cvData.skills === 'string') {
    cvData.skills = { 'Technical Skills': cvData.skills };
  }
  if (!cvData.skills || typeof cvData.skills !== 'object') {
    cvData.skills = {};
  }

  if (!Array.isArray(cvData.projects)) cvData.projects = [];
  if (!Array.isArray(cvData.experience)) cvData.experience = [];
  if (!Array.isArray(cvData.education)) cvData.education = [];
  if (!Array.isArray(cvData.achievements)) cvData.achievements = [];

  return cvData;
};

// Full pipeline: normalize + enforce links
const prepareCvData = (raw) => applyProjectLinks(normalizeCvData(raw));

const generateResume = async (req, res) => {
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

      extracted = Boolean(finalCompany && finalRole);
    }

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

    const rawCvData = await generateTailoredCV(baseCV, {
      company: finalCompany,
      role: finalRole,
      snippet: jobDescription,
    });

    const cvData = prepareCvData(rawCvData);

    res.json({ cvData, company: finalCompany, role: finalRole, extracted });
  } catch (err) {
    console.error('❌ resume generate error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const downloadResume = async (req, res) => {
  try {
    const { cvData, company, role } = req.body;
    if (!cvData) return res.status(400).json({ message: 'cvData required' });

    const prepared = prepareCvData(cvData);
    const pdfBuffer = await generateResumePDF(prepared);
    const filename = `Ravi_Rajpoot_Resume_${safe(company)}_${safe(role)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('❌ resume download error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const sendResume = async (req, res) => {
  try {
    const { cvData, to, company, role } = req.body;
    if (!cvData || !to) return res.status(400).json({ message: 'cvData and to required' });

    const prepared = prepareCvData(cvData);
    const pdfBuffer = await generateResumePDF(prepared);
    const filename = `Ravi_Rajpoot_Resume_${safe(company)}_${safe(role)}.pdf`;

    const result = await sendEmailWithAttachment({
      to,
      subject: `Application for ${role || 'the role'} at ${company || 'your company'}`,
      body: `Dear Hiring Team,\n\nPlease find attached my resume for the ${role || ''} position at ${company || ''}.\n\nBest regards,\nRavi Rajpoot`,
      attachments: [{ filename, content: pdfBuffer }],
    });

    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error('❌ resume send error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateResume, downloadResume, sendResume };
