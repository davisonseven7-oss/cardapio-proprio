/* Dados iniciais: cria o admin (pelas variáveis ADMIN_EMAIL e ADMIN_PASSWORD)
   e, na primeira vez, os cardápios da Potengi Rações (ativo) e da Boa Hora (pausado). */

function seed({ db, hashPass }) {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(), pass = process.env.ADMIN_PASSWORD || '';
  if (!db.prepare(`SELECT 1 FROM users WHERE role='admin'`).get()) {
    if (email && pass.length >= 8) { db.prepare(`INSERT INTO users(email,name,pass_hash,role) VALUES(?,?,?,'admin')`).run(email, 'Administrador', hashPass(pass)); console.log('Admin criado:', email); }
    else console.warn('ATENÇÃO: defina ADMIN_EMAIL e ADMIN_PASSWORD (8+ caracteres) para criar o login de administrador.');
  }
  if (db.prepare('SELECT 1 FROM tenants').get()) { demo(db); fotos(db); galdino(db); galdinoReal(db); galdinoOfertasNov(db); ofertaHoje(db); return; }
  db.exec('BEGIN');
  try { potengi(db); boaHora(db); db.exec('COMMIT'); console.log('Cardápios iniciais criados: /potengi e /boahora'); }
  catch (e) { db.exec('ROLLBACK'); throw e; }
  demo(db); fotos(db); galdino(db); galdinoReal(db); galdinoOfertasNov(db); ofertaHoje(db);
}

/* login de demonstração do Boa Hora (para mostrar a clientes).
   Só o hash da senha fica aqui; a senha não está no código. Na primeira vez,
   também ativa o cardápio do Boa Hora. Para tirar, exclua o login no /admin. */
const DEMO = { email: 'boahora@demo.huntix', hash: '122ef41b82d0aec72c53ec4507aafd82:9bda771191c7a938289a76e1e66ea77fd8d98b2f9401ec6e11f1b382079c23a3a073c2a7af560e25a27db9470456333f05b6acce2f6ced5c73ee9c44fb850c11' };
function demo(db) {
  const t = db.prepare("SELECT * FROM tenants WHERE slug='boahora'").get(); if (!t) return;
  const s = JSON.parse(t.settings || '{}'); if (s.demoCriado) return;
  if (!db.prepare('SELECT 1 FROM users WHERE email=?').get(DEMO.email)) db.prepare("INSERT INTO users(email,name,pass_hash,role,tenant_id) VALUES(?,?,?,'cliente',?)").run(DEMO.email, 'Boa Hora (demonstração)', DEMO.hash, t.id);
  s.demoCriado = true; db.prepare("UPDATE tenants SET status='ativo', settings=? WHERE id=?").run(JSON.stringify(s), t.id);
  console.log('Login de demonstração do Boa Hora pronto:', DEMO.email);
}

/* fotos ilustrativas dos produtos da Potengi e da Don Diego (para demonstração).
   Roda uma vez e só preenche produtos que ainda estão sem foto. */
const FOTOS = { 'Ração para equinos 40 kg': 'pot-1.jpg', 'SM Mustang 4.0': 'pot-2.jpg', 'Sal mineral equino 25 kg': 'pot-3.jpg', 'Aveia em grão 30 kg': 'pot-4.jpg',
  'Ração cães adultos 15 kg': 'pot-5.png', 'Ração cães filhotes 10 kg': 'pot-6.png', 'Ração gatos adultos 10 kg': 'pot-7.png', 'Areia sanitária 4 kg': 'pot-8.webp',
  'Petisco bifinho 500 g': 'pot-9.webp', 'Milho em grão 50 kg': 'pot-10.jpg', 'Ração postura 40 kg': 'pot-11.jpg', 'Ração pintinho inicial 20 kg': 'pot-12.jpg',
  'Sela australiana': 'pot-13.jpg', 'Cabeçada com rédea': 'pot-14.jpg', 'Peitoral trançado': 'pot-15.jpg', 'Manta para sela': 'pot-16.jpg',
  'Cabresto de corda': 'pot-17.jpg', 'Kit escova e rasqueadeira': 'pot-18.jpg', 'Ferradura (par)': 'pot-19.jpg', 'Chapéu de feltro': 'pot-20.jpg',
  'Camisa xadrez manga longa': 'pot-21.jpg', 'Bota de couro cano longo': 'pot-22.jpg', 'Cinto com fivela': 'pot-23.jpg' };
function fotos(db) {
  const t = db.prepare("SELECT * FROM tenants WHERE slug='potengi'").get(); if (!t) return;
  const s = JSON.parse(t.settings || '{}'); if (s.fotosDemo) return;
  const up = db.prepare("UPDATE products SET img=? WHERE tenant_id=? AND name=? AND (img IS NULL OR img='')");
  let n = 0; for (const [nome, arq] of Object.entries(FOTOS)) n += Number(up.run('/img/' + arq, t.id, nome).changes);
  s.fotosDemo = true; db.prepare('UPDATE tenants SET settings=? WHERE id=?').run(JSON.stringify(s), t.id);
  console.log('Fotos ilustrativas da Potengi:', n, 'produtos');
}

/* Farmácia Antônio Galdino (FAG), cliente do CRM. Cardápio de demonstração com
   login próprio. Roda uma vez: só cria se a loja ainda não existir.
   Só o hash da senha fica aqui; a senha não está no código. */
const GALDINO_LOGIN = { email: 'galdino@demo.huntix', hash: '69f1378626f2d69ebbaa240c8b51cc85:26955960d74f332ee5e97b6ea425b35ba5d667d34a153909b7e24920d41f154a6c703cb70bcb48018c45fffef972b93a4f913853e5394b8634760ab51633f627' };
function galdino(db) {
  if (db.prepare("SELECT 1 FROM tenants WHERE slug='galdino'").get()) return;
  db.exec('BEGIN');
  try {
    const t = ins(db, 'tenants', { slug: 'galdino', name: 'Farmácia Galdino', status: 'ativo', settings: {
      subtitulo: 'Nosso compromisso é a sua saúde! · Caiçara/RN', sigla: 'FAG', cidade: 'Caiçara/RN', logo: '/img/galdino-logo.jpg',
      whatsapp: '5584998610037', enviarWhats: false, atendente: 'seg a sáb 7h–21h, dom 8h–12h',
      tema: { cor: '#B5202E', destaque: '#FFD54A', acento: '#FDE8EA', fonte: 'Archivo Black' },
      horario: { 0: [8, 12], 1: [7, 21], 2: [7, 21], 3: [7, 21], 4: [7, 21], 5: [7, 21], 6: [7, 21] },
      bairros: [['Centro', 3], ['Bairros próximos', 5], ['Zona rural', 10]],
      retirada: true, minimo: 0, pagamentos: ['Pix na entrega', 'Cartão (maquininha)', 'Dinheiro'],
      promoTemas: ['Domingo de plantão', 'Segunda da saúde', 'Terça da beleza', 'Quarta do bebê', 'Quinta natural', 'Sexta perfumada', 'Sábado de cuidados'],
      curtidas: { meta: 3, desconto: 5, campeao: 10 }, robo: { nome: 'Felix', ativo: true }
    } });
    const C = {}; [['dor', 'Dor e febre', 'pill'], ['gripe', 'Gripe e garganta', 'pill'], ['estomago', 'Estômago', 'pill'], ['naturais', 'Naturais e suplementos', 'jar'],
      ['perfumes', 'Perfumes árabes', 'bottle'], ['higiene', 'Higiene', 'drop'], ['beleza', 'Beleza e dermo', 'sun'], ['bebe', 'Mamãe e bebê', 'baby'], ['socorro', 'Primeiros socorros', 'bandage']]
      .forEach(([k, n, i], s) => C[k] = ins(db, 'categories', { tenant_id: t, name: n, icon: i, sort: s }));
    const o = (nome, ...itens) => [{ nome, itens: itens.map(x => [x, 0]) }];
    const BULA = ' Leia a bula. Se persistirem os sintomas, procure um médico.';
    const P = {}; let s = 0;
    const add = (k, cat, name, price, img, descr, x = {}) => P[k] = ins(db, 'products', { tenant_id: t, category_id: C[cat], name, price, img: '/img/' + img, icon: 'pill', descr, sort: s++, tag: x.tag || '', bulk_qty: x.at ? x.at[0] : null, bulk_price: x.at ? x.at[1] : null, options: x.opts || [], promo_price: x.promo ? x.promo[0] : null, promo_days: x.promo ? x.promo[1] : [], keywords: x.kw || '' });
    add('dorflex', 'dor', 'Dorflex 36 comprimidos', 26.99, 'gal-1.jpg', 'Analgésico e relaxante muscular.' + BULA, { tag: 'Mais vendido', promo: [23.99, [1]], kw: 'dor dor de cabeca relaxante muscular' });
    add('dipirona', 'dor', 'Dipirona 500 mg 10 comprimidos', 5.99, 'gal-2.png', 'Genérico. Para dor e febre.' + BULA, { at: [3, 4.99], kw: 'febre dor generico' });
    add('neosaldina', 'dor', 'Neosaldina 20 drágeas', 24.99, 'gal-3.jpg', 'Para dor de cabeça.' + BULA, { kw: 'dor de cabeca enxaqueca' });
    add('benegrip', 'gripe', 'Benegrip 6 comprimidos', 9.99, 'gal-4.jpg', 'Alivia os sintomas da gripe.' + BULA, { promo: [8.49, [1]], kw: 'gripe resfriado' });
    add('strepsils', 'gripe', 'Strepsils mel e limão 8 pastilhas', 16.99, 'gal-5.jpg', 'Para dor de garganta.' + BULA, { kw: 'garganta pastilha' });
    add('buscopan', 'estomago', 'Buscopan Composto 20 comprimidos', 29.99, 'gal-6.jpg', 'Para cólicas e dor abdominal.' + BULA, { kw: 'colica barriga' });
    add('eno', 'estomago', 'Sal de fruta Eno 100 g', 22.99, 'gal-7.jpg', 'Para azia e má digestão.' + BULA, { kw: 'azia ma digestao' });
    add('engov', 'estomago', 'Engov 12 comprimidos', 17.99, 'gal-8.jpg', 'Para o dia seguinte da festa.' + BULA, { promo: [14.99, [5, 6]], kw: 'ressaca' });
    add('lavitan', 'naturais', 'Lavitan A-Z 60 comprimidos', 39.99, 'gal-9.jpg', 'Polivitamínico para o dia a dia.', { tag: 'Mais vendido', kw: 'vitamina' });
    add('vitc', 'naturais', 'Vitamina C 1 g efervescente 10 un', 14.99, 'gal-10.jpg', 'Reforço para a imunidade.', { at: [3, 12.99], kw: 'vitamina c imunidade' });
    add('propolis', 'naturais', 'Extrato de própolis vermelho 20 ml', 39.9, 'gal-28.png', 'Produto natural, em gotas.', { promo: [34.9, [4]], kw: 'propolis natural garganta' });
    add('colageno', 'naturais', 'Colágeno Verisol 30 sachês', 89.9, 'gal-29.jpg', 'Para pele, unhas e cabelo.', { promo: [79.9, [2]], kw: 'colageno pele' });
    add('creatina', 'naturais', 'Creatina 300 g', 99.9, 'gal-30.png', 'Creatina pura para treino.', { tag: 'Chegou', kw: 'academia treino' });
    add('omega', 'naturais', 'Ômega 3 60 cápsulas', 49.9, 'gal-31.jpg', 'Para o coração e a memória.', { kw: 'omega 3 oleo de peixe' });
    add('melatonina', 'naturais', 'Melatonina em gotas 30 ml', 39.9, 'gal-32.png', 'Ajuda a regular o sono.', { kw: 'sono dormir' });
    add('khamrah', 'perfumes', 'Lattafa Khamrah 100 ml', 299.9, 'gal-24.jpg', 'Perfume árabe unissex, doce e marcante.', { tag: 'Destaque', promo: [279.9, [5]], kw: 'perfume arabe lattafa' });
    add('haya', 'perfumes', 'Lattafa Haya 100 ml', 249.9, 'gal-25.jpg', 'Perfume árabe feminino, floral e frutado.', { promo: [229.9, [5]], kw: 'perfume arabe feminino' });
    add('desertrose', 'perfumes', 'Afnan Souvenir Desert Rose 100 ml', 279.9, 'gal-26.jpg', 'Perfume árabe feminino, rosa e baunilha.', { kw: 'perfume arabe feminino' });
    add('alwesal', 'perfumes', 'Al Wataniah Attar Al Wesal 100 ml', 199.9, 'gal-27.jpg', 'Perfume árabe masculino, amadeirado.', { kw: 'perfume arabe masculino' });
    add('colgate', 'higiene', 'Creme dental Colgate Total 12 90 g', 13.99, 'gal-11.jpg', 'Proteção completa para a boca.', { at: [3, 11.99], kw: 'pasta de dente' });
    add('dove', 'higiene', 'Sabonete Dove 135 g', 5.99, 'gal-12.jpg', 'Hidratação na hora do banho.', { at: [6, 4.99] });
    add('rexona', 'higiene', 'Desodorante Rexona aerosol 150 ml', 17.99, 'gal-13.jpg', 'Proteção por 72 horas.', { promo: [14.99, [6]], kw: 'desodorante' });
    add('elseve', 'higiene', 'Shampoo Elseve Óleo Extraordinário 400 ml', 32.99, 'gal-14.jpg', 'Nutrição para cabelos secos.', { kw: 'shampoo cabelo' });
    add('sunfresh', 'beleza', 'Protetor solar Neutrogena Sun Fresh 200 ml', 69.99, 'gal-15.jpg', 'Toque seco, não deixa a pele oleosa.', { opts: o('FPS', '30', '50', '70'), promo: [59.99, [2, 6]], kw: 'protetor solar praia' });
    add('nivea', 'beleza', 'Loção Nivea Milk 400 ml', 29.99, 'gal-16.jpg', 'Para pele seca a extrasseca.', { kw: 'hidratante' });
    add('cetaphil', 'beleza', 'Creme hidratante Cetaphil 250 g', 79.99, 'gal-17.png', 'Para pele sensível.', { kw: 'hidratante pele sensivel' });
    add('off', 'beleza', 'Repelente OFF! Family 165 ml', 24.99, 'gal-18.jpg', 'Protege contra mosquitos.', { kw: 'repelente dengue mosquito' });
    add('pampers', 'bebe', 'Fralda Pampers Confort Sec 92 un', 129.99, 'gal-19.jpg', 'Até 12 horas sequinho.', { opts: o('Tamanho', 'M', 'G', 'XG', 'XXG'), tag: 'Mais vendido', promo: [114.99, [3]], kw: 'fralda bebe' });
    add('bepantol', 'bebe', 'Bepantol Baby 60 g', 39.99, 'gal-20.jpg', 'Previne assaduras.', { promo: [34.99, [3]], kw: 'assadura bebe pomada' });
    add('colonia', 'bebe', 'Colônia Huggies Extra Suave 100 ml', 29.99, 'gal-21.jpg', 'Hipoalergênica, para bebês.', { kw: 'colonia bebe' });
    add('bandaid', 'socorro', 'Curativo Band-Aid transparente 40 un', 14.99, 'gal-22.jpg', 'Para pequenos cortes.', { kw: 'curativo' });
    add('termometro', 'socorro', 'Termômetro infravermelho G-Tech', 149.9, 'gal-23.jpg', 'Mede a febre sem encostar.', { kw: 'febre termometro' });

    const st = (name, cover, slides, sort) => ins(db, 'stories', { tenant_id: t, name, cover, slides, sort });
    st('Receita', 'icon:cross', [{ icon: 'cross', t: 'Tem receita?', p: 'Mande a foto da receita no WhatsApp\nque a gente separa pra você.' }, { icon: 'pill', t: 'Remédio de uso contínuo', p: 'A gente avisa quando estiver\nperto de acabar.' }], 1);
    st('Perfumes', '/img/gal-24.jpg', [{ img: '/img/gal-24.jpg', t: 'Perfumes árabes', p: 'Os queridinhos do momento,\ncom envio para todo o Brasil.' }, { img: '/img/gal-24.jpg', t: 'Lattafa Khamrah', p: 'Doce e marcante.', prod: P.khamrah }, { img: '/img/gal-25.jpg', t: 'Lattafa Haya', p: 'Floral e frutado.', prod: P.haya }], 2);
    st('Naturais', '/img/gal-28.png', [{ img: '/img/gal-28.png', t: 'Produtos naturais', p: 'Própolis, colágeno, ômega 3\ne muito mais.' }, { img: '/img/gal-29.jpg', t: 'Colágeno Verisol', p: 'Pele, unhas e cabelo.', prod: P.colageno }, { img: '/img/gal-30.png', t: 'Creatina', p: 'Chegou!', prod: P.creatina }], 3);
    st('Bebê', '/img/gal-19.jpg', [{ img: '/img/gal-19.jpg', t: 'Quarta do bebê', p: 'Fralda e cuidados com preço especial.' }, { img: '/img/gal-19.jpg', t: 'Pampers Confort Sec', p: 'Do M ao XXG.', prod: P.pampers }], 4);
    st('Curta e ganhe', 'icon:heart', [{ icon: 'heart', t: 'Curta e ganhe 5%', p: 'Curta 3 produtos que você gosta\ne ganhe 5% no pedido.' }, { icon: 'heart', t: 'Campeão da semana', p: 'O produto mais curtido até domingo\nfica 10% mais barato na semana seguinte.' }], 5);
    const po = (prod, caption, overlay, h) => ins(db, 'posts', { tenant_id: t, img: '', product_id: P[prod], caption, overlay, created_at: ago(h) });
    po('khamrah', 'Lattafa Khamrah chegou! Perfume árabe doce e marcante. Enviamos para todo o Brasil.', 'Chegou', 2);
    po('sunfresh', 'Sol forte em Caiçara? Neutrogena Sun Fresh com toque seco, FPS 30, 50 ou 70.', 'Promo', 5);
    po('pampers', 'Quarta do bebê: Pampers Confort Sec com preço especial.', '', 9);
    po('colageno', 'Colágeno Verisol para pele, unhas e cabelo.', '', 20);
    po('dorflex', 'Dorflex 36 comprimidos, o mais pedido da casa.', 'Mais vendido', 30);
    po('propolis', 'Própolis vermelho em gotas, natural para a garganta.', '', 44);

    if (!db.prepare('SELECT 1 FROM users WHERE email=?').get(GALDINO_LOGIN.email)) db.prepare("INSERT INTO users(email,name,pass_hash,role,tenant_id) VALUES(?,?,?,'cliente',?)").run(GALDINO_LOGIN.email, 'Farmácia Galdino (demonstração)', GALDINO_LOGIN.hash, t);
    db.exec('COMMIT'); console.log('Cardápio da Farmácia Galdino criado: /galdino');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/* Catálogo real da Farmácia Galdino: produtos e preços enviados pela dona (Maxsonay)
   em 20/11/2026. Fotos de lojas e das marcas, em boa qualidade. Roda uma vez:
   esconde os produtos de demonstração (não apaga) e cria os reais. */
function galdinoReal(db) {
  const t = db.prepare("SELECT * FROM tenants WHERE slug='galdino'").get(); if (!t) return;
  const s = JSON.parse(t.settings || '{}'); if (s.catalogoReal) return;
  db.exec('BEGIN');
  try {
    const cat = n => (db.prepare('SELECT id FROM categories WHERE tenant_id=? AND name=?').get(t.id, n) || {}).id
      || ins(db, 'categories', { tenant_id: t.id, name: n, icon: 'pill', sort: 20 });
    const C = { dor: cat('Dor e febre'), gripe: cat('Gripe e garganta'), sup: cat('Naturais e suplementos'), hig: cat('Higiene'), dermo: cat('Beleza e dermo'), bebe: cat('Mamãe e bebê') };
    db.prepare("UPDATE categories SET name='Skincare e protetor solar', icon='sun' WHERE id=?").run(C.dermo);
    db.prepare('UPDATE products SET active=0 WHERE tenant_id=?').run(t.id);
    db.prepare('UPDATE posts SET active=0 WHERE tenant_id=?').run(t.id);
    db.prepare("UPDATE stories SET active=0 WHERE tenant_id=? AND name NOT IN ('Receita','Curta e ganhe')").run(t.id);
    const o = (nome, ...itens) => [{ nome, itens: itens.map(x => [x, 0]) }];
    const BULA = ' Leia a bula. Se persistirem os sintomas, procure um médico.';
    const P = {}; let n = 0;
    const add = (k, c, name, price, img, descr, x = {}) => P[k] = ins(db, 'products', { tenant_id: t.id, category_id: C[c], name, price, img: '/img/' + img, icon: 'pill', descr, sort: n++, tag: x.tag || '', options: x.opts || [], keywords: x.kw || '' });
    // remédios
    add('dipgotas', 'dor', 'Dipirona gotas 500 mg/ml 20 ml (genérico)', 4.99, 'fag-9.jpg', 'Para dor e febre.' + BULA, { tag: 'Mais vendido', kw: 'dipirona febre dor gotas' });
    add('dip1g', 'dor', 'Dipirona 1 g 10 comprimidos (genérico)', 8.99, 'fag-10.jpg', 'Para dor e febre.' + BULA, { kw: 'dipirona febre dor' });
    add('dorflex', 'dor', 'Dorflex 10 comprimidos', 7.99, 'fag-11.png', 'Analgésico e relaxante muscular.' + BULA, { kw: 'dor relaxante muscular' });
    add('cimegripe', 'gripe', 'Cimegripe 20 cápsulas', 14.99, 'fag-32.jpg', 'Alivia os sintomas da gripe.' + BULA, { kw: 'gripe resfriado' });
    // skincare e protetor solar
    add('pdrn', 'dermo', 'Sérum Hidrabene PDRN 30 ml', 69.9, 'fag-1.jpg', 'Renovação e firmeza da pele.', { tag: 'Lançamento', kw: 'hidrabene serum skincare' });
    add('ghk', 'dermo', 'Sérum Hidrabene GHK-Cu peptídeo de cobre 30 ml', 69.9, 'fag-2.jpg', 'Firmeza e densidade da pele.', { tag: 'Lançamento', kw: 'hidrabene serum skincare' });
    add('retinal', 'dermo', 'Hidrabene Retinal Shot noturno 15 g', 79.9, 'fag-3.jpg', 'Retinal puro 0,05% para uso à noite.', { kw: 'hidrabene retinal skincare' });
    add('harmon', 'dermo', 'Hidrabene Harmonizador Facial V-Shape 40 g', 79.9, 'fag-4.jpg', 'Contorno do rosto mais definido.', { kw: 'hidrabene harmonizador' });
    add('gellimp', 'dermo', 'Gel de limpeza facial Hidrabene 300 g', 29.9, 'fag-5.png', 'Limpeza diária do rosto.', { opts: o('Tipo de pele', 'Mista e oleosa', 'Clareador', 'Sensível'), kw: 'hidrabene sabonete facial' });
    add('basestick', 'dermo', 'Base Stick Hidrabene com protetor solar', 79.9, 'fag-7.jpg', 'Base em bastão com proteção solar.', { kw: 'hidrabene base maquiagem' });
    add('luminous', 'dermo', 'Sérum Nivea Luminous 630 Skin Glow 30 ml', 65, 'fag-6.jpg', 'Pele iluminada e uniforme.', { kw: 'nivea serum manchas' });
    add('isdincov', 'dermo', 'Protetor ISDIN Coverage alta cobertura FPS 60', 99.9, 'fag-8.webp', 'Protetor facial com cor.', { kw: 'isdin protetor solar facial' });
    add('isdingel', 'dermo', 'Protetor ISDIN Gel Cream Wet Skin FPS 50 198 g', 96.9, 'fag-13.jpg', 'Pode passar com a pele molhada.', { kw: 'isdin protetor solar corpo praia' });
    add('oaz', 'dermo', 'Protetor solar OAZ FPS 70 200 ml', 59.9, 'fag-12.jpg', 'Protege e hidrata o corpo.', { kw: 'protetor solar praia' });
    add('xo', 'dermo', 'Repelente Xô Inseto loção 200 ml', 19.9, 'fag-14.jpg', 'Proteção contra mosquitos.', { kw: 'repelente dengue mosquito' });
    // suplementos
    add('omegafor', 'sup', 'Omegafor Plus Vitafor 120 cápsulas', 149.9, 'fag-24.jpg', 'Ômega 3 de alta concentração.', { kw: 'omega 3 vitafor' });
    add('coq10', 'sup', 'Coenzima Q10 Vitafor 60 cápsulas', 134.9, 'fag-25.jpg', 'Energia e antioxidante.', { kw: 'coq10 coenzima vitafor' });
    add('resvera', 'sup', 'Resveratrol Plus Vitafor 60 cápsulas', 125.9, 'fag-29.jpg', 'Antioxidante.', { kw: 'resveratrol vitafor' });
    add('creatina', 'sup', 'Creatina Creatine Vitafor', 79.9, 'fag-31.webp', 'Creatina 100% pura.', { kw: 'creatina academia treino' });
    add('meladuo', 'sup', 'Melatonin Duo Harmony Essential', 139.9, 'fag-26.jpg', 'Melatonina de dupla ação para o sono.', { kw: 'melatonina sono' });
    add('mela', 'sup', 'Melatonina Natus Prime 30 gomas', 49.9, 'fag-35.png', 'Gomas sabor morango para o sono.', { kw: 'melatonina sono goma' });
    add('lavnoite', 'sup', 'Lavitan Super Fórmula Noite em pó 300 g', 99.9, 'fag-30.jpg', 'Para uma noite de sono tranquila.', { kw: 'lavitan sono' });
    add('dux', 'sup', 'Multivitamínico Dux 90 cápsulas', 89.9, 'fag-27.jpg', 'Vitaminas e minerais do dia a dia.', { kw: 'multivitaminico vitamina' });
    add('supply', 'sup', 'The Supply WePink cabelos e unhas 30 cápsulas', 59.9, 'fag-28.jpg', 'Vitaminas para cabelo e unhas.', { kw: 'wepink cabelo unha' });
    add('linda', 'sup', 'Linda Caps Renova 60 cápsulas', 69.9, 'fag-34.png', 'Biotina e vitamina A para cabelo, pele e unhas.', { kw: 'cabelo unha pele biotina' });
    add('lavcu', 'sup', 'Lavitan Cabelos e Unhas 30 cápsulas', 19.9, 'fag-33.jpg', 'Vitaminas para cabelo e unhas.', { kw: 'lavitan cabelo unha' });
    // higiene
    add('doveaer', 'hig', 'Desodorante Dove Original aerosol 150 ml', 19.9, 'fag-39.jpg', 'Proteção por 48 horas.', { kw: 'desodorante dove' });
    add('dovestick', 'hig', 'Desodorante Dove Sérum Stick 45 g', 24.9, 'fag-40.jpg', 'Antitranspirante em bastão.', { kw: 'desodorante dove' });
    add('useorg', 'hig', 'Desodorante roll-on Use Orgânico 55 ml', 19.9, 'fag-15.jpg', 'Desodorante natural.', { opts: o('Fragrância', 'Lavanda e camomila', 'Lemongrass e sálvia'), kw: 'desodorante natural' });
    add('niveaoleo', 'hig', 'Sabonete líquido Nivea Óleo de Banho', 49.9, 'fag-36.jpg', 'Banho que hidrata a pele.', { kw: 'sabonete nivea' });
    add('nathy', 'hig', 'Sabonete líquido Nathy', 14.9, 'fag-23.jpg', 'Várias fragrâncias.', { kw: 'sabonete liquido' });
    add('dermafeme', 'hig', 'Sabonete íntimo Dermafeme Floral (2 frascos)', 19.9, 'fag-38.jpg', 'Leve mais por menos.', { kw: 'sabonete intimo' });
    add('esfol', 'hig', 'Esfoliante para os pés Labotrat', 29.9, 'fag-37.jpg', 'Remove calosidades e deixa os pés macios.', { kw: 'esfoliante pes' });
    add('ricca', 'hig', 'Escova de cabelo Ricca', 14.9, 'fag-42.jpg', 'Desembaraça sem puxar.', { kw: 'escova cabelo' });
    // mamãe e bebê
    add('shampoojm', 'bebe', 'Shampoo bebê João e Maria glicerina 400 ml', 29.9, 'fag-16.png', 'Fórmula suave para o bebê.', { kw: 'shampoo bebe' });
    add('sabliqjm', 'bebe', 'Sabonete líquido bebê João e Maria 200 ml', 23.9, 'fag-17.png', 'Da cabeça aos pés.', { opts: o('Tipo', 'Glicerina', 'Cabeça aos pés'), kw: 'sabonete bebe' });
    add('sabbarjm', 'bebe', 'Sabonete em barra bebê João e Maria 75 g', 5.99, 'fag-18.webp', 'Suave para a pele do bebê.', { opts: o('Tipo', 'Glicerina', 'Karité'), kw: 'sabonete bebe' });
    add('lencojm', 'bebe', 'Lenço umedecido João e Maria', 12.9, 'fag-21.jpg', 'Limpeza na troca de fralda.', { kw: 'lenco umedecido bebe' });
    add('mamadeira', 'bebe', 'Mamadeira João e Maria 240 ml', 29.9, 'fag-41.jpg', 'Bico ortodôntico de silicone.', { kw: 'mamadeira bebe' });
    add('chupetajm', 'bebe', 'Chupeta João e Maria tamanho 2 (+6 meses)', 19.9, 'fag-19.jpg', 'Bico ortodôntico de silicone.', { kw: 'chupeta bebe' });
    add('mam', 'bebe', 'Chupeta MAM Supreme Night (2 unidades)', 79.9, 'fag-20.jpg', 'Brilha no escuro.', { kw: 'chupeta mam bebe' });
    add('nistatina', 'bebe', 'Nistatina + óxido de zinco pomada 60 g (genérico)', 14.9, 'fag-22.jpg', 'Prevenção e tratamento de assaduras.' + BULA, { kw: 'assadura pomada bebe' });

    const st = (name, cover, slides, sort) => ins(db, 'stories', { tenant_id: t.id, name, cover, slides, sort });
    st('Skincare', '/img/fag-1.jpg', [{ img: '/img/fag-1.jpg', t: 'Lançamentos Hidrabene', p: 'PDRN, GHK-Cu, Retinal e Harmonizador.' }, { img: '/img/fag-1.jpg', t: 'Sérum PDRN', p: 'Renovação e firmeza.', prod: P.pdrn }, { img: '/img/fag-3.jpg', t: 'Retinal Shot', p: 'Para usar à noite.', prod: P.retinal }], 2);
    st('Sol', '/img/fag-13.jpg', [{ img: '/img/fag-13.jpg', t: 'Proteção solar', p: 'ISDIN, OAZ e mais.' }, { img: '/img/fag-12.jpg', t: 'OAZ FPS 70', p: 'R$ 59,90.', prod: P.oaz }], 3);
    st('Suplementos', '/img/fag-24.jpg', [{ img: '/img/fag-24.jpg', t: 'Suplementos', p: 'Vitafor, Dux, Lavitan e mais.' }, { img: '/img/fag-26.jpg', t: 'Para dormir bem', p: 'Melatonina e Lavitan Noite.', prod: P.meladuo }], 4);
    st('Bebê', '/img/fag-16.png', [{ img: '/img/fag-16.png', t: 'Linha João e Maria', p: 'Shampoo, sabonete, lenço e mais.' }, { img: '/img/fag-20.jpg', t: 'Chupeta MAM', p: 'Brilha no escuro.', prod: P.mam }], 5);
    const po = (prod, caption, overlay, h) => ins(db, 'posts', { tenant_id: t.id, img: '', product_id: P[prod], caption, overlay, created_at: ago(h) });
    po('pdrn', 'Chegou a linha nova da Hidrabene: PDRN e GHK-Cu para a pele.', 'Lançamento', 2);
    po('isdingel', 'ISDIN Gel Cream Wet Skin: protetor que pode passar com a pele molhada.', '', 6);
    po('meladuo', 'Dificuldade para dormir? Temos melatonina e Lavitan Noite.', '', 12);
    po('shampoojm', 'Linha João e Maria para o banho do bebê.', '', 20);
    po('dipgotas', 'Dipirona gotas por R$ 4,99.', 'Preço baixo', 30);
    s.catalogoReal = true; db.prepare('UPDATE tenants SET settings=? WHERE id=?').run(JSON.stringify(s), t.id);
    db.exec('COMMIT'); console.log('Catálogo real da Galdino:', n, 'produtos');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/* Ofertas da Farmácia Galdino de 25 a 30/11/2026 (artes enviadas pela loja).
   Preço normal fica no produto; a promoção vale só nessas datas e depois some sozinha. */
function galdinoOfertasNov(db) {
  const t = db.prepare("SELECT * FROM tenants WHERE slug='galdino'").get(); if (!t) return;
  const s = JSON.parse(t.settings || '{}'); if (s.ofertasNov25) return;
  db.exec('BEGIN');
  try {
    const cat = (n, icon, sort) => (db.prepare('SELECT id FROM categories WHERE tenant_id=? AND name=?').get(t.id, n) || {}).id || ins(db, 'categories', { tenant_id: t.id, name: n, icon, sort });
    const perf = cat('Perfumaria', 'bottle', 3), sup = cat('Naturais e suplementos', 'jar', 4);
    const o = (nome, ...itens) => [{ nome, itens: itens.map(x => [x, 0]) }];
    const add = (c, name, price, promo, img, descr, x = {}) => ins(db, 'products', { tenant_id: t.id, category_id: c, name, price, promo_price: promo, promo_days: [], promo_de: '2026-11-24', promo_ate: '2026-11-30', img: '/img/' + img, icon: 'bottle', descr, sort: -1, tag: 'Oferta', options: x.opts || [], keywords: x.kw || '' });
    const a = add(perf, 'Body Splash WePink 200 ml', 60, 45, 'fag-43.jpg', 'Perfume leve e refrescante para o corpo.', { opts: o('Fragrância', 'Virginia Fonseca Golden', 'Obsessed Lovely', 'Cassera'), kw: 'body splash wepink perfume' });
    const b = add(perf, 'Perfume WePink (qualquer modelo)', 129.9, 89.9, 'fag-44.jpg', 'Qualquer perfume da WePink pelo mesmo preço. Confirme o modelo disponível no WhatsApp.', { opts: o('Modelo', 'Liberté Exclusif', 'Liberté Platiné', 'Virginia Fonseca Golden', 'Virginia Fonseca Bloom', 'Wonderful', '27', 'Outro (combinar no WhatsApp)'), kw: 'perfume wepink virginia' });
    const c = add(sup, 'Termo Plus Vitafor 30 sachês', 120, 59.9, 'fag-45.jpg', 'Sabor frutas vermelhas com gengibre e chá verde. Auxilia no metabolismo energético.', { kw: 'termo plus vitafor termogenico emagrecer' });
    ins(db, 'stories', { tenant_id: t.id, name: 'Ofertas', cover: '/img/fag-of1.jpg', sort: 0, slides: [
      { img: '/img/fag-of1.jpg', t: 'Body Splash WePink', p: 'De R$ 60 por R$ 45. Só até 30/11.', prod: a },
      { img: '/img/fag-of2.jpg', t: 'Perfumes WePink', p: 'Qualquer um por R$ 89,90. Só até 30/11.', prod: b },
      { img: '/img/fag-of3.jpg', t: 'Termo Plus Vitafor', p: 'De R$ 120 por R$ 59,90. Só até 30/11.', prod: c }] });
    const po = (prod, img, caption) => ins(db, 'posts', { tenant_id: t.id, img: '/img/' + img, product_id: prod, caption, overlay: '', created_at: new Date().toISOString() });
    po(c, 'fag-of3.jpg', 'Termo Plus Vitafor de R$ 120 por R$ 59,90. Oferta válida de 25 a 30/11.');
    po(b, 'fag-of2.jpg', 'Qualquer perfume da WePink por R$ 89,90 cada. De 25 a 30/11.');
    po(a, 'fag-of1.jpg', 'Body Splash WePink de R$ 60 por R$ 45. De 25 a 30/11.');
    s.ofertasNov25 = true; db.prepare('UPDATE tenants SET settings=? WHERE id=?').run(JSON.stringify(s), t.id);
    db.exec('COMMIT'); console.log('Ofertas de 25 a 30/11 da Galdino criadas');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/* a loja pediu para a oferta de 25 a 30/11 já valer a partir de 24/11 */
function ofertaHoje(db) {
  const t = db.prepare("SELECT id FROM tenants WHERE slug='galdino'").get(); if (!t) return;
  db.prepare("UPDATE products SET promo_de='2026-11-24' WHERE tenant_id=? AND promo_de='2026-11-25' AND promo_ate='2026-11-30'").run(t.id);
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
