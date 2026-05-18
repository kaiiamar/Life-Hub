// FINANCE
// ============================================================
var finCharts={};
function destroyFC(id){if(finCharts[id]){finCharts[id].destroy();delete finCharts[id]}}
function renderFinance(tab){if(tab==='plan'||!tab)renderFinancePlan();if(tab==='progress')renderFinanceProgress();
// Legacy tab names — still called from other places
if(tab==='overview')renderFinancePlan();if(tab==='budget')renderFinancePlan();if(tab==='accounts')renderFinanceProgress();if(tab==='debts')renderFinanceProgress();if(tab==='savings')renderFinanceProgress()}

// ── PLAN TAB ──
function renderFinancePlan(){
  renderBudget();           // populates income-list, expenses-list, totals
  renderFinanceMathHero();
  renderFinanceAllocations();
}

function renderFinanceMathHero(){
  var el=document.getElementById('fin-math-hero');
  if(!el)return;
  var totalInc=(STATE.income||[]).reduce(function(s,i){return s+Number(i.amount)},0);
  var totalExp=(STATE.expenses||[]).reduce(function(s,e){return s+Number(e.amount)},0);
  var afterFixed=totalInc-totalExp;

  // Debt allocations: sum monthly targets
  var debtAllocation=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.monthlyTarget||0)},0);

  // Savings allocations: sum monthly contributions
  var savingsAllocation=(STATE.savingsGoals||[]).reduce(function(s,sg){return s+Number(sg.monthlyContribution||0)},0);

  var unallocated=afterFixed-debtAllocation-savingsAllocation;
  var status;
  if(totalInc===0){status={color:'var(--text3)',label:'Add your income to get started',icon:'🧮'}}
  else if(unallocated<0){status={color:'var(--red)',label:'Over-allocated by '+fmtMoney(Math.abs(unallocated)),icon:'⚠️'}}
  else if(unallocated===0){status={color:'var(--accent-dark)',label:'Every pound has a job',icon:'✨'}}
  else{status={color:'var(--mint)',label:fmtMoney(unallocated)+' left to spend or save',icon:'✨'}}

  el.innerHTML=''
    +'<div class="card fin-math-card">'
      +'<div class="fin-math-head">'
        +'<div class="fin-math-status" style="background:'+status.color+'15;color:'+status.color+'">'
          +'<span class="fin-math-icon">'+status.icon+'</span>'
          +'<span class="fin-math-label">'+status.label+'</span>'
        +'</div>'
      +'</div>'
      +'<div class="fin-math-flow">'
        +_mathFlowStep('Income',totalInc,'var(--mint)',true)
        +'<span class="fin-math-op">−</span>'
        +_mathFlowStep('Fixed',totalExp,'var(--red)')
        +'<span class="fin-math-op">−</span>'
        +_mathFlowStep('Debt plan',debtAllocation,'#D97B6C')
        +'<span class="fin-math-op">−</span>'
        +_mathFlowStep('Savings plan',savingsAllocation,'#6B9E7A')
        +'<span class="fin-math-op">=</span>'
        +_mathFlowStep('Free to spend',Math.abs(unallocated),unallocated<0?'var(--red)':'var(--accent-dark)',true,unallocated<0?'over':'')
      +'</div>'
    +'</div>';
}

function _mathFlowStep(label,amount,color,bold,variant){
  var boldCls=bold?' fin-math-step-bold':'';
  var varCls=variant==='over'?' fin-math-step-over':'';
  return '<div class="fin-math-step'+boldCls+varCls+'"><div class="fin-math-step-label">'+label+'</div><div class="fin-math-step-val" style="color:'+color+'">'+(variant==='over'?'-':'')+fmtMoney(amount)+'</div></div>';
}

function renderFinanceAllocations(){
  var el=document.getElementById('fin-allocations');
  if(!el)return;
  var debts=(STATE.debts||[]).filter(function(d){return Number(d.balance)>0});
  var goals=(STATE.savingsGoals||[]).filter(function(g){return !g.done});

  if(!debts.length&&!goals.length){
    el.innerHTML='<div class="empty" style="padding:20px 0">Add debts or savings goals to allocate toward them each month.</div>';
    return;
  }

  var html='<div class="fin-alloc-grid">';

  // Debts column
  if(debts.length){
    html+='<div class="fin-alloc-col"><div class="fin-alloc-col-label">💳 Debt payoff <span class="fin-alloc-col-total">'+fmtMoney(debts.reduce(function(s,d){return s+Number(d.monthlyTarget||0)},0))+'/mo</span></div>';
    html+=debts.map(function(d){
      var target=Number(d.monthlyTarget||0);
      var monthsLeft=target>0?Math.ceil(Number(d.balance)/target):null;
      return '<div class="fin-alloc-item" style="border-left:3px solid '+(d.color||'#fb7185')+'">'
        +'<div class="fin-alloc-item-body"><div class="fin-alloc-item-name">'+escapeHtml(d.name)+'</div><div class="fin-alloc-item-sub">'+fmtMoney(d.balance)+' remaining'+(monthsLeft?' · ~'+monthsLeft+' mo left':'')+'</div></div>'
        +'<div class="fin-alloc-item-input"><span>£</span><input type="number" value="'+(target||'')+'" placeholder="0" onchange="setDebtMonthlyTarget(\''+d.id+'\',this.value)"><span class="fin-alloc-suffix">/mo</span></div>'
        +'</div>';
    }).join('');
    html+='</div>';
  }

  // Savings column
  if(goals.length){
    html+='<div class="fin-alloc-col"><div class="fin-alloc-col-label">🎯 Savings goals <span class="fin-alloc-col-total">'+fmtMoney(goals.reduce(function(s,g){return s+Number(g.monthlyContribution||0)},0))+'/mo</span></div>';
    html+=goals.map(function(sg){
      var contribution=Number(sg.monthlyContribution||0);
      var remaining=Math.max(0,Number(sg.target||0)-Number(sg.current||0));
      var monthsLeft=contribution>0?Math.ceil(remaining/contribution):null;
      var eta='';
      if(monthsLeft){
        var etaDate=new Date();etaDate.setMonth(etaDate.getMonth()+monthsLeft);
        eta=' · '+etaDate.toLocaleDateString('en-GB',{month:'short',year:'numeric'});
      }
      return '<div class="fin-alloc-item" style="border-left:3px solid '+(sg.color||'var(--accent)')+'">'
        +'<div class="fin-alloc-item-body"><div class="fin-alloc-item-name">'+escapeHtml(sg.name)+'</div><div class="fin-alloc-item-sub">'+fmtMoney(remaining)+' to go'+(monthsLeft?' · '+monthsLeft+' mo'+eta:'')+'</div></div>'
        +'<div class="fin-alloc-item-input"><span>£</span><input type="number" value="'+(contribution||'')+'" placeholder="0" onchange="setSavingsMonthlyContribution(\''+sg.id+'\',this.value)"><span class="fin-alloc-suffix">/mo</span></div>'
        +'</div>';
    }).join('');
    html+='</div>';
  }

  html+='</div>';
  el.innerHTML=html;
}

function setDebtMonthlyTarget(id,val){
  var d=(STATE.debts||[]).find(function(x){return x.id===id});
  if(!d)return;
  d.monthlyTarget=Number(val)||0;
  saveState();
  renderFinanceMathHero();
}
function setSavingsMonthlyContribution(id,val){
  var sg=(STATE.savingsGoals||[]).find(function(x){return x.id===id});
  if(!sg)return;
  sg.monthlyContribution=Number(val)||0;
  saveState();
  renderFinanceMathHero();
}

// ── PROGRESS TAB ──
var progressActiveTab='savings';
function switchProgressTab(tab,btn){
  progressActiveTab=tab;
  document.querySelectorAll('#finance-progress > .page-tabs .page-tab').forEach(function(b){b.classList.remove('active')});
  if(btn)btn.classList.add('active');
  document.querySelectorAll('#finance-progress .progress-tab').forEach(function(p){p.classList.remove('active')});
  var el=document.getElementById('progress-tab-'+tab);
  if(el)el.classList.add('active');
  // Lazy render per tab
  if(tab==='savings')renderSavingsGoals();
  if(tab==='accounts')renderAccounts();
  if(tab==='debts')renderDebts();
  renderProgressSummaries();
}

function renderProgressSummaries(){
  // Savings summary
  var goals=(STATE.savingsGoals||[]);
  var sEl=document.getElementById('progress-savings-summary');
  if(sEl){
    if(!goals.length)sEl.textContent='No goals yet';
    else{
      var totalTarget=goals.reduce(function(s,g){return s+Number(g.target||0)},0);
      var totalCurrent=goals.reduce(function(s,g){return s+Number(g.current||0)},0);
      var pct=totalTarget>0?Math.round(totalCurrent/totalTarget*100):0;
      sEl.innerHTML='<strong>'+goals.length+' goal'+(goals.length===1?'':'s')+'</strong> · '+pct+'% funded · '+fmtMoney(totalCurrent)+' of '+fmtMoney(totalTarget);
    }
  }
  // Accounts summary
  var accounts=(STATE.accounts||[]);
  var aEl=document.getElementById('progress-accounts-summary');
  if(aEl){
    if(!accounts.length)aEl.textContent='No accounts yet';
    else{
      var total=accounts.reduce(function(s,a){return s+Number(a.balance||0)},0);
      var savCount=accounts.filter(function(a){return a.type==='savings'}).length;
      var invCount=accounts.filter(function(a){return a.type==='investment'}).length;
      aEl.innerHTML='<strong>'+fmtMoney(total)+'</strong> across '+savCount+' savings · '+invCount+' investment'+(invCount===1?'':'s');
    }
  }
  // Debts summary
  var debts=(STATE.debts||[]).filter(function(d){return Number(d.balance)>0});
  var dEl=document.getElementById('progress-debts-summary');
  if(dEl){
    if(!debts.length)dEl.textContent='Debt-free 🎉';
    else{
      var total=debts.reduce(function(s,d){return s+Number(d.balance)},0);
      var totalTarget=debts.reduce(function(s,d){return s+Number(d.monthlyTarget||0)},0);
      var eta='';
      if(totalTarget>0){
        var months=Math.ceil(total/totalTarget);
        var freeDate=new Date();freeDate.setMonth(freeDate.getMonth()+months);
        eta=' · free by '+freeDate.toLocaleDateString('en-GB',{month:'short',year:'2-digit'});
      }
      dEl.innerHTML='<strong>'+fmtMoney(total)+'</strong> across '+debts.length+' debt'+(debts.length===1?'':'s')+eta;
    }
  }
}

function renderFinanceProgress(){
  renderNetWorthHero();
  renderNetWorthTrend();
  // Only render the currently active sub-tab
  if(progressActiveTab==='savings')renderSavingsGoals();
  else if(progressActiveTab==='accounts')renderAccounts();
  else if(progressActiveTab==='debts')renderDebts();
  renderProgressSummaries();
}

function computeNetWorth(){
  var accounts=(STATE.accounts||[]).reduce(function(s,a){return s+Number(a.balance||0)},0);
  var debts=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.balance||0)},0);
  return accounts-debts;
}

function renderNetWorthHero(){
  var el=document.getElementById('fin-networth-hero');
  if(!el)return;
  var accounts=(STATE.accounts||[]);
  var savingsTotal=accounts.filter(function(a){return a.type==='savings'}).reduce(function(s,a){return s+Number(a.balance||0)},0);
  var investTotal=accounts.filter(function(a){return a.type==='investment'}).reduce(function(s,a){return s+Number(a.balance||0)},0);
  var debtTotal=(STATE.debts||[]).reduce(function(s,d){return s+Number(d.balance||0)},0);
  var nw=savingsTotal+investTotal-debtTotal;

  // Snapshot history for trend
  var snaps=(STATE.netWorthSnapshots||[]);
  var lastSnap=snaps[snaps.length-1];
  var change='',changeClass='';
  if(lastSnap){
    var diff=nw-Number(lastSnap.value);
    if(diff!==0){
      change=(diff>0?'+':'-')+fmtMoney(Math.abs(diff))+' since '+fmtDate(lastSnap.date);
      changeClass=diff>0?'fin-nw-up':'fin-nw-down';
    }
  }

  el.innerHTML=''
    +'<div class="fin-nw-hero">'
      +'<div class="fin-nw-total"><span class="fin-nw-label">Total net worth</span><span class="fin-nw-val" style="color:'+(nw>=0?'var(--accent-dark)':'var(--red)')+'">'+fmtMoney(nw)+'</span>'+(change?'<span class="fin-nw-change '+changeClass+'">'+change+'</span>':'')+'</div>'
      +'<div class="fin-nw-split">'
        +'<div class="fin-nw-piece"><span class="fin-nw-piece-lbl">Savings</span><span class="fin-nw-piece-val" style="color:var(--mint)">'+fmtMoney(savingsTotal)+'</span></div>'
        +'<div class="fin-nw-piece"><span class="fin-nw-piece-lbl">Investments</span><span class="fin-nw-piece-val" style="color:var(--gold)">'+fmtMoney(investTotal)+'</span></div>'
        +'<div class="fin-nw-piece"><span class="fin-nw-piece-lbl">Debts</span><span class="fin-nw-piece-val" style="color:var(--red)">−'+fmtMoney(debtTotal)+'</span></div>'
      +'</div>'
      +'<button class="btn btn-sm" onclick="captureNetWorthSnapshot()" style="margin-top:10px">📸 Save snapshot</button>'
    +'</div>';
}

function captureNetWorthSnapshot(){
  if(!STATE.netWorthSnapshots)STATE.netWorthSnapshots=[];
  var today=localDateKey(new Date());
  var value=computeNetWorth();
  // Replace today's snapshot if one exists (one per day)
  STATE.netWorthSnapshots=STATE.netWorthSnapshots.filter(function(s){return s.date!==today});
  STATE.netWorthSnapshots.push({date:today,value:value});
  STATE.netWorthSnapshots.sort(function(a,b){return a.date.localeCompare(b.date)});
  saveState();
  renderNetWorthHero();
  renderNetWorthTrend();
  showCelebrationToast('Net worth snapshot saved','📸');
}

function renderNetWorthTrend(){
  destroyFC('nwTrend');
  var ctx=document.getElementById('networthTrendChart');
  if(!ctx)return;
  var snaps=(STATE.netWorthSnapshots||[]).slice();
  // Add a "now" point for live context (not persisted)
  var live={date:localDateKey(new Date()),value:computeNetWorth(),live:true};
  var last=snaps[snaps.length-1];
  if(!last||last.date!==live.date)snaps.push(live);

  if(snaps.length<2){
    ctx.parentElement.innerHTML='<div class="empty" style="padding:20px 0;font-size:12px;color:var(--text3)">Save at least 2 snapshots to see your trend. Tap 📸 each month.</div>';
    return;
  }

  var labels=snaps.map(function(s){var d=new Date(s.date+'T12:00:00');return d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'})});
  var data=snaps.map(function(s){return Number(s.value)});

  finCharts['nwTrend']=new Chart(ctx,{
    type:'line',
    data:{
      labels:labels,
      datasets:[{
        data:data,
        borderColor:'#D97B6C',
        backgroundColor:'rgba(217,123,108,0.12)',
        tension:0.35,fill:true,
        pointRadius:4,pointBackgroundColor:'#D97B6C',pointBorderColor:'#fff',pointBorderWidth:2
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return fmtMoney(c.parsed.y)}}}},
      scales:{
        y:{ticks:{callback:function(v){return '£'+(v/1000).toFixed(1)+'k'},color:'#8a6545',font:{size:10}},grid:{color:'rgba(0,0,0,0.05)'}},
        x:{ticks:{color:'#8a6545',font:{size:10}},grid:{display:false}}
      }
    }
  });
}

function renderFinanceOverview(){
  // Legacy shim — overview tab removed, redirect to plan
  renderFinancePlan();
}
function renderBudget(){var income=STATE.income||[];var totalInc=income.reduce(function(s,i){return s+Number(i.amount)},0);var iEl=document.getElementById('income-list');if(iEl)iEl.innerHTML=income.length?income.map(function(i){return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)"><span style="font-size:16px">'+(i.icon||'&#128176;')+'</span><span style="flex:1;font-size:13px;font-weight:500">'+i.name+'</span><span style="font-size:14px;font-weight:600;color:var(--mint)">'+fmtMoney(i.amount)+'</span><button class="btn btn-sm btn-ghost" onclick="openModal(\'editIncome\',\''+i.id+'\')">&#9998;</button><button class="btn btn-sm btn-danger" onclick="deleteIncome(\''+i.id+'\')">&#215;</button></div>'}).join(''):'<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">No income added yet</div>';var iTotalEl=document.getElementById('income-total');if(iTotalEl)iTotalEl.innerHTML='SUM <strong>'+fmtMoney(totalInc)+'</strong>/month';var expenses=STATE.expenses||[];var totalExp=expenses.reduce(function(s,e){return s+Number(e.amount)},0);var eEl=document.getElementById('expenses-list');if(eEl)eEl.innerHTML=expenses.length?expenses.map(function(e){return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)"><span style="font-size:16px">'+(e.icon||'&#128184;')+'</span><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">'+e.name+'</div>'+(e.note?'<div style="font-size:11px;color:var(--text3)">'+e.note+'</div>':'')+'</div><span style="font-size:14px;font-weight:600;color:var(--red)">'+fmtMoney(e.amount)+'</span><button class="btn btn-sm btn-ghost" onclick="openModal(\'editExpense\',\''+e.id+'\')">&#9998;</button><button class="btn btn-sm btn-danger" onclick="deleteExpense(\''+e.id+'\')">&#215;</button></div>'}).join(''):'<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">No expenses yet</div>';var eTotalEl=document.getElementById('expenses-total');if(eTotalEl)eTotalEl.innerHTML='SUM <strong>'+fmtMoney(totalExp)+'</strong>/month'}
function renderAccounts(){var accounts=STATE.accounts||[];var savings=accounts.filter(function(a){return a.type==='savings'});var investments=accounts.filter(function(a){return a.type==='investment'});var mkCard=function(a){return '<div class="card" style="margin-bottom:10px;border-left:4px solid '+(a.color||'#a0522d')+'"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:26px">'+(a.icon||'&#127968;')+'</span><div style="flex:1"><div style="font-size:14px;font-weight:600">'+a.name+'</div><div style="font-size:11px;color:var(--text3)">'+(a.institution||'')+(a.note?' &#183; '+a.note:'')+'</div></div><div style="text-align:right"><div style="font-size:20px;font-family:var(--serif);font-weight:600;color:var(--accent)">'+fmtMoney(a.balance)+'</div>'+(a.target?'<div style="font-size:11px;color:var(--text3)">'+Math.min(100,Math.round(a.balance/a.target*100))+'% of goal</div>':'')+'</div><div style="display:flex;flex-direction:column;gap:4px"><button class="btn btn-sm btn-ghost" onclick="openModal(\'editAccount\',\''+a.id+'\')">&#9998;</button><button class="btn btn-sm btn-danger" onclick="deleteAccount(\''+a.id+'\')">&#215;</button></div></div>'+(a.target?'<div class="pbar-wrap" style="margin-top:8px"><div class="pbar" style="width:'+Math.min(100,Math.round(a.balance/a.target*100))+'%;background:'+(a.color||'var(--accent)')+'"></div></div>':'')+'</div>'};var bEl=document.getElementById('bank-accounts-list');if(bEl)bEl.innerHTML=savings.length?savings.map(mkCard).join(''):'<div style="font-size:13px;color:var(--text3);padding:12px 0">No savings accounts yet</div>';var iEl=document.getElementById('investments-list');if(iEl)iEl.innerHTML=investments.length?investments.map(mkCard).join(''):'<div style="font-size:13px;color:var(--text3);padding:12px 0">No investments yet</div>'}
var fcDebtsExpanded={};
function toggleDebtExpand(id){fcDebtsExpanded[id]=!fcDebtsExpanded[id];renderDebts()}
function renderDebts(){
  var debts=STATE.debts||[];
  var payments=(STATE.debtPayments||[]).slice().sort(function(a,b){return b.date.localeCompare(a.date)});
  var thisMonth=new Date().toISOString().slice(0,7);

  // Kill the old 4-card summary — replaced by compact summary line in the tab header
  var ssEl=document.getElementById('debt-summary-stats');
  if(ssEl)ssEl.innerHTML='';

  var el=document.getElementById('debts-list');
  if(!el)return;
  if(!debts.length){el.innerHTML='<div class="empty"><div class="empty-icon">🎉</div>No debts! Crushing it!</div>';renderDebtPlan();return}

  var PT={High:'#e11d48',Medium:'#d97706',Low:'#16a34a'};

  el.innerHTML=debts.map(function(d){
    var dPayments=payments.filter(function(p){return p.debtId===d.id});
    var dPaid=dPayments.reduce(function(s,p){return s+Number(p.amount)},0);
    var orig=Number(d.startingBalance)||Number(d.balance)+dPaid;
    var pct=Number(d.balance)<=0?100:(orig>0?Math.round((orig-Number(d.balance))/orig*100):0);
    var target=Number(d.monthlyTarget||0);
    var dPaidMonth=dPayments.filter(function(p){return p.date.startsWith(thisMonth)}).reduce(function(s,p){return s+Number(p.amount)},0);
    var mLeft=target>0?Math.ceil(Number(d.balance)/target):0;
    var expanded=!!fcDebtsExpanded[d.id];
    var priCol=PT[d.priority]||'#666';

    var h='<div class="debt-row'+(expanded?' expanded':'')+'" style="border-left:3px solid '+(d.color||'#fb7185')+'">';
    // Compact header (always visible)
    h+='<div class="debt-row-head" onclick="toggleDebtExpand(\''+d.id+'\')">';
    h+='<div class="debt-row-main">';
    h+='<div class="debt-row-name">'+escapeHtml(d.name)+'<span class="debt-row-priority" style="color:'+priCol+'">·'+d.priority+'</span></div>';
    h+='<div class="debt-row-progress"><div class="debt-row-progress-fill" style="width:'+pct+'%"></div></div>';
    h+='<div class="debt-row-meta">'+pct+'% cleared'+(target>0?' · '+fmtMoney(target)+'/mo · ~'+mLeft+' mo left':' · no monthly target')+'</div>';
    h+='</div>';
    h+='<div class="debt-row-bal"><div class="debt-row-bal-val">'+fmtMoney(d.balance)+'</div><div class="debt-row-chev">'+(expanded?'▴':'▾')+'</div></div>';
    h+='</div>';

    // Expanded body
    if(expanded){
      h+='<div class="debt-row-body">';
      // Edit / delete
      h+='<div class="debt-row-actions">';
      h+='<div class="debt-row-target"><label>Monthly target</label><div class="debt-target-input"><span>£</span><input type="number" value="'+(target||'')+'" placeholder="0" onchange="setDebtMonthlyTarget(\''+d.id+'\',this.value)"><span class="fin-alloc-suffix">/mo</span></div></div>';
      if(target>0){
        var monthPct=Math.min(100,Math.round(dPaidMonth/target*100));
        h+='<div class="debt-row-monthprog"><div class="debt-row-monthprog-head"><span>This month</span><span>'+fmtMoney(dPaidMonth)+' / '+fmtMoney(target)+'</span></div><div class="debt-row-monthprog-bar"><div class="debt-row-monthprog-fill" style="width:'+monthPct+'%;background:'+(monthPct>=100?'var(--mint)':'var(--gold)')+'"></div></div></div>';
      }
      h+='<div class="debt-row-btns"><button class="btn btn-sm btn-ghost" onclick="openModal(\'editDebt\',\''+d.id+'\')">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteDebt(\''+d.id+'\')">Delete</button></div>';
      h+='</div>';
      if(d.note)h+='<div class="debt-row-note">'+escapeHtml(d.note)+'</div>';
      if(dPayments.length){
        h+='<div class="debt-row-payments"><div class="debt-row-payments-label">Recent payments</div>';
        h+=dPayments.slice(0,3).map(function(p){return '<div class="debt-row-payment"><span class="debt-row-payment-date">'+fmtDate(p.date)+'</span><span class="debt-row-payment-note">'+escapeHtml(p.note||'')+'</span><span class="debt-row-payment-amt">−'+fmtMoney(p.amount)+'</span><button class="debt-row-payment-del" onclick="deleteDebtPayment(\''+p.id+'\')">×</button></div>'}).join('');
        if(dPayments.length>3)h+='<div class="debt-row-payments-more">+ '+(dPayments.length-3)+' more</div>';
        h+='</div>';
      }
      h+='</div>';
    }

    h+='</div>';
    return h;
  }).join('');
  renderDebtPlan();
}
function renderDebtPlan(){
  var el=document.getElementById('debt-plan-panel');if(!el)return;
  var debts=(STATE.debts||[]).filter(function(d){return Number(d.balance)>0});
  if(!debts.length){el.innerHTML='';return}
  var thisMonth=new Date().toISOString().slice(0,7);
  var planned=(STATE.plannedPayments||[]).filter(function(p){return p.month===thisMonth});
  var plannedTotal=planned.reduce(function(s,p){return s+Number(p.amount)},0);
  var paidTotal=planned.filter(function(p){return p.paid}).reduce(function(s,p){return s+Number(p.amount)},0);
  var h='<div class="card">';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">';
  h+='<div><div style="font-size:15px;font-weight:600">📋 '+new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'})+'</div>';
  h+='<div style="font-size:11px;color:var(--text2)">Payment plan</div></div>';
  h+='<button class="btn btn-sm btn-accent" onclick="openModal(\'addPlannedPayment\')">+ Add</button></div>';
  if(planned.length){
    h+='<div style="display:flex;gap:12px;margin-bottom:12px">';
    h+='<div style="flex:1;text-align:center"><div style="font-family:var(--serif);font-size:20px;font-weight:600;color:var(--accent)">'+fmtMoney(plannedTotal)+'</div><div style="font-size:10px;color:var(--text3)">planned</div></div>';
    h+='<div style="flex:1;text-align:center"><div style="font-family:var(--serif);font-size:20px;font-weight:600;color:var(--mint)">'+fmtMoney(paidTotal)+'</div><div style="font-size:10px;color:var(--text3)">paid</div></div>';
    h+='<div style="flex:1;text-align:center"><div style="font-family:var(--serif);font-size:20px;font-weight:600;color:'+(plannedTotal-paidTotal>0?'var(--red)':'var(--mint)')+'">'+fmtMoney(Math.max(0,plannedTotal-paidTotal))+'</div><div style="font-size:10px;color:var(--text3)">left</div></div></div>';
    var pct=Math.round(paidTotal/plannedTotal*100);
    h+='<div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;margin-bottom:14px"><div style="height:100%;width:'+pct+'%;background:'+(pct>=100?'var(--mint)':'var(--accent)')+';border-radius:3px;transition:width .4s"></div></div>';
    planned.sort(function(a,b){return (a.paid?1:0)-(b.paid?1:0)||(a.date||'').localeCompare(b.date||'')});
    planned.forEach(function(pp){
      var debt=debts.find(function(d){return d.id===pp.debtId})||{name:'?',color:'#999'};
      h+='<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--border)'+(pp.paid?';opacity:0.5':'')+'">';
      h+='<div onclick="togglePlannedPayment(\''+pp.id+'\')" style="width:20px;height:20px;border-radius:5px;border:2px solid '+(pp.paid?'var(--mint)':'var(--border2)')+';background:'+(pp.paid?'var(--mint)':'var(--bg2)')+';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+(pp.paid?'<span style="color:#fff;font-size:11px;font-weight:700">✓</span>':'')+'</div>';
      h+='<div style="width:6px;height:20px;border-radius:3px;background:'+(debt.color||'#fb7185')+';flex-shrink:0"></div>';
      h+='<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500'+(pp.paid?';text-decoration:line-through;color:var(--text3)':'')+'">'+fmtMoney(pp.amount)+' → '+debt.name+'</div>';
      if(pp.date||pp.note)h+='<div style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(pp.date?fmtDate(pp.date):'')+(pp.date&&pp.note?' · ':'')+(pp.note||'')+'</div>';
      h+='</div>';
      h+='<button style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:0 4px" onclick="deletePlannedPayment(\''+pp.id+'\')">×</button>';
      h+='</div>';
    });
  } else {
    h+='<div style="text-align:center;padding:24px 0;color:var(--text3)"><div style="font-size:28px;margin-bottom:8px">📝</div><div style="font-size:13px">Plan your payments for this month</div></div>';
  }
  h+='</div>';
  el.innerHTML=h;
}
function renderDebtPayoffPlanner(){renderDebtPlan()}
function renderDebtPaymentHistory(){}
function togglePlannedPayment(id){var pp=(STATE.plannedPayments||[]).find(function(p){return p.id===id});if(!pp)return;pp.paid=!pp.paid;if(pp.paid&&!pp.wasPaid){pp.wasPaid=true;var debt=(STATE.debts||[]).find(function(d){return d.id===pp.debtId});if(debt){debt.balance=Math.max(0,Number(debt.balance)-Number(pp.amount));if(!STATE.debtPayments)STATE.debtPayments=[];STATE.debtPayments.push({id:g(),debtId:pp.debtId,amount:Number(pp.amount),date:localDateKey(new Date()),note:'Planned: '+(pp.note||'')})}}else if(!pp.paid&&pp.wasPaid){pp.wasPaid=false;var debt2=(STATE.debts||[]).find(function(d){return d.id===pp.debtId});if(debt2)debt2.balance=Number(debt2.balance)+Number(pp.amount);STATE.debtPayments=(STATE.debtPayments||[]).filter(function(p){return !(p.debtId===pp.debtId&&p.note&&p.note.startsWith('Planned:')&&Number(p.amount)===Number(pp.amount))})}saveState();renderDebts();refreshRoadmapLiveCards()}
function deletePlannedPayment(id){confirmDelete('Remove this planned payment?',function(){STATE.plannedPayments=(STATE.plannedPayments||[]).filter(function(p){return p.id!==id});saveState();renderDebts()})}
function savePlannedPayment(){var debtId=(document.getElementById('m-ppdebt')||{}).value;var amount=Number((document.getElementById('m-ppamount')||{}).value)||0;if(!debtId||!amount)return;var date=(document.getElementById('m-ppdate')||{}).value||'';var note=(document.getElementById('m-ppnote')||{}).value||'';var month=new Date().toISOString().slice(0,7);if(date)month=date.slice(0,7);if(!STATE.plannedPayments)STATE.plannedPayments=[];STATE.plannedPayments.push({id:g(),debtId:debtId,amount:amount,date:date,note:note,month:month,paid:false});saveState();closeModal();renderDebts()}
function renderSavingsGoals(){var goals=STATE.savingsGoals||[];var PC={High:'#fde8ea',Medium:'#fef3c7',Low:'#f0fdf4'};var PT={High:'#e11d48',Medium:'#d97706',Low:'#16a34a'};var el=document.getElementById('savings-goals-list');if(!el)return;if(!goals.length){el.innerHTML='<div class="empty"><div class="empty-icon">&#127800;</div>No savings goals yet. Add one!</div>';return}
el.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px">'+goals.map(function(sg){
  var p=sg.target>0?Math.min(100,Math.round(Number(sg.current||0)/Number(sg.target)*100)):0;
  var col=sg.color||'var(--accent)';
  var remaining=Math.max(0,sg.target-(sg.current||0));
  var contribution=Number(sg.monthlyContribution||0);
  var paceInfo='';
  if(contribution>0&&remaining>0){
    var monthsLeft=Math.ceil(remaining/contribution);
    var eta=new Date();eta.setMonth(eta.getMonth()+monthsLeft);
    var etaStr=eta.toLocaleDateString('en-GB',{month:'short',year:'numeric'});
    paceInfo='<div class="fin-sg-pace">At '+fmtMoney(contribution)+'/mo &#8594; '+etaStr;
    if(sg.deadline){
      var deadlineDate=new Date(sg.deadline+'T12:00:00');
      var aheadBehind=(eta-deadlineDate)/(30*86400000);
      if(aheadBehind<-1)paceInfo+=' <span class="fin-sg-ahead">('+Math.abs(Math.round(aheadBehind))+' mo ahead)</span>';
      else if(aheadBehind>1)paceInfo+=' <span class="fin-sg-behind">('+Math.round(aheadBehind)+' mo behind)</span>';
    }
    paceInfo+='</div>';
  }else if(sg.deadline&&remaining>0){
    var monthsToDeadline=Math.max(1,Math.ceil((new Date(sg.deadline+'T12:00:00')-new Date())/(30*86400000)));
    var needed=Math.ceil(remaining/monthsToDeadline);
    paceInfo='<div class="fin-sg-pace fin-sg-nopace">Set a monthly contribution ('+fmtMoney(needed)+'/mo to hit deadline)</div>';
  }
  return '<div class="card" style="text-align:center;padding:24px 20px"><div style="display:flex;justify-content:flex-end;gap:4px;margin-bottom:8px"><button class="btn btn-sm btn-ghost" onclick="openModal(\'editSavingsGoal\',\''+sg.id+'\')">&#9998;</button><button class="btn btn-sm btn-danger" onclick="deleteSavingsGoal(\''+sg.id+'\')">&#215;</button></div><div class="thermo"><div class="thermo-tube"><div class="thermo-fill" style="height:'+p+'%;background:linear-gradient(to top,'+col+','+col+'cc)"></div></div><div class="thermo-bulb" style="background:'+col+';border-color:'+col+'"><span style="color:#fff">'+(sg.icon||'&#127919;')+'</span></div><div class="thermo-marks"><span class="thermo-mark">'+fmtMoney(sg.target)+'</span><span class="thermo-mark">'+fmtMoney(Math.round(sg.target*0.75))+'</span><span class="thermo-mark">'+fmtMoney(Math.round(sg.target*0.5))+'</span><span class="thermo-mark">'+fmtMoney(Math.round(sg.target*0.25))+'</span><span class="thermo-mark">&#163;0</span></div></div><div class="thermo-pct" style="color:'+col+'">'+p+'%</div><div style="font-family:var(--serif);font-size:16px;font-weight:600;margin-top:8px">'+sg.name+'</div><div style="font-size:13px;color:var(--accent);font-weight:600;margin-top:4px">'+fmtMoney(sg.current||0)+' <span style="font-weight:400;color:var(--text3)">of '+fmtMoney(sg.target)+'</span></div>'+(sg.note?'<div style="font-size:11px;color:var(--text2);margin-top:4px">'+sg.note+'</div>':'')+(sg.deadline?'<div style="font-size:11px;color:var(--text3);margin-top:3px">&#128467; By '+fmtDate(sg.deadline)+'</div>':'')+paceInfo+'<div style="margin-top:6px"><span style="padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;background:'+(PC[sg.priority]||'#f0f0f0')+';color:'+(PT[sg.priority]||'#666')+'">'+sg.priority+'</span></div><div style="font-size:11px;color:var(--text3);margin-top:6px">'+fmtMoney(remaining)+' to go</div></div>';
}).join('')+'</div>'}
function deleteAccount(id){confirmDelete('Delete this account?',function(){STATE.accounts=(STATE.accounts||[]).filter(function(a){return a.id!==id});saveState();renderAccounts()})}
function deleteDebt(id){confirmDelete('Delete this debt?',function(){STATE.debts=(STATE.debts||[]).filter(function(d){return d.id!==id});saveState();renderDebts();refreshRoadmapLiveCards()})}
function deleteSavingsGoal(id){confirmDelete('Delete this savings goal?',function(){STATE.savingsGoals=(STATE.savingsGoals||[]).filter(function(g){return g.id!==id});saveState();renderSavingsGoals()})}
function deleteIncome(id){confirmDelete('Delete this income source?',function(){STATE.income=(STATE.income||[]).filter(function(i){return i.id!==id});saveState();renderBudget()})}
function deleteExpense(id){confirmDelete('Delete this expense?',function(){STATE.expenses=(STATE.expenses||[]).filter(function(e){return e.id!==id});saveState();renderBudget()})}
function saveIncome(){var name=((document.getElementById('m-iname')||{}).value||'').trim();if(!name)return;if(!STATE.income)STATE.income=[];STATE.income.push({id:g(),name:name,amount:Number((document.getElementById('m-iamount')||{}).value)||0,icon:(document.getElementById('m-iicon')||{}).value||'&#128188;',note:(document.getElementById('m-inote')||{}).value||''});saveState();closeModal();renderBudget();refreshRoadmapLiveCards()}
function updateIncome(id){var i=(STATE.income||[]).find(function(x){return x.id===id});if(!i)return;i.name=(document.getElementById('m-iname')||{}).value||i.name;i.amount=Number((document.getElementById('m-iamount')||{}).value)||i.amount;i.icon=(document.getElementById('m-iicon')||{}).value||i.icon;i.note=(document.getElementById('m-inote')||{}).value||'';saveState();closeModal();renderBudget();refreshRoadmapLiveCards()}
function saveAccount(){var name=((document.getElementById('m-aname')||{}).value||'').trim();if(!name)return;var type=(document.getElementById('m-atype')||{}).value||'savings';if(!STATE.accounts)STATE.accounts=[];var acc={id:g(),name:name,type:type,balance:Number((document.getElementById('m-abalance')||{}).value)||0,color:type==='savings'?'#a0522d':'#c9973a',icon:(document.getElementById('m-aicon')||{}).value||(type==='savings'?'&#128176;':'&#128200;'),institution:(document.getElementById('m-ainst')||{}).value||''};var rate=(document.getElementById('m-arate')||{}).value;if(rate)acc.rate=Number(rate);var target=(document.getElementById('m-atarget')||{}).value;if(target)acc.target=Number(target);STATE.accounts.push(acc);saveState();closeModal();renderAccounts();refreshRoadmapLiveCards()}
function updateAccount(id){var a=(STATE.accounts||[]).find(function(x){return x.id===id});if(!a)return;a.name=(document.getElementById('m-aname')||{}).value||a.name;a.balance=Number((document.getElementById('m-abalance')||{}).value)||a.balance;a.icon=(document.getElementById('m-aicon')||{}).value||a.icon;a.institution=(document.getElementById('m-ainst')||{}).value||a.institution||'';var rate=document.getElementById('m-arate');if(rate&&rate.value)a.rate=Number(rate.value);var target=document.getElementById('m-atarget');if(target&&target.value)a.target=Number(target.value);saveState();closeModal();renderAccounts();refreshRoadmapLiveCards()}
function saveExpense(){var name=((document.getElementById('m-ename')||{}).value||'').trim();if(!name)return;var palette=['#f9a8d4','#c084fc','#fb923c','#818cf8','#34d399','#f59e0b','#a0522d','#2dd4bf','#fb7185'];STATE.expenses=STATE.expenses||[];STATE.expenses.push({id:g(),name:name,amount:Number((document.getElementById('m-eamount')||{}).value)||0,icon:(document.getElementById('m-eicon')||{}).value||'&#128184;',note:(document.getElementById('m-enote')||{}).value||'',color:palette[STATE.expenses.length%palette.length]});saveState();closeModal();renderBudget()}
function updateExpense(id){var e=(STATE.expenses||[]).find(function(x){return x.id===id});if(!e)return;e.name=(document.getElementById('m-ename')||{}).value||e.name;e.amount=Number((document.getElementById('m-eamount')||{}).value)||0;e.icon=(document.getElementById('m-eicon')||{}).value||e.icon;e.note=(document.getElementById('m-enote')||{}).value||'';saveState();closeModal();renderBudget()}
function saveDebt(){var name=((document.getElementById('m-dname')||{}).value||'').trim();if(!name)return;var priority=(document.getElementById('m-dpriority')||{}).value||'Medium';var pColors={High:'#f43f5e',Medium:'#fb7185',Low:'#fda4af'};var bal=Number((document.getElementById('m-dbalance')||{}).value)||0;if(!STATE.debts)STATE.debts=[];STATE.debts.push({id:g(),name:name,balance:bal,startingBalance:bal,priority:priority,color:pColors[priority],due:(document.getElementById('m-ddue')||{}).value||'',note:(document.getElementById('m-dnote')||{}).value||''});saveState();closeModal();renderDebts();refreshRoadmapLiveCards()}
function updateDebt(id){var d=(STATE.debts||[]).find(function(x){return x.id===id});if(!d)return;d.name=(document.getElementById('m-dname')||{}).value||d.name;d.balance=Number((document.getElementById('m-dbalance')||{}).value)||0;d.priority=(document.getElementById('m-dpriority')||{}).value||d.priority;d.note=(document.getElementById('m-dnote')||{}).value||'';d.due=(document.getElementById('m-ddue')||{}).value||'';var pColors={High:'#f43f5e',Medium:'#fb7185',Low:'#fda4af'};d.color=pColors[d.priority]||d.color;saveState();closeModal();renderDebts();refreshRoadmapLiveCards()}
function saveSavingsGoal(){var name=((document.getElementById('m-sgname')||{}).value||'').trim();if(!name)return;var colors=['#a0522d','#c9973a','#34d399','#f59e0b','#818cf8','#fb923c'];if(!STATE.savingsGoals)STATE.savingsGoals=[];STATE.savingsGoals.push({id:g(),name:name,target:Number((document.getElementById('m-sgtarget')||{}).value)||0,current:Number((document.getElementById('m-sgcurrent')||{}).value)||0,monthlyContribution:Number((document.getElementById('m-sgmonthly')||{}).value)||0,priority:(document.getElementById('m-sgpriority')||{}).value||'Medium',icon:(document.getElementById('m-sgicon')||{}).value||'&#127919;',deadline:(document.getElementById('m-sgdeadline')||{}).value||'',note:(document.getElementById('m-sgnote')||{}).value||'',color:colors[STATE.savingsGoals.length%colors.length]});saveState();closeModal();renderSavingsGoals();renderFinanceMathHero&&renderFinanceMathHero();renderFinanceAllocations&&renderFinanceAllocations();refreshRoadmapLiveCards()}
function updateSavingsGoal(id){var sg=(STATE.savingsGoals||[]).find(function(x){return x.id===id});if(!sg)return;sg.name=(document.getElementById('m-sgname')||{}).value||sg.name;sg.target=Number((document.getElementById('m-sgtarget')||{}).value)||sg.target;sg.current=Number((document.getElementById('m-sgcurrent')||{}).value)||0;sg.monthlyContribution=Number((document.getElementById('m-sgmonthly')||{}).value)||0;sg.priority=(document.getElementById('m-sgpriority')||{}).value||sg.priority;sg.icon=(document.getElementById('m-sgicon')||{}).value||sg.icon;sg.deadline=(document.getElementById('m-sgdeadline')||{}).value||'';sg.note=(document.getElementById('m-sgnote')||{}).value||'';saveState();closeModal();renderSavingsGoals();renderFinanceMathHero&&renderFinanceMathHero();renderFinanceAllocations&&renderFinanceAllocations();refreshRoadmapLiveCards()}

