const fs = require('fs');
const path = require('path');

const filePaths = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'admin', 'admin.html'),
    path.join(__dirname, 'admin', 'admin.js'),
    path.join(__dirname, 'backend', 'server.js'),
    path.join(__dirname, 'backend', 'update_server.js')
];

const replacements = {
    'Ã§': 'ç',
    'Ã£': 'ã',
    'Ã¡': 'á',
    'Ã³': 'ó',
    'Ã©': 'é',
    'Ãª': 'ê',
    'Ã­': 'í',
    'Ã¢': 'â',
    'Ãµ': 'õ',
    'Ãº': 'ú',
    'Ã ': 'à',
    'Ã‡': 'Ç',
    'Ãƒ': 'Ã',
    'Ã‰': 'É',
    'ÃŠ': 'Ê',
    'Ã“': 'Ó',
    'Ã”': 'Ô',
    'Ãš': 'Ú',
    'Ã ': 'Í',
    'â€”': '—',
    'â€“': '–',
    'â€œ': '“',
    'â€ ': '”',
    'â€˜': '‘',
    'â€™': '’',
    'CÂ°': 'C°',
    'Â°': '°',
    'Âº': 'º',
    'Âª': 'ª',
    'Ã¢â‚¬â€ ': '—',
    'Ã¢â‚¬â€œ': '–',
    'â‚¬': '€',
    'Ã§Ã£o': 'ção' // safety
};

for (const file of filePaths) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    for (const [bad, good] of Object.entries(replacements)) {
        content = content.split(bad).join(good);
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log('Done with ' + file);
}
