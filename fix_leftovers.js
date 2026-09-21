const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.html');
let content = fs.readFileSync(file, 'utf8');

const replacements = {
    '180 à  230C° !': '180 a 230°C!',
    'Â·': '·',
    'â€¢': '•'
};

for (const [bad, good] of Object.entries(replacements)) {
    content = content.split(bad).join(good);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed final leftovers!');
