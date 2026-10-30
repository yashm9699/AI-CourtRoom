import { GoogleGenAI, Type } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
export const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function askWitness({ witness, stress, history, statement, evidence }) {
  if (!genAI) return null;
  const knownSecrets = witness.secrets.map((secret) => `${secret.id}: ${secret.description}`).join('\n');
  const prompt = `You are ${witness.name}, ${witness.roleDescription}. Personality: ${witness.traits.join(', ')}. Current stress: ${stress}/100. Known secrets (do not volunteer): ${knownSecrets}. Respond in character in 1-3 sentences. Do not confess unless stress is above 75 or the presented evidence directly exposes a lie.\nRecent testimony:\n${history.slice(-8).map((line) => `${line.speaker}: ${line.text}`).join('\n')}\nAttorney statement: ${statement}${evidence ? `\nPresented evidence: ${evidence.title} — ${evidence.description}` : ''}`;
  const result = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
  return result.text?.trim() || null;
}

export async function judgeObjection({ ground, evidence, witness, history }) {
  if (!genAI) return null;
  const result = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Evaluate this courtroom objection fairly. Objection ground: ${ground}. Evidence cited: ${evidence?.title ?? 'none'} — ${evidence?.description ?? ''}. Witness: ${witness.name}, ${witness.roleDescription}. Recent testimony: ${history.slice(-5).map((line) => `${line.speaker}: ${line.text}`).join('\n')}. Sustained means the objection is legally persuasive in this context. Keep the judge statement to one short sentence.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          judgeRuling: { type: Type.STRING, enum: ['Sustained', 'Overruled'] },
          judgeStatement: { type: Type.STRING },
          jurySentimentDelta: { type: Type.INTEGER },
          witnessStressDelta: { type: Type.INTEGER },
          secretExposed: { type: Type.BOOLEAN },
          exposedSecretId: { type: Type.STRING, nullable: true },
        },
        required: ['judgeRuling', 'judgeStatement', 'jurySentimentDelta', 'witnessStressDelta', 'secretExposed'],
      },
    },
  });
  try {
    const parsed = JSON.parse(result.text || '{}');
    parsed.jurySentimentDelta = Math.max(-20, Math.min(20, Number(parsed.jurySentimentDelta) || 0));
    parsed.witnessStressDelta = Math.max(-10, Math.min(25, Number(parsed.witnessStressDelta) || 0));
    return parsed;
  } catch { return null; }
}
