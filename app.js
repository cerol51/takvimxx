// ── FIREBASE CONFIG ───────────
const firebaseConfig = {
  apiKey: "AIzaSyCruRe16p-dp4dMxes3HFT_vXVaHUE5kVk",
  authDomain: "calismatakvimi-7e26b.firebaseapp.com",
  databaseURL: "https://calismatakvimi-7e26b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "calismatakvimi-7e26b",
  storageBucket: "calismatakvimi-7e26b.firebasestorage.app",
  messagingSenderId: "374119692060",
  appId: "1:374119692060:web:83c5ae9b291f976cba2cd9"
};

const DB_PATH = "cihat_takvim_2026"; 
let dbRef = null;
let isCloudActive = false;
let auth = null;

if (firebaseConfig.apiKey) {
  try {
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    dbRef = database.ref(DB_PATH);
    
    isCloudActive = true;
    auth = firebase.auth();

    document.getElementById('sync-status').innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Bulut`;
    document.getElementById('sync-status').style.color = '#38A169';
    document.getElementById('sync-status').style.background = 'rgba(56,161,105,.15)';
  } catch(e) { console.error("Firebase başlatılamadı:", e); }
}

// ── KULLANICI & ROL YÖNETİMİ ───────────

function canEdit() { return['admin', 'manager', 'specialist'].includes(state.user?.rol); }
function canDelete() { return ['admin', 'manager'].includes(state.user?.rol); }
function canViewOthers() { return ['admin', 'manager'].includes(state.user?.rol); }

const MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const DEFAULT_CATS=['Ofis Çalışmaları','Proje ve Müşteri Ziyaretleri','Toplantılar','Denetimler','DÖF Kapatma','Bütçe Geliştirme ve İyileştirme','Plan Dışı Çalışmalar','Aylık İş Planı'];
const DEFAULT_CAT_COLORS={'Ofis Çalışmaları':'#3182CE','Proje ve Müşteri Ziyaretleri':'#38A169','Toplantılar':'#805AD5','Denetimler':'#DD6B20','DÖF Kapatma':'#E53E3E','Bütçe Geliştirme ve İyileştirme':'#319795','Plan Dışı Çalışmalar':'#D69E2E','Aylık İş Planı':'#4299E1'};
const SC={Tamamlandı:'bg',Planlandı:'bo',Gerçekleşmedi:'br'};

let state={
  tab: 'login', data:[], users:[], selectedMonth:null, filter:'Tümü', filterMonth:'Tümü', search:'', selectedTeamUser: null,
  cats: [...DEFAULT_CATS],
  catColors: {...DEFAULT_CAT_COLORS},
  formData:{ay:MONTHS[new Date().getMonth()],tarih:'',calisma:DEFAULT_CATS[0],konu:'',proje:'',durum:'Planlandı', aciklama:''},
  nextId:100, editingId:null, previousTab:null,
  user: null, 
  loginForm: { ad: '', soyad: '', sifre: '', pozisyon: '' },
  registerForm: { ad: '', soyad: '', sifre: '', pozisyon: 'Uzman' }
};

// ── Veri Yönetimi ───────────────────────────────────────────
function loadData(){
  try {
    const s = localStorage.getItem('takvim2026_data');
    if(s) {
      const p = JSON.parse(s);
      state.data = p.data ||[];
      state.nextId = p.nextId || 100;
      state.users = p.users || [];
    }
  } catch(e) {}

  if(isCloudActive) {
    auth.onAuthStateChanged(user => {
      if(user) {
        dbRef.child('users').child(user.uid).once('value').then(snap => {
          if(snap.exists()) {
            state.user = snap.val();
            state.user.uid = user.uid;
            state.tab = 'home';
            render();
          } else {
            // Kullanıcı Auth'da var ama DB'den silinmişse yeniden oluştur
            let ad = 'Kullanıcı', soyad = '';
            if(user.email) {
              const parts = user.email.split('@')[0].split('.');
              ad = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
              if(parts[1]) soyad = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
            }
            const isAdmin = user.email === 'cihat.erol@takvim2026.app';
            const newUser = { 
              ad, soyad, 
              rol: isAdmin ? 'admin' : 'viewer', 
              rolIsim: isAdmin ? 'Admin' : 'İzleyici', 
              email: user.email, 
              uid: user.uid 
            };
            dbRef.child('users').child(user.uid).set(newUser).then(() => {
              state.user = newUser;
              state.tab = 'home';
              render();
            });
          }
        });
      } else {
        state.user = null;
        if(state.tab !== 'register') state.tab = 'login';
        render();
      }
    });

    dbRef.child('settings').on('value', (snapshot) => {
      if(snapshot.exists()) {
        const val = snapshot.val();
        if(val.cats) state.cats = val.cats;
        if(val.catColors) state.catColors = val.catColors;
      } else {
        dbRef.child('settings').set({cats: state.cats, catColors: state.catColors});
      }
      localStorage.setItem('takvim2026_settings', JSON.stringify({cats: state.cats, catColors: state.catColors}));
      render();
    });

    dbRef.child('data').on('value', (snapshot) => {
      if(snapshot.exists()) state.data = snapshot.val() || [];
      localStorage.setItem('takvim2026_data', JSON.stringify({data: state.data, nextId: state.nextId, users: state.users}));
      render(); 
    });
    dbRef.child('users').on('value', (snapshot) => {
      if(snapshot.exists()) {
        const val = snapshot.val() || {};
        state.users = Object.keys(val).map(k => ({...val[k], uid: k}));
      } else {
        state.users = [];
      }
      render();
    });
    dbRef.child('nextId').on('value', (snapshot) => {
      if(snapshot.exists()) state.nextId = snapshot.val();
    });
  } else {
    render();
  }
}

function saveData(){
  try { localStorage.setItem('takvim2026_data', JSON.stringify({data: state.data, nextId: state.nextId, users: state.users})); } catch(e){}
  if (isCloudActive) {
    dbRef.child('data').set(state.data).catch(e => showToast("Buluta kaydedilemedi."));
    dbRef.child('nextId').set(state.nextId);
  }
}

function saveSettings() {
  try { localStorage.setItem('takvim2026_settings', JSON.stringify({cats: state.cats, catColors: state.catColors})); } catch(e){}
  if (isCloudActive) {
    dbRef.child('settings').set({cats: state.cats, catColors: state.catColors}).catch(e => showToast("Ayarlar buluta kaydedilemedi."));
  }
}

// ── Görüntüleme Filtresi (Sadece Kendi Verisini Alma) ──
function getMyData() {
  if(!state.user) return[];
  const fullName = state.user.ad + ' ' + state.user.soyad;
  return state.data.filter(d => d.ekleyen === fullName);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function catColor(c){return state.catColors[c]||'#3182CE';}
function badgeClass(d){return SC[d]||'bb';}
function badgeShort(d){return d==='Tamamlandı'?'Tamam':d==='Planlandı'?'Planlı':'İptal';}
function parseDate(dStr) { const p = (dStr||'').split('.'); if(p.length!==3) return new Date(); return new Date(p[2], p[1]-1, p[0]); }

function monthStats(m, customData){
  const targetData = customData || getMyData(); // Özel veri verilmemişse kendi verimi al
  const md=targetData.filter(d=>d.ay===m);
  const done=md.filter(d=>d.durum==='Tamamlandı').length;
  const plan=md.filter(d=>d.durum==='Planlandı').length;
  const nope=md.filter(d=>d.durum==='Gerçekleşmedi').length;
  const pct=md.length?Math.round(done/md.length*100):0;
  return {total:md.length,done,plan,nope,pct,data:md};
}

function getIsoDate(ddmmyyyy) {
  if(!ddmmyyyy) return ''; const p = ddmmyyyy.split('.');
  if(p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`; return '';
}

function getWeekBoundaries() {
  const now = new Date(); const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; 
  const start = new Date(now); start.setDate(now.getDate() - dayOfWeek); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  return {start, end};
}

function isDateInCurrentWeek(dStr) {
  const d = parseDate(dStr); const {start, end} = getWeekBoundaries();
  return d >= start && d <= end;
}
function formatDateRange(start, end) {
  const dd = (date) => String(date.getDate()).padStart(2,'0');
  const mm = (date) => String(date.getMonth()+1).padStart(2,'0');
  return `${dd(start)}.${mm(start)} - ${dd(end)}.${mm(end)}`;
}

// ── RENDER FONKSİYONLARI ──────────────────────────────────
function render(){
  const scr=document.getElementById('screen');
  const nav=document.getElementById('bottom-nav');
  const statusBar=document.getElementById('status-bar');

  if(!state.user) {
    if(nav) nav.style.display = 'none';
    if(statusBar) statusBar.style.display = 'none';
    if(state.tab === 'register') {
      scr.innerHTML = renderRegister();
    } else {
      scr.innerHTML = renderLogin();
    }
    return;
  }

  if(nav) nav.style.display = 'flex';
  if(statusBar) statusBar.style.display = 'flex';

  // Yönetici ve Admin Ekip sekmesini görür
  const teamTabEl = document.getElementById('nav-team');
  if(teamTabEl) teamTabEl.style.display = canViewOthers() ? 'flex' : 'none';

  // Sadece yetkili kullanıcılar "Ekle" sekmesini görebilir
  const addTab = document.querySelector('.nav-item[data-tab="add"]');
  if(addTab) addTab.style.display = canEdit() ? 'flex' : 'none';

  // Settings (Ayarlar) sekmesini sadece admin görebilir
  const settingsTab = document.getElementById('nav-settings');
  if(settingsTab) settingsTab.style.display = (state.user?.rol === 'admin') ? 'flex' : 'none';

  if(state.tab==='home') scr.innerHTML=renderHome();
  else if(state.tab==='calendar' && state.selectedMonth) scr.innerHTML=renderMonthDetail(state.selectedMonth);
  else if(state.tab==='calendar') scr.innerHTML=renderCalendar();
  else if(state.tab==='list') scr.innerHTML=renderList();
  else if(state.tab==='report') scr.innerHTML=renderReport();
  else if(state.tab==='team') scr.innerHTML=renderTeam();
  else if(state.tab==='add') scr.innerHTML=renderAdd();
  else if(state.tab==='data') scr.innerHTML=renderDataPage();
  else if(state.tab==='settings') scr.innerHTML=renderSettings();
  
  scr.scrollTop=0; updateClock(); 
}

// ── AUTH YÖNETİMİ ──
function handleLoginInput(field, value) {
  state.loginForm[field] = value;
  
  const ad = state.loginForm.ad.toLowerCase().trim();
  const soyad = state.loginForm.soyad.toLowerCase().trim();
  const user = state.users.find(u => u.ad.toLowerCase() === ad && u.soyad.toLowerCase() === soyad);
  const detectedRole = user ? user.rolIsim : '';
  
  state.loginForm.pozisyon = detectedRole;
  
  const pozInput = document.getElementById('login-poz');
  if(pozInput) {
    pozInput.value = detectedRole;
    pozInput.style.color = detectedRole ? 'var(--blue)' : 'var(--text)';
  }
}

function renderLogin() {
  return `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-title">Çalışma Takvimi</div>
        <div class="login-sub">Uygulamaya devam etmek için giriş yapın</div>
        
        <div class="auth-row">
          <div class="form-g">
            <label class="form-lbl">Ad</label>
            <input class="form-inp" type="text" value="${esc(state.loginForm.ad)}" oninput="handleLoginInput('ad', this.value)" placeholder="Adınız">
          </div>
          <div class="form-g">
            <label class="form-lbl">Soyad</label>
            <input class="form-inp" type="text" value="${esc(state.loginForm.soyad)}" oninput="handleLoginInput('soyad', this.value)" placeholder="Soyadınız">
          </div>
        </div>

        <div class="form-g" style="margin:0 0 10px 0">
          <label class="form-lbl">Pozisyon</label>
          <input class="form-inp" id="login-poz" type="text" disabled value="${esc(state.loginForm.pozisyon)}" placeholder="Otomatik doldurulur">
        </div>

        <div class="form-g" style="margin:0 0 24px 0">
          <label class="form-lbl">Şifre</label>
          <input class="form-inp" type="password" value="${esc(state.loginForm.sifre)}" oninput="state.loginForm.sifre=this.value" placeholder="Şifreniz">
        </div>
        
        <button class="btn-primary" style="margin:0; width:100%" onclick="handleLogin()">Giriş Yap</button>
        
        <div class="link-text" onclick="handleForgotPassword()" style="color:var(--muted); margin-top:10px; font-weight:600;">Şifremi Unuttum</div>
        <div class="link-text" onclick="switchAuthTab('register')">Hesabın yok mu? Yeni kayıt oluştur</div>
      </div>
    </div>
  `;
}

function renderRegister() {
  const roles = ['Yönetici', 'Uzman', 'İzleyici'];
  return `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-title">Kayıt Ol</div>
        <div class="login-sub">Yeni bir hesap oluşturun</div>
        
        <div class="auth-row">
          <div class="form-g">
            <label class="form-lbl">Ad</label>
            <input class="form-inp" type="text" value="${esc(state.registerForm.ad)}" oninput="state.registerForm.ad=this.value" placeholder="Ad">
          </div>
          <div class="form-g">
            <label class="form-lbl">Soyad</label>
            <input class="form-inp" type="text" value="${esc(state.registerForm.soyad)}" oninput="state.registerForm.soyad=this.value" placeholder="Soyad">
          </div>
        </div>

        <div class="form-g" style="margin:0 0 10px 0">
          <label class="form-lbl">Pozisyon</label>
          <select class="form-sel" onchange="state.registerForm.pozisyon=this.value">
            ${roles.map(r => `<option value="${r}" ${state.registerForm.pozisyon===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </div>

        <div class="form-g" style="margin:0 0 24px 0">
          <label class="form-lbl">Şifre Oluştur</label>
          <input class="form-inp" type="password" value="${esc(state.registerForm.sifre)}" oninput="state.registerForm.sifre=this.value" placeholder="Şifre belirleyin">
        </div>
        
        <button class="btn-primary" style="margin:0; width:100%" onclick="handleRegister()">Kayıt Ol</button>
        
        <div class="link-text" onclick="switchAuthTab('login')">Zaten hesabın var mı? Giriş Yap</div>
      </div>
    </div>
  `;
}

function switchAuthTab(tab) {
  state.tab = tab;
  render();
}

function getEmail(ad, soyad) {
  const cleanStr = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cleanStr(ad)}.${cleanStr(soyad)}@takvim2026.app`;
}

function handleLogin() {
  const { ad, soyad, sifre } = state.loginForm;
  if(!ad.trim() || !soyad.trim() || !sifre.trim()) { showToast('Lütfen tüm alanları doldurun ⚠️'); return; }
  
  const email = getEmail(ad, soyad);
  auth.signInWithEmailAndPassword(email, sifre).then((userCredential) => {
    state.loginForm = { ad: '', soyad: '', sifre: '', pozisyon: '' };
    showToast(`Hoş geldin!`);
  }).catch((error) => {
    console.error(error);
    showToast('Giriş başarısız. Bilgilerinizi kontrol edin ❌');
  });
}

function handleForgotPassword() {
  const { ad, soyad } = state.loginForm;
  if(!ad.trim() || !soyad.trim()) { showToast('Lütfen Ad ve Soyad alanlarını doldurun ⚠️'); return; }
  
  const email = getEmail(ad, soyad);
  auth.sendPasswordResetEmail(email).then(() => {
    showToast('Şifre sıfırlama bağlantısı gönderildi ✓');
  }).catch((error) => {
    console.error(error);
    if(error.code === 'auth/user-not-found') showToast('Kullanıcı bulunamadı ❌');
    else showToast('Sıfırlama başarısız ❌');
  });
}

function handleRegister() {
  const { ad, soyad, sifre, pozisyon } = state.registerForm;
  if(!ad.trim() || !soyad.trim() || !sifre.trim()) { showToast('Lütfen tüm alanları doldurun ⚠️'); return; }
  if(sifre.length < 6) { showToast('Şifre en az 6 karakter olmalıdır ⚠️'); return; }

  let rolStr = 'viewer';
  if(pozisyon === 'Admin') rolStr = 'admin';
  else if(pozisyon === 'Yönetici') rolStr = 'manager';
  else if(pozisyon === 'Uzman') rolStr = 'specialist';

  const email = getEmail(ad, soyad);
  
  auth.createUserWithEmailAndPassword(email, sifre).then((userCredential) => {
    const user = userCredential.user;
    const newUser = { ad: ad.trim(), soyad: soyad.trim(), rol: rolStr, rolIsim: pozisyon, email: email, uid: user.uid };
    
    // Save user info to realtime database
    dbRef.child('users').child(user.uid).set(newUser).then(() => {
      showToast('Hesabınız oluşturuldu! ✓');
      state.registerForm = { ad: '', soyad: '', sifre: '', pozisyon: 'Uzman' };
      state.tab = 'home';
    });
  }).catch((error) => {
    console.error(error);
    if(error.code === 'auth/email-already-in-use') showToast('Bu isimde bir hesap zaten var ⚠️');
    else showToast('Kayıt olurken bir hata oluştu ❌');
  });
}

function logout() {
  auth.signOut().then(() => {
    state.user = null; state.tab = 'login'; state.selectedTeamUser = null;
    render();
  });
}

// ── UYGULAMA EKRANLARI (Kişisel) ──
function renderHome(){
  const myData = getMyData(); // Sadece kişinin kendi verisi
  const total=myData.length;
  const done=myData.filter(d=>d.durum==='Tamamlandı').length;
  const plan=myData.filter(d=>d.durum==='Planlandı').length;
  const nope=myData.filter(d=>d.durum==='Gerçekleşmedi').length;
  const pct=total?Math.round(done/total*100):0;
  
  const maxBar=Math.max(...MONTHS.map(m=>monthStats(m).total),1);
  const barHtml=MONTHS.map(m=>{
    const s=monthStats(m);
    const col=s.pct===100?'#38A169':s.pct>50?'#3182CE':'#DD6B20';
    return `<div class="mini-bar-wrap" onclick="switchTab('calendar'); selectMonth('${m}')"><div class="mini-bar" style="height:${s.total?Math.max(8,Math.round(s.total/maxBar*60)):3}px;background:${s.total?col:'#E2E8F0'}"></div><div class="mini-lbl">${m.slice(0,1)}</div></div>`;
  }).join('');

  const catTotals=state.cats.map(c=>({c,v:myData.filter(d=>d.calisma===c).length,col:catColor(c)})).filter(x=>x.v>0);
  let cumDeg=0;
  const conicStops=catTotals.map(x=>{const deg=Math.round(x.v/total*360);const s=`${x.col} ${cumDeg}deg ${cumDeg+deg}deg`;cumDeg+=deg;return s;}).join(', ');
  
  const recentHtml=[...myData].sort((a,b) => parseDate(b.tarih) - parseDate(a.tarih)).slice(0,5).map(a=>{
    const clickEvt = canEdit() ? `onclick="editActivity(${a.id})"` : '';
    return `
    <div class="act-item" ${clickEvt}>
      <span class="dot" style="background:${catColor(a.calisma)}"></span>
      <div style="flex:1;min-width:0">
        <div class="act-title">${esc(a.konu)}</div>
        <div class="act-meta">${esc(a.tarih)} · ${esc(a.ay)}</div>
      </div>
      <span class="badge ${badgeClass(a.durum)}">${badgeShort(a.durum)}</span>
    </div>`;
  }).join('');

  const initA = state.user?.ad ? state.user.ad[0] : '';
  const initS = state.user?.soyad ? state.user.soyad[0] : '';

  return `
    <div class="screen-header" style="justify-content:space-between; padding-bottom: 5px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="avatar">${esc(initA + initS)}</div>
        <div>
          <div style="font-size:15px; font-weight:800; color:var(--text)">${esc((state.user?.ad||'') + ' ' + (state.user?.soyad||''))}</div>
          <span class="role-badge">${esc(state.user?.rolIsim||'')}</span>
        </div>
      </div>
      <button class="logout-btn" onclick="logout()">Çıkış Yap</button>
    </div>
    
    <div class="live-date-widget" style="margin-top:10px"><div class="live-date-left"><div id="wd-date"></div><span id="wd-day"></span></div><div class="live-date-right" id="wd-time"></div></div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num" style="color:var(--blue)">${total}</div><div class="stat-label">Toplam</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--green)">${done}</div><div class="stat-label">Biten</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--orange)">${plan}</div><div class="stat-label">Planlı</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--red)">${nope}</div><div class="stat-label">İptal</div></div>
    </div>
    
    <div class="card card-pad" style="margin-bottom:10px"><div class="form-lbl">Aylık Dağılım</div><div class="mini-bars">${barHtml}</div></div>
    
    <div class="card card-pad" style="margin-bottom:10px; display:flex; flex-direction:column; align-items:center;">
      <div class="form-lbl" style="width:100%">Çalışma Türü Dağılımı</div>
      ${catTotals.length > 0 ? `
      <div style="width:150px; height:150px; border-radius:50%; background:conic-gradient(${conicStops}); margin:15px 0; box-shadow:0 4px 6px rgba(0,0,0,0.1);"></div>
      <div style="display:flex; flex-direction:column; gap:8px; width:100%; margin-top:10px;">
        ${catTotals.map(x=>`<div style="display:flex; align-items:center; justify-content:space-between; font-size:12px; color:var(--text);"><div style="display:flex; align-items:center; gap:8px;"><span style="width:12px; height:12px; border-radius:3px; background:${x.col};"></span>${esc(x.c)}</div><span style="font-weight:600">${x.v}</span></div>`).join('')}
      </div>
      ` : '<div style="padding:20px; color:var(--muted); font-size:13px;">Veri yok</div>'}
    </div>
    
    <div class="form-lbl" style="padding:0 14px">Son Eklenenler (Sizin)</div>
    <div class="card" style="padding:0">${recentHtml||'<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Henüz bir veri girmediniz</div>'}</div>`;
}

function renderMonthDetail(month){
  const s=monthStats(month);
  const itemsHtml=[...s.data].sort((a,b)=>parseDate(b.tarih)-parseDate(a.tarih)).map(a=>{
    const clickEvt = canEdit() ? `onclick="editActivity(${a.id})"` : '';
    return `
    <div class="act-item" ${clickEvt}>
      <span class="dot" style="background:${catColor(a.calisma)}"></span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between"><span style="font-size:10px;color:var(--muted)">${esc(a.tarih)}</span><span class="badge ${badgeClass(a.durum)}">${badgeShort(a.durum)}</span></div>
        <div class="act-title">${esc(a.konu)}</div>
        <div class="act-meta">${esc(a.calisma)} · ${esc(a.proje)}</div>
      </div>
    </div>`;
  }).join('');

  return `<div class="screen-header"><div class="back-btn" onclick="backFromMonth()">‹</div><div><div class="screen-title">${esc(month)}</div><div class="screen-sub">%${s.pct} tamamlandı (Kişisel)</div></div></div>
    <div class="card" style="padding:0">${itemsHtml||'<div style="padding:30px;text-align:center;color:var(--muted);font-size:13px">Kayıt yok</div>'}</div>`;
}

function renderList(){
  const filters=['Tümü','Tamamlandı','Planlandı','Gerçekleşmedi'];
  const filtered=getMyData().filter(d=>{
    const sf=state.filter==='Tümü'||d.durum===state.filter;
    const sm=state.filterMonth==='Tümü'||d.ay===state.filterMonth;
    const q=state.search.toLowerCase();
    return sf&&sm&&(!q||d.konu.toLowerCase().includes(q)||d.proje.toLowerCase().includes(q));
  }).sort((a,b) => parseDate(b.tarih) - parseDate(a.tarih)); 

  const itemsHtml=filtered.map(a=>{
    const clickEvt = canEdit() ? `onclick="editActivity(${a.id})"` : '';
    return `
    <div class="act-item" ${clickEvt}>
      <span class="dot" style="background:${catColor(a.calisma)}"></span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between"><div class="act-title">${esc(a.konu)}</div><span class="badge ${badgeClass(a.durum)}">${badgeShort(a.durum)}</span></div>
        <div class="act-meta">${esc(a.tarih)} · ${esc(a.ay)} · ${esc(a.proje)}</div>
      </div>
    </div>`;
  }).join('');

  return `<div class="screen-header"><div><div class="screen-title">Benim Aktivitelerim</div></div></div>
    <div class="search-wrap"><input class="search-inp" id="search-inp" placeholder="Ara..." value="${esc(state.search)}" oninput="setSearch(this.value)"></div>
    <div class="form-g"><select class="form-sel" onchange="setMonthFilter(this.value)"><option disabled>Ay Seç</option>${['Tümü',...MONTHS].map(m=>`<option value="${m}" ${state.filterMonth===m?'selected':''}>${m}</option>`).join('')}</select></div>
    <div class="filter-row">${filters.map(f=>`<span class="chip ${state.filter===f?'on':'off'}" onclick="setFilter('${f}')">${f}</span>`).join('')}</div>
    <div class="card" style="padding:0">${itemsHtml||'<div style="padding:30px;text-align:center;color:var(--muted);font-size:13px">Kayıt bulunamadı</div>'}</div>`;
}

function renderReport() {
  const {start, end} = getWeekBoundaries();
  const weekData = getMyData().filter(d => isDateInCurrentWeek(d.tarih)).sort((a,b) => parseDate(b.tarih) - parseDate(a.tarih));
  const done = weekData.filter(d => d.durum === 'Tamamlandı').length;
  
  const projCount = {}; weekData.forEach(d => { if(d.proje) projCount[d.proje] = (projCount[d.proje] || 0) + 1; });
  const topProject = Object.keys(projCount).sort((a,b) => projCount[b] - projCount[a])[0] || 'Kayıt Yok';

  const itemsHtml = weekData.map(a=>{
    const clickEvt = canEdit() ? `onclick="editActivity(${a.id})"` : '';
    return `
    <div class="act-item" ${clickEvt}>
      <span class="dot" style="background:${catColor(a.calisma)}"></span>
      <div style="flex:1;min-width:0"><div class="act-title">${esc(a.konu)}</div><div class="act-meta">${esc(a.tarih)} · ${esc(a.proje)}</div></div>
      <span class="badge ${badgeClass(a.durum)}">${badgeShort(a.durum)}</span>
    </div>`;
  }).join('');

  return `
    <div class="screen-header"><div><div class="screen-title">Kişisel Analiz</div><div class="screen-sub">${formatDateRange(start,end)} (Benim Verilerim)</div></div></div>
    
    <div style="display:flex; gap:10px; padding: 0 14px 14px;">
      <button class="action-btn" onclick="exportWeeklyText()" style="color:var(--purple);border-color:var(--purple);">Özeti Kopyala</button>
      <button class="action-btn" onclick="downloadExcel()" style="color:var(--green);border-color:var(--green);">${canViewOthers() ? 'Tüm Şirketi İndir' : 'Excel İndir'}</button>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num" style="color:var(--blue)">${weekData.length}</div><div class="stat-label">Toplam İş</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--green)">${done}</div><div class="stat-label">Biten</div></div>
    </div>

    <div class="card card-pad"><div class="form-lbl">Bu Hafta En Çok Odaklanılan Proje</div><div style="font-weight:800;font-size:15px">${esc(topProject)}</div></div>
    
    <div class="form-lbl" style="padding:0 14px">Haftanın Aksiyonları</div>
    <div class="card" style="padding:0">${itemsHtml||'<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Kayıt bulunamadı</div>'}</div>`;
}

function renderCalendar(){
  const myData = getMyData();
  const total=myData.length, done=myData.filter(d=>d.durum==='Tamamlandı').length;
  const pct=total?Math.round(done/total*100):0;
  
  const pillsHtml=MONTHS.map(m=>{
    const s=monthStats(m);
    const col=s.pct===100?'#38A169':s.pct>50?'#3182CE':s.total>0?'#DD6B20':'#E2E8F0';
    return `<div class="month-pill" onclick="selectMonth('${m}')"><div class="month-icon">${m.slice(0,2)}</div><div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:5px"><span class="month-name">${m}</span><span style="font-size:11px;color:var(--muted)">${s.done}/${s.total}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${s.pct}%;background:${col}"></div></div></div><span class="month-pct">${s.pct}%</span></div>`;
  }).join('');

  return `<div class="screen-header"><div><div class="screen-title">Takvimim</div><div class="screen-sub">${total} toplam · ${done} tamamlandı</div></div></div>
    <div class="card card-pad" style="display:flex;justify-content:space-between;align-items:center">
      <div><div class="form-lbl">Yıllık Oran</div><div style="font-size:36px;font-weight:800;color:var(--blue)">${pct}%</div></div>
      <div style="width:80px;height:80px;border-radius:50%;background:conic-gradient(var(--blue) 0deg ${Math.round(pct*3.6)}deg, #E2E8F0 0deg);position:relative"><div style="position:absolute;inset:14px;border-radius:50%;background:var(--card)"></div></div>
    </div>${pillsHtml}`;
}

// ── YÖNETİCİ EKRANI (Ekip Sekmesi) ──
function renderTeam() {
  if(!canViewOthers()) return `<div class="screen-header"><div class="screen-title">Yetkisiz Erişim</div></div>`;

  const usersOptions = state.users.map(u => {
    const fullName = u.ad + ' ' + u.soyad;
    return `<option value="${fullName}" ${state.selectedTeamUser === fullName ? 'selected' : ''}>${fullName} (${u.rolIsim})</option>`;
  }).join('');

  const firstUser = state.users[0] ? (state.users[0].ad + ' ' + state.users[0].soyad) : '';
  const selectedFullName = state.selectedTeamUser || firstUser;
  if (!state.selectedTeamUser) state.selectedTeamUser = selectedFullName;

  const targetData = state.data.filter(d => d.ekleyen === selectedFullName).sort((a,b) => parseDate(b.tarih) - parseDate(a.tarih));
  const total = targetData.length;
  const done = targetData.filter(d => d.durum === 'Tamamlandı').length;
  const plan = targetData.filter(d => d.durum === 'Planlandı').length;
  const nope = targetData.filter(d => d.durum === 'Gerçekleşmedi').length;
  
  const itemsHtml = targetData.map(a => {
    const clickEvt = canEdit() ? `onclick="editActivity(${a.id})"` : '';
    return `
    <div class="act-item" ${clickEvt}>
      <span class="dot" style="background:${catColor(a.calisma)}"></span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between"><div class="act-title">${esc(a.konu)}</div><span class="badge ${badgeClass(a.durum)}">${badgeShort(a.durum)}</span></div>
        <div class="act-meta">${esc(a.tarih)} · ${esc(a.ay)} · ${esc(a.proje)}</div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="screen-header"><div><div class="screen-title">Ekip Takvimleri</div><div class="screen-sub">Diğer kullanıcıların verilerini görüntüleyin</div></div></div>
    
    <div class="form-g">
      <select class="form-sel" onchange="state.selectedTeamUser=this.value; render();" style="border-color:var(--blue); font-weight:700; color:var(--blue);">
        ${usersOptions}
      </select>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num" style="color:var(--blue)">${total}</div><div class="stat-label">Toplam İş</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--green)">${done}</div><div class="stat-label">Biten</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--orange)">${plan}</div><div class="stat-label">Planlı</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--red)">${nope}</div><div class="stat-label">İptal</div></div>
    </div>
    
    <div class="form-lbl" style="padding:0 14px">Kullanıcı Aktiviteleri</div>
    <div class="card" style="padding:0">${itemsHtml||'<div style="padding:30px;text-align:center;color:var(--muted);font-size:13px">Bu kullanıcıya ait kayıt bulunamadı</div>'}</div>
  `;
}

function renderAdd(){
  if(!canEdit()) return `<div class="screen-header"><div><div class="screen-title">Yetkisiz Erişim</div></div></div>`;

  const isEdit = !!state.editingId;
  const mIdx = MONTHS.indexOf(state.formData.ay);
  const currentYear = new Date().getFullYear();
  const minDate = `${currentYear}-${String(mIdx + 1).padStart(2, '0')}-01`;
  const maxDate = `${currentYear}-${String(mIdx + 1).padStart(2, '0')}-${new Date(currentYear, mIdx + 1, 0).getDate()}`;
  
  let statusField = '';
  if(isEdit) {
     statusField = `<div class="form-g"><label class="form-lbl">Durum</label><div class="status-btns">${['Planlandı','Tamamlandı','Gerçekleşmedi'].map(s=>`<button class="s-btn" onclick="setFormStatus('${s}')" style="border-color:${state.formData.durum===s?'var(--blue)':'var(--border)'};background:${state.formData.durum===s?'rgba(49,130,206,.1)':'var(--card)'};color:${state.formData.durum===s?'var(--blue)':'var(--muted)'}">${s}</button>`).join('')}</div></div>`;
  }

  const deleteButton = (isEdit && canDelete()) ? 
    `<button class="btn-primary btn-danger" onclick="deleteActivity()">Sil</button>` : '';

  return `<div class="screen-header">${isEdit?'<div class="back-btn" onclick="cancelEdit()">‹</div>':''}<div><div class="screen-title">${isEdit?'Düzenle':'Yeni Aktivite'}</div></div></div>
    <div class="form-g"><label class="form-lbl">Ay</label><select class="form-sel" onchange="handleMonthChange(this.value)">${MONTHS.map(m=>`<option value="${m}" ${state.formData.ay===m?'selected':''}>${m}</option>`).join('')}</select></div>
    <div class="form-g"><label class="form-lbl">Tarih</label><input type="date" class="form-inp" min="${minDate}" max="${maxDate}" value="${getIsoDate(state.formData.tarih)}" onchange="handleDateChange(this.value)"></div>
    <div class="form-g"><label class="form-lbl">Çalışma Türü</label><select class="form-sel" onchange="updateForm('calisma',this.value)">${state.cats.map(c=>`<option value="${c}" ${state.formData.calisma===c?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="form-g"><label class="form-lbl">Konu</label><textarea class="form-ta" rows="2" oninput="updateForm('konu',this.value)">${esc(state.formData.konu)}</textarea></div>
    <div class="form-g"><label class="form-lbl">Proje</label><input class="form-inp" value="${esc(state.formData.proje)}" oninput="updateForm('proje',this.value)"></div>
    <div class="form-g"><label class="form-lbl">Açıklama</label><textarea class="form-ta" rows="2" oninput="updateForm('aciklama',this.value)">${esc(state.formData.aciklama)}</textarea></div>
    ${statusField}
    <button class="btn-primary" onclick="submitForm()">${isEdit?'Güncelle':'Kaydet'}</button>
    ${deleteButton}`;
}

// ── Event & Form Handlers ─────────────────────────────────────────────────────
function switchTab(tab){
  if(tab === 'add' && !canEdit()) return; 
  if(tab === 'team' && !canViewOthers()) return;

  if(tab !== 'add' && state.editingId) { state.editingId=null; state.formData={ay:MONTHS[new Date().getMonth()],tarih:'',calisma:state.cats[0],konu:'',proje:'',durum:'Planlandı',aciklama:''}; }
  state.tab=tab;
  if(tab==='home'||tab==='list'||tab==='report') state.selectedMonth=null;
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  render();
}
function selectMonth(m){state.selectedMonth=m;render();}
function backFromMonth(){state.selectedMonth=null;render();}
function setFilter(f){state.filter=f;render();}
function setMonthFilter(m){state.filterMonth=m;render();}
function setSearch(v){state.search=v;render();const i=document.getElementById('search-inp');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}}
function updateForm(k,v){state.formData[k]=v;}
function handleMonthChange(v) {state.formData.ay=v; state.formData.tarih=''; render();}
function handleDateChange(v) {if(!v){state.formData.tarih='';return;} const p=v.split('-'); state.formData.tarih=`${p[2]}.${p[1]}.${p[0]}`;}
function setFormStatus(s){state.formData.durum=s;render();}

function editActivity(id) {
  if(!canEdit()) return;
  const item = state.data.find(d => d.id === id);
  if (item) { state.previousTab=state.tab; state.editingId=id; state.formData={...item}; switchTab('add'); }
}
function cancelEdit() { switchTab(state.previousTab||'list'); }

function deleteActivity() {
  if(!canDelete()) { showToast('Silme yetkiniz yok ❌'); return; }
  if(confirm('Silmek istediğinize emin misiniz?')) {
    state.data = state.data.filter(d => d.id !== state.editingId);
    saveData(); showToast('Silindi'); switchTab(state.previousTab||'list');
  }
}

function submitForm(){
  if(!canEdit()) return;
  const f=state.formData;
  if(!f.tarih||!f.konu.trim()||!f.proje.trim()){ showToast('Zorunlu alanları doldurun ⚠️');return; }
  
  const userNameSurname = (state.user?.ad || '') + ' ' + (state.user?.soyad || '');
  
  // Yöneticiler başkasının kaydını düzenliyorsa orijinal "Ekleyen" bilgisini koruruz, yoksa görevi çalmış olurlar.
  const itemEkleyen = f.ekleyen || userNameSurname; 

  if(state.editingId) {
    const idx = state.data.findIndex(d => d.id === state.editingId);
    if(idx>-1) state.data[idx] = {...f, id:state.editingId, ekleyen: itemEkleyen}; 
    saveData(); showToast('Güncellendi'); switchTab(state.previousTab||'list');
  } else {
    state.data.push({...f, id:state.nextId++, durum:'Planlandı', ekleyen: userNameSurname});
    saveData(); showToast('Kaydedildi ✓'); state.formData={ay:f.ay,tarih:'',calisma:state.cats[0],konu:'',proje:'',durum:'Planlandı',aciklama:''}; render();
  }
}

function generateWeeklyText() {
  const {start, end} = getWeekBoundaries();
  // Kişinin sadece kendi verisinden üretilir.
  const weekData = getMyData().filter(d => isDateInCurrentWeek(d.tarih)).sort((a,b) => parseDate(a.tarih) - parseDate(b.tarih));
  const done = weekData.filter(d => d.durum === 'Tamamlandı');
  const plan = weekData.filter(d => d.durum === 'Planlandı');
  
  let text = `📊 HAFTALIK ÇALIŞMA ÖZETİ (${formatDateRange(start, end)})\n\n`;
  text += `📈 Toplam: ${weekData.length} | ✅ Tamam: ${done.length} | ⏳ Bekleyen: ${plan.length}\n\n`;
  if(done.length>0){ text += `📌 BİTEN İŞLER:\n`; done.forEach(d => text += `- [${d.tarih}] ${d.proje}: ${d.konu}\n`); }
  if(plan.length>0){ text += `\n⏭️ PLANLANAN:\n`; plan.forEach(d => text += `-[${d.tarih}] ${d.proje}: ${d.konu}\n`); }
  return text;
}

function exportWeeklyText() { navigator.clipboard.writeText(generateWeeklyText()).then(()=>showToast('Özet kopyalandı 📋')).catch(()=>showToast('Kopyalama başarısız!')); }

function downloadExcel() {
  // Admin ve Yöneticiler Excel butonuna bastığında şirketteki tüm kayıtları indirir
  const exportData = canViewOthers() ? state.data : getMyData();
  
  if (exportData.length === 0) { showToast('Veri yok ⚠️'); return; }
  let csvContent = '\uFEFFAy;Tarih;Çalışma Türü;Konu;Proje / Lokasyon;Durum;Açıklama;Ekleyen\n';
  
  [...exportData].sort((a,b) => parseDate(a.tarih) - parseDate(b.tarih)).forEach(d => {
    csvContent += `${d.ay};${d.tarih};${d.calisma};${(d.konu||'').replace(/;/g,',')};${(d.proje||'').replace(/;/g,',')};${d.durum};${(d.aciklama||'').replace(/;/g,',')};${(d.ekleyen||'')}\n`;
  });
  const link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(new Blob([csvContent], {type: 'text/csv;charset=utf-8;'})));
  link.setAttribute("download", `Calisma_Takvimi_Verileri.csv`);
  document.body.appendChild(link); link.click(); link.remove();
}

// UI Helpers
let toastTimer;
function showToast(msg){
  document.querySelectorAll('.toast').forEach(el=>el.remove());
  const el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  document.getElementById('app').appendChild(el);
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.remove(),2800);
}

function updateClock(){
  const n=new Date(), h=String(n.getHours()).padStart(2,'0'), m=String(n.getMinutes()).padStart(2,'0');
  const el=document.getElementById('clock'); if(el) el.textContent=`${h}:${m}`;
  const dEl=document.getElementById('wd-date'), dyEl=document.getElementById('wd-day'), tEl=document.getElementById('wd-time');
  if(dEl) {
    dEl.textContent=`${n.getDate()} ${MONTHS[n.getMonth()]} ${n.getFullYear()}`;
    dyEl.textContent=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][n.getDay()];
    tEl.textContent=`${h}:${m}`;
  }
} setInterval(updateClock,1000); updateClock();

function updateOnline(){
  const bar=document.getElementById('offline-bar'), ico=document.getElementById('online-ico'), st=document.getElementById('sync-status');
  if(!bar) return;
  if(navigator.onLine){
    bar.style.display='none'; ico.style.color='#38A169';
    if(isCloudActive){ st.innerHTML='<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Bulut'; st.style.color='#38A169'; st.style.background='rgba(56,161,105,.15)'; }
  } else {
    bar.style.display='block'; ico.style.color='#E53E3E';
    st.innerHTML='Çevrimdışı'; st.style.color='#E53E3E'; st.style.background='rgba(229,62,62,.15)';
  }
}
window.addEventListener('online',updateOnline); window.addEventListener('offline',updateOnline); updateOnline();

// Init
loadData();

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('SW registered: ', reg.scope);
    }).catch(err => {
      console.log('SW registration failed: ', err);
    });
  });
}

window.handleAddCategory = function() {
  const nameInput = document.getElementById('newCatName');
  const colorInput = document.getElementById('newCatColor');
  const name = (nameInput.value || '').trim();
  const color = colorInput.value || '#3182CE';

  if(!name) { showToast('Lütfen bir isim girin ⚠️'); return; }
  if(state.cats.includes(name)) { showToast('Bu çalışma türü zaten var ⚠️'); return; }

  state.cats.push(name);
  state.catColors[name] = color;
  saveSettings();
  showToast('Çalışma türü eklendi ✓');
  render();
};

window.handleDeleteCategory = function(name) {
  if(!confirm(`"${name}" çalışma türünü silmek istediğinize emin misiniz? (Bu işlem eski kayıtları etkilemez)`)) return;
  
  state.cats = state.cats.filter(c => c !== name);
  delete state.catColors[name];
  
  if(state.formData.calisma === name) {
    state.formData.calisma = state.cats[0] || '';
  }

  saveSettings();
  showToast('Çalışma türü silindi ✓');
  render();
};

function renderDataPage() {
  return `
    <div class="h-row" style="margin-bottom:15px;">
      <h2>Çalışma Türleri (Data)</h2>
    </div>
    <div class="card" style="margin-bottom:20px;">
      <div style="font-size:14px; color:var(--muted); margin-bottom:15px;">
        Buradan yeni çalışma türleri ekleyebilir veya silebilirsiniz. Değişiklikler tüm takvim kullanıcılarını etkiler.
      </div>
      <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
        <input type="text" id="newCatName" class="form-sel" placeholder="Yeni Çalışma Türü Adı" style="flex:1; min-width:150px;">
        <input type="color" id="newCatColor" value="#3182CE" style="width:40px; height:40px; border:none; border-radius:4px; cursor:pointer; padding:0;">
        <button class="btn-primary" onclick="handleAddCategory()" style="margin:0;">Ekle</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${state.cats.map(c => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#f9f9f9; padding:10px; border-radius:6px; border-left:4px solid ${catColor(c)};">
            <span style="font-weight:600;">${esc(c)}</span>
            <button onclick="handleDeleteCategory('${esc(c)}')" style="background:transparent; border:none; color:var(--red); cursor:pointer; padding:5px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── AYARLAR (KULLANICI YÖNETİMİ) ──
function renderSettings() {
  if(state.user?.rol !== 'admin') {
    return `<div class="screen-header"><div><div class="screen-title">Yetkisiz Erişim</div></div></div>`;
  }

  const roles = ['Admin', 'Yönetici', 'Uzman', 'İzleyici'];

  const userCards = state.users.map(u => {
    const isMe = u.uid === state.user.uid;
    return `
      <div class="card" style="padding:15px; margin-bottom:15px; border-left:4px solid var(--purple);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
          <div>
            <div style="font-size:14px; font-weight:800; color:var(--text);">${esc(u.ad)} ${esc(u.soyad)} ${isMe ? '(Siz)' : ''}</div>
            <div style="font-size:11px; color:var(--muted);">${esc(u.uid)}</div>
          </div>
        </div>
        
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <div style="flex:1; min-width:140px;">
            <label class="form-lbl">Pozisyon / Yetki</label>
            <select class="form-sel" id="role-select-${u.uid}" ${isMe ? 'disabled' : ''}>
              ${roles.map(r => `<option value="${r}" ${u.rolIsim===r?'selected':''}>${r}</option>`).join('')}
            </select>
          </div>
          ${!isMe ? `
            <div style="display:flex; gap:5px; margin-top:16px;">
              <button class="btn-primary" style="margin:0; padding:10px 15px; border-radius:10px; width:auto;" onclick="handleUpdateUser('${u.uid}')">Kaydet</button>
              <button class="btn-danger" style="margin:0; padding:10px 15px; border-radius:10px; font-weight:800; cursor:pointer;" onclick="handleDeleteUser('${u.uid}', '${esc(u.ad)} ${esc(u.soyad)}')">Sil</button>
            </div>
          ` : `<div style="margin-top:16px; font-size:11px; color:var(--muted);">Kendi yetkinizi değiştiremezsiniz.</div>`}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="screen-header">
      <div>
        <div class="screen-title">Ayarlar</div>
        <div class="screen-sub">Kullanıcı Yönetimi</div>
      </div>
    </div>
    
    <div class="card" style="padding:15px; background:rgba(221, 107, 32, 0.1); border-color:var(--orange);">
      <div style="font-size:12px; color:var(--orange); font-weight:600;">
        ⚠️ Güvenlik nedeniyle şifre değişikliği yapılamamaktadır. Şifresini unutan bir kullanıcının erişimini yenilemek için onu silip yeniden kaydetmeniz gerekmektedir.
      </div>
    </div>

    <div style="padding:0 14px;">
      ${userCards}
    </div>
  `;
}

window.handleUpdateUser = function(uid) {
  const selectEl = document.getElementById(`role-select-${uid}`);
  if(!selectEl) return;
  
  const pozisyon = selectEl.value;
  const rol = (pozisyon==='Admin')?'admin':(pozisyon==='Yönetici')?'manager':(pozisyon==='Uzman')?'specialist':'viewer';

  dbRef.child('users').child(uid).update({ rol, rolIsim: pozisyon })
    .then(() => {
      showToast('Kullanıcı yetkisi güncellendi ✓');
    })
    .catch(e => {
      console.error(e);
      showToast('Güncelleme başarısız ❌');
    });
};

window.handleDeleteUser = function(uid, fullName) {
  if(!confirm(`"${fullName}" adlı kullanıcıyı tamamen silmek istediğinize emin misiniz? (Bu işlem geri alınamaz ve kullanıcının sisteme erişimi kesilir)`)) return;

  dbRef.child('users').child(uid).remove()
    .then(() => {
      showToast('Kullanıcı silindi ✓');
    })
    .catch(e => {
      console.error(e);
      showToast('Silme başarısız ❌');
    });
};
