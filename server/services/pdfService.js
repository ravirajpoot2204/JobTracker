const PDFDocument = require('pdfkit');

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

module.exports = { generateCoverLetterPDF };