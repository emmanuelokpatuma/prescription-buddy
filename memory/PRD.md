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
- [x] Caregiver dashboard to monitor family members
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

## Prioritized Backlog

### P0 (Critical - Done)
- [x] User authentication
- [x] Medication CRUD
- [x] Daily schedule view
- [x] Take/Miss medication logging

### P1 (High Priority - Done)
- [x] Voice reminders
- [x] Caregiver dashboard
- [x] Emergency list
- [x] Refill warnings

### P2 (Medium Priority - Remaining)
- [ ] Browser push notifications
- [ ] Caregiver email alerts (Resend integration configured but needs API key)
- [ ] Medication interaction warnings
- [ ] Weekly adherence reports
- [ ] SMS reminders (Twilio integration)

### P3 (Nice to Have)
- [ ] Prescription photo upload
- [ ] Doctor appointment reminders
- [ ] Pharmacy integration
- [ ] Family medication dashboard analytics

## Next Tasks
1. Add Resend API key for caregiver email notifications
2. Implement browser push notifications for reminders
3. Add medication interaction warnings
4. Weekly adherence reports/charts
