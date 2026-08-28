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

  // 1. Skip obvious non-job emails (social notifications, profile views, etc.)
  const irrelevantPatterns = [
    'people viewed your profile',
    'share their thoughts',
    'congratulate',
    'recently posted',
    'i want to connect',
    'streak freeze',
    'your posts got',
    'your profile is popular',
    'search appearances',
    'job openings in the past week',
    'video streamer job openings',
    'add ',
    'job openings',
    'your profile',
    'share their',
    'posted',
  ];

  for (const pattern of irrelevantPatterns) {
    if (lowerSubject.includes(pattern) || lowerSnippet.includes(pattern)) {
      return false;
    }
  }

  // 2. Strong job-related keywords
  const jobKeywords = [
    'application was sent',
    'application to ',
    'application viewed',
    'application received',
    'application update',
    'application status',
    'thank you for applying',
    'we have received your application',
    'your application',
    'interview invitation',
    'interview scheduled',
    'offer letter',
    'rejected',
    'not selected',
    'unfortunately',
    'action required',
    'shortlisted',
    'selected for',
    'coding test',
    'assessment',
    'technical interview',
    'full stack developer',
    'frontend developer',
    'backend developer',
    'mern stack developer',
    'java developer',
    'software developer',
    'software engineer',
    'intern',
    'trainee',
    'apprentice',
    'job alert',
    'application sent',
    'applied to',
    'application for',
    'position at',
    'role at',
    'your application was sent',
  ];

  for (const keyword of jobKeywords) {
    if (combined.includes(keyword)) return true;
  }

  // 3. If sender is from a known job platform, accept (but still skip obvious social noise)
  const knownJobDomains = [
    'linkedin.com', 'indeed.com', 'greenhouse.io', 'lever.co', 'workday.com',
    'myworkday.com', 'recruiterbox.com', 'jobvite.com', 'smartrecruiters.com',
    'icims.com', 'taleo.net', 'sap.com', 'oraclecloud.com', 'zoho.com',
    'hirehive.com', 'breezy.hr', 'workable.com', 'applytojob.com', 'recruitcrm.io',
    'naukri.com', 'internshala.com', 'monster.com', 'glassdoor.com',
    'ziprecruiter.com', 'angel.co', 'wellfound.com', 'upwork.com',
    'instahyre.com', 'cutshort.io', 'hirect.com', 'tophire.co',
  ];

  const isKnownDomain = knownJobDomains.some(domain => lowerFrom.includes(domain));
  if (isKnownDomain) {
    // Exclude LinkedIn social notifications
    if (lowerFrom.includes('linkedin.com') && /viewed your profile|share their thoughts|congratulate|recently posted|add |connect|streak freeze|your posts got|profile is popular|search appearances/.test(combined)) {
      return false;
    }
    return true;
  }

  // 4. If subject contains a job title, accept
  const jobTitlePattern = /\b(developer|engineer|designer|manager|analyst|consultant|intern|trainee|architect|scientist|specialist|lead|senior|junior|full stack|frontend|backend|devops|data|product|project|mern|java|python|react|node|angular)\b/i;
  if (jobTitlePattern.test(lowerSubject) || jobTitlePattern.test(lowerSnippet)) {
    return true;
  }

  return false;
}

async function checkForApplicationEmails() {
  try {
    // Broad query (same as before but can be extended)
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
      'from:instahyre.com',
      'from:cutshort.io',
      'from:hirect.com',
      'from:tophire.co',
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