FROM ultralytics/ultralytics:latest-cpu
WORKDIR /app
# Switch to root to ensure pip has permission to install
USER root
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]