const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const bwipjs = require('bwip-js');
const QRCode = require('qrcode');
require('dotenv').config();

const ROOT = __dirname;
const INPUT_PATH = path.join(ROOT, 'RESULTADO_TEST_BASE_ELECTRONICA.pdf');
const OUTPUT_PATH = path.join(ROOT, 'RESULTADO_TEST_BASE_ELECTRONICA_QR.pdf');

// Codigo 1: encabezado QR
const QR_ENCABEZADO = 'ABC-123';
const HEADER_X = parseFloat(process.env.QR_X || '12.2');
const HEADER_Y = parseFloat(process.env.QR_Y || '10.2');
const HEADER_W = parseFloat(process.env.QR_SIZE || '72');
const HEADER_H = HEADER_W;

// Codigo 2: zona donde antes salia el texto del link
const PLACA_CUERPO = 'ABC-123';
const BODY_X = 90;
const BODY_Y = 323;
const BODY_W = 80;
const BODY_H = 18;

// Codigo 3: franja inferior tipo PDF417 debajo de ejes/ancho
const PDF417_TECNICO = [
  'PLACA:ABC-123',
  'MARCA:TOYOTA',
  'MODELO:COROLLA XEI',
  'VIN:8AJBA3HE0NL123456',
  'SERIE:JTNKU3JE7GJ123456',
  'MOTOR:2ZR-9876543',
].join('\n');
const TECH_X = 60;
const TECH_Y = 15;
const TECH_W = 260;
const TECH_H = 40;

async function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`No existe el archivo base: ${INPUT_PATH}`);
  }

  const pdfBytes = fs.readFileSync(INPUT_PATH);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  const qrHeaderPng = await QRCode.toDataURL(QR_ENCABEZADO, {
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
  const qrHeaderImg = await pdfDoc.embedPng(qrHeaderPng);

  const barcodeBodyBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: PLACA_CUERPO,
    scale: 2,
    height: 18,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  });
  const barcodeBodyImg = await pdfDoc.embedPng(barcodeBodyBuffer);

  const pdf417Buffer = await bwipjs.toBuffer({
    bcid: 'pdf417',
    text: PDF417_TECNICO,
    scale: 1,
    height: 16,
    includetext: false,
    backgroundcolor: 'FFFFFF',
    paddingwidth: 0,
    paddingheight: 0,
  });
  const pdf417Img = await pdfDoc.embedPng(pdf417Buffer);

  const headerX = (HEADER_X / 100) * width;
  const headerY = height - ((HEADER_Y / 100) * height) - HEADER_W;

  page.drawImage(qrHeaderImg, {
    x: headerX,
    y: headerY,
    width: HEADER_W,
    height: HEADER_H,
  });

  page.drawImage(barcodeBodyImg, {
    x: BODY_X,
    y: BODY_Y,
    width: BODY_W,
    height: BODY_H,
  });

  page.drawImage(pdf417Img, {
    x: TECH_X,
    y: TECH_Y,
    width: TECH_W,
    height: TECH_H,
  });

  fs.writeFileSync(OUTPUT_PATH, await pdfDoc.save());
  console.log(`Codigo insertado en: ${OUTPUT_PATH}`);
  console.log(`QR_ENCABEZADO: ${QR_ENCABEZADO}`);
  console.log(`PLACA_CUERPO: ${PLACA_CUERPO}`);
  console.log(`PDF417_TECNICO: OK`);
  console.log(`Header -> X:${headerX.toFixed(2)} Y:${headerY.toFixed(2)} WIDTH:${HEADER_W} HEIGHT:${HEADER_H}`);
  console.log(`Body -> X:${BODY_X.toFixed(2)} Y:${BODY_Y.toFixed(2)} WIDTH:${BODY_W} HEIGHT:${BODY_H}`);
  console.log(`Tech -> X:${TECH_X.toFixed(2)} Y:${TECH_Y.toFixed(2)} WIDTH:${TECH_W} HEIGHT:${TECH_H}`);
}

main().catch((err) => {
  console.error('Error insertando codigo:', err.message);
  process.exit(1);
});
