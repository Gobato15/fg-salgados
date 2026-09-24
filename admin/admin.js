const ORDERS_KEY = 'fg_admin_orders';
const MOVEMENTS_KEY = 'fg_admin_movimentos';
const SITE_KEY = 'fg_salgados_v9';
const DEFAULT_PASSWORD = '1031';
const DEFAULT_EMAIL = 'gobato59@gmail.com';
const AUTH_VERSION = 3; // incrementado para resetar credenciais em todos os navegadores
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const INACTIVITY_MINUTES = 30;

const GITHUB_TOKEN_KEY = 'fg_github_token';
const GITHUB_PENDING_IMAGES_KEY = 'fg_github_pending_images';
const GITHUB_CONFIG_KEY = 'fg_github_config';


const STATUSES = {
    pendente: { label: 'Pendente', next: 'preparo' },
    preparo: { label: 'Em preparo', next: 'pronto' },
    pronto: { label: 'Pronto', next: 'entregue' },
    entregue: { label: 'Entregue', next: null }
};

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

/* ------------------------- API (backend) ------------------------- */

let LOCAL_MODE = false;

function isConnectionError(e) {
    return /Não foi possível conectar|API não configurada/i.test(String((e && e.message) || ''));
}

function localCheckLogin(email, pass) {
    const lock = readJSON('fg_admin_lock', {});
    if (lock.blockedUntil && Date.now() < lock.blockedUntil) {
        const mins = Math.ceil((lock.blockedUntil - Date.now()) / 60000);
        showLoginError(`Muitas tentativas. Tente novamente em ${mins} min.`);
        return false;
    }
    if (email.toLowerCase() === DEFAULT_EMAIL.toLowerCase() && pass === DEFAULT_PASSWORD) {
        localStorage.removeItem('fg_admin_lock');
        return true;
    }
    const attempts = (lock.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
        writeJSON('fg_admin_lock', { attempts: 0, blockedUntil: Date.now() + LOCK_MINUTES * 60000 });
        showLoginError(`Muitas tentativas. Bloqueado por ${LOCK_MINUTES} min.`);
    } else {
        writeJSON('fg_admin_lock', { attempts });
        showLoginError(`E-mail ou senha incorretos. (${attempts}/${MAX_ATTEMPTS})`);
    }
    return false;
}

function normalizeMenuItem(it) {
    return Object.assign({}, it, { desc: it.desc || it.description, active: it.active !== false });
}

function loadLocalItems(baseItems) {
    const base = (baseItems && baseItems.length ? baseItems : (window.fgMenuItems || []))
        .map(normalizeMenuItem);
    const saved = readJSON(SITE_KEY, {});
    if (saved.products) {
        Object.keys(saved.products).forEach(id => {
            const prod = base.find(p => String(p.id) === String(id));
            if (prod) Object.assign(prod, saved.products[id]);
            else base.push(Object.assign({ id, active: true, units: 1 }, saved.products[id]));
        });
    }
    const seen = new Set();
    return base.filter(it => {
        if (!it.image) return false;
        if (seen.has(String(it.id))) return false;
        seen.add(String(it.id));
        return true;
    });
}

function saveLocalProductMap(map) {
    const saved = readJSON(SITE_KEY, {});
    saved.products = map;
    writeJSON(SITE_KEY, saved);
}

function localProductMap() {
    const saved = readJSON(SITE_KEY, {});
    return saved.products || {};
}

function apiBase() {
    const cfg = window.FG_CONFIG || {};
    return String(cfg.pixApiUrl || '').trim().replace(/\/+$/, '');
}

async function apiReq(path, opts = {}) {
    const base = apiBase();
    if (!base) throw new Error('API não configurada. Defina FG_CONFIG.pixApiUrl em config.js.');
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const token = sessionStorage.getItem('fg_admin_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let res;
    try {
        res = await fetch(base + path, Object.assign({}, opts, { headers }));
    } catch (e) {
        throw new Error(`Não foi possível conectar à API em ${base}. Confira a URL em config.js e se o backend está no ar.`);
    }
    if (res.status === 401) {
        logout();
        const err = new Error('Sessão expirada. Entre novamente.');
        err.silent = true;
        throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erro ${res.status} na requisição.`);
    return data;
}

/* ------------------------- GitHub (banco de produtos) ------------------------- */

let REPO_MODE = false;

function gitHubRepoConfig() {
    const repo = (window.FG_CONFIG && window.FG_CONFIG.gitHubRepo) || {};
    if (!repo.owner || !repo.repo) return null;
    return Object.assign({
        owner: repo.owner,
        repo: repo.repo,
        branch: repo.branch || 'main'
    }, repo);
}

function gitHubFile() {
    const cfg = window.FG_CONFIG || {};
    return String(cfg.gitHubFile || 'data/products.json').replace(/^\//, '');
}

function ghToken() {
    try { return (localStorage.getItem(GITHUB_TOKEN_KEY) || '').trim(); } catch (e) { return ''; }
}

function ghApiBase() {
    const repo = gitHubRepoConfig();
    return repo ? `https://api.github.com/repos/${repo.owner}/${repo.repo}` : '';
}

async function ghApi(path, opts = {}) {
    const base = ghApiBase();
    if (!base) throw new Error('Repositório do GitHub não configurado em config.js.');
    const token = ghToken();
    if (!token) throw new Error('Token do GitHub não configurado. Cole o token na aba "Senha".');
    const headers = Object.assign({
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token
    }, opts.headers || {});
    const res = await fetch(base + path, Object.assign({}, opts, { headers }));
    if (res.status === 401 || res.status === 403) {
        throw new Error('Token do GitHub inválido ou sem permissão. Gere um fine-grained token com "Contents: Read and write".');
    }
    if (res.status === 404) return null;
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data && data.message ? `GitHub: ${data.message}` : `Erro ${res.status} no GitHub.`);
    }
    return res.json();
}

function decodeBase64Utf8(b64) {
    try {
        const bin = atob(b64 || '');
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        try { return decodeURIComponent(Array.prototype.map.call(atob(b64), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')); }
        catch (e2) { return ''; }
    }
}

async function ghFetchProductsFile() {
    const rawUrl = (window.FG_CONFIG && window.FG_CONFIG.gitHubRawMenu) || '';
    // Com token, usa a Contents API (dados sempre atualizados). Sem token, usa raw.
    if (ghToken()) {
        const data = await ghApi('/contents/' + encodeURIComponent(gitHubFile()) + '?ref=' + encodeURIComponent(gitHubRepoConfig().branch));
        if (!data || !data.content) return null;
        try {
            return JSON.parse(decodeBase64Utf8(data.content));
        } catch (e) {
            return null;
        }
    }
    if (rawUrl) {
        const res = await fetch(rawUrl);
        if (!res.ok) return null;
        return res.json().catch(() => null);
    }
    return null;
}

async function ghUploadImage(name, base64) {
    const data = await ghApi('/contents/' + encodeURIComponent('images/' + name), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `Imagem: ${name}`,
            content: base64,
            branch: gitHubRepoConfig().branch
        })
    });
    return 'images/' + name;
}

async function ghWriteProductsFile(content) {
    const path = gitHubFile();
    const existing = await ghApi('/contents/' + encodeURIComponent(path) + '?ref=' + encodeURIComponent(gitHubRepoConfig().branch));
    const body = {
        message: `Cardápio publicado em ${new Date().toLocaleString('pt-BR')}`,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: gitHubRepoConfig().branch
    };
    if (existing && existing.sha) body.sha = existing.sha;
    await ghApi('/contents/' + encodeURIComponent(path), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function slugify(str) {
    return String(str || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60) || 'produto';
}

function getPendingImages() {
    return readJSON(GITHUB_PENDING_IMAGES_KEY, {});
}

function setPendingImages(map) {
    writeJSON(GITHUB_PENDING_IMAGES_KEY, map || {});
}

// Coloca uma imagem (blob/arquivo) na fila de publicação do GitHub,
// otimizando para webp. Retorna o caminho images/<nome>.
async function queueImageBlob(blob, ct, nameHint) {
    let name;
    let finalBase64;
    if (ct === 'image/gif') {
        const reader = new FileReader();
        finalBase64 = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        name = `${slugify(nameHint)}_${Date.now()}.gif`;
    } else {
        const file = new File([blob], 'img', { type: ct });
        const opt = await optimizeImage(file);
        if (!opt || !opt.webp || !opt.base64) throw new Error('Não foi possível converter a imagem.');
        finalBase64 = opt.base64;
        name = `${slugify(nameHint)}-${Date.now()}.webp`;
    }
    const pending = getPendingImages();
    pending[name] = finalBase64;
    setPendingImages(pending);
    return 'images/' + name;
}

// Baixa uma imagem externa (https://...) e otimiza para webp, deixando-a
// na fila de publicação para ser enviada ao repositório em "Publicar no GitHub".
async function downloadExternalImage(url) {
    const nameHint = document.getElementById('pfName') ? document.getElementById('pfName').value.trim() : '';
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('Falha ao baixar (' + res.status + ').');
        const ct = res.headers.get('content-type') || '';
        if (!ct.startsWith('image/')) throw new Error('O link não aponta para uma imagem.');
        const blob = await res.blob();
        return await queueImageBlob(blob, ct, nameHint);
    } catch (e) {
        const msg = (e && e.message) || 'Erro';
        throw new Error('Não consegui baixar a imagem. ' + msg + ' Alguns servidores bloqueiam o download (CORS); nesse caso, use a imagem como link externo.');
    }
}

// Publica o cardápio atual no repositório: primeiro as imagens pendentes,
// depois o data/products.json.
async function publicarGitHub() {
    const repo = gitHubRepoConfig();
    if (!repo) return showToast('⚠️ Repositório não configurado em config.js.');
    if (!ghToken()) return showToast('⚠️ Configure o token do GitHub na aba "Senha".');
    const btn = document.getElementById('btnPublicarGitHub');
    if (btn) { btn.disabled = true; const orig = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-1"></i> Publicando…'; }

    try {
        const items = await getMenuItems();
        const pending = getPendingImages();
        const pendingNames = Object.keys(pending);

        // 1) Envia as imagens pendentes
        for (let i = 0; i < pendingNames.length; i++) {
            const name = pendingNames[i];
            const url = await ghUploadImage(name, pending[name]);
            // Se algum produto já referenciar images/<name>, está resolvido.
            items.forEach(p => { if (p.image && p.image.indexOf('images/' + name) !== -1) p.image = url; });
        }

        // 2) Gera o products.json e publica
        const payload = {
            ok: true,
            updatedAt: new Date().toISOString(),
            items: items.map(p => ({
                id: p.id,
                name: p.name,
                category: p.category || 'fritos',
                price: parseFloat(p.price) || 0,
                units: parseInt(p.units, 10) || 1,
                desc: p.desc || p.description || '',
                image: (p.image || '').replace(/^\.\.\//, ''),
                active: p.active !== false,
                ordem: items.indexOf(p)
            }))
        };
        const content = JSON.stringify(payload, null, 2);
        await ghWriteProductsFile(content);

        // 3) Limpa imagens pendentes e edições locais já publicadas,
        // fazendo do products.json (repo) a fonte oficial.
        setPendingImages({});
        const saved = readJSON(SITE_KEY, {});
        if (saved.products) { saved.products = {}; writeJSON(SITE_KEY, saved); }
        itemsLoaded = false;
        await refreshProducts();

        const updated = document.getElementById('ghLastPublished');
        if (updated) updated.textContent = new Date().toLocaleString('pt-BR');
        showToast('✅ Cardápio publicado no GitHub!');
    } catch (e) {
        showToast('⚠️ ' + (e && e.message ? e.message : 'Falha ao publicar.'));
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-brands fa-github me-1"></i> Publicar no GitHub'; }
    }
}

function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-custom';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

function showLoginError(message) {
    const el = document.getElementById('loginError');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('d-none');
}

async function tryLogin() {
    const inputPass = document.getElementById('loginPass');
    const inputEmail = document.getElementById('loginEmail');
    const pass = inputPass ? inputPass.value : '';
    const email = inputEmail ? inputEmail.value.trim() : '';
    if (!pass || !email) {
        showLoginError('Por favor, informe o e-mail e a senha.');
        return;
    }
    try {
        const data = await apiReq('/admin/login', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
        sessionStorage.setItem('fg_admin_token', data.token);
        sessionStorage.setItem('fg_admin_logged', '1');
        LOCAL_MODE = false;
        localStorage.removeItem('fg_admin_lock');
        if (inputPass) inputPass.value = '';
        showPanel();
    } catch (e) {
        if (e.silent) return;
        if (isConnectionError(e)) {
            LOCAL_MODE = true;
            if (localCheckLogin(email, pass)) {
                sessionStorage.setItem('fg_admin_token', 'local');
                sessionStorage.setItem('fg_admin_logged', '1');
                if (inputPass) inputPass.value = '';
                showPanel();
            }
            return;
        }
        showLoginError(e.message);
    }
}

function logout() {
    sessionStorage.removeItem('fg_admin_token');
    sessionStorage.removeItem('fg_admin_logged');
    location.reload();
}

function showPanel() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('panelScreen').classList.remove('d-none');
    refreshGithubTokenUI();
    refreshProducts();
    renderOrders();
    renderMovements();
    startInactivityWatch();
    checkDbHealth();
}

// Verifica a fonte do banco (GitHub products.json) e mostra badge no header
async function checkDbHealth() {
    const badge = document.getElementById('dbStatusBadge');
    if (!badge) return;
    try {
        if (gitHubRepoConfig()) {
            if (ghToken()) {
                const remote = await ghFetchProductsFile();
                const qtd = remote && Array.isArray(remote.items) ? remote.items.length : 0;
                badge.className = 'badge bg-success rounded-pill ms-2';
                badge.innerHTML = `<i class="fa-brands fa-github me-1"></i>GitHub • ${qtd} produtos`;
                badge.title = 'Cardápio publicado no repositório ' + gitHubRepoConfig().owner + '/' + gitHubRepoConfig().repo;
            } else {
                badge.className = 'badge bg-warning text-dark rounded-pill ms-2';
                badge.innerHTML = '<i class="fa-brands fa-github me-1"></i>GitHub • sem token';
                badge.title = 'Configure o token na aba "Senha" para publicar o cardápio.';
            }
            return;
        }
        const data = await apiReq('/admin/db-health');
        badge.className = 'badge bg-success rounded-pill ms-2';
        badge.innerHTML = `<i class="fa-solid fa-database me-1"></i>MySQL • ${data.produtos} produtos`;
        badge.title = 'Conectado ao MySQL da Hostinger';
    } catch (e) {
        if (e.silent) return;
        if (isConnectionError(e)) {
            badge.className = 'badge bg-warning text-dark rounded-pill ms-2';
            badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i>Modo Local';
            badge.title = 'API offline — usando dados do navegador';
        } else {
            badge.className = 'badge bg-danger rounded-pill ms-2';
            badge.innerHTML = '<i class="fa-solid fa-xmark me-1"></i>Erro de Conexão';
            badge.title = e.message;
        }
    }
}

function startInactivityWatch() {
    const IDLE = INACTIVITY_MINUTES * 60 * 1000;
    let lastActivity = Date.now();
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }));
    setInterval(() => {
        if (Date.now() - lastActivity > IDLE) {
            logout();
        }
    }, 60000);
}

function switchTab(tab) {
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-section').forEach(s => {
        s.classList.toggle('d-none', s.id !== 'tab-' + tab);
    });
    if (tab === 'cardapio') refreshProducts();
    if (tab === 'cozinha') renderOrders();
    if (tab === 'movimentos') renderMovements();
}

document.querySelectorAll('.btn-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function formatBRL(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function esc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function fixImagePath(src) {
    if (!src) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(src) || src.startsWith('../')) return src;
    return '../' + src;
}

/* ---------------- EXPORTAR / PUBLICAR menuData.js ---------------- */

async function gerarConteudoMenuData() {
    const items = await getMenuItems();
    const linhas = items.map(p => {
        const obj = {
            id: p.id,
            name: p.name,
            category: p.category || 'pacotes',
            price: parseFloat(p.price) || 0,
            description: p.desc || p.description || '',
            image: (p.image || '').replace(/^\.\.\//, ''),
            units: parseInt(p.units) || 1
        };
        if (p.active === false) obj.active = false;

        const campos = Object.entries(obj).map(([k, v]) => {
            if (typeof v === 'string') return `        ${k}: ${JSON.stringify(v)}`;
            return `        ${k}: ${v}`;
        }).join(',\n');

        return `    {\n${campos}\n    }`;
    });

    return `const fgMenuItems = [\n${linhas.join(',\n')}\n]\n\nif (typeof window !== 'undefined') {\n    window.fgMenuItems = fgMenuItems;\n}\nif (typeof module !== 'undefined' && module.exports) {\n    module.exports = fgMenuItems;\n}\n`;
}

async function exportarMenuData() {
    let conteudo;
    try {
        conteudo = await gerarConteudoMenuData();
    } catch (e) {
        return showToast('⚠️ Erro ao gerar menuData: ' + e.message);
    }
    const blob = new Blob([conteudo], { type: 'text/javascript;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'menuData.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    const info = document.getElementById('exportInfo');
    if (info) {
        info.classList.remove('d-none');
        setTimeout(() => info.classList.add('d-none'), 8000);
    }
    showToast('menuData.js exportado! (Opção manual)');
}

/* ---------------- CARDÁPIO ---------------- */

let itemsCache = [];
let itemsLoaded = false;

async function getMenuItems() {
    if (!itemsLoaded) {
        // 1) Fonte principal: products.json publicado no GitHub
        if (gitHubRepoConfig()) {
            try {
                const remote = await ghFetchProductsFile();
                if (remote && Array.isArray(remote.items) && remote.items.length) {
                    itemsCache = loadLocalItems(remote.items.map(normalizeMenuItem));
                    itemsLoaded = true;
                    REPO_MODE = true;
                    return itemsCache;
                }
            } catch (e) { /* sem token/rede: segue para local */ }
        }

        // 2) Fallback: backend antigo (só em dev local), senão modo local
        if (LOCAL_MODE) {
            try {
                itemsCache = loadLocalItems();
            } catch (e) {
                itemsCache = loadLocalItems();
            }
            itemsLoaded = true;
            return itemsCache;
        }
        try {
            const data = await apiReq('/admin/products');
            itemsCache = data.items || [];
        } catch (e) {
            if (e.silent) throw e;
            if (isConnectionError(e)) {
                LOCAL_MODE = true;
                itemsCache = loadLocalItems();
            } else {
                throw e;
            }
        }
        itemsLoaded = true;
    }
    return itemsCache;
}

async function refreshProducts() {
    itemsLoaded = false;
    try {
        await getMenuItems();
    } catch (e) {
        if (!e.silent) showToast('⚠️ ' + e.message);
    }
    renderProducts();
}

function renderProducts() {
    const tbody = document.getElementById('productTable');
    if (!tbody) return;
    if (!itemsLoaded) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Carregando produtos…</td></tr>';
        return;
    }
    const items = itemsCache;
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nenhum produto cadastrado.</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(p => `
        <tr>
            <td>
                <div class="d-flex align-items-center gap-2">
                    ${p.image ? `<img src="${esc(fixImagePath(p.image))}" class="product-thumb" alt="${esc(p.name)}">` : '<div class="product-thumb bg-light d-flex align-items-center justify-content-center text-muted"><i class="fa-solid fa-image"></i></div>'}
                    <div>
                        <div class="fw-bold">${esc(p.name)}</div>
                        <div class="small text-muted">${esc(p.desc || '')}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge text-bg-light border text-dark">${esc(p.category || '-')}</span></td>
            <td class="fw-bold">${formatBRL(p.price)}</td>
            <td>${esc(p.units || 1)}</td>
            <td>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" ${p.active !== false ? 'checked' : ''} onchange="toggleActive('${esc(p.id)}', this.checked)">
                </div>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-light border rounded-pill" onclick="openProductForm('${esc(p.id)}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-light border rounded-pill text-danger" onclick="deleteProduct('${esc(p.id)}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function toggleActive(id, active) {
    const p = itemsCache.find(x => String(x.id) === String(id));
    if (!p) return;
    p.active = !!active;

    if (LOCAL_MODE) {
        const saved = readJSON(SITE_KEY, {});
        saved.products = saved.products || {};
        saved.products[String(id)] = Object.assign({}, p, { active: p.active });
        writeJSON(SITE_KEY, saved);
        renderProducts();
        showToast(active ? 'Produto ativado!' : 'Produto desativado (oculto do site)');
        return;
    }

    try {
        await apiReq('/admin/products', { method: 'POST', body: JSON.stringify(Object.assign({}, p, { active: !!active })) });
        showToast(active ? 'Produto ativado!' : 'Produto desativado (oculto do site)');
    } catch (e) {
        if (e.silent) return;
        if (isConnectionError(e)) {
            LOCAL_MODE = true;
            const saved = readJSON(SITE_KEY, {});
            saved.products = saved.products || {};
            saved.products[String(id)] = Object.assign({}, p, { active: p.active });
            writeJSON(SITE_KEY, saved);
            renderProducts();
            showToast(active ? 'Produto ativado! (local)' : 'Produto desativado! (local)');
            return;
        }
        showToast('⚠️ ' + e.message);
        renderProducts();
    }
}

async function deleteProduct(id) {
    const p = itemsCache.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`Excluir "${p.name}"?`)) return;

    if (LOCAL_MODE) {
        try {
            const saved = readJSON(SITE_KEY, {});
            if (saved.products) delete saved.products[String(id)];
            writeJSON(SITE_KEY, saved);
            await refreshProducts();
            showToast('Produto excluído!');
        } catch (e) {
            if (!e.silent) showToast('⚠️ ' + e.message);
        }
        return;
    }

    try {
        await apiReq('/admin/products/' + encodeURIComponent(id), { method: 'DELETE' });
        await refreshProducts();
        showToast('Produto excluído!');
    } catch (e) {
        if (e.silent) return;
        if (e.message && /Não foi possível|não foi possível conectar|API/i.test(e.message)) {
            LOCAL_MODE = true;
            showToast('⚠️ API indisponível — ativando modo local.');
            await refreshProducts();
        } else {
            showToast('⚠️ ' + e.message);
        }
    }
}

async function openProductForm(id) {
    let items;
    try {
        items = await getMenuItems();
    } catch (e) {
        if (e.silent) return;
        return showToast('⚠️ ' + e.message);
    }
    const p = id ? items.find(x => x.id === id) : null;
    const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
    if (!categories.includes('fritos')) categories.unshift('fritos');
    if (!categories.includes('assados')) categories.unshift('assados');
    const catOptions = categories.map(c =>
        `<option value="${esc(c)}" ${p && p.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
    const previewSrc = p && p.image ? esc(fixImagePath(p.image)) : '';

    const wrap = document.getElementById('productFormWrap');
    wrap.classList.remove('d-none');
    wrap.innerHTML = `
        <h6 class="fw-bold mb-3">${p ? 'Editar Produto' : 'Novo Produto'}</h6>
        <div class="row g-3">
            <div class="col-md-6">
                <label class="form-label small fw-bold text-muted text-uppercase">Nome</label>
                <input type="text" id="pfName" class="form-control rounded-3" value="${p ? esc(p.name) : ''}">
            </div>
            <div class="col-md-3">
                <label class="form-label small fw-bold text-muted text-uppercase">Categoria</label>
                <select id="pfCategory" class="form-select rounded-3">${catOptions}</select>
            </div>
            <div class="col-md-3">
                <label class="form-label small fw-bold text-muted text-uppercase">Preço (R$)</label>
                <input type="number" step="0.01" min="0" id="pfPrice" class="form-control rounded-3" value="${p ? p.price : ''}">
            </div>
            <div class="col-md-3">
                <label class="form-label small fw-bold text-muted text-uppercase">Unidades</label>
                <input type="number" min="1" id="pfUnits" class="form-control rounded-3" value="${p ? (p.units || 1) : 1}">
            </div>
            <div class="col-md-9">
                <label class="form-label small fw-bold text-muted text-uppercase">Descrição</label>
                <input type="text" id="pfDesc" class="form-control rounded-3" value="${p ? esc(p.desc || '') : ''}">
            </div>
            <div class="col-md-6">
                <label class="form-label small fw-bold text-muted text-uppercase">Imagem (URL externa ou local)</label>
                <div class="input-group">
                    <input type="text" id="pfImage" class="form-control rounded-start-3" value="${p ? esc(p.image || '') : ''}" placeholder="https://site.com/foto.webp ou ./images/produto.webp" oninput="updatePfPreview(this.value)">
                    <button class="btn btn-outline-warning" type="button" title="Baixar a imagem para o repositório do site" onclick="baixarImagemClick()"><i class="fa-solid fa-download me-1"></i>Baixar p/ o site</button>
                </div>
                <small class="text-muted">Cole o link de uma imagem da internet <b>ou</b> clique em "Baixar p/ o site" para copiá-la para o cardápio (foto publicada no repositório). Também pode usar as fotos do cardápio abaixo.</small>
            </div>
            <div class="col-md-6">
                <label class="form-label small fw-bold text-muted text-uppercase">Fotos do cardápio (webp)</label>
                <select id="pfImageSelect" class="form-select rounded-3" onchange="selectPfImage(this.value)">
                    <option value="">— Escolher foto existente —</option>
                    <option value="images/x_carne.webp">X Carne</option>
                    <option value="images/x_picanha.webp">X Picanha</option>
                    <option value="images/duplo_cheddar.webp">Duplo Cheddar</option>
                    <option value="images/coxinha_premium.webp">Coxinha de Frango</option>
                    <option value="images/croissant_presunto_queijo_premium.webp">Croissant Presunto e Queijo</option>
                    <option value="images/lanche_natural_frango.webp">Lanche Natural de Frango</option>
                    <option value="images/bauru_queijo_presunto.webp">Bauru Presunto e Queijo</option>
                    <option value="images/fg_xbacon.webp">X Bacon</option>
                    <option value="images/x_ags_premium.webp">X AGS</option>
                </select>
                <small class="text-muted">Atualize a foto e clique em Salvar.</small>
            </div>
            <div class="col-md-6">
                <label class="form-label small fw-bold text-muted text-uppercase">Enviar foto do dispositivo</label>
                <input type="file" id="pfFile" accept="image/webp,image/png,image/jpeg,image/gif" class="form-control rounded-3" onchange="previewProductImage(this)">
                <small class="text-muted">Foto otimizada e enviada para o repositório do site na publicação.</small>
            </div>
            <div class="col-12 ${previewSrc ? '' : 'd-none'}" id="pfPreviewWrap">
                <label class="form-label small fw-bold text-muted text-uppercase">Pré-visualização</label>
                <div>
                    <img id="pfPreview" src="${previewSrc}" alt="Pré-visualização" class="img-thumbnail" style="max-height: 160px; max-width: 220px; object-fit: cover;" onerror="this.onerror=null;this.src='https://via.placeholder.com/300x200?text=Imagem+Indisponivel'">
                </div>
            </div>
            <div class="col-12 d-flex gap-2">
                <button class="btn btn-amber rounded-pill px-4 fw-bold" onclick="saveProductForm('${p ? esc(p.id) : ''}')"><i class="fa-solid fa-check me-1"></i> Salvar</button>
                <button class="btn btn-light rounded-pill px-4 fw-bold border" onclick="document.getElementById('productFormWrap').classList.add('d-none')">Cancelar</button>
            </div>
        </div>
    `;
}

function updatePfPreview(url) {
    const img = document.getElementById('pfPreview');
    const wrap = document.getElementById('pfPreviewWrap');
    if (!img || !wrap) return;
    const v = String(url || '').trim();
    if (v) {
        img.onerror = null;
        img.src = v;
        wrap.classList.remove('d-none');
    } else {
        wrap.classList.add('d-none');
    }
}

async function baixarImagemClick() {
    const input = document.getElementById('pfImage');
    if (!input) return;
    const url = String(input.value || '').trim();
    if (!url) return showToast('⚠️ Cole a URL da imagem no campo acima primeiro.');
    if (!/^https?:\/\//i.test(url)) return showToast('⚠️ Use uma URL externa (https://...) de imagem.');
    input.disabled = true;
    try {
        const path = await downloadExternalImage(url);
        input.value = path;
        updatePfPreview(path);
        showToast('✅ Imagem baixada e otimizada! Ela será publicada no repositório ao clicar em "Publicar no GitHub".');
    } catch (e) {
        showToast('⚠️ ' + (e && e.message ? e.message : 'Falha ao baixar a imagem.'));
    } finally {
        input.disabled = false;
    }
}

function selectPfImage(value) {
    const input = document.getElementById('pfImage');
    if (!input) return;
    input.value = String(value || '').trim();
    updatePfPreview(input.value);
}

function previewProductImage(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const img = document.getElementById('pfPreview');
    const wrap = document.getElementById('pfPreviewWrap');
    if (img && wrap) {
        img.src = URL.createObjectURL(file);
        wrap.classList.remove('d-none');
    }
}

function mimeFromName(name) {
    const ext = String(name || '').split('.').pop().toLowerCase();
    return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/webp';
}

function optimizeImage(file, maxSize = 1000) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            reject(new Error('Arquivo selecionado não é uma imagem.'));
            return;
        }
        if (file.type === 'image/gif') {
            resolve({ webp: false });
            return;
        }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            try {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const w = Math.max(1, Math.round(img.width * scale));
                const h = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/webp', 0.82);
                URL.revokeObjectURL(url);
                resolve({ webp: true, base64: dataUrl.split(',')[1] || '' });
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(new Error('Falha ao otimizar a imagem.'));
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Imagem inválida ou corrompida.'));
        };
        img.src = url;
    });
}

async function uploadImage(file) {
    const base = apiBase();
    if (!base) throw new Error('API não configurada. Defina FG_CONFIG.pixApiUrl em config.js.');
    const token = sessionStorage.getItem('fg_admin_token');

    let body = file;
    let contentType = file.type || mimeFromName(file.name);
    if (contentType !== 'image/gif') {
        try {
            const opt = await optimizeImage(file);
            if (opt && opt.webp) {
                const bin = atob(opt.base64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                body = new Blob([bytes], { type: 'image/webp' });
                contentType = 'image/webp';
            }
        } catch (e) { /* não otimizável: envia o arquivo original */ }
    }

    const headers = { 'Content-Type': contentType };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let res;
    try {
        res = await fetch(base + '/admin/upload', { method: 'POST', headers, body: body });
    } catch (e) {
        throw new Error(`Não foi possível conectar à API em ${base}. Confira a URL em config.js e se o backend está no ar.`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Falha no upload da imagem.');
    return data.url;
}

async function saveProductForm(id) {
    const name = document.getElementById('pfName').value.trim();
    const price = parseFloat(document.getElementById('pfPrice').value);
    if (!name || isNaN(price) || price <= 0) return showToast('Informe nome e preço válidos!');

    let image = document.getElementById('pfImage').value.trim();
    const fileInput = document.getElementById('pfFile');
    const file = fileInput && fileInput.files && fileInput.files[0];

    if (file) {
        try {
            showToast('Otimizando imagem…');
            image = await queueImageBlob(file, file.type || mimeFromName(file.name), name);
        } catch (e) {
            showToast('⚠️ ' + (e && e.message ? e.message : 'Falha ao processar a imagem.'));
            return;
        }
    }
    if (!image) return showToast('Informe uma imagem (URL ou upload)!');

    const existing = id ? itemsCache.find(x => x.id === id) : null;
    const pid = id || '';
    const payload = {
        id: pid,
        name: name,
        category: document.getElementById('pfCategory').value,
        price: price,
        units: parseInt(document.getElementById('pfUnits').value) || 1,
        desc: document.getElementById('pfDesc').value.trim(),
        image: image,
        active: existing ? existing.active !== false : true
    };

    try {
        if (LOCAL_MODE) {
            const saved = readJSON(SITE_KEY, {});
            saved.products = saved.products || {};
            const nid = id || 'p' + Date.now();
            payload.id = nid;
            saved.products[String(nid)] = payload;
            writeJSON(SITE_KEY, saved);

            const idx = itemsCache.findIndex(x => String(x.id) === String(nid));
            if (idx >= 0) itemsCache[idx] = payload;
            else itemsCache.push(payload);

            document.getElementById('productFormWrap').classList.add('d-none');
            showToast('Cardápio salvo localmente!');
            renderProducts();
            return;
        }
        await apiReq('/admin/products', { method: 'POST', body: JSON.stringify(payload) });
        await refreshProducts();
        document.getElementById('productFormWrap').classList.add('d-none');
        showToast('Cardápio atualizado!');
    } catch (e) {
        if (e.silent) return;
        if (isConnectionError(e)) {
            LOCAL_MODE = true;
            const saved = readJSON(SITE_KEY, {});
            saved.products = saved.products || {};
            const nid = id || 'p' + Date.now();
            payload.id = nid;
            saved.products[String(nid)] = payload;
            writeJSON(SITE_KEY, saved);

            const idx = itemsCache.findIndex(x => String(x.id) === String(nid));
            if (idx >= 0) itemsCache[idx] = payload;
            else itemsCache.push(payload);

            document.getElementById('productFormWrap').classList.add('d-none');
            showToast('Cardápio salvo!');
            renderProducts();
            return;
        }
        showToast('⚠️ ' + e.message);
    }
}

function salvarGitHubToken() {
    const input = document.getElementById('ghTokenInput');
    const token = input ? String(input.value || '').trim() : '';
    if (!token) return showToast('⚠️ Cole o token do GitHub.');
    localStorage.setItem(GITHUB_TOKEN_KEY, token);
    refreshGithubTokenUI();
    showToast('✅ Token salvo no navegador!');
}

function limparGitHubToken() {
    localStorage.removeItem(GITHUB_TOKEN_KEY);
    refreshGithubTokenUI();
    showToast('Token do GitHub removido.');
}

function refreshGithubTokenUI() {
    const input = document.getElementById('ghTokenInput');
    const ok = document.getElementById('ghTokenOk');
    const no = document.getElementById('ghNoToken');
    const has = !!ghToken();
    if (input) input.value = has ? '************' : '';
    if (ok) ok.classList.toggle('d-none', !has);
    if (no) no.classList.toggle('d-none', has);
}

/* ---------------- COZINHA ---------------- */

function getOrders() {
    return readJSON(ORDERS_KEY, []);
}

function saveOrders(orders) {
    writeJSON(ORDERS_KEY, orders);
}

function renderOrders() {
    const activeFilter = document.querySelector('#statusFilter .btn-filter.active');
    const filter = activeFilter ? activeFilter.dataset.status : 'todos';
    const orders = getOrders().sort((a, b) => (b.numero || 0) - (a.numero || 0));
    const list = document.getElementById('orderList');

    const filtered = filter === 'todos' ? orders : orders.filter(o => o.status === filter);
    if (filtered.length === 0) {
        list.innerHTML = '<div class="col-12 text-center text-muted py-5 bg-white rounded-4">Nenhum pedido neste filtro.</div>';
        return;
    }
    list.innerHTML = filtered.map(o => {
        const st = STATUSES[o.status] || STATUSES.pendente;
        const next = st.next;
        const statusOptions = Object.keys(STATUSES).map(k =>
            `<option value="${k}" ${o.status === k ? 'selected' : ''}>${STATUSES[k].label}</option>`).join('');
        return `
            <div class="col-md-6 col-xl-4">
                <div class="order-card">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold">Pedido #${esc(o.numero)}</span>
                        <span class="status-badge status-${esc(o.status)}">${esc(st.label)}</span>
                    </div>
                    <div class="small text-muted mb-2">${formatDate(o.data)}</div>
                    <p class="mb-1"><i class="fa-solid fa-user me-1"></i> <strong>${esc(o.cliente)}</strong> ${o.telefone ? '· ' + esc(o.telefone) : ''}</p>
                    <p class="mb-1 small"><i class="fa-solid fa-box me-1"></i> ${esc(o.itens)}</p>
                    <p class="mb-1 small"><i class="fa-solid fa-location-dot me-1"></i> ${o.modo === 'entrega' ? (esc(o.endereco) || 'Entrega') : 'Retirada no local'}</p>
                    <p class="mb-2 small"><i class="fa-solid fa-money-bill-wave me-1"></i> ${esc(o.pagamento) || '-'} · <strong>${formatBRL(o.total)}</strong></p>
                    <div class="d-flex gap-2 align-items-center">
                        <select class="form-select form-select-sm status-select flex-grow-1" onchange="setOrderStatus('${esc(o.id)}', this.value)">${statusOptions}</select>
                        <button class="btn btn-sm btn-light border rounded-pill text-danger" onclick="deleteOrder('${esc(o.id)}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    ${next ? `<button class="btn btn-sm btn-amber rounded-pill w-100 mt-2 fw-bold" onclick="nextOrderStatus('${esc(o.id)}')">Avancar para: ${esc(STATUSES[next].label)}</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function openOrderForm() {
    const wrap = document.getElementById('orderFormWrap');
    wrap.classList.remove('d-none');
    wrap.innerHTML = `
        <h6 class="fw-bold mb-3">Novo Pedido</h6>
        <div class="row g-3">
            <div class="col-md-6">
                <label class="form-label small fw-bold text-muted text-uppercase">Cliente</label>
                <input type="text" id="ofCliente" class="form-control rounded-3">
            </div>
            <div class="col-md-6">
                <label class="form-label small fw-bold text-muted text-uppercase">Telefone</label>
                <input type="text" id="ofTelefone" class="form-control rounded-3">
            </div>
            <div class="col-12">
                <label class="form-label small fw-bold text-muted text-uppercase">Itens (ex.: 2x Coxinha; 1x Torta)</label>
                <textarea id="ofItens" class="form-control rounded-3" rows="2"></textarea>
            </div>
            <div class="col-md-4">
                <label class="form-label small fw-bold text-muted text-uppercase">Total (R$)</label>
                <input type="number" step="0.01" min="0" id="ofTotal" class="form-control rounded-3">
            </div>
            <div class="col-md-4">
                <label class="form-label small fw-bold text-muted text-uppercase">Modo</label>
                <select id="ofModo" class="form-select rounded-3">
                    <option value="retirada">Retirada</option>
                    <option value="entrega">Entrega</option>
                </select>
            </div>
            <div class="col-md-4">
                <label class="form-label small fw-bold text-muted text-uppercase">Pagamento</label>
                <select id="ofPagamento" class="form-select rounded-3">
                    <option value="PIX">PIX</option>
                    <option value="No local">No local</option>
                </select>
            </div>
            <div class="col-12">
                <label class="form-label small fw-bold text-muted text-uppercase">Endereço (se entrega)</label>
                <input type="text" id="ofEndereco" class="form-control rounded-3">
            </div>
            <div class="col-12 d-flex gap-2">
                <button class="btn btn-amber rounded-pill px-4 fw-bold" onclick="saveOrderForm()"><i class="fa-solid fa-check me-1"></i> Registrar</button>
                <button class="btn btn-light rounded-pill px-4 fw-bold border" onclick="document.getElementById('orderFormWrap').classList.add('d-none')">Cancelar</button>
            </div>
        </div>
    `;
}

function saveOrderForm() {
    const cliente = document.getElementById('ofCliente').value.trim();
    if (!cliente) return showToast('Informe o nome do cliente!');
    const orders = getOrders();
    const maxNum = orders.reduce((m, o) => Math.max(m, o.numero || 0), 0);
    const order = {
        id: 'o' + Date.now(),
        numero: maxNum + 1,
        cliente: cliente,
        telefone: document.getElementById('ofTelefone').value.trim(),
        itens: document.getElementById('ofItens').value.trim() || '-',
        total: parseFloat(document.getElementById('ofTotal').value) || 0,
        modo: document.getElementById('ofModo').value,
        pagamento: document.getElementById('ofPagamento').value,
        endereco: document.getElementById('ofEndereco').value.trim(),
        status: 'pendente',
        data: new Date().toISOString()
    };
    orders.push(order);
    saveOrders(orders);
    renderOrders();
    document.getElementById('orderFormWrap').classList.add('d-none');
    showToast(`Pedido #${order.numero} registrado!`);
}

function setOrderStatus(id, status) {
    const orders = getOrders();
    const o = orders.find(x => x.id === id);
    if (o) {
        o.status = status;
        saveOrders(orders);
        renderOrders();
        showToast(`Pedido #${o.numero}: ${STATUSES[status].label}`);
    }
}

function nextOrderStatus(id) {
    const orders = getOrders();
    const o = orders.find(x => x.id === id);
    if (o && STATUSES[o.status].next) {
        o.status = STATUSES[o.status].next;
        saveOrders(orders);
        renderOrders();
        showToast(`Pedido #${o.numero}: ${STATUSES[o.status].label}`);
    }
}

function deleteOrder(id) {
    const orders = getOrders();
    const o = orders.find(x => x.id === id);
    if (!o) return;
    if (!confirm(`Excluir pedido #${o.numero}?`)) return;
    saveOrders(orders.filter(x => x.id !== id));
    renderOrders();
    showToast('Pedido excluído!');
}

document.querySelectorAll('#statusFilter .btn-filter').forEach(btn => {
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
    btn.addEventListener('click', () => {
        document.querySelectorAll('#statusFilter .btn-filter').forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        renderOrders();
    });
});

/* ---------------- MOVIMENTOS ---------------- */

function getMovements() {
    return readJSON(MOVEMENTS_KEY, []);
}

function saveMovements(list) {
    writeJSON(MOVEMENTS_KEY, list);
}

function renderMovements() {
    const movements = getMovements().slice().sort((a, b) => new Date(b.data) - new Date(a.data));
    const tbody = document.getElementById('movementTable');
    if (movements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nenhum movimento registrado.</td></tr>';
    } else {
        tbody.innerHTML = movements.slice(0, 100).map(m => `
            <tr>
                <td class="small text-nowrap">${formatDate(m.data)}</td>
                <td class="small fw-semibold">${esc(m.produto)}</td>
                <td><span class="badge ${m.tipo === 'entrada' ? 'text-bg-success' : 'text-bg-danger'}">${esc(m.tipo)}</span></td>
                <td class="fw-bold">${m.quantidade}</td>
                <td class="small text-muted">${esc(m.obs) || '-'}</td>
                <td class="text-end"><button class="btn btn-sm btn-light border text-danger" onclick="deleteMovement('${esc(m.id)}')"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `).join('');
    }

    const balance = {};
    getMovements().forEach(m => {
        balance[m.produto] = balance[m.produto] || 0;
        balance[m.produto] += m.tipo === 'entrada' ? m.quantidade : -m.quantidade;
    });
    const balanceBody = document.getElementById('balanceTable');
    const keys = Object.keys(balance);
    if (keys.length === 0) {
        balanceBody.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3">Sem saldo registrado.</td></tr>';
    } else {
        balanceBody.innerHTML = keys.map(k => `
            <tr>
                <td>${esc(k)}</td>
                <td class="text-end fw-bold ${balance[k] < 0 ? 'text-danger' : 'text-success'}">${balance[k]}</td>
            </tr>
        `).join('');
    }
}

async function openMovementForm() {
    let items;
    try {
        items = await getMenuItems();
    } catch (e) {
        if (e.silent) return;
        return showToast('⚠️ ' + e.message);
    }
    const active = items.filter(i => i.active !== false);
    const options = active.map(i => `<option value="${esc(i.name)}">${esc(i.name)}</option>`).join('');
    const wrap = document.getElementById('movementFormWrap');
    wrap.classList.remove('d-none');
    wrap.innerHTML = `
        <h6 class="fw-bold mb-3">Registrar Movimento</h6>
        <div class="row g-3">
            <div class="col-md-4">
                <label class="form-label small fw-bold text-muted text-uppercase">Produto</label>
                <select id="mfProduto" class="form-select rounded-3">${options || '<option>-</option>'}</select>
            </div>
            <div class="col-md-3">
                <label class="form-label small fw-bold text-muted text-uppercase">Tipo</label>
                <select id="mfTipo" class="form-select rounded-3">
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                </select>
            </div>
            <div class="col-md-2">
                <label class="form-label small fw-bold text-muted text-uppercase">Qtd</label>
                <input type="number" min="0" step="1" id="mfQtd" class="form-control rounded-3" value="1">
            </div>
            <div class="col-md-3">
                <label class="form-label small fw-bold text-muted text-uppercase">Obs</label>
                <input type="text" id="mfObs" class="form-control rounded-3" placeholder="opcional">
            </div>
            <div class="col-12 d-flex gap-2">
                <button class="btn btn-amber rounded-pill px-4 fw-bold" onclick="saveMovementForm()"><i class="fa-solid fa-check me-1"></i> Salvar</button>
                <button class="btn btn-light rounded-pill px-4 fw-bold border" onclick="document.getElementById('movementFormWrap').classList.add('d-none')">Cancelar</button>
            </div>
        </div>
    `;
}

function saveMovementForm() {
    const produto = document.getElementById('mfProduto').value;
    const tipo = document.getElementById('mfTipo').value;
    const quantidade = parseInt(document.getElementById('mfQtd').value) || 0;
    if (!produto || quantidade <= 0) return showToast('Selecione o produto e informe a quantidade!');

    const list = getMovements();
    list.push({
        id: 'm' + Date.now(),
        data: new Date().toISOString(),
        produto: produto,
        tipo: tipo,
        quantidade: quantidade,
        obs: document.getElementById('mfObs').value.trim()
    });
    saveMovements(list);
    renderMovements();
    document.getElementById('movementFormWrap').classList.add('d-none');
    showToast('Movimento registrado!');
}

function deleteMovement(id) {
    const list = getMovements().filter(m => m.id !== id);
    saveMovements(list);
    renderMovements();
    showToast('Movimento excluído!');
}

function exportMovementsCSV() {
    const movements = getMovements().slice().sort((a, b) => new Date(a.data) - new Date(b.data));
    const rows = [['Data', 'Produto', 'Tipo', 'Quantidade', 'Observação']];
    movements.forEach(m => rows.push([formatDate(m.data), m.produto, m.tipo, m.quantidade, m.obs || '']));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'movimentos_fg_salgados.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast('CSV exportado!');
}

function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('fg_admin_logged') === '1' && sessionStorage.getItem('fg_admin_token')) {
        showPanel();
    }
});
