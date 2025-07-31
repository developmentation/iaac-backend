
const mongoose = require('mongoose');

const GeminiResponseSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  geminiResponse: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('GeminiResponse', GeminiResponseSchema);
