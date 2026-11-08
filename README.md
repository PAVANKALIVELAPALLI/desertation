# Relay: No-Code Workflow Automation Platform

Relay lets non-programmers automate tasks by connecting a trigger (what starts a workflow) to an ordered list of steps (what happens next), without writing code. Built as my MSc Computing dissertation at Griffith College Dublin.

**Live demo:** https://desertation-ccace.web.app

## Features
- Triggers: manual run, scheduled (cron-based), and form submission
- Steps: email notifications, HTTP requests, conditions, delays, logging and record updates
- Execution engine with step priorities, retries with exponential backoff and continue-on-error handling
- Per-user data isolation using Firebase Authentication and Firestore security rules
- Execution history so every run can be inspected

## Tech Stack
- Front end: TypeScript, React, Next.js, Tailwind CSS
- Back end: Node.js 22 on Firebase Cloud Functions (2nd gen)
- Data and auth: Cloud Firestore, Firebase Authentication
- Scheduling: Cloud Scheduler with a custom cron evaluator
- Email: Nodemailer; credentials stored in Google Secret Manager
- Hosting: Firebase Hosting

## How to Run Locally
1. Clone the repo and install front-end dependencies:

        git clone git@github.com:PAVANKALIVELAPALLI/desertation.git
        cd desertation/my-app
        npm install
        npm run dev

2. Build the functions:

        cd ../functions
        npm install
        npm run build

3. To deploy your own copy, create a Firebase project, update .firebaserc and the web config in my-app/lib/firebase.ts, set the GMAIL_USER and GMAIL_PASS secrets, then run: firebase deploy

## Security
- Firestore rules restrict each user to their own workflows and runs
- An unauthenticated debug endpoint found during my own security review was removed

## Known Limitations
- No automated test suite is included in this repository yet
- Email is sent through a single Gmail account (suitable for a demo, not production scale)
- Single cloud region (us-central1)

## Author
Pavan Kalivelapalli, MSc Computing, Griffith College Dublin
