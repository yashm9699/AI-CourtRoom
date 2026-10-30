import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, AudioLines, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Gavel, Headphones, Info, Menu, Mic, MoreHorizontal, Paperclip, Scale, Send, Shield, Sparkles, Volume2, X } from 'lucide-react';

const fallbackCase = {
  _id: 'local-1', title: 'The People v. Mercer', description: 'A warehouse fire destroyed a shipment of priceless paintings. Prosecutors say the night guard set the blaze to hide a theft.', role: 'Defense', maxTurns: 15, startingJurySentiment: 50,
  witness: { name: 'Detective Evelyn Shaw', roleDescription: 'Lead investigator', traits: ['methodical', 'confident'], initialStress: 18 },
  briefcase: [
    { id: 'alarm-log', title: 'Alarm System Log', description: 'The alarm was disabled eleven minutes before the fire was reported.' },
    { id: 'access-card', title: 'Access Card Report', description: 'Mercer’s card was used at the loading bay, but the reader clock was six minutes fast.' },
    { id: 'weather-report', title: 'Weather Report', description: 'Strong winds carried smoke toward the street, triggering several witness calls.' },
    { id: 'evidence-log', title: 'Evidence Chain Log', description: 'Detective Shaw signed the inventory before the alarm records were obtained.' },
  ],
};
const initialMessages = [
  { speaker: 'Judge', text: 'Court is now in session. Counsel may begin their examination.' },
  { speaker: 'Witness', text: 'I led the investigation into the warehouse fire. We followed every available lead.' },
];
const grounds = ['Hearsay', 'Irrelevant', 'Speculation', 'Lack of Personal Knowledge', 'Contradiction'];
const iconForEvidence = (id) => id.includes('alarm') ? '◷' : id.includes('access') ? '▤' : id.includes('weather') ? '☼' : '▧';
const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function App() {
  const [trialCase, setTrialCase] = useState(fallbackCase);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState(initialMessages.map((m) => ({ ...m, time: new Date() })));
  const [question, setQuestion] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showObjection, setShowObjection] = useState(false);
  const [ground, setGround] = useState(grounds[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [apiMode, setApiMode] = useState('Loading case file');
  const dialogueEnd = useRef(null);
  const approval = session?.juryApproval ?? 50;
  const stress = session?.witnessStress ?? 18;
  const turns = session?.turnsRemaining ?? 15;
  const history = session?.dialogueHistory;
  const shownMessages = history?.length ? history.map((entry) => ({ ...entry, time: entry.timestamp, ground: entry.objectionDetails?.ground })) : messages;

  useEffect(() => {
    fetch('/api/cases').then((response) => response.ok ? response.json() : Promise.reject()).then((cases) => {
      if (cases[0]) { setTrialCase({ ...fallbackCase, ...cases[0], witness: { ...fallbackCase.witness, ...cases[0].witness } }); setApiMode('Case file connected'); }
    }).catch(() => setApiMode('Demo mode'));
  }, []);
  useEffect(() => { dialogueEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [shownMessages.length, busy]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 3400); return () => clearTimeout(timer); } }, [toast]);

  async function startSession() {
    const response = await fetch('/api/trial/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId: trialCase._id }) });
    if (!response.ok) throw new Error('Could not start the trial.');
    const data = await response.json(); setSession(data.session); setTrialCase({ ...fallbackCase, ...data.case, witness: { ...fallbackCase.witness, ...data.case.witness } });
    setMessages([]); return data.session;
  }

  async function submitQuestion(event) {
    event?.preventDefault();
    if (!question.trim() || busy) return;
    const text = question.trim(); setQuestion(''); setError(''); setBusy(true);
    try {
      const currentSession = session ?? await startSession();
      const response = await fetch('/api/trial/examine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: currentSession._id, statement: text, evidenceId: selectedEvidence?.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'The witness could not respond.');
      setSession(data.session); setMessages((previous) => [...previous, { speaker: 'Player', text, time: new Date() }, { speaker: 'Witness', text: data.witnessReply, time: new Date() }]);
      if (data.exposedSecret) setToast('New testimony: the evidence exposed a gap in the investigation.');
      setSelectedEvidence(null);
    } catch (requestError) { setError(requestError.message); setMessages((previous) => [...previous, { speaker: 'Player', text, time: new Date() }]); }
    finally { setBusy(false); }
  }

  async function submitObjection(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const currentSession = session ?? await startSession();
      const response = await fetch('/api/trial/objection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: currentSession._id, ground, evidenceId: selectedEvidence?.id ?? trialCase.briefcase[0]?.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not submit the objection.');
      setSession(data.session); setMessages((previous) => [...previous, { speaker: 'Player', text: `Objection: ${ground}`, time: new Date(), ground }, { speaker: 'Judge', text: data.ruling.judgeStatement, ruling: data.ruling.judgeRuling, time: new Date() }]);
      setToast(`Objection ${data.ruling.judgeRuling.toLowerCase()}. Jury ${data.ruling.jurySentimentDelta >= 0 ? '+' : ''}${data.ruling.jurySentimentDelta}%`); setShowObjection(false); setSelectedEvidence(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  function beginFreshTrial() { setSession(null); setMessages(initialMessages.map((m) => ({ ...m, time: new Date() }))); setError(''); setQuestion(''); setSelectedEvidence(null); }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#courtroom" aria-label="AI Trial Room home"><span className="brand-mark"><Scale size={20} strokeWidth={1.8}/></span><span className="brand-copy"><strong>TRIALROOM</strong><small>AN INTELLIGENT COURT SIMULATOR</small></span></a>
      <div className="top-links"><span className="live-dot"/>LIVE SESSION <span className="top-divider">/</span> CASE NO. 24-CR-0842 <span className="top-divider">/</span><button className="help-button"><CircleHelp size={17}/> HELP</button></div>
      <button className="profile-chip"><span>DA</span><span>Defense Counsel</span><ChevronDown size={14}/></button>
      <button className="mobile-menu" aria-label="Open menu"><Menu size={20}/></button>
    </header>

    <section className="case-strip"><div className="case-name"><span className="case-icon"><Gavel size={20}/></span><span><small>NOW IN SESSION</small><strong>{trialCase.title}</strong></span></div><div className="case-meta"><span className="role-pill"><Shield size={13}/>{trialCase.role} counsel</span><span className="meta-divider"/><span className="witness-meta"><span className="mini-avatar">ES</span><span><small>ON THE STAND</small><strong>{trialCase.witness.name}</strong></span></span></div><div className="case-actions"><button className="subtle-button" onClick={beginFreshTrial}><ArrowLeft size={15}/> Case files</button><button className="icon-button" aria-label="More case options"><MoreHorizontal size={20}/></button></div></section>

    <section className="workspace" id="courtroom">
      <aside className="sidebar">
        <div className="sidebar-label">YOUR CASE</div>
        <button className="side-item active"><span className="side-icon"><Scale size={16}/></span><span>Trial room</span><span className="side-indicator"/></button>
        <button className="side-item" onClick={() => setShowEvidence(true)}><span className="side-icon"><BookOpen size={16}/></span><span>Case brief</span><span className="count-pill">04</span></button>
        <button className="side-item" onClick={() => setShowEvidence(true)}><span className="side-icon"><Paperclip size={16}/></span><span>Evidence</span><span className="count-pill">{String(trialCase.briefcase?.length ?? 0).padStart(2, '0')}</span></button>
        <div className="sidebar-rule"/><div className="sidebar-label">TRIAL PROGRESS</div>
        <div className="progress-card"><div className="progress-heading"><span>Jury sentiment</span><strong>{approval}<small>%</small></strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${approval}%` }}/></div><div className="progress-ends"><span>Acquittal</span><span>Conviction</span></div><span className="progress-note">{approval >= 55 ? 'The jury is leaning your way' : 'The jury is undecided'}</span></div>
        <div className="sidebar-label turn-label">SESSION</div><div className="turn-card"><div className="turn-icon"><Clock3 size={16}/></div><div><small>QUESTIONS LEFT</small><strong>{String(turns).padStart(2, '0')} <span>of 15 turns</span></strong></div></div>
        <div className="sidebar-bottom"><div className="sound-row"><span><Volume2 size={15}/> Courtroom audio</span><button className="toggle on" aria-label="Toggle courtroom audio"><i/></button></div><div className="sidebar-footnote"><Info size={13}/> Session is saved automatically</div></div>
      </aside>

      <section className="court-panel">
        <div className="court-header"><div><div className="eyebrow"><span className="live-dot"/> COURTROOM 01 <span className="dot-separator">·</span> {apiMode.toUpperCase()}</div><h1>The witness stand</h1><p>Cross-examine the witness. The jury is listening.</p></div><button className="audio-button"><Headphones size={16}/><span>Audio enabled</span><span className="audio-dot"/></button></div>
        <div className="witness-stage"><div className="stage-topline"><span><span className="record-dot"/> RECORDING</span><span>WITNESS CAM 01 <span className="camera-lines">▥</span></span></div><div className="stage-background"><div className="window-light"/><div className="room-panel panel-one"/><div className="room-panel panel-two"/><div className="room-wall"/><div className="witness-glow"/><div className="witness-portrait"><div className="hair hair-back"/><div className="neck"/><div className="jacket"><div className="lapel lapel-left"/><div className="lapel lapel-right"/><div className="shirt"/><div className="tie"/></div><div className="face"><div className="hair hair-top"/><div className="ear ear-left"/><div className="ear ear-right"/><div className="brow brow-left"/><div className="brow brow-right"/><div className="eye eye-left"/><div className="eye eye-right"/><div className="nose"/><div className="mouth"/><div className="freckles"/></div></div><div className="stage-caption"><div className="sound-wave"><i/><i/><i/><i/><i/><i/><i/><i/></div><span>WITNESS IS LISTENING</span></div></div><div className="witness-caption"><div className="witness-identity"><span className="identity-avatar">ES</span><span><strong>{trialCase.witness.name}</strong><small>{trialCase.witness.roleDescription}</small></span></div><div className="stress-meter"><div className="stress-label"><span>WITNESS COMPOSURE</span><strong>{stress}%</strong></div><div className="stress-track"><div style={{ width: `${stress}%` }}/></div></div><button className="stage-more" aria-label="Witness details"><MoreHorizontal size={19}/></button></div></div>

        <div className="dialogue-heading"><div><h2>Proceedings</h2><span className="message-count">{shownMessages.length} entries</span></div><button className="transcript-button"><AudioLines size={15}/> TRANSCRIPT <ChevronDown size={14}/></button></div>
        <div className="dialogue-list">{shownMessages.map((message, index) => <article className={`message ${message.speaker?.toLowerCase()}`} key={`${index}-${message.text}`}><span className="message-avatar">{message.speaker === 'Judge' ? <Gavel size={14}/> : message.speaker === 'Player' ? 'DA' : 'ES'}</span><div className="message-body"><div className="message-head"><strong>{message.speaker === 'Player' ? 'You · Defense Counsel' : message.speaker === 'Witness' ? trialCase.witness.name : 'The Court'}</strong><time>{message.time ? formatTime(message.time) : 'Just now'}</time></div>{message.speaker === 'Player' && message.ground && <span className="objection-tag">OBJECTION · {message.ground.toUpperCase()}</span>}<p>{message.text}</p>{message.ruling && <span className={`ruling-tag ${message.ruling.toLowerCase()}`}><Gavel size={12}/>{message.ruling.toUpperCase()}</span>}</div></article>)}{busy && <div className="typing-indicator"><span/><span/><span/> The court is considering your submission…</div>}<div ref={dialogueEnd}/></div>

        <form className="composer" onSubmit={submitQuestion}><div className="composer-top"><span className="counsel-badge">DA</span><span>Address the witness</span><button type="button" className="composer-tools" onClick={() => setShowObjection(true)}><Gavel size={14}/> OBJECT</button></div>{selectedEvidence && <div className="attached-evidence"><span>{iconForEvidence(selectedEvidence.id)}</span><strong>{selectedEvidence.title}</strong><button type="button" onClick={() => setSelectedEvidence(null)} aria-label="Remove evidence"><X size={13}/></button></div>}<textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitQuestion(event); } }} placeholder="Ask a question or make a statement to the witness…" rows={2}/><div className="composer-bottom"><div><button type="button" className="compose-tool" onClick={() => setShowEvidence(true)}><Paperclip size={15}/> Present evidence</button><span className="composer-hint">Press <kbd>↵</kbd> to send</span></div><button className="send-button" type="submit" disabled={busy || !question.trim()}><Send size={15}/><span>Send to witness</span><ArrowRight size={14}/></button></div>{error && <div className="error-message">{error}</div>}</form>
        <div className="court-footer"><span><Sparkles size={13}/> AI-generated testimony may be unpredictable</span><span>TRIALROOM v1.0 <i/> {apiMode}</span></div>
      </section>

      <aside className="right-rail"><div className="rail-header"><div><span className="eyebrow">YOUR STRATEGY</span><h2>Trial desk</h2></div><button aria-label="More trial desk options"><MoreHorizontal size={19}/></button></div><div className="rail-card case-summary"><div className="rail-card-title"><span className="summary-icon"><BookOpen size={16}/></span><span><small>CASE BRIEF</small><strong>At a glance</strong></span><button onClick={() => setShowEvidence(true)} aria-label="View case brief"><ArrowRight size={15}/></button></div><p>{trialCase.description}</p><div className="summary-stats"><div><small>YOUR ROLE</small><strong>{trialCase.role} counsel</strong></div><div><small>ON THE STAND</small><strong>{trialCase.witness.name}</strong></div></div><button className="text-link" onClick={() => setShowEvidence(true)}>Read full case brief <ArrowRight size={14}/></button></div><div className="rail-card evidence-card"><div className="evidence-card-heading"><div><span className="eyebrow">AVAILABLE MATERIAL</span><h3>Your evidence</h3></div><button onClick={() => setShowEvidence(true)}>VIEW ALL <ArrowRight size={13}/></button></div><div className="evidence-list">{trialCase.briefcase?.slice(0, 3).map((evidence) => <button key={evidence.id} className={`evidence-item ${selectedEvidence?.id === evidence.id ? 'selected' : ''}`} onClick={() => setSelectedEvidence(selectedEvidence?.id === evidence.id ? null : evidence)}><span className="evidence-symbol">{iconForEvidence(evidence.id)}</span><span><strong>{evidence.title}</strong><small>{evidence.description}</small></span><span className="evidence-arrow"><ArrowRight size={13}/></span></button>)}</div><button className="evidence-action" onClick={() => setShowEvidence(true)}><Paperclip size={14}/> Open evidence briefcase <span>{trialCase.briefcase?.length ?? 0}</span></button></div><button className="objection-prompt" onClick={() => setShowObjection(true)}><span className="objection-icon"><Gavel size={18}/></span><span><strong>Need to object?</strong><small>Challenge testimony with a legal ground.</small></span><ArrowRight size={15}/></button><div className="tip-card"><span className="tip-icon"><Sparkles size={16}/></span><div><small>COUNSEL’S NOTE</small><p>Present evidence while asking about the witness’s timeline to test their recollection.</p></div></div><div className="rail-bottom"><span><Shield size={13}/> PRIVILEGED &amp; CONFIDENTIAL</span><button onClick={beginFreshTrial}>Start over</button></div></aside>
    </section>

    {showEvidence && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowEvidence(false); }}><section className="modal evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-title"><header className="modal-header"><div><span className="eyebrow">CASE NO. 24-CR-0842</span><h2 id="evidence-title">Your evidence briefcase</h2></div><button className="modal-close" onClick={() => setShowEvidence(false)} aria-label="Close evidence briefcase"><X size={19}/></button></header><p className="modal-intro">Choose a piece of evidence to attach to your next question. Evidence can expose inconsistencies in the witness’s testimony.</p><div className="modal-evidence-list">{trialCase.briefcase?.map((evidence, index) => <button key={evidence.id} className={`modal-evidence ${selectedEvidence?.id === evidence.id ? 'selected' : ''}`} onClick={() => setSelectedEvidence(selectedEvidence?.id === evidence.id ? null : evidence)}><span className="evidence-symbol">{iconForEvidence(evidence.id)}</span><span className="modal-evidence-copy"><small>EXHIBIT {String.fromCharCode(65 + index)}</small><strong>{evidence.title}</strong><span>{evidence.description}</span></span>{selectedEvidence?.id === evidence.id && <Check size={17}/>}</button>)}</div><div className="modal-footer"><span>{selectedEvidence ? `Selected: ${selectedEvidence.title}` : 'Select an exhibit to attach'}</span><button className="primary-button" onClick={() => setShowEvidence(false)}>{selectedEvidence ? 'Attach evidence' : 'Done'} <ArrowRight size={15}/></button></div></section></div>}

    {showObjection && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowObjection(false); }}><form className="modal objection-modal" onSubmit={submitObjection} role="dialog" aria-modal="true" aria-labelledby="objection-title"><header className="modal-header"><div><span className="eyebrow">COURTROOM 01 · MOTION</span><h2 id="objection-title">Raise an objection</h2></div><button type="button" className="modal-close" onClick={() => setShowObjection(false)} aria-label="Close objection window"><X size={19}/></button></header><p className="modal-intro">Choose a legal ground and cite the evidence that supports your objection. The judge will rule on its merits.</p><label className="form-label">LEGAL GROUND</label><div className="ground-grid">{grounds.map((item) => <button type="button" key={item} className={`ground-choice ${ground === item ? 'selected' : ''}`} onClick={() => setGround(item)}>{ground === item && <Check size={14}/>}<span>{item}</span></button>)}</div><label className="form-label evidence-label">SUPPORTING EXHIBIT</label><select value={selectedEvidence?.id ?? trialCase.briefcase?.[0]?.id} onChange={(event) => setSelectedEvidence(trialCase.briefcase.find((item) => item.id === event.target.value))}>{trialCase.briefcase?.map((item, index) => <option key={item.id} value={item.id}>Exhibit {String.fromCharCode(65 + index)} · {item.title}</option>)}</select><div className="modal-footer"><span><Info size={14}/> Ruling may affect jury sentiment</span><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit objection'} <ArrowRight size={15}/></button></div></form></div>}

    {toast && <div className="toast"><span><Check size={15}/></span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={14}/></button></div>}
  </main>;
}
