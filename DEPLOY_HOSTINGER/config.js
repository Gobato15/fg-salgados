/* ============================================================================
 * FG SALGADOS — Configuração da API (PIX dinâmico + cardápio + uploads)
 *
 * FG_CONFIG.pixApiUrl:
 *   - POST /api/pix          -> QR Code dinâmico por pedido.
 *   - GET  /api/menu         -> produtos do MySQL.
 *   - Área restrita          -> login, CRUD de produtos e upload de imagens.
 *
 * Em produção (www.fgsalgados.com.br) o backend Node.js roda no hPanel
 * da Hostinger na mesma URL do site, então /api está no mesmo domínio.
 * ========================================================================== */
(function () {
    var hostname = window.location && window.location.hostname;
    var isLocal = (hostname === 'localhost' || hostname === '127.0.0.1');
    var isGithubPages = hostname && hostname.indexOf('github.io') !== -1;

    var apiUrl;
    if (isLocal) {
        // Teste local: backend rodando em http://localhost:3000
        apiUrl = 'http://localhost:3000/api';
    } else if (isGithubPages) {
        // Se ainda estiver no GitHub Pages, aponta para o domínio de produção
        apiUrl = 'https://www.fgsalgados.com.br/api';
    } else {
        // No próprio domínio (www.fgsalgados.com.br via Hostinger hPanel)
        // a API está no mesmo host — usa URL relativa para evitar problemas de CORS
        apiUrl = window.location.origin + '/api';
    }

    window.FG_CONFIG = {
        pixApiUrl: apiUrl
    };
})();