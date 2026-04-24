# Cloud Deployment Guide (RESqVision)

## Live URLs
- **Frontend (Vercel)**: https://resqvision-dun.vercel.app/
- **Backend (Render)**: https://resqvision-backend.onrender.com

---

## 1. Push to GitHub
```bash
git add -A
git commit -m "Full codebase audit fixes: auth, routing, config, cloud deploy"
git push -u origin main
```

## 2. Backend on Render — Already Deployed ✅
**Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Required Environment Variables (set in Render Dashboard):
| Variable | Value |
|----------|-------|
| `MONGO_URI` | *(your MongoDB Atlas connection string)* |
| `TWILIO_SID` | *(from your .env)* |
| `TWILIO_TOKEN` | *(from your .env)* |
| `TWILIO_PHONE` | *(from your .env)* |
| `SENDGRID_KEY` | *(from your .env)* |
| `FROM_EMAIL` | *(from your .env)* |

> **Important**: After pushing the new code, go to Render Dashboard → Manual Deploy → "Clear build cache & deploy" to pick up the new auth endpoints.

## 3. Frontend on Vercel — CRITICAL ENV VARS NEEDED ⚠️
These must be set in **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://resqvision-backend.onrender.com` |
| `VITE_WS_URL` | `wss://resqvision-backend.onrender.com/ws/frontend` |
| `VITE_AI_URL` | `http://localhost:5000` |

> **CRITICAL**: After adding these variables, you must **redeploy** the frontend. Vite bakes `VITE_*` vars into the JS bundle at build time. Without redeployment, the frontend will still try to connect to `localhost:8000`.

### Steps:
1. Go to https://vercel.com → your project → Settings → Environment Variables
2. Add the 3 variables above
3. Go to Deployments → click "..." on latest → Redeploy

## 4. Distributing the AI Layer to Users
The architecture is **Local-AI + Cloud-UI**:
- Frontend and Backend run in the cloud (Vercel/Render)
- AI processing runs on the user's local PC

### For end users:
1. Visit https://resqvision-dun.vercel.app/ and register an account
2. Download and unzip the `ai-layer` folder
3. Double-click `install_and_run.bat` — it auto-installs dependencies and connects to the cloud backend
4. Open the dashboard in their browser to manage cameras and alerts

### The `install_and_run.bat` is pre-configured to:
- Connect to `wss://resqvision-backend.onrender.com/ws/ai`
- Send alerts tagged with the user's ID
