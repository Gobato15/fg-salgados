/* ============================================================================
 * FG SALGADOS — Configuração (GitHub como banco de produtos + PIX estático)
 *
 * NÃO usa mais backend externo. O "banco" de produtos vive no próprio
 * repositório (data/products.json) e é lido/publicado pela GitHub API.
 *
 * FG_CONFIG:
 *   - pixApiUrl: ''            -> PIX estático (sem QR dinâmico/backend).
 *   - gitHubRepo: owner/repo/branch -> onde vive o products.json.
 *   - gitHubRawMenu            -> URL pública de leitura do cardápio.
 *   - gitHubFile               -> caminho do arquivo de produtos no repo.
 * ========================================================================== */
(function () {
    var hostname = window.location && window.location.hostname;
    var isLocal = (hostname === 'localhost' || hostname === '127.0.0.1');

    window.FG_CONFIG = {
        pixApiUrl: isLocal ? 'http://localhost:3000/api' : '',
        gitHubRepo: {
            owner: 'Gobato15',
            repo: 'fg-salgados',
            branch: 'main'
        },
        gitHubFile: 'data/products.json',
        gitHubRawMenu: 'https://raw.githubusercontent.com/Gobato15/fg-salgados/main/data/products.json'
    };

    // Chave pública do Mercado Pago para o Checkout Transparente
    window.MP_PUBLIC_KEY = 'APP_USR-ccddbea8-7479-47a1-892b-3b74ca21fc89';
})();