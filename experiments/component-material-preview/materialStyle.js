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
module.exports={restyleSource,restyleFrameSource,restyleTokens};
