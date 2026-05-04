// utils/cropNames.js — Traduction des noms de cultures (FR → AR / EN / TR)

const CROP_TRANSLATIONS = {
  // Agrumes
  Orange:      { ar: 'برتقال',      en: 'Orange',        tr: 'Portakal' },
  Citron:      { ar: 'ليمون',       en: 'Lemon',         tr: 'Limon' },
  Mandarine:   { ar: 'يوسفي',       en: 'Mandarin',      tr: 'Mandalina' },
  Pamplemousse:{ ar: 'بوملو',       en: 'Grapefruit',    tr: 'Greyfurt' },
  Bergamote:   { ar: 'برجموت',      en: 'Bergamot',      tr: 'Bergamot' },
  Citrus:      { ar: 'حمضيات',      en: 'Citrus',        tr: 'Narenciye' },

  // Fruits à pépins
  Pommier:     { ar: 'تفاح',        en: 'Apple',         tr: 'Elma' },
  Poirier:     { ar: 'كمثرى',       en: 'Pear',          tr: 'Armut' },
  Cognassier:  { ar: 'سفرجل',       en: 'Quince',        tr: 'Ayva' },

  // Fruits à noyau
  Abricotier:  { ar: 'مشمش',        en: 'Apricot',       tr: 'Kayısı' },
  Pêcher:      { ar: 'خوخ',         en: 'Peach',         tr: 'Şeftali' },
  Prunier:     { ar: 'برقوق',       en: 'Plum',          tr: 'Erik' },
  Cerisier:    { ar: 'كرز',         en: 'Cherry',        tr: 'Kiraz' },
  Nectarinier: { ar: 'نكتارين',     en: 'Nectarine',     tr: 'Nektarin' },

  // Fruits secs / oléagineux
  Amandier:    { ar: 'لوز',         en: 'Almond',        tr: 'Badem' },
  Olivier:     { ar: 'زيتون',       en: 'Olive',         tr: 'Zeytin' },
  Pistachier:  { ar: 'فستق',        en: 'Pistachio',     tr: 'Antep fıstığı' },
  Noyer:       { ar: 'جوز',         en: 'Walnut',        tr: 'Ceviz' },
  Noisettier:  { ar: 'بندق',        en: 'Hazelnut',      tr: 'Fındık' },

  // Fruits tropicaux
  Figuier:     { ar: 'تين',         en: 'Fig',           tr: 'İncir' },
  Grenadier:   { ar: 'رمان',        en: 'Pomegranate',   tr: 'Nar' },
  Vigne:       { ar: 'عنب',         en: 'Grapevine',     tr: 'Üzüm' },
  Dattier:     { ar: 'نخيل تمر',    en: 'Date Palm',     tr: 'Hurma' },
  Bananier:    { ar: 'موز',         en: 'Banana',        tr: 'Muz' },
  Fraisier:    { ar: 'فراولة',      en: 'Strawberry',    tr: 'Çilek' },

  // Légumes fruits
  Tomate:      { ar: 'طماطم',       en: 'Tomato',        tr: 'Domates' },
  Poivron:     { ar: 'فلفل',        en: 'Bell pepper',   tr: 'Biber' },
  Piment:      { ar: 'فلفل حار',    en: 'Chili',         tr: 'Acı biber' },
  Aubergine:   { ar: 'باذنجان',     en: 'Eggplant',      tr: 'Patlıcan' },
  Courgette:   { ar: 'كوسة',        en: 'Zucchini',      tr: 'Kabak' },
  Concombre:   { ar: 'خيار',        en: 'Cucumber',      tr: 'Salatalık' },
  Melon:       { ar: 'شمام',        en: 'Melon',         tr: 'Kavun' },
  Pastèque:    { ar: 'بطيخ',        en: 'Watermelon',    tr: 'Karpuz' },

  // Légumes feuilles / racines
  Laitue:      { ar: 'خس',          en: 'Lettuce',       tr: 'Marul' },
  Epinard:     { ar: 'سبانخ',       en: 'Spinach',       tr: 'Ispanak' },
  Carotte:     { ar: 'جزر',         en: 'Carrot',        tr: 'Havuç' },
  Betterave:   { ar: 'شمندر',       en: 'Beetroot',      tr: 'Pancar' },
  'Betterave sucrière': { ar: 'بنجر السكر', en: 'Sugar beet', tr: 'Şeker pancarı' },
  Radis:       { ar: 'فجل',         en: 'Radish',        tr: 'Turp' },
  Navet:       { ar: 'لفت',         en: 'Turnip',        tr: 'Şalgam' },
  Celeri:      { ar: 'كرفس',        en: 'Celery',        tr: 'Kereviz' },
  Artichaut:   { ar: 'خرشوف',       en: 'Artichoke',     tr: 'Enginar' },
  Fenouil:     { ar: 'شمار',        en: 'Fennel',        tr: 'Rezene' },
  Persil:      { ar: 'بقدونس',      en: 'Parsley',       tr: 'Maydanoz' },
  Coriandre:   { ar: 'كسبرة',       en: 'Coriander',     tr: 'Kişniş' },

  // Légumes bulbes
  Oignon:      { ar: 'بصل',         en: 'Onion',         tr: 'Soğan' },
  Ail:         { ar: 'ثوم',         en: 'Garlic',        tr: 'Sarımsak' },
  Poireau:     { ar: 'كراث',        en: 'Leek',          tr: 'Pırasa' },

  // Légumineuses
  Fève:        { ar: 'فول',         en: 'Broad bean',    tr: 'Bakla' },
  Haricot:     { ar: 'فاصولياء',    en: 'Bean',          tr: 'Fasulye' },
  'Pois chiche':{ ar: 'حمص',        en: 'Chickpea',      tr: 'Nohut' },
  Lentille:    { ar: 'عدس',         en: 'Lentil',        tr: 'Mercimek' },
  Pois:        { ar: 'بازلاء',      en: 'Pea',           tr: 'Bezelye' },

  // Céréales
  'Blé':       { ar: 'قمح',         en: 'Wheat',         tr: 'Buğday' },
  'Blé dur':   { ar: 'قمح صلب',     en: 'Durum wheat',   tr: 'Durum buğdayı' },
  Orge:        { ar: 'شعير',        en: 'Barley',        tr: 'Arpa' },
  Maïs:        { ar: 'ذرة',         en: 'Corn',          tr: 'Mısır' },
  Sorgho:      { ar: 'ذرة رفيعة',   en: 'Sorghum',       tr: 'Sorgum' },
  Tournesol:   { ar: 'عباد الشمس',  en: 'Sunflower',     tr: 'Ayçiçeği' },
  Luzerne:     { ar: 'برسيم حجازي', en: 'Alfalfa',       tr: 'Yonca' },

  // Tubercules
  'Pomme de terre': { ar: 'بطاطا',  en: 'Potato',        tr: 'Patates' },
  'Patate douce':   { ar: 'بطاطا حلوة', en: 'Sweet potato', tr: 'Tatlı patates' },
};

/**
 * Traduit un nom de culture.
 * Si la langue est 'fr' ou inconnue, retourne le nom original.
 * Si aucune traduction trouvée, retourne le nom original.
 *
 * @param {string} name - Nom de la culture (en français)
 * @param {string} lang - Code langue: 'fr' | 'ar' | 'en' | 'tr'
 * @returns {string}
 */
export function translateCropName(name, lang) {
  if (!name || !lang || lang === 'fr') return name;
  const key = Object.keys(CROP_TRANSLATIONS).find(
    k => k.toLowerCase() === name.trim().toLowerCase()
  );
  if (!key) return name;
  return CROP_TRANSLATIONS[key][lang] || name;
}
