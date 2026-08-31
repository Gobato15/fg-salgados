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
    const isEntrega = document.getElementById('modeEntrega').checked;
    const deliveryFields = document.getElementById('deliveryAddressFields');
    const freightRow = document.getElementById('freightRow');

    if (isEntrega) {
        deliveryFields.style.display = 'block';
        freightRow.style.setProperty('display', 'flex', 'important');
    } else {
        deliveryFields.style.display = 'none';
        freightRow.style.setProperty('display', 'none', 'important');
    }
    updateCartUI();
};

window.checkCep = function (input) {
    let cep = input.value.replace(/\D/g, '');
    if (cep.length > 5) {
        input.value = cep.substring(0, 5) + '-' + cep.substring(5, 8);
    } else {
        input.value = cep;
    }

    if (cep.length === 8) {
        fetchAddress(cep);
    }
};

async function fetchAddress(cep) {
    const cityField = document.getElementById('deliveryCity');
    const streetField = document.getElementById('deliveryStreet');

    cityField.value = "Buscando...";
    streetField.value = "Buscando...";

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (!data.erro) {
            cityField.value = `${data.localidade} - ${data.bairro}`;
            streetField.value = data.logradouro;
            calculateFreight(cep);
        } else {
            showToast("CEP não encontrado!");
            cityField.value = "";
            streetField.value = "";
        }
    } catch (e) {
        console.error("Erro ao buscar CEP", e);
        cityField.value = "";
        streetField.value = "";
    }
}

window.calculateFreight = function (cep) {
    cep = String(cep || document.getElementById('deliveryCep').value).replace(/\D/g, '');
    const freightElement = document.getElementById('cartFreight');

    if (cep.length === 8) {
        const lastDigits = parseInt(cep.substring(5));
        deliveryDistance = 1 + (lastDigits % 10);

        const baseFee = 7.00;
        let increment = 0;
        if (deliveryDistance > 3) {
            increment = (deliveryDistance - 3) * 0.60;
        }

        deliveryFee = baseFee + increment;
        freightElement.textContent = `${formatBRL(deliveryFee)} (${deliveryDistance.toFixed(1)}km)`;
    } else {
        deliveryFee = 0;
        deliveryDistance = 0;
        freightElement.textContent = formatBRL(0);
    }
    updateCartUI();
};

function updateCartUI() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartFreight = document.getElementById('cartFreight');
    const summaryTrays = document.getElementById('summaryTrays');
    const summaryUnits = document.getElementById('summaryUnits');

    const resumoBox = document.getElementById('descritivoPedido');
    const resumoNome = document.getElementById('resumoNome');
    const resumoEnd = document.getElementById('resumoEnd');
    const resumoItens = document.getElementById('resumoItens');
    const resumoTotal = document.getElementById('resumoTotal');

    if (!cartItemsContainer || !cartCount || !cartTotal) return;

    const totalTrays = cart.reduce((total, item) => total + item.quantity, 0);
    const totalUnits = cart.reduce((total, item) => {
        const prod = menuItems.find(p => p.id === item.id) || {};
        return total + item.quantity * (prod.units || 1);
    }, 0);
    cartCount.textContent = totalUnits;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-muted text-center my-4 py-4 bg-light rounded-4">Seu pedido está vazio.</p>';
        cartTotal.textContent = formatBRL(0);
        if (cartSubtotal) cartSubtotal.textContent = formatBRL(0);
        if (cartFreight) cartFreight.textContent = formatBRL(0);
        if (summaryTrays) summaryTrays.textContent = '0';
        if (summaryUnits) summaryUnits.textContent = '0';
        if (resumoBox) resumoBox.style.display = 'none';
        return;
    }

    let itemsHTML = '';
    let itemsResumo = [];
    let subtotal = 0;

    cart.forEach((item, index) => {
        const prod = menuItems.find(p => p.id === item.id) || {};
        const units = prod.units || 1;
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        itemsResumo.push(`${item.quantity}x ${item.name}`);

        itemsHTML += `
            <div class="cart-item">
                <div class="flex-grow-1 overflow-hidden pe-2">
                    <h6 class="fw-bold mb-1 text-truncate text-dark" style="font-size: 0.95rem;">${esc(item.name)}</h6>
                    <div class="text-success fw-bold small">${formatBRL(item.price)} / unidade</div>
                    <div class="text-muted small">${item.quantity}x unidade${item.quantity > 1 ? 's' : ''}</div>
                </div>
                <div class="d-flex flex-column align-items-end">
                    <div class="fw-bold text-dark mb-2" style="font-size: 0.95rem;">${formatBRL(itemTotal)}</div>
                    <div class="d-flex align-items-center bg-light rounded-pill p-1 border shadow-sm">
                        <button class="btn btn-sm border-0 rounded-circle d-flex align-items-center justify-content-center text-secondary"
                                style="width: 26px; height: 26px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                onclick="updateCartItemQuantity(${index}, -1)" aria-label="Diminuir">
                            <i class="fas ${item.quantity === 1 ? 'fa-trash-alt text-danger' : 'fa-minus'}" style="font-size: 0.75rem;"></i>
                        </button>
                        <span class="fw-bold text-dark text-center" style="width: 26px; font-size: 0.9rem;">${item.quantity}</span>
                        <button class="btn btn-sm border-0 rounded-circle d-flex align-items-center justify-content-center text-dark"
                                style="width: 26px; height: 26px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
                                onclick="updateCartItemQuantity(${index}, 1)" aria-label="Aumentar">
                            <i class="fas fa-plus" style="font-size: 0.75rem;"></i>
                        </button>
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

    if (summaryTrays) summaryTrays.textContent = `${totalUnits} item${totalUnits > 1 ? 's' : ''}`;
    if (summaryUnits) summaryUnits.textContent = `${totalUnits} salgado${totalUnits > 1 ? 's' : ''}`;

    if (resumoBox) {
        resumoBox.style.display = 'block';
        const nomeVal = document.getElementById('customerName').value || 'Pendente';
        resumoNome.textContent = nomeVal;

        if (isEntrega) {
            const rua = document.getElementById('deliveryStreet').value || '...';
            const num = document.getElementById('deliveryNumber').value || '...';
            resumoEnd.textContent = `${rua}, ${num}`;
        } else {
            resumoEnd.textContent = "Retirada no Local";
        }

        resumoItens.textContent = itemsResumo.join(', ');
        resumoTotal.textContent = formatBRL(finalTotal);

        const resumoPag = document.getElementById('resumoPag');
        if (resumoPag) {
            const payPix = document.getElementById('payPix') ? document.getElementById('payPix').checked : true;
            resumoPag.textContent = payPix ? 'PIX' : 'No Local';
        }
    }

    validateCheckout();
}

window.checkout = function () {
    if (cart.length === 0) {
        showToast("Adicione pelo menos 1 salgado ao pedido!");
        return;
    }
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();

    if (!isValidName(name)) {
        showToast("Informe seu nome completo (nome e sobrenome).");
        setFieldState(document.getElementById('customerName'), 'invalid');
        return;
    }
    if (!isValidPhone(phone)) {
        showToast("Informe um telefone válido com DDD (ex: (19) 99609-0540).");
        setFieldState(document.getElementById('customerPhone'), 'invalid');
        return;
    }

    const isEntrega = document.getElementById('modeEntrega').checked;

    if (isEntrega) {
        const cepEl = document.getElementById('deliveryCep');
        const cityEl = document.getElementById('deliveryCity');
        const streetEl = document.getElementById('deliveryStreet');
        const numEl = document.getElementById('deliveryNumber');

        const cepOk = isValidCepFormat(cepEl.value) && cityEl.value.trim() !== '' && cityEl.value !== 'Buscando...';
        const addressOk = cepOk && streetEl.value.trim() !== '' && numEl.value.trim() !== '';

        if (!isValidCepFormat(cepEl.value)) {
            showToast("Informe um CEP válido (8 dígitos).");
            setFieldState(cepEl, 'invalid');
            return;
        }
        if (!addressOk) {
            showToast("Preencha o endereço completo para entrega (rua, nº e CEP válido).");
            setFieldState(streetEl, streetEl.value.trim() ? 'valid' : 'invalid');
            setFieldState(numEl, numEl.value.trim() ? 'valid' : 'invalid');
            return;
        }
    }

    const confirmEl = document.getElementById('confirmDados');
    if (confirmEl && !confirmEl.checked) {
        showToast("Marque a confirmação de que seus dados estão corretos.");
        confirmEl.classList.add('is-invalid');
        return;
    }

    const currentFreight = isEntrega ? deliveryFee : 0;

    let text = "👋 *Olá! Gostaria de fazer um pedido de Salgados Congelados FG Salgados:*\n\n";

    let totalUnits = 0;
    let totalPrice = 0;

    cart.forEach(item => {
        const prod = menuItems.find(p => p.id === item.id) || {};
        const units = prod.units || 1;
        const itemTotal = item.price * item.quantity;
        totalUnits += item.quantity * units;
        totalPrice += itemTotal;
        const qtdText = units === 1 ? `${item.quantity}x` : `${item.quantity}x (${item.quantity * units}un)`;
        text += `▪️ *${qtdText} ${item.name}* -> ${formatBRL(itemTotal)}\n`;
    });

    text += `\n📦 *Total de Salgados:* ${totalUnits}`;
    if (isEntrega) {
        text += `\n🚚 *Taxa de Entrega:* ${formatBRL(currentFreight)} (${deliveryDistance.toFixed(1)}km)`;
    } else {
        text += `\n🏪 *Retirada no Local* (sem taxa de entrega)`;
    }
    text += `\n💰 *Valor Total:* ${formatBRL(totalPrice + currentFreight)}`;

    const payPix = document.getElementById('payPix') ? document.getElementById('payPix').checked : true;
    if (payPix) {
        text += `\n💳 *Pagamento:* PIX (chave: ${getPixKey()})`;
    } else {
        text += `\n💵 *Pagamento:* No local (dinheiro ou PIX)`;
    }

    text += `\n\n👤 *Nome:* ${name}`;
    text += `\n📱 *Telefone:* ${phone}`;

    if (isEntrega) {
        const rua = document.getElementById('deliveryStreet').value;
        const num = document.getElementById('deliveryNumber').value;
        const note = document.getElementById('deliveryNote').value;
        const cidade = document.getElementById('deliveryCity').value;
        text += `\n📍 *Endereço de Entrega:* ${rua}, ${num}${note ? ' — ' + note : ''}${cidade ? ' (' + cidade + ')' : ''}`;
    }

    text += `\n\nPodemos combinar a entrega/retirada?`;

    const myOrder = {
        id: 'c' + Date.now(),
        numero: getClientOrders().reduce((m, o) => Math.max(m, o.numero || 0), 0) + 1,
        cliente: name,
        telefone: phone,
        itens: cart.map(it => {
            const prod = menuItems.find(p => p.id === it.id) || {};
            const units = prod.units || 1;
            return units === 1 ? `${it.quantity}x ${it.name}` : `${it.quantity}x ${it.name} (${it.quantity * units}un)`;
        }).join(', '),
        total: totalPrice + currentFreight,
        modo: isEntrega ? 'entrega' : 'retirada',
        pagamento: payPix ? 'PIX' : 'No local',
        endereco: isEntrega ? `${document.getElementById('deliveryStreet').value}, ${document.getElementById('deliveryNumber').value}${document.getElementById('deliveryCity').value ? ' (' + document.getElementById('deliveryCity').value + ')' : ''}` : '',
        status: 'pendente',
        data: new Date().toISOString()
    };
    saveClientOrder(myOrder);

    window.open(generateWhatsLink(text), "_blank", "noopener,noreferrer");
    showToast("Abrindo WhatsApp com seu pedido!");
    setTimeout(() => {
        window.location.href = 'sucesso.html';
    }, 1500);
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

    const cartBtn = document.querySelector('[data-bs-target="#cartModal"]');
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
