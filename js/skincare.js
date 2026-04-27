// Skincare routine data and rendering
var SKINCARE_AM=[
  {name:'CeraVe Blemish Control Cleanser',desc:'Cleanse, rinse, pat dry. Salicylic acid keeps T-zone oiliness in check.'},
  {name:'e.l.f. Keep Your Balance Toner',desc:'Apply with a cotton pad or pat in with hands. Preps skin for serums.'},
  {name:'Garnier Vitamin C Brightening Serum',desc:'Main brightening + PIH-fighting step. Apply and wait 30 seconds before next product.',tag:'⭐ Key step',tagColor:'var(--gold)'},
  {name:'The Ordinary Multi-Antioxidant Radiance Serum',desc:'Layer on top of Vitamin C for extra radiance and environmental protection.'},
  {name:'Simple Hyaluronic Acid & B5 Serum',desc:'Apply to slightly damp skin for maximum hydration.'},
  {name:'B. by Superdrug Defence Moisturiser SPF 50',desc:'Last step — covers moisturiser and SPF in one. UV exposure darkens PIH significantly.',tag:'🚨 Non-negotiable',tagColor:'var(--rose)'}
];
var SKINCARE_PM=[
  {name:'CeraVe Blemish Control Cleanser',desc:'If worn SPF all day, use micellar water or cleansing balm first, then follow with this.'},
  {name:'e.l.f. Keep Your Balance Toner',desc:'Apply with a cotton pad or pat in with hands.'},
  {name:'Dr. Organic Overnight Recovery Oil',desc:'On gua sha nights only — apply a few drops as slip before your gua sha session.',tag:'🪨 Gua sha nights only',tagColor:'var(--mauve)'},
  {name:'Gua Sha — 3–4× per week',desc:'Always scrape upward and outward. 5–10 minutes. See the Gua Sha tab for the full guide.',tag:'🪨 See guide tab',tagColor:'var(--mauve)'},
  {name:'Simple Hyaluronic Acid & B5 Serum',desc:'Pat into skin after gua sha (or straight after toner on non-gua sha nights).'},
  {name:'Topicals Faded Brightening & Clearing Serum',desc:'Core PIH treatment. Targets dark marks with tranexamic acid, kojic acid and niacinamide.',tag:'⭐ Key step',tagColor:'var(--gold)'},
  {name:'The Ordinary Natural Moisturising Factors + HA',desc:'Seal everything in with moisturiser.'},
  {name:'Dr. Organic Overnight Recovery Oil',desc:'2–3 drops pressed in as the absolute final step to lock everything in overnight.'}
];
var GUASHA_PREP=[
  {name:'Cleanse thoroughly',desc:'Full PM cleanse complete. Skin should be clean with no traces of makeup or SPF.'},
  {name:'Apply your toner',desc:'e.l.f. toner as usual to balance and prep the skin.'},
  {name:'Apply Dr. Organic face oil',desc:'3–4 drops warmed between your palms, then pressed into skin. This is your slip — the stone must never drag or pull on bare skin.'},
  {name:'Hold the stone at a flat angle',desc:'Keep it almost flat against your skin — around 15°. Never hold it upright. Use light, gentle pressure throughout.'}
];
var GUASHA_MOVES=[
  {dir:'↓',area:'Neck — always first',desc:'Use the flat edge. Stroke downward from jaw to collarbone — this opens the lymph nodes before you work the face. 5 slow strokes each side.'},
  {dir:'↗',area:'Jawline & chin',desc:'Place the curved edge along your chin. Sweep outward along the jaw toward your ear. 5–6 strokes each side.'},
  {dir:'↗',area:'Cheeks',desc:'Start beside your nose and sweep outward and upward across the cheekbone toward the hairline. 5–6 strokes each side.'},
  {dir:'→',area:'Under eyes',desc:'Use the small notch or curved edge. Sweep gently outward from inner corner to temple. Very light pressure — this skin is delicate. 3 strokes each side.'},
  {dir:'↑',area:'Forehead',desc:'Sweep upward from brow to hairline, then outward from centre to temples. 5 strokes in each direction.'},
  {dir:'↓',area:'Neck again — always last',desc:'Finish by sweeping down the neck toward the collarbone to drain everything you\'ve moved. 5 strokes each side.'}
];

function skincareStep(num,name,desc,tag,tagColor){
  return '<div style="display:grid;grid-template-columns:32px 1fr;gap:10px;align-items:start;padding:12px 20px;border-bottom:1px solid var(--border)">'
    +'<div style="width:24px;height:24px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--text3);margin-top:2px">'+num+'</div>'
    +'<div><div style="font-size:13px;font-weight:600">'+name+'</div>'
    +'<div style="font-size:11px;color:var(--text2);margin-top:3px;line-height:1.6">'+desc+'</div>'
    +(tag?'<span style="display:inline-block;margin-top:6px;font-size:10px;padding:2px 8px;border-radius:5px;background:'+tagColor+'15;color:'+tagColor+';font-weight:600">'+tag+'</span>':'')
    +'</div></div>';
}

function renderSkincare(){
  var amEl=document.getElementById('skincare-am-steps');
  if(amEl)amEl.innerHTML=SKINCARE_AM.map(function(s,i){return skincareStep(i+1,s.name,s.desc,s.tag,s.tagColor)}).join('');
  var pmEl=document.getElementById('skincare-pm-steps');
  if(pmEl)pmEl.innerHTML=SKINCARE_PM.map(function(s,i){return skincareStep(i+1,s.name,s.desc,s.tag,s.tagColor)}).join('');
  var prepEl=document.getElementById('skincare-guasha-prep');
  if(prepEl)prepEl.innerHTML=GUASHA_PREP.map(function(s,i){return skincareStep(i+1,s.name,s.desc)}).join('');
  var movesEl=document.getElementById('skincare-guasha-moves');
  if(movesEl)movesEl.innerHTML=GUASHA_MOVES.map(function(m){
    return '<div style="padding:12px 20px;border-bottom:1px solid var(--border)">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
      +'<span style="font-size:16px;font-weight:600;color:var(--accent)">'+m.dir+'</span>'
      +'<span style="font-size:13px;font-weight:600">'+m.area+'</span></div>'
      +'<div style="font-size:11px;color:var(--text2);line-height:1.6">'+m.desc+'</div></div>';
  }).join('');
}
