let menuItems = [];
let cart = [];

let deliveryFee = 0;
let deliveryDistance = 0;
let activeCategory = 'all';

const STORAGE_KEY = 'fg_salgados_v9';
const CLIENT_ORDERS_KEY = 'fg_client_orders';
const CART_STORAGE_KEY = 'fg_cart';
const CUSTOMER_STORAGE_KEY = 'fg_customer';

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
            if (modeEntrega) { modeEntrega.checked = true; if (typeof toggleDeliveryFields === 'function') toggleDeliveryFields(); }
        }
        if (fields.cep) {
            const setCep = document.getElementById('deliveryCep');
            if (setCep) setCep.value = fields.cep;
        }
        if (fields.street) {
            const setStreet = document.getElementById('deliveryStreet');
            if (setStreet) setStreet.value = fields.street;
        }
        if (fields.number) {
            const setNum = document.getElementById('deliveryNumber');
            if (setNum) setNum.value = fields.number;
        }
        if (fields.neighborhood) {
            const setNeigh = document.getElementById('deliveryNeighborhood');
            if (setNeigh) setNeigh.value = fields.neighborhood;
        }
        if (fields.city) {
            const setCity = document.getElementById('deliveryCity');
            if (setCity) setCity.value = fields.city;
        }
        if (fields.state) {
            const setState = document.getElementById('deliveryState');
            if (setState) setState.value = fields.state;
        }
        if (fields.note) {
            const setNote = document.getElementById('deliveryNote');
            if (setNote) setNote.value = fields.note;
        }
        if (fields.cep && fields.cep.replace(/\D/g, '').length === 8 && typeof calculateFreight === 'function') {
            calculateFreight(fields.cep.replace(/\D/g, ''));
        }
    } catch (e) {}
}

function clearCustomerFields() {
    try {
        localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    } catch (e) {}
    const fieldIds = [
        'customerName',
        'customerPhone',
        'deliveryCep',
        'deliveryStreet',
        'deliveryNumber',
        'deliveryNeighborhood',
        'deliveryCity',
        'deliveryState',
        'deliveryNote'
    ];
    fieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const modeRetirada = document.getElementById('modeRetirada');
    if (modeRetirada) {
        modeRetirada.checked = true;
        if (typeof toggleDeliveryFields === 'function') toggleDeliveryFields();
    }
}
window.clearCustomerFields = clearCustomerFields;

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

    categories.forEach((cat) => {
        const btn = document.createElement('button');
        btn.className = `btn ${cat === activeCategory ? 'btn-dark' : 'btn-outline-dark'} rounded-pill px-4 py-2 me-2 mb-2 fw-semibold`;
        btn.dataset.category = cat;
        btn.setAttribute('aria-pressed', cat === activeCategory ? 'true' : 'false');
        btn.textContent = categoryLabels[cat] || cat;

        btn.onclick = () => {
            activeCategory = cat;
            renderCategories();
            renderMenu();
        };

        categoryContainer.appendChild(btn);
    });
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
    const btnFinalizar = document.getElementById('btnFinalizar');

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
    if (btnFinalizar) {
        btnFinalizar.disabled = false;
        btnFinalizar.style.display = 'block';
    }

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

    const nameEl = document.getElementById('customerName');
    const phoneEl = document.getElementById('customerPhone');
    const name = nameEl ? nameEl.value.trim() : '';
    const phone = phoneEl ? phoneEl.value.trim() : '';
    const isEntrega = document.getElementById('modeEntrega') ? document.getElementById('modeEntrega').checked : false;

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

loadSavedData();
loadCart();
renderCategories();
renderMenu();
updateCartUI();
loadCustomerFields();
bindSearch();
bindContactLinks();
