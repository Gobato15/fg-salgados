const path = require('path');
const seedProducts = require('./seed_products');

// Modo MySQL é ativado quando DB_HOST/DB_USER estão definidos no .env.
// Sem eles, usa SQLite local (backend/data/database.sqlite).
const MYSQL_ENABLED = !!(process.env.DB_HOST && process.env.DB_USER);
const DB_NAME = process.env.DB_NAME || 'mau07755_fg_produtos';

const SQL_CREATE_TABLE = `
    CREATE TABLE IF NOT EXISTS fg_produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT DEFAULT NULL,
        preco REAL NOT NULL DEFAULT 0.00,
        foto TEXT DEFAULT NULL,
        itemPromocao INTEGER NOT NULL DEFAULT 0,
        qtd INTEGER NOT NULL DEFAULT 100,
        diasPromocao TEXT NOT NULL DEFAULT '',
        descontoPromo REAL NOT NULL DEFAULT 1.00,
        categoria TEXT DEFAULT NULL,
        ativo INTEGER NOT NULL DEFAULT 1,
        ordem INTEGER NOT NULL DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`;

async function seedIfEmpty(exec) {
    const row = await exec('SELECT COUNT(*) as cnt FROM fg_produtos');
    const cnt = Array.isArray(row) ? (row[0] && row[0].cnt) : row.cnt;
    if (cnt > 0) return;

    console.log(`Banco (${DB_NAME}) vazio. Semeando produtos da FG Salgados...`);
    let ordem = 1;
    for (const p of seedProducts) {
        await exec(
            `INSERT INTO fg_produtos (nome, categoria, preco, descricao, foto, itemPromocao, qtd, diasPromocao, descontoPromo, ativo, ordem)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.nome, p.categoria || 'fritos', Number(p.preco) || 0, p.descricao || '', p.foto || '', p.itemPromocao ? 1 : 0, p.qtd || 1, p.diasPromocao || '', Number(p.descontoPromo) !== 0 ? p.descontoPromo : 1.00, p.ativo !== 0 ? 1 : 0, p.ordem || ordem]
        );
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
        await db.exec(SQL_CREATE_TABLE);
        await seedIfEmpty((sql, params) => db.get(sql, params));
        return db;
    });
    return sqlitePromise;
}

const sqlitePool = {
    all: async (sql, params = []) => { const db = await initSQLite(); return db.all(sql, params); },
    run: async (sql, params = []) => { const db = await initSQLite(); return db.run(sql, params); }
};

/* ------------------------- MySQL (hospedagem) ------------------------- */
let mysqlPoolPromise;
function initMySQL() {
    if (mysqlPoolPromise) return mysqlPoolPromise;
    const mysql = require('mysql2/promise');
    mysqlPoolPromise = (async () => {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS || '',
        });
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await conn.query(`USE \`${DB_NAME}\`;`);
        await conn.query(SQL_CREATE_TABLE.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY'));
        await conn.end();

        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS || '',
            database: DB_NAME,
            connectionLimit: 5,
        });
        await seedIfEmpty(async (sql, params) => {
            const [rows] = await pool.query(sql, params);
            return rows;
        });
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
        return { lastID: res.insertId !== undefined ? res.insertId : res.insertId };
    }
};

module.exports = MYSQL_ENABLED ? mysqlPool : sqlitePool;