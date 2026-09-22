const fgMenuItems = [
    {
        id: "1",
        name: "X Carne",
        category: "burgers",
        price: 10,
        description: "Carne suculenta de 56g, mussarela derretida, presunto, tomate, orégano no pão macio.",
        image: "images/x_carne.webp",
        units: 1
    },
    {
        id: "2",
        name: "X Picanha",
        category: "burgers",
        price: 11,
        description: "Carne de picanha de 56g, presunto, mussarela e catupiry cremoso.",
        image: "images/x_picanha.webp",
        units: 1
    },
    {
        id: "3",
        name: "Duplo Cheddar",
        category: "burgers",
        price: 10,
        description: "Pão macio, duas carnes suculentas de 56g e cheddar delicioso.",
        image: "images/duplo_cheddar.webp",
        units: 1
    },
    {
        id: "4",
        name: "Coxinha de Frango",
        category: "coxinha",
        price: 9,
        description: "Coxinha de frango cremosa de 100g, feita com massa artesanal de batata. Receita da casa.",
        image: "images/coxinha_premium.webp",
        units: 1
    },
    {
        id: "5",
        name: "Croissant Presunto e Queijo",
        category: "croissant",
        price: 10,
        description: "O clássico folhado recheado com presunto fatiado e queijo derretido.",
        image: "images/croissant_presunto_queijo_premium.webp",
        units: 1
    },
    {
        id: "6",
        name: "Lanche Natural de Frango",
        category: "lanches",
        price: 9,
        description: "Lanche natural com frango desfiado, maionese, alface e cenoura ralada no pão de forma macio.",
        image: "images/lanche_natural_frango.webp",
        units: 1
    },
    {
        id: "7",
        name: "Bauru de Presunto e Queijo",
        category: "salgados",
        price: 9,
        description: "Clássico bauru com massa fofinha e recheio generoso de presunto e queijo derretido, temperado com um toque de orégano.",
        image: "images/bauru_queijo_presunto.webp",
        units: 1
    },
    {
        id: "8",
        name: "X Bacon",
        category: "burgers",
        price: 10,
        description: "Carne de 56g, bacon crocante, mussarela derretida e maionese da casa no pão macio.",
        image: "images/fg_xbacon.webp",
        units: 1
    },
    {
        id: "9",
        name: "X AGS",
        category: "burgers",
        price: 14,
        description: "Pão macio, duas carnes suculentas de 56g, tomate, presunto, queijo, requeijão, calabresa e bacon.",
        image: "images/x_ags_premium.webp",
        units: 1
    }
]

if (typeof window !== 'undefined') {
    window.fgMenuItems = fgMenuItems;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = fgMenuItems;
}