# Compliance Management SaaS Platform

> Enterprise-grade compliance management system built with Django REST Framework and React + TypeScript

A comprehensive multi-tenant SaaS platform for managing compliance frameworks, controls, evidence, risks, and organizational compliance across ISO 27001, SOC 2, GDPR, HIPAA, and other standards.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Key Concepts](#key-concepts)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Deployment](#deployment)

---

## 🎯 Overview

This platform enables organizations to:
- **Manage compliance frameworks** - ISO 27001, SOC 2, GDPR, HIPAA, PCI DSS, etc.
- **Implement controls** - Map and track security controls across frameworks
- **Collect evidence** - Upload, version, and approve compliance evidence
- **Assess risks** - Identify, evaluate, and treat organizational risks
- **Calculate compliance** - Automated compliance scoring and gap analysis
- **Organize departments** - Hierarchical organizational structure
- **Generate reports** - Compliance reports and audit trails

### Multi-Tenant Architecture

Each company operates in complete isolation with:
- **Separate data** - Company A cannot see Company B's data
- **Role-based access** - Owner, Admin, Manager, Analyst, Auditor, Viewer
- **Department scoping** - Scope compliance and risks to specific departments
- **Shared framework library** - Global compliance frameworks available to all

---

## ✨ Features

### 🔐 Authentication & Authorization
- JWT-based authentication with access/refresh tokens
- Multi-company support - Users can belong to multiple companies
- Role-based permissions (RBAC)
- Company selection flow after login
- Password validation with complexity rules

### 📚 Framework Library
- Global framework repository (ISO 27001, SOC 2, GDPR, etc.)
- Hierarchical requirements with parent/child relationships
- Control-to-requirement mappings
- Framework statistics and analytics
- Read-only for users (admins manage via Django admin)

### 🏢 Organizations
- Department management with unlimited nesting
- Visual hierarchical tree (color-coded by level)
- Manager assignment
- Member tracking
- Validation prevents circular references

### 🛡️ Controls
- Reference controls (global library)
- Applied controls (company-specific)
- Status tracking (Not Started → Operational)
- Effectiveness ratings (0-100%)
- Evidence linking
- Review scheduling

### 📎 Evidence
- File management with version control
- Approval workflow (Pending → Approved → Rejected)
- Multi-control linking
- Access logging and audit trail
- Secure file storage

### ⚠️ Risk Management
- Risk register with customizable matrices
- Inherent vs residual risk tracking
- Control-to-risk assessments
- Treatment action tracking
- Risk event logging (incidents)

### ✅ Compliance
- Automated compliance calculations
- Gap analysis and identification
- Compliance trends over time
- Framework adoption management
- Certification tracking
- AI-driven recommendations

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TypeScript)             │
│  Auth │ Library │ Organizations │ Controls │ Evidence       │
│  Risk │ Compliance │ Reporting                               │
└─────────────────────────────────────────────────────────────┘
                      ↓ JWT + X-Company-ID
┌─────────────────────────────────────────────────────────────┐
│                BACKEND (Django REST Framework)               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ API Layer → Middleware → Business Logic → Data Layer  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    PostgreSQL
```

### Multi-Tenant Flow

1. User Login → JWT + List of Companies
2. User Selects Company → Sets X-Company-ID header
3. All Requests Include: Authorization + X-Company-ID
4. TenantMiddleware extracts company → request.tenant
5. All queries auto-filtered by company

---

## 🛠️ Tech Stack

**Backend:**
- Django 4.2+ / Django REST Framework
- PostgreSQL 14+
- JWT Authentication (simplejwt)
- Redis (caching/tasks)

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Zustand (auth state) + TanStack Query (server state)
- shadcn/ui + Tailwind CSS
- React Router v6
- Axios

---

## 📁 Project Structure

```
compliance-platform/
├── backend/
│   ├── apps/
│   │   ├── core/           # Auth, multi-tenancy
│   │   ├── library/        # Frameworks (global)
│   │   ├── organizations/  # Departments
│   │   ├── controls/       # Control management
│   │   ├── evidence/       # Evidence management
│   │   ├── risk/           # Risk management
│   │   └── compliance/     # Compliance calculations
│   ├── config/             # Django settings
│   └── manage.py
│
├── frontend/
│   ├── src/
│   │   ├── api/           # API clients
│   │   ├── components/    # Shared components
│   │   ├── features/      # Feature modules
│   │   ├── stores/        # Zustand stores
│   │   ├── types/         # TypeScript types
│   │   └── App.tsx
│   └── package.json
│
└── docker-compose.yml
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure .env
cp .env.example .env
# Edit .env with database credentials

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Load sample data
python manage.py load_sample_frameworks
python manage.py create_test_data

# Start server
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend
npm install

# Configure .env
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000

# Start dev server
npm run dev
```

### Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/
- Django Admin: http://localhost:8000/admin/
- API Docs: http://localhost:8000/api/docs/

### Test Accounts

After running `create_test_data`:
- owner@test.com / password123 (Owner)
- admin@test.com / password123 (Admin)
- manager@test.com / password123 (Manager)
- analyst@test.com / password123 (Analyst)
- auditor@test.com / password123 (Auditor)
- viewer@test.com / password123 (Viewer)

---

## 🔑 Key Concepts

### Multi-Tenancy

**One user, multiple companies:**
```
john@example.com → Company A (Owner)
                 → Company B (Admin)
                 → Company C (Viewer)
```

**Complete data isolation via TenantMiddleware**

### Authentication Flow

```
1. Register → Creates User
2. Login → JWT + Companies list
3. Select Company → Sets X-Company-ID
4. All requests → Authorization + X-Company-ID
5. Backend → request.tenant set
6. Queries → Auto-filtered by company
```

### Roles & Permissions

| Role     | Permissions                          |
|----------|--------------------------------------|
| Owner    | Full access, can delete company       |
| Admin    | Manage users, full CRUD               |
| Manager  | Create/edit controls, evidence, risks |
| Analyst  | View all, create evidence             |
| Auditor  | Read-only access                      |
| Viewer   | Dashboard and reports only            |

### Hierarchical Departments

```
Acme Corp
├── Engineering
│   ├── Backend Team
│   │   └── Security Team
│   └── Frontend Team
├── Sales
└── Finance
```

Use for scoping compliance, controls, and risks.

---

## 📚 API Documentation

### Authentication

```bash
# Register
POST /api/auth/register/
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePass123",
  "password_confirm": "SecurePass123",
  "first_name": "John",
  "last_name": "Doe"
}

# Login
POST /api/auth/token/
{
  "email": "user@example.com",
  "password": "SecurePass123"
}

# Refresh Token
POST /api/auth/token/refresh/
{ "refresh": "..." }

# Get Current User
GET /api/auth/me/
```

### Core Endpoints

```bash
# Companies
GET    /api/companies/
POST   /api/companies/create_with_membership/

# Memberships
GET    /api/memberships/?company={id}
```

### Library Endpoints

```bash
GET    /api/library/frameworks/
GET    /api/library/frameworks/{id}/
GET    /api/library/frameworks/{id}/requirements_tree/
GET    /api/library/frameworks/{id}/statistics/
GET    /api/library/requirements/
```

### Organizations Endpoints

```bash
# Require X-Company-ID header
GET    /api/organizations/departments/
POST   /api/organizations/departments/
GET    /api/organizations/departments/tree/
PATCH  /api/organizations/departments/{id}/
DELETE /api/organizations/departments/{id}/
```

### Controls Endpoints

```bash
# Require X-Company-ID header
GET    /api/controls/applied-controls/
POST   /api/controls/applied-controls/apply_control/
GET    /api/controls/applied-controls/dashboard/
```

### Evidence Endpoints

```bash
# Require X-Company-ID header
GET    /api/evidence/evidence/
POST   /api/evidence/evidence/
POST   /api/evidence/evidence/{id}/approve/
GET    /api/evidence/evidence/analytics/
```

### Risk Endpoints

```bash
# Require X-Company-ID header
GET    /api/risk/risks/
POST   /api/risk/risks/
GET    /api/risk/risks/heat_map/
```

### Compliance Endpoints

```bash
# Require X-Company-ID header
POST   /api/compliance/results/calculate/
GET    /api/compliance/results/overview/
GET    /api/compliance/results/gap_analysis/
GET    /api/compliance/results/recommendations/
```

**Full API docs:** http://localhost:8000/api/docs/

---

## 👨‍💻 Development

### Running Tests

```bash
# Backend
cd backend
python manage.py test

# Frontend
cd frontend
npm run test
```

### Code Quality

```bash
# Backend
flake8 .
black .

# Frontend
npm run lint
```

### Database Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

---

## 🚢 Deployment

### Environment Variables

**Backend:**
```env
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=your-domain.com
DB_NAME=compliance_db
DB_USER=postgres
DB_PASSWORD=...
CORS_ALLOWED_ORIGINS=https://app.your-domain.com
```

**Frontend:**
```env
VITE_API_BASE_URL=https://api.your-domain.com
```

### Production Checklist

- [ ] Set DEBUG=False
- [ ] Use strong SECRET_KEY
- [ ] Configure PostgreSQL
- [ ] Set up Redis
- [ ] Configure S3 for files
- [ ] Enable SSL/TLS
- [ ] Configure CORS
- [ ] Enable security middleware
- [ ] Set up monitoring
- [ ] Configure backups

---

## 📖 Additional Documentation

- [Frontend Bug Fixes](./FRONTEND_BUGFIXES.md) - 15 bugs found and fixed
- [Auth Setup Guide](./AUTH_COMPLETE_SETUP_GUIDE.md) - Complete auth implementation
- [Library & Organizations Setup](./LIBRARY_ORGANIZATIONS_SETUP_GUIDE.md) - Feature guide

---

## 📊 Project Status

| Component         | Status          | Coverage |
|-------------------|-----------------|----------|
| Authentication    | ✅ Complete     | 95%      |
| Multi-tenancy     | ✅ Complete     | 100%     |
| Framework Library | ✅ Complete     | 90%      |
| Organizations     | ✅ Complete     | 90%      |
| Controls          | ✅ Complete     | 85%      |
| Evidence          | ✅ Complete     | 85%      |
| Risk Management   | ✅ Complete     | 80%      |
| Compliance        | ✅ Complete     | 75%      |
| Reporting         | 🚧 In Progress  | 60%      |

---

## 🗺️ Roadmap

**Q1 2026:**
- Automated evidence collection
- Advanced analytics
- Mobile app
- AI recommendations

**Q2 2026:**
- Third-party integrations
- Automated control testing
- Workflow automation

**Q3 2026:**
- Multi-language support
- Compliance chatbot
- White-label customization

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ by the Compliance Platform Team**
