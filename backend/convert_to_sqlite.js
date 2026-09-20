const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
`const [rows] = await pool.query(query);`,
`const rows = await pool.all(query);`
);

code = code.replace(
`await pool.query(
                \`UPDATE fg_produtos SET nome=?, descricao=?, preco=?, foto=?, categoria=?, ativo=?, ordem=?, qtd=? WHERE id=?\`,
                [b.name, b.desc || '', Number(b.price), b.image || '', b.category || 'fritos', b.active !== false ? 1 : 0, Number(b.ordem) || 0, Math.max(1, parseInt(b.units, 10) || 1), id]
            );`,
`await pool.run(
                \`UPDATE fg_produtos SET nome=?, descricao=?, preco=?, foto=?, categoria=?, ativo=?, ordem=?, qtd=? WHERE id=?\`,
                [b.name, b.desc || '', Number(b.price), b.image || '', b.category || 'fritos', b.active !== false ? 1 : 0, Number(b.ordem) || 0, Math.max(1, parseInt(b.units, 10) || 1), id]
            );`
);

code = code.replace(
`const [result] = await pool.query(
                \`INSERT INTO fg_produtos (nome, descricao, preco, foto, categoria, ativo, ordem, qtd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
                [b.name, b.desc || '', Number(b.price), b.image || '', b.category || 'fritos', b.active !== false ? 1 : 0, Number(b.ordem) || 0, Math.max(1, parseInt(b.units, 10) || 1)]
            );
            id = result.insertId;`,
`const result = await pool.run(
                \`INSERT INTO fg_produtos (nome, descricao, preco, foto, categoria, ativo, ordem, qtd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
                [b.name, b.desc || '', Number(b.price), b.image || '', b.category || 'fritos', b.active !== false ? 1 : 0, Number(b.ordem) || 0, Math.max(1, parseInt(b.units, 10) || 1)]
            );
            id = result.lastID;`
);

code = code.replace(
`await pool.query(\`DELETE FROM fg_produtos WHERE id=?\`, [id]);`,
`await pool.run(\`DELETE FROM fg_produtos WHERE id=?\`, [id]);`
);

fs.writeFileSync('server.js', code);
console.log("server.js convertido para chamadas do SQLite!");
