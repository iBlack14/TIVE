const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function checkPdf() {
    const plantillaBuffer = fs.readFileSync(path.join(__dirname, '..', 'tarjeta', 'placaplantilla.pdf'));
    const pdfDoc = await PDFDocument.load(plantillaBuffer);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();
    console.log(`PDF Size: ${width} x ${height}`);
}

checkPdf().catch(console.error);
