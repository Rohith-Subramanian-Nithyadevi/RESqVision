# Cloud Deployment Guide (RESqVision)

This guide helps you deploy the RESqVision system to the cloud using Render (Backend) and Vercel (Frontend).

## 1. Push to GitHub
I have already initialized git and committed your code. You need to push it to your repository:
```bash
git push -u origin main
```
*If prompted for credentials, please enter your GitHub username and Personal Access Token (or sign in via browser).*

## 2. Deploy Backend to Render
1.  **Login to Render**: [render.com](https://render.com)
2.  **New Web Service**: Connect your GitHub repository `RESqVision`.
3.  **Configure Service**:
    *   **Name**: `resqvision-backend`
    *   **Root Directory**: `backend-layer`
    *   **Runtime**: `Python 3`
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
4.  **Environment Variables**:
    *   `MONGO_URI`: **IMPORTANT**: You must use a cloud database (like MongoDB Atlas). Localhost will not work.
    *   `TWILIO_SID`: (From your .env)
    *   `TWILIO_TOKEN`: (From your .env)
    *   `TWILIO_PHONE`: (From your .env)
    *   `SENDGRID_KEY`: (From your .env)
    *   `FROM_EMAIL`: (From your .env)

## 3. Deploy Frontend to Vercel
1.  **Login to Vercel**: [vercel.com](https://vercel.com)
2.  **Add New Project**: Import the `RESqVision` repository.
3.  **Configure Project**:
    *   **Root Directory**: `frontend-layer`
    *   **Framework Preset**: `Vite`
    *   **Build Command**: `npm run build`
    *   **Output Directory**: `dist`
4.  **Environment Variables**:
    *   `VITE_WS_URL`: Set this to `wss://your-backend-name.onrender.com/ws/frontend`
    *   `VITE_AI_URL`: If your AI layer runs locally, you can use `http://localhost:5000` (works if you browse from the same PC) or use an `ngrok` tunnel for remote access.

## 4. AI Layer (Processing)
The `ai-layer` scans for cameras on your local network. It is recommended to **run this layer locally** on the computer that has access to your cameras:
```bash
cd ai-layer
python main.py
```
If you want the cloud-hosted frontend to talk to your local AI from anywhere, use **ngrok**:
```bash
ngrok http 5000
```
Then update the `VITE_AI_URL` in Vercel to your ngrok URL.
