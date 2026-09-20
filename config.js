/* ============================================================================
 * FG SALGADOS — Configuração da API (PIX dinâmico + cardápio + uploads)
 *
 * Preencha FG_CONFIG.pixApiUrl com a URL pública do backend
 * (ex.: https://fg-salgados-api.onrender.com/api) e carregue este arquivo
 * ANTES dos scripts que usam a API.
 *
 * O que esta URL controla:
 *   - PIX: POST /api/pix -> QR Code dinâmico por pedido.
 *   - Cardápio: GET /api/menu -> produtos (base menuData.js + edições da
 *     área restrita). O site cacheia e usa offline se a API cair.
 *   - Área restrita: login, CRUD de produtos e upload de imagens.
 *
 * Se ficar vazio, o site usa o QR Code PIX e o cardápio padrão (nada quebra),
 * e a área restrita avisa que a API não está configurada.
 * ========================================================================== */
window.FG_CONFIG = {
    pixApiUrl: 'http://localhost:3000/api', // Altere para a URL pública quando publicar o backend no Render, Railway, etc.
    apiBase: 'https://agsdelivery.com.br'
};
