const KEY="tripsplit-v3";
const COLORS=["#59d38c","#62a8ff","#b58cff","#ffb45e","#ff6e8a","#53d4d4"];
const state=JSON.parse(localStorage.getItem(KEY)||'{"profile":null,"trips":[],"month":null}');
state.quickSplits=state.quickSplits||[];
let cursor=state.month?new Date(state.month+"-01T12:00:00"):new Date();
let selectedTripId=null, selectedDay=null, dragStart=null, dragEnd=null, dragging=false;

const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");
const keyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const pretty=d=>d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
const save=()=>{state.month=`${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}`;localStorage.setItem(KEY,JSON.stringify(state));window.syncTripSplitState?.();};
const id=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random();
const dateOnly=s=>new Date(s+"T12:00:00");
const daysBetween=(a,b)=>Math.round((dateOnly(b)-dateOnly(a))/86400000)+1;
const inRange=(d,a,b)=>d>=dateOnly(a)&&d<=dateOnly(b);
const fmtMoney=n=>new Intl.NumberFormat(undefined,{style:"currency",currency:"INR",maximumFractionDigits:2}).format(n);

function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2200)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function tripAt(k){return state.trips.filter(t=>inRange(dateOnly(k),t.start,t.end))}
function currentTrip(){return state.trips.find(t=>t.id===selectedTripId)}

function renderCalendar(){
  const cal=$("calendar"); cal.querySelectorAll(".day").forEach(x=>x.remove());
  const y=cursor.getFullYear(),m=cursor.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0);
  $("monthTitle").textContent=cursor.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const leading=first.getDay(), total=last.getDate(), cells=Math.ceil((leading+total)/7)*7;
  for(let i=0;i<cells;i++){
    const d=new Date(y,m,i-leading+1), k=keyOf(d), cell=document.createElement("div");
    cell.className="day"+(d.getMonth()!==m?" outside":"")+(keyOf(new Date())===k?" today":"");
    cell.dataset.date=k;
    cell.innerHTML=`<div class="day-num">${d.getDate()}</div>`;
    const trips=tripAt(k);
    trips.forEach(t=>{const mark=document.createElement("span");mark.className="trip-mark";mark.style.background=t.color;mark.textContent=t.name;mark.dataset.trip=t.id;cell.appendChild(mark)});
    const count=trips.reduce((n,t)=>n+(t.expenses[k]?.length||0),0);
    if(count)cell.innerHTML+=`<span class="exp-count">${count} expense${count===1?"":"s"}</span>`;
    if(d.getMonth()===m) cell.addEventListener("pointerdown",e=>startDrag(e,k));
    cell.addEventListener("pointerenter",()=>moveDrag(k));
    cell.addEventListener("pointerup",()=>endDrag(k));
    cell.addEventListener("click",e=>{
      const mark=e.target.closest(".trip-mark");
      if(mark){openTrip(mark.dataset.trip,k);return}
      if(!dragging && trips.length)openTrip(trips[0].id,k);
    });
    cal.appendChild(cell);
  }
  if(dragStart&&dragEnd)paintPreview();
}
function paintPreview(){
  const a=dateOnly(dragStart),b=dateOnly(dragEnd); const lo=a<=b?a:b,hi=a<=b?b:a;
  document.querySelectorAll(".day[data-date]").forEach(c=>{const d=dateOnly(c.dataset.date);if(d>=lo&&d<=hi)c.classList.add("selected-range")});
}
function startDrag(e,k){e.preventDefault();dragging=true;dragStart=k;dragEnd=k;paintPreview()}
function moveDrag(k){if(dragging){dragEnd=k;document.querySelectorAll(".day").forEach(c=>c.classList.remove("selected-range"));paintPreview()}}
function endDrag(k){
  if(!dragging)return; dragEnd=k; dragging=false;
  const a=dateOnly(dragStart),b=dateOnly(dragEnd),start=a<=b?dragStart:dragEnd,end=a<=b?dragEnd:dragStart;
  dragStart=dragEnd=null; document.querySelectorAll(".day").forEach(c=>c.classList.remove("selected-range"));
  openNewTrip(start,end);
}
window.addEventListener("pointerup",()=>{if(dragging){dragging=false;dragStart=dragEnd=null;renderCalendar()}});

function renderTrips(){
  const list=$("tripList"),empty=$("emptyTrips");list.innerHTML="";
  empty.classList.toggle("hidden",state.trips.length>0);
  state.trips.forEach(t=>{
    const el=document.createElement("div");el.className="trip-item";
    const expCount=Object.values(t.expenses||{}).reduce((n,a)=>n+a.length,0);
    el.innerHTML=`<div class="trip-top"><span class="trip-dot" style="background:${t.color}"></span><span class="trip-name">${esc(t.name)}</span></div><div class="trip-meta">${pretty(dateOnly(t.start))} → ${pretty(dateOnly(t.end))} · ${t.members.length} members · ${expCount} expenses</div>`;
    el.onclick=()=>openTrip(t.id,t.start);list.appendChild(el);
  });
}

function renderSelected(){
  const t=currentTrip();$("tripPanel").classList.toggle("hidden",!t);if(!t)return;
  $("tripTitle").textContent=t.name;$("tripDates").textContent=`${pretty(dateOnly(t.start))} → ${pretty(dateOnly(t.end))}`;
  const admin=t.members.find(m=>m.id===t.adminId);$("adminBadge").textContent=`ADMIN: ${admin?admin.name:"Unknown"}`;
  const isAdmin=isCurrentAdmin(t);$("deleteTripBtn").classList.toggle("hidden",!isAdmin);$("manageTripBtn").textContent=isAdmin?"Trip settings":"View members";
  const days=$("tripDays");days.innerHTML="";
  for(let i=0;i<daysBetween(t.start,t.end);i++){const d=new Date(dateOnly(t.start));d.setDate(d.getDate()+i);const k=keyOf(d),n=(t.expenses[k]||[]).length;
    const el=document.createElement("div");el.className="day-chip"+(k===selectedDay?" active":"");el.innerHTML=`<b>${d.toLocaleDateString(undefined,{weekday:"short"})}, ${d.getDate()}</b><small>${n} expense${n===1?"":"s"}</small>`;el.onclick=()=>{selectedDay=k;renderSelected()};days.appendChild(el)}
  renderDay(t);renderTotals(t);
}
function isCurrentAdmin(t){return !state.profile?.email||state.profile.email===t.adminEmail}
function renderDay(t){
  selectedDay=selectedDay&&inRange(dateOnly(selectedDay),t.start,t.end)?selectedDay:t.start;
  $("dayTitle").textContent=dateOnly(selectedDay).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
  $("daySub").textContent=`${t.name}`;
  const list=$("expenseList"),empty=$("expenseEmpty"),arr=t.expenses[selectedDay]||[];list.innerHTML="";empty.classList.toggle("hidden",arr.length>0);
  arr.forEach(ex=>{
    const el=document.createElement("div");el.className="expense-card";
    const rows=ex.shares.map(s=>{const m=t.members.find(x=>x.id===s.memberId);return `<div class="split-line"><span>${esc(m?.name||"Removed member")}</span><span>${s.pct}% · ${fmtMoney(ex.bill*s.pct/100)}</span></div>`}).join("");
    el.innerHTML=`<div class="expense-head"><div><div class="expense-name">${esc(ex.name)}</div><div class="muted">${esc(ex.payerName)} paid</div></div><div><span class="amount">${fmtMoney(ex.bill)}</span>${isCurrentAdmin(t)?`<button class="mini-danger" data-del-exp="${ex.id}">Delete</button>`:""}</div></div>${rows}`;
    el.querySelector("[data-del-exp]")?.addEventListener("click",()=>secureDeleteExpense(t,selectedDay,ex));
    list.appendChild(el);
  });
}
function renderTotals(t){
  const totals={};t.members.forEach(m=>totals[m.id]=0);
  Object.values(t.expenses||{}).flat().forEach(ex=>ex.shares.forEach(s=>totals[s.memberId]=(totals[s.memberId]||0)+ex.bill*s.pct/100));
  $("pendingTotals").innerHTML=t.members.map(m=>`<div class="total-row"><span>${esc(m.name)}</span><strong>${fmtMoney(totals[m.id]||0)}</strong></div>`).join("");
}

function openTrip(tid,day){selectedTripId=tid;selectedDay=day;renderSelected();$("tripPanel").scrollIntoView({behavior:"smooth",block:"start"})}
function modal(title,body,actions=""){
  $("modalRoot").innerHTML=`<div class="modal-backdrop" id="backdrop"><div class="modal"><h2>${title}</h2>${body}${actions}</div></div>`;
  $("backdrop").addEventListener("click",e=>{if(e.target.id==="backdrop")closeModal()});
}
function closeModal(){$("modalRoot").innerHTML=""}

function openNewTrip(start,end){
  const creator=state.profile?.name||"You";
  modal("Create trip",`<div class="form-grid">
    <div class="field"><label>Trip name</label><input id="mTripName" placeholder="e.g. Goa Trip"></div>
    <div class="field"><label>Start</label><input id="mStart" type="date" value="${start}"></div>
    <div class="field"><label>End</label><input id="mEnd" type="date" value="${end}"></div>
    <div class="field"><label>Your name</label><input id="mCreator" value="${esc(creator)}" placeholder="Your name"></div>
    <div class="notice">The person creating the trip becomes the trip admin. Admin approval is required before a trip or expense can be deleted.</div>
  </div>`,`<div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Cancel</button><button class="primary-btn" id="createTripConfirm">Create trip</button></div>`);
  $("createTripConfirm").onclick=()=>{
    const name=$("mTripName").value.trim(),s=$("mStart").value,e=$("mEnd").value,creatorName=$("mCreator").value.trim()||"You";
    if(!name||!s||!e||s>e)return toast("Enter a valid trip and date range");
    const member={id:id(),name:creatorName};const t={id:id(),name,start:s,end:e,color:COLORS[state.trips.length%COLORS.length],adminId:member.id,adminEmail:state.profile?.email||null,members:[member],expenses:{}};
    state.trips.push(t);save();closeModal();openTrip(t.id,s);renderAll();toast("Trip created");
  };
}

function openSettings(){
  const t=currentTrip();if(!t)return;
  const admin=isCurrentAdmin(t);
  modal("Trip settings",`<div class="form-grid">
    <div class="field"><label>Trip name</label><input id="sName" value="${esc(t.name)}" ${admin?"":"disabled"}></div>
    <div class="field"><label>Members</label><div class="members">${t.members.map((m,i)=>`<div class="member-row"><input value="${esc(m.name)}" data-member="${m.id}" ${admin?"":"disabled"}><span class="check"><input type="radio" name="admin" value="${m.id}" ${m.id===t.adminId?"checked":""} ${admin?"":"disabled"}> admin</span></div>`).join("")}</div></div>
    ${admin?`<button class="secondary-btn" id="addMember">＋ Add member</button>`:""}
    <div class="notice">${admin?"You are the trip admin. Only you can delete expenses or the trip.":"Only the trip admin can add/remove members or delete expenses/trip."}</div>
  </div>`,`<div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Close</button>${admin?'<button class="primary-btn" id="saveSettings">Save</button>':""}</div>`);
  $("addMember")?.addEventListener("click",()=>{const name=prompt("Member name");if(name?.trim()){t.members.push({id:id(),name:name.trim()});openSettings()}});
  $("saveSettings")?.addEventListener("click",()=>{
    t.name=$("sName").value.trim()||t.name;
    t.members.forEach(m=>{const inp=document.querySelector(`[data-member="${m.id}"]`);if(inp)m.name=inp.value.trim()||m.name});
    t.adminId=document.querySelector('input[name="admin"]:checked')?.value||t.adminId;
    save();closeModal();renderAll();renderSelected();toast("Trip settings saved");
  });
}

function addExpense(){
  const t=currentTrip();if(!t)return;
  const isAdmin=isCurrentAdmin(t);
  modal("Add expense",`<div class="form-grid">
    <div class="field"><label>Expense name</label><input id="eName" placeholder="Dinner, fuel, hotel..."></div>
    <div class="field"><label>Bill amount (₹)</label><input id="eBill" type="number" min="0" step=".01" placeholder="1000"></div>
    <div class="field"><label>Paid by</label><select id="ePayer">${t.members.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join("")}</select></div>
    <div class="field"><label>Split between</label><div class="members">${t.members.map(m=>`<label class="check"><input type="checkbox" class="eMember" value="${m.id}" checked> ${esc(m.name)}</label>`).join("")}</div></div>
    <div class="section-head compact"><h3>Share</h3><div><button class="secondary-btn" id="equalBtn" type="button">Equal</button> <button class="secondary-btn" id="randomBtn" type="button">Random</button></div></div>
    <div id="shareInputs">${t.members.map(m=>`<div class="member-row share-row" data-id="${m.id}"><span>${esc(m.name)}</span><input class="pct" type="number" value="${(100/t.members.length).toFixed(1)}" min="0" max="100" step=".1"></div>`).join("")}</div>
    ${!isAdmin?`<div class="notice">You can add expenses, but only the trip admin can delete them.</div>`:""}
  </div>`,`<div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Cancel</button><button class="primary-btn" id="saveExpense">Add expense</button></div>`);
  const setShares=(random=false)=>{
    const active=[...document.querySelectorAll(".eMember:checked")].map(x=>x.value);if(!active.length)return;
    let vals=random?active.map(()=>Math.random()):active.map(()=>1);const sum=vals.reduce((a,b)=>a+b,0);vals=vals.map(v=>+(v/sum*100).toFixed(1));
    let diff=+(100-vals.reduce((a,b)=>a+b,0)).toFixed(1);vals[vals.length-1]=+(vals.at(-1)+diff).toFixed(1);
    document.querySelectorAll(".share-row").forEach(row=>row.querySelector(".pct").value=active.includes(row.dataset.id)?vals[active.indexOf(row.dataset.id)]:0);
  };
  $("equalBtn").onclick=()=>setShares(false);$("randomBtn").onclick=()=>setShares(true);
  $("saveExpense").onclick=()=>{
    const name=$("eName").value.trim(),bill=Number($("eBill").value),members=[...document.querySelectorAll(".eMember:checked")].map(x=>x.value);
    if(!name||!bill||!members.length)return toast("Enter expense, amount and members");
    const shares=members.map(mid=>({memberId:mid,pct:Number(document.querySelector(`.share-row[data-id="${mid}"] .pct`).value)||0}));
    const total=shares.reduce((a,s)=>a+s.pct,0);if(Math.abs(total-100)>.11)return toast("Shares must total 100%");
    const payer=t.members.find(m=>m.id===$("ePayer").value);
    (t.expenses[selectedDay]??=[]).push({id:id(),name,bill,payerId:payer.id,payerName:payer.name,shares});
    save();closeModal();renderAll();renderSelected();toast("Expense added safely");
  };
}

function secureDeleteExpense(t,day,ex){
  if(!isCurrentAdmin(t))return toast("Only the trip admin can delete expenses");
  modal("Delete expense",`<p>You're about to delete <b>${esc(ex.name)}</b> (${fmtMoney(ex.bill)}).</p><div class="notice">This action is protected. Type <b>DELETE</b> to confirm.</div><div class="field"><label>Confirmation</label><input id="confirmDelete" autocomplete="off" placeholder="DELETE"></div>`,`<div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Cancel</button><button class="danger-outline" id="confirmExpenseDelete">Delete permanently</button></div>`);
  $("confirmExpenseDelete").onclick=()=>{if($("confirmDelete").value!=="DELETE")return toast("Type DELETE to confirm");t.expenses[day]=t.expenses[day].filter(x=>x.id!==ex.id);if(!t.expenses[day].length)delete t.expenses[day];save();closeModal();renderAll();renderSelected();toast("Expense deleted")};
}
function secureDeleteTrip(){
  const t=currentTrip();if(!t||!isCurrentAdmin(t))return toast("Only the trip admin can delete this trip");
  modal("Delete trip",`<p>This will delete <b>${esc(t.name)}</b> and all its saved expenses.</p><div class="notice">This action is protected. Type the trip name exactly to confirm.</div><div class="field"><label>Trip name</label><input id="confirmTrip" autocomplete="off" placeholder="${esc(t.name)}"></div>`,`<div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Cancel</button><button class="danger-outline" id="confirmTripDelete">Delete permanently</button></div>`);
  $("confirmTripDelete").onclick=()=>{if($("confirmTrip").value.trim()!==t.name)return toast("Trip name does not match");state.trips=state.trips.filter(x=>x.id!==t.id);selectedTripId=null;selectedDay=null;save();closeModal();renderAll();toast("Trip deleted")};
}


function renderQuickHistory(){
  const box=$("quickSplitHistory"); if(!box)return;
  const arr=state.quickSplits||[];
  box.innerHTML=arr.length?arr.slice().reverse().map(q=>`
    <div class="quick-card">
      <div class="quick-card-head">
        <div><div class="quick-card-title">${esc(q.title)}</div><div class="quick-card-meta">${q.members.length} people${q.randomPayer?` · payer: ${esc(q.randomPayer)}`:""}</div></div>
        <strong>${fmtMoney(q.total)}</strong>
      </div>
      ${q.members.map(m=>`<div class="quick-item"><span>${esc(m.name)} · ${m.pct}%</span><span>${fmtMoney(m.amount)}</span></div>`).join("")}
      <div class="quick-actions"><button class="quick-delete" data-qdel="${q.id}">Delete saved split</button></div>
    </div>`).join(""):"";
  box.querySelectorAll("[data-qdel]").forEach(b=>b.onclick=()=>{
    const q=arr.find(x=>x.id===b.dataset.qdel); if(!q)return;
    modal("Delete quick split",`<p>Delete <b>${esc(q.title)}</b>?</p><div class="notice">Type <b>DELETE</b> to confirm. This protects one-off bills from accidental deletion.</div><div class="field"><label>Confirmation</label><input id="quickDeleteConfirm" autocomplete="off"></div>`,`<div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Cancel</button><button class="danger-outline" id="quickDeleteGo">Delete permanently</button></div>`);
    $("quickDeleteGo").onclick=()=>{if($("quickDeleteConfirm").value!=="DELETE")return toast("Type DELETE to confirm");state.quickSplits=(state.quickSplits||[]).filter(x=>x.id!==q.id);save();closeModal();renderQuickHistory();toast("Quick split deleted")};
  });
}

function openQuickSplit(){
  state.quickSplits=state.quickSplits||[];
  const defaultName=state.profile?.name||"Aditya";
  modal("Quick Split",`<div class="form-grid">
    <div class="field"><label>Bill / expense name</label><input id="qTitle" placeholder="Breakfast with friends"></div>
    <div class="field"><label>Total bill (₹)</label><input id="qTotal" type="number" min="0" step=".01" placeholder="1000"></div>

    <div class="section-head compact">
      <div>
        <h3>Friends & percentage split</h3>
        <p class="muted">Enter each person's share. The actual amount is calculated automatically.</p>
      </div>
      <button class="secondary-btn" id="qAddMember" type="button">＋ Add friend</button>
    </div>

    <div class="quick-split-table-wrap">
      <table class="quick-split-table">
        <thead>
          <tr><th>Name</th><th>Percentage share</th><th>Actual amount</th><th></th></tr>
        </thead>
        <tbody id="qMembers"></tbody>
      </table>
    </div>

    <div class="quick-tools">
      <button class="secondary-btn" id="qRandomShare" type="button">🎲 Random share</button>
      <button class="secondary-btn" id="qEqualShare" type="button">＝ Equal share</button>
      <button class="secondary-btn" id="qRandomPayer" type="button">🎯 Random payer</button>
    </div>

    <div id="qPayerResult" class="notice hidden"></div>
    <div id="qShareTotal" class="share-total">Total share: <b>0%</b></div>
    <div class="notice">The percentage shares should total exactly 100%. Random share automatically creates a valid 100% allocation.</div>
  </div>`,`<div class="modal-actions"><button class="secondary-btn" onclick="closeModal()">Cancel</button><button class="primary-btn" id="qSave">Save split</button></div>`);

  const tbody=$("qMembers");

  function addMember(name=""){
    const tr=document.createElement("tr");
    tr.className="q-member-row";
    tr.innerHTML=`
      <td><input class="q-name" value="${esc(name)}" placeholder="Friend name"></td>
      <td><input class="q-pct" type="number" min="0" max="100" step=".1" value="0"></td>
      <td class="q-amount">₹0.00</td>
      <td><button class="quick-delete q-remove" type="button">×</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector(".q-pct").addEventListener("input",updateQuickAmounts);
    tr.querySelector(".q-name").addEventListener("input",updateQuickAmounts);
    tr.querySelector(".q-remove").onclick=()=>{
      if(tbody.querySelectorAll("tr").length<=1)return toast("Keep at least one person");
      tr.remove(); updateQuickAmounts();
    };
    updateQuickAmounts();
  }

  addMember(defaultName);
  addMember("");

  function rows(){return [...tbody.querySelectorAll("tr")]}
  function updateQuickAmounts(){
    const total=Number($("qTotal").value)||0;
    let pctTotal=0;
    rows().forEach(tr=>{
      const pct=Number(tr.querySelector(".q-pct").value)||0;
      pctTotal+=pct;
      tr.querySelector(".q-amount").textContent=fmtMoney(total*pct/100);
    });
    $("qShareTotal").innerHTML=`Total share: <b>${pctTotal.toFixed(1)}%</b>`;
    $("qShareTotal").classList.toggle("invalid-share",Math.abs(pctTotal-100)>.11);
  }

  $("qTotal").addEventListener("input",updateQuickAmounts);
  $("qAddMember").onclick=()=>{if(rows().length>=20)return toast("Maximum 20 people");addMember("")};

  $("qEqualShare").onclick=()=>{
    const rs=rows(); if(!rs.length)return;
    const base=+(100/rs.length).toFixed(1);
    rs.forEach((tr,i)=>tr.querySelector(".q-pct").value=i===rs.length-1?+(100-base*(rs.length-1)).toFixed(1):base);
    updateQuickAmounts();
  };

  $("qRandomShare").onclick=()=>{
    const rs=rows(); if(!rs.length)return;
    let vals=rs.map(()=>Math.random()),sum=vals.reduce((a,b)=>a+b,0);
    vals=vals.map(v=>+(v/sum*100).toFixed(1));
    const diff=+(100-vals.reduce((a,b)=>a+b,0)).toFixed(1);
    vals[vals.length-1]=+(vals.at(-1)+diff).toFixed(1);
    rs.forEach((tr,i)=>tr.querySelector(".q-pct").value=vals[i]);
    updateQuickAmounts();
  };

  $("qRandomPayer").onclick=()=>{
    const rs=rows().filter(tr=>tr.querySelector(".q-name").value.trim());
    if(!rs.length)return toast("Add at least one named person");
    const chosen=rs[Math.floor(Math.random()*rs.length)].querySelector(".q-name").value.trim();
    $("qPayerResult").textContent=`🎯 Random payer: ${chosen}`;
    $("qPayerResult").classList.remove("hidden");
  };

  $("qSave").onclick=()=>{
    const title=$("qTitle").value.trim()||"Quick Split";
    const total=Number($("qTotal").value)||0;
    const members=rows().map(tr=>({
      name:tr.querySelector(".q-name").value.trim(),
      pct:Number(tr.querySelector(".q-pct").value)||0
    })).filter(m=>m.name);

    if(!total)return toast("Enter the total bill");
    if(!members.length)return toast("Add at least one friend");
    const pctTotal=members.reduce((a,m)=>a+m.pct,0);
    if(Math.abs(pctTotal-100)>.11)return toast("Percentage shares must total 100%");
    const payerText=$("qPayerResult").textContent.replace("🎯 Random payer: ","").trim()||null;

    const result={
      id:id(),title,total,
      members:members.map(m=>({...m,amount:+(total*m.pct/100).toFixed(2)})),
      randomPayer:payerText,
      createdAt:new Date().toISOString()
    };
    state.quickSplits.push(result);
    save();closeModal();renderQuickHistory();showQuickResult(result);toast("Quick split saved");
  };

  updateQuickAmounts();
}

function showQuickResult(q){
  const rows=q.members.map(m=>`<div class="total-row"><span>${esc(m.name)} · ${m.pct}%</span><strong>${fmtMoney(m.amount)}</strong></div>`).join("");
  modal("Split result",`<p><b>${esc(q.title)}</b> · Total ${fmtMoney(q.total)}</p><div>${rows}</div>${q.randomPayer?`<div class="notice">🎯 Random payer: <b>${esc(q.randomPayer)}</b></div>`:""}`,`<div class="modal-actions"><button class="primary-btn" onclick="closeModal()">Done</button></div>`);
}

function renderAll(){renderCalendar();renderTrips();renderSelected();renderQuickHistory()}
$("prevMonth").onclick=()=>{cursor.setMonth(cursor.getMonth()-1);save();renderCalendar()};
$("nextMonth").onclick=()=>{cursor.setMonth(cursor.getMonth()+1);save();renderCalendar()};
$("newTripBtn").onclick=()=>openNewTrip(keyOf(new Date()),keyOf(new Date()));
$("manageTripBtn").onclick=openSettings;$("addExpenseBtn").onclick=addExpense;$("deleteTripBtn").onclick=secureDeleteTrip;$("quickSplitBtn").onclick=openQuickSplit;
renderAll();
