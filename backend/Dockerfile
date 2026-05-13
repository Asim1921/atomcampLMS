FROM python:3.11-slim

WORKDIR /repo

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/repo/backend
ENV ATOMADAPT_ROOT=/repo

COPY backend/requirements.txt /repo/backend/requirements.txt
RUN pip install --no-cache-dir -r /repo/backend/requirements.txt

COPY backend/app /repo/backend/app
COPY data /repo/data
COPY ml /repo/ml

WORKDIR /repo/backend

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
