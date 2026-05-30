// ============================================
// ThinkMark - Secure Backend Server
// Team Firefox | Ideathon 2026
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

// ============================================
// USERS — Add/edit team members here manually
// To change password: run this in terminal:
// node -e "const b=require('bcryptjs');console.log(b.hashSync('NewPassword123',10))"
// Then paste the hash below
// ============================================
const USERS = [
  {
    id: '1',
    name: 'T. Madhan',
    email: 'madhan@thinkmark.com',
    // password: Madhan@2026
    password: '$2b$10$PAYmakvElrSV6sWWhT/kwuQuvDSSZNqFeFrvppG/wBm9gfj2XWSzO',
    role: 'admin' // admin = sees everything + monitoring
  },
  {
    id: '2',
    name: 'M. Kalishwar',
    email: 'kalishwar@thinkmark.com',
    // password: Kalish@2026
    password: '$2b$10$sNrjIONnvxhalG8IiJAMYefiRXYplt0bgxAKujv.G9ZC.1cO2z442',
    role: 'teacher' // teacher = scan and grade only
  },
  {
    id: '3',
    name: 'L. Ramraj',
    email: 'ramraj@thinkmark.com',
    // password: Ramraj@2026
    password: '$2b$10$CxjdIGf4yIbWTIflcDxQTegJZ.IFht/LoNjoor.8CHvXvDcDcHPNi',
    role: 'teacher'
  },
  {
    id: '4',
    name: 'SK. Divyanand',
    email: 'divyanand@thinkmark.com',
    // password: Divy@2026
    password: '$2b$10$l3ULeG.3S4qlFiJOzbUtTe0On5fn5NqxyEzOxTChhNlkBP9sRB7BS',
    role: 'teacher'
  }
];

// ============================================
// IN-MEMORY DATABASE
// ============================================
const db = {
  teachers: USERS,
  exams: [],
  results: [],
  students: [],
  scannedPapers: new Set(),
  // live activity log for admin monitoring
  activityLog: [],
  // security log for admin
  securityLog: []
};

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// 1. Helmet - sets secure HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. CORS - only allow your Netlify frontend
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://thinkmark.netlify.app' // your Netlify URL
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 3. Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Global rate limiter - stops flooding attacks
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// 5. Stricter rate limiter for login - stops brute force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // only 5 login attempts per 15 min
  message: { error: 'Too many login attempts. Account locked for 15 minutes.' }
});

// 6. Scan limiter - stops repeated scan attacks
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 scans per minute
  message: { error: 'Scanning too fast. Please slow down.' }
});

// ============================================
// FILE UPLOAD SECURITY
// ============================================
const storage = multer.memoryStorage(); // store in memory, not disk

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // max 5MB per image
    files: 1 // only 1 file at a time
  },
  fileFilter: (req, file, cb) => {
    // ONLY allow image files
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP images allowed!'));
    }
  }
});

// ============================================
// JWT AUTH MIDDLEWARE
// ============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'thinkmark-secret-key-change-in-production');
    req.teacher = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token. Please login again.' });
  }
};

// ============================================
// INPUT SANITIZER - prevents injection attacks
// ============================================
const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[<>\"']/g, '') // remove HTML/script chars
    .substring(0, 500); // limit length
};

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ThinkMark Backend Running',
    version: '1.0.0',
    team: 'Firefox',
    secure: true
  });
});

// ============================================
// AUTH ROUTES
// ============================================

// POST /api/auth/login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find teacher
    const teacher = db.teachers.find(t => t.email === email.toLowerCase().trim());
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    if (!teacher) {
      // Log failed attempt
      db.securityLog.unshift({
        time: new Date().toISOString(),
        event: 'Failed login — email not found',
        ip, action: 'Blocked', level: 'danger'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, teacher.password);
    if (!validPassword) {
      // Log failed password
      db.securityLog.unshift({
        time: new Date().toISOString(),
        event: `Failed login — wrong password for ${teacher.name}`,
        ip, action: 'Blocked', level: 'danger'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token (expires in 8 hours - one school day)
    const token = jwt.sign(
      {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
        role: teacher.role
      },
      process.env.JWT_SECRET || 'thinkmark-secret-key-change-in-production',
      { expiresIn: '8h' }
    );

    // Log successful login
    db.securityLog.unshift({
      time: new Date().toISOString(),
      event: `${teacher.role === 'admin' ? 'Admin' : 'Teacher'} login — ${teacher.name}`,
      ip, action: 'JWT issued — 8hr session', level: 'ok'
    });

    // Track online status
    teacher.lastLogin = new Date().toISOString();
    teacher.lastIp = ip;
    teacher.online = true;

    res.json({
      success: true,
      token,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: teacher.role
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // In production: add token to blacklist in Redis
  res.json({ success: true, message: 'Logged out successfully' });
});

// ============================================
// EXAM SETUP ROUTES (Teacher only)
// ============================================

// POST /api/exam/create - Create new exam with answer key
app.post('/api/exam/create', authenticateToken, (req, res) => {
  try {
    const {
      subject, className, totalMarks, passMarks,
      questions, answerKey, spellingLeniency
    } = req.body;

    // Validate
    if (!subject || !totalMarks || !answerKey) {
      return res.status(400).json({ error: 'Subject, marks and answer key required' });
    }

    const exam = {
      id: uuidv4(),
      subject: sanitize(subject),
      className: sanitize(className),
      totalMarks: parseInt(totalMarks),
      passMarks: parseInt(passMarks) || Math.floor(totalMarks * 0.5),
      questions: Array.isArray(questions) ? questions.map(q => sanitize(q)) : [],
      answerKey: sanitize(answerKey),
      spellingLeniency: spellingLeniency || 'high',
      createdBy: req.teacher.id,
      createdAt: new Date().toISOString(),
      active: true
    };

    db.exams.push(exam);

    res.json({
      success: true,
      examId: exam.id,
      message: 'Exam created successfully'
    });

  } catch (err) {
    console.error('Exam create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/exam/list - Get all exams
app.get('/api/exam/list', authenticateToken, (req, res) => {
  const exams = db.exams.map(e => ({
    id: e.id,
    subject: e.subject,
    className: e.className,
    totalMarks: e.totalMarks,
    passMarks: e.passMarks,
    createdAt: e.createdAt,
    active: e.active,
    resultCount: db.results.filter(r => r.examId === e.id).length
  }));
  res.json({ success: true, exams });
});

// ============================================
// SCAN / GRADING ROUTE (Most important + secure)
// ============================================

// POST /api/scan/grade - Scan and grade answer sheet
app.post('/api/scan/grade', authenticateToken, scanLimiter, upload.single('image'), async (req, res) => {
  try {
    const { studentName, rollNumber, examId, barcodeData } = req.body;

    // 1. Validate all inputs
    if (!studentName || !rollNumber || !examId) {
      return res.status(400).json({ error: 'Student name, roll number and exam ID required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Answer sheet image required' });
    }

    // 2. Find exam - server side, not from client
    const exam = db.exams.find(e => e.id === examId && e.active);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // 3. SECURITY: Check if this paper was already scanned
    // Prevents student from scanning same paper multiple times
    const scanKey = `${sanitize(rollNumber)}_${examId}`;
    if (db.scannedPapers.has(scanKey)) {
      return res.status(409).json({
        error: 'This answer sheet has already been scanned!',
        message: 'Each student can only be scanned once per exam.'
      });
    }

    // 4. SECURITY: Validate barcode matches student
    // In production: barcode on each paper is unique and pre-assigned
    if (barcodeData) {
      const expectedBarcode = `TM-${sanitize(rollNumber)}-${examId.substring(0, 8)}`;
      if (sanitize(barcodeData) !== expectedBarcode) {
        console.warn(`Barcode mismatch for roll: ${rollNumber}`);
        // Log suspicious activity but continue for demo
      }
    }

    // 5. Convert image to base64 for Gemini API
    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    // 6. Call Gemini API - API key ONLY on backend, never exposed to frontend
    const geminiResponse = await callGeminiAPI(
      imageBase64,
      mimeType,
      exam.answerKey,
      exam.questions,
      exam.totalMarks,
      exam.spellingLeniency,
      exam.subject
    );

    // 7. SECURITY: Validate AI response - never trust raw AI output
    const marks = validateAndSanitizeMarks(geminiResponse, exam.totalMarks);

    // 8. Calculate result - ALL on server side
    const totalObtained = marks.questions.reduce((sum, q) => sum + q.obtained, 0);
    const passed = totalObtained >= exam.passMarks;
    const percentage = Math.round((totalObtained / exam.totalMarks) * 100);

    // 9. Save result to database
    const result = {
      id: uuidv4(),
      examId,
      studentName: sanitize(studentName),
      rollNumber: sanitize(rollNumber),
      subject: exam.subject,
      className: exam.className,
      marks: marks.questions,
      totalObtained,
      totalMarks: exam.totalMarks,
      passMarks: exam.passMarks,
      passed,
      percentage,
      aiAnalysis: sanitize(marks.analysis || ''),
      scannedBy: req.teacher.id,
      scannedAt: new Date().toISOString()
    };

    db.results.push(result);

    // 10. Mark paper as scanned - prevents re-scanning
    db.scannedPapers.add(scanKey);

    // 11. Return result to frontend
    res.json({
      success: true,
      result: {
        id: result.id,
        studentName: result.studentName,
        rollNumber: result.rollNumber,
        subject: result.subject,
        marks: result.marks,
        totalObtained,
        totalMarks: exam.totalMarks,
        passed,
        percentage,
        analysis: result.aiAnalysis
      }
    });

  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: 'Scanning failed. Please try again.' });
  }
});

// ============================================
// GEMINI API CALL - Secure server-side only
// ============================================
async function callGeminiAPI(imageBase64, mimeType, answerKey, questions, totalMarks, leniency, subject) {
  const API_KEY = process.env.GEMINI_API_KEY; // NEVER expose this to frontend

  if (!API_KEY) {
    // Demo mode - return mock result if no API key
    return mockGeminiResponse(totalMarks);
  }

  const prompt = `You are ThinkMark AI, an expert exam evaluator for Tamil Nadu schools.

SUBJECT: ${subject}
ANSWER KEY: ${answerKey}
TOTAL MARKS: ${totalMarks}
SPELLING LENIENCY: ${leniency} (${leniency === 'high' ? 'Ignore spelling mistakes, focus on content' : 'Check spelling carefully'})

Look at this handwritten answer sheet image carefully.
Evaluate each answer against the answer key provided.
Give marks for each question based on content understanding, not spelling.
Support Tamil, English, Math equations, graphs and diagrams.

Return ONLY this JSON format, nothing else:
{
  "questions": [
    {"question": 1, "obtained": 13, "max": 16, "feedback": "Good explanation"},
    {"question": 2, "obtained": 14, "max": 16, "feedback": "Correct concept"},
    {"question": 3, "obtained": 8, "max": 18, "feedback": "Partial answer"}
  ],
  "analysis": "Student shows good understanding of core concepts."
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1, // low temperature = consistent results
          maxOutputTokens: 1000
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON from AI response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid AI response format');

  return JSON.parse(jsonMatch[0]);
}

// Mock response for demo without API key
function mockGeminiResponse(totalMarks) {
  const q1 = Math.floor(Math.random() * 4) + 12;
  const q2 = Math.floor(Math.random() * 4) + 11;
  const q3 = Math.floor(Math.random() * 6) + 10;
  return {
    questions: [
      { question: 1, obtained: q1, max: 16, feedback: 'Good understanding of concepts' },
      { question: 2, obtained: q2, max: 16, feedback: 'Correct approach, minor errors' },
      { question: 3, obtained: q3, max: 18, feedback: 'Partial answer, needs improvement' }
    ],
    analysis: 'Student demonstrates reasonable understanding of the subject matter.'
  };
}

// ============================================
// SECURITY: Validate AI marks - never trust raw AI
// ============================================
function validateAndSanitizeMarks(aiResponse, totalMarks) {
  try {
    const questions = aiResponse.questions.map(q => ({
      question: parseInt(q.question) || 1,
      // SECURITY: Clamp marks between 0 and max - AI cannot give more than max!
      obtained: Math.max(0, Math.min(parseInt(q.obtained) || 0, parseInt(q.max) || 16)),
      max: parseInt(q.max) || 16,
      feedback: sanitize(q.feedback || '')
    }));

    // SECURITY: Verify total doesn't exceed totalMarks
    const sum = questions.reduce((s, q) => s + q.obtained, 0);
    if (sum > totalMarks) {
      // Proportionally reduce if AI gave too many marks
      const factor = totalMarks / sum;
      questions.forEach(q => { q.obtained = Math.floor(q.obtained * factor); });
    }

    return {
      questions,
      analysis: sanitize(aiResponse.analysis || '')
    };
  } catch (err) {
    // If validation fails, return zero marks and flag for review
    console.error('Mark validation error:', err);
    return {
      questions: [{ question: 1, obtained: 0, max: totalMarks, feedback: 'Manual review required' }],
      analysis: 'AI evaluation failed. Please review manually.'
    };
  }
}

// ============================================
// RESULTS ROUTES
// ============================================

// GET /api/results/:examId - Get all results for an exam
app.get('/api/results/:examId', authenticateToken, (req, res) => {
  const { examId } = req.params;
  const results = db.results
    .filter(r => r.examId === examId)
    .map(r => ({
      id: r.id,
      studentName: r.studentName,
      rollNumber: r.rollNumber,
      totalObtained: r.totalObtained,
      totalMarks: r.totalMarks,
      percentage: r.percentage,
      passed: r.passed,
      scannedAt: r.scannedAt
    }))
    .sort((a, b) => b.totalObtained - a.totalObtained); // sort by marks desc

  // Add ranks
  results.forEach((r, i) => { r.rank = i + 1; });

  res.json({ success: true, results });
});

// GET /api/results/student/:rollNumber - Get student history
app.get('/api/results/student/:rollNumber', authenticateToken, (req, res) => {
  const { rollNumber } = req.params;
  const results = db.results
    .filter(r => r.rollNumber === sanitize(rollNumber))
    .map(r => ({
      id: r.id,
      subject: r.subject,
      totalObtained: r.totalObtained,
      totalMarks: r.totalMarks,
      percentage: r.percentage,
      passed: r.passed,
      scannedAt: r.scannedAt
    }));

  res.json({ success: true, results });
});

// GET /api/dashboard/stats - Dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const totalScanned = db.results.length;
  const totalPassed = db.results.filter(r => r.passed).length;
  const passRate = totalScanned > 0 ? Math.round((totalPassed / totalScanned) * 100) : 0;
  const avgScore = totalScanned > 0
    ? Math.round(db.results.reduce((s, r) => s + r.percentage, 0) / totalScanned)
    : 0;

  res.json({
    success: true,
    stats: {
      totalScanned,
      totalPassed,
      passRate,
      avgScore,
      totalExams: db.exams.length
    }
  });
});

// ============================================
// ERROR HANDLERS
// ============================================

// Handle file upload errors
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Image too large. Max 5MB allowed.' });
  }
  if (err.message === 'Only JPEG, PNG, WEBP images allowed!') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════╗
  ║   ThinkMark Backend Running    ║
  ║   Team Firefox | Ideathon 2026 ║
  ╠════════════════════════════════╣
  ║   Port    : ${PORT}               ║
  ║   Secure  : YES                ║
  ║   Auth    : JWT                ║
  ║   AI      : Gemini 2.0 Flash   ║
  ╚════════════════════════════════╝
  `);
});

module.exports = app;

// ADMIN ONLY MIDDLEWARE
const adminOnly = (req, res, next) => {
  if (req.teacher.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

// GET /api/admin/teachers
app.get('/api/admin/teachers', authenticateToken, adminOnly, (req, res) => {
  const teachers = db.teachers.map(t => ({
    id: t.id, name: t.name, email: t.email, role: t.role,
    scanCount: t.scanCount || 0, lastLogin: t.lastLogin || null,
    lastIp: t.lastIp || null, online: t.online || false
  }));
  res.json({ success: true, teachers });
});

// GET /api/admin/activity
app.get('/api/admin/activity', authenticateToken, adminOnly, (req, res) => {
  res.json({ success: true, activity: db.activityLog.slice(0, 50) });
});

// GET /api/admin/security
app.get('/api/admin/security', authenticateToken, adminOnly, (req, res) => {
  res.json({ success: true, securityLog: db.securityLog.slice(0, 100) });
});

// GET /api/admin/stats
app.get('/api/admin/stats', authenticateToken, adminOnly, (req, res) => {
  const totalScanned = db.results.length;
  const totalPassed = db.results.filter(r => r.passed).length;
  const passRate = totalScanned > 0 ? Math.round((totalPassed / totalScanned) * 100) : 0;
  const subjectMap = {};
  db.results.forEach(r => { subjectMap[r.subject] = (subjectMap[r.subject] || 0) + 1; });
  res.json({ success: true, stats: {
    totalScanned, totalPassed, passRate,
    activeTeachers: db.teachers.filter(t => t.online).length,
    totalTeachers: db.teachers.length,
    totalExams: db.exams.length,
    securityAlerts: db.securityLog.filter(s => s.level === 'danger').length,
    subjectBreakdown: subjectMap
  }});
});
