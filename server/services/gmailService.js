// server/services/gmailService.js
const { google } = require('googleapis');
const nodemailer = require('nodemailer');


// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground' // redirect URI used when refreshing token
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

/**
 * Send an email from the authenticated Gmail account.
 * @param {object} params
 * @param {string} params.to - recipient email address
 * @param {string} params.subject - email subject
 * @param {string} params.body - plain text email body
 * @returns {Promise<{messageId: string, threadId: string}>}
 */
async function sendEmail({ to, subject, body }) {
  const toEmail = to.trim();
  const fromEmail = process.env.GMAIL_USER_EMAIL.trim();

  const rawMessage = [
    `To: ${toEmail}`,
    `From: ${fromEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body
  ].join('\r\n');

  const raw = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return {
    messageId: res.data.id,
    threadId: res.data.threadId,
  };
}

/**
 * List message IDs matching a search query.
 * @param {object} params
 * @param {string} params.query - Gmail search query (e.g., 'from:linkedin.com after:2026/01/01')
 * @param {number} [params.maxResults=10] - maximum number of messages to return
 * @returns {Promise<Array<{id: string, threadId: string}>>}
 */
async function listMessages({ query, maxResults = 10 }) {
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  return (res.data.messages || []).map(msg => ({
    id: msg.id,
    threadId: msg.threadId,
  }));
}

/**
 * Get full details of a message by ID.
 * @param {string} messageId
 * @returns {Promise<{id: string, threadId: string, subject: string, from: string, snippet: string, date: string}>}
 */
async function getMessage(messageId) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From', 'Date'],
  });

  const headers = res.data.payload?.headers || [];
  const subject = headers.find(h => h.name === 'Subject')?.value || '';
  const from = headers.find(h => h.name === 'From')?.value || '';
  const date = headers.find(h => h.name === 'Date')?.value || '';

  return {
    id: res.data.id,
    threadId: res.data.threadId,
    subject,
    from,
    snippet: res.data.snippet || '',
    date,
  };
}
/**
 * Send email with attachments using Gmail API via nodemailer.
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.body
 * @param {Array<{filename:string, content:Buffer}>} params.attachments
 * @returns {Promise<{messageId:string, threadId:string}>}
 */
async function sendEmailWithAttachment({ to, subject, body, attachments = [] }) {
  try {
    // Build MIME with nodemailer using streamTransport (no SMTP connection)
    const transporter = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
    });

    const mailOptions = {
      from: process.env.GMAIL_USER_EMAIL,
      to,
      subject,
      text: body,
      attachments: attachments.map(att => ({
        filename: att.filename,
        content: att.content,
      })),
    };

    const info = await transporter.sendMail(mailOptions);
    // info.message is a Buffer containing the full MIME message
    const raw = info.message.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send using Gmail API
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return {
      messageId: res.data.id,
      threadId: res.data.threadId,
    };
  } catch (error) {
    console.error('❌ sendEmailWithAttachment error:', error.message);
    throw error;
  }
}
async function getFullMessage(messageId) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = res.data.payload?.headers || [];
  const subject = headers.find(h => h.name === 'Subject')?.value || '';
  const from = headers.find(h => h.name === 'From')?.value || '';
  const date = headers.find(h => h.name === 'Date')?.value || '';

  // Extract body text from payload
  let body = '';
  const parts = res.data.payload?.parts || [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain') {
      body += Buffer.from(part.body?.data || '', 'base64').toString('utf-8');
    }
  }
  if (!body && res.data.payload?.body?.data) {
    body = Buffer.from(res.data.payload.body.data, 'base64').toString('utf-8');
  }

  return {
    id: res.data.id,
    threadId: res.data.threadId,
    subject,
    from,
    date,
    snippet: res.data.snippet || '',
    body,
  };
}
module.exports = {
  sendEmail,
  sendEmailWithAttachment,
  listMessages,
  getMessage,
  getFullMessage,
};