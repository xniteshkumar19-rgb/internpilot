// ==========================================
// GEMINI MODEL CONFIGURATION
// (Easy to change model name constant or env var)
// ==========================================
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse not available:', e.message);
}

let mammoth = null;
try {
  mammoth = require('mammoth');
} catch (e) {
  console.warn('mammoth not available:', e.message);
}

// 0. POST /api/parse-resume
// Parses PDF, DOCX, or TXT file sent as base64 or raw text locally and securely
app.post('/api/parse-resume', async (req, res) => {
  try {
    const { filename, fileData, fileType } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    const name = (filename || '').toLowerCase();
    const isPdf = name.endsWith('.pdf') || (fileType && fileType.includes('pdf'));
    const isDocx = name.endsWith('.docx') || (fileType && (fileType.includes('word') || fileType.includes('officedocument')));

    // Handle base64 buffer or plain string
    let buffer;
    if (typeof fileData === 'string' && fileData.includes(';base64,')) {
      const base64Str = fileData.split(';base64,')[1];
      buffer = Buffer.from(base64Str, 'base64');
    } else if (typeof fileData === 'string') {
      buffer = Buffer.from(fileData, 'base64');
    } else {
      buffer = Buffer.from(fileData);
    }

    let extractedText = '';

    if (isPdf) {
      if (!pdfParse) {
        return res.status(500).json({ error: 'PDF parser not installed on server' });
      }
      const data = await pdfParse(buffer);
      extractedText = data.text || '';
    } else if (isDocx) {
      if (!mammoth) {
        return res.status(500).json({ error: 'DOCX parser not installed on server' });
      }
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value || '';
    } else {
      // Treat as plain text
      extractedText = buffer.toString('utf8');
    }

    // Clean up excessive whitespace while preserving structure
    extractedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    return res.json({
      text: extractedText,
      filename: filename || 'resume',
      characterCount: extractedText.length
    });
  } catch (err) {
    console.error('Error in /api/parse-resume:', err);
    return res.status(500).json({ error: 'Failed to parse resume file: ' + err.message });
  }
});

// 1. POST /api/gemini
// Calls Gemini API securely without exposing GEMINI_API_KEY to browser
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, responseMimeType } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt string is required', code: 'INVALID_PROMPT' });
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
    if (!apiKey) {
      return res.status(503).json({
        error: 'AI service is not configured.',
        code: 'API_KEY_MISSING'
      });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const generationConfig = {
      temperature: 0.2,
      maxOutputTokens: 800
    };
    if (responseMimeType === 'application/json' || (prompt.includes('JSON') && !prompt.includes('text/plain'))) {
      generationConfig.responseMimeType = 'application/json';
    }

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`Gemini API error (HTTP ${apiResponse.status}):`, errorText);

      let friendlyMessage = 'AI service encountered an error.';
      let errorCode = 'API_ERROR';

      if (apiResponse.status === 400) {
        if (errorText.includes('API_KEY_INVALID') || errorText.includes('not valid') || errorText.includes('API key')) {
          friendlyMessage = 'AI service is not configured.';
          errorCode = 'API_KEY_INVALID';
        } else {
          friendlyMessage = 'The AI returned an unexpected response.';
          errorCode = 'INVALID_REQUEST';
        }
      } else if (apiResponse.status === 401 || apiResponse.status === 403) {
        friendlyMessage = 'AI service is not configured.';
        errorCode = 'API_KEY_INVALID';
      } else if (apiResponse.status === 429) {
        friendlyMessage = 'AI request limit reached. Please try again later.';
        errorCode = 'RATE_LIMIT';
      } else if (apiResponse.status >= 500) {
        friendlyMessage = 'AI service is temporarily unavailable. Please retry.';
        errorCode = 'SERVICE_OVERLOADED';
      }

      return res.status(apiResponse.status).json({
        error: friendlyMessage,
        code: errorCode
      });
    }

    const data = await apiResponse.json();
    const candidate = data.candidates?.[0];
    const answer = candidate?.content?.parts?.[0]?.text || '';
    const finishReason = candidate?.finishReason;

    if (!answer) {
      if (finishReason && finishReason !== 'STOP') {
        return res.status(422).json({
          error: 'The AI returned an unexpected response.',
          code: 'FILTERED_RESPONSE',
          finishReason
        });
      }
      return res.status(502).json({
        error: 'The AI returned an unexpected response.',
        code: 'EMPTY_RESPONSE'
      });
    }

    return res.json({ answer });
  } catch (err) {
    console.error('Server error in /api/gemini:', err.message);
    return res.status(503).json({
      error: 'Unable to connect to the AI service.',
      code: 'NETWORK_ERROR'
    });
  }
});

// 2. GET /api/test-postings
// Serves sample postings for dropdown testing
app.get('/api/test-postings', (req, res) => {
  try {
    const postingsPath = path.join(__dirname, 'test-postings.json');
    const content = fs.readFileSync(postingsPath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(content);
  } catch (err) {
    console.error('Error reading test-postings.json:', err);
    res.status(500).json({ error: 'Could not load test postings' });
  }
});

// 3. GET /api/sample-resume
// Serves sample resume text
app.get('/api/sample-resume', (req, res) => {
  try {
    const resumePath = path.join(__dirname, 'sample-resume.txt');
    const content = fs.readFileSync(resumePath, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.send(content);
  } catch (err) {
    console.error('Error reading sample-resume.txt:', err);
    res.status(500).json({ error: 'Could not load sample resume' });
  }
});

app.listen(PORT, () => {
  console.log(`InternPilot server running at http://localhost:${PORT}`);
});
