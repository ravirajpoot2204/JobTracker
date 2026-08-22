// services/emailWatcher.js
const Job = require('../models/Job');
const { listMessages, getFullMessage } = require('./gmailService');
const { batchParseJobEmails, fallbackParseEmail } = require('./aiService');
const { extractEmails } = require('../utils/emailExtractor');

/**
 * Determine the correct job status based on email subject/snippet.
 */
function detectStatus(subject, snippet) {
  const text = `${subject} ${snippet}`.toLowerCase();

  if (/rejected|regret|not moving forward|not selected|unfortunately|we will not be moving/i.test(text)) {
    return 'rejected';
  }
  if (/offer letter|excited to offer|pleased to offer|we are excited to offer|offer for the position/i.test(text)) {
    return 'offer_letter_received';
  }
  if (/technical interview|coding test|technical assessment|online assessment|hackerrank|codility|take-home/i.test(text)) {
    return 'technical_interview';
  }
  if (/invite you to|schedule an interview|interview availability|book a slot|interview slot|we would like to schedule|we are pleased to invite/i.test(text)) {
    return 'interview_scheduled';
  }
  return 'applied';
}

/**
 * Filter out emails that are not direct application confirmations or updates.
 */
function isRelevantEmail(from, subject) {
  const lowerFrom = from.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  if (lowerFrom.includes('ambitionbox.com')) return false;
  if (lowerFrom.includes('naukri.com') && lowerSubject.startsWith('you applied for')) return false;
  if (lowerSubject.startsWith('ticket received')) return false;
  return true;
}

async function checkForApplicationEmails() {
  try {
    const query = 'subject:(application OR received OR applied OR thank you OR interview OR offer)';
    const messages = await listMessages({ query, maxResults: 20 });

    const newEmails = [];
    for (const msg of messages) {
      const existing = await Job.findOne({ 'emailLog.gmailMessageId': msg.id });
      if (existing) continue;

      // Use getFullMessage to get body as well
      const details = await getFullMessage(msg.id);
      if (!isRelevantEmail(details.from, details.subject)) {
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

      // Extract contact emails from from header and body
      const emailText = `${email.from} ${email.body || email.snippet}`;
      const contactEmails = extractEmails(emailText);

      await Job.create({
        company: parsed.company,
        role: parsed.role,
        platform: parsed.platform,
        status,
        appliedDate: new Date(),
        sourceEmailId: email.id,
        contactEmails,                     // <-- store extracted emails
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