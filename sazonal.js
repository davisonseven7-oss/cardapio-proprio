/* Temas sazonais do cardápio. A loja escolhe no painel:
   ''     → design normal (cores da própria loja)
   'auto' → tema do momento (muda sozinho a cada mês)
   id     → um tema fixo da lista abaixo */
const SAZONAIS = [
  { id: 'verao', nome: 'Verão', mes: 1, titulo: 'Verão {marca}', frase: 'ofertas pra curtir o calor', cor: '#0077B6', destaque: '#FFD166', acento: '#90E0EF' },
  { id: 'carnaval', nome: 'Carnaval', mes: 2, titulo: 'Carnaval {marca}', frase: 'ofertas pra folia', cor: '#7B2CBF', destaque: '#FFBE0B', acento: '#FF006E' },
  { id: 'consumidor', nome: 'Semana do Consumidor', mes: 3, titulo: 'Semana do Consumidor {marca}', frase: 'descontos especiais', cor: '#1D4ED8', destaque: '#FACC15', acento: '#93C5FD' },
  { id: 'pascoa', nome: 'Páscoa', mes: 4, titulo: 'Páscoa {marca}', frase: 'ofertas para a família', cor: '#6B3E26', destaque: '#F9C74F', acento: '#F4A6C1' },
  { id: 'maes', nome: 'Dia das Mães', mes: 5, titulo: 'Mês das Mães {marca}', frase: 'presentes com carinho', cor: '#C2185B', destaque: '#F8BBD0', acento: '#FCE4EC' },
  { id: 'saojoao', nome: 'São João', mes: 6, titulo: 'Arraiá {marca}', frase: 'São João de ofertas', cor: '#C1440E', destaque: '#FFC300', acento: '#2D6A4F' },
  { id: 'ferias', nome: 'Férias', mes: 7, titulo: 'Férias {marca}', frase: 'ofertas da temporada', cor: '#0096C7', destaque: '#FFB703', acento: '#8ECAE6' },
  { id: 'pais', nome: 'Dia dos Pais', mes: 8, titulo: 'Mês dos Pais {marca}', frase: 'presentes para ele', cor: '#1D3557', destaque: '#E9C46A', acento: '#A8DADC' },
  { id: 'primavera', nome: 'Primavera', mes: 9, titulo: 'Primavera {marca}', frase: 'ofertas florescendo', cor: '#2D6A4F', destaque: '#F4A261', acento: '#B7E4C7' },
  { id: 'criancas', nome: 'Dia das Crianças', mes: 10, titulo: 'Mês das Crianças {marca}', frase: 'ofertas pra criançada', cor: '#3A86FF', destaque: '#FFBE0B', acento: '#FB5607' },
  { id: 'blackfriday', nome: 'Black Friday', mes: 11, titulo: 'BLACK {marca}', frase: 'as melhores ofertas do ano', cor: '#233ADD', destaque: '#FFD400', acento: '#FFD400', escuro: true },
  { id: 'natal', nome: 'Natal', mes: 12, titulo: 'Natal {marca}', frase: 'presentes com entrega', cor: '#B3122E', destaque: '#F2C14E', acento: '#1E7B4A' },
];

/* tema que vale agora para a escolha da loja (null = design normal) */
function sazonalAtivo(escolha, agora) {
  if (!escolha) return null;
  if (escolha === 'auto') return SAZONAIS.find(x => x.mes === agora.getUTCMonth() + 1) || null;
  return SAZONAIS.find(x => x.id === escolha) || null;
}
/* nome curto da loja que aparece no tema (ex.: FAG, Potengi) */
const GENERICAS = /^(farm[aá]cia|drogaria|ra[cç][oõ]es|loja|restaurante|lanchonete|pizzaria|padaria|mercado|supermercado|empório|emporio|casa|de|da|do|das|dos|e)$/i;
function marcaCurta(s, nome) {
  const m = String(s.sigla || '').trim(); if (m) return m.slice(0, 18);
  const w = String(nome || '').split(/\s+/).filter(x => x && !GENERICAS.test(x));
  return (w.length ? w.slice(0, 2).join(' ') : String(nome || '')).slice(0, 18);
}
const escolhaValida = v => v === 'auto' || SAZONAIS.some(x => x.id === v) ? v : '';

module.exports = { SAZONAIS, sazonalAtivo, escolhaValida, marcaCurta };
