// Traducción de nombres de selecciones (inglés de The Odds API -> castellano).
// Solo afecta a la presentación; en la base de datos se guarda el nombre original.
import type { Match } from './database.types'

const TEAMS: Record<string, string> = {
  // Europa
  Spain: 'España',
  England: 'Inglaterra',
  France: 'Francia',
  Germany: 'Alemania',
  Portugal: 'Portugal',
  Netherlands: 'Países Bajos',
  Belgium: 'Bélgica',
  Italy: 'Italia',
  Croatia: 'Croacia',
  Switzerland: 'Suiza',
  Denmark: 'Dinamarca',
  Sweden: 'Suecia',
  Norway: 'Noruega',
  Poland: 'Polonia',
  Serbia: 'Serbia',
  Austria: 'Austria',
  'Czech Republic': 'República Checa',
  Czechia: 'Chequia',
  Turkey: 'Turquía',
  Türkiye: 'Turquía',
  Ukraine: 'Ucrania',
  Wales: 'Gales',
  Scotland: 'Escocia',
  'Republic of Ireland': 'Irlanda',
  Ireland: 'Irlanda',
  'Northern Ireland': 'Irlanda del Norte',
  Greece: 'Grecia',
  Hungary: 'Hungría',
  Romania: 'Rumanía',
  Slovakia: 'Eslovaquia',
  Slovenia: 'Eslovenia',
  Russia: 'Rusia',
  Finland: 'Finlandia',
  Iceland: 'Islandia',
  Albania: 'Albania',
  'North Macedonia': 'Macedonia del Norte',
  Montenegro: 'Montenegro',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  Bulgaria: 'Bulgaria',
  Kosovo: 'Kosovo',
  Georgia: 'Georgia',
  Armenia: 'Armenia',
  Azerbaijan: 'Azerbaiyán',
  Belarus: 'Bielorrusia',
  Moldova: 'Moldavia',
  Latvia: 'Letonia',
  Lithuania: 'Lituania',
  Estonia: 'Estonia',
  Luxembourg: 'Luxemburgo',
  Cyprus: 'Chipre',
  Malta: 'Malta',
  'Faroe Islands': 'Islas Feroe',
  Gibraltar: 'Gibraltar',
  Andorra: 'Andorra',
  'San Marino': 'San Marino',
  Liechtenstein: 'Liechtenstein',

  // Sudamérica
  Brazil: 'Brasil',
  Argentina: 'Argentina',
  Uruguay: 'Uruguay',
  Colombia: 'Colombia',
  Ecuador: 'Ecuador',
  Peru: 'Perú',
  Chile: 'Chile',
  Paraguay: 'Paraguay',
  Venezuela: 'Venezuela',
  Bolivia: 'Bolivia',

  // Concacaf
  'United States': 'Estados Unidos',
  USA: 'Estados Unidos',
  Mexico: 'México',
  Canada: 'Canadá',
  'Costa Rica': 'Costa Rica',
  Panama: 'Panamá',
  Honduras: 'Honduras',
  Jamaica: 'Jamaica',
  'El Salvador': 'El Salvador',
  Guatemala: 'Guatemala',
  'Trinidad and Tobago': 'Trinidad y Tobago',
  Nicaragua: 'Nicaragua',
  Cuba: 'Cuba',
  'Dominican Republic': 'República Dominicana',
  Curaçao: 'Curazao',
  Haiti: 'Haití',
  Suriname: 'Surinam',
  Guyana: 'Guyana',
  Belize: 'Belice',

  // África
  Morocco: 'Marruecos',
  Senegal: 'Senegal',
  Ghana: 'Ghana',
  Nigeria: 'Nigeria',
  Cameroon: 'Camerún',
  'Ivory Coast': 'Costa de Marfil',
  "Côte d'Ivoire": 'Costa de Marfil',
  Egypt: 'Egipto',
  Tunisia: 'Túnez',
  Algeria: 'Argelia',
  'South Africa': 'Sudáfrica',
  Mali: 'Malí',
  'Burkina Faso': 'Burkina Faso',
  'DR Congo': 'RD Congo',
  'Congo DR': 'RD Congo',
  'Cape Verde': 'Cabo Verde',
  Angola: 'Angola',
  Zambia: 'Zambia',
  Kenya: 'Kenia',
  Gabon: 'Gabón',
  Guinea: 'Guinea',
  Benin: 'Benín',
  Madagascar: 'Madagascar',
  Mauritania: 'Mauritania',
  Namibia: 'Namibia',
  'Equatorial Guinea': 'Guinea Ecuatorial',
  Mozambique: 'Mozambique',
  Tanzania: 'Tanzania',
  Uganda: 'Uganda',

  // Asia / Oceanía
  Japan: 'Japón',
  'South Korea': 'Corea del Sur',
  'Korea Republic': 'Corea del Sur',
  'North Korea': 'Corea del Norte',
  'Korea DPR': 'Corea del Norte',
  Australia: 'Australia',
  Iran: 'Irán',
  'IR Iran': 'Irán',
  'Saudi Arabia': 'Arabia Saudí',
  Qatar: 'Catar',
  Uzbekistan: 'Uzbekistán',
  Jordan: 'Jordania',
  Iraq: 'Irak',
  'United Arab Emirates': 'Emiratos Árabes Unidos',
  UAE: 'Emiratos Árabes Unidos',
  China: 'China',
  'China PR': 'China',
  Indonesia: 'Indonesia',
  Thailand: 'Tailandia',
  Vietnam: 'Vietnam',
  India: 'India',
  Bahrain: 'Baréin',
  Oman: 'Omán',
  Kuwait: 'Kuwait',
  Lebanon: 'Líbano',
  Syria: 'Siria',
  Palestine: 'Palestina',
  Malaysia: 'Malasia',
  Philippines: 'Filipinas',
  Singapore: 'Singapur',
  Myanmar: 'Birmania',
  Tajikistan: 'Tayikistán',
  Turkmenistan: 'Turkmenistán',
  Kyrgyzstan: 'Kirguistán',
  'Hong Kong': 'Hong Kong',
  'New Zealand': 'Nueva Zelanda',
  Israel: 'Israel',
}

export function teamName(en: string): string {
  return TEAMS[en] ?? en
}

// ---------------------------------------------------------------------------
// Banderas. Código ISO 3166-1 alfa-2 por nombre original (inglés de la API).
// Se convierte a emoji de bandera (indicadores regionales). Inglaterra, Gales
// y Escocia usan la secuencia especial de subdivisión.
// ---------------------------------------------------------------------------
const CODES: Record<string, string> = {
  // Europa
  Spain: 'es', France: 'fr', Germany: 'de', Portugal: 'pt', Netherlands: 'nl',
  Belgium: 'be', Italy: 'it', Croatia: 'hr', Switzerland: 'ch', Denmark: 'dk',
  Sweden: 'se', Norway: 'no', Poland: 'pl', Serbia: 'rs', Austria: 'at',
  'Czech Republic': 'cz', Czechia: 'cz', Turkey: 'tr', Türkiye: 'tr', Ukraine: 'ua',
  'Republic of Ireland': 'ie', Ireland: 'ie', 'Northern Ireland': 'gb', Greece: 'gr',
  Hungary: 'hu', Romania: 'ro', Slovakia: 'sk', Slovenia: 'si', Russia: 'ru',
  Finland: 'fi', Iceland: 'is', Albania: 'al', 'North Macedonia': 'mk', Montenegro: 'me',
  'Bosnia and Herzegovina': 'ba', Bulgaria: 'bg', Kosovo: 'xk', Georgia: 'ge',
  Armenia: 'am', Azerbaijan: 'az', Belarus: 'by', Moldova: 'md', Latvia: 'lv',
  Lithuania: 'lt', Estonia: 'ee', Luxembourg: 'lu', Cyprus: 'cy', Malta: 'mt',
  'Faroe Islands': 'fo', Gibraltar: 'gi', Andorra: 'ad', 'San Marino': 'sm',
  Liechtenstein: 'li',

  // Sudamérica
  Brazil: 'br', Argentina: 'ar', Uruguay: 'uy', Colombia: 'co', Ecuador: 'ec',
  Peru: 'pe', Chile: 'cl', Paraguay: 'py', Venezuela: 've', Bolivia: 'bo',

  // Concacaf
  'United States': 'us', USA: 'us', Mexico: 'mx', Canada: 'ca', 'Costa Rica': 'cr',
  Panama: 'pa', Honduras: 'hn', Jamaica: 'jm', 'El Salvador': 'sv', Guatemala: 'gt',
  'Trinidad and Tobago': 'tt', Nicaragua: 'ni', Cuba: 'cu', 'Dominican Republic': 'do',
  Curaçao: 'cw', Haiti: 'ht', Suriname: 'sr', Guyana: 'gy', Belize: 'bz',

  // África
  Morocco: 'ma', Senegal: 'sn', Ghana: 'gh', Nigeria: 'ng', Cameroon: 'cm',
  'Ivory Coast': 'ci', "Côte d'Ivoire": 'ci', Egypt: 'eg', Tunisia: 'tn', Algeria: 'dz',
  'South Africa': 'za', Mali: 'ml', 'Burkina Faso': 'bf', 'DR Congo': 'cd', 'Congo DR': 'cd',
  'Cape Verde': 'cv', Angola: 'ao', Zambia: 'zm', Kenya: 'ke', Gabon: 'ga', Guinea: 'gn',
  Benin: 'bj', Madagascar: 'mg', Mauritania: 'mr', Namibia: 'na', 'Equatorial Guinea': 'gq',
  Mozambique: 'mz', Tanzania: 'tz', Uganda: 'ug',

  // Asia / Oceanía
  Japan: 'jp', 'South Korea': 'kr', 'Korea Republic': 'kr', 'North Korea': 'kp',
  'Korea DPR': 'kp', Australia: 'au', Iran: 'ir', 'IR Iran': 'ir', 'Saudi Arabia': 'sa',
  Qatar: 'qa', Uzbekistan: 'uz', Jordan: 'jo', Iraq: 'iq', 'United Arab Emirates': 'ae',
  UAE: 'ae', China: 'cn', 'China PR': 'cn', Indonesia: 'id', Thailand: 'th', Vietnam: 'vn',
  India: 'in', Bahrain: 'bh', Oman: 'om', Kuwait: 'kw', Lebanon: 'lb', Syria: 'sy',
  Palestine: 'ps', Malaysia: 'my', Philippines: 'ph', Singapore: 'sg', Myanmar: 'mm',
  Tajikistan: 'tj', Turkmenistan: 'tm', Kyrgyzstan: 'kg', 'Hong Kong': 'hk',
  'New Zealand': 'nz', Israel: 'il',
}

// Banderas de subdivisión (sin código alfa-2; emoji de etiqueta especial).
const SUBFLAGS: Record<string, string> = {
  England: '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  Scotland: '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  Wales: '🏴\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}',
}

function iso2ToEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

// Bandera indexada por nombre original (inglés) y por nombre traducido,
// para poder buscarla aunque el partido ya esté localizado.
const FLAGS: Record<string, string> = {}
for (const [en, code] of Object.entries(CODES)) {
  const flag = iso2ToEmoji(code)
  FLAGS[en] = flag
  if (TEAMS[en]) FLAGS[TEAMS[en]] = flag
}
for (const [en, flag] of Object.entries(SUBFLAGS)) {
  FLAGS[en] = flag
  if (TEAMS[en]) FLAGS[TEAMS[en]] = flag
}

// Devuelve el emoji de bandera de una selección (acepta el nombre en inglés
// o ya traducido). Cadena vacía si no se conoce.
export function teamFlag(name: string): string {
  return FLAGS[name] ?? ''
}

// "🇪🇸 España" (o solo el nombre si no hay bandera conocida).
export function withFlag(name: string): string {
  const f = teamFlag(name)
  return f ? `${f} ${name}` : name
}

// Devuelve una copia del partido con los nombres de equipo en castellano.
export function localizeMatch(m: Match): Match {
  return { ...m, home_team: teamName(m.home_team), away_team: teamName(m.away_team) }
}
