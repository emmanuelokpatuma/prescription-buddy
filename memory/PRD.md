# Vitality - Medication Reminder App PRD

## Original Problem Statement
Build a medication reminder app that helps people remember which medication, how much to take, and when to take it. Target audience: elderly people, people with disabilities, people managing chronic conditions, and caregivers.

## Architecture

### Tech Stack
- **Frontend**: React 19 with Shadcn UI components, Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: JWT-based auth

### Key Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `GET/POST/PUT/DELETE /api/medications` - Medication CRUD
- `POST /api/medications/log` - Log medication (taken/missed/skipped)
- `GET /api/schedule/{date}` - Get daily schedule
- `GET /api/history` - Get medication history
- `GET /api/emergency-list` - Emergency medication list
- `GET /api/interactions/check` - Check drug interactions
- `GET /api/progress/weekly` - Weekly adherence report
- `GET /api/notifications` - In-app notifications for caregivers
- `GET/POST/DELETE /api/caregivers/*` - Caregiver management

## User Personas
1. **Patient** - Tracks their own medications
2. **Caregiver** - Monitors linked patients' medication adherence

## Core Requirements (Static)
- [x] JWT Authentication (patient/caregiver roles)
- [x] Add/Edit/Delete medications with visual pill recognition
- [x] Daily medication schedule with time periods (morning/afternoon/evening)
- [x] Mark medications as taken/missed/skipped
- [x] Voice reminders using browser speechSynthesis
- [x] Browser push notifications for scheduled reminders
- [x] Drug interaction warnings (local database)
- [x] Weekly progress reports with share/copy/download
- [x] Caregiver dashboard with in-app notifications
- [x] Refill warnings when pills are low
- [x] Emergency medication list
- [x] Medication history tracking
- [x] Accessible design for elderly users

## What's Been Implemented
- **2026-03-09**: Initial MVP completed
  - Full authentication flow (register/login)
  - Medication CRUD operations
  - Daily schedule dashboard with color-coded time periods
  - Take/Skip/Miss medication logging
  - Voice reminder button (browser speechSynthesis)
  - Caregiver role with patient linking
  - Emergency medication list with print/share
  - History page
  - Settings page
  - Pill color/shape visual recognition

- **2026-03-09**: Feature Enhancement (All FREE)
  - Browser Push Notifications (native Notification API)
  - Drug Interaction Checker (local database: Warfarin, Aspirin, Ibuprofen, etc.)
  - Weekly Progress Report with Share/Copy/Download
  - In-app Caregiver Notifications (no email required)

## Prioritized Backlog

### P0 (Critical - Done)
- [x] User authentication
- [x] Medication CRUD
- [x] Daily schedule view
- [x] Take/Miss medication logging

### P1 (High Priority - Done)
- [x] Voice reminders
- [x] Browser push notifications
- [x] Drug interaction warnings
- [x] Weekly progress reports
- [x] In-app caregiver notifications
- [x] Emergency list
- [x] Refill warnings

### P2 (Medium Priority - Remaining)
- [ ] SMS reminders (Twilio - requires API key)
- [ ] Email notifications (Resend - requires API key)
- [ ] Prescription photo upload
- [ ] More drug interactions in database

### P3 (Nice to Have)
- [ ] Doctor appointment reminders
- [ ] Pharmacy integration
- [ ] Family medication dashboard analytics
- [ ] Multi-language support

## Next Tasks
1. User can add more medications to test drug interactions
2. Use the Share Progress feature to share with doctors
3. Enable browser notifications for automatic reminders
