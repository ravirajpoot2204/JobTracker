// server/services/aiService.js
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = process.env.URL_API ;

async function callWithRetry(url, data, headers, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.post(url, data, { headers });
    } catch (error) {
      const status = error.response?.status;
      if ((status === 429 || status === 503) && i < retries - 1) {
        // Wait longer for rate limit errors
        const wait = status === 429 ? 60000 : 30000; // 60s for 429, 10s for 503
        console.log(`Rate limited. Waiting ${wait / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, wait));
        continue;
      }
      throw error;
    }
  }
}

function safeParseJSON(text) {
  if (!text) throw new Error('Empty response from Gemini');
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  let parsed;
  try {
    if (start !== -1 && end !== -1 && start < end) {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } else {
      parsed = JSON.parse(cleaned);
    }
    return parsed;
  } catch (error) {
    console.error('Raw Gemini content:', cleaned.slice(0, 500));
    throw new Error(`Failed to parse JSON from Gemini: ${error.message}`);
  }
}
function extractJSON(text) {
  if (!text) return {};
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  try {
    if (start !== -1 && end !== -1 && start < end) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('JSON parse failed for content:', cleaned.slice(0, 500));
    return {};
  }
}
async function batchParseJobEmails(emails) {
  const emailListText = emails.map((e, i) =>
    `Email ${i + 1}:
Subject: ${e.subject}
From: ${e.from}
Snippet: ${e.snippet}`
  ).join('\n\n');

  const prompt = `You are a job application email parser. For each email below, extract company name, job role, and platform. Return a JSON array where each object has keys: "company", "role", "platform". If platform cannot be determined, use "Other".

${emailListText}

Return ONLY the JSON array.`;

  try {
    const response = await callWithRetry(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const content = response.data.candidates[0].content.parts[0].text;
    console.log('Raw batch content:', content);
    const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('❌ Batch parsing error:', JSON.stringify(error.response?.data || error.message));
    return [];
  }
}
function decodeHtmlEntities(text) {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function fallbackParseEmail(subject, from, snippet = '') {
  const cleanSubject = decodeHtmlEntities(subject);
  const cleanSnippet = decodeHtmlEntities(snippet);
  const text = `${cleanSubject} ${cleanSnippet}`;
  let company = 'Unknown';
  let role = cleanSubject;

  // Pattern 1: "applying to X for the role of Y"
  let m = text.match(/(?:applying to|applied to)\s+([^,.<]+?)(?:\s+(?:for|to)\s+the\s+role\s+of\s+([^,.<]+))/i);
  if (m) {
    company = m[1].trim();
    role = m[2].trim();
  }

  // Pattern 2: "applying at X for the Y role"
  if (company === 'Unknown') {
    m = text.match(/(?:applying at|applied at)\s+([^,.<]+?)\s+for\s+the\s+([^,.<]+?)\s+role/i);
    if (m) {
      company = m[1].trim();
      role = m[2].trim();
    }
  }

  // Pattern 3: "interest in the Y position with X"
  if (company === 'Unknown') {
    m = text.match(/(?:interest in|applied for)\s+the\s+([^,.<]+?)\s+position\s+(?:with|at)\s+([^,.<]+)/i);
    if (m) {
      role = m[1].trim();
      company = m[2].trim();
    }
  }

  // Pattern 4: "position of Y" and "Thank you for applying to X"
  if (company === 'Unknown') {
    m = text.match(/(?:applying to|apply to|at)\s+([^,.<]+?)(?:\s+for\s+the\s+role\s+of\s+([^,.<]+))/i);
    if (m) {
      company = m[1].trim();
      role = m[2].trim();
    }
  }

  // Pattern 5: Subject has "Company - Role" or "Company: Role"
  if (company === 'Unknown') {
    m = cleanSubject.match(/^(.*?)\s+-\s+(.*)$/);
    if (m) {
      const first = m[1].trim();
      const second = m[2].trim();
      // Avoid generic first parts
      if (!/application|received|thank|your|we|action|invitation|update|offer/i.test(first)) {
        company = first;
        role = second;
      } else if (!/application|received|thank|your|we|action|invitation|update|offer/i.test(second)) {
        company = second;
        role = first;
      }
    }
  }

  // Pattern 6: "at X" or "with X" in snippet
  if (company === 'Unknown') {
    m = text.match(/\b(?:at|with|from)\s+([A-Z][A-Za-z0-9&.\- ]+?)(?:\s+(?:for|position|role|\.|,))/i);
    if (m) company = m[1].trim();
  }

  // Pattern 7: Derive company from sender domain/local part
  if (company === 'Unknown' || company === 'Other') {
    const domainMatch = from.match(/@([A-Za-z0-9.-]+)/);
    if (domainMatch) {
      const domain = domainMatch[1].toLowerCase();
      if (domain.includes('linkedin')) company = 'LinkedIn';
      else if (domain.includes('naukri')) company = 'Naukri';
      else if (domain.includes('internshala')) company = 'Internshala';
      else if (domain.includes('workday')) {
        // try to extract from snippet
        m = text.match(/(?:with|at)\s+([A-Z][A-Za-z0-9&.\- ]+?)(?:\s+(?:for|position|role|\.))/i);
        if (m) company = m[1].trim();
      } else {
        // Use local part if not no-reply
        const local = from.split('@')[0].toLowerCase();
        if (local && !/no-?reply|noreply|do-not-reply|mailer-daemon/i.test(local)) {
          company = local.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        } else {
          company = domain.replace(/\..*/, '').replace(/^www\./, '');
          company = company.charAt(0).toUpperCase() + company.slice(1);
        }
      }
    }
  }

  let platform = 'Other';
  if (from.includes('linkedin.com')) platform = 'LinkedIn';
  else if (from.includes('naukri.com')) platform = 'Naukri';
  else if (from.includes('internshala.com')) platform = 'Internshala';

  return { company, role, platform };
}
async function parseJobEmail(subject, from, snippet = '') {
  const prompt = `Extract company name, job role, and platform from the email details.
Return JSON only: { "company": "...", "role": "...", "platform": "..." }
If platform cannot be determined, use "Other".

Subject: ${subject}
From: ${from}
Snippet: ${snippet}
`;

  try {
    const response = await callWithRetry(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2500,
          responseMimeType: 'application/json',
        }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const content = response.data.candidates[0].content.parts[0].text;
    console.log('Raw content from Gemini:', content);
    const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    return {
      company: parsed.company || 'Unknown',
      role: parsed.role || subject,
      platform: parsed.platform || 'Other',
    };
  } catch (error) {
    console.error('❌ Gemini parsing error:', error.response?.data || error.message);
    return fallbackParseEmail(subject, from);
  }
}

async function analyzeJobDescription(description) {
  const prompt = `Analyze the following job description and return JSON with:
- "skillsRequired": array of top 5 skills
- "interviewTopics": array of 5 topics to prepare
- "suggestedQuestions": array of 5 likely interview questions

Job Description:
${description}
`;

  try {
    const response = await callWithRetry(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2500,
          responseMimeType: 'application/json',
        }
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const content = response.data.candidates[0].content.parts[0].text;
    console.log('Raw content from Gemini:', content);
    const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('❌ Gemini JD analysis error:', error.response?.data || error.message);
    return null;
  }
}
/**
 * Generate a tailored CV summary/skills section based on job description.
 */
async function generateTailoredCV(baseCV, job) {
  const prompt = `You are a career coach. Tailor the candidate's CV to the job description.

STRICT RULES:
- Output ONLY a valid JSON object. No markdown, no explanations.
- The entire CV MUST fit on ONE A4 page.
- Use bullet points, not paragraphs.
- Summary: exactly 2 sentences, max 30 words total.
- Skills: exactly 8 skills, comma-separated, no extra words.
- Projects: max 2 projects. Each project has "name" and exactly 3 bullet points. Each bullet max 10 words.
- Experience: max 1 entry with "title", "company", "date", and exactly 2 bullet points. Each bullet max 10 words.
- Education: only institution, degree, year.

Base CV:
${baseCV}

Job Information:
Company: ${job.company}
Role: ${job.role}
Snippet: ${job.snippet || 'No snippet available'}

JSON:`;

  const response = await callWithRetry(
    `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
      },
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const content = response.data.candidates[0].content.parts[0].text;
  console.log('Raw CV content:', content.slice(0, 300));
  return extractJSON(content);
}

/**
 * Generate a cover letter for the job.
 */


async function generateCoverLetter(baseCV, job) {
  // Build location preference line
  let locationLine = '';
  if (job.location && job.location.toLowerCase().includes('remote')) {
    locationLine = 'I am available for remote work and open to hybrid arrangements as needed.';
  } else if (job.location && job.location.toLowerCase().includes('hybrid')) {
    locationLine = 'I am open to hybrid work and can relocate if required.';
  } else if (job.location) {
    locationLine = `I am open to relocating to ${job.location} and joining immediately.`;
  } else {
    locationLine = 'I am open to relocating and joining immediately.';
  }

  const prompt = `You are a professional cover letter writer. Write a concise, tailored cover letter body.

**STRICT RULES:**
1. Do NOT include any candidate name, contact information, date, address, or signature.
2. Start directly with "Dear Hiring Team,".
3. Write exactly 3 short paragraphs (total under 200 words).
4. **Show the match:** Explicitly connect the candidate's achievements (e.g., YouTube Clone project, 40+ issues solved) to the job requirements. Explain WHY the candidate is a good fit for THIS role at THIS company.
5. **Show enthusiasm:** Include a line about why the candidate is interested in the company (e.g., their scale, products, engineering culture). Mention the company name when doing so.
6. **Be specific:** Use quantifiable achievements from the candidate's background when they align with the job. Examples: reduced bandwidth usage by 40%, 99% test payment success rate, 40+ technical issues resolved, 5+ hours/week saved. Do NOT invent numbers.
7. Use a professional, confident tone. Avoid generic phrases like "I am writing to express my strong interest".
8. End the body with a call to action like "I would welcome the opportunity to discuss how I can contribute to your team."
9. **Add location preference:** After the call to action, include this exact line (with the appropriate option based on the job):
   - For remote jobs: "I am available for remote work and open to hybrid arrangements as needed."
   - For hybrid jobs: "I am open to hybrid work and can relocate if required."
   - For on-site jobs: "I am open to relocating to [location] and joining immediately."
   - For unknown: "I am open to relocating and joining immediately."
10. Output plain text only, no JSON, no markdown.

**Candidate CV (for reference only):**
${baseCV}

**Job Information:**
- Company: ${job.company}
- Role: ${job.role}
- Description Snippet: ${job.snippet || 'Not provided'}
- Location: ${job.location || 'Not specified'}

**Instructions:**
1. In paragraph 1: Start with a hook. Say why you're interested in THIS company.
2. In paragraph 2: Connect your specific achievements to their requirements. Show the match.
3. In paragraph 3: Call to action.
4. After paragraph 3, add the location line.

**Generate the cover letter body now:`;

  const response = await callWithRetry(
    `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1000,
      },
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const content = response.data.candidates[0].content.parts[0].text;
  console.log('Raw cover letter body:', content.slice(0, 300));
  return { coverLetterText: content.trim() };
}
/**
 * Proofread a document and return corrected text plus issues found.
 */
async function proofreadDocument(text) {
  const prompt = `Proofread the following text. Correct any grammar, spelling, or punctuation errors. If any important information is missing, add a note. Return JSON with:
- "correctedText": the corrected text
- "issues": array of strings describing issues found

Text:
${text}
`;

  const response = await callWithRetry(
    `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
      },
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const content = response.data.candidates[0].content.parts[0].text;
  return extractJSON(content);
}

module.exports = {
  parseJobEmail,
  analyzeJobDescription,
  batchParseJobEmails,
  fallbackParseEmail,
  generateTailoredCV,
  generateCoverLetter,
  proofreadDocument,
};