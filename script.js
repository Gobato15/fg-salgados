let menuItems = [];
let cart = [];

let deliveryFee = 0;
let deliveryDistance = 0;
let activeCategory = 'all';

const STORAGE_KEY = 'fg_salgados_v9';
const CLIENT_ORDERS_KEY = 'fg_client_orders';

const DEFAULT_CONTACT = {
    whats: "(19) 99609-0540",
    insta: "fgsalgados24",
    pix: "agsdelivery24@gmail.com",
    address: "Entrega e Retirada Local",
    about: "Salgados artesanais congelados vendidos por unidade. Qualidade gourmet, ingredientes selecionados e sabor de verdade.",
    hours1: "Seg a Sex: 14h às 19h",
    hours2: "Sábado: 8h às 17h"
};

let savedData = {};

const categoryLabels = {
    'all': '🍽️ Todos',
    'fritos': '🍗 Salgados Fritos',
    'assados': '🥐 Salgados Assados',
    'burgers': '🍔 Lanches / Hambúrgueres',
    'pacotes': '📦 Pacotes com 6 e 1 Unidade'
};

const menuGrid = document.getElementById('menuGrid');
const categoryContainer = document.getElementById('categoryContainer');
const searchInput = document.getElementById('searchInput');

function formatBRL(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function esc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isValidName(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return false;
    return parts.every(p => /^[A-Za-zÀ-ÖØ-öø-ÿ']+$/.test(p));
}

function normalizeDigits(str) {
    return String(str || '').replace(/\D/g, '');
}

function isValidPhone(phone) {
    const digits = normalizeDigits(phone);
    if (digits.length === 11 && (digits[2] === '9' || digits[2] === '8')) return true;
    return false;
}

function isValidCepFormat(cep) {
    return normalizeDigits(cep).length === 8;
}

function applyPhoneMask(input) {
    let digits = normalizeDigits(input.value);
    if (digits.length === 0) { input.value = ''; return; }
    if (input.value.replace(/\D/g, '').startsWith('55') && digits.length < 13) {
        digits = digits.slice(2);
    }
    let formatted = digits;
    if (digits.length > 0) formatted = `(${digits.substring(0, 2)}`;
    if (digits.length >= 3) formatted += `) ${digits.substring(2, 7)}`;
    if (digits.length >= 8) formatted += `-${digits.substring(7, 11)}`;
    input.value = formatted;
}

function setFieldState(el, state) {
    if (!el) return;
    const invalid = state === 'invalid';
    const valid = state === 'valid';
    el.classList.toggle('is-invalid', invalid);
    el.classList.toggle('is-valid', valid);
    const feedbackEl = el.parentElement ? el.parentElement.querySelector('.field-feedback') : null;
    if (feedbackEl) {
        feedbackEl.classList.toggle('show', invalid);
        feedbackEl.classList.toggle('text-danger', invalid);
        feedbackEl.classList.toggle('text-success', valid);
        feedbackEl.textContent = invalid ? (el.dataset.msg || 'Campo inválido.') : '';
    }
}

window.validateCheckout = function () {
    const btn = document.getElementById('btnFinalizar');
    const consent = document.getElementById('confirmDados');
    if (!btn) return;

    const nameEl = document.getElementById('customerName');
    const phoneEl = document.getElementById('customerPhone');
    const isEntrega = document.getElementById('modeEntrega') ? document.getElementById('modeEntrega').checked : false;

    const nameOk = nameEl && isValidName(nameEl.value);
    const phoneOk = phoneEl && isValidPhone(phoneEl.value);

    let enderecoOk = true;
    if (isEntrega) {
        const cepOk = isValidCepFormat(document.getElementById('deliveryCep').value) && document.getElementById('deliveryCity').value.trim() !== '' && document.getElementById('deliveryCity').value !== 'Buscando...';
        const ruaOk = document.getElementById('deliveryStreet').value.trim() !== '';
        const numOk = document.getElementById('deliveryNumber').value.trim() !== '';
        enderecoOk = cepOk && ruaOk && numOk;
    }

    const consentOk = consent ? consent.checked : true;
    const cartOk = cart.length > 0;
    const allOk = nameOk && phoneOk && enderecoOk && consentOk && cartOk;

    btn.disabled = !allOk;

    if (nameEl) setFieldState(nameEl, nameOk ? 'valid' : (nameEl.value ? 'invalid' : 'idle'));
    if (phoneEl) setFieldState(phoneEl, phoneOk ? 'valid' : (phoneEl.value ? 'invalid' : 'idle'));

    return allOk;
};

function loadSavedData() {
    try {
        savedData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
        savedData = {};
    }

    menuItems = (window.fgMenuItems || []).map(item => Object.assign({}, item, { desc: item.description, active: item.active !== false }));

    if (savedData.products) {
        Object.keys(savedData.products).forEach(id => {
            const prod = menuItems.find(p => p.id === id);
            if (prod) Object.assign(prod, savedData.products[id]);
            else menuItems.push(Object.assign({ id, active: true, units: 1 }, savedData.products[id]));
        });
    }

    const seen = new Set();
    menuItems = menuItems.filter(it => {
        if (!it.image) return false;
        if (seen.has(it.id)) return false;
        seen.add(it.id);
        return true;
    });

    if (savedData.hero) {
        const titleEl = document.getElementById('heroTitle');
        const descEl = document.getElementById('heroDesc');
        if (titleEl && savedData.hero.title) titleEl.textContent = savedData.hero.title;
        if (descEl && savedData.hero.desc) descEl.textContent = savedData.hero.desc;
    }

    if (savedData.contact) {
        Object.keys(savedData.contact).forEach(field => {
            const el = document.querySelector(`[data-field="${field}"]`);
            if (el) el.textContent = savedData.contact[field];
        });
        const pixEl = document.getElementById('pixKey');
        if (pixEl && savedData.contact.pix) pixEl.value = savedData.contact.pix;
    }
}

function getWhatsNumber() {
    const rawNum = (savedData.contact && savedData.contact.whats ? savedData.contact.whats : DEFAULT_CONTACT.whats).replace(/\D/g, '');
    return (rawNum.startsWith('55') ? rawNum : '55' + rawNum);
}

function generateWhatsLink(msg) {
    return `https://wa.me/${getWhatsNumber()}?text=${encodeURIComponent(msg)}`;
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

function getPixKey() {
    const pixEl = document.getElementById('pixKey');
    if (pixEl && pixEl.value.trim()) return pixEl.value.trim();
    return (savedData.contact && savedData.contact.pix) ? savedData.contact.pix : DEFAULT_CONTACT.pix;
}

window.togglePaymentMethod = function () {
    const isPix = document.getElementById('payPix') ? document.getElementById('payPix').checked : true;
    const pixPanel = document.getElementById('pixPanel');
    const localPanel = document.getElementById('localPanel');
    if (pixPanel) pixPanel.style.display = isPix ? 'block' : 'none';
    if (localPanel) localPanel.style.display = isPix ? 'none' : 'block';
    initPixDynamic();
    updateCartUI();
};

window.copyPixKey = function () {
    const pixInput = document.getElementById('pixKey');
    if (!pixInput) return;
    const text = pixInput.value.trim();

    const done = () => showToast("Chave PIX copiada! 📋");

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
        fallbackCopy(text, done);
    }
};

function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, 99999);
    try { document.execCommand('copy'); } catch (e) { }
    document.body.removeChild(ta);
    done();
}

function pixApiBase() {
    return ((window.FG_CONFIG && window.FG_CONFIG.pixApiUrl) || '').trim().replace(/\/+$/, '');
}

window.pixBackendConfigured = function () {
    return !!pixApiBase();
};

window.copyPixUnica = function () {
    const v = document.getElementById('pixKey');
    if (!v) return;
    const done = () => showToast('Chave PIX copiada! 📋');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v.value).then(done, () => fallbackCopy(v.value, done));
    } else {
        fallbackCopy(v.value, done);
    }
};

window.initPixDynamic = function () {
    const block = document.getElementById('pixDynamicBlock');
    const staticBlock = document.getElementById('pixStaticBlock');
    if (!block) return;
    if (pixBackendConfigured()) {
        block.style.display = 'block';
        if (staticBlock) staticBlock.style.display = 'none';
    } else {
        block.style.display = 'none';
        if (staticBlock) staticBlock.style.display = '';
    }
};

window.gerarPixDinamico = async function () {
    const base = pixApiBase();
    const btn = document.getElementById('btnGerarPix');
    const statusEl = document.getElementById('pixStatus');
    if (!base) { showToast('Backend de pagamento não configurado!'); return; }
    if (!cart.length) { showToast('Adicione itens ao pedido!'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Gerando...'; }
    if (statusEl) { statusEl.className = 'mt-2 small fw-bold text-muted'; statusEl.textContent = 'Gerando PIX...'; }

    const items = cart.map(it => {
        const prod = menuItems.find(p => p.id === it.id) || {};
        return { id: it.id, name: it.name, price: it.price, quantity: it.quantity, units: prod.units || 1 };
    });
    const isEntregaPix = document.getElementById('modeEntrega') ? document.getElementById('modeEntrega').checked : false;
    const subtotal = cart.reduce((s, it) => s + it.price * it.quantity, 0);
    const total = Math.round((subtotal + (isEntregaPix ? deliveryFee : 0)) * 100) / 100;
    window._pixAmount = total;

    try {
        const res = await fetch(base + '/pix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items, amount: total, label: 'Pedido FG Salgados' })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Falha ao gerar o PIX.');
        mostrarPixDinamico(data);
    } catch (e) {
        if (statusEl) { statusEl.className = 'mt-2 small fw-bold text-danger'; statusEl.textContent = e.message; }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles me-1"></i> Gerar PIX'; }
    }
};

function mostrarPixDinamico(data) {
    const qrImg = document.getElementById('pixDynamicQR');
    const place = document.getElementById('pixDynamicPlaceholder');
    const copyInput = document.getElementById('pixDynamicCopy');
    const statusEl = document.getElementById('pixStatus');
    const btn = document.getElementById('btnGerarPix');

    if (data.qr_code_base64) {
        qrImg.src = 'data:image/png;base64,' + data.qr_code_base64;
        qrImg.style.display = 'block';
        if (place) place.style.display = 'none';
    }
    if (copyInput && data.copy_paste) {
        copyInput.value = data.copy_paste;
        copyInput.style.background = '#fff';
    }

    if (statusEl) { statusEl.className = 'mt-2 small fw-bold text-success'; statusEl.textContent = 'PIX gerado! Aguardando pagamento...'; }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate me-1"></i> Gerar novamente'; }

    pollPixStatus(data.paymentId);
}

function pollPixStatus(paymentId) {
    const base = pixApiBase();
    if (!base || !paymentId) return;
    if (window._pixPollTimer) clearInterval(window._pixPollTimer);

    const statusEl = document.getElementById('pixStatus');
    let tries = 0;
    window._pixPollTimer = setInterval(async () => {
        tries += 1;
        if (tries > 30) {
            clearInterval(window._pixPollTimer);
            if (statusEl) { statusEl.className = 'mt-2 small fw-bold text-muted'; statusEl.textContent = 'Se preferir, envie seu pedido pelo WhatsApp confirmando o PIX.'; }
            return;
        }
        try {
            const res = await fetch(base + '/pix/' + paymentId);
            const data = await res.json().catch(() => ({}));
            if (data.approved) {
                clearInterval(window._pixPollTimer);
                if (statusEl) { statusEl.className = 'mt-2 small fw-bold text-success'; statusEl.textContent = '✅ Pagamento confirmado! Envie o pedido pelo WhatsApp.'; }
            }
        } catch (e) { /* ignora erros temporários de rede */ }
    }, 4000);
}

window.copiarPixDinamico = function () {
    const v = document.getElementById('pixDynamicCopy');
    if (!v || !v.value) { showToast('Gere o PIX primeiro!'); return; }
    const done = () => showToast('Código PIX copiado! 📋');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v.value).then(done, () => fallbackCopy(v.value, done));
    } else {
        fallbackCopy(v.value, done);
    }
};

function resetPixDinamico() {
    if (window._pixPollTimer) { clearInterval(window._pixPollTimer); window._pixPollTimer = null; }
    const qrImg = document.getElementById('pixDynamicQR');
    const place = document.getElementById('pixDynamicPlaceholder');
    const copyInput = document.getElementById('pixDynamicCopy');
    const statusEl = document.getElementById('pixStatus');
    const btn = document.getElementById('btnGerarPix');
    if (qrImg) { qrImg.src = ''; qrImg.style.display = 'none'; }
    if (place) place.style.display = '';
    if (copyInput) copyInput.value = '';
    if (statusEl) { statusEl.className = 'mt-2 small fw-bold'; statusEl.textContent = ''; }
    if (btn) btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles me-1"></i> Gerar PIX';
}

function createProductCard(item, index = 0) {
    let imgSrc = item.image || 'images/ags_coxinha.webp';
    if (imgSrc.startsWith('images/')) imgSrc = './' + imgSrc;

    const isPack = item.units > 1;
    const priceLabelText = isPack ? `Pacote com ${item.units || 6} unidades` : 'Por unidade';
    const packBadge = isPack
        ? `<span class="product-tag product-tag-pack"><i class="fa-solid fa-box-open"></i> ${item.units || 6} unidades</span>`
        : '';

    return `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm border-0 rounded-4 overflow-hidden product-card${isPack ? ' pack-card' : ''}" style="animation: slideUp 0.5s ease forwards; animation-delay: ${index * 0.05}s">
                <div class="product-card-top">
                    <span class="product-card-top-icon"><i class="fa-solid fa-snowflake"></i></span>
                </div>
                <div class="product-image-wrapper position-relative">
                    <img src="${imgSrc}" class="w-100 h-100" alt="${esc(item.name)}" style="object-fit: cover;" loading="lazy" onerror="this.src='https://via.placeholder.com/300x200?text=Imagem+Indisponivel'">
                    ${packBadge}
                </div>
                <div class="card-body d-flex flex-column text-start p-4">
                    <h5 class="card-title fw-bold mb-2" style="height: 3.4rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${esc(item.name)}</h5>
                    <p class="card-text text-muted small flex-grow-1 mb-3" style="height: 3.9rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${esc(item.desc)}</p>
                    <div class="card-footer-bar mt-auto pt-3 w-100">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="price-wrapper text-start">
                                <span class="price-label">${priceLabelText}</span>
                                <div class="d-flex align-items-center">
                                    <span class="card-price">${formatBRL(item.price)}</span>
                                </div>
                            </div>
                            <button class="btn-add-cart" onclick="addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price})" aria-label="Adicionar ao carrinho">
                                <i class="fa-solid fa-cart-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCategories() {
    if (!categoryContainer) return;
    const categories = ['all', ...new Set(menuItems.map(item => item.category))];
    categoryContainer.innerHTML = '';

    const sectionHead = document.createElement('div');
    sectionHead.className = 'section-head';
    sectionHead.innerHTML = `
        <span class="section-eyebrow"><i class="fa-solid fa-layer-group"></i> Cardápio</span>
        <h2 class="section-title">Descubra nossos salgados</h2>
        <p class="section-subtitle">Escolha uma categoria para filtrar</p>
    `;
    categoryContainer.appendChild(sectionHead);

    const chipWrap = document.createElement('div');
    chipWrap.className = 'category-chip-wrap';

    categories.forEach((cat, i) => {
        const btn = document.createElement('button');
        btn.className = `chip ${cat === activeCategory ? 'chip-active' : ''}`;
        btn.dataset.category = cat;
        btn.setAttribute('aria-pressed', cat === activeCategory ? 'true' : 'false');
        btn.style.animationDelay = `${0.1 + i * 0.06}s`;

        const count = cat === 'all' ? menuItems.filter(m => m.active !== false).length
            : menuItems.filter(m => m.category === cat && m.active !== false).length;

        btn.innerHTML = `<span class="chip-label">${categoryLabels[cat] || cat}</span><span class="chip-count">${count}</span>`;

        btn.onclick = () => {
            activeCategory = cat;
            renderCategories();
            renderMenu();
        };

        chipWrap.appendChild(btn);
    });

    categoryContainer.appendChild(chipWrap);
}

function renderMenu() {
    if (!menuGrid) return;
    menuGrid.innerHTML = '';

    const searchQuery = searchInput ? searchInput.value : '';

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesActive = item.active !== false;
        return matchesCategory && matchesSearch && matchesActive;
    });

    if (filteredItems.length === 0) {
        menuGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>Nenhum item encontrado para "<strong>${esc(searchQuery)}</strong>"</p>
            </div>`;
        return;
    }

    filteredItems.forEach((item, index) => {
        menuGrid.innerHTML += createProductCard(item, index);
    });
}

window.addToCart = function (id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    updateCartUI();
    showToast(`${esc(name)} adicionado! 🛒`);
};

window.updateCartItemQuantity = function (index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        updateCartUI();
    }
};

window.toggleDeliveryFields = function () {
    const isEntrega = document.getElementById('modeEntrega') ? document.getElementById('modeEntrega').checked : false;
    const deliveryFields = document.getElementById('deliveryAddressFields');
    const freightRow = document.getElementById('freightRow');

    if (deliveryFields) {
        deliveryFields.style.display = isEntrega ? 'block' : 'none';
    }
    if (freightRow) {
        freightRow.style.setProperty('display', isEntrega ? 'flex' : 'none', 'important');
    }
    updateCartUI();
};

window.checkCep = function (input) {
    let cep = input.value.replace(/\D/g, '');
    if (cep.length > 5) {
        input.value = cep.slice(0, 5) + '-' + cep.slice(5, 8);
    } else {
        input.value = cep;
    }

    if (cep.length === 8) {
        const fields = ['deliveryStreet', 'deliveryNeighborhood', 'deliveryCity', 'deliveryState'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = 'Carregando...';
                el.style.opacity = '0.7';
            }
        });

        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(response => response.json())
            .then(data => {
                fields.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.opacity = '1';
                });

                if (!data.erro) {
                    if (document.getElementById('deliveryStreet')) document.getElementById('deliveryStreet').value = data.logradouro || '';
                    if (document.getElementById('deliveryNeighborhood')) document.getElementById('deliveryNeighborhood').value = data.bairro || '';
                    if (document.getElementById('deliveryCity')) document.getElementById('deliveryCity').value = data.localidade || '';
                    if (document.getElementById('deliveryState')) document.getElementById('deliveryState').value = data.uf || '';

                    const numberField = document.getElementById('deliveryNumber');
                    if (numberField) {
                        numberField.focus();
                    }
                    showToast("Endereço localizado! 📍");
                    calculateFreight(cep);
                    updateCartUI();
                } else {
                    fields.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    });
                    showToast("CEP não encontrado!");
                }
            })
            .catch(() => {
                fields.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                showToast("Erro ao buscar CEP");
            });
    }
};

window.calculateFreight = function (cep) {
    if (!cep) cep = document.getElementById('deliveryCep') ? document.getElementById('deliveryCep').value.replace(/\D/g, '') : '';
    const freightElement = document.getElementById('cartFreight');

    if (cep.length === 8) {
        const lastDigits = parseInt(cep.substring(5));
        deliveryDistance = 1 + (lastDigits % 10);

        const baseFee = 8.00;
        let increment = 0;
        if (deliveryDistance > 3) {
            increment = (deliveryDistance - 3) * 0.60;
        }

        deliveryFee = baseFee + increment;
        if (freightElement) {
            freightElement.textContent = `${formatBRL(deliveryFee)} (${deliveryDistance.toFixed(1)}km)`;
        }
    } else {
        deliveryFee = 0;
        deliveryDistance = 0;
        if (freightElement) {
            freightElement.textContent = formatBRL(0);
        }
    }
    updateCartUI();
};

function updateCartUI() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartFreight = document.getElementById('cartFreight');
    const summaryUnits = document.getElementById('summaryUnits');

    const resumoBox = document.getElementById('descritivoPedido');
    const resumoNome = document.getElementById('resumoNome');
    const resumoEnd = document.getElementById('resumoEnd');
    const resumoItens = document.getElementById('resumoItens');
    const resumoTotal = document.getElementById('resumoTotal');

    if (!cartItemsContainer || !cartCount || !cartTotal) return;

    const totalUnits = cart.reduce((total, item) => {
        const prod = menuItems.find(p => p.id === item.id) || {};
        return total + item.quantity * (prod.units || 1);
    }, 0);
    cartCount.textContent = totalUnits;

    const offcanvasFooter = document.querySelector('.offcanvas-footer');

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-muted text-center my-4 py-4 bg-light rounded-4">Seu pedido está vazio.</p>';
        cartTotal.textContent = formatBRL(0);
        if (cartSubtotal) cartSubtotal.textContent = formatBRL(0);
        if (cartFreight) cartFreight.textContent = formatBRL(0);
        if (summaryUnits) summaryUnits.textContent = '0';
        if (resumoBox) resumoBox.style.display = 'none';
        if (offcanvasFooter) offcanvasFooter.style.display = 'none';
        return;
    }

    if (offcanvasFooter) offcanvasFooter.style.display = 'block';

    let itemsHTML = '';
    let itemsResumo = [];
    let subtotal = 0;

    cart.forEach((item, index) => {
        const prod = menuItems.find(p => p.id === item.id) || {};
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        itemsResumo.push(`${item.quantity}x ${item.name}`);

        let imgSrc = prod.image || 'images/ags_coxinha.webp';
        if (imgSrc.startsWith('images/')) imgSrc = './' + imgSrc;

        itemsHTML += `
            <div class="cart-item d-flex align-items-center border rounded-4 mb-3 shadow-sm p-0 overflow-hidden bg-white">
                <img src="${imgSrc}" class="object-fit-cover" alt="${esc(item.name)}" style="width: 70px; height: 70px; object-fit: cover;" onerror="this.src='images/ags_coxinha.webp'">
                <div class="flex-grow-1 overflow-hidden px-3 py-2">
                    <h6 class="fw-bold mb-1 text-truncate text-dark" style="font-size: 0.95rem;">${esc(item.name)}</h6>
                    <div class="text-amber fw-bold small">${formatBRL(item.price)} / un</div>
                    <div class="fw-bold mt-1 text-dark" style="font-size: 0.9rem;">${formatBRL(itemTotal)}</div>
                </div>
                <div class="pe-3 py-2 d-flex flex-column align-items-end gap-2">
                    <button class="btn btn-sm p-0 border-0 text-muted" onclick="updateCartItemQuantity(${index}, -1)" aria-label="Remover" title="${item.quantity === 1 ? 'Remover' : 'Diminuir'}">
                        <i class="fas ${item.quantity === 1 ? 'fa-trash-alt text-danger' : 'fa-minus'}"></i>
                    </button>
                    <div class="d-flex align-items-center rounded-pill p-1 border shadow-sm bg-light">
                        <button class="btn btn-sm border-0 rounded-circle d-flex align-items-center justify-content-center bg-white shadow-sm" style="width: 24px; height: 24px;" onclick="updateCartItemQuantity(${index}, 1)" aria-label="Aumentar">
                            <i class="fas fa-plus" style="font-size: 0.7rem;"></i>
                        </button>
                        <span class="fw-bold text-center px-1" style="width: 24px; font-size: 0.85rem;">${item.quantity}</span>
                    </div>
                </div>
            </div>
        `;
    });

    cartItemsContainer.innerHTML = itemsHTML;

    const isEntrega = document.getElementById('modeEntrega') ? document.getElementById('modeEntrega').checked : false;
    const currentFreight = isEntrega ? deliveryFee : 0;
    const finalTotal = subtotal + currentFreight;

    if (cartSubtotal) cartSubtotal.textContent = formatBRL(subtotal);
    if (cartFreight) cartFreight.textContent = formatBRL(currentFreight);
    cartTotal.textContent = formatBRL(finalTotal);
    if (summaryUnits) summaryUnits.textContent = `${totalUnits} salgado${totalUnits > 1 ? 's' : ''}`;

    if (resumoBox) {
        resumoBox.style.display = 'block';
        const nameInput = document.getElementById('customerName');
        const nomeVal = nameInput && nameInput.value.trim() ? nameInput.value.trim() : 'Pendente';
        if (resumoNome) resumoNome.textContent = nomeVal;

        if (isEntrega) {
            const streetInput = document.getElementById('deliveryStreet');
            const numInput = document.getElementById('deliveryNumber');
            const rua = streetInput && streetInput.value.trim() ? streetInput.value.trim() : '...';
            const num = numInput && numInput.value.trim() ? numInput.value.trim() : '...';
            if (resumoEnd) resumoEnd.textContent = `${rua}, ${num}`;
        } else {
            if (resumoEnd) resumoEnd.textContent = "Retirada no Local";
        }

        if (resumoItens) resumoItens.textContent = itemsResumo.join(', ');
        if (resumoTotal) resumoTotal.textContent = formatBRL(finalTotal);
    }
}

let mp = null;
let bricksBuilder = null;
let paymentBrickController = null;
let mpSdkLoading = false;

function loadMPScript() {
    if (document.querySelector('script[src*="sdk.mercadopago.com"]')) return Promise.resolve();
    if (mpSdkLoading) return new Promise(resolve => {
        const check = setInterval(() => {
            if (typeof MercadoPago !== 'undefined') { clearInterval(check); resolve(); }
        }, 50);
    });
    mpSdkLoading = true;
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://sdk.mercadopago.com/js/v2';
        s.onload = resolve;
        s.onerror = () => { mpSdkLoading = false; reject(); };
        document.head.appendChild(s);
    });
}

function ensureMercadoPago() {
    if (!mp && typeof MercadoPago !== 'undefined') {
        const pubKey = window.MP_PUBLIC_KEY || 'APP_USR-ccddbea8-7479-47a1-892b-3b74ca21fc89';
        mp = new MercadoPago(pubKey);
        bricksBuilder = mp.bricks();
    }
    return !!mp;
}

window.checkout = async function () {
    if (cart.length === 0) {
        showToast("Seu carrinho está vazio!");
        return;
    }

    const pubKey = window.MP_PUBLIC_KEY || 'APP_USR-ccddbea8-7479-47a1-892b-3b74ca21fc89';
    if (!pubKey) {
        showToast("Pagamento temporariamente indisponível.");
        return;
    }

    try {
        await loadMPScript();
    } catch (e) {
        showToast("Erro ao carregar sistema de pagamento.");
        return;
    }

    if (!ensureMercadoPago()) {
        showToast("Aguarde o carregamento do sistema de pagamento.");
        return;
    }

    const nameEl = document.getElementById('customerName');
    const phoneEl = document.getElementById('customerPhone');
    const name = nameEl ? nameEl.value.trim() : '';
    const phone = phoneEl ? phoneEl.value.trim() : '';
    const isEntrega = document.getElementById('modeEntrega') ? document.getElementById('modeEntrega').checked : false;

    if (!name || !phone) {
        showToast("Por favor, preencha seu nome e telefone!");
        return;
    }

    if (isEntrega) {
        const cepEl = document.getElementById('deliveryCep');
        const cep = cepEl ? cepEl.value.replace(/\D/g, '') : '';
        if (!cep || cep.length < 8 || deliveryFee <= 0) {
            showToast("Preencha o CEP corretamente para calcular a taxa de entrega!");
            return;
        }
    }

    const btnFinalizar = document.getElementById('btnFinalizar');
    const originalText = btnFinalizar ? btnFinalizar.innerHTML : '';

    if (paymentBrickController) {
        paymentBrickController.unmount();
    }

    if (btnFinalizar) {
        btnFinalizar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Carregando Pagamento...';
        btnFinalizar.disabled = true;
    }

    const currentFreight = isEntrega ? deliveryFee : 0;
    const totalAmount = cart.reduce((t, i) => t + (i.price * i.quantity), 0) + currentFreight;

    try {
        const settings = {
            initialization: {
                amount: totalAmount,
            },
            customization: {
                visual: {
                    font: 'Outfit',
                    style: {
                        theme: 'default',
                        customVariables: {
                            baseColor: '#D97706',
                            baseColorFirstVariant: '#B45309',
                            baseColorSecondVariant: '#FEF3C7',
                            errorColor: '#E11D48',
                            successColor: '#198754',
                            outlinePrimaryColor: '#D97706',
                            textPrimaryColor: '#271E17',
                            textSecondaryColor: '#6B5D52',
                            buttonTextColor: '#ffffff',
                            borderRadiusMedium: '20px',
                            borderRadiusLarge: '30px',
                            inputBorderWidth: '0px',
                            inputBackgroundColor: '#faf6f0',
                            inputVerticalPadding: '12px',
                            inputHorizontalPadding: '16px'
                        }
                    },
                    texts: {
                        formTitle: 'Resumo do Pagamento',
                        emailSectionTitle: 'Dados para Recebimento',
                        installmentsSectionTitle: 'Parcelamento',
                        cardholderName: {
                            label: 'Nome impresso no cartão',
                            placeholder: 'Ex: JOÃO DA SILVA'
                        },
                        selectInstallments: 'Escolha o número de parcelas',
                        formSubmit: 'Confirmar Pagamento',
                        paymentMethods: {
                            creditCardTitle: 'Cartão de Crédito',
                            bankTransferTitle: 'Pix'
                        },
                        ctaGeneralErrorLabel: 'Tentar Novamente',
                        ctaCardErrorLabel: 'Revisar dados do cartão',
                        ctaReturnLabel: 'Voltar ao Carrinho'
                    }
                },
                paymentMethods: {
                    bankTransfer: "all",
                    creditCard: "all",
                    debitCard: "all",
                    mercadoPago: "all",
                },
            },
            callbacks: {
                onReady: () => {
                    if (btnFinalizar) btnFinalizar.style.display = 'none';
                },
                onSubmit: ({ selectedPaymentMethod, formData }) => {
                    return new Promise((resolve, reject) => {
                        const customerData = {
                            customerName: name,
                            customerPhone: phone,
                            isEntrega: isEntrega,
                            deliveryFee: currentFreight,
                            loja: 'fg_salgados',
                            deliveryAddress: isEntrega ? {
                                zipCode: document.getElementById('deliveryCep').value,
                                street: document.getElementById('deliveryStreet').value,
                                number: document.getElementById('deliveryNumber').value,
                                neighborhood: document.getElementById('deliveryNeighborhood').value,
                                city: document.getElementById('deliveryCity').value,
                                state: document.getElementById('deliveryState').value,
                                note: document.getElementById('deliveryNote').value
                            } : null
                        };

                        const checkoutUrl = window.CHECKOUT_URL || 'https://agsdelivery.com.br/checkout_transparente.php';

                        fetch(checkoutUrl, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ formData, cart, customer: customerData, loja: 'fg_salgados' }),
                        })
                            .then((response) => response.json())
                            .then((data) => {
                                if (data.success) {
                                    if (data.qr_code_base64) sessionStorage.setItem('pix_qr_code', data.qr_code_base64);
                                    if (data.qr_code) sessionStorage.setItem('pix_copy_paste', data.qr_code);

                                    const myOrder = {
                                        id: data.payment_id || ('c' + Date.now()),
                                        numero: getClientOrders().reduce((m, o) => Math.max(m, o.numero || 0), 0) + 1,
                                        cliente: name,
                                        telefone: phone,
                                        itens: cart.map(it => `${it.quantity}x ${it.name}`).join(', '),
                                        total: totalAmount,
                                        modo: isEntrega ? 'entrega' : 'retirada',
                                        pagamento: 'Mercado Pago',
                                        loja: 'fg_salgados',
                                        status: 'pago',
                                        data: new Date().toISOString()
                                    };
                                    saveClientOrder(myOrder);

                                    resolve(data.full_response);

                                    if (!data.full_response || !data.full_response.status_detail || data.full_response.status_detail !== 'pending_challenge') {
                                        cart = [];
                                        updateCartUI();
                                        setTimeout(() => {
                                            window.location.href = `https://agsdelivery.com.br/sucesso.php?payment_id=${data.payment_id}`;
                                        }, 1000);
                                    }
                                } else {
                                    showToast("Erro: " + (data.error || "Tente novamente."));
                                    reject();
                                }
                            })
                            .catch((error) => {
                                console.error(error);
                                showToast("Erro ao processar pagamento.");
                                reject();
                            });
                    });
                },
                onError: (error) => {
                    console.error("Erro MP:", error);
                    showToast("Erro ao carregar o pagamento. Tente novamente.");
                    if (btnFinalizar) {
                        btnFinalizar.style.display = 'block';
                        btnFinalizar.disabled = false;
                        btnFinalizar.innerHTML = originalText;
                    }
                },
            },
        };
        paymentBrickController = await bricksBuilder.create("payment", "paymentBrick_container", settings);
    } catch (e) {
        console.error("Erro crítico MP:", e);
        if (btnFinalizar) {
            btnFinalizar.style.display = 'block';
            btnFinalizar.disabled = false;
            btnFinalizar.innerHTML = originalText;
        }
        showToast("Erro ao carregar pagamento.");
    }
};

function getClientOrders() {
    try {
        return JSON.parse(localStorage.getItem(CLIENT_ORDERS_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveClientOrder(order) {
    const orders = getClientOrders();
    orders.unshift(order);
    localStorage.setItem(CLIENT_ORDERS_KEY, JSON.stringify(orders));
}

function formatOrderDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatOrderStatus(s) {
    const map = { pendente: 'Pendente', preparo: 'Em preparo', pronto: 'Pronto', entregue: 'Entregue' };
    return map[s] || s || 'Pendente';
}

window.openMyOrders = function () {
    renderMyOrders();
    const modalEl = document.getElementById('myOrdersModal');
    if (window.bootstrap && bootstrap.Modal && modalEl) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
};

function renderMyOrders() {
    const list = document.getElementById('myOrdersList');
    if (!list) return;
    const orders = getClientOrders();
    if (orders.length === 0) {
        list.innerHTML = '<p class="text-muted text-center my-4 py-4 bg-light rounded-4">Você ainda não fez pedidos por este aparelho.</p>';
        return;
    }
    list.innerHTML = orders.map(o => `
        <div class="bg-white border rounded-4 p-3 shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                <span class="fw-bold">Pedido #${o.numero}</span>
                <span class="badge rounded-pill ${o.status === 'pendente' ? 'text-bg-warning' : o.status === 'entregue' ? 'text-bg-success' : 'text-bg-info'}">${formatOrderStatus(o.status)}</span>
            </div>
            <div class="small text-muted mb-2">${formatOrderDate(o.data)}</div>
            <p class="mb-1 small"><i class="fa-solid fa-box me-1"></i> ${esc(o.itens)}</p>
            <p class="mb-1 small"><i class="fa-solid fa-location-dot me-1"></i> ${o.modo === 'entrega' ? (esc(o.endereco) || 'Entrega') : 'Retirada no local'}</p>
            <p class="mb-0 small"><i class="fa-solid fa-money-bill-wave me-1"></i> ${esc(o.pagamento) || '-'} · <strong>${formatBRL(o.total)}</strong></p>
        </div>
    `).join('');
}

function bindSearch() {
    if (!searchInput) return;
    searchInput.addEventListener('input', () => {
        renderMenu();
    });
}

function bindContactLinks() {
    const insta = (savedData.contact && savedData.contact.insta ? savedData.contact.insta : DEFAULT_CONTACT.insta).replace('@', '');
    const heroBtn = document.getElementById('heroWhatsBtn');
    const footInsta = document.getElementById('footInstaLink');
    const footWhats = document.getElementById('footWhatsLink');

    if (heroBtn) heroBtn.href = generateWhatsLink("Olá! Gostaria de consultar sobre os salgados congelados 🙂");
    if (footWhats) footWhats.href = generateWhatsLink("Olá! Vim pelo site da FG Salgados 🙂");
    if (footInsta) footInsta.href = `https://instagram.com/${insta}`;
}

window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (header) {
        header.classList.toggle('scrolled', window.scrollY > 20);
    }
});

function bindValidation() {
    const phoneEl = document.getElementById('customerPhone');
    if (phoneEl) {
        phoneEl.addEventListener('input', () => {
            applyPhoneMask(phoneEl);
            validateCheckout();
        });
        phoneEl.addEventListener('blur', () => {
            setFieldState(phoneEl, isValidPhone(phoneEl.value) ? 'valid' : 'invalid');
        });
    }

    const nameEl = document.getElementById('customerName');
    if (nameEl) {
        nameEl.addEventListener('blur', () => {
            setFieldState(nameEl, isValidName(nameEl.value) ? 'valid' : 'invalid');
        });
    }

    const confirmEl = document.getElementById('confirmDados');
    if (confirmEl) {
        confirmEl.addEventListener('change', () => {
            confirmEl.classList.remove('is-invalid');
            validateCheckout();
        });
    }

    const cartModal = document.getElementById('cartModal');
    if (cartModal) {
        cartModal.addEventListener('shown.bs.modal', () => {
            validateCheckout();
        });
    }
}

loadSavedData();
renderCategories();
renderMenu();
updateCartUI();
bindSearch();
bindContactLinks();
bindValidation();
initPixDynamic();
