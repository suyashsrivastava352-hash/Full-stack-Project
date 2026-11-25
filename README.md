# PulseCheck: Employee Survey Website

Full stack web app where a company's HR team creates surveys and employees answer them.
Built with **Node.js, Express, MongoDB (Mongoose)** and a **vanilla HTML/CSS/JS** frontend.

## Features
- Register / login with **JWT** authentication (passwords hashed with bcrypt)
- **Role-based access control**: `employee` and `admin` (HR)
- Employees: see open surveys, answer them once, see which are completed
- Admin: build surveys (rating, multiple choice, written answers), publish, close, delete
- Anonymous surveys: names are hidden in the results
- Results dashboard: response rate, rating averages, option counts, written comments
- Admin stats and employee list

## Tech stack
Node.js, Express, MongoDB Atlas, Mongoose, JWT, bcryptjs, Helmet, CORS, HTML5, CSS3, JavaScript (ES6)

## Folder structure
```
server/
├── server.js            # app entry point
├── seed.js              # creates admin, demo employees, sample survey
├── public/              # frontend (index.html, style.css, app.js)
└── src/
    ├── config/db.js         # MongoDB connection
    ├── models/              # User, Survey, Response
    ├── middleware/auth.js   # protect (JWT) + authorize (RBAC)
    └── routes/              # auth, surveys, responses, admin
```

## Setup
```bash
cd server
npm install
cp .env.example .env     # add your MongoDB URI and a JWT secret
npm run seed
npm run dev
```
Open http://localhost:5000

Demo logins created by the seed script:
| Role | Email | Password |
|---|---|---|
| Admin (HR) | admin@company.com | admin123 |
| Employee | asha@company.com | employee123 |
| Employee | rohan@company.com | employee123 |

## REST API
| Method | Endpoint | Access |
|---|---|---|
| POST | /api/auth/register | Public (creates an employee) |
| POST | /api/auth/login | Public |
| GET | /api/auth/me | Logged in |
| GET | /api/surveys | Logged in (admin: all, employee: active) |
| GET | /api/surveys/:id | Logged in |
| POST | /api/surveys | Admin |
| PATCH | /api/surveys/:id/status | Admin |
| DELETE | /api/surveys/:id | Admin |
| GET | /api/surveys/:id/results | Admin |
| POST | /api/responses/:surveyId | Employee |
| GET | /api/admin/stats | Admin |
| GET | /api/admin/users | Admin |

## Notes on design
- Only HR admins can create surveys, and admin accounts cannot be created through public registration
- A unique database index (survey + user) stops an employee submitting twice
- Answers are validated on the server (rating 1 to 5, valid option, required questions)
- For anonymous surveys the server still stores who submitted, only to block duplicates; names are never sent to the admin
- All user text is escaped before display to prevent XSS
