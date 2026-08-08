const AUTH_KEY = 'fg_admin_auth';
const RATE_KEY = 'fg_admin_rate';
const ORDERS_KEY = 'fg_admin_orders';
const MOVEMENTS_KEY = 'fg_admin_movimentos';
const SITE_KEY = 'fg_salgados_v8';
const DEFAULT_PASSWORD = '1031';
const AUTH_VERSION = 2;
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
    const input = document.getElementById('loginPass').value;
    if (!input) return;

    const limit = checkRateLimit();
    if (limit.blocked) {
        showLoginError(`🔒 Muitas tentativas inválidas! Acesso bloqueado. Tente novamente em ${limit.min} minuto(s).`);
        return;
    }

    const auth = readJSON(AUTH_KEY, {});
    let ok = false;
    if (auth.salt && auth.hash) {
        ok = safeEqual(await hashPass(input + ':' + auth.salt), auth.hash);
    } else if (auth.hash) {
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
            showLoginError('Senha incorreta.');
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
    writeJSON(AUTH_KEY, { salt: salt, hash: await hashPass(p1 + ':' + salt), mustChange: false });
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
}

document.querySelectorAll('.btn-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function formatBRL(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    return items;
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
                    ${p.image && !p.image.startsWith('data:') ? `<img src="${p.image}" class="product-thumb" alt="">` : '<div class="product-thumb bg-light d-flex align-items-center justify-content-center text-muted"><i class="fa-solid fa-image"></i></div>'}
                    <div>
                        <div class="fw-bold">${p.name}</div>
                        <div class="small text-muted">${p.desc || ''}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge text-bg-light border text-dark">${p.category || '-'}</span></td>
            <td class="fw-bold">${formatBRL(p.price)}</td>
            <td>${p.units || 1}</td>
            <td>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" ${p.active !== false ? 'checked' : ''} onchange="toggleActive('${p.id}', this.checked)">
                </div>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-light border rounded-pill" onclick="openProductForm('${p.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-light border rounded-pill text-danger" onclick="deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
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
        `<option value="${c}" ${p && p.category === c ? 'selected' : ''}>${c}</option>`).join('');

    const wrap = document.getElementById('productFormWrap');
    wrap.classList.remove('d-none');
    wrap.innerHTML = `
        <h6 class="fw-bold mb-3">${p ? 'Editar Produto' : 'Novo Produto'}</h6>
        <div class="row g-3">
            <div class="col-md-6">
                <label class="form-label small fw-bold text-muted text-uppercase">Nome</label>
                <input type="text" id="pfName" class="form-control rounded-3" value="${p ? p.name : ''}">
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
                <input type="text" id="pfDesc" class="form-control rounded-3" value="${p ? (p.desc || '') : ''}">
            </div>
            <div class="col-12">
                <label class="form-label small fw-bold text-muted text-uppercase">URL da imagem</label>
                <input type="text" id="pfImage" class="form-control rounded-3" value="${p ? (p.image || '') : ''}" placeholder="https://... ou ./images/produto.webp">
            </div>
            <div class="col-12 d-flex gap-2">
                <button class="btn btn-amber rounded-pill px-4 fw-bold" onclick="saveProductForm('${p ? p.id : ''}')"><i class="fa-solid fa-check me-1"></i> Salvar</button>
                <button class="btn btn-light rounded-pill px-4 fw-bold border" onclick="document.getElementById('productFormWrap').classList.add('d-none')">Cancelar</button>
            </div>
        </div>
    `;
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
                        <span class="fw-bold">Pedido #${o.numero}</span>
                        <span class="status-badge status-${o.status}">${st.label}</span>
                    </div>
                    <div class="small text-muted mb-2">${formatDate(o.data)}</div>
                    <p class="mb-1"><i class="fa-solid fa-user me-1"></i> <strong>${o.cliente}</strong> ${o.telefone ? '· ' + o.telefone : ''}</p>
                    <p class="mb-1 small"><i class="fa-solid fa-box me-1"></i> ${o.itens}</p>
                    <p class="mb-1 small"><i class="fa-solid fa-location-dot me-1"></i> ${o.modo === 'entrega' ? (o.endereco || 'Entrega') : 'Retirada no local'}</p>
                    <p class="mb-2 small"><i class="fa-solid fa-money-bill-wave me-1"></i> ${o.pagamento || '-'} · <strong>${formatBRL(o.total)}</strong></p>
                    <div class="d-flex gap-2 align-items-center">
                        <select class="form-select form-select-sm status-select flex-grow-1" onchange="setOrderStatus('${o.id}', this.value)">${statusOptions}</select>
                        <button class="btn btn-sm btn-light border rounded-pill text-danger" onclick="deleteOrder('${o.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    ${next ? `<button class="btn btn-sm btn-amber rounded-pill w-100 mt-2 fw-bold" onclick="nextOrderStatus('${o.id}')">Avancar para: ${STATUSES[next].label}</button>` : ''}
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
    btn.addEventListener('click', () => {
        document.querySelectorAll('#statusFilter .btn-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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
                <td class="small fw-semibold">${m.produto}</td>
                <td><span class="badge ${m.tipo === 'entrada' ? 'text-bg-success' : 'text-bg-danger'}">${m.tipo}</span></td>
                <td class="fw-bold">${m.quantidade}</td>
                <td class="small text-muted">${m.obs || '-'}</td>
                <td class="text-end"><button class="btn btn-sm btn-light border text-danger" onclick="deleteMovement('${m.id}')"><i class="fa-solid fa-trash"></i></button></td>
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
                <td>${k}</td>
                <td class="text-end fw-bold ${balance[k] < 0 ? 'text-danger' : 'text-success'}">${balance[k]}</td>
            </tr>
        `).join('');
    }
}

function openMovementForm() {
    const items = getMenuItems().filter(i => i.active !== false);
    const options = items.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
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

initAuth().then(() => {
    if (sessionStorage.getItem('fg_admin_logged') === '1') {
        showPanel();
    }
});
