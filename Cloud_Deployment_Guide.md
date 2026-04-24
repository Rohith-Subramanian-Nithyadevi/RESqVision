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
    *   `MONGO_URI`: `mongodb+srv://rohithsn18_db_user:resqvision@cluster0.faxvqqh.mongodb.net/?appName=Cluster0`
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

## 4. Distributing the AI Layer to Users
You have chosen a **Local-AI / Cloud-UI Architecture**. 
This means you host the Frontend and Backend on Vercel/Render, but your users run the AI on their own PCs.

1. **Package the AI Layer**: 
   Zip the entire `ai-layer` folder (including the heavy `.pt` files and the new `install_and_run.bat`).
2. **Host the ZIP**: 
   Upload `RESqVision_Installer.zip` to your Vercel `public` folder, or Google Drive, and link it to your Landing Page's Download button.
3. **User Flow**:
   - The user visits your Vercel website and registers an account.
   - The user downloads and unzips the `ai-layer`.
   - They double-click `install_and_run.bat`. It will automatically install Python dependencies and start the AI engine.
   - The AI engine will connect to your cloud Backend via `VITE_WS_URL` and send its alerts bound exclusively to their User ID!
