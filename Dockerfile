# ============================================================
# AniSearch — Full-stack Dockerfile (frontend + backend)
# ============================================================
# Stage 1: Build the React frontend
# Stage 2: Production image with Nginx (frontend) + Uvicorn (backend)
# ============================================================

# --- Stage 1: Build frontend ---
FROM node:22-slim AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production ---
FROM python:3.13-slim

# Install nginx + supervisor
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx supervisor curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/
COPY build_db.py ./build_db.py

# Copy built frontend into nginx html dir
COPY --from=frontend-build /build/dist /usr/share/nginx/html

# Nginx config: serve frontend + reverse proxy /api → uvicorn
RUN cat > /etc/nginx/sites-available/default <<'EOF'
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Frontend — SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API — proxy to uvicorn
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }
}
EOF

# Supervisor config: run both nginx and uvicorn
RUN cat > /etc/supervisor/conf.d/anisearch.conf <<'EOF'
[supervisord]
nodaemon=true

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:uvicorn]
command=uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers %(ENV_UVICORN_WORKERS)s
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

# Expose only port 80 (nginx serves both frontend and proxies API)
EXPOSE 80

# Environment variables
ENV REDIS_URL=redis://redis:6379
ENV ADMIN_TOKEN=""
ENV ALLOWED_ORIGINS=""
ENV UVICORN_WORKERS="1"

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=60s \
  --retries=3 \
  CMD curl -f http://localhost/api/status || exit 1

CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
