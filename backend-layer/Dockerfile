FROM python:3.10-slim
WORKDIR /app
# Copy the requirements file first to use Docker's cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Then copy the rest of your code
COPY . .
CMD ["python", "main.py"]