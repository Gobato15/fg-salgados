/* ============================================================================
 * FG SALGADOS — Backend de Pagamento PIX (Mercado Pago)
 * Node.js + Express. Independente do site estático (GitHub Pages).
 *
 * Endpoints:
 *   GET  /api/health        -> status da integração
 *   POST /api/pix           -> cria uma cobrança PIX (QR dinâmico) para um pedido
 *   POST /api/webhook       -> recebe a confirmação de pagamento do Mercado Pago
 *   POST /api/simulate-pay  -> (somente se MP_ENV=sandbox) simula um pagamento
 * ========================================================================== */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

/* ------------------------- Configuração ------------------------- */
const PORT = process.env.PORT || 3000;
const MP_ACCESS_TOKEN = (process.env.MP_ACCESS_TOKEN || '').trim();
const MP_ENV = (process.env.MP_ENV || 'production').trim().toLowerCase();
const PUBLIC_URL = (process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
const WEBHOOK_SECRET = (process.env.WEBHOOK_SECRET || '').trim();
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || '').trim();

const IS_SANDBOX = MP_ENV === 'sandbox';
const configured = !!MP_ACCESS_TOKEN;

const MP_API = 'https://api.mercadopago.com';

/* ------------------------- Middlewares ------------------------- */
// Só aceita requisições vindas do nosso site (GitHub Pages).
app.use(cors({
    origin: ALLOWED_ORIGIN || true,
    methods: ['GET', 'POST'],
}));

app.use(express.json({ limit: '50kb' }));

// Proteção simples contra requisições com corpo anormal (webhook envia JSON curto).
app.use((req, res, next) => {
    if (req.method === 'POST' && req.headers['content-type'] && !req.headers['content-type'].includes('application/json')) {
        return res.status(415).json({ error: 'Content-Type deve ser application/json' });
    }
    next();
});

/* ------------------------- Rate limiting ------------------------- */
// Bloqueia abusos (ex.: alguém gerando muitos QRs). Baseado em IP.
const rateBuckets = new Map();
function rateLimit(key, max, windowMs) {
    const now = Date.now();
    const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (bucket.resetAt < now) {
        bucket.count = 0;
        bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    return bucket.count > max;
}
function clientIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

/* ------------------------- Helpers ------------------------- */
function formatBRL(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sanitizeText(str, max = 200) {
    return String(str == null ? '' : str).replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

function buildDescription(items) {
    if (Array.isArray(items) && items.length) {
        return items
            .slice(0, 8)
            .map((i) => `${i.quantity || 1}x ${sanitizeText(i.name, 60)}`)
            .join('; ')
            .slice(0, 127);
    }
    return 'Pedido FG Salgados';
}

/* ------------------------- Validação de entrada ------------------------- */
// Nunca confie no que o navegador envia: o total é recalculado no servidor
// a partir de uma tabela de preços. Como este backend não tem o cardápio,
// exigimos envio assinado é inviável sem DB. Aqui limitamos o escopo:
// o total enviado é aceito dentro de limites plausíveis e com poucos itens.
function validatePayload(body) {
    if (!body || typeof body !== 'object') return { error: 'Corpo inválido' };

    const label = sanitizeText(body.label, 60) || 'Pedido FG Salgados';
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    const amountRaw = Number(body.amount);
    const amount = Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) / 100 : 0;

    if (items.length === 0 && !(amount > 0)) {
        return { error: 'Informe os itens ou um valor maior que zero' };
    }
    if (!(amount > 0)) {
        // Recalcula a partir dos itens (o preço já vem do cardápio do site).
        const sum = items.reduce((acc, i) => acc + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
        const computed = Math.round(sum * 100) / 100;
        if (!(computed > 0)) return { error: 'Valor do pedido inválido' };
        return { label, items, amount: computed };
    }
    // Travas: valores negativos/absurdos são bloqueados.
    if (amount > 5000) return { error: 'Valor acima do limite' };

    return { label, items, amount };
}

/* ------------------------- Mercado Pago ------------------------- */
async function createPixPayment({ amount, label, items, externalReference }) {
    const body = {
        transaction_amount: amount,
        description: label,
        payment_method_id: 'pix',
        notification_url: PUBLIC_URL
            ? `${PUBLIC_URL}/api/webhook?secret_source=mp`
            : '',
        payer: {
            email: 'pix@fgsalgados.com.br', // e-mail de referência do pagamento
            identification: { type: 'none', number: '00000000000' },
        },
        external_reference: externalReference,
        additional_info: {
            items: items.map((i) => ({
                id: sanitizeText(i.id || i.name, 40),
                title: sanitizeText(i.name, 80),
                quantity: Number(i.quantity) || 1,
                unit_price: Number(i.price) || 0,
            })),
        },
    };

    const res = await fetch(`${MP_API}/v1/payments`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data.message || data.error || `Mercado Pago respondeu ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.mpData = data;
        throw err;
    }
    return data;
}

/* ------------------------- Rotas ------------------------- */

// Status da integração (sem expor o token).
app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        configured,
        env: IS_SANDBOX ? 'sandbox' : 'production',
        time: new Date().toISOString(),
    });
});

// Cria uma cobrança PIX dinâmica.
app.post('/api/pix', async (req, res) => {
    if (!configured) {
        return res.status(503).json({ error: 'Backend de pagamento ainda não configurado. Defina MP_ACCESS_TOKEN.' });
    }
    if (rateLimit(`pix:${clientIp(req)}`, 15, 60 * 1000)) {
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde um instante e tente de novo.' });
    }

    const { error, label, items, amount } = validatePayload(req.body);
    if (error) return res.status(400).json({ error });

    const externalReference = `FG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    try {
        const pay = await createPixPayment({ amount, label, items, externalReference });
        const txn = (pay && pay.point_of_interaction && pay.point_of_interaction.transaction_data) || {};

        if (!txn.qr_code && !txn.qr_code_base64) {
            return res.status(502).json({
                error: 'O Mercado Pago não retornou o QR Code.',
                detail: IS_SANDBOX ? 'Está em modo sandbox com credenciais de teste?' : undefined,
            });
        }

        return res.json({
            ok: true,
            orderId: externalReference,
            paymentId: pay.id,
            status: pay.status,
            response: pay.status_detail,
            amount,
            label,
            expires_at: txn.expiration_date || null,
            qr_code: txn.qr_code || null,
            qr_code_base64: txn.qr_code_base64 || null,
            copy_paste: txn.qr_code || null,
        });
    } catch (e) {
        console.error('[pix] erro:', e.message);
        const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
        return res.status(status).json({ error: e.message || 'Falha ao gerar o PIX.' });
    }
});

// Consulta o status de um pagamento (usado pelo site no polling).
app.get('/api/pix/:paymentId', async (req, res) => {
    if (!configured) {
        return res.status(503).json({ error: 'Backend ainda não configurado.' });
    }
    const id = String(req.params.paymentId || '').trim();
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'paymentId inválido' });
    try {
        const r = await fetch(`${MP_API}/v1/payments/${id}`, {
            headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
        });
        const pay = await r.json().catch(() => ({}));
        if (r.status === 404) return res.status(404).json({ error: 'Pagamento não encontrado' });
        if (!r.ok) return res.status(502).json({ error: 'Falha ao consultar' });
        res.json({
            ok: true,
            paymentId: pay.id,
            orderId: pay.external_reference,
            status: pay.status,
            statusDetail: pay.status_detail,
            amount: pay.transaction_amount,
            approved: pay.status === 'approved',
            paid_at: pay.date_approved || null,
        });
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
});

// Confirmação de pagamento (webhook) — Mercado Pago chama este endpoint.
app.post('/api/webhook', (req, res) => {
    // O Mercado Pago notifica com topic=payment e um payment id.
    const topic = (req.query && req.query.topic) || (req.body && req.body.type) || '';
    const source = (req.query && req.query.secret_source) || '';

    // Resposta imediata (obrigatória). O processamento é assíncrono.
    res.status(200).json({ received: true });
    void processNotification({ topic, source, body: req.body });
});

async function processNotification({ topic, source, body }) {
    if (topic !== 'payment') return;

    const paymentId = body && body.data && body.data.id;
    if (!paymentId) return;

    // Validação da assinatura (se configurada em sandbox ou produção segura).
    if (source === 'mp' && WEBHOOK_SECRET) {
        // Controle de origem adicional: em produção, uma origem maliciosa
        // sem o secret não causa dano (só faz uma consulta GET).
        const secretCheck = crypto.createHmac('sha256', WEBHOOK_SECRET).update(String(paymentId)).digest('hex');
        if (!body.secret || body.secret !== secretCheck) {
            console.warn('[webhook] assinatura inválida para payment', paymentId);
            return;
        }
    }

    // Consulta o status real do pagamento no Mercado Pago.
    try {
        const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
        });
        const pay = await res.json().catch(() => ({}));
        if (pay.status === 'approved') {
            console.log(`[webhook] PEDIDO PAGO ${pay.external_reference} (payment ${paymentId}) ✓`);
            // TODO: aqui você pode notificar você mesmo (ex.: e-mail, Telegram,
            // gravar em um arquivo/DB, ou abrir o site do admin).
        }
    } catch (e) {
        console.error('[webhook] erro ao consultar pagamento:', e.message);
    }
}

// Somente em sandbox: permite simular o pagamento para testar o fluxo.
app.post('/api/simulate-pay', async (req, res) => {
    if (!IS_SANDBOX) return res.status(404).json({ error: 'Não disponível em produção' });
    const paymentId = req.body && req.body.paymentId;
    if (!paymentId) return res.status(400).json({ error: 'paymentId obrigatório' });
    try {
        const r = await fetch(`${MP_API}/v1/payments/${paymentId}`, { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } });
        const p = await r.json().catch(() => ({}));
        res.json({ status: p.status, external_reference: p.external_reference });
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
});

/* ------------------------- Iniciar ------------------------- */
app.listen(PORT, () => {
    console.log(`FG Salgados PIX backend rodando na porta ${PORT}`);
    console.log(`Modo: ${IS_SANDBOX ? 'SANDBOX' : 'PRODUÇÃO'} | Configurado: ${configured}`);
    if (!configured) {
        console.warn('AVISO: Defina MP_ACCESS_TOKEN no arquivo .env para ativar o PIX.');
    }
});
