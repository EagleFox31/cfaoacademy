FROM python:3.12-slim AS dependances
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
COPY api/requirements.txt /tmp/requirements.txt
RUN /opt/venv/bin/pip install -r /tmp/requirements.txt

FROM python:3.12-slim
RUN useradd --create-home --uid 1000 service
COPY --from=dependances /opt/venv /opt/venv
WORKDIR /app
COPY --chown=service:service api/ /app/
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.base
USER service
EXPOSE 5180
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:5180 --workers 1 --threads 4 --timeout 60 --access-logfile -"]
