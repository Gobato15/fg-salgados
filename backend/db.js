const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const menuData = require('../menuData');

let dbPromise;

async function initDB() {
    if (!dbPromise) {
        dbPromise = open({
            filename: path.join(__dirname, 'data', 'database.sqlite'),
            driver: sqlite3.Database
        }).then(async (db) => {
            await db.exec(`
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
            `);
            
            // Check if empty, if so, seed it
            const row = await db.get("SELECT COUNT(*) as cnt FROM fg_produtos");
            if (row.cnt === 0) {
                console.log("Banco SQLite vazio. Semeando dados...");
                let ordem = 1;
                for (const item of menuData) {
                    let precoNum = parseFloat(String(item.price).replace(',', '.'));
                    if (isNaN(precoNum)) precoNum = 0;
                    
                    await db.run(`
                        INSERT INTO fg_produtos (nome, categoria, preco, descricao, foto, ordem, ativo)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        item.name, 
                        item.category || 'fritos', 
                        precoNum, 
                        item.desc || item.description || '', 
                        item.image || '', 
                        ordem++,
                        1
                    ]);
                }
                console.log("Banco SQLite semeado com sucesso.");
            }
            
            return db;
        });
    }
    return dbPromise;
}

const pool = {
    all: async (sql, params = []) => {
        const db = await initDB();
        return db.all(sql, params);
    },
    run: async (sql, params = []) => {
        const db = await initDB();
        return db.run(sql, params);
    }
};

module.exports = pool;
