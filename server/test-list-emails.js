require('dotenv').config();
const { listMessages, getFullMessage } = require('./services/gmailService');

(async () => {
  try {
    // Very broad query – same as emailWatcher uses
    const query = 'subject:application OR subject:applied OR subject:received OR subject:"thank you for applying" OR subject:resume OR subject:"your application" OR subject:interview OR subject:offer OR subject:position OR subject:job';
    const messages = await listMessages({ query, maxResults: 50 });
    console.log(`Found ${messages.length} messages`);

    for (const msg of messages) {
      const details = await getFullMessage(msg.id);
      console.log('---');
      console.log('Subject:', details.subject);
      console.log('From:', details.from);
      console.log('Snippet:', details.snippet?.slice(0, 120));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();