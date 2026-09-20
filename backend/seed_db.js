require('dotenv').config();
const mysql = require('mysql2/promise');
const seedProducts = require('./seed_products');

async function seed() {
    console.log("Conectando ao MySQL...");
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
    });

    const dbName = process.env.DB_NAME || 'mau07755_fg_produtos';
    console.log(`Criando banco de dados ${dbName} se não existir...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbName}\`;`);

    console.log("Criando tabela fg_produtos...");
    await connection.query(`
        CREATE TABLE IF NOT EXISTS fg_produtos (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            descricao TEXT DEFAULT NULL,
            preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            foto VARCHAR(255) DEFAULT NULL,
            itemPromocao TINYINT(1) NOT NULL DEFAULT 0,
            qtd INT UNSIGNED NOT NULL DEFAULT 100,
            diasPromocao VARCHAR(255) NOT NULL DEFAULT '',
            descontoPromo DECIMAL(10,2) NOT NULL DEFAULT 1.00,
            categoria VARCHAR(100) DEFAULT NULL,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            ordem INT UNSIGNED NOT NULL DEFAULT 0,
            criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_fg_cat_ordem (categoria, ativo, ordem)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Limpando dados antigos...");
    await connection.query('TRUNCATE TABLE fg_produtos;');

    console.log("Inserindo produtos da FG Salgados...");
    let ordem = 1;
    for (const p of seedProducts) {
        await connection.query(`
            INSERT INTO fg_produtos (nome, categoria, preco, descricao, foto, itemPromocao, qtd, diasPromocao, descontoPromo, ativo, ordem)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            p.nome,
            p.categoria || 'fritos',
            Number(p.preco) || 0,
            p.descricao || '',
            p.foto || '',
            p.itemPromocao ? 1 : 0,
            p.qtd || 1,
            p.diasPromocao || '',
            Number(p.descontoPromo) !== 0 ? p.descontoPromo : 1.00,
            p.ativo !== 0 ? 1 : 0,
            p.ordem || ordem
        ]);
        console.log(`Inserido: ${p.nome}`);
        ordem++;
    }

    console.log("Finalizado com sucesso!");
    process.exit(0);
}

seed().catch(e => {
    console.error("Erro no seed:", e);
    process.exit(1);
});