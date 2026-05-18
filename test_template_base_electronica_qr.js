const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const bwipjs = require('bwip-js');
const QRCode = require('qrcode');
const crypto = require('crypto');
require('dotenv').config();

const ROOT = __dirname;
const INPUT_PATH = path.join(ROOT, 'RESULTADO_TEST_BASE_ELECTRONICA.pdf');
const OUTPUT_PATH = path.join(ROOT, 'RESULTADO_TEST_BASE_ELECTRONICA_QR.pdf');
const UPLOAD_DIR = path.join(ROOT, 'servicio', 'verCertificado', 'Tive');
const DOMAIN = (process.env.DOMAIN_URL || 'http://localhost:3000').replace(/\/$/, '');

// Codigo 1: encabezado QR verificable
const HEADER_X = parseFloat(process.env.QR_X || '12.2');
const HEADER_Y = parseFloat(process.env.QR_Y || '10.2');
const HEADER_W = parseFloat(process.env.QR_SIZE || '72');
const HEADER_H = HEADER_W;

// Codigo 2: barra Code128 de placa
const PLACA_CUERPO = 'ABC-123';
const BODY_X = 90;
const BODY_Y = 323;
const BODY_W = 80;
const BODY_H = 18;

// Codigo 3: franja inferior tipo PDF417 debajo de ejes/ancho
const TECH_X = 60;
const TECH_Y = 15;
const TECH_W = 260;
const TECH_H = 40;

function formatearPdf417TiveDemo() {
  const zona = 'III';
  const sede = 'MOYOBAMBA';
  const placa = PLACA_CUERPO;
  const partida = '60591824';
  const dua = '118-2025-10-162173-118';
  const titulo = '2025-02122593';
  const fechaTitulo = '18/07/2025';
  const estado = 'NUEVO';
  const codVerif = '1000086161';
  const marca = 'HONDA';
  const motor = 'JA73E2045867';
  const vin = 'LALJA7392S3083584';
  const serie = 'LALJA7392S3083584';

  return [
    `!ZONA REGISTRAL N ${zona}!SEDE REGISTRAL`,
    `- ${sede.padEnd(22)}!${placa} !`,
    `${partida}!${dua}!`,
    `${titulo}!${fechaTitulo}!`,
    `${estado.padEnd(22)}!    !${codVerif}!`,
    `${marca.padEnd(22)}!`,
    `${motor.padEnd(22)}!`,
    `${vin.padEnd(22)}!`,
    serie,
  ].join('\n');
}

async function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`No existe el archivo base: ${INPUT_PATH}`);
  }

  const pdfBytes = fs.readFileSync(INPUT_PATH);
  const verificationHash = crypto.createHash('sha256').update(pdfBytes).digest('hex').toUpperCase();
  const verificationUrl = `${DOMAIN}/servicio/verCertificado/Tive/${verificationHash}`;
  const pdf417Tecnico = formatearPdf417TiveDemo();

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();

  const qrHeaderPng = await QRCode.toDataURL(verificationUrl, {
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });
  const qrHeaderImg = await pdfDoc.embedPng(qrHeaderPng);

  const plateBarcodeBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: PLACA_CUERPO,
    scale: 4,
    height: 12,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  });
  const plateBarcodeImg = await pdfDoc.embedPng(plateBarcodeBuffer);

  const pdf417Buffer = await bwipjs.toBuffer({
    bcid: 'pdf417',
    text: pdf417Tecnico,
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

  page.drawImage(plateBarcodeImg, {
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

  const outputBytes = await pdfDoc.save();
  fs.writeFileSync(OUTPUT_PATH, outputBytes);
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, `${verificationHash}.pdf`), outputBytes);

  console.log(`Codigo insertado en: ${OUTPUT_PATH}`);
  console.log(`QR_ENCABEZADO: ${verificationUrl}`);
  console.log(`HASH: ${verificationHash}`);
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
