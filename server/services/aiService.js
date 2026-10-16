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

 const prompt = `You are a job application email parser for a job tracker.

For each email below, extract:
- "company": the hiring company name. If not clear, use the sender's domain name (e.g., "amazon" from "no-reply@amazon.com"). If still unclear, use "Unknown".
- "role": the job title. Look in the subject line first. If not found, use "Unknown".
- "platform": one of "LinkedIn", "Naukri", "Internshala", "Wellfound", "Indeed", "Other". Detect from the sender email domain.
- "status": one of "applied", "viewed", "interview", "rejected", "offer". Detect from subject/snippet wording.

EXAMPLES:

Email: "Your application to Amazon"
From: no-reply@amazon.com
Snippet: "Thank you for applying to the SDE role."
Output: { "company": "Amazon", "role": "SDE", "platform": "Other", "status": "applied" }

Email: "Interview invitation for Frontend Developer at Flipkart"
From: jobs@naukri.com
Snippet: "We'd like to schedule an interview."
Output: { "company": "Flipkart", "role": "Frontend Developer", "platform": "Naukri", "status": "interview" }

RULES:
- Return a JSON ARRAY with one object per email, in the same order.
- Do NOT wrap in markdown. Return ONLY the array.
- If a field cannot be determined, use "Unknown" (except "platform" → "Other" and "status" → "applied").

Emails:
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
 const prompt = `Extract structured data from this job-related email.

Return JSON only with these keys:
{
  "company": "hiring company name or 'Unknown'",
  "role": "job title or 'Unknown'",
  "platform": "LinkedIn | Naukri | Internshala | Wellfound | Indeed | Other",
  "status": "applied | viewed | interview | rejected | offer",
  "recruiterEmail": "email address if mentioned, else null",
  "location": "city or 'Remote' if mentioned, else null"
}

RULES:
- Company: prefer the hiring company, not the job board. If email is from no-reply@linkedin.com, company is NOT LinkedIn.
- Platform: detect from the sender domain (linkedin.com → LinkedIn, naukri.com → Naukri).
- Status: infer from wording. "Thank you for applying" → applied. "We regret to inform" → rejected. "Interview" → interview.
- Do NOT invent data. Use null for missing fields.

Email:
Subject: ${subject}
From: ${from}
Snippet: ${snippet}`;
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
 const prompt = `Analyze this job description as a technical recruiter.

Return JSON ONLY:
{
  "company": "company name or 'Unknown'",
  "role": "job title",
  "location": "city / 'Remote' / 'Hybrid' / 'Not specified'",
  "experienceRequired": "e.g., '0-2 years', '3+ years', 'Fresher'",
  "skillsRequired": ["top 5 must-have skills"],
  "niceToHave": ["top 3 bonus skills"],
  "interviewTopics": ["5 topics to prepare"],
  "suggestedQuestions": ["5 likely interview questions"],
  "shouldApply": true,
  "matchReason": "one sentence explaining why or why not"
}

For "shouldApply": return true if the role is Fresher / 0-2 years / Internship. Return false if it requires 3+ years or a specialized domain (LIMS, SAP, .NET, etc.) that the candidate does not have.

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

BEFORE returning, self-check:
1. Did you preserve every project's link exactly from the base CV?
2. Did you include any "Note:" lines from the base CV?
3. Do at least 8 of the matchedKeywords appear in the output?
4. Is the "summary" between 2-3 sentences (not more)?
5. Does the output fit one A4 page?
"atsScore": 85,
"missingKeywords": ["TypeScript", "Docker"]
If any answer is NO, fix it before returning.
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
  const location = (job.location || '').trim();
  const lower = location.toLowerCase();
  const USER_CITY = 'lucknow'; // candidate's current city

  let locationLine = 'I am open to relocating and joining immediately.';

  if (!location || lower === 'not specified') {
    locationLine = 'I am open to relocating and joining immediately.';
  } else if (lower.includes('remote')) {
    locationLine = 'I am available for remote work and open to hybrid arrangements as needed.';
  } else if (lower.includes('hybrid')) {
    locationLine = 'I am open to hybrid work and can relocate if required.';
  } else if (lower.includes(USER_CITY)) {
    locationLine = 'I am based in Lucknow and available to join immediately.';
  } else {
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
7. End the letter with this EXACT location line (do not modify or duplicate it): "${locationLine}"
8. No generic phrases like "I am writing to express my strong interest".
9. Output plain text only, no JSON, no markdown.
ADDITIONAL CHECKS:
- In paragraph 1, you MUST quote or paraphrase one specific word/phrase from the job description (e.g., the product name, the tech, or the mission). Wrap it in quotes so it's clear you read the JD.
- In paragraph 2, mention ONLY skills the candidate actually has (from the CV). Do NOT claim Docker, AWS, Kubernetes, or TypeScript unless they appear in the CV.
- If the JD mentions a skill the candidate does NOT have, do NOT apologize for it. Just skip it.
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
const prompt = `Proofread the following text.

Return JSON ONLY with:
{
  "correctedText": "the fully corrected version",
  "issues": [
    { "type": "grammar|spelling|punctuation|clarity", "original": "...", "fixed": "..." }
  ],
  "summary": "one sentence describing the overall quality"
}

RULES:
- Do NOT change the meaning.
- Do NOT change names, dates, numbers, or URLs.
- Keep the tone professional.
- If no issues found, return an empty array.

Text:
${text}`;
;

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