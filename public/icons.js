/* Ícones de linha usados no cardápio e no painel (quando o produto ainda não tem foto) */
const ICONS={
  coconut:'<circle cx="24" cy="26" r="15"/><path d="M14 20c4-3 16-3 20 0"/><path d="M30 6l-4 14"/><circle cx="20" cy="27" r="1.2" fill="currentColor"/><circle cx="25" cy="31" r="1.2" fill="currentColor"/>',
  bottle:'<path d="M20 6h8v6l4 6v22a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V18l4-6z"/><path d="M16 24h16M16 34h16"/>',
  heart:'<path d="M24 40s-14-8.8-18-18a9.6 9.6 0 0 1 18-6 9.6 9.6 0 0 1 18 6c-4 9.2-18 18-18 18z"/>',
  cup:'<path d="M12 14h24l-3 26H15z"/><path d="M10 14h28M26 14l4-8"/>',
  plate:'<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="9"/>',
  pizza:'<path d="M24 42L8 12c10-5 22-5 32 0z"/><circle cx="21" cy="20" r="2"/><circle cx="28" cy="26" r="2"/><circle cx="23" cy="32" r="1.6"/>',
  burger:'<path d="M9 22c0-8 7-12 15-12s15 4 15 12z"/><path d="M8 27h32M10 32h28c0 4-3 6-6 6H16c-3 0-6-2-6-6z"/>',
  bag:'<path d="M10 16h28l-2 26H12z"/><path d="M18 16a6 6 0 0 1 12 0"/>',

  horse:'<path d="M14 42l2-11c-3-3-4-7-3-11l5-9 3 4 2-5 3 6c6 2 10 7 11 14l1 5c0 2-2 3-4 2l-5-3-4 3-1 5"/><circle cx="23" cy="17" r="1.2" fill="currentColor"/><path d="M27 13c-3 3-4 7-4 11"/>',
  dog:'<path d="M15 14c-4 0-7 6-6 12 1 3 4 2 5-1"/><path d="M33 14c4 0 7 6 6 12-1 3-4 2-5-1"/><path d="M14 22c0-6 4-10 10-10s10 4 10 10v7c0 6-4 10-10 10s-10-4-10-10z"/><path d="M21 31h6l-3 3z" fill="currentColor"/><circle cx="20" cy="24" r="1.3" fill="currentColor"/><circle cx="28" cy="24" r="1.3" fill="currentColor"/>',
  cat:'<path d="M12 10l5 9M36 10l-5 9"/><path d="M12 10v12c0 9 5 16 12 16s12-7 12-16V10l-6 6c-2-1-4-1-6-1s-4 0-6 1z"/><circle cx="19" cy="25" r="1.4" fill="currentColor"/><circle cx="29" cy="25" r="1.4" fill="currentColor"/><path d="M22 31h4l-2 2zM8 29l8 1M8 34l8-2M40 29l-8 1M40 34l-8-2"/>',
  corn:'<path d="M24 44V20"/><path d="M24 8c-4 3-5 8-5 12s2 8 5 8 5-4 5-8-1-9-5-12z"/><path d="M20 16h8M19 21h10M20 26h8"/><path d="M24 32c-5-1-9-5-10-10M24 32c5-1 9-5 10-10"/>',
  bird:'<path d="M14 30c0-8 5-14 12-14 3 0 5 1 6 3l5 1-4 3c1 6-3 13-10 14-5 1-9-2-9-7z"/><path d="M14 30l-6-4 2 8"/><circle cx="29" cy="20" r="1.3" fill="currentColor"/><path d="M20 38l-1 5M24 38v5"/><path d="M22 10c1-2 3-3 5-2"/>',
  sack:'<path d="M17 12h14l-2 5c5 3 8 10 8 16 0 6-5 9-13 9s-13-3-13-9c0-6 3-13 8-16z"/><path d="M17 12l2-5h10l2 5M19 17h10"/><path d="M18 30h12M20 34h8"/>',
  jar:'<rect x="14" y="16" width="20" height="26" rx="4"/><path d="M16 10h16v6H16z"/><path d="M14 24h20M14 34h20"/><path d="M22 29l2-3 2 3"/>',
  bone:'<path d="M16 32l16-16"/><path d="M13 29a4 4 0 1 0 6 6l-1-1M35 19a4 4 0 1 0-6-6l1 1M19 35a4 4 0 1 1-6-6l1 1M29 13a4 4 0 1 1 6 6l-1-1"/>',
  saddle:'<path d="M8 22c6 0 8-6 16-6s10 6 16 6c-1 7-7 10-16 10S9 29 8 22z"/><path d="M24 16v-4h4"/><path d="M20 32l-2 10M28 32l2 10M16 42h4M28 42h4"/>',
  bridle:'<circle cx="24" cy="22" r="12"/><path d="M12 22h24M24 10v24"/><path d="M24 34c0 4-2 8-8 9M24 34c0 4 2 8 8 9"/>',
  shoe:'<path d="M13 40V22a11 11 0 0 1 22 0v18h-7V22a4 4 0 0 0-8 0v18z"/><circle cx="16.5" cy="27" r="1" fill="currentColor"/><circle cx="31.5" cy="27" r="1" fill="currentColor"/><circle cx="16.5" cy="34" r="1" fill="currentColor"/><circle cx="31.5" cy="34" r="1" fill="currentColor"/>',
  brush:'<rect x="9" y="18" width="30" height="10" rx="4"/><path d="M12 28v8M16 28v9M20 28v8M24 28v9M28 28v8M32 28v9M36 28v8"/><path d="M15 18c0-4 4-7 9-7s9 3 9 7"/>',
  hat:'<path d="M5 30c4 4 11 6 19 6s15-2 19-6c-4 1-7 0-9-2H14c-2 2-5 3-9 2z"/><path d="M14 28c-1-6 0-14 4-16 2-1 4 1 6 1s4-2 6-1c4 2 5 10 4 16"/><path d="M15 24h18"/>',
  shirt:'<path d="M17 8l-9 6 4 8 4-2v20h16V20l4 2 4-8-9-6c-1 3-4 5-7 5s-6-2-7-5z"/><path d="M16 20h16M16 28h16M24 13v27"/>',
  boot:'<path d="M15 6h12v20l10 5c3 1 4 4 4 7v2H11l1-5c1-4 3-6 3-10z"/><path d="M11 40v3h30v-3M15 14h12"/>',
  belt:'<path d="M4 20h40v8H4z"/><rect x="18" y="16" width="12" height="16" rx="3"/><path d="M24 20v8"/>',
};
const ICON_NAMES={horse:"Cavalo",dog:"Cachorro",cat:"Gato",bird:"Ave",corn:"Grão",sack:"Saco",jar:"Pote",bone:"Osso",saddle:"Sela",bridle:"Rédea",shoe:"Ferradura",brush:"Escova",hat:"Chapéu",shirt:"Camisa",boot:"Bota",belt:"Cinto",coconut:"Coco",bottle:"Garrafa",heart:"Coração",cup:"Copo",plate:"Prato",pizza:"Pizza",burger:"Lanche",bag:"Sacola"};
function ico(n,cls){return '<svg class="'+(cls||"i")+'" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[n]||ICONS.bag)+"</svg>";}
