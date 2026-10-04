const PDFDocument = require('pdfkit');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

function generateCoverLetterPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
        compress: false,
        pdfVersion: '1.7',
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;

      // ========== BANNER ==========
      const bannerHeight = 130;
      doc.rect(0, 0, doc.page.width, bannerHeight).fill('#eef2ff');

      // Name
      doc.fillColor('#1e293b')
         .font('Helvetica-Bold')
         .fontSize(24)
         .text('RAVI RAJPOOT', { align: 'center', width: pageWidth, characterSpacing: 1 });

      doc.moveDown(0.3);

      // Contact info
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#475569')
         .text('ravirajpoot2204@gmail.com  |  +91 6388296339  |  Lucknow, Uttar Pradesh', {
           align: 'center', width: pageWidth,
         });

      doc.text('github.com/ravirajpoot2204  |  linkedin.com/in/ravirajpoot2204', {
        align: 'center', width: pageWidth,
      });

      // Thin line under banner
      doc.moveDown(0.8);
      doc.moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).strokeColor('#cbd5e1').lineWidth(1).stroke();

      // ========== RECIPIENT (no date at top now) ==========
      doc.moveDown(2); // ample space after banner
      doc.x = left;

      doc.fillColor('#0f172a').font('Helvetica').fontSize(11).text(data.recipientName || 'Hiring Manager', {
        align: 'left', width: pageWidth, lineGap: 2,
      });
      if (data.company) doc.text(data.company, { align: 'left', width: pageWidth, lineGap: 2 });
      if (data.street) doc.text(data.street, { align: 'left', width: pageWidth, lineGap: 2 });
      const cityStateZip = [data.city, data.state, data.zip].filter(Boolean).join(', ');
      if (cityStateZip) doc.text(cityStateZip, { align: 'left', width: pageWidth, lineGap: 2 });

      // ========== LETTER BODY ==========
      doc.moveDown(1.2);
      doc.x = left;

      doc.font('Helvetica').fontSize(11.5).fillColor('#1e293b').text(data.letterBody, {
        align: 'left',
        width: pageWidth,
        lineGap: 5.5,
        paragraphGap: 10,
      });

      // ========== CLOSING & DATE (bottom) ==========
      doc.moveDown(1.5);

      // Date at bottom right
      const dateText = data.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.font('Helvetica').fontSize(10).fillColor('#475569').text(`Date: ${dateText}`, {
        align: 'right', width: pageWidth,
      });

      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(11.5).fillColor('#1e293b').text('Sincerely,', { align: 'right', width: pageWidth });
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').text('Ravi Rajpoot', { align: 'right', width: pageWidth });
      doc.font('Helvetica').fontSize(10.5).text('MERN Stack Developer', { align: 'right', width: pageWidth });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}




// Escape special LaTeX characters in plain text
function esc(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}])/g, '\\$1')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/[^\x00-\x7F]/g, ''); // strip non-ASCII (emoji etc.)
}

function escUrl(url) {
  if (!url) return '#';
  return String(url).replace(/#/g, '\\#').replace(/%/g, '\\%').replace(/&/g, '\\&');
}

function buildSkillsTex(skills) {
  if (!skills || typeof skills !== 'object') return '';
  const entries = Object.entries(skills).filter(([, v]) => v);
  return entries
    .map(([k, v], i) => {
      const end = i === entries.length - 1 ? '' : ' \\\\';
      return `        \\textbf{${esc(k)}:} ${esc(v)}${end}`;
    })
    .join('\n');
}

function buildExperienceTex(experience) {
  if (!Array.isArray(experience)) return '';
  return experience
    .map((e) => {
      const points = (e.points || [])
        .map((p) => `      \\resumeItem{${esc(p)}}`)
        .join('\n');
      return `  \\resumeSubheading
    {${esc(e.title)}}{${esc(e.date)}}
    {${esc(e.company)}}{${esc(e.location)}}
    \\resumeItemListStart
${points}
    \\resumeItemListEnd`;
    })
    .join('\n\n');
}

function buildProjectsTex(projects) {
  if (!Array.isArray(projects)) return '';
  return projects
    .map((p) => {
      const tech = p.tech ? ` -- \\emph{${esc(p.tech)}}` : '';
      const linkPart = p.link
        ? `{\\href{${escUrl(p.link)}}{${esc(p.link.replace(/^https?:\/\//, ''))}}}`
        : '';
      const points = (p.points || [])
        .map((pt) => `      \\resumeItem{${esc(pt)}}`)
        .join('\n');
      return `  \\resumeProjectHeading
    {\\textbf{${esc(p.name)}}${tech}}{${linkPart}}
    \\resumeItemListStart
${points}
    \\resumeItemListEnd`;
    })
    .join('\n\n');
}

function buildEducationTex(education) {
  if (!Array.isArray(education)) return '';
  return education
    .map((e) => `  \\resumeSubheading
    {${esc(e.institution)}}{${esc(e.date)}}
    {${esc(e.degree)}}{${esc(e.location)}}`)
    .join('\n\n');
}

function buildAchievementsTex(achievements) {
  if (!Array.isArray(achievements)) return '';
  return achievements
    .map((a) => `  \\resumeItem{${esc(a)}}`)
    .join('\n');
}

async function generateResumePDF(data) {
  // 1. Load LaTeX template
  const template = await fs.readFile(
    path.join(__dirname, '../templates/resume.tex'),
    'utf-8'
  );

  // 2. Fill placeholders with LaTeX fragments
  const filled = template
    .replace('{{SUMMARY}}', esc(data.summary || ''))
    .replace('{{SKILLS}}', buildSkillsTex(data.skills))
    .replace('{{EXPERIENCE}}', buildExperienceTex(data.experience))
    .replace('{{PROJECTS}}', buildProjectsTex(data.projects))
    .replace('{{EDUCATION}}', buildEducationTex(data.education))
    .replace('{{ACHIEVEMENTS}}', buildAchievementsTex(data.achievements));

  // 3. Compile via YtoTech LaTeX API (free, no auth)
  try {
    const response = await axios.post(
      'https://latex.ytotech.com/builds/sync',
      {
        compiler: 'pdflatex',
        resources: [
          {
            main: true,
            content: filled,
          },
        ],
      },
      {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
        timeout: 45000,
      }
    );
    return Buffer.from(response.data);
  } catch (err) {
    console.error('❌ LaTeX compile failed:', err.message);
    if (err.response?.data) {
      console.error('Compiler response:', Buffer.from(err.response.data).toString('utf-8').slice(0, 800));
    }
    throw new Error('Failed to compile LaTeX resume');
  }
}
module.exports = { generateCoverLetterPDF,generateResumePDF };