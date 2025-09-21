/***** 設定：Supabaseを使うときだけ入れる *****/
const SUPABASE_URL  = "";   // 例: https://xxxx.supabase.co
const SUPABASE_ANON = "";   // anonキー

/***** データ層（未設定ならLocalStorageを自動使用） *****/
let store = null, sb = null;

class LocalStore {
  get(key, def){ try{ return JSON.parse(localStorage.getItem(key)) ?? def }catch{ return def } }
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)) }
  async listTasks(){ return this.get("tasks", [{title:"除草（30分）",done:false},{title:"水位チェック",done:false}]) }
  async saveTasks(arr){ this.set("tasks", arr); return true }
  async listProducts(){ return this.get("products", []) }
  async addProduct(p){ const arr = await this.listProducts(); arr.push(p); this.set("products", arr); }
}

class SupabaseStore extends LocalStore {
  constructor(){ super(); sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
  async listTasks(){ const {data,error}=await sb.from("tasks").select("*").order("id"); if(error) throw error; return data }
  async saveTasks(arr){
    const rows = arr.map((t,i)=>({ id:i+1, title:t.title, done:t.done }));
    const { error } = await sb.from("tasks").upsert(rows, { onConflict:"id" });
    if(error) throw error; return true;
  }
  async listProducts(){ const {data,error}=await sb.from("products").select("*").order("id"); if(error) throw error; return data }
  async addProduct(p){ const {error}=await sb.from("products").insert(p); if(error) throw error; }
}

function pickStore(){
  if (SUPABASE_URL && SUPABASE_ANON) {
    try { store = new SupabaseStore(); return; } catch { /* fallback */ }
  }
  store = new LocalStore();
}

/***** UI *****/
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
      await store.saveTasks(tasks);
      renderTasks();
    };
    ul.appendChild(li);
  });
}

async function renderProducts(){
  const ul = document.getElementById("products");
  const list = await store.listProducts();
  ul.innerHTML = "";
  list.forEach(p=>{
    const li = document.createElement("li");
    li.textContent = `${p.name} / ¥${p.price} / 在庫${p.stockKg}kg`;
    ul.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", async ()=>{
  pickStore();
  await renderTasks();
  await renderProducts();

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
    try{
      await store.addProduct({ name, price, stockKg: stock, created_at:new Date().toISOString() });
      document.getElementById("msg").textContent = "商品を作成しました！";
      document.getElementById("pname").value = "";
      document.getElementById("pprice").value = "";
      document.getElementById("pstock").value = "";
      renderProducts();
    }catch(e){
      document.getElementById("msg").textContent = "エラー: " + e.message;
    }
  };
});
