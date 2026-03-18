function generateQRValue(text) {
  return Buffer.from(text).toString('base64');
}

function decodeQRValue(value) {
  return Buffer.from(value, 'base64').toString('utf8');
}

module.exports = { generateQRValue, decodeQRValue };
