import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Case from './models/Case.js';
import Session from './models/Session.js';
import { seedCases } from './data/seed.js';
import { askWitness, judgeObjection } from './lib/gemini.js';

const app = express();
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(serverDir, '../client/dist');
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? true }));
app.use(express.json());
let memoryCases = seedCases.map((item, index) => ({ ...item, _id: `local-${index + 1}` }));
const memorySessions = new Map();
const isMongo = () => mongoose.connection.readyState === 1;
const findCase = (id) => isMongo() ? Case.findById(id) : Promise.resolve(memoryCases.find((item) => item._id === id));
const getSession = (id) => isMongo() ? Session.findById(id) : Promise.resolve(memorySessions.get(id));
const saveSession = (session) => isMongo() ? session.save() : (memorySessions.set(session._id, session), Promise.resolve(session));
const makeId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

app.get('/api/health', (_req, res) => res.json({ ok: true, database: isMongo() ? 'mongodb' : 'memory', gemini: Boolean(process.env.GEMINI_API_KEY) }));
app.get('/api/cases', async (_req, res, next) => {
  try { res.json(isMongo() ? await Case.find().select('-witness.secrets') : memoryCases.map(({ witness, ...item }) => ({ ...item, witness: { ...witness, secrets: undefined } }))); }
  catch (error) { next(error); }
});
app.get('/api/trial/:sessionId', async (req, res, next) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    const trialCase = await findCase(session.caseId);
    res.json({ session, case: trialCase });
  } catch (error) { next(error); }
});
app.post('/api/trial/start', async (req, res, next) => {
  try {
    const trialCase = await findCase(req.body.caseId);
    if (!trialCase) return res.status(404).json({ error: 'Case not found.' });
    const session = isMongo() ? new Session({ caseId: trialCase._id, juryApproval: trialCase.startingJurySentiment, witnessStress: trialCase.witness.initialStress, turnsRemaining: trialCase.maxTurns }) : {
      _id: makeId(), caseId: trialCase._id, juryApproval: trialCase.startingJurySentiment, witnessStress: trialCase.witness.initialStress,
      turnsRemaining: trialCase.maxTurns, revealedSecretIds: [], dialogueHistory: [], status: 'IN_PROGRESS',
    };
    await saveSession(session);
    res.json({ session, case: trialCase });
  } catch (error) { next(error); }
});
app.post('/api/trial/examine', async (req, res, next) => {
  try {
    const { sessionId, statement, evidenceId } = req.body;
    if (!statement?.trim()) return res.status(400).json({ error: 'Add a question or statement for the witness.' });
    const session = await getSession(sessionId);
    if (!session || session.status !== 'IN_PROGRESS') return res.status(404).json({ error: 'Active session not found.' });
    const trialCase = await findCase(session.caseId);
    if (session.turnsRemaining <= 0) return res.status(409).json({ error: 'No turns remain.' });
    const evidence = evidenceId ? trialCase.briefcase.find((item) => item.id === evidenceId) : null;
    const exposed = evidence && trialCase.witness.secrets.find((secret) => secret.triggerEvidenceId === evidence.id && !session.revealedSecretIds.includes(secret.id));
    const stressDelta = exposed ? 24 : 8;
    const nextStress = clamp(session.witnessStress + stressDelta, 0, 100);
    const reply = exposed ? `I… I didn’t see the alarm records before I signed the log. The timeline was incomplete when I approved it.` : await askWitness({ witness: trialCase.witness, stress: nextStress, history: session.dialogueHistory, statement: statement.trim(), evidence });
    const witnessReply = reply || (nextStress > 70 ? 'I can’t be certain the timeline is right. We were working from the information available at the scene.' : 'I followed the evidence where it led. My report reflects what we established during the investigation.');
    session.dialogueHistory.push({ speaker: 'Player', text: statement.trim() });
    session.dialogueHistory.push({ speaker: 'Witness', text: witnessReply });
    session.witnessStress = nextStress;
    session.turnsRemaining -= 1;
    if (exposed) session.revealedSecretIds.push(exposed.id);
    if (session.juryApproval >= 100) session.status = 'WON';
    if (session.juryApproval <= 0 || session.turnsRemaining <= 0) session.status = session.juryApproval > 50 ? 'WON' : 'LOST';
    await saveSession(session);
    res.json({ session, witnessReply, exposedSecret: exposed ?? null });
  } catch (error) { next(error); }
});
app.post('/api/trial/objection', async (req, res, next) => {
  try {
    const { sessionId, ground, evidenceId } = req.body;
    const session = await getSession(sessionId);
    if (!session || session.status !== 'IN_PROGRESS') return res.status(404).json({ error: 'Active session not found.' });
    const trialCase = await findCase(session.caseId);
    const evidence = trialCase.briefcase.find((item) => item.id === evidenceId);
    const ruling = await judgeObjection({ ground, evidence, witness: trialCase.witness, history: session.dialogueHistory });
    const result = ruling || { judgeRuling: 'Sustained', judgeStatement: 'The objection is noted. The cited record is relevant to the testimony before the court.', jurySentimentDelta: 4, witnessStressDelta: 5, secretExposed: false, exposedSecretId: null };
    result.judgeRuling = ['Sustained', 'Overruled'].includes(result.judgeRuling) ? result.judgeRuling : 'Overruled';
    session.juryApproval = clamp(session.juryApproval + result.jurySentimentDelta, 0, 100);
    session.witnessStress = clamp(session.witnessStress + result.witnessStressDelta, 0, 100);
    session.turnsRemaining = Math.max(0, session.turnsRemaining - 1);
    session.dialogueHistory.push({ speaker: 'Player', text: `Objection: ${ground}`, objectionDetails: { ground, evidenceId, ruling: result.judgeRuling } });
    session.dialogueHistory.push({ speaker: 'Judge', text: result.judgeStatement, objectionDetails: { ground, evidenceId, ruling: result.judgeRuling } });
    if (result.secretExposed && result.exposedSecretId) session.revealedSecretIds.push(result.exposedSecretId);
    if (session.juryApproval >= 100) session.status = 'WON';
    else if (session.juryApproval <= 0 || session.turnsRemaining <= 0) session.status = session.juryApproval > 50 ? 'WON' : 'LOST';
    await saveSession(session);
    res.json({ session, ruling: result });
  } catch (error) { next(error); }
});
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: 'The court encountered an unexpected issue.' }); });

const port = Number(process.env.PORT || 4000);
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI).then(async () => {
    if (await Case.countDocuments() === 0) await Case.insertMany(seedCases);
    console.log('Connected to MongoDB and checked case seed data.');
  }).catch((error) => console.error('MongoDB unavailable; using in-memory sessions and seed data.', error.message));
}
app.listen(port, () => console.log(`AI Trial Room API listening on http://localhost:${port}`));
