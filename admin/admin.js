const AUTH_KEY = 'fg_admin_auth';
const RATE_KEY = 'fg_admin_rate';
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

async function sha256(str) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fallbackHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return 'h' + h;
}

async function hashPass(str) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) return sha256(str);
    return fallbackHash(str);
}

function randomSalt() {
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
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

async function initAuth() {
    const auth = readJSON(AUTH_KEY, null);
    if (!auth || auth.version !== AUTH_VERSION) {
        const salt = randomSalt();
        writeJSON(AUTH_KEY, {
            version: AUTH_VERSION,
            salt: salt,
            hash: await hashPass(DEFAULT_PASSWORD + ':' + salt),
            mustChange: false
        });
    }
}

function checkRateLimit() {
    const rate = readJSON(RATE_KEY, { attempts: 0, locked_until: 0 });
    const now = Date.now();
    if (rate.locked_until > now) {
        const min = Math.ceil((rate.locked_until - now) / 60000);
        return { blocked: true, min: min };
    }
    return { blocked: false, min: 0 };
}

function recordFailedAttempt() {
    const rate = readJSON(RATE_KEY, { attempts: 0, locked_until: 0 });
    rate.attempts = (rate.attempts || 0) + 1;
    rate.last_attempt = Date.now();
    if (rate.attempts >= MAX_ATTEMPTS) {
        rate.locked_until = Date.now() + LOCK_MINUTES * 60 * 1000;
        rate.attempts = 0;
    }
    writeJSON(RATE_KEY, rate);
}

function resetRateLimit() {
    writeJSON(RATE_KEY, { attempts: 0, locked_until: 0 });
}

async function tryLogin() {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const input = document.getElementById('loginPass').value;
    if (!email || !input) return;

    const limit = checkRateLimit();
    if (limit.blocked) {
        showLoginError(`🔒 Muitas tentativas inválidas! Acesso bloqueado. Tente novamente em ${limit.min} minuto(s).`);
        return;
    }

    const auth = readJSON(AUTH_KEY, {});
    let ok = email === DEFAULT_EMAIL.toLowerCase();
    if (ok && auth.salt && auth.hash) {
        ok = safeEqual(await hashPass(input + ':' + auth.salt), auth.hash);
    } else if (ok && auth.hash) {
        ok = safeEqual(await hashPass(input), auth.hash);
    }

    if (ok) {
        resetRateLimit();
        sessionStorage.setItem('fg_admin_logged', '1');
        showPanel();
        if (auth.mustChange) {
            showToast('Troque a senha padrão agora!');
            switchTab('senha');
        }
    } else {
        recordFailedAttempt();
        const limit2 = checkRateLimit();
        if (limit2.blocked) {
            showLoginError(`🔒 Acesso bloqueado por excesso de tentativas! Tente novamente em ${limit2.min} minutos.`);
        } else {
            showLoginError('E-mail ou senha incorretos.');
        }
        document.getElementById('loginPass').value = '';
    }
}

function logout() {
    sessionStorage.removeItem('fg_admin_logged');
    location.reload();
}

function showPanel() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('panelScreen').classList.remove('d-none');
    renderProducts();
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

async function changePassword() {
    const p1 = document.getElementById('newPass1').value;
    const p2 = document.getElementById('newPass2').value;
    if (!p1 || p1.length < 4) return showToast('Senha deve ter ao menos 4 caracteres!');
    if (p1 !== p2) return showToast('As senhas não conferem!');
    const salt = randomSalt();
    writeJSON(AUTH_KEY, { version: AUTH_VERSION, salt: salt, hash: await hashPass(p1 + ':' + salt), mustChange: false });
    document.getElementById('newPass1').value = '';
    document.getElementById('newPass2').value = '';
    showToast('Senha alterada com sucesso!');
}

function switchTab(tab) {
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-section').forEach(s => {
        s.classList.toggle('d-none', s.id !== 'tab-' + tab);
    });
    if (tab === 'cardapio') renderProducts();
    if (tab === 'cozinha') renderOrders();
    if (tab === 'movimentos') renderMovements();
    if (tab === 'importar') renderAgsImporter();
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

function getMenuItems() {
    const items = (window.fgMenuItems || []).map(it =>
        Object.assign({}, it, { desc: it.description, active: it.active !== false }));
    const saved = readJSON(SITE_KEY, {}).products || {};
    Object.keys(saved).forEach(id => {
        const prod = items.find(p => p.id === id);
        if (prod) {
            Object.assign(prod, saved[id]);
        } else {
            items.push(Object.assign({ id: id, active: true, units: 1 }, saved[id]));
        }
    });
    const seen = new Set();
    return items.filter(it => {
        if (!it.image) return false;
        if (seen.has(it.id)) return false;
        seen.add(it.id);
        return true;
    });
}

function saveProducts(items) {
    const saved = readJSON(SITE_KEY, {});
    saved.products = saved.products || {};
    items.forEach(p => {
        saved.products[p.id] = {
            name: p.name,
            desc: p.desc,
            price: p.price,
            image: p.image,
            units: p.units,
            category: p.category,
            active: p.active !== false
        };
    });
    localStorage.setItem(SITE_KEY, JSON.stringify(saved));
}

function renderProducts() {
    const items = getMenuItems();
    const tbody = document.getElementById('productTable');
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nenhum produto cadastrado.</td></tr>';
        return;
    }
    tbody.innerHTML = items.map(p => `
        <tr>
            <td>
                <div class="d-flex align-items-center gap-2">
                    ${p.image ? `<img src="${esc(p.image.startsWith('data:') ? p.image : fixImagePath(p.image))}" class="product-thumb" alt="${esc(p.name)}" onerror="this.style.display='none'">` : '<div class="product-thumb bg-light d-flex align-items-center justify-content-center text-muted"><i class="fa-solid fa-image"></i></div>'}
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

function toggleActive(id, active) {
    const items = getMenuItems();
    const p = items.find(x => x.id === id);
    if (p) {
        p.active = active;
        saveProducts(items);
        showToast(active ? 'Produto ativado!' : 'Produto desativado (oculto do site)');
    }
}

function deleteProduct(id) {
    const items = getMenuItems();
    const p = items.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`Excluir "${p.name}"?`)) return;
    const rest = items.filter(x => x.id !== id);
    saveProducts(rest);
    renderProducts();
    showToast('Produto excluído!');
}

function openProductForm(id) {
    const items = getMenuItems();
    const p = id ? items.find(x => x.id === id) : null;
    const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
    if (!categories.includes('fritos')) categories.unshift('fritos');
    if (!categories.includes('assados')) categories.unshift('assados');
    const catOptions = categories.map(c =>
        `<option value="${esc(c)}" ${p && p.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('');

    const currentImg = p ? fixImagePath(p.image || '') : '';
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

            <!-- ===== BLOCO DE IMAGEM ===== -->
            <div class="col-12">
                <label class="form-label small fw-bold text-muted text-uppercase d-block mb-2">Foto do Produto</label>

                <!-- Input real de arquivo — acionado pelo label abaixo -->
                <input type="file" id="pfImageFile" accept="image/*" class="d-none" onchange="pfHandleImageUpload(this)">
                <!-- Valor real salvo (URL do GitHub ou base64) -->
                <input type="hidden" id="pfImage" value="${p ? esc(p.image || '') : ''}">

                <!-- Área clicável: label[for] garante abertura nativa do seletor em todo navegador/celular -->
                <label for="pfImageFile" id="pfImgClickArea"
                    style="display:block; cursor:pointer; border:3px dashed #f59e0b;
                           border-radius:16px; overflow:hidden; position:relative;
                           background:#fffbeb; min-height:180px; width:100%;">

                    ${currentImg ? `
                        <img id="pfImgPreview" src="${esc(currentImg)}"
                             style="width:100%; height:200px; object-fit:cover; display:block;"
                             onerror="this.style.display='none'">
                        <div style="position:absolute; bottom:0; left:0; right:0;
                                    background:rgba(0,0,0,0.65); padding:12px;
                                    text-align:center; color:#fff; font-weight:700; font-size:.95rem;">
                            <i class="fa-solid fa-camera me-2"></i>Clique aqui para trocar a foto
                        </div>
                    ` : `
                        <div style="display:flex; flex-direction:column; align-items:center;
                                    justify-content:center; min-height:180px; color:#b45309;
                                    padding:24px; text-align:center;">
                            <i class="fa-solid fa-camera fa-3x mb-3"></i>
                            <div style="font-size:1.05rem; font-weight:700;">Clique aqui para escolher uma foto</div>
                            <div style="font-size:.85rem; color:#888; margin-top:6px;">
                                Da galeria ou câmera do celular
                            </div>
                        </div>
                    `}
                </label>

                <!-- Botão extra visível — garante acionamento em qualquer situação -->
                <button type="button"
                    onclick="document.getElementById('pfImageFile').click()"
                    class="btn btn-warning rounded-pill fw-bold w-100 mt-2">
                    <i class="fa-solid fa-upload me-2"></i>Escolher / Trocar Foto
                </button>

                <!-- Status do upload -->
                <div id="pfUploadStatus" class="mt-2 small text-center"></div>
            </div>
            <!-- ===== FIM BLOCO DE IMAGEM ===== -->

            <div class="col-12 d-flex gap-2">
                <button class="btn btn-amber rounded-pill px-4 fw-bold" onclick="saveProductForm('${p ? esc(p.id) : ''}')"><i class="fa-solid fa-check me-1"></i> Salvar</button>
                <button class="btn btn-light rounded-pill px-4 fw-bold border" onclick="document.getElementById('productFormWrap').classList.add('d-none')">Cancelar</button>
            </div>
        </div>
    `;
}


/* Atualiza preview ao digitar URL */
function pfPreviewUrl(url) {
    const img = document.getElementById('pfImgPreview');
    const placeholder = document.getElementById('pfImgPlaceholder');
    const resolved = url.startsWith('http') || url.startsWith('data:') ? url : fixImagePath(url);
    if (!url.trim()) {
        if (img) img.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        return;
    }
    if (!img) {
        // Cria o elemento img se não existir
        const wrap = document.getElementById('pfImgPreviewWrap');
        if (wrap) {
            const newImg = document.createElement('img');
            newImg.id = 'pfImgPreview';
            newImg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            newImg.onerror = () => { newImg.style.display = 'none'; if (placeholder) placeholder.style.display = 'flex'; };
            wrap.insertBefore(newImg, wrap.firstChild);
            newImg.src = resolved;
            if (placeholder) placeholder.style.display = 'none';
        }
    } else {
        img.src = resolved;
        img.style.display = '';
        if (placeholder) placeholder.style.display = 'none';
    }
}

/* Upload de imagem: envia para GitHub (se token disponível) ou usa base64 local */
async function pfHandleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Selecione um arquivo de imagem válido.'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Imagem muito grande! Use até 5MB.'); return; }

    const statusEl = document.getElementById('pfUploadStatus');
    const pfImageInput = document.getElementById('pfImage');
    const clickArea   = document.getElementById('pfImgClickArea');
    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-1 text-warning"></i><strong>Processando imagem...</strong>';

    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target.result;
        const base64Content = dataUrl.split(',')[1];

        // --- Atualiza preview na área -->
        const clickArea = document.getElementById('pfImgClickArea');
        if (clickArea) {
            // Mantém o label mas substitui o conteúdo interno
            clickArea.innerHTML = `
                <img src="${dataUrl}" style="width:100%; height:220px; object-fit:cover; display:block;">
                <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6);
                            padding:12px; text-align:center; color:#fff; font-weight:bold; font-size:.95rem; pointer-events:none;">
                    <i class="fa-solid fa-camera me-2"></i>Toque aqui para trocar a foto
                </div>
            `;
        }

        // --- Tenta enviar para GitHub ---
        const token = localStorage.getItem('fg_gh_token');
        if (token) {
            const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]/g, '_').replace(/_+/g, '_');
            const fileName = 'images/' + Date.now() + '_' + safeName;
            const repo = 'Gobato15/fg-salgados';
            const apiUrl = `https://api.github.com/repos/${repo}/contents/${fileName}`;

            if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-1 text-warning"></i><strong>Enviando foto para o site...</strong>';

            try {
                const res = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: 'Upload de imagem via Admin FG Salgados',
                        content: base64Content,
                        branch: 'main'
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    const rawUrl = data.content.download_url;
                    if (pfImageInput) pfImageInput.value = rawUrl;
                    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-check text-success me-1"></i><strong class="text-success">Foto enviada com sucesso! ✅ Clique em Salvar.</strong>';
                    showToast('✅ Foto publicada no site!');
                    return;
                } else {
                    const err = await res.json();
                    throw new Error(err.message || 'Erro ao enviar');
                }
            } catch (err) {
                if (statusEl) statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-warning me-1"></i>Não foi possível publicar no GitHub (${esc(err.message)}). Foto salva temporariamente.`;
            }
        } else {
            if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-info text-info me-1"></i>Foto carregada! Configure o token na aba <strong>GitHub</strong> para publicar permanentemente.';
        }

        // Fallback: salva como base64 no localStorage
        if (pfImageInput) pfImageInput.value = dataUrl;
        showToast('Foto carregada! Clique em Salvar.');
    };
    reader.readAsDataURL(file);
}


function saveProductForm(id) {
    const name = document.getElementById('pfName').value.trim();
    const price = parseFloat(document.getElementById('pfPrice').value);
    if (!name || isNaN(price)) return showToast('Informe nome e preço válidos!');

    const items = getMenuItems();
    let p = id ? items.find(x => x.id === id) : null;
    if (!p) {
        const maxId = items.reduce((m, i) => Math.max(m, parseInt(i.id) || 0), 0);
        p = { id: String(maxId + 1), active: true };
        items.push(p);
    }
    p.name = name;
    p.category = document.getElementById('pfCategory').value;
    p.price = price;
    p.units = parseInt(document.getElementById('pfUnits').value) || 1;
    p.desc = document.getElementById('pfDesc').value.trim();
    p.image = document.getElementById('pfImage').value.trim();

    saveProducts(items);
    renderProducts();
    document.getElementById('productFormWrap').classList.add('d-none');
    showToast('Cardápio atualizado!');
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

function openMovementForm() {
    const items = getMenuItems().filter(i => i.active !== false);
    const options = items.map(i => `<option value="${esc(i.name)}">${esc(i.name)}</option>`).join('');
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

/* ================================================================
   IMPORTADOR AGS DELIVERY
   Carrega o catálogo do AGS (items.xml) e permite selecionar produtos
   para incluir no cardápio da FG Salgados com imagens personalizadas.
================================================================ */

const AGS_XML_URL = 'https://agsdelivery.com.br/items.xml';
const AGS_ASSETS_URL = 'https://agsdelivery.com.br/';
let agsProducts = [];         // lista completa carregada do XML
let agsFiltered = [];         // lista após filtros

// Converte path relativo do AGS (assets/xxx.webp) em URL absoluta
function agsImageUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return AGS_ASSETS_URL + path.replace(/^\.?\//, '');
}

// Faz fetch + parse do XML e popula agsProducts
async function loadAgsProducts() {
    const stateEl = document.getElementById('agsState');
    const gridEl  = document.getElementById('agsGrid');
    const toolbar  = document.getElementById('agsToolbar');
    if (!stateEl || !gridEl) return;

    stateEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin fa-2x mb-2 text-warning"></i><p class="mt-2">Carregando catálogo do AGS...</p>';
    stateEl.classList.remove('d-none');
    gridEl.innerHTML = '';
    if (toolbar) toolbar.classList.add('d-none');

    try {
        // CORS: tenta diretamente; se falhar usa proxy público
        let xml;
        try {
            const res = await fetch(AGS_XML_URL + '?nocache=' + Date.now());
            if (!res.ok) throw new Error('Status ' + res.status);
            const text = await res.text();
            xml = new DOMParser().parseFromString(text, 'text/xml');
        } catch (e) {
            // fallback: usa os dados já carregados no XML local se existir
            throw new Error('Não foi possível carregar o XML do AGS. Verifique a conexão.');
        }

        const items = xml.querySelectorAll('item');
        if (!items.length) throw new Error('Nenhum produto encontrado no XML.');

        agsProducts = Array.from(items).map(item => ({
            id:          item.querySelector('id')?.textContent?.trim() || '',
            name:        item.querySelector('name')?.textContent?.trim() || '',
            category:    item.querySelector('category')?.textContent?.trim() || '',
            price:       parseFloat(item.querySelector('price')?.textContent) || 0,
            description: item.querySelector('description')?.textContent?.trim() || '',
            image:       item.querySelector('image')?.textContent?.trim() || '',
            active:      (item.querySelector('active')?.textContent?.trim() || '1') !== '0',
            customImage: '',    // URL personalizada pelo admin
            selected:    false
        })).filter(p => p.id && p.name);

        agsFiltered = [...agsProducts];
        stateEl.classList.add('d-none');
        renderAgsImporter();
        populateAgsCatFilter();
        if (toolbar) toolbar.classList.remove('d-none');
        showToast('✅ ' + agsProducts.length + ' produtos carregados!');

    } catch (err) {
        stateEl.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation fa-2x mb-2 text-danger"></i>
            <p class="text-danger fw-bold">${esc(err.message)}</p>
            <button class="btn btn-outline-danger rounded-pill" onclick="loadAgsProducts()">
                <i class="fa-solid fa-rotate me-1"></i> Tentar novamente
            </button>`;
    }
}

// Popula o select de categorias do filtro
function populateAgsCatFilter() {
    const sel = document.getElementById('agsCatFilter');
    if (!sel) return;
    const cats = [...new Set(agsProducts.map(p => p.category))].sort();
    sel.innerHTML = '<option value="">Todas as categorias</option>' +
        cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

// Rótulos de categoria em português
const AGS_CAT_LABELS = {
    burgers: '🍔 Burgers', coxinha: '🍗 Coxinha', bolinho: '🟤 Bolinho',
    esfirra: '🥙 Esfirra', croissant: '🥐 Croissant', lanches: '🥪 Naturais',
    tortas: '🥧 Tortas', pizzas: '🍕 Pizzas', drinks: '🥤 Bebidas',
    desserts: '🍮 Sobremesas', paes: '🍞 Pães', salgados: '🧆 Salgados'
};

// Renderiza o grid de cards do catálogo AGS
function renderAgsImporter() {
    const grid = document.getElementById('agsGrid');
    if (!grid) return;
    if (!agsProducts.length) return; // ainda não carregado

    const list = agsFiltered.length ? agsFiltered : agsProducts;

    if (!list.length) {
        grid.innerHTML = '<div class="col-12 text-center text-muted py-4">Nenhum produto encontrado para este filtro.</div>';
        return;
    }

    grid.innerHTML = list.map(p => {
        const imgUrl  = p.customImage || agsImageUrl(p.image);
        const catLabel = AGS_CAT_LABELS[p.category] || p.category;
        const alreadyIn = getMenuItems().some(x => x.id === 'ags_' + p.id);
        const checked  = p.selected ? 'checked' : '';
        return `
        <div class="col-12 col-sm-6 col-lg-4 col-xl-3 ags-card-col" data-id="${esc(p.id)}" data-name="${esc(p.name.toLowerCase())}" data-cat="${esc(p.category)}">
            <div class="card h-100 shadow-sm border-0 rounded-4 overflow-hidden" style="transition: box-shadow .2s;">

                <!-- Imagem + checkbox -->
                <div class="position-relative" style="height:160px; background:#f1f5f9;">
                    <img src="${esc(imgUrl)}" alt="${esc(p.name)}"
                        style="width:100%; height:100%; object-fit:cover;"
                        onerror="this.src='../images/ags_coxinha.webp'" loading="lazy">
                    <div class="position-absolute top-0 start-0 m-2">
                        <input type="checkbox" class="form-check-input ags-check" id="agsc_${esc(p.id)}"
                            ${checked} onchange="agsToggleSelect('${esc(p.id)}', this.checked)"
                            style="width:22px; height:22px; cursor:pointer;">
                    </div>
                    <span class="position-absolute top-0 end-0 m-2 badge bg-dark bg-opacity-75 rounded-pill" style="font-size:.7rem;">
                        ${esc(catLabel)}
                    </span>
                    ${alreadyIn ? '<span class="position-absolute bottom-0 start-0 m-2 badge bg-success rounded-pill" style="font-size:.68rem;"><i class="fa-solid fa-check me-1"></i>Já no cardápio</span>' : ''}
                </div>

                <!-- Corpo -->
                <div class="card-body p-3">
                    <div class="fw-bold mb-1" style="font-size:.95rem; line-height:1.2;">${esc(p.name)}</div>
                    <div class="text-muted small mb-2" style="font-size:.78rem; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${esc(p.description)}</div>

                    <!-- Preço editável -->
                    <div class="d-flex align-items-center gap-1 mb-2">
                        <span class="text-muted small">R$</span>
                        <input type="number" step="0.01" min="0" value="${p.price.toFixed(2)}"
                            class="form-control form-control-sm rounded-pill text-center fw-bold"
                            style="max-width:90px; font-size:.9rem;"
                            onchange="agsSetPrice('${esc(p.id)}', this.value)"
                            title="Editar preço antes de importar">
                    </div>

                    <!-- Imagem personalizada -->
                    <div class="mb-1">
                        <label class="form-label small fw-semibold text-muted mb-1" style="font-size:.73rem;">IMAGEM PERSONALIZADA</label>
                        <div class="input-group input-group-sm">
                            <input type="text" class="form-control rounded-start-3" placeholder="URL ou deixe em branco"
                                value="${esc(p.customImage)}"
                                id="agsimg_${esc(p.id)}"
                                onchange="agsSetCustomImage('${esc(p.id)}', this.value)">
                            <label class="btn btn-light border" title="Upload de imagem" style="cursor:pointer;">
                                <i class="fa-solid fa-upload"></i>
                                <input type="file" accept="image/*" class="d-none"
                                    onchange="agsUploadImage('${esc(p.id)}', this)">
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    updateAgsCount();
}

// Filtra o grid por texto + categoria
function filterAgsGrid() {
    const q   = (document.getElementById('agsSearch')?.value || '').toLowerCase();
    const cat = document.getElementById('agsCatFilter')?.value || '';
    agsFiltered = agsProducts.filter(p =>
        (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) &&
        (!cat || p.category === cat)
    );
    renderAgsImporter();
}

// Seleciona/deseleciona produto
function agsToggleSelect(id, checked) {
    const p = agsProducts.find(x => x.id === id);
    if (p) p.selected = checked;
    // sincroniza no filtrado também
    const pf = agsFiltered.find(x => x.id === id);
    if (pf) pf.selected = checked;
    updateAgsCount();
}

// Selecionar/desmarcar todos visíveis
function agsSelectAll(value) {
    agsFiltered.forEach(p => { p.selected = value; });
    // reflete também no array principal
    agsProducts.forEach(p => {
        if (agsFiltered.find(f => f.id === p.id)) p.selected = value;
    });
    renderAgsImporter();
}

// Atualiza preço de um produto
function agsSetPrice(id, val) {
    const p = agsProducts.find(x => x.id === id);
    if (p) p.price = parseFloat(val) || p.price;
    const pf = agsFiltered.find(x => x.id === id);
    if (pf) pf.price = parseFloat(val) || pf.price;
}

// Salva URL de imagem customizada
function agsSetCustomImage(id, url) {
    const p = agsProducts.find(x => x.id === id);
    if (p) p.customImage = url.trim();
    const pf = agsFiltered.find(x => x.id === id);
    if (pf) pf.customImage = url.trim();

    // Atualiza a imagem exibida no card imediatamente
    const cardCol = document.querySelector(`.ags-card-col[data-id="${CSS.escape(id)}"]`);
    if (cardCol) {
        const img = cardCol.querySelector('img');
        if (img && url.trim()) img.src = url.trim();
    }
}

// Upload de imagem: converte para base64 e usa como URL
function agsUploadImage(id, inputEl) {
    const file = inputEl.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return showToast('Selecione um arquivo de imagem válido.');
    if (file.size > 2 * 1024 * 1024) return showToast('Imagem muito grande! Use até 2MB.');

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        agsSetCustomImage(id, dataUrl);

        // Atualiza o campo de texto com indicador
        const textInput = document.getElementById('agsimg_' + id);
        if (textInput) textInput.value = '[Imagem carregada: ' + file.name + ']';

        showToast('✅ Imagem "' + file.name + '" carregada!');
    };
    reader.readAsDataURL(file);
}

// Contador de selecionados
function updateAgsCount() {
    const total = agsProducts.filter(p => p.selected).length;
    const el = document.getElementById('agsSelectedCount');
    if (el) el.textContent = total + (total === 1 ? ' selecionado' : ' selecionados');
}

// Importa os produtos selecionados para o cardápio FG
function importSelectedProducts() {
    const selected = agsProducts.filter(p => p.selected);
    if (!selected.length) {
        showToast('Selecione pelo menos um produto para importar.');
        return;
    }

    const existing = getMenuItems();
    let added = 0;
    let updated = 0;

    selected.forEach(p => {
        const fgId   = 'ags_' + p.id;
        const imgUrl = p.customImage || agsImageUrl(p.image);

        const newProd = {
            id:          fgId,
            name:        p.name,
            category:    p.category,
            price:       p.price,
            desc:        p.description,
            description: p.description,
            image:       imgUrl,
            units:       1,
            active:      true
        };

        const idx = existing.findIndex(x => x.id === fgId);
        if (idx >= 0) {
            existing[idx] = Object.assign(existing[idx], newProd);
            updated++;
        } else {
            existing.push(newProd);
            added++;
        }
    });

    saveProducts(existing);

    const msg = [];
    if (added)   msg.push(added   + (added   === 1 ? ' produto adicionado' : ' produtos adicionados'));
    if (updated) msg.push(updated + (updated === 1 ? ' produto atualizado'  : ' produtos atualizados'));
    showToast('✅ ' + msg.join(' e ') + '!');

    // Desmarca os importados e atualiza badges "Já no cardápio"
    selected.forEach(p => { p.selected = false; });
    renderAgsImporter();
    updateAgsCount();

    // Oferece ir para o cardápio
    setTimeout(() => {
        if (confirm('✅ ' + msg.join(' e ') + '!\n\nDeseja ir para a aba Cardápio para conferir e publicar?')) {
            switchTab('cardapio');
        }
    }, 300);
}

initAuth().then(() => {
    if (sessionStorage.getItem('fg_admin_logged') === '1') {
        showPanel();
    }
});

