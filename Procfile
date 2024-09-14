release: cd frontend && npm install && npm run build && cd .. && rm -rf web && mv frontend/build web
web: gunicorn app:app
