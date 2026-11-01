export const initialStoryEditor = { draft: null, selectedCandidateId: null, segments: [], dirty: false, error: '', preview: null };

export function safeStorySourceUrl(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) return null;
    if ([...url.searchParams.keys()].some(key => /token|secret|password|^code$|^state$|api.?key/i.test(key))) return null;
    return url.href;
  } catch { return null; }
}

export function isStoryConfirmed(state) {
  return !state.dirty && !!state.draft && state.draft.status === 'confirmed' && state.draft.confirmedRevision === state.draft.revision;
}

export function canConfirmStory(state) {
  const candidate = state.draft?.research.candidates.find(item => item.id === state.selectedCandidateId);
  return !!candidate && candidate.unresolved.length === 0 && !state.dirty && state.segments.length > 0
    && state.segments.every(segment => segment.narration.trim() && segment.factIds.length > 0);
}

export function storyEditorReducer(state = initialStoryEditor, event) {
  if (event.type === 'reset') return initialStoryEditor;
  if (event.type === 'loaded') return { draft: event.draft, selectedCandidateId: event.draft.selectedCandidateId, segments: structuredClone(event.draft.segments), dirty: false, error: '', preview: null };
  if (event.type === 'edit') return { ...state, segments: event.segments, dirty: true, error: '', preview: null };
  if (event.type === 'candidate') return { ...state, selectedCandidateId: event.id, segments: [], dirty: true, error: '', preview: null };
  if (event.type === 'preview') {
    const preview=event.preview;
    if(!isStoryConfirmed(state)||preview?.draftId!==state.draft.id||preview?.revision!==state.draft.revision
      ||!/^\/renders\/story-[a-f0-9-]+\.mp4$/.test(preview?.videoUrl || '')||preview?.validation?.passed!==true
      ||! /^[a-f0-9]{64}$/.test(preview?.materialFingerprint || ''))return {...state,preview:null,error:'預覽與目前稿件版本不一致，未載入影片。'};
    return {...state,preview,error:''};
  }
  if (event.type === 'error') return { ...state, error: event.message };
  return state;
}
