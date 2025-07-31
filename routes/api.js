const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   name: Gemini
 *   description: API for interacting with Gemini
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     GeminiResponse:
 *       type: object
 *       required:
 *         - filename
 *         - geminiResponse
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the response.
 *         filename:
 *           type: string
 *           description: The filename of the uploaded image.
 *         geminiResponse:
 *           type: object
 *           description: The response from the Gemini API.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the response was created.
 *       example:
 *         _id: 60d21b4667d0d8992e610c85
 *         filename: my-image.jpg
 *         geminiResponse: { "text": "This is a dog." }
 *         createdAt: 2023-05-22T14:30:00.000Z
 */

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Uploads a PDF to be processed by Gemini
 *     tags: [Gemini]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: The PDF file to upload.
 *     responses:
 *       200:
 *         description: The file was successfully processed and the response from Gemini is returned.
 *       400:
 *         description: No file uploaded.
 *       500:
 *         description: Error processing file.
 */
router.post('/upload', upload.single('pdf'), pdfController.processPdfFile);

/**
 * @swagger
 * /api/process-project/{projectId}:
 *   get:
 *     summary: Processes all PDFs in a project folder
 *     tags: [Gemini]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         schema:
 *           type: string
 *         required: true
 *         description: The 5-digit ID of the project.
 *     responses:
 *       202:
 *         description: Started processing the PDF files.
 *       400:
 *         description: Invalid project ID format.
 *       404:
 *         description: No PDF files found for the project ID.
 *       500:
 *         description: Error finding PDF files.
 */
router.get('/process-project/:projectId', pdfController.processProjectPdfs);


module.exports = router;
