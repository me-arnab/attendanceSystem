# Multi-Tenant Enterprise Attendance Management SaaS Platform

A multi-tenant, cloud-ready Attendance Management SaaS foundation engineered for enterprise scale, data isolation, and automated workforce time-tracking.

---

## 🌟 Key Features & Architecture

### 1. Robust Multi-Tenant Data Isolation
- **Scoped Tenant Context**: Every company-owned MongoDB collection (`User`, `Department`, `Attendance`, `AuditLog`) is strictly partitioned by `companyId`.
- **Zero-Trust Backend**: Tenant boundaries are enforced in verified JWT middleware (`requireTenant`). The backend **never** trusts client-supplied tenant identifiers.
- **Tenant Lifecycle Gates**: If a company is suspended by the Super Admin, all company admins and employees are blocked from accessing the system in real time.

### 2. Three Distinct Functional Roles
1. **Super Admin**: Platform overview, client onboarding, tenant creation with auto-generated unique company codes, activate/suspend companies, and platform governance.
2. **Company Admin**: Tenant dashboard with live attendance metrics, department management, employee lifecycle (create, edit, deactivate, reactivate), attendance monitoring, manual correction with mandatory justification and audit logging, and timesheet reports (daily & monthly CSV export).
3. **Employee (Self-Service)**: Automatic check-in on daily login with timezone-aware late-threshold calculation, one-click manual check-out with working duration tracking, monthly calendar visualizer, and full timesheet history.

### 3. Automated Attendance Engine
- When an employee logs in:
  1. Validates employee account status and company status.
  2. Resolves current date in the company's configured timezone (e.g. `America/New_York`, `Asia/Kolkata`, `UTC`).
  3. Checks for an existing attendance record for that calendar date.
  4. If none exists, creates the record with the exact login timestamp.
  5. Determines **`PRESENT`** vs **`LATE`** by evaluating check-in against the company's `officeStartTime` + `lateThresholdMinutes`.
  6. Enforced by a MongoDB compound unique index `{ companyId: 1, employeeId: 1, date: 1 }` preventing race-condition duplicate daily records.

### 4. Comprehensive Audit Trail
- All security-sensitive actions (company onboarded, company suspended/activated, employee created/updated/deactivated, attendance manually corrected, company settings updated) generate immutable records in the `AuditLog` collection.

---

## 🛠 Technology Stack

- **Frontend**:
  - React 18 & TypeScript
  - Vite
  - Tailwind CSS
  - Lucide React
  - Recharts (Interactive trends & bar charts)
  - React Router DOM v6
- **Backend**:
  - Node.js & Express
  - TypeScript
  - MongoDB 8 & Mongoose
  - JSON Web Tokens (JWT) & bcryptjs
  - Zod validation schemas
  - `tsx` runner

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ or v20+)
- MongoDB (Running locally on `mongodb://127.0.0.1:27017` or MongoDB Atlas)

### Quick Setup

1. **Clone & Install Dependencies**:
   ```bash
   # Install Backend Dependencies
   cd backend
   npm install

   # Install Frontend Dependencies
   cd ../frontend
   npm install
   ```

2. **Environment Configuration**:
   - Backend `.env` (`backend/.env`):
     ```env
     PORT=5050
     NODE_ENV=development
     MONGODB_URI=mongodb://127.0.0.1:27017/attendance_saas
     JWT_SECRET=super_secret_jwt_key_enterprise_attendance_2026
     JWT_EXPIRES_IN=7d
     FRONTEND_URL=http://localhost:5173
     ```

3. **Seed Database with Demo Data**:
   ```bash
   cd backend
   npm run seed
   ```

4. **Start Development Servers**:
   ```bash
   # Terminal 1 - Backend API (runs on http://localhost:5050)
   cd backend
   npm run dev

   # Terminal 2 - Frontend UI (runs on http://localhost:5173)
   cd frontend
   npm run dev
   ```

5. **Run Full End-to-End Test Suite**:
   ```bash
   cd backend
   npx tsx src/scripts/testE2E.ts
   ```

---

## 🔐 Demo Development Credentials

The login page includes **1-click quick-fill demo buttons** for all primary roles:

| Role | Company | Email | Password | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Platform | `superadmin@saas.com` | `Admin@12345` | Manages all companies & platform settings |
| **Company Admin 1** | Nexus Global Tech (`NEXUS`) | `admin@nexus.com` | `Nexus@12345` | Company Administrator for Nexus |
| **Employee 1** | Nexus Global Tech (`NEXUS`) | `john.doe@nexus.com` | `Emp@12345` | ID: `EMP-1001` (Engineering) |
| **Employee 2** | Nexus Global Tech (`NEXUS`) | `jane.smith@nexus.com` | `Emp@12345` | ID: `EMP-1002` (Product & Design) |
| **Company Admin 2** | Apex Dynamics (`APEX`) | `admin@apex.com` | `Apex@12345` | Company Administrator for Apex |
| **Employee 3** | Apex Dynamics (`APEX`) | `sarah.jenkins@apex.com` | `Emp@12345` | ID: `APX-2001` (Enterprise Sales) |

---

## 📡 API Endpoints Overview

### Authentication (`/api/auth`)
- `POST /login` - Unified credential authentication & automatic attendance check-in for employees
- `GET /me` - Get authenticated session profile & today's attendance state
- `POST /logout` - Invalidate session

### Super Admin (`/api/super-admin`) — *Requires `SUPER_ADMIN` Role*
- `GET /dashboard` - Platform statistics & registration growth
- `GET /companies` - List companies with search, filter, and pagination
- `POST /companies` - Register new company & create initial Company Admin
- `GET /companies/:id` - Full tenant details and primary admin contact
- `PUT /companies/:id` - Update company details
- `PATCH /companies/:id/status` - Suspend or reactivate tenant
- `GET /settings` & `PUT /settings` - Platform settings

### Company Admin (`/api/company`) — *Requires `COMPANY_ADMIN` Role & Tenant Scope*
- `GET /dashboard` - Real-time metrics: Present, Late, Absent, trend chart, department summary
- `GET /employees` - List employees with filters & pagination
- `POST /employees` - Create employee account with credentials
- `PUT /employees/:id` - Edit employee details
- `PATCH /employees/:id/status` - Deactivate / reactivate employee
- `GET /departments` & `POST /departments` - Department CRUD
- `GET /attendance` - Live & historical attendance log
- `PATCH /attendance/:id/correction` - Manual attendance override (mandates reason & generates audit log)
- `GET /reports` - Timesheet reports (Daily & Monthly)
- `GET /settings` & `PUT /settings` - Tenant profile & attendance shift rules
- `GET /audit-logs` - Full tenant compliance trail

### Employee Self-Service (`/api/employee`) — *Requires `EMPLOYEE` Role & Tenant Scope*
- `GET /dashboard` - Today's check-in timestamp, check-out status, monthly stats, calendar
- `POST /attendance/checkout` - Record manual check-out & compute duration
- `GET /attendance/history` - Personal historical attendance records

---

## 🔒 Security Design Principles
1. **Passwords**: Salted & hashed using `bcryptjs` with 10 rounds; never stored or returned in plaintext.
2. **Tenant Boundary Isolation**: Company IDs are derived exclusively from verified JWT server-side claims.
3. **Compound Indexes**:
   - `Attendance`: `{ companyId: 1, employeeId: 1, date: 1 }` (unique constraint)
   - `User`: `{ companyId: 1, employeeId: 1 }` (unique constraint)
   - `Department`: `{ companyId: 1, name: 1 }` (unique constraint)
   - `Company`: `{ code: 1 }` (globally unique)
