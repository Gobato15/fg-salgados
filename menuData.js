// ============================================================
// FG Salgados — Cardápio completo (produtos AGS + FG próprios)
// Produtos AGS estão desativados (active: false) por padrão.
// Ative os desejados no painel admin → aba Cardápio.
// Imagens AGS usam URL direta: https://agsdelivery.com.br/assets/
// ============================================================

const AGS = 'https://agsdelivery.com.br/assets/';

window.fgMenuItems = [

    // ── Produtos próprios da FG Salgados (ativos) ──────────────
    {
        id: "p1",
        name: "Coxinha de Frango",
        category: "fritos",
        price: 6,
        description: "Coxinha de frango (100g) com massa artesanal de batata, receita da casa. Pronta para airfryer!",
        image: "images/ags_coxinha.webp",
        units: 1,
        active: true
    },
    {
        id: "p2",
        name: "Croissant Presunto e Queijo",
        category: "assados",
        price: 6,
        description: "Croissant recheado com presunto fatiado e queijo derretido. Clássico folhado crocante.",
        image: "images/ags_croissant.webp",
        units: 1,
        active: true
    },
    {
        id: "p3",
        name: "Bauru de Presunto e Queijo",
        category: "assados",
        price: 6,
        description: "Bauru com massa fofinha e recheio generoso de presunto, queijo e orégano.",
        image: "images/ags_bauru.webp",
        units: 1,
        active: true
    },
    {
        id: "p4",
        name: "X-Bacon",
        category: "burgers",
        price: 7.3,
        description: "X-Bacon com carne, bacon crocante, cheddar e molho especial.",
        image: "images/fg_xbacon.webp",
        units: 1,
        active: true
    },
    {
        id: "p10",
        name: "X-Cheddar",
        category: "burgers",
        price: 8.3,
        description: "X-Cheddar com duas camadas de cheddar derretido e carne suculenta.",
        image: "images/fg_xcheddar.webp",
        units: 1,
        active: true
    },
    {
        id: "p11",
        name: "X-Picanha",
        category: "burgers",
        price: 8.3,
        description: "X-Picanha com carne de picanha, catupiry cremoso e queijo.",
        image: "images/fg_xpicanha.webp",
        units: 1,
        active: true
    },
    {
        id: "p9",
        name: "Croissant de Queijo",
        category: "assados",
        price: 6,
        description: "Croissant folhado crocante com queijo cremoso e derretido.",
        image: "images/ags_croissant_queijo.webp",
        units: 1,
        active: true
    },
    {
        id: "p16",
        name: "Bolo Salgado de Frango c/ Requeijão",
        category: "assados",
        price: 10,
        description: "Bolo salgado de frango com requeijão cremoso e azeitonas gratinados.",
        image: "images/ags_bolo_salgado.webp",
        units: 1,
        active: true
    },
    {
        id: "p17",
        name: "Torta de Frango Caseira",
        category: "assados",
        price: 15,
        description: "Torta de frango com massa caseira derretendo na boca.",
        image: "images/ags_torta_frango.webp",
        units: 1,
        active: true
    },

    // ── Catálogo AGS Delivery (desativados — ative no painel) ──
    {
        id: "ags_1",
        name: "X-Carne",
        category: "burgers",
        price: 10.00,
        description: "Carne suculenta de 56g, mussarela derretida, presunto, tomate, orégano e cheddar no pão macio.",
        image: AGS + "hamburguinho_forno.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_2",
        name: "X-Picanha AGS",
        category: "burgers",
        price: 11.00,
        description: "Carne de picanha de 56g, presunto, mussarela e catupiry cremoso.",
        image: AGS + "x_picanha.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_3",
        name: "Duplo Cheddar",
        category: "burgers",
        price: 10.00,
        description: "Pão macio, duas carnes suculentas de 56g e cheddar delicioso.",
        image: AGS + "duplo_cheddar.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_4",
        name: "Coxinha de Frango Premium",
        category: "fritos",
        price: 9.00,
        description: "Coxinha de frango cremosa de 100g, feita com massa artesanal de batata. Receita da casa.",
        image: AGS + "coxinha_premium.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_5",
        name: "Bolinho de Costela",
        category: "fritos",
        price: 9.00,
        description: "Bolinho com casquinha super crocante e recheio suculento de pura costela bovina desfiada.",
        image: AGS + "bolinho_costela.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_6",
        name: "Esfirra de Carne",
        category: "assados",
        price: 4.00,
        description: "Massa árabe fofinha com recheio de carne bovina temperada e limão.",
        image: AGS + "esfirra_carne_nova.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_7",
        name: "Esfirra de Frango",
        category: "assados",
        price: 4.00,
        description: "Massa leve com recheio generoso de frango desfiado temperado.",
        image: AGS + "esfirra_frango_nova.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_8",
        name: "Esfirra de Queijo",
        category: "assados",
        price: 4.00,
        description: "Massa macia com recheio generoso de mussarela e orégano.",
        image: AGS + "esfirra_queijo_nova.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_9",
        name: "Croissant de Queijo AGS",
        category: "assados",
        price: 10.00,
        description: "Massa folhada francesa amanteigada e crocante com recheio de mussarela.",
        image: AGS + "croissant_queijo_premium.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_10",
        name: "Croissant Presunto e Queijo AGS",
        category: "assados",
        price: 10.00,
        description: "O clássico folhado recheado com presunto fatiado e queijo derretido.",
        image: AGS + "croissant_presunto_queijo_premium.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_11",
        name: "Lanche Natural de Frango",
        category: "assados",
        price: 9.00,
        description: "Lanche natural com frango desfiado, maionese, alface e cenoura ralada no pão de forma macio.",
        image: AGS + "lanche_natural_frango.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_12",
        name: "Lanche Natural de Sardinha",
        category: "assados",
        price: 10.00,
        description: "Lanche natural com patê de sardinha, alface fresca, cenoura e tomate no pão de forma macio.",
        image: AGS + "lanche_natural_sardinha.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_13",
        name: "Torta de Frango AGS",
        category: "assados",
        price: 9.00,
        description: "Deliciosa e cremosa torta de frango com massa caseira derretendo na boca. Receita especial muito bem recheada!",
        image: AGS + "torta_frango_caseira.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_14",
        name: "Cachorro Quente",
        category: "assados",
        price: 9.00,
        description: "Maravilhoso cachorro quente com salsicha, molho especial da casa, purê, batata palha, ketchup e mostarda no pão macio.",
        image: AGS + "cachorro_quente_caseiro.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_15",
        name: "Pizza Brotinho Portuguesa",
        category: "assados",
        price: 9.00,
        description: "Molho de tomate, mussarela, presunto, ovos, cebola, azeitona e orégano na massa crocante.",
        image: AGS + "pizza_brotinho_portuguesa_nova.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_16",
        name: "Pizza Brotinho Mussarela",
        category: "assados",
        price: 9.00,
        description: "Molho de tomate especial, bastante mussarela derretida, rodelas de tomate e orégano na massa crocante.",
        image: AGS + "pizza_brotinho_mussarela_nova.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_17",
        name: "Pizza Brotinho Calabresa",
        category: "assados",
        price: 9.00,
        description: "Molho de tomate, mussarela, generosa porção de calabresa fatiada, cebola e orégano na massa crocante.",
        image: AGS + "pizza_brotinho_calabresa_nova.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_18",
        name: "Coca-Cola 220ml",
        category: "bebidas",
        price: 4.00,
        description: "Refrigerante Coca-Cola sabor original e refrescante. Mini lata 220ml.",
        image: AGS + "coca_cola.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_19",
        name: "Coca-Cola Zero 220ml",
        category: "bebidas",
        price: 4.00,
        description: "Refrigerante Coca-Cola sem açúcar gelada. Mini lata 220ml.",
        image: AGS + "coca_zero.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_20",
        name: "Sprite 220ml",
        category: "bebidas",
        price: 4.00,
        description: "Refrigerante Sprite sabor limão gelada. Mini lata 220ml.",
        image: AGS + "sprite_220ml.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_21",
        name: "Água Mineral 500ml",
        category: "bebidas",
        price: 3.00,
        description: "Água mineral natural cristalina e refrescante.",
        image: AGS + "agua_mineral_nova.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_22",
        name: "Chocolate Quente",
        category: "bebidas",
        price: 7.00,
        description: "Chocolate quente super cremoso e aconchegante, feito com chocolate nobre e um toque de canela.",
        image: AGS + "chocolate_quente.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_23",
        name: "Pudim de Leite Moça",
        category: "sobremesas",
        price: 8.00,
        description: "Fatia generosa de pudim de leite condensado super liso com calda de caramelo.",
        image: AGS + "pudim.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_24",
        name: "Bolo de Pote Prestígio",
        category: "sobremesas",
        price: 9.00,
        description: "Camadas de bolo de chocolate com recheio cremoso de coco fresco.",
        image: AGS + "bolo_prestigio.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_25",
        name: "Arroz Doce de Paçoca",
        category: "sobremesas",
        price: 4.00,
        description: "Cremoso arroz doce feito com paçoca de amendoim, uma sobremesa tradicional e irresistível.",
        image: AGS + "arroz_doce_pacoca.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_26",
        name: "Doce de Abacaxi",
        category: "sobremesas",
        price: 8.00,
        description: "Delicioso doce de abacaxi caseiro, equilibrando perfeitamente a acidez da fruta com a doçura da calda.",
        image: AGS + "doce_abacaxi.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_27",
        name: "Brigadeiro",
        category: "sobremesas",
        price: 0.50,
        description: "Tradicional brigadeiro gourmet feito com chocolate de verdade e granulado premium.",
        image: AGS + "brigadeiro.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_28",
        name: "Pão Caseiro",
        category: "assados",
        price: 12.50,
        description: "Pão caseiro fresquinho, macio por dentro e com casquinha dourada. Perfeito para qualquer hora do dia.",
        image: AGS + "pao_caseiro_novo.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_29",
        name: "Kibe",
        category: "fritos",
        price: 9.00,
        description: "Clássico kibe brasileiro, temperado com especiarias e hortelã, fritinho com casquinha morena e crocante.",
        image: AGS + "kibe_nova.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_30",
        name: "Enroladinho de Presunto e Queijo",
        category: "assados",
        price: 9.00,
        description: "Delicioso enroladinho assado, massa fofinha com recheio derretido de presunto e muito queijo.",
        image: AGS + "enroladinho_nova.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_31",
        name: "Bauru de Presunto e Queijo AGS",
        category: "assados",
        price: 9.00,
        description: "Clássico bauru com massa fofinha e recheio generoso de presunto e queijo derretido, temperado com orégano.",
        image: AGS + "bauru_queijo_presunto.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_32",
        name: "Massa Folhada Presunto e Queijo",
        category: "assados",
        price: 8.00,
        description: "Deliciosa massa folhada assada e recheada com muito presunto e queijo.",
        image: AGS + "massa_folhada.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_33",
        name: "Esfirra de Calabresa",
        category: "assados",
        price: 9.00,
        description: "Massa macia recheada com calabresa moída temperada.",
        image: AGS + "esfirra_calabresa.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_34",
        name: "Pão de Batata Frango com Requeijão",
        category: "assados",
        price: 9.00,
        description: "Delicioso salgado assado, massa super fofinha de batata com recheio de frango e catupiry.",
        image: AGS + "pao_batata_frango.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_35",
        name: "Esfirra de Frango Premium",
        category: "assados",
        price: 9.00,
        description: "Massa leve com recheio generoso de frango desfiado temperado.",
        image: AGS + "esfirra_frango_nova_1.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_36",
        name: "Cone Leite Ninho",
        category: "sobremesas",
        price: 8.00,
        description: "Casquinha crocante recheada com cremoso brigadeiro de leite ninho e finalizada com leite em pó.",
        image: AGS + "cone_leite_ninho.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_37",
        name: "Cone Prestígio",
        category: "sobremesas",
        price: 8.00,
        description: "Casquinha crocante recheada com brigadeiro de chocolate cremoso e generosas lascas de coco fresco.",
        image: AGS + "cone_prestigio.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_38",
        name: "Cone Oreo",
        category: "sobremesas",
        price: 8.00,
        description: "Casquinha crocante recheada com brigadeiro de chocolate cremoso e pedaços de biscoito Oreo triturado.",
        image: AGS + "cone_oreo.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_39",
        name: "Cone Ouro Branco",
        category: "sobremesas",
        price: 8.00,
        description: "Casquinha crocante recheada com cremoso brigadeiro de chocolate branco e finalizada com Ouro Branco picado.",
        image: AGS + "cone_ouro_branco.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_40",
        name: "Cone Sonho de Valsa",
        category: "sobremesas",
        price: 8.00,
        description: "Casquinha crocante recheada com brigadeiro cremoso de chocolate e amendoim, em homenagem ao clássico Sonho de Valsa.",
        image: AGS + "cone_sonho_de_valsa.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_41",
        name: "Bolo Salgado de Frango AGS",
        category: "assados",
        price: 10.00,
        description: "Bolo salgado artesanal recheado com frango desfiado temperado, requeijão cremoso e azeitonas, coberto com massa fofinha e gratinado ao forno.",
        image: AGS + "bolo_salgado_frango_requeijao.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_42",
        name: "Bolo de Fatia",
        category: "sobremesas",
        price: 12.00,
        description: "Deliciosa fatia de bolo caseiro, macia, fofinha e preparada diariamente com ingredientes selecionados.",
        image: AGS + "bolo_corte.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_43",
        name: "Sonho de Doce de Leite",
        category: "sobremesas",
        price: 8.00,
        description: "Massa fofinha e levemente adocicada, frita no ponto certo e generosamente recheada com doce de leite cremoso.",
        image: AGS + "sonho_doce_leite.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_44",
        name: "Bomba de Creme (Choc. Misto)",
        category: "sobremesas",
        price: 8.00,
        description: "Deliciosa bomba recheada com cremoso recheio de creme de baunilha, coberta com uma dupla camada de chocolate ao leite e chocolate branco.",
        image: AGS + "bomba_creme.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_45",
        name: "Bomba de Ninho (Choc. Misto)",
        category: "sobremesas",
        price: 8.00,
        description: "Irresistível bomba recheada com brigadeiro cremoso de Leite Ninho, com refinada cobertura dupla de chocolate preto e branco.",
        image: AGS + "bomba_branca.webp",
        units: 1,
        active: false
    },
    {
        id: "ags_46",
        name: "Bomba de Oreo (Choc. Misto)",
        category: "sobremesas",
        price: 8.00,
        description: "Especial bomba recheada com creme de biscoito Oreo e pedaços crocantes, finalizada com dupla cobertura de chocolate preto e branco.",
        image: AGS + "bomba_oreo.webp",
        units: 1,
        active: false
    }
]