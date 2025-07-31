const path = require('path');
const fs = require('fs').promises;
const { processSinglePdf } = require('../controllers/pdfController');

describe('PDF Controller', () => {
  it('should process a PDF file and extract text', async () => {
    const pdfPath = path.join(__dirname, 'test.pdf');
    const result = await processSinglePdf(pdfPath);
    expect(result).toBeDefined();
  }, 10000);
});
