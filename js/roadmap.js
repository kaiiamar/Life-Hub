// ROADMAP LOGIC
// ============================================================
var RM_PHASE_COLORS={1:'var(--peach)',2:'var(--uni)',3:'var(--mint)'};
var RM_PHASE_BG={1:'rgba(212,132,90,0.12)',2:'rgba(139,111,176,0.12)',3:'rgba(107,158,122,0.12)'};
var RM_PHASE_LABELS={1:'Phase 1 \u2014 Clear the Decks',2:'Phase 2 \u2014 Launch',3:'Phase 3 \u2014 New Era'};

function rmKey(mid,si,ii){return mid+'_'+si+'_'+ii}
function rmIsDone(mid,si,ii){return !!((STATE.roadmapChecklist||{})[rmKey(mid,si,ii)])}
function rmGetItemText(mid,si,ii){var ov=(STATE.roadmapEdits||{})[rmKey(mid,si,ii)];if(ov)return ov;var m=RM_MONTHS.find(function(x){return x.id===mid});if(m&&m.sections[si]&&m.sections[si].items[ii])return {text:m.sections[si].items[ii].text,note:m.sections[si].items[ii].note||''};return {text:'',note:''}}
function rmGetItems(month){
var base=[];
month.sections.forEach(function(sec,si){
sec.items.forEach(function(item,ii){base.push({mid:month.id,si:si,ii:ii,key:rmKey(month.id,si,ii)})})});
var added=(STATE.roadmapAdded||[]).filter(function(a){return a.mid===month.id});
return {base:base,added:added}}
function rmGetProgress(month){var total=0,done=0;month.sections.forEach(function(sec,si){sec.items.forEach(function(_,ii){var k=rmKey(month.id,si,ii);if((STATE.roadmapHidden||{})[k])return;total++;if(rmIsDone(month.id,si,ii))done++})});
var added=(STATE.roadmapAdded||[]).filter(function(a){return a.mid===month.id});
added.forEach(function(a){total++;if((STATE.roadmapChecklist||{})[a.id])done++});
return {total:total,done:done,pct:total===0?0:Math.round(done/total*100)}}
function rmPctColor(p){return p>=80?'#6b9e7a':p>=50?'#c9973a':p>=20?'#d4845a':'#b89870'}

function rmGetCurrentMonthIdx(){var now=new Date();var monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];var curName=monthNames[now.getMonth()];var curYear=now.getFullYear().toString();var idx=RM_MONTHS.findIndex(function(m){return m.name===curName&&m.year===curYear});return idx>=0?idx:0}

var rmHideDone=false;
var rmCollapsedSections={};

function rmToggleItem(mid,si,ii){if(!STATE.roadmapChecklist)STATE.roadmapChecklist={};var k=rmKey(mid,si,ii);var wasChecked=STATE.roadmapChecklist[k];STATE.roadmapChecklist[k]=!STATE.roadmapChecklist[k];saveState();rmRebuildPanel(mid);rmUpdateTabPct(mid);rmUpdateOverall();rmBuildFocusCard();if(!wasChecked&&STATE.roadmapChecklist[k]){var month=RM_MONTHS.find(function(m){return m.id===mid});if(month){var sec=month.sections[si];if(sec){var secDone=sec.items.every(function(_,ii2){var k2=rmKey(mid,si,ii2);return (STATE.roadmapHidden||{})[k2]||rmIsDone(mid,si,ii2)});var addedInSec=(STATE.roadmapAdded||[]).filter(function(a){return a.mid===mid&&a.si===si});var addedAllDone=addedInSec.every(function(a){return (STATE.roadmapChecklist||{})[a.id]});var visibleCount=sec.items.filter(function(_,ii2){return !(STATE.roadmapHidden||{})[rmKey(mid,si,ii2)]}).length;if(secDone&&addedAllDone&&visibleCount>0){fireConfetti();showCelebrationToast(sec.label+' complete!','✅')}}var pr=rmGetProgress(month);if(pr.pct===100){setTimeout(function(){fireConfetti({count:180,duration:3500});showCelebrationToast(month.name+' '+month.year+' — all done!','🗓️')},600)}}}}

function rmToggleAddedItem(id){if(!STATE.roadmapChecklist)STATE.roadmapChecklist={};STATE.roadmapChecklist[id]=!STATE.roadmapChecklist[id];saveState();var item=(STATE.roadmapAdded||[]).find(function(a){return a.id===id});if(item)rmRebuildPanel(item.mid);rmUpdateOverall();rmBuildFocusCard()}

function rmUpdateTabPct(mid){var month=RM_MONTHS.find(function(m){return m.id===mid});if(!month)return;var pr=rmGetProgress(month);var el=document.getElementById('rmtabpct-'+mid);if(el){el.textContent=pr.pct+'%';el.style.color=rmPctColor(pr.pct)}}

function rmUpdateOverall(){var td=0,ti=0;RM_MONTHS.forEach(function(m){var p=rmGetProgress(m);td+=p.done;ti+=p.total});var pct=ti===0?0:Math.round(td/ti*100);var de=document.getElementById('rm-total-done');if(de)de.textContent=td;var ie=document.getElementById('rm-total-items');if(ie)ie.textContent=ti;var pe=document.getElementById('rm-total-pct');if(pe)pe.textContent=pct+'%';var be=document.getElementById('rm-total-bar');if(be)be.style.width=pct+'%';rmUpdateOverdueTabs()}

function rmUpdateOverdueTabs(){var now=new Date();var monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];RM_MONTHS.forEach(function(m,i){var btn=document.getElementById('rmtab-'+m.id);if(!btn)return;var mDate=new Date(Number(m.year),monthNames.indexOf(m.name)+1,0);var isPast=mDate<now;var pr=rmGetProgress(m);var curIdx=rmGetCurrentMonthIdx();btn.classList.toggle('overdue',isPast&&pr.pct<100);btn.classList.toggle('current',i===curIdx)})}

function rmToggleHideDone(){rmHideDone=!rmHideDone;var btn=document.getElementById('rm-hide-done');if(btn)btn.classList.toggle('active',rmHideDone);RM_MONTHS.forEach(function(m){rmRebuildPanel(m.id)})}

function rmCollapseCompleted(){var anyExpanded=false;RM_MONTHS.forEach(function(m){m.sections.forEach(function(sec,si){var secHidden=sec.items.filter(function(_,ii){return (STATE.roadmapHidden||{})[rmKey(m.id,si,ii)]}).length;var secDone=sec.items.filter(function(_,ii){var k=rmKey(m.id,si,ii);if((STATE.roadmapHidden||{})[k])return false;return rmIsDone(m.id,si,ii)}).length;var addedInSec=(STATE.roadmapAdded||[]).filter(function(a){return a.mid===m.id&&a.si===si});var addedDone=addedInSec.filter(function(a){return (STATE.roadmapChecklist||{})[a.id]}).length;var total=sec.items.length-secHidden+addedInSec.length;var done=secDone+addedDone;if(done===total&&total>0){var k2=m.id+'_'+si;if(!rmCollapsedSections[k2])anyExpanded=true;rmCollapsedSections[k2]=true}})});if(!anyExpanded){rmCollapsedSections={}}RM_MONTHS.forEach(function(m){rmRebuildPanel(m.id)});var btn=document.getElementById('rm-collapse-all');if(btn)btn.classList.toggle('active',anyExpanded)}

function rmToggleSection(mid,si){var k=mid+'_'+si;rmCollapsedSections[k]=!rmCollapsedSections[k];var card=document.getElementById('rmsec-'+k);if(card)card.classList.toggle('collapsed',!!rmCollapsedSections[k])}

function rmJumpToCurrent(){rmSwitchTab(rmGetCurrentMonthIdx())}

function rmEditItem(mid,si,ii){var item=rmGetItemText(mid,si,ii);var dueDate=(STATE.roadmapDueDates||{})[rmKey(mid,si,ii)]||'';var mc=document.getElementById('modal-content');mc.innerHTML='<h2>✏️ Edit item</h2><div class="field"><label>Task</label><textarea id="m-rmtext" style="min-height:60px">'+item.text.replace(/"/g,'&quot;')+'</textarea></div><div class="field"><label>Note (optional)</label><textarea id="m-rmnote" style="min-height:50px">'+(item.note||'').replace(/"/g,'&quot;')+'</textarea></div><div class="field-row"><div class="field"><label>Due date</label><input id="m-rmdue" type="date" value="'+dueDate+'"></div><div class="field"><label>Move to month</label><select id="m-rmmove">'+RM_MONTHS.map(function(m){return '<option value="'+m.id+'"'+(m.id===mid?' selected':'')+'>'+m.name+' '+m.year+'</option>'}).join('')+'</select></div></div><div class="modal-btns"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-danger" onclick="rmDeleteItem(\''+mid+'\','+si+','+ii+');closeModal()">Delete</button><button class="btn btn-accent" onclick="rmSaveEdit(\''+mid+'\','+si+','+ii+');closeModal()">Save ✓</button></div>';document.getElementById('modal').style.display='flex'}

function rmSaveEdit(mid,si,ii){var text=((document.getElementById('m-rmtext')||{}).value||'').trim();var note=((document.getElementById('m-rmnote')||{}).value||'').trim();var moveTo=((document.getElementById('m-rmmove')||{}).value||mid);var dueDate=((document.getElementById('m-rmdue')||{}).value||'');if(!text)return;if(!STATE.roadmapEdits)STATE.roadmapEdits={};var k=rmKey(mid,si,ii);STATE.roadmapEdits[k]={text:text,note:note};if(!STATE.roadmapDueDates)STATE.roadmapDueDates={};if(dueDate)STATE.roadmapDueDates[k]=dueDate;else delete STATE.roadmapDueDates[k];if(moveTo!==mid){if(!STATE.roadmapMoved)STATE.roadmapMoved={};STATE.roadmapMoved[k]=moveTo;if(!STATE.roadmapAdded)STATE.roadmapAdded=[];var m=RM_MONTHS.find(function(x){return x.id===moveTo});if(m){STATE.roadmapAdded.push({id:'rma_'+g(),mid:moveTo,si:0,text:text,note:note,dueDate:dueDate});STATE.roadmapChecklist[k]=true;if(!STATE.roadmapHidden)STATE.roadmapHidden={};STATE.roadmapHidden[k]=true}}saveState();rmRebuildPanel(mid);if(moveTo!==mid)rmRebuildPanel(moveTo);rmUpdateTabPct(mid);if(moveTo!==mid)rmUpdateTabPct(moveTo);rmUpdateOverall();rmBuildFocusCard()}

function rmDeleteItem(mid,si,ii){var k=rmKey(mid,si,ii);if(!STATE.roadmapChecklist)STATE.roadmapChecklist={};STATE.roadmapChecklist[k]=true;if(!STATE.roadmapHidden)STATE.roadmapHidden={};STATE.roadmapHidden[k]=true;saveState();rmRebuildPanel(mid);rmUpdateTabPct(mid);rmUpdateOverall();rmBuildFocusCard()}

function rmEditAdded(id){var item=(STATE.roadmapAdded||[]).find(function(a){return a.id===id});if(!item)return;var mc=document.getElementById('modal-content');mc.innerHTML='<h2>✏️ Edit item</h2><div class="field"><label>Task</label><textarea id="m-rmtext" style="min-height:60px">'+item.text.replace(/"/g,'&quot;')+'</textarea></div><div class="field"><label>Note (optional)</label><textarea id="m-rmnote" style="min-height:50px">'+(item.note||'').replace(/"/g,'&quot;')+'</textarea></div><div class="field-row"><div class="field"><label>Due date</label><input id="m-rmdue" type="date" value="'+(item.dueDate||'')+'"></div><div class="field"><label>Move to month</label><select id="m-rmmove">'+RM_MONTHS.map(function(m){return '<option value="'+m.id+'"'+(m.id===item.mid?' selected':'')+'>'+m.name+' '+m.year+'</option>'}).join('')+'</select></div></div><div class="modal-btns"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-danger" onclick="rmDeleteAdded(\''+id+'\');closeModal()">Delete</button><button class="btn btn-accent" onclick="rmSaveAdded(\''+id+'\');closeModal()">Save ✓</button></div>';document.getElementById('modal').style.display='flex'}

function rmSaveAdded(id){var item=(STATE.roadmapAdded||[]).find(function(a){return a.id===id});if(!item)return;var oldMid=item.mid;item.text=((document.getElementById('m-rmtext')||{}).value||'').trim()||item.text;item.note=((document.getElementById('m-rmnote')||{}).value||'').trim();item.dueDate=((document.getElementById('m-rmdue')||{}).value||'');item.mid=((document.getElementById('m-rmmove')||{}).value||item.mid);saveState();rmRebuildPanel(oldMid);if(oldMid!==item.mid)rmRebuildPanel(item.mid);rmUpdateOverall();rmBuildFocusCard()}

function rmDeleteAdded(id){STATE.roadmapAdded=(STATE.roadmapAdded||[]).filter(function(a){return a.id!==id});delete (STATE.roadmapChecklist||{})[id];saveState();RM_MONTHS.forEach(function(m){rmRebuildPanel(m.id)});rmUpdateOverall();rmBuildFocusCard()}

function rmAddItem(mid,si){var mc=document.getElementById('modal-content');mc.innerHTML='<h2>➕ Add item</h2><div class="field"><label>Task</label><textarea id="m-rmtext" style="min-height:60px" placeholder="What needs to be done?"></textarea></div><div class="field"><label>Note (optional)</label><textarea id="m-rmnote" style="min-height:50px" placeholder="Extra context..."></textarea></div><div class="field"><label>Due date (optional)</label><input id="m-rmdue" type="date"></div><div class="modal-btns"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="rmSaveNewItem(\''+mid+'\','+si+');closeModal()">Add ✓</button></div>';document.getElementById('modal').style.display='flex'}

function rmSaveNewItem(mid,si){var text=((document.getElementById('m-rmtext')||{}).value||'').trim();if(!text)return;var dueDate=((document.getElementById('m-rmdue')||{}).value||'');if(!STATE.roadmapAdded)STATE.roadmapAdded=[];STATE.roadmapAdded.push({id:'rma_'+g(),mid:mid,si:si,text:text,note:((document.getElementById('m-rmnote')||{}).value||'').trim(),dueDate:dueDate});saveState();rmRebuildPanel(mid);rmUpdateTabPct(mid);rmUpdateOverall();rmBuildFocusCard()}

function rmBuildFocusCard(){var el=document.getElementById('rm-focus-card');if(!el)return;var idx=rmGetCurrentMonthIdx();var month=RM_MONTHS[idx];if(!month){el.innerHTML='';return}var pr=rmGetProgress(month);var remaining=pr.total-pr.done;var nextItems=[];month.sections.forEach(function(sec,si){sec.items.forEach(function(item,ii){var k=rmKey(month.id,si,ii);if(!rmIsDone(month.id,si,ii)&&!(STATE.roadmapHidden||{})[k]&&nextItems.length<3){var it=rmGetItemText(month.id,si,ii);nextItems.push({text:it.text,label:sec.label})}})});
var needsWork=[];month.sections.forEach(function(sec,si){var secHidden=sec.items.filter(function(_,ii){return (STATE.roadmapHidden||{})[rmKey(month.id,si,ii)]}).length;var secTotal=sec.items.length-secHidden;var secDone=sec.items.filter(function(_,ii){var k=rmKey(month.id,si,ii);if((STATE.roadmapHidden||{})[k])return false;return rmIsDone(month.id,si,ii)}).length;if(secDone<secTotal)needsWork.push({label:sec.label,left:secTotal-secDone})});
needsWork.sort(function(a,b){return b.left-a.left});
el.innerHTML='<div class="rm-focus-card"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><div style="font-size:11px;color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">📍 '+month.name+' '+month.year+' — Focus</div><div style="font-size:13px;color:var(--text)"><span style="font-weight:600">'+remaining+'</span> items remaining · '+pr.pct+'% complete</div></div><div style="font-family:var(--serif);font-size:28px;font-weight:600;color:'+rmPctColor(pr.pct)+'">'+pr.pct+'%</div></div>'
+(nextItems.length?'<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px"><div style="font-size:10px;color:var(--text3);font-weight:600;text-transform:uppercase;margin-bottom:6px">Next up</div>'+nextItems.map(function(n){return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><span style="font-size:10px;color:var(--text3)">'+n.label+'</span><span style="font-size:12px">'+n.text+'</span></div>'}).join('')+'</div>':'')
+(needsWork.length?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+needsWork.slice(0,4).map(function(s){return '<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(201,151,58,0.15);color:#8a6000">'+s.label+': '+s.left+' left</span>'}).join('')+'</div>':'')
+'</div>'}

function rmRebuildPanel(mid){var month=RM_MONTHS.find(function(m){return m.id===mid});if(!month)return;var panel=document.getElementById('rmpanel-'+mid);if(!panel)return;var pr=rmGetProgress(month);var idx=RM_MONTHS.indexOf(month);
var pillsH=month.pills.map(function(p){var l=p==='uni'?'Uni':p==='thailand'?'Thailand':p==='growth'?'Personal':p.charAt(0).toUpperCase()+p.slice(1);return '<span class="rm-pill rm-pill-'+p+'">'+l+'</span>'}).join('');
var html='<div class="rm-month-hero"><div><div class="rm-phase-badge" style="background:'+RM_PHASE_BG[month.phase]+';color:'+RM_PHASE_COLORS[month.phase]+'">'+RM_PHASE_LABELS[month.phase]+'</div><div class="rm-month-title">'+month.name+' '+month.year+'</div><div class="rm-month-pills">'+pillsH+'</div></div><div class="rm-month-right"><div class="rm-month-pct" id="rmpct-'+month.id+'" style="color:'+rmPctColor(pr.pct)+'">'+pr.pct+'%</div><div class="rm-month-done" id="rmdone-'+month.id+'">'+pr.done+'/'+pr.total+' done</div><div class="rm-month-pbar-bg"><div class="rm-month-pbar-fill" id="rmbar-'+month.id+'" style="width:'+pr.pct+'%;background:'+rmPctColor(pr.pct)+'"></div></div></div></div>';
if(month.milestone)html+='<div class="rm-milestone"><div class="rm-milestone-icon">'+month.milestone.icon+'</div><div><div class="rm-milestone-text">'+month.milestone.text+'</div><div class="rm-milestone-sub">'+month.milestone.sub+'</div></div></div>';
if(month.deadline)html+='<div class="rm-deadline">\u26a0\ufe0f <div><strong>'+month.deadline.text+'</strong> \u2014 '+month.deadline.sub+'</div></div>';
/* Dynamic goal milestones — show goals with deadlines in this month or next month */
var monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
var mIdx=monthNames.indexOf(month.name);var mYear=Number(month.year);var nextMIdx=(mIdx+1)%12;var nextMYear=mIdx===11?mYear+1:mYear;
(STATE.goals||[]).forEach(function(goal){if(!goal.deadline)return;var dl=String(goal.deadline);var parts=dl.split('-');if(parts.length<2)return;var gMonth=parseInt(parts[1],10)-1;var gYear=parseInt(parts[0],10);var isThisMonth=(gMonth===mIdx&&gYear===mYear);var isNextMonth=(gMonth===nextMIdx&&gYear===nextMYear);if(isThisMonth||isNextMonth){var catIcons={Finance:'\ud83d\udcb8',Fitness:'\ud83c\udfcb\ufe0f',Career:'\ud83d\udcbc',Personal:'\ud83c\udf1f'};var icon=catIcons[goal.cat]||'\ud83c\udfaf';var isDone=goal.done;var upcomingTag=isNextMonth&&!isDone?' <span style="font-size:11px;color:var(--teal);opacity:0.8">(next month)</span>':'';html+='<div class="rm-milestone" style="'+(isDone?'opacity:0.6;background:rgba(107,158,122,0.1);border-color:var(--mint)':'')+'"><div class="rm-milestone-icon">'+icon+'</div><div><div class="rm-milestone-text"'+(isDone?' style="text-decoration:line-through;color:var(--mint)"':'')+'>'+goal.name+upcomingTag+'</div><div class="rm-milestone-sub">'+(isDone?'Goal completed \u2713':'Deadline: '+fmtDate(goal.deadline))+'</div></div></div>'}});
if(month.showFinance)html+=rmBuildLiveCard();
html+='<div class="rm-sections-grid">';
/* Pre-build carry-over items from other months whose due date falls in THIS month, grouped by section index */
var carryBySec={};
RM_MONTHS.forEach(function(om){if(om.id===month.id)return;om.sections.forEach(function(osec,osi){osec.items.forEach(function(oitem,oii){var ok=rmKey(om.id,osi,oii);if((STATE.roadmapHidden||{})[ok])return;if(rmIsDone(om.id,osi,oii))return;var od=(STATE.roadmapDueDates||{})[ok]||'';if(!od)return;var dp=od.split('-');if(dp.length<2)return;var dM=parseInt(dp[1],10)-1;var dY=parseInt(dp[0],10);if(dM===mIdx&&dY===mYear){var ot=rmGetItemText(om.id,osi,oii);if(!carryBySec[osi])carryBySec[osi]=[];carryBySec[osi].push({text:ot.text,note:ot.note,due:od,fromMonth:om.name,mid:om.id,si:osi,ii:oii,type:'builtin'})}})});
(STATE.roadmapAdded||[]).filter(function(a){return a.mid===om.id}).forEach(function(a){if((STATE.roadmapChecklist||{})[a.id])return;if(!a.dueDate)return;var dp2=a.dueDate.split('-');if(dp2.length<2)return;var dM2=parseInt(dp2[1],10)-1;var dY2=parseInt(dp2[0],10);if(dM2===mIdx&&dY2===mYear){if(!carryBySec[a.si])carryBySec[a.si]=[];carryBySec[a.si].push({text:a.text,note:a.note||'',due:a.dueDate,fromMonth:om.name,aid:a.id,type:'added'})}})});
month.sections.forEach(function(sec,si){
var secDone=sec.items.filter(function(_,ii){var k=rmKey(month.id,si,ii);if((STATE.roadmapHidden||{})[k])return false;return rmIsDone(month.id,si,ii)}).length;
var secHidden=sec.items.filter(function(_,ii){return (STATE.roadmapHidden||{})[rmKey(month.id,si,ii)]}).length;
var addedInSec=(STATE.roadmapAdded||[]).filter(function(a){return a.mid===month.id&&a.si===si});
var addedDone=addedInSec.filter(function(a){return (STATE.roadmapChecklist||{})[a.id]}).length;
var totalSec=sec.items.length-secHidden+addedInSec.length;
var doneSec=secDone+addedDone;
var isCollapsed=!!rmCollapsedSections[month.id+'_'+si];
html+='<div class="rm-section-card'+(isCollapsed?' collapsed':'')+'" id="rmsec-'+month.id+'_'+si+'"><div class="rm-section-header" style="border-left:3px solid var(--'+sec.color+')"><span class="rm-section-title" style="color:var(--'+sec.color+');cursor:pointer" onclick="rmToggleSection(\''+month.id+'\','+si+')"><button class="rm-collapse-btn">▼</button> '+sec.label+'</span><span class="rm-section-count">'+doneSec+'/'+totalSec+'</span></div><div class="rm-items">';
sec.items.forEach(function(item,ii){
var k=rmKey(month.id,si,ii);
if((STATE.roadmapHidden||{})[k])return;
var done=rmIsDone(month.id,si,ii);
if(rmHideDone&&done)return;
var it=rmGetItemText(month.id,si,ii);
var itemDue=(STATE.roadmapDueDates||{})[k]||'';
var dueTag='';if(itemDue){var dl2=Math.ceil((new Date(itemDue)-new Date())/86400000);dueTag='<span style="font-size:9px;padding:1px 6px;border-radius:6px;margin-left:4px;'+(dl2<0&&!done?'background:var(--red-dim);color:var(--red)':dl2<=7&&!done?'background:var(--amber-dim);color:var(--amber)':'background:var(--bg4);color:var(--text3)')+'">📅 '+fmtDate(itemDue)+'</span>'}
html+='<div class="rm-item'+(done?' done':'')+'" id="rmitem-'+k+'">'
+'<div class="rm-checkbox" onclick="event.stopPropagation();rmToggleItem(\''+month.id+'\','+si+','+ii+')"></div>'
+'<div class="rm-item-content" onclick="event.stopPropagation();rmToggleItem(\''+month.id+'\','+si+','+ii+')">'
+'<div class="rm-item-text">'+it.text+dueTag+'</div>'
+(it.note?'<div class="rm-item-note">'+it.note+'</div>':'')
+'</div>'
+'<div class="rm-item-actions">'
+'<button class="rm-item-action" onclick="event.stopPropagation();rmEditItem(\''+month.id+'\','+si+','+ii+')" title="Edit">✏️</button>'
+'</div></div>'});
addedInSec.forEach(function(a){
var adone=!!(STATE.roadmapChecklist||{})[a.id];
if(rmHideDone&&adone)return;
var aDueTag='';if(a.dueDate){var adl=Math.ceil((new Date(a.dueDate)-new Date())/86400000);aDueTag='<span style="font-size:9px;padding:1px 6px;border-radius:6px;margin-left:4px;'+(adl<0&&!adone?'background:var(--red-dim);color:var(--red)':adl<=7&&!adone?'background:var(--amber-dim);color:var(--amber)':'background:var(--bg4);color:var(--text3)')+'">📅 '+fmtDate(a.dueDate)+'</span>'}
html+='<div class="rm-item'+(adone?' done':'')+'">'
+'<div class="rm-checkbox" onclick="event.stopPropagation();rmToggleAddedItem(\''+a.id+'\')"></div>'
+'<div class="rm-item-content" onclick="event.stopPropagation();rmToggleAddedItem(\''+a.id+'\')">'
+'<div class="rm-item-text">'+a.text+aDueTag+'</div>'
+(a.note?'<div class="rm-item-note">'+a.note+'</div>':'')
+'</div>'
+'<div class="rm-item-actions">'
+'<button class="rm-item-action" onclick="event.stopPropagation();rmEditAdded(\''+a.id+'\')" title="Edit">✏️</button>'
+'</div></div>'});
html+='<div style="padding:4px 8px"><button class="add-sub" onclick="rmAddItem(\''+month.id+'\','+si+')">+ Add item</button></div>';
/* Render carry-over items for this section */
(carryBySec[si]||[]).forEach(function(ci){var cdl=Math.ceil((new Date(ci.due)-new Date())/86400000);var cDueTag='<span style="font-size:9px;padding:1px 6px;border-radius:6px;margin-left:4px;'+(cdl<0?'background:var(--red-dim);color:var(--red)':cdl<=7?'background:var(--amber-dim);color:var(--amber)':'background:var(--bg4);color:var(--text3)')+'">📅 '+fmtDate(ci.due)+'</span>';var fromTag='<span style="font-size:9px;padding:1px 6px;border-radius:6px;margin-left:4px;background:var(--bg4);color:var(--text3)">from '+ci.fromMonth+'</span>';
if(ci.type==='builtin'){html+='<div class="rm-item" style="opacity:0.85">'
+'<div class="rm-checkbox" onclick="event.stopPropagation();rmToggleItem(\''+ci.mid+'\','+ci.si+','+ci.ii+')"></div>'
+'<div class="rm-item-content" onclick="event.stopPropagation();rmToggleItem(\''+ci.mid+'\','+ci.si+','+ci.ii+')">'
+'<div class="rm-item-text">'+ci.text+cDueTag+fromTag+'</div>'
+(ci.note?'<div class="rm-item-note">'+ci.note+'</div>':'')
+'</div></div>'}else{html+='<div class="rm-item" style="opacity:0.85">'
+'<div class="rm-checkbox" onclick="event.stopPropagation();rmToggleAddedItem(\''+ci.aid+'\')"></div>'
+'<div class="rm-item-content" onclick="event.stopPropagation();rmToggleAddedItem(\''+ci.aid+'\')">'
+'<div class="rm-item-text">'+ci.text+cDueTag+fromTag+'</div>'
+(ci.note?'<div class="rm-item-note">'+ci.note+'</div>':'')
+'</div></div>'}});
html+='</div></div>'});
html+='</div>';
html+='<div class="rm-month-nav">';
if(idx>0)html+='<button class="rm-nav-btn" onclick="rmSwitchTab('+(idx-1)+'">\u2190 '+RM_MONTHS[idx-1].name+'</button>';else html+='<div></div>';
html+='<div class="rm-nav-center">'+month.name+' '+month.year+' \u00b7 '+(idx+1)+' of '+RM_MONTHS.length+'</div>';
if(idx<RM_MONTHS.length-1)html+='<button class="rm-nav-btn" onclick="rmSwitchTab('+(idx+1)+')">'+RM_MONTHS[idx+1].name+' \u2192</button>';else html+='<div></div>';
html+='</div>';
panel.innerHTML=html}

function fmtM(n){return '\u00a3'+Math.abs(Number(n)).toLocaleString('en-GB',{minimumFractionDigits:0,maximumFractionDigits:0})}

function rmGetLiveFinance(){var totalDebt=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.balance||0)},0);var lisaAcc=(STATE.accounts||[]).find(function(a){return a.name&&a.name.toLowerCase().includes('lifetime')})||{};var depositGoal=(STATE.savingsGoals||[]).find(function(g){return g.name&&g.name.toLowerCase().includes('deposit')})||{};var thaiGoal=(STATE.savingsGoals||[]).find(function(g){return g.name&&g.name.toLowerCase().includes('thailand')})||{};var income=(STATE.income||[]).reduce(function(s,i){return s+Number(i.amount||0)},0);var expenses=(STATE.expenses||[]).reduce(function(s,e){return s+Number(e.amount||0)},0);var totalSavings=(STATE.accounts||[]).filter(function(a){return a.type==='savings'}).reduce(function(s,a){return s+Number(a.balance||0)},0);var totalInvestments=(STATE.accounts||[]).filter(function(a){return a.type==='investment'}).reduce(function(s,a){return s+Number(a.balance||0)},0);return {totalDebt:totalDebt,lisaBal:Number(lisaAcc.balance||250),depositSaved:Number(depositGoal.current||0),thaiSaved:Number(thaiGoal.current||0),surplus:income-expenses,totalSavings:totalSavings,totalInvestments:totalInvestments}}

function rmBuildLiveCard(){var f=rmGetLiveFinance();return '<div class="rm-live-card"><div class="rm-live-card-title"><div class="live-dot"></div> Live from Finance tab</div><div class="rm-live-grid"><div class="rm-live-item"><div class="rm-live-item-val" style="color:#e11d48">'+fmtM(f.totalDebt)+'</div><div class="rm-live-item-label">Total debt</div></div><div class="rm-live-item"><div class="rm-live-item-val" style="color:var(--mint)">'+fmtM(f.totalSavings)+'</div><div class="rm-live-item-label">Total savings</div></div><div class="rm-live-item"><div class="rm-live-item-val" style="color:var(--teal)">'+fmtM(f.totalInvestments)+'</div><div class="rm-live-item-label">Total investments</div></div></div><button class="rm-go-btn" onclick="nav(\'finance\')">&#8594; Update in Finance tab</button></div>'}

var rmCurrentMonth=0;

function rmSwitchTab(idx){RM_MONTHS.forEach(function(m,i){var btn=document.getElementById('rmtab-'+m.id);var panel=document.getElementById('rmpanel-'+m.id);if(btn)btn.classList.toggle('active',i===idx);if(panel)panel.classList.toggle('active',i===idx)});rmCurrentMonth=idx;var activeBtn=document.getElementById('rmtab-'+RM_MONTHS[idx].id);if(activeBtn)activeBtn.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}

function renderRoadmap(){var tabNav=document.getElementById('rm-tab-nav');var panelsEl=document.getElementById('rm-panels');if(!tabNav||!panelsEl)return;
var firstRender=tabNav.children.length===0;
if(!firstRender){refreshRoadmapLiveCards();rmBuildFocusCard();return}
rmCurrentMonth=rmGetCurrentMonthIdx();
RM_MONTHS.forEach(function(month,idx){var pr=rmGetProgress(month);
var btn=document.createElement('button');btn.className='rm-tab-btn'+(idx===rmCurrentMonth?' active':'');btn.id='rmtab-'+month.id;btn.onclick=function(){rmSwitchTab(idx)};
btn.innerHTML='<div class="rm-phase-dot" style="background:'+RM_PHASE_COLORS[month.phase]+'"></div><div class="rm-tab-num">'+month.year+'</div><div class="rm-tab-name">'+month.name+'</div><div class="rm-tab-pct" id="rmtabpct-'+month.id+'" style="color:'+rmPctColor(pr.pct)+'">'+pr.pct+'%</div>';
tabNav.appendChild(btn);
var panel=document.createElement('div');panel.className='rm-panel'+(idx===rmCurrentMonth?' active':'');panel.id='rmpanel-'+month.id;
panelsEl.appendChild(panel);
rmRebuildPanel(month.id)});
rmUpdateOverall();rmBuildFocusCard()}

function refreshRoadmapLiveCards(){RM_MONTHS.forEach(function(month){if(!month.showFinance)return;var panel=document.getElementById('rmpanel-'+month.id);if(!panel)return;var existing=panel.querySelector('.rm-live-card');if(existing){var newCard=document.createElement('div');newCard.innerHTML=rmBuildLiveCard();existing.replaceWith(newCard.firstChild)}})}

