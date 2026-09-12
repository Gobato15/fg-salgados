/* ============================================================================
 * FG CONGELADOS — Configuração do site
 *
 * Carregue este arquivo ANTES do script.js no index.html.
 * Valores ausentes/zerados não quebram nada (fallbacks seguros).
 * ========================================================================== */
window.FG_CONFIG = {
    // Endpoint base da API do AGS (cardápio dinâmico / estoque / rastreio)
    apiBase: 'https://agsdelivery.com.br',

    // Pedido mínimo em R$ — 0 (ou ausente) = sem mínimo
    minOrder: 0,

    // Exibir indicador "Aberto Agora"? false = totalmente oculto (no-op)
    showStoreStatus: false,

    // Conteúdo das seções "Preparo & Conservação" e "Entrega de Congelados"
    congelados: {
        preparo: [
            { titulo: 'Airfryer', texto: 'Pré-aqueça a 200°C e asse por ~12 minutos até dourar.' },
            { titulo: 'Forno', texto: 'Pré-aqueça a 180°C e asse por ~25 minutos.' },
            { titulo: 'Conservação', texto: 'Mantenha congelado a -18°C. Validade de 90 dias no freezer.' }
        ],
        entrega: 'Os produtos saem de nossas mãos congelados, em embalagem térmica, para manter a temperatura ideal durante o trajeto. Confira área e dias de entrega antes de finalizar o pedido.'
    }
};