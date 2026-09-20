const ORDERS_KEY = 'fg_admin_orders';
const MOVEMENTS_KEY = 'fg_admin_movimentos';
const SITE_KEY = 'fg_salgados_v9';
const DEFAULT_PASSWORD = '1031';
const DEFAULT_EMAIL = 'gobato59@gmail.com';
const AUTH_VERSION = 3; // incrementado para resetar credenciais em todos os navegadores
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const INACTIVITY_MINUTES = 30;

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
        if (inputPass) inputPass.value = '';
        showPanel();
    } catch (e) {
        if (!e.silent) showLoginError(e.message);
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
    refreshProducts();
    renderOrders();
    renderMovements();
    carregarToken();
    startInactivityWatch();
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

function gerarConteudoMenuData() {
    const items = getMenuItems();
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

    return `window.fgMenuItems = [\n${linhas.join(',\n')}\n]\n`;
}

function exportarMenuData() {
    const conteudo = gerarConteudoMenuData();
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

/* ---------------- INTEGRAÇÃO GITHUB ---------------- */

function toggleGhToken() {
    const el = document.getElementById('ghToken');
    const icon = document.getElementById('ghTokenEyeIcon');
    if (el.type === 'password') {
        el.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
    } else {
        el.type = 'password';
        icon.className = 'fa-solid fa-eye';
    }
}

function carregarToken() {
    const token = localStorage.getItem('fg_gh_token');
    if (token) {
        document.getElementById('ghToken').value = token;
    }
}

function salvarToken() {
    const token = document.getElementById('ghToken').value.trim();
    if (!token) {
        localStorage.removeItem('fg_gh_token');
        showToast('Token removido.');
    } else {
        localStorage.setItem('fg_gh_token', token);
        showToast('Token salvo localmente!');
    }
}

async function testarToken() {
    const token = localStorage.getItem('fg_gh_token') || document.getElementById('ghToken').value.trim();
    if (!token) return showToast('Preencha e salve o token primeiro.');

    try {
        const res = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            showToast(`Conectado como: ${data.login} ✅`);
        } else {
            showToast('Erro: Token inválido ou sem permissão.');
        }
    } catch (e) {
        showToast('Erro de rede ao testar token.');
    }
}

function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

async function publicarNoSite() {
    const token = localStorage.getItem('fg_gh_token') || document.getElementById('ghToken').value.trim();
    if (!token) {
        switchTab('github');
        return showToast('Configure o Token do GitHub para publicar!');
    }

    const btn = document.getElementById('btnPublicar');
    const status = document.getElementById('publishStatus');
    const repo = 'Gobato15/fg-salgados';
    const path = 'menuData.js';
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-2"></i> Publicando...';
    status.className = 'mt-3 d-none';

    try {
        // 1. Obter o SHA do arquivo atual
        const resGet = await fetch(url, {
            headers: { 'Authorization': `token ${token}` }
        });
        
        if (!resGet.ok) throw new Error('Não foi possível acessar o arquivo no repositório.');
        
        const dataGet = await resGet.json();
        const sha = dataGet.sha;

        // 2. Gerar novo conteúdo
        const novoConteudo = gerarConteudoMenuData();
        const conteudoBase64 = toBase64(novoConteudo);

        // 3. Fazer commit da alteração
        const resPut = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Atualiza cardápio via Admin',
                content: conteudoBase64,
                sha: sha,
                branch: 'main'
            })
        });

        if (resPut.ok) {
            showToast('✅ Publicado com sucesso no site!');
            status.className = 'mt-3 alert alert-success border-0 small py-2';
            status.innerHTML = '<strong>Sucesso!</strong> As alterações foram enviadas para o site. Atualize a página da loja em ~2 minutos.';
        } else {
            const erroData = await resPut.json();
            throw new Error(erroData.message || 'Erro ao salvar no GitHub.');
        }
    } catch (err) {
        status.className = 'mt-3 alert alert-danger border-0 small py-2';
        status.innerHTML = `<strong>Erro:</strong> ${err.message}`;
        showToast('Falha ao publicar.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rocket me-2"></i> Publicar no Site Agora';
    }
}

/* ---------------- CARDÁPIO ---------------- */

let itemsCache = [];
let itemsLoaded = false;

async function getMenuItems() {
    if (!itemsLoaded) {
        const data = await apiReq('/admin/products');
        itemsCache = data.items || [];
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
    const p = itemsCache.find(x => x.id === id);
    if (!p) return;
    try {
        await apiReq('/admin/products', { method: 'POST', body: JSON.stringify(Object.assign({}, p, { active: !!active })) });
        p.active = !!active;
        showToast(active ? 'Produto ativado!' : 'Produto desativado (oculto do site)');
    } catch (e) {
        if (e.silent) return;
        showToast('⚠️ ' + e.message);
        renderProducts();
    }
}

async function deleteProduct(id) {
    const p = itemsCache.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`Excluir "${p.name}"?`)) return;
    try {
        await apiReq('/admin/products/' + encodeURIComponent(id), { method: 'DELETE' });
        await refreshProducts();
        showToast('Produto excluído!');
    } catch (e) {
        if (e.silent) return;
        showToast('⚠️ ' + e.message);
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
                <label class="form-label small fw-bold text-muted text-uppercase">Foto (URL webp)</label>
                <input type="text" id="pfImage" class="form-control rounded-3" value="${p ? esc(p.image || '') : ''}" placeholder="./images/produto.webp" oninput="updatePfPreview(this.value)">
                <small class="text-muted">Ou escolha uma das fotos do cardápio abaixo.</small>
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
                <small class="text-muted">WEBP, PNG, JPG ou GIF · enviada e salva no backend.</small>
            </div>
            <div class="col-12 ${previewSrc ? '' : 'd-none'}" id="pfPreviewWrap">
                <label class="form-label small fw-bold text-muted text-uppercase">Pré-visualização</label>
                <div>
                    <img id="pfPreview" src="${previewSrc}" alt="Pré-visualização" class="img-thumbnail" style="max-height: 160px; max-width: 220px; object-fit: cover;">
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
        img.src = v;
        wrap.classList.remove('d-none');
    } else {
        wrap.classList.add('d-none');
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

async function uploadImage(file) {
    const base = apiBase();
    if (!base) throw new Error('API não configurada.');
    const headers = { 'Content-Type': file.type || mimeFromName(file.name) };
    const token = sessionStorage.getItem('fg_admin_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let res;
    try {
        res = await fetch(base + '/admin/upload', { method: 'POST', headers, body: file });
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
            showToast('Enviando imagem…');
            image = await uploadImage(file);
        } catch (e) {
            showToast('⚠️ ' + e.message);
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
        await apiReq('/admin/products', { method: 'POST', body: JSON.stringify(payload) });
        await refreshProducts();
        document.getElementById('productFormWrap').classList.add('d-none');
        showToast('Cardápio atualizado!');
    } catch (e) {
        if (e.silent) return;
        showToast('⚠️ ' + e.message);
    }
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
