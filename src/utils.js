export function formatBRL(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function esc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function isValidName(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return false;
    return parts.every(p => /^[A-Za-zÀ-ÖØ-öø-ÿ']+$/.test(p));
}

export function normalizeDigits(str) {
    return String(str || '').replace(/\D/g, '');
}

export function isValidPhone(phone) {
    const digits = normalizeDigits(phone);
    if (digits.length === 11 && (digits[2] === '9' || digits[2] === '8')) return true;
    return false;
}

export function isValidCepFormat(cep) {
    return normalizeDigits(cep).length === 8;
}

export function applyPhoneMask(input) {
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

export function setFieldState(el, state) {
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

export function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, 99999);
    try { document.execCommand('copy'); } catch (e) { }
    document.body.removeChild(ta);
    if (done) done();
}

export function showToast(message) {
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

// Make accessible globally
window.showToast = showToast;
window.applyPhoneMask = applyPhoneMask;
