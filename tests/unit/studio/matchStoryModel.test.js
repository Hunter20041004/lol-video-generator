const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const url = pathToFileURL(path.resolve(__dirname, '../../../app/components/studio/matchStoryModel.js')).href;

test('only a validated preview of the current confirmed revision is accepted and edits clear it', async () => {
 const {storyEditorReducer}=await import(url);
 const draft={id:'synthetic',revision:2,confirmedRevision:2,status:'confirmed',segments:[],selectedCandidateId:'fight'};
 const state=storyEditorReducer(undefined,{type:'loaded',draft});
 const preview={draftId:'synthetic',revision:2,videoUrl:'/renders/story-12345678-1234-1234-1234-123456789abc.mp4',materialFingerprint:'a'.repeat(64),validation:{passed:true}};
 const accepted=storyEditorReducer(state,{type:'preview',preview});assert.deepEqual(accepted.preview,preview);
 const edited=storyEditorReducer(accepted,{type:'edit',segments:[]});assert.equal(edited.preview,null);
 for(const bad of [{...preview,revision:1},{...preview,draftId:'other'},{...preview,videoUrl:'https://example.com/video.mp4'},{...preview,validation:{passed:false}}]){
  assert.equal(storyEditorReducer(state,{type:'preview',preview:bad}).preview,null);
 }
});

test('selecting another match clears the previous draft and local edits', async () => {
  const { storyEditorReducer, initialStoryEditor } = await import(url);
  const before = { ...initialStoryEditor, draft: { id: 'old' }, segments: [{ narration: 'old', factIds: [] }], dirty: true, error: 'old' };
  assert.deepEqual(storyEditorReducer(before, { type: 'reset' }), initialStoryEditor);
});

test('a failed save retains local edits for an explicit retry', async () => {
  const { storyEditorReducer } = await import(url);
  const state = { draft: { id: 'd' }, selectedCandidateId: 'fight', segments: [{ narration: '未保存', factIds: ['f'] }], dirty: true, error: '' };
  const failed = storyEditorReducer(state, { type: 'error', message: '保存失敗，請重試' });
  assert.equal(failed.error, '保存失敗，請重試');
  assert.deepEqual(failed.segments, state.segments);
  assert.equal(failed.dirty, true);
});

test('unresolved candidate or empty narration cannot be confirmed', async () => {
  const { canConfirmStory } = await import(url);
  const state = { draft: { research: { candidates: [{ id: 'fight', unresolved: ['時間碼'] }] } }, selectedCandidateId: 'fight', dirty: false, segments: [{ narration: '文字', factIds: ['fact'] }] };
  assert.equal(canConfirmStory(state), false);
  state.draft.research.candidates[0].unresolved = [];
  assert.equal(canConfirmStory(state), true);
  state.segments[0].narration = ' ';
  assert.equal(canConfirmStory(state), false);
  state.segments[0].narration = '文字';
  state.segments[0].factIds = [];
  assert.equal(canConfirmStory(state), false);
});

test('changing the candidate clears the previous narrative and requires saving again', async () => {
  const { storyEditorReducer } = await import(url);
  const changed = storyEditorReducer({ draft: { id: 'd' }, segments: [{ narration: '另一主線', factIds: ['old'] }], dirty: false }, { type: 'candidate', id: 'new' });
  assert.equal(changed.selectedCandidateId, 'new');
  assert.deepEqual(changed.segments, []);
  assert.equal(changed.dirty, true);
});

test('editing a saved confirmed script makes confirmation unusable locally', async () => {
  const { storyEditorReducer, canConfirmStory, isStoryConfirmed } = await import(url);
  const draft = { id: 'draft', revision: 2, confirmedRevision: 2, status: 'confirmed', selectedCandidateId: 'fight', segments: [{ narration: '原稿', factIds: ['fact'] }], research: { candidates: [{ id: 'fight', factIds: ['fact'], unresolved: [] }] } };
  const saved = storyEditorReducer(undefined, { type: 'loaded', draft });
  assert.equal(isStoryConfirmed(saved), true);
  const edited = storyEditorReducer(saved, { type: 'edit', segments: [{ narration: '新稿', factIds: ['fact'] }] });
  assert.equal(edited.dirty, true);
  assert.equal(isStoryConfirmed(edited), false);
  assert.equal(canConfirmStory(edited), false);
  assert.equal(saved.segments[0].narration, '原稿');
});

test('source links reject executable URLs, credentials and callback tokens', async () => {
  const { safeStorySourceUrl } = await import(url);
  assert.equal(safeStorySourceUrl('https://example.com/match'), 'https://example.com/match');
  for (const unsafe of ['javascript:alert(1)', 'https://user:secret@example.com/', 'https://example.com/?code=secret', 'https://example.com/?access_token=secret', 'https://example.com/#access_token=secret', '/local']) {
    assert.equal(safeStorySourceUrl(unsafe), null);
  }
});
