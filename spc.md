# Feature Specification: AI Trial Room (MERN Stack + Gemini API)

**Single Source of Truth (SSOT) for Codex / Spec-Driven Development**

---

## 1. Executive Summary & Tech Stack Overview

The **AI Trial Room** is a full-stack web application designed as an interactive courtroom simulator. Building on state-driven AI game mechanics, players act as a Defense Attorney or Prosecutor to cross-examine witnesses, present evidence from a digital briefcase, lodge legal objections, and sway a real-time Jury Approval Meter managed by an AI Judge.

### Stack Architecture

* **Frontend:** React.js, Tailwind CSS, Lucide-react (icons), Axios/Fetch API, HTML5 Audio API for visual/audio cues.
* **Backend:** Node.js, Express.js (RESTful API architecture).
* **Database:** MongoDB & Mongoose ODM (Stores case files, witness profiles, briefcase items, user sessions, and dialogue logs).
* **AI Integration:** Google Gemini API (`@google/genai` Node.js SDK) utilizing `responseSchema` for structured JSON output.

---

## 2. System Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                               REACT FRONTEND                                      |
|  +-----------------------+  +------------------------+  +----------------------+  |
|  | Courtroom Dashboard   |  | Briefcase Modal        |  | Jury Meter Bar       |  |
|  | - Witness Video/Avatar|  | - Evidence Items Grid  |  | - Range (0 - 100%)   |  |
|  | - Dialogue Console    |  | - Objection Controls   |  | - Status Badges      |  |
|  +-----------+-----------+  +-----------+------------+  +----------^-----------+  |
|              |                          |                          |              |
+--------------|--------------------------|--------------------------|--------------+
               | HTTP POST                | HTTP POST (Objection)    | UI Rerender
               v                          v                          |
+--------------------------------------------------------------------+--------------+
|                            EXPRESS BACKEND                                        |
|  +-----------------------------------------------------------------------------+  |
|  | Controllers: /api/cases, /api/trial/examine, /api/trial/objection           |  |
|  | Middleware: Session Handler, Error Handler                                  |  |
|  +---------------------------+-------------------------------------------------+  |
|                              |                                                    |
|                              v Query / Save                                       |
|  +-----------------------------------------------------------------------------+  |
|  | MongoDB Database (Collections: Cases, Witnesses, Evidence, Sessions)       |  |
|  +---------------------------+-------------------------------------------------+  |
+------------------------------|----------------------------------------------------+
                               | Prompt Payload + Structured Output Schema
                               v
+-----------------------------------------------------------------------------------+
|                            GOOGLE GEMINI API                                      |
|  +----------------------------------+  +---------------------------------------+  |
|  | Witness Agent (Gemini Flash)     |  | Judge Evaluator Agent (Gemini Flash)  |  |
|  | - Character System Instructions  |  | - Evaluates Objections & Argument     |  |
|  | - Stress & Secret Logic          |  | - Returns Structured JSON Score Delta |  |
|  +----------------------------------+  +---------------------------------------+  |
+-----------------------------------------------------------------------------------+

```

---

## 3. MongoDB Data Models & Schema Specifications

### `Case.js` Schema

```javascript
const mongoose = require('mongoose');

const CaseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  role: { type: String, enum: ['Defense', 'Prosecution'], required: true },
  startingJurySentiment: { type: Number, default: 50 },
  maxTurns: { type: Number, default: 15 },
  witness: {
    name: { type: String, required: true },
    roleDescription: { type: String, required: true },
    traits: [String],
    initialStress: { type: Number, default: 0 },
    secrets: [{
      id: { type: String, required: true },
      description: { type: String, required: true },
      triggerEvidenceId: { type: String, required: true }
    }]
  },
  briefcase: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Case', CaseSchema);

```

### `Session.js` Schema (Active Game State)

```javascript
const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  juryApproval: { type: Number, default: 50 },
  witnessStress: { type: Number, default: 0 },
  turnsRemaining: { type: Number, required: true },
  revealedSecretIds: [String],
  dialogueHistory: [{
    speaker: { type: String, enum: ['Player', 'Witness', 'Judge'], required: true },
    text: { type: String, required: true },
    objectionDetails: {
      ground: String,
      evidenceId: String,
      ruling: String
    },
    timestamp: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['IN_PROGRESS', 'WON', 'LOST'], default: 'IN_PROGRESS' }
}, { timestamps: true });

module.exports = mongoose.model('Session', SessionSchema);

```

---

## 4. API Endpoints & Route Specifications

| Route | Method | Payload | Description |
| --- | --- | --- | --- |
| `/api/cases` | `GET` | None | Retrieves all available cases for the selection screen. |
| `/api/trial/start` | `POST` | `{ caseId: string }` | Initializes a new `Session` record and loads the briefcase. |
| `/api/trial/examine` | `POST` | `{ sessionId: string, statement: string }` | Submits a question to the witness. Returns witness response & updated stress. |
| `/api/trial/objection` | `POST` | `{ sessionId: string, ground: string, evidenceId: string }` | Submits an objection to the Judge Agent. Returns ruling, narrative explanation, and jury delta. |

---

## 5. Gemini Prompt & Structured Output Engineering

### 1. Witness Agent Integration

* **Model:** `gemini-2.5-flash`
* **System Instruction Prompt:**

```text
You are acting as [WITNESS_NAME], a witness in a courtroom trial.
Personality: [TRAITS].
Current Stress Level: [STRESS_LEVEL]/100.
Known Secrets: [SECRETS_LIST].

RULES:
1. Respond strictly in character as a witness under cross-examination.
2. Keep responses brief (1 to 3 sentences max).
3. Do NOT confess or reveal secrets UNLESS your Stress Level is above 75 OR the attorney presents evidence directly exposing your lie.

```

### 2. Judge Evaluator Agent (Structured Output)

* **Model:** `gemini-2.5-flash`
* **Structured JSON Schema Configuration:**

```javascript
const judgeResponseSchema = {
  type: "object",
  properties: {
    judgeRuling: {
      type: "string",
      enum: ["Sustained", "Overruled"]
    },
    judgeStatement: {
      type: "string",
      description: "Short spoken explanation from the Judge explaining the ruling."
    },
    jurySentimentDelta: {
      type: "integer",
      description: "Numerical shift to jury score, between -20 and +20."
    },
    witnessStressDelta: {
      type: "integer",
      description: "Numerical shift to witness stress, between -10 and +25."
    },
    secretExposed: {
      type: "boolean"
    },
    exposedSecretId: {
      type: "string",
      nullable: true
    }
  },
  required: ["judgeRuling", "judgeStatement", "jurySentimentDelta", "witnessStressDelta", "secretExposed"]
};

```

---

## 6. Frontend Component Architecture (React)

* **`TrialContainer.jsx`**: Main state controller; holds WebSocket/Polling state for the session.
* **`CourtroomView.jsx`**: Visual stage displaying Witness stance, dynamic stress indicators, and Judge banner.
* **`JuryMeter.jsx`**: Progress bar component mapping `juryApproval` ($0\%$ Red, $50\%$ Yellow, $100\%$ Green).
* **`DialogueConsole.jsx`**: Auto-scrolling chat log rendering speaker-tagged dialogue boxes.
* **`ObjectionModal.jsx`**: Pop-up view triggered by the "Objection!" button; lets the player choose legal grounds (`Hearsay`, `Irrelevant`, `Speculation`, `Lack of Personal Knowledge`, `Contradiction`) and attach an item from `BriefcaseGrid.jsx`.

---

## 7. Implementation Roadmap & Checklist

* **Phase 1: MERN Setup & Schemas**
1. Initialize Express API server and MongoDB Mongoose schemas (`Case`, `Session`).
2. Seed MongoDB with initial case file, witness profiles, and evidence items.


* **Phase 2: Backend & Gemini API**
3. Configure `@google/genai` SDK on backend with environment API keys.
4. Build `/api/trial/examine` route with Gemini Witness System Instructions.
5. Build `/api/trial/objection` route using Gemini Judge Structured JSON Output.
* **Phase 3: React UI & Game Engine**
6. Build React Courtroom Dashboard with dynamic Jury Meter component.
7. Build Objection Modal with Briefcase selection & trigger flow.
8. Implement win/loss evaluation triggers on session end ($0$ or $100$ Jury Score).