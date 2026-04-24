import subprocess
import time
import sys
import os
import platform

# Get the exact absolute path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- INSTRUCTIONS ---
# Ensure these folder names exactly match the folders on your machine!
BACKEND_DIR = os.path.join(BASE_DIR, "backend-layer")  
AI_DIR = os.path.join(BASE_DIR, "ai-layer")            
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend-layer")      

processes = []

try:
    print("0. Waking up MongoDB via Docker...")
    mongo_start = subprocess.run(["docker", "start", "local-mongo"], capture_output=True, text=True)
    
    if mongo_start.returncode != 0:
        print("   Container not found. Creating a fresh MongoDB container...")
        subprocess.run(["docker", "run", "-d", "-p", "27017:27017", "--name", "local-mongo", "mongo"])
    else:
        print("   Existing MongoDB container successfully started.")
        
    time.sleep(3) 

    print("\n1. Starting Backend Layer...")
    backend_process = subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"], cwd=BACKEND_DIR)
    processes.append(("Backend", backend_process))
    
    time.sleep(3) 

    print("2. Starting AI Layer (Webcam initializing)...")
    ai_process = subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"], cwd=AI_DIR)
    processes.append(("AI Layer", ai_process))

    print("3. Starting React Frontend...")
    # 'npm.cmd' is used here to ensure Windows handles it correctly
    frontend_process = subprocess.Popen("npm.cmd run dev", cwd=FRONTEND_DIR, shell=True)
    processes.append(("Frontend", frontend_process))

    print("\n✅ ALL SYSTEMS ONLINE! Your CCTV SOS system is running.")
    print("Open http://localhost:5173 to view the dashboard.")
    print("Press Ctrl+C in this terminal to shut everything down.\n")
    
    for name, p in processes:
        p.wait()

except KeyboardInterrupt:
    print("\nInitiating tactical shutdown...")
    
    for name, p in processes:
        print(f"   Stopping {name}...")
        try:
            if platform.system() == "Windows":
                # /F = Force kill, /T = Kill process tree (all children)
                subprocess.run(['taskkill', '/F', '/T', '/PID', str(p.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                p.terminate()
        except Exception as e:
            print(f"   Could not stop {name}: {e}")
            
    print("All processes successfully terminated. Goodbye!")