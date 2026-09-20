import { showToast, setFieldState, formatBRL, esc, isValidName, isValidPhone, isValidCepFormat } from './utils.js';
import { updateCartUI, getPixKey } from './ui.js';
import { resetPixDinamico } from './api.js';

export let menuItems = [];
export let cart = [];
export let deliveryFee = 0;
export let deliveryDistance = 0;
export let activeCategory = 'all';
export let savedData = {};

const STORAGE_KEY = 'fg_salgados_v9';
const CLIENT_ORDERS_KEY = 'fg_client_orders';
const REMOTE_MENU_KEY = 'fg_remote_menu_v1';

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

// Busca o cardápio no backend (FG_CONFIG.pixApiUrl) e aplica por cima do base,
// com cache em localStorage. Apresenta o cache imediatamente e atualiza em
// segundo plano; se não houver API configurada ou conexão, mantém menuData.js.
export async function refreshRemoteMenu() {
    const apiBase = (window.FG_CONFIG && window.FG_CONFIG.pixApiUrl || '').trim().replace(/\/+$/, '');
    if (!apiBase) return;

    try {
        const cached = JSON.parse(localStorage.getItem(REMOTE_MENU_KEY) || 'null');
        if (cached && Array.isArray(cached.items)) applyMenu(cached.items);
    } catch (e) { /* cache corrompido: ignora */ }

    try {
        const res = await fetch(apiBase + '/menu');
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

export function checkout() {
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

    // Dynamic import to avoid circular dependency for getWhatsNumber/generateWhatsLink
    import('./ui.js').then(module => {
        window.open(module.generateWhatsLink(text), "_blank", "noopener,noreferrer");
        showToast("Abrindo WhatsApp com seu pedido!");
        setTimeout(() => {
            window.location.href = 'sucesso.html';
        }, 1500);
    });
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
