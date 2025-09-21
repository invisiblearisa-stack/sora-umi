/***** 設定：Supabaseを使うときだけ入れる（未設定ならローカル保存） *****/
const SUPABASE_URL  = "";   // 例: https://xxxx.supabase.co
const SUPABASE_ANON = "";   // anonキー

let store = null, sb = null;

/*** LocalStorage 実装 ***/
class LocalStore {
  get(key, def){ try{ return JSON.parse(localStorage.getItem(key)) ?? def }catch{ return def } }
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)) }

  async listTasks(){ return this.get("tasks", [{title:"除草（30分）",done:false},{title:"水位チェック",done:false}]) }
  async saveTasks(arr){ this.set("tasks", arr); return true }

  async listProducts(){ return this.get("products", []) }
  async addProduct(p){ const arr = await this.listProducts(); arr.push(p); this.set("products", arr) }

  async listOrders(){ return this.get("orders", []) }
  async addOrder(o){ const arr = await this.listOrders(); arr.push(o); this.set("orders", arr) }
  async deleteOrder(idx){ const arr = await this.listOrders(); arr.splice(idx,1); this.set("orders", arr) }
}

/*** （オプション）Supabase 実装：必要になったら拡張 ***/
class SupabaseStore extends LocalStore {
  constructor(){ super(); sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
}

/*** どのストアを使うか自動判定 ***/
function pickStore(){
  if (SUPABASE_URL && SUPABASE_ANON) {
    try { store = new SupabaseStore(); return; } catch {}
  }
  store = new LocalStore();
}

/*** 画面描画：Tasks ***/
async function renderTasks(){
  const ul = document.getElementById("tasks");
  const tasks = await store.listTasks();
  ul.innerHTML = "";
  tasks.forEach((t)=>{
    const li = document.createElement("li");
    li.className = "touchable";
    li.textContent = (t.done ? "✅ " : "") + t.title;
    li.onclick = async ()=>{
      t.done = !t.done;
      const copy = tasks.map(x => ({...x}));
      await store.saveTasks(copy);
      renderTasks();
    };
    ul.appendChild(li);
  });
}

/*** 画面描画：Products ***/
async function renderProducts(){
  const ul = document.getElementById("products");
  const list = await store.listProducts();
  ul.innerHTML = "";
  list.forEach(p=>{
    const li = document.createElement("li");
    li.textContent = `${p.name} / ¥${p.price} / 在庫${p.stockKg}kg`;
    ul.appendChild(li);
  });

  // 受注フォームのプルダウンにも流し込む
  const sel = document.getElementById("cProduct");
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = ""; opt0.textContent = "商品を選択";
  sel.appendChild(opt0);
  list.forEach((p,i)=>{
    const o = document.createElement("option");
    o.value = i;
    o.textContent = p.name;
    sel.appendChild(o);
  });
}

/*** 画面描画：Orders ***/
async function renderOrders(){
  const ul = document.getElementById("orders");
  const list = await store.listOrders();
  ul.innerHTML = "";
  list.forEach((o, idx)=>{
    const li = document.createElement("li");
    const summary = `${o.orderId}：${o.name} / ${o.addr} / ${o.productName} × ${o.qty}`;
    li.textContent = summary;

    const pdfBtn = document.createElement("button");
    pdfBtn.textContent = "送り状PDF";
    pdfBtn.className = "inline-btn";
    pdfBtn.onclick = ()=> makeLabelPDF(o);

    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.className = "inline-btn";
    delBtn.onclick = async ()=>{ await store.deleteOrder(idx); renderOrders(); };

    li.appendChild(pdfBtn);
    li.appendChild(delBtn);
    ul.appendChild(li);
  });
}

/*** 受注 → 保存 ***/
async function addOrderFromForm(){
  const name = document.getElementById("cName").value.trim();
  const zip  = document.getElementById("cZip").value.trim();
  const tel  = document.getElementById("cTel").value.trim();
  const addr = document.getElementById("cAddr").value.trim();
  const pIdx = document.getElementById("cProduct").value;
  const qty  = parseInt(document.getElementById("cQty").value || "1", 10);

  const products = await store.listProducts();
  if (!name || !addr || !products[pIdx]) { alert("氏名・住所・商品を入力してください"); return; }

  const product = products[pIdx];
  const orderId = makeOrderId();
  const order = {
    orderId, name, zip, tel, addr,
    productName: product.name, price: product.price, qty,
    created_at: new Date().toISOString()
  };
  await store.addOrder(order);

  // フォームクリア → リスト更新
  ["cName","cZip","cTel","cAddr","cQty"].forEach(id=> document.getElementById(id).value = id==="cQty" ? "1" : "");
  document.getElementById("cProduct").value = "";
  renderOrders();
}

/*** 注文番号（例：20250921-143210） ***/
function makeOrderId(){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) +
         "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}

/*** 送り状PDF（Canvas→画像→jsPDF） ***/
function makeLabelPDF(o){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a6", orientation:"portrait" }); // A6: 105x148mm

  // キャンバスで日本語テキストを描く（システムフォントを使用）
  const W = 700, H = 980; // 比率はA6に合わせる
  const canvas = Object.assign(document.createElement("canvas"), { width:W, height:H });
  const ctx = canvas.getContext("2d");

  // 背景
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,W,H);
  // 枠
  ctx.strokeStyle = "#222"; ctx.lineWidth = 4; ctx.strokeRect(20,20,W-40,H-40);

  // 見出し
  ctx.fillStyle = "#0f1c28";
  ctx.font = "bold 42px -apple-system, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif";
  ctx.fillText("ソラウミ 送り状", 36, 80);

  // 仕切り線
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(30, 100); ctx.lineTo(W-30, 100); ctx.stroke();

  // 本文
  ctx.fillStyle = "#111";
  ctx.font = "32px -apple-system, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif";
  const L = 44;
  let y = 150;
  const line = (label, val) => { ctx.fillText(label, 36, y); ctx.fillText(String(val||""), 220, y); y += L; };

  line("注文番号", o.orderId);
  line("お名前",   o.name);
  line("郵便番号", o.zip || "");
  line("住所",     o.addr);
  line("電話",     o.tel || "");
  line("商品",     o.productName);
  line("数量",     o.qty + " 個");
  line("金額",     "¥" + (o.price*o.qty).toLocaleString());

  // 備考枠
  ctx.strokeStyle = "#e5e7eb"; ctx.strokeRect(36, y+10, W-72, 140);
  ctx.fillStyle = "#555"; ctx.fillText("備考", 36, y+0);

  // キャンバスをPDFへ
  const img = canvas.toDataURL("image/png");
  // A6の横幅にフィットさせる（縦は自動）
  doc.addImage(img, "PNG", 0, 0, 105, 105 * (H/W));
  doc.save(`label-${o.orderId}.pdf`);
}

/*** 起動処理 ***/
document.addEventListener("DOMContentLoaded", async ()=>{
  pickStore();
  await renderTasks();
  await renderProducts();
  await renderOrders();

  document.getElementById("addTask").onclick = async ()=>{
    const box = document.getElementById("newTask");
    const tasks = await store.listTasks();
    if (box.value.trim()) {
      tasks.push({ title: box.value.trim(), done:false });
      await store.saveTasks(tasks);
      box.value = "";
      renderTasks();
    }
  };

  document.getElementById("addProduct").onclick = async ()=>{
    const name  = document.getElementById("pname").value.trim() || "名久井米 2kg（白米）";
    const price = parseInt(document.getElementById("pprice").value || "1680", 10);
    const stock = parseFloat(document.getElementById("pstock").value || "30");
    await store.addProduct({ name, price, stockKg: stock, created_at:new Date().toISOString() });
    document.getElementById("pname").value = "";
    document.getElementById("pprice").value = "";
    document.getElementById("pstock").value = "";
    document.getElementById("msg").textContent = "商品を作成しました！";
    renderProducts();
  };

  document.getElementById("addOrder").onclick = addOrderFromForm;
});
