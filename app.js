const SUPABASE_URL  = "";
const SUPABASE_ANON = "";
let store = null, sb = null;

class LocalStore {
  get(k,d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d }catch{ return d } }
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
  async listTasks(){ return this.get("tasks", [{title:"除草（30分）",done:false},{title:"水位チェック",done:false}]) }
  async saveTasks(a){ this.set("tasks", a); return true }
  async listProducts(){ return this.get("products", []) }
  async addProduct(p){ const a=await this.listProducts(); a.push(p); this.set("products", a) }
  async listOrders(){ return this.get("orders", []) }
  async addOrder(o){ const a=await this.listOrders(); a.push(o); this.set("orders", a) }
  async deleteOrder(i){ const a=await this.listOrders(); a.splice(i,1); this.set("orders", a) }
}
class SupabaseStore extends LocalStore { constructor(){ super(); sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON); } }
function pickStore(){ if(SUPABASE_URL&&SUPABASE_ANON){ try{ store=new SupabaseStore(); return }catch{} } store=new LocalStore(); }

async function renderTasks(){
  const ul=document.getElementById("tasks");
  const t=await store.listTasks(); ul.innerHTML="";
  t.forEach(x=>{ const li=document.createElement("li"); li.className="touchable";
    li.textContent=(x.done?"✅ ":"")+x.title;
    li.onclick=async()=>{ x.done=!x.done; await store.saveTasks(t.map(v=>({...v}))); renderTasks(); };
    ul.appendChild(li);
  });
}
async function renderProducts(){
  const ul=document.getElementById("products");
  const list=await store.listProducts(); ul.innerHTML="";
  list.forEach(p=>{ const li=document.createElement("li");
    li.textContent=`${p.name} / ¥${p.price} / 在庫${p.stockKg}kg`; ul.appendChild(li); });
  const sel=document.getElementById("cProduct"); if(!sel) return;
  sel.innerHTML=""; const o0=document.createElement("option"); o0.value=""; o0.textContent="商品を選択"; sel.appendChild(o0);
  list.forEach((p,i)=>{ const o=document.createElement("option"); o.value=i; o.textContent=p.name; sel.appendChild(o); });
}
async function renderOrders(){
  const ul=document.getElementById("orders"); if(!ul) return;
  const list=await store.listOrders(); ul.innerHTML="";
  list.forEach((o,idx)=>{
    const li=document.createElement("li");
    li.textContent=`${o.orderId}：${o.name} / ${o.addr} / ${o.productName} × ${o.qty}`;
    const pdf=document.createElement("button"); pdf.textContent="送り状PDF"; pdf.className="inline-btn"; pdf.onclick=()=>makeLabelPDF(o);
    const del=document.createElement("button"); del.textContent="削除"; del.className="inline-btn";
    del.onclick=async()=>{ await store.deleteOrder(idx); renderOrders(); };
    li.appendChild(pdf); li.appendChild(del); ul.appendChild(li);
  });
}
async function addOrderFromForm(){
  const name=v("cName"), zip=v("cZip"), tel=v("cTel"), addr=v("cAddr"), pIdx=document.getElementById("cProduct").value;
  const qty=parseInt(v("cQty")||"1",10); const products=await store.listProducts();
  if(!name||!addr||!products[pIdx]){ alert("氏名・住所・商品を入力してください"); return; }
  const p=products[pIdx]; const order={ orderId:makeOrderId(), name, zip, tel, addr,
    productName:p.name, price:p.price, qty, created_at:new Date().toISOString() };
  await store.addOrder(order);
  ["cName","cZip","cTel","cAddr"].forEach(id=>s(id,"")); s("cQty","1"); document.getElementById("cProduct").value="";
  renderOrders();
}
function v(id){ return document.getElementById(id)?.value.trim()||"" }
function s(id,val){ const el=document.getElementById(id); if(el) el.value=val }
function makeOrderId(){ const d=new Date(), P=n=>String(n).padStart(2,"0");
  return d.getFullYear()+P(d.getMonth()+1)+P(d.getDate())+"-"+P(d.getHours())+P(d.getMinutes())+P(d.getSeconds()); }

function makeLabelPDF(o){
  const { jsPDF }=window.jspdf; const doc=new jsPDF({unit:"mm",format:"a6",orientation:"portrait"});
  const W=700,H=980; const c=Object.assign(document.createElement("canvas"),{width:W,height:H}), g=c.getContext("2d");
  g.fillStyle="#fff"; g.fillRect(0,0,W,H); g.strokeStyle="#222"; g.lineWidth=4; g.strokeRect(20,20,W-40,H-40);
  g.fillStyle="#0f1c28"; g.font="bold 42px -apple-system, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif"; g.fillText("ソラウミ 送り状",36,80);
  g.strokeStyle="#e5e7eb"; g.lineWidth=2; g.beginPath(); g.moveTo(30,100); g.lineTo(W-30,100); g.stroke();
  g.fillStyle="#111"; g.font="32px -apple-system, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif";
  const L=44; let y=150; const line=(a,b)=>{ g.fillText(a,36,y); g.fillText(String(b||""),220,y); y+=L; };
  line("注文番号",o.orderId); line("お名前",o.name); line("郵便番号",o.zip||""); line("住所",o.addr);
  line("電話",o.tel||""); line("商品",o.productName); line("数量",o.qty+" 個"); line("金額","¥"+(o.price*o.qty).toLocaleString());
  g.strokeStyle="#e5e7eb"; g.strokeRect(36,y+10,W-72,140); g.fillStyle="#555"; g.fillText("備考",36,y+0);
  const img=c.toDataURL("image/png"); doc.addImage(img,"PNG",0,0,105,105*(H/W)); doc.save(`label-${o.orderId}.pdf`);
}

document.addEventListener("DOMContentLoaded", async ()=>{
  pickStore();
  await renderTasks(); await renderProducts(); await renderOrders();
  byId("addTask",btn=>btn.onclick=async()=>{ const box=document.getElementById("newTask");
    const t=await store.listTasks(); if(box.value.trim()){ t.push({title:box.value.trim(),done:false});
    await store.saveTasks(t); box.value=""; renderTasks(); }});
  byId("addProduct",btn=>btn.onclick=async()=>{ const name=v("pname")||"名久井米 2kg（白米）";
    const price=parseInt(v("pprice")||"1680",10); const stock=parseFloat(v("pstock")||"30");
    await store.addProduct({name,price,stockKg:stock,created_at:new Date().toISOString()});
    s("pname",""); s("pprice",""); s("pstock",""); const m=document.getElementById("msg"); if(m) m.textContent="商品を作成しました！";
    renderProducts(); });
  byId("addOrder",btn=>btn.onclick=addOrderFromForm);
});
function byId(id,fn){ const el=document.getElementById(id); if(el) fn(el) }
