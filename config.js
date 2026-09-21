/* ============================================================================
 * FG SALGADOS — Configuração da API (PIX dinâmico + cardápio + uploads)
 *
 * FG_CONFIG.pixApiUrl:
 *   - POST /api/pix          -> QR Code dinâmico por pedido.
 *   - GET  /api/menu         -> produtos (base menuData.js + edições da
 *     área restrita). O site cacheia e usa offline se a API cair.
 *   - Área restrita          -> login, CRUD de produtos e upload de imagens.
 *
 * Em produção (www.fgsalgados.com.br) o backend usa o MySQL da Hostinger.
 * Quando aberto em http://localhost:3000 (teste local), usa a API local.
 * ========================================================================== */
window.FG_CONFIG = {
    pixApiUrl: 'http://localhost:3000/api'
};