import { showToast, setFieldState, formatBRL, esc, isValidName, isValidPhone, isValidCepFormat } from './utils.js';
import { updateCartUI } from './ui.js';

export let menuItems = [];
export let cart = [];
export let deliveryFee = 0;
export let deliveryDistance = 0;
export let activeCategory = 'all';
export let savedData = {};

const STORAGE_KEY = 'fg_salgados_v9';
const CLIENT_ORDERS_KEY = 'fg_client_orders';
const REMOTE_MENU_KEY = 'fg_remote_menu_v2';

export const DEFAULT_CONTACT = {
    whats: "(19) 99609-0540",
    insta: "fgsalgados24",
    pix: "agsdelivery24@gmail.com",
    address: "Entrega e Retirada Local",
    about: "Salgados artesanais congelados vendidos por unidade. Qualidade gourmet, ingredientes selecionados e sabor de verdade.",
    hours1: "Seg a Sex: 14h às 19h",
    hours2: "Sábado: 8h às 17h"
};

export function setActiveCategory(cat) {
    activeCategory = cat;
}

export function loadSavedData() {
    try {
        savedData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
        savedData = {};
    }

    menuItems = (window.fgMenuItems || []).map(item => Object.assign({}, item, { desc: item.description, active: item.active !== false }));

    const seen = new Set();
    const seenName = new Set();
    menuItems = menuItems.filter(it => {
        if (!it.image) return false;
        if (seen.has(it.id)) return false;
        seen.add(it.id);
        const nm = String(it.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (nm && seenName.has(nm)) return false;
        if (nm) seenName.add(nm);
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

export function addToCart(id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    updateCartUI();
    showToast(`${esc(name)} adicionado! 🛒`);
}

/* ------------------------- Cardápio gerenciado (backend) ------------------------- */

function applyMenu(remoteItems) {
    if (!Array.isArray(remoteItems)) return;
    menuItems = remoteItems
        .map(item => Object.assign({}, item, { desc: item.desc || item.description, active: item.active !== false }))
        .filter(it => it.image && it.active !== false);
}

// Busca o cardápio publicado no GitHub (data/products.json) e aplica por cima
// do base, com cache em localStorage. Apresenta o cache imediatamente e
// atualiza em segundo plano; se não houver conexão/arquivo, mantém menuData.js.
export async function refreshRemoteMenu() {
    const cfg = window.FG_CONFIG || {};
    let menuUrl = String(cfg.gitHubRawMenu || '').trim();
    if (!menuUrl) {
        const apiBase = String(cfg.pixApiUrl || '').trim().replace(/\/+$/, '');
        if (apiBase) menuUrl = apiBase + '/menu';
    }
    if (!menuUrl) return;

    try {
        const cached = JSON.parse(localStorage.getItem(REMOTE_MENU_KEY) || 'null');
        if (cached && Array.isArray(cached.items)) applyMenu(cached.items);
    } catch (e) { /* cache corrompido: ignora */ }

    try {
        const bust = 't=' + Date.now();
        const res = await fetch(menuUrl + (menuUrl.indexOf('?') >= 0 ? '&' : '?') + bust);
        if (!res.ok) throw new Error('menu falhou');
        const data = await res.json();
        localStorage.setItem(REMOTE_MENU_KEY, JSON.stringify({ items: data.items || [], cachedAt: Date.now() }));
        applyMenu(data.items || []);
    } catch (e) { /* offline: mantém o cache ou o cardápio base */ }
}

export function updateCartItemQuantity(index, change) {
    if (cart[index]) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        updateCartUI();
    }
}

export function calculateFreight(cep) {
    const cepValue = String(cep || document.getElementById('deliveryCep').value).replace(/\D/g, '');
    const freightElement = document.getElementById('cartFreight');

    if (cepValue.length === 8) {
        const lastDigits = parseInt(cepValue.substring(5));
        deliveryDistance = 1 + (lastDigits % 10);

        const baseFee = 7.00;
        let increment = 0;
        if (deliveryDistance > 3) {
            increment = (deliveryDistance - 3) * 0.60;
        }

        deliveryFee = baseFee + increment;
        if (freightElement) freightElement.textContent = `${formatBRL(deliveryFee)} (${deliveryDistance.toFixed(1)}km)`;
    } else {
        deliveryFee = 0;
        deliveryDistance = 0;
        if (freightElement) freightElement.textContent = formatBRL(0);
    }
    updateCartUI();
}

export function validateCheckout() {
    const btn = document.getElementById('btnFinalizar');
    const consent = document.getElementById('confirmDados');
    if (!btn) return;

    const nameEl = document.getElementById('customerName');
    const phoneEl = document.getElementById('customerPhone');
    const modeEntregaEl = document.getElementById('modeEntrega');
    const isEntrega = modeEntregaEl ? modeEntregaEl.checked : false;

    const nameOk = nameEl && isValidName(nameEl.value);
    const phoneOk = phoneEl && isValidPhone(phoneEl.value);

    let enderecoOk = true;
    if (isEntrega) {
        const cepEl = document.getElementById('deliveryCep');
        const cityEl = document.getElementById('deliveryCity');
        const streetEl = document.getElementById('deliveryStreet');
        const numEl = document.getElementById('deliveryNumber');
        const cepOk = cepEl && cityEl && isValidCepFormat(cepEl.value) && cityEl.value.trim() !== '' && cityEl.value !== 'Buscando...';
        const ruaOk = streetEl && streetEl.value.trim() !== '';
        const numOk = numEl && numEl.value.trim() !== '';
        enderecoOk = cepOk && ruaOk && numOk;
    }

    const consentOk = consent ? consent.checked : true;
    const cartOk = cart.length > 0;
    const allOk = nameOk && phoneOk && enderecoOk && consentOk && cartOk;

    btn.disabled = !allOk;

    if (nameEl) setFieldState(nameEl, nameOk ? 'valid' : (nameEl.value ? 'invalid' : 'idle'));
    if (phoneEl) setFieldState(phoneEl, phoneOk ? 'valid' : (phoneEl.value ? 'invalid' : 'idle'));

    return allOk;
}

let brickController = null;
let mpClient = null;
let mpBricks = null;

function getMpPublicKey() {
    if (window.MP_PUBLIC_KEY) return String(window.MP_PUBLIC_KEY).trim();
    const cfg = window.FG_CONFIG || {};
    return String(cfg.mpPublicKey || '').trim();
}

function getCheckoutUrl() {
    const cfg = window.FG_CONFIG || {};
    const hosted = String(cfg.mpCheckoutUrl || '').trim();
    if (hosted) return hosted;
    const base = String(cfg.pixApiUrl || '').trim().replace(/\/+$/, '');
    return base ? base + '/checkout' : '';
}

function loadMPScript() {
    if (document.querySelector('script[src*="sdk.mercadopago.com"]') && typeof window.MercadoPago !== 'undefined') {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://sdk.mercadopago.com/js/v2';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Erro ao carregar o Mercado Pago.'));
        document.head.appendChild(s);
    });
}

function ensureMercadoPago() {
    if (mpClient && mpBricks) return true;
    const pubKey = getMpPublicKey();
    if (!window.MercadoPago || !pubKey) return false;
    try {
        mpClient = new window.MercadoPago(pubKey);
        mpBricks = mpClient.bricks();
        return true;
    } catch (e) {
        console.error('[mp] erro ao iniciar MercadoPago:', e);
        return false;
    }
}

function unmountBrick() {
    if (brickController) {
        try { brickController.unmount(); } catch (e) { /* ignora */ }
        brickController = null;
    }
}

export async function checkout() {
    if (cart.length === 0) {
        showToast("Adicione pelo menos 1 salgado ao pedido!");
        return;
    }

    const pubKey = getMpPublicKey();
    const checkoutUrl = getCheckoutUrl();
    if (!pubKey || !checkoutUrl) {
        showToast("Pagamento temporariamente indisponível. Tente novamente mais tarde.");
        return;
    }

    const btn = document.getElementById('btnFinalizar');
    const origBtnHtml = btn.innerHTML;

    // Carrega o SDK do Mercado Pago e inicia o brick
    try {
        await loadMPScript();
    } catch (e) {
        showToast(e.message || "Erro ao carregar sistema de pagamento. Tente novamente.");
        return;
    }
    if (!ensureMercadoPago()) {
        showToast("O sistema de pagamento ainda está carregando. Aguarde um momento e tente novamente.");
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

    const currentFreight = isEntrega ? deliveryFee : 0;
    const total = Math.round((cart.reduce((s, it) => s + it.price * it.quantity, 0) + currentFreight) * 100) / 100;

    unmountBrick();
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Carregando Pagamento...';
    btn.disabled = true;

    const customer = {
        customerName: name,
        customerPhone: phone,
        isEntrega: isEntrega,
        deliveryFee: currentFreight,
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

    const settings = {
        initialization: {
            amount: total,
        },
        customization: {
            visual: {
                font: 'Outfit',
                style: {
                    theme: 'default',
                    customVariables: {
                        baseColor: '#E11D48',
                        baseColorFirstVariant: '#BE123C',
                        baseColorSecondVariant: '#D97706',
                        errorColor: '#E11D48',
                        successColor: '#198754',
                        outlinePrimaryColor: '#E11D48',
                        textPrimaryColor: '#1a1a1a',
                        textSecondaryColor: '#6b7280',
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
                    formTitle: "Resumo do Pagamento",
                    emailSectionTitle: "Dados para Recebimento",
                    installmentsSectionTitle: "Parcelamento",
                    cardholderName: { label: "Nome impresso no cartão", placeholder: "Ex: JOÃO DA SILVA" },
                    selectInstallments: "Escolha o número de parcelas",
                    formSubmit: "Confirmar Pagamento",
                    paymentMethods: {
                        creditCardTitle: "Cartão de Crédito",
                        bankTransferTitle: "Pix"
                    },
                    ctaGeneralErrorLabel: "Tentar Novamente",
                    ctaCardErrorLabel: "Revisar dados do cartão",
                    ctaReturnLabel: "Voltar ao Carrinho"
                }
            },
            paymentMethods: {
                bankTransfer: "all",
                creditCard: "all",
                debitCard: "all",
                mercadoPago: "all"
            },
        },
        callbacks: {
            onReady: () => {
                btn.style.display = 'none';
            },
            onSubmit: ({ selectedPaymentMethod, formData }) => {
                return new Promise((resolve, reject) => {
                    fetch(checkoutUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            formData: formData,
                            cart: cart,
                            customer: customer
                        }),
                    })
                    .then((res) => res.json())
                    .then((data) => {
                        if (data && data.success) {
                            if (data.qr_code_base64) sessionStorage.setItem('pix_qr_code', data.qr_code_base64);
                            if (data.qr_code) sessionStorage.setItem('pix_copy_paste', data.qr_code);
                            if (data.payment_id) sessionStorage.setItem('fg_payment_id', String(data.payment_id));

                            const myOrder = {
                                id: 'c' + (data.payment_id || Date.now()),
                                numero: getClientOrders().reduce((m, o) => Math.max(m, o.numero || 0), 0) + 1,
                                cliente: name,
                                telefone: phone,
                                itens: cart.map(it => `${it.quantity}x ${it.name}`).join(', '),
                                total: total,
                                modo: isEntrega ? 'entrega' : 'retirada',
                                endereco: isEntrega ? `${document.getElementById('deliveryStreet').value}, ${document.getElementById('deliveryNumber').value}` : 'Retirada no Local',
                                pagamento: "Mercado Pago",
                                status: 'pago',
                                data: new Date().toISOString()
                            };
                            saveClientOrder(myOrder);

                            resolve(data.full_response || data);

                            const detail = data.full_response && data.full_response.status_detail;
                            if (detail === 'pending_challenge') {
                                return;
                            }
                            cart = [];
                            updateCartUI();
                            setTimeout(() => {
                                window.location.href = 'sucesso.html?payment_id=' + encodeURIComponent(data.payment_id || '');
                            }, 1000);
                        } else {
                            reject();
                            showToast((data && data.error) || "Erro ao processar pagamento. Tente novamente.");
                        }
                    })
                    .catch((error) => {
                        console.error('[checkout] erro:', error);
                        reject();
                        showToast("Erro ao processar pagamento. Verifique sua conexão e tente novamente.");
                    });
                });
            },
            onError: (error) => {
                console.error(error);
                showToast("Erro no formulário de pagamento.");
                btn.style.display = 'block';
                btn.disabled = false;
                btn.innerHTML = origBtnHtml;
            },
        },
    };

    try {
        brickController = await mpBricks.create('payment', 'paymentBrick_container', settings);
    } catch (e) {
        console.error('[checkout] erro ao criar brick:', e);
        btn.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = origBtnHtml;
        showToast("Erro ao carregar pagamento. Tente novamente.");
    }
}

export function getClientOrders() {
    try {
        return JSON.parse(localStorage.getItem(CLIENT_ORDERS_KEY)) || [];
    } catch (e) {
        return [];
    }
}

export function saveClientOrder(order) {
    const orders = getClientOrders();
    orders.unshift(order);
    localStorage.setItem(CLIENT_ORDERS_KEY, JSON.stringify(orders));
}

// Make globally accessible
window.addToCart = addToCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.calculateFreight = calculateFreight;
window.checkout = checkout;
window.validateCheckout = validateCheckout;
