import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
  juryApproval: { type: Number, default: 50 },
  witnessStress: { type: Number, default: 0 },
  turnsRemaining: { type: Number, required: true },
  revealedSecretIds: [String],
  dialogueHistory: [{
    speaker: { type: String, enum: ['Player', 'Witness', 'Judge'], required: true },
    text: { type: String, required: true },
    objectionDetails: { ground: String, evidenceId: String, ruling: String },
    timestamp: { type: Date, default: Date.now },
  }],
  status: { type: String, enum: ['IN_PROGRESS', 'WON', 'LOST'], default: 'IN_PROGRESS' },
}, { timestamps: true });

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
