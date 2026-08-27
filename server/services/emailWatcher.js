// services/emailWatcher.js
const Job = require('../models/Job');
const { listMessages, getFullMessage } = require('./gmailService');
const { batchParseJobEmails, fallbackParseEmail } = require('./aiService');
const { extractEmails } = require('../utils/emailExtractor');

function detectStatus(subject, snippet) {
  const text = `${subject} ${snippet}`.toLowerCase();
  if (/rejected|regret|not moving forward|not selected|unfortunately|we will not be moving/i.test(text)) return 'rejected';
  if (/offer letter|excited to offer|pleased to offer|we are excited to offer|offer for the position/i.test(text)) return 'offer_letter_received';
  if (/technical interview|coding test|technical assessment|online assessment|hackerrank|codility|take-home/i.test(text)) return 'technical_interview';
  if (/invite you to|schedule an interview|interview availability|book a slot|interview slot|we would like to schedule|we are pleased to invite/i.test(text)) return 'interview_scheduled';
  return 'applied';
}
function isRelevantEmail(from, subject, snippet = '') {
  const lowerFrom = from.toLowerCase();
  const lowerSubject = subject.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  const combined = `${lowerSubject} ${lowerSnippet}`;

  // Skip obvious non-application emails
  if (lowerFrom.includes('ambitionbox.com')) return false;
  if (lowerFrom.includes('naukri.com') && lowerSubject.startsWith('you applied for')) return false; // Naukri daily digest
  if (lowerSubject.startsWith('ticket received')) return false;
  if (/newsletter|unsubscribe|promotion|sale|offer inside|discount|free trial/i.test(combined)) return false;

  // Strong job-related keywords (expanded)
  const jobKeywords = [
    'application', 'applied', 'applying', 'resume', 'cv', 'position', 'job', 'career',
    'opportunity', 'interview', 'offer', 'rejected', 'received', 'thank you for applying',
    'we have received', 'your application', 'candidacy', 'hiring', 'recruitment',
    'talent acquisition', 'next steps', 'action required', 'application status',
    'application update', 'unfortunately', 'we regret', 'not selected',
    'exciting opportunity', 'join our team', 'role', 'opening', 'vacancy',
    'employment', 'work with us', 'apply now', 'shortlisted', 'selected for',
    'assessment', 'online test', 'coding challenge', 'technical round',
    'your application was sent', 'your application to', 'application viewed',
    'profile shortlisted', 'application received', 'application sent',
    'job alert', 'apply to', 'hiring for', 'remote role',
  ];

  for (const keyword of jobKeywords) {
    if (combined.includes(keyword)) return true;
  }

  // If sender is from a known job platform, accept even if subject is vague
  const knownJobDomains = [
    'linkedin.com', 'indeed.com', 'greenhouse.io', 'lever.co', 'workday.com',
    'myworkday.com', 'recruiterbox.com', 'jobvite.com', 'smartrecruiters.com',
    'icims.com', 'taleo.net', 'sap.com', 'oraclecloud.com', 'zoho.com',
    'hirehive.com', 'breezy.hr', 'workable.com', 'applytojob.com', 'recruitcrm.io',
    'naukri.com', 'internshala.com', 'monster.com', 'glassdoor.com',
    'ziprecruiter.com', 'angel.co', 'wellfound.com', 'upwork.com',
    'instahyre.com', 'cutshort.io', 'hirect.com', 'tophire.co',
  ];

  for (const domain of knownJobDomains) {
    if (lowerFrom.includes(domain)) return true;
  }

  // If subject mentions a specific job title (heuristic), keep it
  const jobTitlePattern = /\b(developer|engineer|designer|manager|analyst|consultant|intern|trainee|architect|scientist|specialist|lead|senior|junior|full stack|frontend|backend|devops|data|product|project|mern|java|python|react|node|angular)\b/i;
  if (jobTitlePattern.test(lowerSubject) || jobTitlePattern.test(lowerSnippet)) return true;

  return false;
}

async function checkForApplicationEmails() {
  try {
    // Very broad query covering many possible job email subjects and senders
    const query = [
      'subject:application',
      'subject:applied',
      'subject:received',
      'subject:"thank you for applying"',
      'subject:resume',
      'subject:"your application"',
      'subject:"we have received"',
      'subject:interview',
      'subject:offer',
      'subject:rejected',
      'subject:unfortunately',
      'subject:"next steps"',
      'subject:"action required"',
      'subject:"application status"',
      'subject:shortlisted',
      'subject:selected',
      'subject:assessment',
      'subject:"coding test"',
      'subject:position',
      'subject:job',
      'subject:career',
      'subject:opportunity',
      'from:linkedin.com',
      'from:indeed.com',
      'from:greenhouse.io',
      'from:lever.co',
      'from:workday.com',
      'from:myworkday.com',
      'from:smartrecruiters.com',
      'from:recruiterbox.com',
      'from:jobvite.com',
      'from:icims.com',
      'from:taleo.net',
      'from:naukri.com',
      'from:internshala.com',
      'from:glassdoor.com',
      'from:ziprecruiter.com',
      'from:upwork.com',
      'from:wellfound.com',
    ].join(' OR ');

    const messages = await listMessages({ query, maxResults: 50 });

    const newEmails = [];
    for (const msg of messages) {
      const existing = await Job.findOne({ 'emailLog.gmailMessageId': msg.id });
      if (existing) continue;

      const details = await getFullMessage(msg.id);
      if (!isRelevantEmail(details.from, details.subject, details.body || details.snippet)) {
        console.log(`🚫 Skipping irrelevant email: ${details.subject}`);
        continue;
      }

      newEmails.push({
        id: msg.id,
        threadId: msg.threadId,
        subject: details.subject,
        from: details.from,
        snippet: details.snippet,
        body: details.body,
      });
    }

    if (newEmails.length === 0) {
      console.log('No new application emails.');
      return;
    }

    let parsedJobs = await batchParseJobEmails(newEmails);

    if (!Array.isArray(parsedJobs) || parsedJobs.length !== newEmails.length) {
      console.warn('⚠️ AI parsing failed or incomplete, using regex fallback.');
      parsedJobs = newEmails.map(email => fallbackParseEmail(email.subject, email.from, email.snippet));
    }

    for (let i = 0; i < newEmails.length; i++) {
      const email = newEmails[i];
      const parsed = parsedJobs[i] || fallbackParseEmail(email.subject, email.from, email.snippet);
      const status = detectStatus(email.subject, email.snippet);

      const emailText = `${email.from} ${email.body || email.snippet}`;
      const contactEmails = extractEmails(emailText);

      await Job.create({
        company: parsed.company,
        role: parsed.role,
        platform: parsed.platform,
        status,
        appliedDate: new Date(),
        sourceEmailId: email.id,
        contactEmails,
        emailLog: [
          {
            direction: 'inbound',
            subject: email.subject,
            from: email.from,
            gmailMessageId: email.id,
            gmailThreadId: email.threadId,
            snippet: email.snippet,
            sentAt: new Date(),
            link: `https://mail.google.com/mail/u/0/#all/${email.id}`,
          },
        ],
      });

      console.log(`✅ Created job: ${parsed.company} - ${parsed.role} (${status}) with emails: ${contactEmails.join(', ') || 'none'}`);
    }
  } catch (err) {
    console.error('❌ Email watcher error:', err.message);
  }
}

module.exports = { checkForApplicationEmails };