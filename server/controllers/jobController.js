// server/controllers/jobController.js
const Job = require('../models/Job');
const { generateCoverLetter, analyzeJobDescription } = require('../services/aiService');
const { generateCoverLetterPDF } = require('../services/pdfService');
const { sendEmail } = require('../services/gmailService');
const baseCV = require('../config/baseCV');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ---------- Follow-up Email ----------
async function sendFollowUp(jobId) {
  const job = await Job.findById(jobId);
  if (!job) return { success: false, message: 'Job not found' };

  const recipients = (job.contactEmails && job.contactEmails.length > 0)
    ? job.contactEmails
    : (job.companyEmail ? [job.companyEmail] : []);

  if (recipients.length === 0) return { success: false, message: 'No contact email' };

  const subject = `Follow up on ${job.role} application at ${job.company}`;
  const body = `Dear Hiring Team,\n\nI applied for the ${job.role} position and wanted to follow up regarding my application status.\n\nBest regards,\nRavi Rajpoot`;

  try {
    const results = [];
    for (const to of recipients) {
      const result = await sendEmail({ to, subject, body });
      results.push({ ...result, to });

      job.emailLog.push({
        direction: 'outbound',
        subject,
        to,
        gmailMessageId: result.messageId,
        gmailThreadId: result.threadId,
        sentAt: new Date(),
        link: `https://mail.google.com/mail/u/0/#all/${result.messageId}`,
      });
    }

    job.lastContactDate = new Date();
    job.followUpCount = (job.followUpCount || 0) + 1;
    await job.save();

    console.log(`✅ Follow-up sent for ${job.company} - ${job.role}`);
    return { success: true, results };
  } catch (err) {
    console.error('❌ Follow-up error:', err.message);
    return { success: false, message: err.message };
  }
}

// ---------- CRUD ----------
const createJob = async (req, res) => {
  try {
    const job = await Job.create(req.body);
    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getJobs = async (req, res) => {
  try {
    const filter = {};
    if (req.query.bin === 'true') {
      filter.deleted = true;
    } else if (req.query.all === 'true') {
      // no filter
    } else {
      filter.deleted = { $ne: true };
    }

    if (req.query.status) filter.status = req.query.status;
    const sort = req.query.sort || '-appliedDate';
    const jobs = await Job.find(filter).sort(sort);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const stats = await Job.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statsObj = {};
    stats.forEach(item => {
      statsObj[item._id] = item.count;
    });

    const allStatuses = [
      'saved', 'applied', 'processing', 'interview', 'offer', 'rejected', 'no_response',
      'interview_scheduled', 'technical_interview', 'offer_letter_received', 'follow_up_sent', 'withdrawn',
    ];
    allStatuses.forEach(status => {
      if (!statsObj[status]) statsObj[status] = 0;
    });

    res.json(statsObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const binJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { deleted: true, deletedAt: new Date(), binExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      { new: true }
    );
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const restoreJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { deleted: false, deletedAt: null, binExpiresAt: null },
      { new: true }
    );
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const permanentDeleteJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json({ success: true, message: 'Job permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------- Status update (with optional follow-up) ----------
const updateJobStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Status is required' });

    const job = await Job.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!job) return res.status(404).json({ message: 'Job not found' });

    let followUpResult;
    if (status === 'no_response') {
      followUpResult = await sendFollowUp(job._id);
    }

    res.json({ job, followUpResult });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------- Cover Letter Generation ----------
const generateCoverLetterForJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const jobDescription = req.body.jobDescription || job.jobDescription || job.emailLog?.[0]?.snippet || '';
    if (!jobDescription) {
      return res.status(400).json({ message: 'Job description is required to generate a cover letter' });
    }

    job.jobDescription = jobDescription;
    await job.save();

    const jobInfo = {
      company: job.company,
      role: job.role,
      snippet: jobDescription,
    };

    const coverLetterData = await generateCoverLetter(baseCV, jobInfo);
    const text = coverLetterData.coverLetterText || '';
    if (!text) {
      return res.status(500).json({ message: 'AI failed to generate cover letter' });
    }

    job.coverLetterText = text;
    await job.save();

    res.json({
      success: true,
      coverLetterText: text,
      downloadUrl: `/api/jobs/${job._id}/cover-letter-pdf`,
    });
  } catch (error) {
    console.error('❌ generateCoverLetterForJob error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

const downloadCoverLetterPDF = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job || !job.coverLetterText) {
      return res.status(404).json({ message: 'No cover letter generated for this job' });
    }

    const pdfBuffer = await generateCoverLetterPDF(job.coverLetterText);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CoverLetter_${job.company.replace(/\s+/g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('❌ downloadCoverLetterPDF error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// ---------- Optional: Analyze Job Description (kept) ----------
const analyzeJob = async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) {
      return res.status(400).json({ message: 'Job description is required' });
    }

    const analysis = await analyzeJobDescription(description);
    if (!analysis) {
      return res.status(500).json({ message: 'AI analysis failed' });
    }

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { jdSnapshot: { description, ...analysis } },
      { new: true }
    );
    if (!job) return res.status(404).json({ message: 'Job not found' });

    res.json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
};