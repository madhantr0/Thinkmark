# ThinkMark Backend
### Team Firefox | Ideathon 2026 | Erode Sengunthar Engineering College

---

## Security Features

| Feature | What it does |
|---------|-------------|
| JWT Auth | Teacher login token, expires in 8 hours |
| Helmet.js | Secure HTTP headers, blocks common attacks |
| Rate Limiting | 5 login attempts per 15 min, stops brute force |
| Scan Limiter | Max 10 scans per minute |
| CORS | Only your Netlify frontend can access |
| Input Sanitizer | Removes HTML/script injection characters |
| File Validation | Only JPEG/PNG/WEBP, max 5MB |
| Mark Validation | AI cannot give more than max marks |
| Re-scan Block | Each roll number scanned only once per exam |
| API Key Hidden | Gemini key never sent to frontend |

---

## Quick Start

### Step 1 - Install
```bash
npm install
```

### Step 2 - Setup environment
```bash
cp .env.example .env
# Edit .env and add your Gemini API key
```

### Step 3 - Run locally
```bash
npm start
# Server runs on http://localhost:5000
```

---

## Deploy to Render.com (FREE)

1. Push code to GitHub
2. Go to render.com
3. Click New → Web Service
4. Connect your GitHub repo
5. Settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Add Environment Variables:
   - `GEMINI_API_KEY` = your key
   - `JWT_SECRET` = random long string
   - `FRONTEND_URL` = your Netlify URL
7. Click Deploy!

---

## API Endpoints

### Auth
- `POST /api/auth/login` — Teacher login
- `POST /api/auth/logout` — Logout

### Exam Setup
- `POST /api/exam/create` — Create exam + answer key
- `GET /api/exam/list` — List all exams

### Scanning
- `POST /api/scan/grade` — Scan and grade answer sheet

### Results
- `GET /api/results/:examId` — Get class results
- `GET /api/results/student/:rollNumber` — Student history
- `GET /api/dashboard/stats` — Dashboard stats

---

## Default Login (Change in production!)
- Email: `teacher@thinkmark.com`
- Password: `thinkmark123`

---

## Get Free Gemini API Key
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy key to .env file
4. Free tier: 1500 requests/day

---

## Team Firefox
- T. Madhan — Project Lead
- M. Kalishwar — Hardware
- L. Ramraj — Research
- SK. Divyanand — Design
