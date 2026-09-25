import { esc, formatBRL, showToast, fallbackCopy } from './utils.js';
import { menuItems, activeCategory, setActiveCategory, cart, deliveryFee, validateCheckout, savedData, DEFAULT_CONTACT, getClientOrders } from './cart.js';
import { initPixDynamic, resetPixDinamico } from './api.js';

const categoryLabels = {
    'all': '🍽️ Todos',
    'fritos': '🍗 Salgados Fritos',
    'assados': '🥐 Salgados Assados',
    'burgers': '🍔 Lanches / Hambúrgueres',
    'pacotes': '📦 Pacotes com 6 e 1 Unidade',
    'coxinha': '🍗 Coxinhas',
    'croissant': '🥐 Croissants',
    'lanches': '🥪 Lanches Naturais',
    'salgados': '🥖 Salgados'
};

export function getWhatsNumber() {
    const rawNum = (savedData.contact && savedData.contact.whats ? savedData.contact.whats : DEFAULT_CONTACT.whats).replace(/\D/g, '');
    return (rawNum.startsWith('55') ? rawNum : '55' + rawNum);
}

export function generateWhatsLink(msg) {
    return `https://wa.me/${getWhatsNumber()}?text=${encodeURIComponent(msg)}`;
}

export function getPixKey() {
    const pixEl = document.getElementById('pixKey');
    if (pixEl && pixEl.value.trim()) return pixEl.value.trim();
    return (savedData.contact && savedData.contact.pix) ? savedData.contact.pix : DEFAULT_CONTACT.pix;
}

export function togglePaymentMethod() {
    const isPix = document.getElementById('payPix') ? document.getElementById('payPix').checked : true;
    const pixPanel = document.getElementById('pixPanel');
    const localPanel = document.getElementById('localPanel');
    if (pixPanel) pixPanel.style.display = isPix ? 'block' : 'none';
    if (localPanel) localPanel.style.display = isPix ? 'none' : 'block';
    initPixDynamic();
    updateCartUI();
}

export function copyPixKey() {
    const pixInput = document.getElementById('pixKey');
    if (!pixInput) return;
    const text = pixInput.value.trim();

    const done = () => showToast("Chave PIX copiada! 📋");

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
        fallbackCopy(text, done);
    }
}

export function copyPixUnica() {
    const v = document.getElementById('pixKey');
    if (!v) return;
    const done = () => showToast('Chave PIX copiada! 📋');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v.value).then(done, () => fallbackCopy(v.value, done));
    } else {
        fallbackCopy(v.value, done);
    }
}

export function createProductCard(item, index = 0) {
    let imgSrc = item.image || 'images/ags_coxinha.webp';
    if (imgSrc.startsWith('images/')) imgSrc = './' + imgSrc;

    const priceLabelText = 'Por unidade';
    const packBadge = '';

    return `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm border-0 rounded-4 overflow-hidden product-card" style="animation: slideUp 0.5s ease forwards; animation-delay: ${index * 0.05}s">
                <div class="product-card-top">
                    <span class="product-card-top-icon"><i class="fa-solid fa-snowflake"></i></span>
                </div>
                <div class="product-image-wrapper position-relative">
                    <img src="${imgSrc}" class="w-100 h-100" alt="${esc(item.name)}" style="object-fit: cover;" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://via.placeholder.com/300x200?text=Imagem+Indisponivel'">
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

export function renderCategories() {
    const categoryContainer = document.getElementById('categoryContainer');
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
            setActiveCategory(cat);
            renderCategories();
            renderMenu();
        };

        chipWrap.appendChild(btn);
    });

    categoryContainer.appendChild(chipWrap);
}

export function renderMenu() {
    const menuGrid = document.getElementById('menuGrid');
    const searchInput = document.getElementById('searchInput');
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

export function toggleDeliveryFields() {
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
}

export function checkCep(input) {
    let cep = input.value.replace(/\D/g, '');
    if (cep.length > 5) {
        input.value = cep.substring(0, 5) + '-' + cep.substring(5, 8);
    } else {
        input.value = cep;
    }

    if (cep.length === 8) {
        if (window.fetchAddress) {
            window.fetchAddress(cep);
        }
    }
}

export function updateCartUI() {
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

    if (window._pixAmount !== undefined && Math.abs(window._pixAmount - finalTotal) > 0.01) {
        window._pixAmount = undefined;
        resetPixDinamico();
    }

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

export function openMyOrders() {
    renderMyOrders();
    const modalEl = document.getElementById('myOrdersModal');
    if (window.bootstrap && window.bootstrap.Modal && modalEl) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
}

export function renderMyOrders() {
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
                <span class="fw-bold">Pedido #${o.numero} <small class="text-muted ms-1">(ID: ${o.id.replace('c', '')})</small></span>
                <span class="badge rounded-pill ${o.status === 'pendente' ? 'text-bg-warning' : o.status === 'entregue' ? 'text-bg-success' : 'text-bg-info'}">${formatOrderStatus(o.status)}</span>
            </div>
            <div class="small text-muted mb-2">${formatOrderDate(o.data)}</div>
            <p class="mb-1 small"><i class="fa-solid fa-box me-1"></i> ${esc(o.itens)}</p>
            <p class="mb-1 small"><i class="fa-solid fa-location-dot me-1"></i> ${o.modo === 'entrega' ? (esc(o.endereco) || 'Entrega') : 'Retirada no local'}</p>
            <p class="mb-0 small"><i class="fa-solid fa-money-bill-wave me-1"></i> ${esc(o.pagamento) || '-'} · <strong>${formatBRL(o.total)}</strong></p>
        </div>
    `).join('');
}

// Make globally accessible
window.togglePaymentMethod = togglePaymentMethod;
window.copyPixKey = copyPixKey;
window.copyPixUnica = copyPixUnica;
window.toggleDeliveryFields = toggleDeliveryFields;
window.checkCep = checkCep;
window.openMyOrders = openMyOrders;
window.updateCartUI = updateCartUI;
