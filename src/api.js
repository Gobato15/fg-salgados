import { showToast, fallbackCopy } from './utils.js';
import { cart, deliveryFee, menuItems } from './cart.js';

export async function fetchAddress(cep) {
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
            if (window.calculateFreight) {
                window.calculateFreight(cep);
            }
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

export function pixApiBase() {
    return ((window.FG_CONFIG && window.FG_CONFIG.pixApiUrl) || '').trim().replace(/\/+$/, '');
}

export function pixBackendConfigured() {
    return !!pixApiBase();
}

export function initPixDynamic() {
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
}

export async function gerarPixDinamico() {
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
            body: JSON.stringify({ items, amount: total, deliveryFee: isEntregaPix ? deliveryFee : 0, label: 'Pedido FG Salgados' })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Falha ao gerar o PIX.');
        mostrarPixDinamico(data);
    } catch (e) {
        if (statusEl) { statusEl.className = 'mt-2 small fw-bold text-danger'; statusEl.textContent = e.message; }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles me-1"></i> Gerar PIX'; }
    }
}

export function mostrarPixDinamico(data) {
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

export function pollPixStatus(paymentId) {
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

export function copiarPixDinamico() {
    const v = document.getElementById('pixDynamicCopy');
    if (!v || !v.value) { showToast('Gere o PIX primeiro!'); return; }
    const done = () => showToast('Código PIX copiado! 📋');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v.value).then(done, () => fallbackCopy(v.value, done));
    } else {
        fallbackCopy(v.value, done);
    }
}

export function resetPixDinamico() {
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

// Make globally accessible
window.gerarPixDinamico = gerarPixDinamico;
window.copiarPixDinamico = copiarPixDinamico;
window.initPixDynamic = initPixDynamic;
window.fetchAddress = fetchAddress;
