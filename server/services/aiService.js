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
- "company": the company name (if mentioned, else "Unknown")
- "role": the job title or role
- "skillsRequired": array of top 5 skills
- "interviewTopics": array of 5 topics to prepare
- "suggestedQuestions": array of 5 likely interview questions
- "location": the job location if mentioned (e.g., "Bangalore", "Remote", "Hybrid"), else "Not specified"

Job Description:
${description}

Return ONLY valid JSON.`;

  try {
    const response = await callWithRetry(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const content = response.data.candidates[0].content.parts[0].text;
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
  const prompt = `You are a senior career coach. Tailor the candidate's resume to a specific job.

STRICT RULES:
- Output ONLY valid JSON. No markdown, no explanations.
- Preserve ALL real facts from the base CV: dates, company names, project names, links, metrics. Do NOT invent anything.
- Reorder and rephrase bullet points to emphasize the most relevant experience for the job.
- Keep bullet points short (max 15 words each), action-verb-led, with quantified impact where possible.
- For each project, keep the EXACT project name and any URL mentioned. Do NOT invent or change URLs.
- If the base CV contains a URL for a project, copy it verbatim into the "link" field.
- For each project, if the base CV contains a "Note:" line, you MUST preserve it
  at the end of that project's points array, prefixed with "Note:".
- If a project has "Demo credentials" in the base CV, include them as the LAST
  bullet point of that project.
- Never invent or omit demo credentials or testing notes.
- Before writing, extract the TOP 10 keywords/skills from the job description.
- Ensure at least 8 of those keywords appear naturally in the summary, skills, or
  project bullets. Do NOT keyword-stuff — use them only where honest.

LENGTH CONSTRAINTS (STRICT):
- Summary: 2-3 sentences only.
- Skills: exactly 3 groups (Primary / Additional / Tools), each comma-separated.
- Experience: max 3 bullets total.
- Projects: exactly 3 projects, max 4 bullets each.
- Achievements: max 3 bullets.
- Total content must fit on ONE A4 page.

Output JSON schema:
{
  "name": "Ravi Rajpoot",
  "title": "Full Stack Developer | MERN Stack",
  "contact": {
    "location": "Lucknow, Uttar Pradesh",
    "phone": "+91 6388296339",
    "email": "ravirajpoot2204@gmail.com",
    "github": "github.com/ravirajpoot2204",
    "linkedin": "linkedin.com/in/ravirajpoot2204"
  },
  "summary": "2-3 sentences tailored to the job",
  "matchedKeywords": ["keyword1", "keyword2", "..."],
  "skills": {
    "Primary Languages & Stacks": "comma separated",
    "Additional Languages & Frameworks": "comma separated",
    "Tools & Methodologies": "comma separated"
  },
  "experience": [
    { "title": "...", "company": "...", "date": "...", "location": "...", "points": ["..."] }
  ],
  "projects": [
    { "name": "...", "tech": "...", "link": "...", "points": ["..."] }
  ],
  "education": [
    { "institution": "...", "degree": "...", "date": "...", "location": "..." }
  ],
  "achievements": ["..."],
  "impact": "one sentence summary line"
}

Base CV:
${baseCV}

Job Information:
- Company: ${job.company}
- Role: ${job.role}
- Snippet: ${job.snippet || 'Not provided'}

Return ONLY the JSON.`;

  const response = await callWithRetry(
    `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 3000,
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
  const location = job.location || 'Not specified';
  const lower = location.toLowerCase();

  let locationLine = 'I am open to relocating and joining immediately.';
  if (lower.includes('remote')) {
    locationLine = 'I am available for remote work and open to hybrid arrangements as needed.';
  } else if (lower.includes('hybrid')) {
    locationLine = 'I am open to hybrid work and can relocate if required.';
  } else if (location && location !== 'Not specified') {
    locationLine = `I am open to relocating to ${location} and joining immediately.`;
  }

  const prompt = `You are a professional cover letter writer. Write a concise, tailored cover letter body.

STRICT RULES:
1. Do NOT include candidate name, contact info, date, address, or signature.
2. Start directly with "Dear Hiring Team,".
3. Write exactly 3 short paragraphs (total under 200 words).
4. Paragraph 1: Hook + why THIS company. Reference ONE specific detail from the job description (a product, value, technology, or mission mentioned). This proves you read the JD.
5. Paragraph 2: Connect the candidate's achievements to the job requirements. Use quantifiable metrics (40% bandwidth reduction, 99% payment success rate, 40+ issues resolved, 5+ hours/week saved). Do NOT invent numbers.
6. Paragraph 3: Call to action: "I would welcome the opportunity to discuss how I can contribute to your team."
7. After paragraph 3, add this exact location line: "${locationLine}"
8. No generic phrases like "I am writing to express my strong interest".
9. Output plain text only, no JSON, no markdown.

Candidate CV (reference only):
${baseCV}

Job Information:
- Company: ${job.company}
- Role: ${job.role}
- Description Snippet: ${job.snippet || 'Not provided'}
- Location: ${location}

Generate the cover letter body now:`;

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