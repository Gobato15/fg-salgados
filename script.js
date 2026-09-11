let menuItems = [];
let cart = [];
let deliveryFee = 0;
let deliveryDistance = 0;
let activeCategory = 'all';

const CART_STORAGE_KEY = 'fg_cart';
const CUSTOMER_STORAGE_KEY = 'fg_customer';
const CLIENT_ORDERS_KEY = 'fg_client_orders';

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return encodeURIComponent(String(str));
}

function resolveImage(path) {
    if (!path) return './images/ags_coxinha.webp';
    if (path.startsWith('http') || path.startsWith('./')) return path;
    return path.startsWith('images/') ? './' + path : './images/' + path;
}

function formatBRL(val) {
    return 'R$ ' + val.toFixed(2).replace('.', ',');
}

// ── Persistência do Carrinho ──
function saveCart() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {}
}

function loadCart() {
    try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                cart = parsed;
            }
        }
    } catch (e) {}
}

function clearSavedCart() {
    try {
        localStorage.removeItem(CART_STORAGE_KEY);
    } catch (e) {}
}

function saveCustomerFields() {
    try {
        const fields = {
            name: document.getElementById('customerName')?.value || '',
            phone: document.getElementById('customerPhone')?.value || '',
            mode: document.querySelector('input[name="deliveryMode"]:checked')?.value || 'retirada',
            cep: document.getElementById('deliveryCep')?.value || '',
            street: document.getElementById('deliveryStreet')?.value || '',
            number: document.getElementById('deliveryNumber')?.value || '',
            neighborhood: document.getElementById('deliveryNeighborhood')?.value || '',
            city: document.getElementById('deliveryCity')?.value || '',
            state: document.getElementById('deliveryState')?.value || '',
            note: document.getElementById('deliveryNote')?.value || ''
        };
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(fields));
    } catch (e) {}
}

function loadCustomerFields() {
    try {
        const saved = localStorage.getItem(CUSTOMER_STORAGE_KEY);
        if (!saved) return;
        const fields = JSON.parse(saved);
        const setName = document.getElementById('customerName');
        if (setName && fields.name) setName.value = fields.name;
        const setPhone = document.getElementById('customerPhone');
        if (setPhone && fields.phone) setPhone.value = fields.phone;
        if (fields.mode === 'entrega') {
            const modeEntrega = document.getElementById('modeEntrega');
            if (modeEntrega) { modeEntrega.checked = true; toggleDeliveryFields(); }
        }
        if (fields.cep) { const el = document.getElementById('deliveryCep'); if (el) el.value = fields.cep; }
        if (fields.street) { const el = document.getElementById('deliveryStreet'); if (el) el.value = fields.street; }
        if (fields.number) { const el = document.getElementById('deliveryNumber'); if (el) el.value = fields.number; }
        if (fields.neighborhood) { const el = document.getElementById('deliveryNeighborhood'); if (el) el.value = fields.neighborhood; }
        if (fields.city) { const el = document.getElementById('deliveryCity'); if (el) el.value = fields.city; }
        if (fields.state) { const el = document.getElementById('deliveryState'); if (el) el.value = fields.state; }
        if (fields.note) { const el = document.getElementById('deliveryNote'); if (el) el.value = fields.note; }
        if (fields.cep && fields.cep.replace(/\D/g, '').length === 8 && typeof calculateFreight === 'function') {
            calculateFreight(fields.cep.replace(/\D/g, ''));
        }
    } catch (e) {}
}

function clearCustomerFields() {
    try { localStorage.removeItem(CUSTOMER_STORAGE_KEY); } catch (e) {}
    ['customerName','customerPhone','deliveryCep','deliveryStreet','deliveryNumber','deliveryNeighborhood','deliveryCity','deliveryState','deliveryNote']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const modeRetirada = document.getElementById('modeRetirada');
    if (modeRetirada) { modeRetirada.checked = true; toggleDeliveryFields(); }
}

// ── Elementos do DOM ──
const menuGrid = document.getElementById('menuGrid');
const categoryContainer = document.getElementById('categoryContainer');
const searchInput = document.getElementById('searchInput');

const categoryLabels = {
    'all': '<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg> Todos',
    'fritos': '🍗 Salgados Fritos',
    'assados': '🥐 Salgados Assados',
    'burgers': '🍔 Lanches / Hambúrgueres',
    'pacotes': '📦 Pacotes'
};

function categoryDisplayName(cat) {
    cat = String(cat);
    const label = categoryLabels[cat];
    if (label) return label.replace(/<[^>]*>/g, '').trim();
    return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ── Carregar Produtos ──
function loadMenu() {
    menuItems = (window.fgMenuItems || []).map(item => ({
        ...item,
        id: String(item.id),
        active: item.active !== false
    }));

    const seen = new Set();
    menuItems = menuItems.filter(it => {
        if (!it.image) return false;
        if (seen.has(it.id)) return false;
        seen.add(it.id);
        return true;
    });

    renderCategories();
    renderMenu();
    loadCart();
    updateCartUI();
    loadCustomerFields();
}

// ── Skeleton Loading ──
function renderSkeletons() {
    const skeletonCardHTML = `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="skeleton-card">
                <div class="skeleton-img-box skeleton"></div>
                <div class="card-body">
                    <div class="skeleton-title skeleton"></div>
                    <div class="skeleton-desc skeleton"></div>
                    <div class="skeleton-desc skeleton"></div>
                    <div class="skeleton-desc-short skeleton"></div>
                    <div class="skeleton-footer">
                        <div class="skeleton-price-box">
                            <div class="skeleton-price-lbl skeleton"></div>
                            <div class="skeleton-price-val skeleton"></div>
                        </div>
                        <div class="skeleton-btn-circle skeleton"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    if (menuGrid) menuGrid.innerHTML = Array(6).fill(skeletonCardHTML).join('');
}

// ── Card de Produto ──
function createProductCard(item, index = 0) {
    let imgSrc = resolveImage(item.image);
    const isPack = item.units > 1;
    const priceLabelText = isPack ? `Pacote com ${item.units || 6} unidades` : 'Por unidade';
    const packBadge = isPack
        ? `<span class="product-tag product-tag-pack" style="position:absolute;top:14px;left:12px;z-index:2;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;padding:6px 12px;border-radius:99px;letter-spacing:0.2px;box-shadow:0 4px 12px rgba(0,0,0,0.18);background:linear-gradient(135deg,#F59E0B,#D97706);color:#FFF;"><i class="fa-solid fa-box-open"></i> ${item.units || 6} unidades</span>`
        : '';

    return `
        <div class="col-12 col-md-6 col-lg-4 menu-item-col" data-category="${escapeHtml(item.category)}" data-name="${escapeHtml(item.name.toLowerCase())}" data-id="${escapeAttr(item.id)}">
            <div class="card h-100 rounded-5 overflow-hidden product-card" style="animation: slideUp 0.5s ease forwards; animation-delay: ${index * 0.05}s">
                <div class="position-relative overflow-hidden bg-light">
                    ${packBadge}
                    <img src="${imgSrc}" class="card-img-top object-fit-cover" alt="${escapeHtml(item.name)}" style="height: 200px;" loading="${index < 3 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${index < 3 ? 'high' : 'low'}" onerror="this.onerror=null;this.src='./images/ags_coxinha.webp'" onload="this.classList.add('loaded')">
                </div>
                <div class="card-body d-flex flex-column text-start p-3 bg-body">
                    <div class="card-category">${escapeHtml(categoryDisplayName(item.category))}</div>
                    <h5 class="card-title fw-bolder mb-1 text-body-emphasis" style="overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; min-height: auto;">${escapeHtml(item.name)}</h5>
                    <p class="card-text text-secondary small flex-grow-1 mb-2" style="overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; min-height: auto;">${escapeHtml(item.description || '')}</p>
                    <div class="mt-auto pt-3 border-top border-subtle w-100">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="price-wrapper text-start">
                                <span class="price-label">${priceLabelText}</span>
                                <div class="d-flex align-items-center">
                                    <span class="fw-black price-vibrant" style="font-size: 1.4rem;">${formatBRL(item.price)}</span>
                                </div>
                            </div>
                            <button class="btn-add-cart" onclick="addToCart('${escapeAttr(item.id)}', '${escapeAttr(item.name)}', ${item.price}, this)" aria-label="Adicionar ao carrinho">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ── Renderizar Categorias ──
function renderCategories() {
    if (!categoryContainer) return;
    const productCats = [...new Set(menuItems.map(item => item.category))];
    const categories = ['all', ...productCats];

    categoryContainer.innerHTML = '';
    categoryContainer.className = 'categories d-flex flex-nowrap justify-content-start mb-4';

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `btn ${cat === 'all' ? 'category-active' : 'category-inactive'} rounded-pill px-4 py-2 me-2 mb-2 fw-semibold`;
        btn.dataset.category = cat;
        if (cat !== 'all') {
            btn.innerHTML = categoryLabels[cat] || escapeHtml(categoryDisplayName(cat));
        } else {
            btn.innerHTML = categoryLabels[cat];
        }
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', cat === 'all' ? 'true' : 'false');

        btn.onclick = () => {
            document.querySelectorAll('.categories .btn').forEach(b => {
                b.classList.remove('category-active');
                b.classList.add('category-inactive');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.remove('category-inactive');
            btn.classList.add('category-active');
            btn.setAttribute('aria-selected', 'true');
            activeCategory = cat;
            btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

            document.querySelectorAll('.menu-item-col').forEach(col => {
                if (!col.classList.contains('d-none')) col.classList.add('menu-fade-out');
            });
            setTimeout(() => {
                renderMenu();
                document.querySelectorAll('.menu-item-col').forEach(col => {
                    col.classList.remove('menu-fade-out');
                    if (!col.classList.contains('d-none')) col.classList.add('menu-fade-in');
                });
            }, 200);
        };

        categoryContainer.appendChild(btn);
    });
}

// ── Renderizar Menu ──
function renderMenu() {
    if (!menuGrid) return;
    menuGrid.innerHTML = '';
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
        const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery);
        const matchesActive = item.active !== false;
        return matchesCategory && matchesSearch && matchesActive;
    });

    if (filteredItems.length === 0) {
        menuGrid.innerHTML = `
            <div class="empty-state w-100">
                <span class="empty-icon">🔍</span>
                <h4>Nada encontrado</h4>
                <p>Nenhum item corresponde${searchQuery ? ` a "<strong>${escapeHtml(searchQuery)}</strong>"` : ' aos filtros selecionados'}. Tente outros termos.</p>
            </div>`;
        return;
    }

    filteredItems.forEach((item, index) => {
        menuGrid.innerHTML += createProductCard(item, index);
    });

    setTimeout(initScrollReveal, 100);
}

// ── Carrinho ──
window.addToCart = function (id, name, price, btnElement) {
    id = decodeURIComponent(id);
    name = decodeURIComponent(name);
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    saveCart();
    updateCartUI();
    showToast(`${name} adicionado!`);

    if (btnElement) {
        btnElement.classList.add('btn-cart-added');
        setTimeout(() => btnElement.classList.remove('btn-cart-added'), 600);

        const cartIcon = document.querySelector('.cart-header-btn');
        const imgElement = btnElement.closest('.card')?.querySelector('img.card-img-top');
        if (cartIcon && imgElement) {
            const btnRect = imgElement.getBoundingClientRect();
            const cartRect = cartIcon.getBoundingClientRect();
            const flyingImg = document.createElement('img');
            flyingImg.src = imgElement.src;
            flyingImg.className = 'flying-item';
            flyingImg.style.top = `${btnRect.top + btnRect.height/2 - 25}px`;
            flyingImg.style.left = `${btnRect.left + btnRect.width/2 - 25}px`;
            document.body.appendChild(flyingImg);
            void flyingImg.offsetWidth;
            flyingImg.style.top = `${cartRect.top + cartRect.height/2 - 25}px`;
            flyingImg.style.left = `${cartRect.left + cartRect.width/2 - 25}px`;
            flyingImg.style.transform = 'scale(0.2) rotate(360deg)';
            flyingImg.style.opacity = '0.5';
            setTimeout(() => flyingImg.remove(), 800);
        }
    }

    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.classList.remove('cart-count-bounce');
        requestAnimationFrame(() => requestAnimationFrame(() => cartCount.classList.add('cart-count-bounce')));
    }
};

window.updateCartItemQuantity = function (index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) cart.splice(index, 1);
        saveCart();
        updateCartUI();
    }
};

window.removeFromCart = function (index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
};

window.toggleDeliveryFields = function () {
    const isEntrega = document.getElementById('modeEntrega')?.checked;
    const deliveryFields = document.getElementById('deliveryAddressFields');
    const freightRow = document.getElementById('freightRow');
    if (deliveryFields) deliveryFields.style.display = isEntrega ? 'block' : 'none';
    if (freightRow) freightRow.style.setProperty('display', isEntrega ? 'flex' : 'none', 'important');
    updateCartUI();
};

window.calculateFreight = function (cep) {
    if (!cep) cep = document.getElementById('deliveryCep')?.value.replace(/\D/g, '') || '';
    const freightElement = document.getElementById('cartFreight');
    if (cep.length === 8) {
        const lastDigits = parseInt(cep.substring(5));
        deliveryDistance = 1 + (lastDigits % 10);
        let baseFee = 8.00;
        let increment = 0;
        if (deliveryDistance > 3) increment = (deliveryDistance - 3) * 0.60;
        deliveryFee = baseFee + increment;
        if (freightElement) freightElement.textContent = `${formatBRL(deliveryFee)} (${deliveryDistance.toFixed(1)}km)`;
    } else {
        deliveryFee = 0;
        deliveryDistance = 0;
        if (freightElement) freightElement.textContent = formatBRL(0);
    }
    updateCartUI();
};

window.checkCep = function (input) {
    let cep = input.value.replace(/\D/g, '');
    if (cep.length > 5) input.value = cep.slice(0, 5) + '-' + cep.slice(5, 8);
    else input.value = cep;

    if (cep.length === 8) {
        const fields = ['deliveryStreet', 'deliveryNeighborhood', 'deliveryCity', 'deliveryState'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.value = 'Carregando...'; el.style.opacity = '0.7'; }
        });
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(r => r.json())
            .then(data => {
                fields.forEach(id => { const el = document.getElementById(id); if (el) el.style.opacity = '1'; });
                if (!data.erro) {
                    document.getElementById('deliveryStreet').value = data.logradouro || '';
                    document.getElementById('deliveryNeighborhood').value = data.bairro || '';
                    document.getElementById('deliveryCity').value = data.localidade || '';
                    document.getElementById('deliveryState').value = data.uf || '';
                    const numberField = document.getElementById('deliveryNumber');
                    if (numberField) { numberField.focus(); numberField.placeholder = 'Ex: 480'; }
                    showToast("Endereço localizado!");
                    calculateFreight(cep);
                    updateCartUI();
                } else {
                    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
                    showToast("CEP não encontrado!");
                }
            })
            .catch(() => {
                fields.forEach(id => { const el = document.getElementById(id); if (el) { el.value = ''; el.style.opacity = '1'; } });
                showToast("Erro ao buscar CEP");
            });
    }
};

function updateCartUI() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartFreight = document.getElementById('cartFreight');
    const resumoBox = document.getElementById('descritivoPedido');
    const resumoNome = document.getElementById('resumoNome');
    const resumoEnd = document.getElementById('resumoEnd');
    const resumoItens = document.getElementById('resumoItens');
    const resumoTotal = document.getElementById('resumoTotal');

    if (!cartItemsContainer || !cartCount || !cartTotal) return;

    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = totalItems;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-muted text-center my-4 py-4 bg-light rounded-4">Seu carrinho está vazio.</p>';
        cartTotal.textContent = formatBRL(0);
        if (cartSubtotal) cartSubtotal.textContent = formatBRL(0);
        if (cartFreight) cartFreight.textContent = formatBRL(0);
        if (resumoBox) resumoBox.style.display = 'none';
        const offcanvasFooter = document.querySelector('.offcanvas-footer');
        if (offcanvasFooter) offcanvasFooter.style.display = 'none';
        return;
    }

    const offcanvasFooter = document.querySelector('.offcanvas-footer');
    if (offcanvasFooter) offcanvasFooter.style.display = 'block';

    let itemsHTML = '';
    let itemsResumo = [];
    let subtotal = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        itemsResumo.push(`${item.quantity}x ${item.name}`);

        const prod = menuItems.find(p => String(p.id) === String(item.id));
        let thumbSrc = prod ? resolveImage(prod.image) : './images/ags_coxinha.webp';

        itemsHTML += `
            <div class="cart-item d-flex align-items-center border rounded-4 mb-3 shadow-sm p-0 overflow-hidden">
                <img src="${thumbSrc}" class="object-fit-cover cart-item-img" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='./images/ags_coxinha.webp'">
                <div class="flex-grow-1 overflow-hidden px-3 py-2">
                    <h6 class="fw-bold mb-1 text-truncate cart-item-name">${escapeHtml(item.name)}</h6>
                    <div class="price-vibrant fw-bold small">${formatBRL(item.price)}</div>
                    <div class="price-vibrant fw-bold mt-1 cart-item-total">${formatBRL(itemTotal)}</div>
                </div>
                <div class="pe-3 py-2 d-flex flex-column align-items-end gap-2">
                    <button class="btn btn-sm p-0 border-0 text-muted cart-item-remove" onclick="updateCartItemQuantity(${index}, -1)" aria-label="Remover" title="${item.quantity === 1 ? 'Remover' : 'Diminuir'}">
                        <i class="fas ${item.quantity === 1 ? 'fa-trash-alt text-danger' : 'fa-minus'}"></i>
                    </button>
                    <div class="d-flex align-items-center rounded-pill p-1 border shadow-sm cart-qty-control">
                        <button class="btn btn-sm border-0 rounded-circle d-flex align-items-center justify-content-center cart-qty-btn"
                                onclick="updateCartItemQuantity(${index}, 1)" aria-label="Aumentar">
                            <i class="fas fa-plus" style="font-size: 0.7rem;"></i>
                        </button>
                        <span class="fw-bold text-center cart-qty-value" style="width: 24px; font-size: 0.85rem;">${item.quantity}</span>
                    </div>
                </div>
            </div>
        `;
    });

    cartItemsContainer.innerHTML = itemsHTML;

    const isEntrega = document.getElementById('modeEntrega')?.checked;
    const currentFreight = isEntrega ? deliveryFee : 0;
    const finalTotal = subtotal + currentFreight;

    if (cartSubtotal) cartSubtotal.textContent = formatBRL(subtotal);
    if (cartFreight) cartFreight.textContent = formatBRL(currentFreight);
    cartTotal.textContent = formatBRL(finalTotal);

    if (resumoBox) {
        resumoBox.style.display = 'block';
        const nomeVal = document.getElementById('customerName')?.value || 'Pendente';
        resumoNome.textContent = nomeVal;
        if (isEntrega) {
            const rua = document.getElementById('deliveryStreet')?.value || '...';
            const num = document.getElementById('deliveryNumber')?.value || '...';
            resumoEnd.textContent = `${rua}, ${num}`;
        } else {
            resumoEnd.textContent = "Retirada no Local";
        }
        resumoItens.textContent = itemsResumo.join(', ');
        resumoTotal.textContent = formatBRL(finalTotal);
    }
}

// ── Mercado Pago Checkout ──
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
        mp = new MercadoPago(window.MP_PUBLIC_KEY);
        bricksBuilder = mp.bricks();
    }
    return !!mp;
}

window.checkout = async function () {
    if (cart.length === 0) {
        showToast("Seu carrinho está vazio!");
        return;
    }

    if (!window.MP_PUBLIC_KEY) {
        showToast("Pagamento temporariamente indisponível.");
        return;
    }

    const nameEl = document.getElementById('customerName');
    const phoneEl = document.getElementById('customerPhone');
    const name = nameEl ? nameEl.value.trim() : '';
    const phone = phoneEl ? phoneEl.value.trim() : '';
    const isEntrega = document.getElementById('modeEntrega')?.checked;

    if (!name || !phone) {
        showToast("Por favor, preencha seu nome e telefone!");
        if (nameEl && !name) nameEl.focus();
        else if (phoneEl && !phone) phoneEl.focus();
        return;
    }

    if (isEntrega) {
        const cepEl = document.getElementById('deliveryCep');
        const cep = cepEl ? cepEl.value.replace(/\D/g, '') : '';
        if (!cep || cep.length < 8 || deliveryFee <= 0) {
            showToast("Preencha o CEP corretamente para calcular a taxa de entrega!");
            if (cepEl) cepEl.focus();
            return;
        }
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

    const btnFinalizar = document.getElementById('btnFinalizar');
    const originalText = btnFinalizar ? btnFinalizar.innerHTML : '';

    if (paymentBrickController) paymentBrickController.unmount();

    if (btnFinalizar) {
        btnFinalizar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Carregando Pagamento...';
        btnFinalizar.disabled = true;
    }

    const currentFreight = isEntrega ? deliveryFee : 0;
    const totalAmount = cart.reduce((t, i) => t + (i.price * i.quantity), 0) + currentFreight;

    try {
        const settings = {
            initialization: { amount: totalAmount },
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
                            textPrimaryColor: '#1a1a1a',
                            textSecondaryColor: '#4b5563',
                            buttonTextColor: '#ffffff',
                            borderRadiusMedium: '20px',
                            borderRadiusLarge: '30px',
                            inputBorderWidth: '0px',
                            inputBackgroundColor: '#f7f7f7',
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

                        saveCustomerFields();
                        saveCart();

                        fetch(window.CHECKOUT_URL || 'https://agsdelivery.com.br/checkout_transparente.php', {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ formData, cart, customer: customerData, loja: 'fg_salgados' }),
                        })
                            .then(r => r.json())
                            .then(data => {
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
                                        clearSavedCart();
                                        clearCustomerFields();
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
                            .catch(error => {
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

// ── Toast ──
function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-custom';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

// ── Meus Pedidos ──
function getClientOrders() {
    try { return JSON.parse(localStorage.getItem(CLIENT_ORDERS_KEY)) || []; }
    catch (e) { return []; }
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
    const map = { pendente: 'Pendente', preparo: 'Em preparo', pronto: 'Pronto', entregue: 'Entregue', pago: 'Pago' };
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
                <span class="badge rounded-pill ${o.status === 'pago' ? 'text-bg-success' : o.status === 'pendente' ? 'text-bg-warning' : 'text-bg-info'}">${formatOrderStatus(o.status)}</span>
            </div>
            <div class="small text-muted mb-2">${formatOrderDate(o.data)}</div>
            <p class="mb-1 small"><i class="fas fa-shopping-bag me-1"></i> ${escapeHtml(o.itens)}</p>
            <p class="mb-1 small"><i class="fas fa-map-marker-alt me-1"></i> ${o.modo === 'entrega' ? (escapeHtml(o.endereco) || 'Entrega') : 'Retirada no local'}</p>
            <p class="mb-0 small"><i class="fas fa-money-bill-wave me-1"></i> ${escapeHtml(o.pagamento) || '-'} · <strong>${formatBRL(o.total)}</strong></p>
        </div>
    `).join('');
}

// ── Search ──
let searchDebounce;
if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => renderMenu(), 150);
    });
}

// ── Scroll Header ──
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (header) {
        window.scrollY > 20 ? header.classList.add('scrolled', 'glass') : header.classList.remove('scrolled', 'glass');
    }
}, { passive: true });

// ── Back to Top ──
function initBackToTop() {
    const btn = document.createElement('button');
    btn.id = 'backToTop';
    btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    btn.setAttribute('aria-label', 'Voltar ao topo');
    document.body.appendChild(btn);
    window.addEventListener('scroll', () => btn.classList.toggle('show', window.scrollY > 400), { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ── Scroll Reveal ──
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal, .reveal-left, .reveal-scale').forEach(el => observer.observe(el));
}

// ── Ripple ──
function initRipple() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-ripple, .btn-add-cart, .category-active');
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        btn.style.setProperty('--x', ((e.clientX - rect.left) / rect.width * 100) + '%');
        btn.style.setProperty('--y', ((e.clientY - rect.top) / rect.height * 100) + '%');
    });
}

// ── Auto-save customer fields ──
let saveTimer;
document.addEventListener('input', (e) => {
    const autoSaveIds = ['customerName', 'customerPhone', 'deliveryCep', 'deliveryStreet', 'deliveryNumber', 'deliveryNeighborhood', 'deliveryCity', 'deliveryState', 'deliveryNote'];
    if (autoSaveIds.includes(e.target.id)) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveCustomerFields, 400);
    }
});

document.addEventListener('change', (e) => {
    if (e.target.name === 'deliveryMode') saveCustomerFields();
});

// ── Drag to Scroll for Categories ──
function initDragScroll() {
    const slider = document.querySelector('.categories');
    if (!slider) return;
    let isDown = false, startX, scrollLeft;
    slider.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
    slider.addEventListener('mouseleave', () => isDown = false);
    slider.addEventListener('mouseup', () => isDown = false);
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        slider.scrollLeft = scrollLeft - ((e.pageX - slider.offsetLeft) - startX) * 2;
    });
}

// ── Init ──
window.addEventListener('load', () => {
    initBackToTop();
    initRipple();
    initDragScroll();
    setTimeout(initScrollReveal, 500);
});

loadMenu();
