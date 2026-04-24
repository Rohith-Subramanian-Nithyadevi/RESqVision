FROM python:3.10-slim
WORKDIR /app
# Copy the requirements file first to use Docker's cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Then copy the rest of your code
COPY . .
# Render provides $PORT; default to 8000 for local Docker
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]