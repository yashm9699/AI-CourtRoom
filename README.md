# AI Trial Room

An interactive courtroom simulator built with React, Express, MongoDB/Mongoose, and Google Gemini. The client includes a responsive trial desk, witness examination, evidence briefcase, jury sentiment meter, and objection flow.

## Run locally

1. Install Node.js 20 or newer.
2. From the repository root, run `npm install` and `npm --prefix client install`.
3. Copy `.env.example` to `.env`. Set `GEMINI_API_KEY` to enable Gemini testimony and judge rulings. Set `MONGODB_URI` to enable MongoDB persistence; when MongoDB is unavailable the API uses seeded local cases and in-memory sessions.
4. Run `npm run dev` from the repository root and open `http://localhost:5173`.

To start only the frontend, run `cd client` followed by `npm run dev`. To start only the API, run `npm run dev:server` from the repository root.

The API starts on port 4000 by default. The Vite development server forwards `/api` requests to it.

## Deploy a shareable live site

The root `render.yaml` configures a single Render web service that builds the React client and serves it from Express alongside the API.

1. Push the latest project commit to GitHub.
2. In Render, choose **New → Blueprint**, connect this GitHub repository, and deploy the `render.yaml` blueprint.
3. After the deploy succeeds, open the `onrender.com` URL shown in the Render dashboard and share it.

The app runs with seeded cases and in-memory sessions without additional services. Those sessions reset when the service restarts. To enable Gemini, add a newly rotated `GEMINI_API_KEY` in the Render service's Environment settings. For persistent sessions, also add a MongoDB `MONGODB_URI`. Never put either secret in this repository; add them in Render's dashboard.

## API

- `GET /api/cases` lists available case files.
- `POST /api/trial/start` starts a session with `{ "caseId": "..." }`.
- `GET /api/trial/:sessionId` retrieves a session and its case.
- `POST /api/trial/examine` examines a witness with `{ "sessionId": "...", "statement": "...", "evidenceId": "..." }`.
- `POST /api/trial/objection` submits `{ "sessionId": "...", "ground": "Hearsay", "evidenceId": "..." }`.
- `GET /api/health` reports whether MongoDB and Gemini are configured.
