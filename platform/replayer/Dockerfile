FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir pymongo requests

COPY replayer.py .

CMD ["python", "-u", "replayer.py"]
