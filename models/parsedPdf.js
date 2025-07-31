const mongoose = require('mongoose');

const ParsedPdfSchema = new mongoose.Schema({
  originalFilename: {
    type: String,
    required: true,
  },
  pageNumber: {
    type: Number,
    required: true,
  },

  geminiResponse: {
    type: String,
    required: true,
  },
  embeddingGeminiResponse: {
    type: [Number],
    required: true,
  },

  originalText: {
    type: String,
  },
  embeddingsOriginalText: {
    type: [Number],
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ParsedPdf', ParsedPdfSchema);