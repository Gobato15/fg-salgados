const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Chunk 1: imports
code = code.replace(
`require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const menuData = require('../menuData');`,
`require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const pool = require('./db');`
);

// Chunk 2: DATA_DIR, etc
code = code.replace(
`const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');`,
`const UPLOADS_DIR = path.join(__dirname, 'uploads');`
);

// Chunk 3: Helpers / Cardapio
code = code.replace(
`function ensureDataDirs() {
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
}`,
`require('fs').mkdirSync(UPLOADS_DIR, { recursive: true });

function normalizeItem(row) {
    return {
        id: String(row.id),
        name: row.nome,
        price: Number(row.preco) || 0,
        units: Math.max(1, parseInt(row.qtd, 10) || 1),
        category: String(row.categoria || 'fritos').trim(),
        desc: String(row.descricao || '').trim(),
        image: String(row.foto || '').trim(),
        active: !!row.ativo,
        ordem: Number(row.ordem) || 0
    };
}

async function getMergedMenu(includeInactive = false) {
    const query = includeInactive 
        ? 'SELECT * FROM fg_produtos ORDER BY ordem ASC' 
        : 'SELECT * FROM fg_produtos WHERE ativo = 1 ORDER BY ordem ASC';
    try {
        const [rows] = await pool.query(query);
        return rows.map(normalizeItem);
    } catch (e) {
        console.error("Erro ao buscar cardápio:", e);
        return [];
    }
}`
);

// Chunk 4: validatePayload
code = code.replace(
`function validatePayload(body) {
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
        if (!menuItem) {`,
`function validatePayload(body, menuItems) {
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
        const menuItem = menuItems.find(m => String(m.id) === String(item.id));
        if (!menuItem) {`
);

// Chunk 5: /api/pix route modification (which is after createPixPayment)
// Wait, the easiest way to modify /api/pix is to find the app.post('/api/pix', ...)
code = code.replace(
`app.post('/api/pix', async (req, res) => {
    if (!configured && !IS_SANDBOX) {
        return res.status(503).json({ error: 'Backend não configurado.' });
    }
    if (rateLimit(\`pix:\${clientIp(req)}\`, 10, 60 * 1000)) {
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.' });
    }

    const validation = validatePayload(req.body);`,
`app.post('/api/pix', async (req, res) => {
    if (!configured && !IS_SANDBOX) {
        return res.status(503).json({ error: 'Backend não configurado.' });
    }
    if (rateLimit(\`pix:\${clientIp(req)}\`, 10, 60 * 1000)) {
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.' });
    }

    const menuItems = await getMergedMenu(false);
    const validation = validatePayload(req.body, menuItems);`
);

// Chunk 6: /api/simulate-pay
code = code.replace(
`app.post('/api/simulate-pay', async (req, res) => {
    if (!IS_SANDBOX) return res.status(404).json({ error: 'Not found' });
    if (rateLimit(\`simulate:\${clientIp(req)}\`, 10, 60 * 1000)) {
        return res.status(429).json({ error: 'Rate limit excedido' });
    }

    const validation = validatePayload(req.body);`,
`app.post('/api/simulate-pay', async (req, res) => {
    if (!IS_SANDBOX) return res.status(404).json({ error: 'Not found' });
    if (rateLimit(\`simulate:\${clientIp(req)}\`, 10, 60 * 1000)) {
        return res.status(429).json({ error: 'Rate limit excedido' });
    }

    const menuItems = await getMergedMenu(false);
    const validation = validatePayload(req.body, menuItems);`
);

// Chunk 7: /api/menu
code = code.replace(
`app.get('/api/menu', (req, res) => {
    res.json({ ok: true, items: getMergedMenu(false), updatedAt: Date.now() });
});`,
`app.get('/api/menu', async (req, res) => {
    res.json({ ok: true, items: await getMergedMenu(false), updatedAt: Date.now() });
});`
);

// Chunk 8: /api/admin/products GET
code = code.replace(
`app.get('/api/admin/products', requireAdmin, (req, res) => {
    res.json({ ok: true, items: getMergedMenu(true) });
});`,
`app.get('/api/admin/products', requireAdmin, async (req, res) => {
    res.json({ ok: true, items: await getMergedMenu(true) });
});`
);

// Chunk 9: /api/admin/products POST
code = code.replace(
`// Cria ou atualiza um produto (upsert pelo id).
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
    if (!/^https?:|^(\\.\\/)?images\\//i.test(item.image)) {
        return res.status(400).json({ error: 'Imagem inválida.' });
    }
    const store = readStore();
    store.products[id] = item;
    const idx = (store.deleted || []).indexOf(id);
    if (idx >= 0) store.deleted.splice(idx, 1);
    writeStore(store);
    return res.json({ ok: true, item });
});`,
`// Cria ou atualiza um produto no MySQL
app.post('/api/admin/products', requireAdmin, async (req, res) => {
    const b = req.body || {};
    let id = parseInt(String(b.id).replace(/\\D/g, ''), 10);
    if (isNaN(id) || !b.id) id = null;

    if (!b.name || Number(b.price) <= 0) {
        return res.status(400).json({ error: 'Nome e preço válidos são obrigatórios.' });
    }

    try {
        if (id) {
            await pool.query(
                \`UPDATE fg_produtos SET nome=?, descricao=?, preco=?, foto=?, categoria=?, ativo=?, ordem=?, qtd=? WHERE id=?\`,
                [b.name, b.desc || '', Number(b.price), b.image || '', b.category || 'fritos', b.active !== false ? 1 : 0, Number(b.ordem) || 0, Math.max(1, parseInt(b.units, 10) || 1), id]
            );
        } else {
            const [result] = await pool.query(
                \`INSERT INTO fg_produtos (nome, descricao, preco, foto, categoria, ativo, ordem, qtd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
                [b.name, b.desc || '', Number(b.price), b.image || '', b.category || 'fritos', b.active !== false ? 1 : 0, Number(b.ordem) || 0, Math.max(1, parseInt(b.units, 10) || 1)]
            );
            id = result.insertId;
        }
        
        // Retornar o item no formato esperado
        const item = {
            id: String(id),
            name: b.name,
            price: Number(b.price),
            units: Math.max(1, parseInt(b.units, 10) || 1),
            category: b.category || 'fritos',
            desc: b.desc || '',
            image: b.image || '',
            active: b.active !== false
        };
        return res.json({ ok: true, item });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erro interno ao salvar no banco de dados.' });
    }
});`
);

// Chunk 10: /api/admin/products DELETE
code = code.replace(
`// Exclui um produto (marca como removido mesmo se ele vier do menuData.js).
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
});`,
`// Exclui um produto no MySQL
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const id = parseInt(String(req.params.id).replace(/\\D/g, ''), 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'ID de produto inválido.' });
    }
    try {
        await pool.query(\`DELETE FROM fg_produtos WHERE id=?\`, [id]);
        return res.json({ ok: true, id: String(id) });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Erro interno ao excluir.' });
    }
});`
);

fs.writeFileSync('server.js', code);
console.log('Update complete');
