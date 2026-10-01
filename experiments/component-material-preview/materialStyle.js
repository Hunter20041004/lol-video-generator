// Preview-only, one-to-one material substitution. No data or layout rewrites.
const COLORS = {
  '#07141C':'#0A1211', '#030B10':'#050A09', '#C89B3C':'#B49A65',
  '#E6C66B':'#D8C399', '#0AC8B9':'#8F9E85', '#F0E6D2':'#EBE5D7',
  '#6B7C86':'#A0AA9B', '#0D202A':'#131C1B', '#09212A':'#101A16',
  '10,200,185':'143,158,133', '200,155,60':'180,154,101',
  '240,230,210':'235,229,215', '107,124,134':'160,170,155',
  '13,32,42':'19,28,27', '7,20,28':'10,18,17', '3,11,16':'5,10,9',
};
function restyleSource(source) {
  let out=source;
  for(const [from,to] of Object.entries(COLORS)) out=out.split(from).join(to);
  return out;
}
function restyleFrameSource(source) {
  return restyleSource(source)
    .split('\n').filter(line=>!line.includes('data-rift-lattice')&&!line.includes('backgroundSize: "390px 390px')).join('\n')
    .replace(/background: `radial-gradient[^`]+`/g,'background: COLORS.void')
    .replace('data-visual-world="lol-broadcast"','data-visual-world="lol-classic-components"');
}
function restyleTokens(source) {
  return restyleSource(source)
    .replace(/polygon\(18px 0[^\"]+/, 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)')
    .replace(/polygon\(25% 6\.7%[^\"]+/, 'inset(0 round 50%)');
}
// Explicit, guarded preview layout edits. Fail rather than silently drift if
// the incumbent component changes; production must use shared themed components.
function replaceOnce(source, from, to) {
  if (!source.includes(from) || source.indexOf(from) !== source.lastIndexOf(from)) {
    throw new Error('Preview layout source contract changed');
  }
  return source.replace(from,to);
}
function polishSceneSource(source) {
  const start=source.indexOf('export const PlayerProofScene');
  const end=source.indexOf('export const FinalReadScene');
  if(start < 0 || end < start) throw new Error('Preview player section missing');
  let player=source.slice(start,end);
  const edits=[
    ['right: 58, top: 220, width: 610, height: 720','right: 70, top: 260, width: 500, height: 660'],
    ['right: -80, top: 38, width: 820','right: -110, top: 38, width: 720'],
    ['left: SAFE_X, top: 280, width: 610','left: SAFE_X, top: 300, width: 430'],
    ['<SceneLabel>{proof.label || (locale === "en" ? "DATA MVP CANDIDATE" : "數據 MVP 候選")}</SceneLabel>\n        <div style={{ marginTop: 22, font: `900 142px/.82 ${NUMBER_FONT}`, letterSpacing: -4 }}>{player.name}</div>', '<div style={{ font: `800 112px/.9 ${NUMBER_FONT}`, letterSpacing: -2 }}>{player.name}</div>\n        <div style={{ marginTop: 24 }}><SceneLabel>{proof.label || (locale === "en" ? "DATA MVP CANDIDATE" : "數據 MVP 候選")}</SceneLabel></div>'],
    ['style={{ marginTop: 150 }}','style={{ marginTop: 120 }}'],
    ['900 210px/.78','800 156px/.9'],
    ['right: 76, top: 1015','right: 70, top: 990'],
    ['left: SAFE_X, top: 1460','left: SAFE_X, top: 1185'],
    ['left: 460, right: 90, top: 1260','left: SAFE_X, right: 70, top: 1270'],
  ];
  for(const [from,to] of edits) player=replaceOnce(player,from,to);
  return source.slice(0,start)+player+source.slice(end);
}
function polishSurfaceSource(source) {
  let out=replaceOnce(source,'const SAFE_X = 70;',`const SAFE_X = 70;
const PANEL_FINISH = {
  boxShadow: "inset 0 1px 0 rgba(240,230,210,.10), inset 0 -1px 0 rgba(0,0,0,.28), 0 12px 28px rgba(0,0,0,.24)",
};`);
  for(const marker of [
    'minWidth: 0, padding: compact',
    'width: 390, minHeight: 460',
    'position: "absolute", right: 70, top: 260',
    'padding: "20px 26px", clipPath: CUT_CORNER',
    'position: "absolute", left: 82, right: 82, top: 205',
    'padding: "24px 30px", clipPath: CUT_CORNER',
  ]) out=replaceOnce(out,marker,`...PANEL_FINISH, ${marker}`);
  out=replaceOnce(out,'900 58px/1.28','900 54px/1.32');
  out=replaceOnce(out,'letterSpacing: -3, color: COLORS.moon','letterSpacing: -1.5, color: COLORS.moon');
  return out;
}
module.exports={restyleSource,restyleFrameSource,restyleTokens,polishSceneSource,polishSurfaceSource};
