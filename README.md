# ComplianceHUB — Full-Stack Compliance Management SaaS

A production-ready, multi-tenant compliance management platform built with **Django 4.2** (backend) and **React 18 + TypeScript** (frontend).

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Backend Setup](#backend-setup)
7. [Frontend Setup](#frontend-setup)
8. [Environment Variables](#environment-variables)
9. [Database Setup](#database-setup)
10. [Loading Initial Data](#loading-initial-data)
11. [Running the Application](#running-the-application)
12. [API Reference](#api-reference)
13. [Feature Overview](#feature-overview)
14. [Multi-Tenancy](#multi-tenancy)
15. [Role-Based Access Control](#role-based-access-control)
16. [Deployment](#deployment)
17. [Testing](#testing)
18. [Troubleshooting](#troubleshooting)

---

## Overview

ComplianceHUB helps organizations manage their compliance posture across multiple frameworks (ISO 27001, SOC 2, NIST, etc.). It provides:

- **Control Management** — Apply and track security controls
- **Evidence Management** — Upload, version, and link evidence to controls
- **Risk Management** — Register risks, assess them against controls, visualize with heat maps
- **Compliance Calculation** — Automated scoring against framework requirements
- **Gap Analysis** — Identify and remediate compliance gaps
- **Reporting** — Generate audit-ready compliance reports

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              React Frontend (Port 3000)      │
│  Vite · TypeScript · TanStack Query · Zustand│
└───────────────────┬─────────────────────────┘
                    │ HTTP / REST
┌───────────────────▼─────────────────────────┐
│            Django REST API (Port 8000)       │
│  DRF · SimpleJWT · drf-spectacular          │
├─────────────────────────────────────────────┤
│  core │ organizations │ library │ controls   │
│  evidence │ risk │ compliance               │
└───────────────────┬─────────────────────────┘
                    │
┌───────────────────▼─────────────────────────┐
│             PostgreSQL Database              │
└─────────────────────────────────────────────┘
```

### Multi-Tenancy Model

Application-level isolation using a shared database and shared schema:

- Every tenant-scoped model carries a `company` FK
- `TenantMiddleware` extracts `company_id` from the JWT and attaches it to `request.tenant`
- `TenantManager` auto-filters all querysets by `company_id`
- Cross-tenant data leakage is prevented at the ORM layer

---

## Tech Stack

### Backend

| Package                       | Version | Purpose                |
| ----------------------------- | ------- | ---------------------- |
| Django                        | 4.2 LTS | Web framework          |
| djangorestframework           | 3.14    | REST API               |
| djangorestframework-simplejwt | 5.3     | JWT authentication     |
| django-filter                 | 23.5    | Query filtering        |
| drf-spectacular               | 0.27    | OpenAPI / Swagger docs |
| django-cors-headers           | 4.3     | CORS handling          |
| psycopg2-binary               | 2.9     | PostgreSQL adapter     |
| Pillow                        | 10.2    | Image handling         |
| python-decouple               | 3.8     | Environment config     |

### Frontend

| Package               | Version     | Purpose                        |
| --------------------- | ----------- | ------------------------------ |
| React                 | 18.2        | UI framework                   |
| TypeScript            | 5.2         | Type safety                    |
| Vite                  | 5.0         | Build tool                     |
| React Router          | 6.21        | Client-side routing            |
| TanStack Query        | 5.17        | Server state management        |
| Zustand               | 4.4         | Client state management        |
| Tailwind CSS          | 3.4         | Utility-first styling          |
| Radix UI / shadcn     | latest      | Accessible UI components       |
| Recharts              | 2.10        | Charts and visualizations      |
| Axios                 | 1.6         | HTTP client                    |
| React Hook Form + Zod | 7.49 / 3.22 | Form management and validation |

---

## Project Structure

```
compliancehub/
├── backend/
│   ├── config/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── apps/
│   │   ├── core/           # Auth, users, companies, multi-tenancy
│   │   ├── organizations/  # Department hierarchy
│   │   ├── library/        # Framework & requirement library
│   │   ├── controls/       # Reference & applied controls
│   │   ├── evidence/       # File storage and evidence linking
│   │   ├── risk/           # Risk register and assessments
│   │   └── compliance/     # Scoring, gaps, reports
│   ├── manage.py
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── api/            # Axios API clients
    │   ├── components/     # Shared UI components
    │   ├── features/       # Feature modules
    │   │   ├── auth/
    │   │   ├── dashboard/
    │   │   ├── controls/
    │   │   ├── evidence/
    │   │   ├── risk/
    │   │   └── compliance/
    │   ├── hooks/          # Custom React hooks
    │   ├── lib/            # Utils, constants, formatters
    │   ├── stores/         # Zustand state stores
    │   ├── types/          # TypeScript type definitions
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
```

---

## Prerequisites

Ensure the following are installed on your system:

- **Python** 3.11+
- **Node.js** 20+
- **PostgreSQL** 15+
- **pip** and **virtualenv** (or `venv`)
- **npm** 10+

---

## Backend Setup

### 1. Clone and navigate

```bash
git clone https://github.com/your-org/compliancehub.git
cd compliancehub/backend
```

### 2. Create a virtual environment

```bash
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your values (see Environment Variables section)
```

### 5. Run migrations

```bash
python manage.py migrate
```

### 6. Create a superuser

```bash
python manage.py createsuperuser
```

### 7. Start the development server

```bash
python manage.py runserver
```

The API will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/api/docs/`

---

## Frontend Setup

### 1. Navigate to the frontend directory

```bash
cd compliancehub/frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Install Radix UI and shadcn/ui dependencies

```bash
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-slot class-variance-authority clsx tailwind-merge \
  tailwindcss-animate lucide-react recharts
```

### 5. Start the development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Environment Variables

### Backend — `.env`

```ini
# Django
SECRET_KEY=your-very-long-random-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DB_NAME=compliancehub
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000

# JWT
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_MINUTES=1440

# File Storage
MEDIA_ROOT=media/
MAX_EVIDENCE_FILE_SIZE_MB=100
EVIDENCE_STORAGE_QUOTA_GB=10

# Email (optional)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=noreply@example.com
EMAIL_HOST_PASSWORD=your_email_password
```

### Frontend — `.env`

```ini
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_NAME=ComplianceHUB
```

---

## Database Setup

### Create the PostgreSQL database

```bash
psql -U postgres
```

```sql
CREATE DATABASE compliancehub;
CREATE USER compliancehub_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE compliancehub TO compliancehub_user;
\q
```

### Run all migrations

```bash
cd backend
python manage.py migrate
```

### Verify migrations

```bash
python manage.py showmigrations
```

All apps should show `[X]` next to each migration.

---

## Loading Initial Data

### Option A — Django Admin

1. Visit `http://localhost:8000/admin/`
2. Log in with your superuser account
3. Use the admin interface to create:
   - **Stored Libraries** (framework packages)
   - **Frameworks** (ISO 27001, SOC 2, NIST CSF, etc.)
   - **Reference Controls** (control catalog)

### Option B — Management commands (recommended)

Create a custom management command to seed initial data:

```bash
python manage.py loaddata fixtures/frameworks.json
python manage.py loaddata fixtures/reference_controls.json
```

### Option C — API (Programmatic)

```bash
# Authenticate
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access'])")

# Create a stored library
curl -X POST http://localhost:8000/api/library/stored-libraries/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"ISO 27001:2022","version":"2022","description":"Information security standard"}'
```

### Create a default Risk Matrix

After setting up a company via the UI, create a default 5×5 risk matrix:

```bash
curl -X POST http://localhost:8000/api/risk/matrices/create_default/ \
  -H "Authorization: Bearer $TOKEN"
```

---

## Running the Application

### Development (both servers)

Terminal 1 — Backend:

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

Terminal 2 — Frontend:

```bash
cd frontend
npm run dev
```

### Using a process manager (optional)

Install `honcho` or `foreman` and create a `Procfile`:

```
web: cd backend && python manage.py runserver 0.0.0.0:8000
frontend: cd frontend && npm run dev
```

```bash
pip install honcho
honcho start
```

---

## API Reference

Interactive documentation is auto-generated by drf-spectacular:

| URL                                 | Description               |
| ----------------------------------- | ------------------------- |
| `http://localhost:8000/api/docs/`   | Swagger UI                |
| `http://localhost:8000/api/redoc/`  | ReDoc                     |
| `http://localhost:8000/api/schema/` | Raw OpenAPI schema (JSON) |

### Authentication

All endpoints require a Bearer token unless otherwise noted.

```bash
# Obtain tokens
POST /api/auth/token/
Body: { "email": "user@example.com", "password": "password" }

# Refresh token
POST /api/auth/token/refresh/
Body: { "refresh": "<refresh_token>" }
```

### Core Endpoints

| Method   | Endpoint                    | Description               |
| -------- | --------------------------- | ------------------------- |
| POST     | `/api/core/users/register/` | Register a new user       |
| GET      | `/api/core/users/me/`       | Get current user          |
| GET/POST | `/api/core/companies/`      | List / create companies   |
| GET/POST | `/api/core/memberships/`    | List / create memberships |

### Controls

| Method   | Endpoint                                                   | Description                        |
| -------- | ---------------------------------------------------------- | ---------------------------------- |
| GET      | `/api/controls/reference-controls/`                        | Browse control catalog             |
| GET/POST | `/api/controls/applied-controls/`                          | List / apply controls              |
| POST     | `/api/controls/applied-controls/apply_control/`            | Apply a single control             |
| POST     | `/api/controls/applied-controls/apply_framework_controls/` | Apply all controls for a framework |
| GET      | `/api/controls/applied-controls/dashboard/`                | Control dashboard metrics          |
| GET      | `/api/controls/applied-controls/overdue_reviews/`          | Controls with overdue reviews      |
| GET      | `/api/controls/applied-controls/with_deficiencies/`        | Controls with deficiencies         |

### Evidence

| Method   | Endpoint                                          | Description            |
| -------- | ------------------------------------------------- | ---------------------- |
| GET/POST | `/api/evidence/evidence/`                         | List / upload evidence |
| POST     | `/api/evidence/evidence/{id}/approve/`            | Approve evidence       |
| POST     | `/api/evidence/evidence/{id}/reject/`             | Reject evidence        |
| GET      | `/api/evidence/evidence/{id}/download/`           | Download file          |
| POST     | `/api/evidence/evidence/{id}/create_version/`     | Create new version     |
| GET      | `/api/evidence/evidence/analytics/`               | Evidence analytics     |
| POST     | `/api/evidence/control-evidence-links/bulk_link/` | Bulk link to controls  |

### Risk

| Method   | Endpoint                                    | Description          |
| -------- | ------------------------------------------- | -------------------- |
| GET/POST | `/api/risk/risks/`                          | Risk register        |
| GET      | `/api/risk/risks/summary/`                  | Risk summary stats   |
| GET      | `/api/risk/risks/heat_map/`                 | Heat map data        |
| GET      | `/api/risk/risks/top_risks/`                | Top risks by score   |
| POST     | `/api/risk/risks/{id}/assess_with_control/` | Link control to risk |
| GET/POST | `/api/risk/treatment-actions/`              | Treatment actions    |
| GET      | `/api/risk/matrices/active/`                | Active risk matrix   |

### Compliance

| Method   | Endpoint                                     | Description                    |
| -------- | -------------------------------------------- | ------------------------------ |
| POST     | `/api/compliance/results/calculate/`         | Calculate framework compliance |
| POST     | `/api/compliance/results/calculate_all/`     | Calculate all frameworks       |
| GET      | `/api/compliance/results/overview/`          | Multi-framework overview       |
| GET      | `/api/compliance/results/trends/`            | Compliance trend data          |
| GET      | `/api/compliance/results/gap_analysis/`      | Gap analysis data              |
| GET      | `/api/compliance/results/recommendations/`   | Prioritized recommendations    |
| GET/POST | `/api/compliance/adoptions/`                 | Framework adoptions            |
| POST     | `/api/compliance/adoptions/adopt_framework/` | Adopt a framework              |
| POST     | `/api/compliance/adoptions/{id}/certify/`    | Record certification           |
| POST     | `/api/compliance/reports/generate/`          | Generate a report              |

---

## Feature Overview

### Dashboard

- Control compliance score overview
- Status breakdown chart
- Evidence coverage indicator
- Key metrics at a glance

### Controls Management

- Browse the global reference control catalog
- Apply controls to your organization with one click
- Apply all controls for an entire framework
- Track implementation status and effectiveness ratings
- View overdue reviews and controls with deficiencies
- Link evidence to controls

### Evidence Management

- Upload files up to 100 MB (PDF, Office, images, logs, etc.)
- Auto-compute SHA-256 hash for integrity verification
- Approval workflow (pending → approved / rejected)
- Version control — create new versions of existing evidence
- Bulk link evidence to multiple controls
- Storage quota tracking with visual indicator
- Threaded comments for collaboration
- In-browser preview for images and PDFs

### Risk Management

- Risk register with full CRUD
- Inherent risk scoring (likelihood × impact)
- Link controls to risks with effectiveness ratings
- Residual risk calculation (automatic)
- Interactive 5×5 risk heat maps (inherent vs. residual)
- Treatment actions with progress tracking
- Risk event logging
- Analytics: top risks, trends, by-category breakdown

### Compliance

- Multi-framework compliance dashboard with radar chart
- Per-framework compliance score and letter grade
- Automated compliance calculation engine
- Requirement-level status tracking
- Gap analysis with severity classification (high / medium / low)
- Prioritized remediation recommendations
- Compliance trend charts (12-month history)
- Framework adoption management with certification tracking
- Report generation (executive summary, gap analysis, audit report, etc.)

---

## Multi-Tenancy

Every API request is scoped to a single company (tenant):

1. The user logs in and receives a JWT containing `company_id`
2. `TenantMiddleware` reads the JWT and sets `request.tenant = Company.objects.get(id=company_id)`
3. All querysets that inherit `TenantMixin` automatically filter by `company_id`
4. Serializers validate that related objects belong to the same company before saving

Users can belong to multiple companies. After login they are redirected to `/select-company` where they choose which company context to work in.

---

## Role-Based Access Control

| Role        | Permissions                                       |
| ----------- | ------------------------------------------------- |
| **owner**   | Full access including billing and user management |
| **admin**   | Create, update, delete any resource; manage users |
| **manager** | Create and update resources; delete own resources |
| **analyst** | Create evidence; update own records; read all     |
| **auditor** | Read all records; export reports                  |
| **viewer**  | Read own and assigned records only                |

Permissions are enforced via the `RolePermission` DRF permission class and checked in every viewset action.

---

## Deployment

### Backend — Production Checklist

1. Set `DEBUG=False` in `.env`
2. Set a strong, random `SECRET_KEY`
3. Configure `ALLOWED_HOSTS` with your domain
4. Use a production WSGI server:

```bash
pip install gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

5. Serve static files:

```bash
python manage.py collectstatic
```

6. Use Nginx to serve static/media files and proxy to Gunicorn:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location /static/ {
        alias /app/staticfiles/;
    }

    location /media/ {
        alias /app/media/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Frontend — Production Build

```bash
npm run build
# Output is in dist/
```

Serve the `dist/` directory with Nginx or any static file host (Vercel, Netlify, S3 + CloudFront):

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;
    root /app/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Docker (optional)

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
```

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```yaml
# docker-compose.yml
version: "3.9"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: compliancehub
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    env_file: ./backend/.env
    depends_on:
      - db
    ports:
      - "8000:8000"
    volumes:
      - ./backend/media:/app/media

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  pgdata:
```

```bash
docker compose up --build
```

---

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
python manage.py test

# Run tests for a specific app
python manage.py test apps.controls

# Run with coverage
pip install coverage
coverage run manage.py test
coverage report
coverage html  # generates htmlcov/index.html
```

### Frontend Tests

```bash
cd frontend

# Install test dependencies
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom

# Run tests
npm test

# Run with coverage
npm run coverage
```

### Example Backend Test

```python
# apps/controls/tests.py
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.core.models import Company, Membership

User = get_user_model()

class ControlAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(name="Test Co", plan="professional")
        self.user = User.objects.create_user(
            email="test@example.com", password="testpass123"
        )
        Membership.objects.create(
            user=self.user, company=self.company, role="admin"
        )

    def test_list_applied_controls(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/controls/applied-controls/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("results", response.data)
```

---

## Troubleshooting

### `ModuleNotFoundError` on backend startup

Make sure you activated the virtual environment and installed all dependencies:

```bash
source venv/bin/activate
pip install -r requirements.txt
```

### CORS errors in the browser

Ensure your frontend origin is listed in `CORS_ALLOWED_ORIGINS` in `.env`:

```ini
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### JWT token not working / 401 errors

- Confirm the token has not expired (default: 60 minutes)
- Confirm the `Authorization: Bearer <token>` header is being sent
- Check that `SIMPLE_JWT` settings in `settings.py` match expectations

### PostgreSQL connection refused

- Confirm PostgreSQL is running: `pg_isready`
- Confirm database credentials in `.env` match your PostgreSQL setup
- For Docker: ensure the `db` service is healthy before starting `backend`

### Evidence upload failing

- Check `MAX_EVIDENCE_FILE_SIZE_MB` setting (default 100 MB)
- Ensure the `MEDIA_ROOT` directory exists and is writable:
  ```bash
  mkdir -p backend/media
  chmod 755 backend/media
  ```

### Frontend shows blank page after build

- Ensure `VITE_API_BASE_URL` is set correctly for the production environment
- Confirm Nginx `try_files` is configured to fall back to `index.html` for SPA routing

### Compliance calculation returns no data

1. Ensure at least one framework has been adopted via `/api/compliance/adoptions/adopt_framework/`
2. Ensure controls have been applied for that framework
3. Trigger a calculation: `POST /api/compliance/results/calculate/` with `{ "framework": "<id>" }`

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Support

- **Issues:** Open a GitHub issue with full reproduction steps
- **Docs:** Visit `/api/docs/` on your running backend for interactive API documentation
- **Email:** support@compliancehub.example.com
