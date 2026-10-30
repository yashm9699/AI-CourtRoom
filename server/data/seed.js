export const seedCases = [
  {
    title: 'The People v. Mercer',
    description: 'A warehouse fire destroyed a shipment of priceless paintings. Prosecutors say the night guard, Elias Mercer, set the blaze to hide a theft. You represent the defense.',
    role: 'Defense', startingJurySentiment: 50, maxTurns: 15,
    witness: {
      name: 'Detective Evelyn Shaw', roleDescription: 'Lead investigator on the warehouse fire',
      traits: ['methodical', 'confident', 'protective of her reputation'], initialStress: 18,
      secrets: [{ id: 'timeline-gap', description: 'She signed the evidence log before the alarm records were reviewed.', triggerEvidenceId: 'alarm-log' }],
    },
    briefcase: [
      { id: 'alarm-log', title: 'Alarm System Log', description: 'The alarm was disabled eleven minutes before the fire was reported.' },
      { id: 'access-card', title: 'Access Card Report', description: 'Mercer’s card was used at the loading bay, but the reader clock was six minutes fast.' },
      { id: 'weather-report', title: 'Weather Report', description: 'Strong winds carried smoke toward the street, triggering several witness calls.' },
      { id: 'evidence-log', title: 'Evidence Chain Log', description: 'Detective Shaw signed the evidence inventory at 9:12 PM, before the alarm records were obtained.' },
    ],
  },
  {
    title: 'The State v. Bell',
    description: 'A disputed signature on a historic estate transfer has put a family fortune at stake. You represent the prosecution.',
    role: 'Prosecution', startingJurySentiment: 50, maxTurns: 15,
    witness: {
      name: 'Martin Cole', roleDescription: 'Retired estate solicitor and signature witness',
      traits: ['formal', 'guarded', 'easily flustered'], initialStress: 10,
      secrets: [{ id: 'draft-copy', description: 'He compared the signature to a photocopy rather than the original.', triggerEvidenceId: 'office-notes' }],
    },
    briefcase: [
      { id: 'signature-card', title: 'Signature Comparison', description: 'A handwriting expert found several distinctive mismatches.' },
      { id: 'office-notes', title: 'Solicitor’s Notes', description: 'The notes refer to reviewing a photocopy before the original arrived.' },
      { id: 'visitor-book', title: 'Visitor Register', description: 'Bell was not recorded as entering the solicitor’s office on the signing date.' },
    ],
  },
];
