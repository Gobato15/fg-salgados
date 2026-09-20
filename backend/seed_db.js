require('dotenv').config();
const mysql = require('mysql2/promise');
const menuData = require('../menuData.js');

async function seed() {
    console.log("Conectando ao MySQL...");
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
    });

    console.log("Criando banco de dados mau07755_fg_produtos se não existir...");
    await connection.query('CREATE DATABASE IF NOT EXISTS mau07755_fg_produtos;');
    await connection.query('USE mau07755_fg_produtos;');

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

    console.log("Inserindo produtos do menuData.js...");
    let ordem = 1;
    for (const item of menuData) {
        let precoNum = parseFloat(String(item.price).replace(',', '.'));
        if (isNaN(precoNum)) precoNum = 0;
        
        // Remove text like 'p' from ID if exists, though auto_increment will ignore it
        await connection.query(`
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
        console.log(`Inserido: ${item.name}`);
    }

    console.log("Finalizado com sucesso!");
    process.exit(0);
}

seed().catch(e => {
    console.error("Erro no seed:", e);
    process.exit(1);
});
