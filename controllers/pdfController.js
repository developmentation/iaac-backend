const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ParsedPdf = require('../models/parsedPdf');
const poppler = require('pdf-poppler');
const PDF2JSON = require('pdf2json');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { glob } = require('glob');
const JSON5 = require('json5');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const DEFAULT_PROMPT = `
You are an automated system tasked with analyzing PDF documents related to impact statements and impact assessments in Canada, specifically those prepared for the evaluation of energy and infrastructure projects. Your objective is to identify and summarize key information, focusing on the opinions and recommendations of stakeholders involved in these assessments. Follow these steps for each document:

1. **Determine Relevance**: Verify if the document pertains to impact statements or impact assessments for energy or infrastructure projects in Canada. If the document does not relate to this scope, return: {value:"No relevant data"}.

2. **Extract Key Information**: If the document is relevant, extract the following:
   - **Project Details**: Name, type (e.g., energy, infrastructure), location, and purpose of the project.
   - **Stakeholder Identification**: List the stakeholders involved (e.g., government agencies, Indigenous groups, local communities, industry representatives, environmental organizations).
   - **Stakeholder Opinions**: Summarize the opinions expressed by each stakeholder group regarding the project's impacts (e.g., environmental, social, economic, cultural).
   - **Stakeholder Recommendations**: Identify specific recommendations provided by stakeholders for mitigating negative impacts or enhancing project outcomes.
   - **Key Issues**: Highlight any major concerns or controversies raised by stakeholders (e.g., environmental risks, community displacement, economic benefits).
   - **Supporting Evidence**: Note any data, studies, or references cited by stakeholders to support their opinions or recommendations.

3. **Summarize Findings**: Provide a concise summary of the stakeholder opinions and recommendations, organized by stakeholder group. Ensure the summary is neutral, accurate, and captures the diversity of perspectives.

4. **Output Format**: Return the analysis in a structured JSON format. If the document is relevant, use the following structure:
   \`\`\`json
   {
     "value": "Relevant data",
     "project": {
       "name": "[Project Name]",
       "type": "[Energy/Infrastructure]",
       "location": "[Location in Canada]",
       "purpose": "[Brief description of project purpose]"
     },
     "stakeholders": [
       {
         "group": "[Stakeholder Group]",
         "opinions": "[Summary of opinions]",
         "recommendations": "[Summary of recommendations]",
         "key_issues": "[Key concerns or controversies]"
       }
     ],
     "supporting_evidence": "[Summary of cited data or studies]"
   }
   \`\`\`
   If the document is not relevant, return:
   \`\`\`json
   {value:"No relevant data"}
   \`\`\`

5. **Error Handling**: If the document is unreadable, corrupted, or lacks sufficient information, return:
   \`\`\`json
   {value:"Error: Unable to process document"}
   \`\`\`

Ensure the analysis is objective, respects the diversity of stakeholder perspectives, and adheres to the context of Canadian energy and infrastructure project evaluations. Process the document efficiently and return the output in the specified JSON format.
`;

async function processPageData(imagePath, pageNumber, originalFilename, pageText, userPrompt) {
  console.log(`Processing page ${pageNumber} of ${originalFilename}...`);
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const resizedImageBuffer = await sharp(imageBuffer)
      .resize({ width: 2000, withoutEnlargement: true })
      .toBuffer();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = userPrompt || DEFAULT_PROMPT;
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: resizedImageBuffer.toString('base64'), mimeType: 'image/png' } },
    ]);

    let geminiResponse = await result.response.text();
    geminiResponse = geminiResponse.replace(/^```json\s*|\s*```$/g, '');

    let parsedResponse;
    try {
      parsedResponse = JSON5.parse(geminiResponse);
    } catch (e) {
      console.warn(`Failed to parse geminiResponse as JSON for page ${pageNumber} of ${originalFilename}:`, e.message);
      parsedResponse = geminiResponse; // Fallback to raw response
    }

    const embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' });
    const embeddingResult = await embeddingModel.embedContent(geminiResponse);
    const embedding = embeddingResult.embedding.values;

    const embeddingOriginalTextResult = await embeddingModel.embedContent(pageText);
    const embeddingOriginalText = embeddingOriginalTextResult.embedding.values;

    // Stringify parsedResponse for saving to ParsedPdf (assuming geminiResponse is a String field)
    const objectParsed = {
      originalFilename,
      pageNumber,
      geminiResponse: typeof parsedResponse === 'object' ? JSON.stringify(parsedResponse) : parsedResponse,
      embeddingGeminiResponse: embedding,
      originalText: pageText,
      embeddingsOriginalText: embeddingOriginalText,
    };
    const parsedPdf = new ParsedPdf(objectParsed);
    await parsedPdf.save();
    console.log(`Page ${pageNumber} of ${originalFilename} processed and saved.`);
    return { status: 'success', geminiResponse: parsedResponse };
  } catch (error) {
    console.error(`Error processing page ${pageNumber} of ${originalFilename}:`, error);
    return { status: 'error', geminiResponse: `Error: ${error.message}` };
  }
}

async function processSinglePdf(pdfPath, userPrompt) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-'));
  const originalFilename = path.basename(pdfPath);

  try {
    const imageOpts = {
      format: 'png',
      out_dir: tempDir,
      out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
      page: null
    };
    await poppler.convert(pdfPath, imageOpts);

    const pdfParser = new PDF2JSON();
    const pdfData = await new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => resolve(pdfData));
      pdfParser.on('pdfParser_dataError', (err) => reject(err));
      pdfParser.loadPDF(pdfPath);
    });

    const pagesText = pdfData.Pages.map((page) =>
      page.Texts.map((text) => decodeURIComponent(text.R[0].T)).join(' ')
    );

    const files = await fs.readdir(tempDir);
    const imagePaths = files.filter(file => file.endsWith('.png')).map(file => path.join(tempDir, file));
    const promises = [];

    for (let i = 0; i < imagePaths.length; i++) {
      const pageNumber = i + 1;
      const pageText = pagesText[i] || '';
      promises.push(processPageData(imagePaths[i], pageNumber, originalFilename, pageText, userPrompt));
    }

    const results = await Promise.all(promises);
    return results;
  } catch (error) {
    console.error(`Error processing PDF ${originalFilename}:`, error);
    return [{ status: 'error', geminiResponse: `Error: ${error.message}` }];
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

exports.processProjectPdfs = async (req, res) => {
  const projectId = req.params.projectId;
  if (!/^\d{5}$/.test(projectId)) {
    return res.status(400).send('Invalid project ID format. Must be a 5-digit number.');
  }

  const projectPath = path.join(__dirname, '..', 'data', projectId);

  try {
    const pdfFiles = await glob('**/*.pdf', { cwd: projectPath, absolute: true });

    if (pdfFiles.length === 0) {
      return res.status(404).send(`No PDF files found for project ID ${projectId}.`);
    }

    res.status(202).send(`Started processing ${pdfFiles.length} PDF files for project ID ${projectId}.`);

    (async () => {
      for (const pdfFile of pdfFiles) {
        const results = await processSinglePdf(pdfFile, req?.body?.prompt || DEFAULT_PROMPT);
        console.log(`Processed ${pdfFile} with ${results.filter(r => r.status === 'error').length} errors.`);
      }
      console.log(`Finished processing all PDFs for project ${projectId}.`);
    })();
  } catch (error) {
    console.error(`Error finding PDFs for project ${projectId}:`, error);
    res.status(500).send('Error finding PDF files.');
  }
};

exports.processPdfFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-'));
  const pdfPath = path.join(tempDir, req.file.originalname);

  try {
    await fs.writeFile(pdfPath, req.file.buffer);

    const results = await processSinglePdf(pdfPath, req?.body?.prompt || DEFAULT_PROMPT);

    const failedPages = results.filter(result => result.status === 'error');
    const successfulResponses = results.map(result => result.geminiResponse);

    if (failedPages.length > 0) {
      res.status(200).send({
        message: `Processed ${results.length - failedPages.length} pages successfully. ${failedPages.length} pages failed to process.`,
        results: successfulResponses
      });
    } else {
      res.status(200).send({
        message: 'All pages processed successfully.',
        results: successfulResponses
      });
    }
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).send({ message: 'Error processing PDF.', results: [`Error: ${error.message}`] });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};