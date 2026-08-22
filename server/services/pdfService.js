// server/services/pdfService.js
const PDFDocument = require('pdfkit');
const fs = require('fs');

function generateCoverLetterPDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Banner background
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.rect(0, 0, doc.page.width, 110).fill('#e1e1e1');

      // Name
      doc.fillColor('#000').fontSize(22).font('Helvetica-Bold').text('Ravi Rajpoot', {
        align: 'center',
        width: pageWidth,
      });

      // Contact line
      doc.fontSize(10).font('Helvetica').fillColor('#333').text(
        'ravirajpoot2204@gmail.com | +91 6388296339 | Lucknow, Uttar Pradesh',
        { align: 'center', width: pageWidth }
      );
      doc.text(
        'github.com/ravirajpoot2204 | linkedin.com/in/ravirajpoot2204',
        { align: 'center', width: pageWidth }
      );

      doc.moveDown(1.5);

      // Date
      doc.fontSize(10).fillColor('#000').text(
        data.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        { align: 'left', width: pageWidth }
      );

      // Recipient block
      doc.text(data.recipientName || 'Hiring Manager', { width: pageWidth });
      if (data.company) doc.text(data.company, { width: pageWidth });
      if (data.street) doc.text(data.street, { width: pageWidth });
      const cityStateZip = [data.city, data.state, data.zip].filter(Boolean).join(', ');
      if (cityStateZip) doc.text(cityStateZip, { width: pageWidth });

      doc.moveDown(1);

      // Letter body
      doc.fontSize(11).font('Helvetica').fillColor('#000').text(
        data.letterBody,
        { align: 'left', width: pageWidth }
      );

      doc.moveDown(2);

      // Signature
      doc.text('Sincerely,', { align: 'right', width: pageWidth });
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Ravi Rajpoot', { align: 'right', width: pageWidth });
      doc.font('Helvetica').text('MERN Stack Developer', { align: 'right', width: pageWidth });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCoverLetterPDF };