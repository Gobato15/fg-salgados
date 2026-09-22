import { applyPhoneMask, setFieldState, isValidPhone, isValidName } from './utils.js';
import { loadSavedData, validateCheckout, DEFAULT_CONTACT, savedData, refreshRemoteMenu } from './cart.js';
import { renderCategories, renderMenu, updateCartUI, generateWhatsLink } from './ui.js';
import { initPixDynamic } from './api.js';

function bindSearch() {
    const searchInput = document.getElementById('searchInput');
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

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    loadSavedData();
    renderCategories();
    renderMenu();
    updateCartUI();
    bindSearch();
    bindContactLinks();
    bindValidation();
    initPixDynamic();

    refreshRemoteMenu().then(() => {
        renderCategories();
        renderMenu();
        updateCartUI();
    });
});
