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
const fs = require('fs');
const path = require('path');
const menuData = require('../menuData');

const app = express();

/* ------------------------- Configuração ------------------------- */
const PORT = process.env.PORT || 3000;
const MP_ACCESS_TOKEN = (process.env.MP_ACCESS_TOKEN || '').trim();
const MP_ENV = (process.env.MP_ENV || 'production').trim().toLowerCase();
const PUBLIC_URL = (process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
const WEBHOOK_SECRET = (process.env.WEBHOOK_SECRET || '').trim();
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || '').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '1031').trim();
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

const IS_SANDBOX = MP_ENV === 'sandbox';
const configured = !!MP_ACCESS_TOKEN;

const MP_API = 'https://api.mercadopago.com';

/* ------------------------- Middlewares ------------------------- */
// Só aceita requisições vindas do nosso site (GitHub Pages).
app.use(cors({
    origin: ALLOWED_ORIGIN || true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

app.use(express.json({ limit: '50kb' }));

// Proteção simples contra requisições com corpo anormal (webhook envia JSON curto).
// O upload de imagem é a exceção: o corpo é o arquivo de imagem, não JSON.
app.use((req, res, next) => {
    if (req.path === '/api/admin/upload') return next();
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

/* ------------------------- Cardápio e área restrita ------------------------- */

function ensureDataDirs() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
ensureDataDirs();

function readStore() {
    try {
        return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    } catch (e) {
        return { products: {}, deleted: [] };
    }
}

function writeStore(store) {
    const tmp = PRODUCTS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, PRODUCTS_FILE);
}

function normalizeItem(it) {
    return {
        id: String(it.id || ''),
        name: sanitizeText(it.name, 120),
        price: Number(it.price) || 0,
        units: Math.max(1, parseInt(it.units, 10) || 1),
        category: String(it.category || 'fritos').trim() || 'fritos',
        desc: sanitizeText(it.desc || it.description, 500),
        image: String(it.image || '').trim(),
        active: it.active !== false,
    };
}

// Cardápio final = base (menuData.js) + edições persistidas − produtos excluídos.
function getMergedMenu(includeInactive = false) {
    const store = readStore();
    const deleted = new Set(store.deleted || []);
    const saved = store.products || {};

    const out = (menuData || []).map(it => normalizeItem({ ...it, desc: it.desc || it.description }));

    Object.keys(saved).forEach((id) => {
        if (deleted.has(id)) return;
        const norm = normalizeItem(saved[id]);
        const idx = out.findIndex(o => o.id === id);
        if (idx >= 0) out[idx] = { ...out[idx], ...norm };
        else out.push(norm);
    });

    return out
        .filter(it => it.id && it.image && !deleted.has(it.id))
        .filter(it => includeInactive || it.active);
}

/* Sessões do administrador (em memória, expiram após 12h). */
const sessions = new Map();
const SESSION_TTL = 12 * 60 * 60 * 1000;
function createAdminToken() {
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL);
    return token;
}
function requireAdmin(req, res, next) {
    const header = (req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const expiresAt = sessions.get(token);
    if (!expiresAt || expiresAt < Date.now()) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
    }
    next();
}
setInterval(() => {
    const now = Date.now();
    sessions.forEach((exp, token) => { if (exp < now) sessions.delete(token); });
}, 60 * 60 * 1000);

function secureEqualHex(a, b) {
    try {
        return crypto.timingSafeEqual(Buffer.from(String(a), 'hex'), Buffer.from(String(b), 'hex'));
    } catch (e) {
        return false;
    }
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
function validatePayload(body) {
    if (!body || typeof body !== 'object') return { error: 'Corpo inválido' };

    const label = sanitizeText(body.label, 60) || 'Pedido FG Salgados';
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    
    if (items.length === 0) {
        return { error: 'Informe os itens do pedido' };
    }

    let calculatedAmount = 0;
    const validatedItems = [];

    for (const item of items) {
        // Buscar o preço real no cardápio do servidor
        const menuItem = menuData.find(m => m.id === item.id);
        if (!menuItem) {
            return { error: `Item inválido ou não encontrado: ${item.id}` };
        }
        
        const quantity = Number(item.quantity) || 1;
        if (quantity <= 0 || quantity > 100) {
            return { error: 'Quantidade de itens inválida' };
        }

        calculatedAmount += menuItem.price * quantity;
        
        validatedItems.push({
            id: menuItem.id,
            name: menuItem.name,
            quantity: quantity,
            price: menuItem.price
        });
    }

    // Aceita a taxa de entrega enviada pelo cliente (com limites de segurança)
    const deliveryFee = Number(body.deliveryFee) || 0;
    if (deliveryFee < 0 || deliveryFee > 100) {
        return { error: 'Taxa de entrega inválida' };
    }

    calculatedAmount += deliveryFee;
    const amount = Math.round(calculatedAmount * 100) / 100;

    if (amount <= 0 || amount > 5000) return { error: 'Valor do pedido inválido ou acima do limite' };

    return { label, items: validatedItems, amount };
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

/* ------------------------- Cardápio público ------------------------- */

// Cardápio que o site usa (somente produtos ativos).
app.get('/api/menu', (req, res) => {
    res.json({ ok: true, items: getMergedMenu(false), updatedAt: Date.now() });
});

/* ------------------------- Área restrita (admin) ------------------------- */

// Login com a senha de administração; devolve um token de sessão.
app.post('/api/admin/login', (req, res) => {
    if (rateLimit(`admin-login:${clientIp(req)}`, 8, 60 * 1000)) {
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde um instante.' });
    }
    const pass = String((req.body && req.body.password) || '');
    const expected = crypto.createHmac('sha256', ADMIN_PASSWORD).update('fg-admin').digest('hex');
    const got = crypto.createHmac('sha256', pass).update('fg-admin').digest('hex');
    if (!pass || !secureEqualHex(got, expected)) {
        return res.status(401).json({ error: 'Senha incorreta.' });
    }
    res.json({ ok: true, token: createAdminToken(), expiresIn: Math.round(SESSION_TTL / 1000) });
});

// Lista todos os produtos (incluindo inativos) para edição.
app.get('/api/admin/products', requireAdmin, (req, res) => {
    res.json({ ok: true, items: getMergedMenu(true) });
});

// Cria ou atualiza um produto (upsert pelo id).
app.post('/api/admin/products', requireAdmin, (req, res) => {
    const b = req.body || {};
    const id = String(b.id || '').trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
        return res.status(400).json({ error: 'ID de produto inválido.' });
    }
    const item = normalizeItem({ ...b, id });
    if (!item.name || item.price <= 0) {
        return res.status(400).json({ error: 'Nome e preço válidos são obrigatórios.' });
    }
    if (!/^https?:|^(\.\/)?images\//i.test(item.image)) {
        return res.status(400).json({ error: 'Imagem inválida.' });
    }
    const store = readStore();
    store.products[id] = item;
    const idx = (store.deleted || []).indexOf(id);
    if (idx >= 0) store.deleted.splice(idx, 1);
    writeStore(store);
    return res.json({ ok: true, item });
});

// Exclui um produto (marca como removido mesmo se ele vier do menuData.js).
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
        return res.status(400).json({ error: 'ID de produto inválido.' });
    }
    const store = readStore();
    delete store.products[id];
    if (!store.deleted.includes(id)) store.deleted.push(id);
    writeStore(store);
    return res.json({ ok: true, id });
});

// Upload de imagem de produto. Envie o arquivo cru (multipart-driven via um POST
// com Content-Type = imagem, ex.: image/webp) e receba a URL pública de volta.
const UPLOAD_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};
app.post(
    '/api/admin/upload',
    requireAdmin,
    express.raw({ type: Object.keys(UPLOAD_EXT), limit: '10mb' }),
    (req, res) => {
        const ctype = String(req.headers['content-type'] || '').toLowerCase();
        const ext = UPLOAD_EXT[ctype.split(';')[0].trim()];
        const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (!ext || bytes.length === 0) {
            return res.status(415).json({ error: 'Envie uma imagem PNG, JPG, WEBP ou GIF.' });
        }
        const fname = `prod_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
        fs.writeFileSync(path.join(UPLOADS_DIR, fname), bytes);
        const base = PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
        return res.json({ ok: true, url: `${base}/uploads/${fname}`, name: fname });
    }
);

// Serve as imagens enviadas pela área restrita.
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

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
