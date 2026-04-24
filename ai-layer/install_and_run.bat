@echo off
echo ========================================================
echo        RESqVision AI Core - Automated Installer
echo ========================================================
echo.
echo Installing requirements... Please wait.
echo.

:: Check if Python is installed
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in your PATH. 
    echo Please install Python 3.9+ from python.org and check "Add to PATH".
    pause
    exit /b
)

:: Create Virtual Environment silently
if not exist "venv" (
    echo Initializing Virtual Environment...
    python -m venv venv
)

:: Activate venv and install requirements
call venv\Scripts\activate.bat
echo Installing Dependencies...
echo WARNING: Downloading PyTorch and YOLO can take 5-15 minutes (2GB+). 
echo Please DO NOT close this window. You will see download progress below.
pip install -r requirements.txt

echo.
echo ========================================================
echo    Installation Complete! Starting the AI Core...
echo    You can now minimize this window and open your 
echo    RESqVision Cloud Dashboard.
echo ========================================================
echo.

:: Start the FastAPI server
python -m uvicorn main:app --host 0.0.0.0 --port 5000 
pause
