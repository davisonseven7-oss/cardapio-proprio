/* Dados iniciais: cria o admin (pelas variáveis ADMIN_EMAIL e ADMIN_PASSWORD)
   e, na primeira vez, os cardápios da Potengi Rações (ativo) e da Boa Hora (pausado). */

function seed({ db, hashPass }) {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(), pass = process.env.ADMIN_PASSWORD || '';
  if (!db.prepare(`SELECT 1 FROM users WHERE role='admin'`).get()) {
    if (email && pass.length >= 8) { db.prepare(`INSERT INTO users(email,name,pass_hash,role) VALUES(?,?,?,'admin')`).run(email, 'Administrador', hashPass(pass)); console.log('Admin criado:', email); }
    else console.warn('ATENÇÃO: defina ADMIN_EMAIL e ADMIN_PASSWORD (8+ caracteres) para criar o login de administrador.');
  }
  if (db.prepare('SELECT 1 FROM tenants').get()) return;
  db.exec('BEGIN');
  try { potengi(db); boaHora(db); db.exec('COMMIT'); console.log('Cardápios iniciais criados: /potengi e /boahora'); }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

const ins = (db, tb, o) => { const ks = Object.keys(o); return db.prepare(`INSERT INTO ${tb}(${ks.join(',')}) VALUES(${ks.map(() => '?').join(',')})`).run(...ks.map(k => o[k] !== null && typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k])).lastInsertRowid; };
const ago = h => new Date(Date.now() - h * 36e5).toISOString();

function potengi(db) {
  const t = ins(db, 'tenants', { slug: 'potengi', name: 'Potengi Rações', status: 'ativo', settings: {
    subtitulo: 'Rações · Selaria Don Diego · Parnamirim/RN', cidade: 'Parnamirim/RN', logo: '/img/potengi-logo.jpg',
    whatsapp: '5584994485507', enviarWhats: false, atendente: 'seg a sex 7h30–17h30, sáb 7h30–12h30',
    tema: { cor: '#0B3480', destaque: '#FFC83D', acento: '#5DB332', fonte: 'Archivo Black' },
    horario: { 0: null, 1: [7.5, 17.5], 2: [7.5, 17.5], 3: [7.5, 17.5], 4: [7.5, 17.5], 5: [7.5, 17.5], 6: [7.5, 12.5] },
    bairros: [['Centro', 6], ['Cohabinal', 6], ['Monte Castelo', 7], ['Rosa dos Ventos', 7], ['Emaús', 8], ['Passagem de Areia', 8], ['Parque das Nações', 9], ['Vale do Sol', 9], ['Nova Parnamirim', 10]],
    retirada: true, minimo: 50, pagamentos: ['Pix na entrega', 'Cartão (maquininha)', 'Dinheiro'],
    promoTemas: ['Domingo: peça para segunda', 'Segunda do cavalo', 'Terça pet', 'Quarta da selaria', 'Quinta do campo', 'Sexta country', 'Sábado de vaquejada'],
    curtidas: { meta: 3, desconto: 5, campeao: 20 }, robo: { nome: 'Potenginho', ativo: true }
  } });
  const bP = ins(db, 'brands', { tenant_id: t, name: 'Potengi Rações', sub: 'Nutrição que gera resultados', logo: '/img/potengi-logo.jpg', sort: 1 });
  const bD = ins(db, 'brands', { tenant_id: t, name: 'Selaria Don Diego', sub: 'Arreios · acessórios · roupas', logo: '/img/dondiego-logo.jpg', sort: 2 });
  const C = {}; [['cavalos', bP, 'Cavalos', 'horse'], ['pets', bP, 'Cães e Gatos', 'dog'], ['rural', bP, 'Aves e Rural', 'corn'], ['arreios', bD, 'Arreios', 'saddle'], ['acess', bD, 'Acessórios', 'shoe'], ['roupas', bD, 'Roupas', 'hat']]
    .forEach(([k, b, n, i], s) => C[k] = ins(db, 'categories', { tenant_id: t, brand_id: b, name: n, icon: i, sort: s }));
  const o = (nome, ...itens) => [{ nome, itens: itens.map(x => [x, 0]) }];
  const P = {}; let s = 0;
  const add = (k, cat, name, price, icon, descr, x = {}) => P[k] = ins(db, 'products', { tenant_id: t, category_id: C[cat], name, price, icon, descr, sort: s++, tag: x.tag || '', bulk_qty: x.at ? x.at[0] : null, bulk_price: x.at ? x.at[1] : null, options: x.opts || [], promo_price: x.promo ? x.promo[0] : null, promo_days: x.promo ? x.promo[1] : [], keywords: x.kw || '' });
  add('racao', 'cavalos', 'Ração para equinos 40 kg', 129.9, 'sack', 'Para cavalos de lida e esporte.', { at: [5, 119.9], tag: 'Mais vendido', promo: [119.9, [0, 1]], kw: 'racao cavalo equino' });
  add('mustang', 'cavalos', 'SM Mustang 4.0', 89.9, 'jar', 'Suplemento: energia para trabalhos intensos.', { tag: 'Chegou', promo: [79.9, [6]], kw: 'suplemento mustang' });
  add('sal', 'cavalos', 'Sal mineral equino 25 kg', 79.9, 'sack', 'Minerais para o dia a dia do plantel.', { at: [5, 74.9], kw: 'sal mineral' });
  add('aveia', 'cavalos', 'Aveia em grão 30 kg', 99.9, 'corn', 'Complemento energético.', { at: [5, 94.9] });
  add('caes', 'pets', 'Ração cães adultos 15 kg', 119.9, 'dog', 'Completa e balanceada.', { at: [3, 112.9], opts: o('Sabor', 'Carne', 'Frango'), promo: [109.9, [2]], kw: 'cachorro cao caes' });
  add('filhote', 'pets', 'Ração cães filhotes 10 kg', 99.9, 'dog', 'Grãos menores, mais proteína.', { kw: 'filhote cachorro' });
  add('gatos', 'pets', 'Ração gatos adultos 10 kg', 109.9, 'cat', 'Controle de bolas de pelo.', { opts: o('Sabor', 'Peixe', 'Carne'), kw: 'gato gatos' });
  add('areia', 'pets', 'Areia sanitária 4 kg', 19.9, 'cat', 'Granulada, controla odor.', { at: [6, 17.9], promo: [16.9, [2]] });
  add('petisco', 'pets', 'Petisco bifinho 500 g', 24.9, 'bone', 'Para recompensa e treino.');
  add('milho', 'rural', 'Milho em grão 50 kg', 89.9, 'corn', 'Para aves e criação.', { at: [10, 84.9], promo: [84.9, [4]] });
  add('postura', 'rural', 'Ração postura 40 kg', 99.9, 'bird', 'Para galinhas poedeiras.', { at: [5, 94.9], promo: [92.9, [4]], kw: 'galinha' });
  add('pinto', 'rural', 'Ração pintinho inicial 20 kg', 69.9, 'bird', 'Primeiras semanas de vida.', { kw: 'pintinho pinto' });
  add('sela', 'arreios', 'Sela australiana', 1890, 'saddle', 'Couro legítimo, conforto em longas lidas.', { tag: 'Destaque' });
  add('cabecada', 'arreios', 'Cabeçada com rédea', 189.9, 'bridle', 'Couro trabalhado à mão.', { promo: [169.9, [3]], kw: 'redea' });
  add('peitoral', 'arreios', 'Peitoral trançado', 149.9, 'bridle', 'Firme e bonito na pista.');
  add('manta', 'arreios', 'Manta para sela', 129.9, 'saddle', 'Protege o lombo do cavalo.', { opts: o('Cor', 'Marrom', 'Preta', 'Bege'), promo: [114.9, [3]] });
  add('cabresto', 'acess', 'Cabresto de corda', 49.9, 'bridle', 'Corda trançada resistente.');
  add('escova', 'acess', 'Kit escova e rasqueadeira', 39.9, 'brush', 'Para o trato diário.', { promo: [32.9, [1]] });
  add('ferradura', 'acess', 'Ferradura (par)', 44.9, 'shoe', 'Aço, vários tamanhos.', { opts: o('Tamanho', '0', '1', '2', '3') });
  add('chapeu', 'roupas', 'Chapéu de feltro', 189.9, 'hat', 'Aba larga, estilo country.', { opts: o('Tamanho', '56', '57', '58', '59', '60'), tag: 'Destaque', promo: [169.9, [0]] });
  add('camisa', 'roupas', 'Camisa xadrez manga longa', 139.9, 'shirt', 'Algodão, para lida e festa.', { opts: o('Tamanho', 'P', 'M', 'G', 'GG'), promo: [119.9, [5]] });
  add('bota', 'roupas', 'Bota de couro cano longo', 399.9, 'boot', 'Couro legítimo, solado de borracha.', { opts: o('Número', '38', '39', '40', '41', '42', '43', '44'), promo: [359.9, [6]] });
  add('cinto', 'roupas', 'Cinto com fivela', 99.9, 'belt', 'Fivela trabalhada em metal.', { promo: [84.9, [5]] });

  const st = (name, cover, slides, sort) => ins(db, 'stories', { tenant_id: t, name, cover, slides, sort });
  st('Cavalos', 'icon:horse', [{ icon: 'horse', t: 'Do trato à vaquejada', p: 'Ração, suplemento e sal mineral\npara o seu plantel.' }, { icon: 'sack', t: 'Ração equina 40 kg', p: 'A mais vendida da casa.', prod: P.racao }, { icon: 'jar', t: 'SM Mustang 4.0', p: 'Energia para trabalhos intensos.', prod: P.mustang }], 1);
  st('Atacado', 'icon:sack', [{ icon: 'sack', t: 'Varejo e atacado', p: 'Levando mais, cada saco sai mais barato.\nO desconto entra sozinho na sacola.' }, { icon: 'corn', t: 'Milho 50 kg', p: '10 ou mais saem por R$ 84,90 cada.', prod: P.milho }], 2);
  st('Pets', 'icon:dog', [{ icon: 'dog', t: 'Cães e gatos', p: 'Ração, areia e petisco\ncom entrega em Parnamirim.' }, { icon: 'dog', t: 'Cães adultos 15 kg', p: 'Carne ou frango.', prod: P.caes }, { icon: 'cat', t: 'Gatos 10 kg', p: 'Peixe ou carne.', prod: P.gatos }], 3);
  st('Don Diego', '/img/dondiego-logo.jpg', [{ img: '/img/dondiego-logo.jpg', t: 'Selaria Don Diego', p: 'Arreios, acessórios e roupas\nno mesmo pedido da ração.' }, { icon: 'hat', t: 'Chapéu de feltro', p: 'Aba larga, do 56 ao 60.', prod: P.chapeu }, { icon: 'boot', t: 'Bota cano longo', p: 'Couro legítimo.', prod: P.bota }], 4);
  st('Curta e ganhe', 'icon:heart', [{ icon: 'heart', t: 'Curta e ganhe 5%', p: 'Curta 3 produtos que você gosta\ne ganhe 5% no pedido.' }, { icon: 'heart', t: 'Campeão da semana', p: 'O produto mais curtido até domingo\nfica 20% mais barato na semana seguinte.' }], 5);
  const po = (prod, caption, overlay, h) => ins(db, 'posts', { tenant_id: t, img: '', product_id: P[prod], caption, overlay, created_at: ago(h) });
  po('racao', 'Ração equina de 40 kg com preço de atacado a partir de 5 sacos.', 'Atacado', 3);
  po('mustang', 'Chegou SM Mustang 4.0: energia para trabalhos intensos.', 'Aqui tem!', 6);
  po('chapeu', 'Chapéu de feltro na Selaria Don Diego. Do 56 ao 60.', '', 20);
  po('caes', 'Ração para cães adultos, carne ou frango, com entrega em Parnamirim.', '', 30);
  po('bota', 'Bota de couro cano longo pra vaquejada.', 'Sábado de vaquejada', 50);
  po('milho', 'Milho em grão de 50 kg. Levando 10, cada um sai por R$ 84,90.', '', 70);
}

function boaHora(db) {
  const t = ins(db, 'tenants', { slug: 'boahora', name: 'Boa Hora', status: 'pausado', settings: {
    subtitulo: 'Água de coco · Natal/RN', cidade: 'Natal/RN', logo: '/img/5945745.jpg', whatsapp: '', enviarWhats: false, atendente: 'das 7h às 19h',
    tema: { cor: '#17603A', destaque: '#FFC53D', acento: '#C9F25C', fonte: 'Shrikhand' },
    horario: { 0: [7, 19], 1: [7, 19], 2: [7, 19], 3: [7, 19], 4: [7, 19], 5: [7, 19], 6: [7, 19] },
    bairros: [['Lagoa Nova', 4], ['Tirol', 5], ['Petrópolis', 5], ['Candelária', 5], ['Capim Macio', 6], ['Ponta Negra', 7], ['Nova Parnamirim', 8]],
    retirada: false, minimo: 15, pagamentos: ['Pix na entrega', 'Cartão (maquininha)', 'Dinheiro'],
    promoTemas: ['Domingo em família', 'Segunda fit', 'Terça da polpa', 'Quarta do galão', 'Quinta a dois', 'Sextou', 'Sábado de praia'],
    curtidas: { meta: 3, desconto: 5, campeao: 20 }, robo: { nome: 'Coquinho', ativo: true }
  } });
  const C = {}; ['Coco', 'Garrafas', 'Combos'].forEach((n, i) => C[n] = ins(db, 'categories', { tenant_id: t, name: n, icon: ['coconut', 'bottle', 'sack'][i], sort: i }));
  const P = {}; let s = 0;
  const add = (k, cat, name, price, img, descr, x = {}) => P[k] = ins(db, 'products', { tenant_id: t, category_id: C[cat], name, price, img: `/img/${img}.jpg`, icon: 'coconut', descr, sort: s++, tag: x.tag || '', options: x.opts || [], promo_price: x.promo ? x.promo[0] : null, promo_days: x.promo ? x.promo[1] : [], keywords: x.kw || '' });
  add('coco', 'Coco', 'Coco verde gelado', 6, '5945745', 'Inteiro, furado na hora, com canudo.', { tag: 'Clássico', opts: [{ nome: 'Como você quer', itens: [['Furado com canudo', 0], ['Aberto com polpa pra comer', 2]] }], promo: [5, [0, 2, 6]], kw: 'coco cocos' });
  add('polpa', 'Coco', 'Coco aberto com polpa', 8, '7676716', 'Partido ao meio, polpa macia de colher.', { promo: [6, [2]], kw: 'polpa' });
  add('g300', 'Garrafas', 'Garrafa 300 ml', 5, '7509048', 'Cabe na bolsa e na lancheira.', { promo: [4, [1]], kw: '300' });
  add('g500', 'Garrafas', 'Garrafa 500 ml', 8, '38680786', 'A dose certa pro pós-treino.', { promo: [6, [1, 4]], kw: '500' });
  add('g1l', 'Garrafas', 'Garrafa 1 litro', 13, '30013755', 'Pra família ou a semana toda.', { tag: 'Rende mais', promo: [11, [0, 3, 5]], kw: 'litro 1l' });
  add('gal5', 'Garrafas', 'Galão 5 litros', 45, '33044067', 'Rende ~16 copos. Festa e escritório.', { promo: [39, [3, 6]], kw: 'galao galoes 5l' });
  add('casal', 'Combos', 'Combo casal · 2 cocos', 11, '8249235', 'Dois cocos gelados por R$ 11.', { promo: [9, [4]], kw: 'casal combo' });
  add('cx12', 'Combos', 'Caixa com 12 cocos', 60, '12194253', 'Sai R$ 5 cada. Pra evento ou estoque.', { promo: [52, [5]], kw: 'caixa' });
  const st = (name, cover, slides, sort) => ins(db, 'stories', { tenant_id: t, name, cover: `/img/${cover}.jpg`, slides: slides.map(x => ({ ...x, img: `/img/${x.img}.jpg` })), sort });
  st('Promo', '8249235', [{ img: '8249235', t: '2 cocos por R$ 11', p: 'Combo casal, gelado, todo dia.', prod: P.casal }, { img: '5945745', t: 'Coco gelado', p: 'Furado na hora, com canudo.', prod: P.coco }], 1);
  st('Garrafas', '30013755', [{ img: '7509048', t: '300 ml', p: 'Cabe na bolsa.', prod: P.g300 }, { img: '38680786', t: '500 ml', p: 'Pós-treino na medida.', prod: P.g500 }, { img: '30013755', t: '1 litro', p: 'Pra semana toda.', prod: P.g1l }], 2);
  st('Eventos', '29467600', [{ img: '29467600', t: 'Coco no seu evento', p: 'Cerca de 300 ml por convidado.\nO robô do direct calcula pra você.' }, { img: '33044067', t: 'Galão de 5 L', p: 'Rende umas 16 pessoas.', prod: P.gal5 }, { img: '12194253', t: 'Caixa com 12', p: 'R$ 5 cada coco.', prod: P.cx12 }], 3);
  st('Bastidores', '31720557', [{ img: '29488429', t: 'Do pé', p: 'Coco verde, colhido no ponto.' }, { img: '31720557', t: 'Aberto na hora', p: 'Nada de água parada.' }, { img: '23947910', t: 'Todo dia às 7h', p: 'A gente começa cedo.' }], 4);
  st('Curta e ganhe', '11218810', [{ img: '11218810', t: 'Curta e ganhe 5%', p: 'Curta 3 produtos que você gosta\ne ganhe 5% no pedido.' }, { img: '9313901', t: 'Campeão da semana', p: 'O produto mais curtido até domingo\nfica 20% mais barato na semana seguinte.' }], 5);
  const po = (img, prod, caption, overlay, h) => ins(db, 'posts', { tenant_id: t, img: `/img/${img}.jpg`, product_id: prod ? P[prod] : null, caption, overlay, created_at: ago(h) });
  po('30013755', 'g1l', 'Do coco pra garrafa no mesmo dia. Sem conservante, sem açúcar.', '', 2);
  po('5945745', 'coco', 'O clássico que não sai de moda.', 'Coco gelado', 5);
  po('7676716', 'polpa', 'Bebeu a água? Agora a polpa.', '', 8);
  po('33044067', 'gal5', 'Aniversário ou café do escritório: chama o robô que ele calcula.', 'Galão de 5 L', 24);
  po('8249235', 'casal', 'Coco é melhor dividido.', '2 por R$ 11', 26);
  po('31720557', null, 'Facão afiado e coco gelado. Assim começa o dia.', 'Bastidores', 50);
  po('9313901', 'coco', 'Fim de tarde pede coco.', '', 72);
  po('31448641', null, 'Coco verde, pesado, cheio de água.', 'Carga nova', 75);
}

module.exports = { seed };
