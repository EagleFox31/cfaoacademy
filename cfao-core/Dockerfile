FROM python:3.12-slim

# Contrats inter-modules : contracts/registry.json (vérifié par contracts/check.py).
LABEL org.cfao.module="cfao-core" \
      org.cfao.contracts.consumes="needs-analytics@^1"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
