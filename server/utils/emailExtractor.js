function extractEmails(text) {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  // Remove duplicates
  const unique = [...new Set(matches.map(email => email.toLowerCase()))];
  // Filter out no-reply, info, etc.
  return unique.filter(email => {
    const lower = email;
    if (/no-?reply|noreply|do-not-reply|mailer-daemon|notification|donotreply/i.test(lower)) return false;
    if (/^info@/i.test(lower)) return false; // optional, but often generic
    return true;
  });
}

module.exports = { extractEmails };