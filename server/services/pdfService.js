// server/services/pdfService.js
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function renderHTMLToPDF(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0in', right: '0in', bottom: '0in', left: '0in' },
  });
  await browser.close();
  return pdfBuffer;
}

async function generateCoverLetterPDF(data) {
  const template = await fs.readFile(
    path.join(__dirname, '../templates/coverLetterTemplate.html'),
    'utf-8'
  );

  const recipientBlock = `${data.recipientName || 'Hiring Manager'}<br>
${data.company}<br>
${data.street ? data.street + '<br>' : ''}${data.city ? data.city + ', ' : ''}${data.state ? data.state + ' ' : ''}${data.zip || ''}`;

  const html = template
    .replace('{{name}}', 'Ravi Rajpoot')
    .replace('{{email}}', 'ravirajpoot2204@gmail.com')
    .replace('{{phone}}', '+91 6388296339')
    .replace('{{location}}', 'Lucknow, Uttar Pradesh')
    .replace('{{github}}', 'github.com/ravirajpoot2204')
    .replace('{{linkedin}}', 'linkedin.com/in/ravirajpoot2204')
    .replace('{{date}}', data.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
    .replace('{{recipientBlock}}', recipientBlock)
    .replace('{{greeting}}', 'Dear')
    .replace('{{letterBody}}', data.letterBody.replace(/\n/g, '<br>'));

  // Use the same renderHTMLToPDF function
  return await renderHTMLToPDF(html);
}

module.exports = { generateCoverLetterPDF };