// ==========================================
// GEMINI MODEL CONFIGURATION
// (Easy to change model name constant at top)
// ==========================================
const GEMINI_MODEL = "gemini-1.5-flash";

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 1. POST /api/gemini
// Calls Gemini API securely without exposing GEMINI_API_KEY to browser
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt string is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured in .env file. Please add your Gemini API key.'
      });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

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
        generationConfig: {
          temperature: 0.2
        }
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`Gemini API returned ${apiResponse.status}:`, errorText);
      return res.status(apiResponse.status).json({
        error: `Gemini API error: ${apiResponse.statusText}`
      });
    }

    const data = await apiResponse.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.json({ answer });
  } catch (err) {
    console.error('Server error handling /api/gemini:', err);
    return res.status(500).json({ error: 'Internal server error while contacting Gemini API' });
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
