const path = require('path');
const seedProducts = require('./seed_products');

// Modo MySQL é ativado quando DB_HOST/DB_USER estão definidos no .env.
// Sem eles, usa SQLite local (backend/data/database.sqlite).
const MYSQL_ENABLED = !!(process.env.DB_HOST && process.env.DB_USER);
const DB_NAME = process.env.DB_NAME || 'mau07755_fg_produtos';

// Dotenv mantém as aspas duplas quando o valor contém '#'.
// Esta função remove aspas extras e garante que a senha chega limpa.
function cleanEnvValue(val) {
    if (!val) return '';
    const s = String(val).trim();
    // Remove aspas duplas ou simples que o dotenv às vezes deixa
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
    }
    return s;
}

const DB_PASS = cleanEnvValue(process.env.DB_PASS);

const SQL_CREATE_TABLE = `
    CREATE TABLE IF NOT EXISTS fg_produtos (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nome TEXT NOT NULL,
        descricao TEXT DEFAULT NULL,
        preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        foto TEXT DEFAULT NULL,
        categoria TEXT DEFAULT NULL,
        ordem INT NOT NULL DEFAULT 0
    );
`;

const SQL_CREATE_TABLE_SQLITE = `
    CREATE TABLE IF NOT EXISTS fg_produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT DEFAULT NULL,
        preco REAL NOT NULL DEFAULT 0.00,
        foto TEXT DEFAULT NULL,
        categoria TEXT DEFAULT NULL,
        ordem INTEGER NOT NULL DEFAULT 0
    );
`;

async function seedIfEmpty(exec) {
    try {
        const row = await exec('SELECT COUNT(*) as cnt FROM fg_produtos');
        const cnt = Array.isArray(row) ? (row[0] && row[0].cnt) : row.cnt;
        if (Number(cnt) > 0) {
            console.log(`Banco (${DB_NAME}) já tem ${cnt} produto(s). Seed ignorado.`);
            return;
        }
    } catch (e) {
        // Tabela pode não existir ainda — aborta seed sem erro fatal
        console.warn('seedIfEmpty: não foi possível verificar contagem:', e.message);
        return;
    }

    console.log(`Banco (${DB_NAME}) vazio. Semeando produtos da FG Salgados...`);
    let ordem = 1;
    for (const p of seedProducts) {
        try {
            await exec(
                `INSERT INTO fg_produtos (nome, categoria, preco, descricao, foto, ordem)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [p.nome, p.categoria || 'fritos', Number(p.preco) || 0, p.descricao || '', p.foto || '', p.ordem || ordem]
            );
        } catch (err) {
            console.warn('seedIfEmpty: erro ao inserir produto:', p.nome, err.message);
        }
        ordem++;
    }
    console.log(`Banco (${DB_NAME}) semeado com ${seedProducts.length} produtos.`);
}

/* ------------------------- SQLite (local) ------------------------- */
let sqlitePromise;
function initSQLite() {
    if (sqlitePromise) return sqlitePromise;
    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');
    sqlitePromise = open({
        filename: path.join(__dirname, 'data', 'database.sqlite'),
        driver: sqlite3.Database
    }).then(async (db) => {
        await db.exec(SQL_CREATE_TABLE_SQLITE);
        await seedIfEmpty((sql, params) => db.get(sql, params));
        return db;
    });
    return sqlitePromise;
}

const sqlitePool = {
    all: async (sql, params = []) => { const db = await initSQLite(); return db.all(sql, params); },
    run: async (sql, params = []) => {
        const db = await initSQLite();
        const result = await db.run(sql, params);
        return { lastID: result.lastID };
    }
};

/* ------------------------- MySQL (hospedagem) ------------------------- */
let mysqlPoolPromise;
function initMySQL() {
    if (mysqlPoolPromise) return mysqlPoolPromise;
    const mysql = require('mysql2/promise');

    mysqlPoolPromise = (async () => {
        console.log(`[DB] Conectando ao MySQL: ${process.env.DB_HOST} / ${DB_NAME} (usuário: ${process.env.DB_USER})`);

        // Tenta criar a tabela via conexão temporária
        // Se falhar (tabela já existe ou sem permissão DDL), ignora o erro
        try {
            const conn = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: DB_PASS,
                database: DB_NAME,
                connectTimeout: 15000,
            });
            try {
                await conn.query(SQL_CREATE_TABLE);
                console.log('[DB] Tabela fg_produtos verificada/criada com sucesso.');
            } catch (ddlErr) {
                // Pode falhar se a tabela já existe com estrutura diferente — não é fatal
                console.warn('[DB] Aviso ao criar tabela (pode já existir):', ddlErr.message);
            }
            await conn.end();
        } catch (connErr) {
            console.error('[DB] Erro ao conectar para DDL:', connErr.message);
            throw connErr; // Sem banco, API não pode funcionar — propaga o erro
        }

        // Cria o pool de conexões para as requisições
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: DB_PASS,
            database: DB_NAME,
            connectionLimit: 5,
            connectTimeout: 15000,
            waitForConnections: true,
            queueLimit: 0,
        });

        // Testa se o pool funciona e faz seed se banco estiver vazio
        try {
            await seedIfEmpty(async (sql, params) => {
                const [rows] = await pool.query(sql, params);
                return rows;
            });
        } catch (seedErr) {
            console.warn('[DB] Aviso no seed:', seedErr.message);
        }

        console.log('[DB] Pool MySQL pronto!');
        return pool;
    })();

    return mysqlPoolPromise;
}

const mysqlPool = {
    all: async (sql, params = []) => {
        const pool = await initMySQL();
        const [rows] = await pool.query(sql, params);
        return rows;
    },
    run: async (sql, params = []) => {
        const pool = await initMySQL();
        const [res] = await pool.query(sql, params);
        // insertId vem do MySQL para INSERT; affectedRows para UPDATE/DELETE
        return { lastID: res.insertId || null, affectedRows: res.affectedRows };
    }
};

module.exports = MYSQL_ENABLED ? mysqlPool : sqlitePool;