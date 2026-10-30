import mongoose from 'mongoose';

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
    secrets: [{ id: String, description: String, triggerEvidenceId: String }],
  },
  briefcase: [{ id: String, title: String, description: String, imageUrl: String }],
}, { timestamps: true });

export default mongoose.models.Case || mongoose.model('Case', CaseSchema);
