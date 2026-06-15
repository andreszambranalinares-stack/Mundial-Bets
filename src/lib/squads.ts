// Plantillas (aproximadas, jugadores recientes) de las selecciones, para
// sugerir nombres al apostar mercados de jugador. No pretende ser oficial:
// son los internacionales más reconocibles de cada selección; si falta
// alguien, siempre se puede escribir el nombre a mano.
//
// La clave es el nombre ORIGINAL en inglés (igual que en la tabla de partidos).
// `playersForTeam` acepta también el nombre traducido al castellano.
import { teamName } from './teams'

const SQUADS: Record<string, string[]> = {
  // ---- Europa ----
  Spain: ['Unai Simón', 'Carvajal', 'Le Normand', 'Laporte', 'Cucurella', 'Rodri', 'Pedri', 'Gavi', 'Fabián Ruiz', 'Dani Olmo', 'Nico Williams', 'Lamine Yamal', 'Morata', 'Ferran Torres', 'Oyarzabal', 'Zubimendi', 'Merino', 'Grimaldo', 'Fermín López', 'Ayoze Pérez'],
  England: ['Pickford', 'Walker', 'Stones', 'Guéhi', 'Trippier', 'Rice', 'Bellingham', 'Foden', 'Saka', 'Kane', 'Palmer', 'Mainoo', 'Gordon', 'Watkins', 'Konsa', 'Shaw', 'Alexander-Arnold', 'Maddison', 'Toney', 'Eze'],
  France: ['Maignan', 'Koundé', 'Saliba', 'Upamecano', 'Theo Hernández', 'Tchouaméni', 'Camavinga', 'Griezmann', 'Dembélé', 'Mbappé', 'Thuram', 'Kolo Muani', 'Rabiot', 'Coman', 'Barcola', 'Zaïre-Emery', 'Konaté', 'Pavard', 'Fofana', 'Olise'],
  Germany: ['Neuer', 'Kimmich', 'Rüdiger', 'Tah', 'Raum', 'Andrich', 'Gündoğan', 'Wirtz', 'Musiala', 'Sané', 'Havertz', 'Füllkrug', 'Mittelstädt', 'Groß', 'Undav', 'Kleindienst', 'Schlotterbeck', 'Goretzka', 'Brandt', 'Ter Stegen'],
  Portugal: ['Diogo Costa', 'Cancelo', 'Rúben Dias', 'Pepe', 'Nuno Mendes', 'Bruno Fernandes', 'Vitinha', 'Bernardo Silva', 'João Félix', 'Rafael Leão', 'Cristiano Ronaldo', 'Gonçalo Ramos', 'Diogo Jota', 'Pedro Neto', 'Rúben Neves', 'João Palhinha', 'Dalot', 'António Silva', 'João Neves', 'Trincão'],
  Netherlands: ['Verbruggen', 'Dumfries', 'De Vrij', 'Van Dijk', 'Aké', 'Schouten', 'Reijnders', 'Gakpo', 'Xavi Simons', 'Depay', 'Malen', 'Weghorst', 'Frimpong', 'Veerman', 'Bergwijn', 'De Ligt', 'Koopmeiners', 'Brobbey', 'Geertruida', 'Maatsen'],
  Belgium: ['Casteels', 'Castagne', 'Faes', 'Theate', 'De Cuyper', 'Onana', 'Tielemans', 'De Bruyne', 'Doku', 'Lukaku', 'Trossard', 'Carrasco', 'Openda', 'Mangala', 'Vermeeren', 'Bakayoko', 'Lukebakio', 'Meunier', 'Vanaken', 'Saelemaekers'],
  Italy: ['Donnarumma', 'Di Lorenzo', 'Bastoni', 'Calafiori', 'Dimarco', 'Barella', 'Jorginho', 'Fagioli', 'Frattesi', 'Chiesa', 'Scamacca', 'Retegui', 'Raspadori', 'Pellegrini', 'Cambiaso', 'Tonali', 'Buongiorno', 'Zaccagni', 'El Shaarawy', 'Ricci'],
  Croatia: ['Livaković', 'Stanišić', 'Šutalo', 'Gvardiol', 'Sosa', 'Brozović', 'Modrić', 'Kovačić', 'Pašalić', 'Kramarić', 'Budimir', 'Perišić', 'Majer', 'Sučić', 'Baturina', 'Pongračić', 'Juranović', 'Ivanušec', 'Petković', 'Vlašić'],
  Switzerland: ['Sommer', 'Widmer', 'Schär', 'Akanji', 'Rodríguez', 'Freuler', 'Xhaka', 'Rieder', 'Aebischer', 'Ndoye', 'Embolo', 'Vargas', 'Shaqiri', 'Amdouni', 'Zakaria', 'Steffen', 'Elvedi', 'Sow', 'Okafor', 'Stergiou'],
  Denmark: ['Schmeichel', 'Andersen', 'Christensen', 'Vestergaard', 'Mæhle', 'Højbjerg', 'Eriksen', 'Hjulmand', 'Damsgaard', 'Højlund', 'Wind', 'Dolberg', 'Bah', 'Skov Olsen', 'Poulsen', 'Nørgaard', 'Kristensen', 'Lindstrøm', 'Bruun Larsen', 'Frese'],
  Poland: ['Szczęsny', 'Bereszyński', 'Kiwior', 'Bednarek', 'Cash', 'Zieliński', 'Szymański', 'Piotrowski', 'Zalewski', 'Lewandowski', 'Świderski', 'Buksa', 'Frankowski', 'Grosicki', 'Urbański', 'Skorupski', 'Slisz', 'Moder', 'Piątek', 'Kamiński'],
  Serbia: ['Rajković', 'Pavlović', 'Veljković', 'Milenković', 'Kostić', 'Gudelj', 'Lukić', 'Milinković-Savić', 'Tadić', 'Vlahović', 'Mitrović', 'Jović', 'Živković', 'Samardžić', 'Birmančević', 'Maksimović', 'Ilić', 'Radonjić', 'Mladenović', 'Nedeljković'],
  Austria: ['Pentz', 'Posch', 'Lienhart', 'Danso', 'Mwene', 'Seiwald', 'Laimer', 'Sabitzer', 'Baumgartner', 'Arnautović', 'Gregoritsch', 'Wimmer', 'Schmid', 'Grillitsch', 'Alaba', 'Prass', 'Wöber', 'Trauner', 'Schlager', 'Entrup'],
  Turkey: ['Günok', 'Çelik', 'Demiral', 'Akaydın', 'Kadıoğlu', 'Çalhanoğlu', 'Kökçü', 'Yıldız', 'Güler', 'Aktürkoğlu', 'Yılmaz', 'Kahveci', 'Ünder', 'Yazıcı', 'Akgün', 'Bardakcı', 'Ayhan', 'Müldür', 'Tosun', 'Kabak'],
  Ukraine: ['Lunin', 'Konoplya', 'Zabarnyi', 'Matviyenko', 'Mykolenko', 'Stepanenko', 'Sudakov', 'Mudryk', 'Tsygankov', 'Yarmolenko', 'Dovbyk', 'Yaremchuk', 'Zinchenko', 'Malinovskyi', 'Shaparenko', 'Brazhko', 'Tymchyk', 'Vanat', 'Trubin', 'Sydorchuk'],
  Wales: ['Ward', 'Roberts', 'Rodon', 'Mepham', 'Davies', 'Ampadu', 'Ramsey', 'James', 'Wilson', 'Moore', 'Johnson', 'N. Williams', 'Broadhead', 'Cabango', 'Thomas', 'Colwill', 'Morrell', 'Levitt', 'Harris', 'Brooks'],
  Scotland: ['Gunn', 'Hickey', 'Hendry', 'Tierney', 'Robertson', 'McGinn', 'McTominay', 'Gilmour', 'McGregor', 'Adams', 'Christie', 'Dykes', 'Shankland', 'Ferguson', 'McLean', 'Cooper', 'Ralston', 'Doak', 'Armstrong', 'McKenna'],
  Norway: ['Nyland', 'Ryerson', 'Ajer', 'Østigård', 'Bjørkan', 'Berge', 'Ødegaard', 'Berg', 'Aursnes', 'Haaland', 'Sørloth', 'Nusa', 'Bobb', 'Thorstvedt', 'Strand Larsen', 'Schjelderup', 'Vetlesen', 'Hauge', 'Elyounoussi', 'Meling'],
  Sweden: ['Olsen', 'Krafth', 'Lindelöf', 'Starfelt', 'Augustinsson', 'Olsson', 'Ekdal', 'Forsberg', 'Larsson', 'Isak', 'Gyökeres', 'Elanga', 'Kulusevski', 'Bernhardsson', 'Quaison', 'Claesson', 'Svanberg', 'Holm', 'Nanasi', 'Ayari'],

  // ---- Sudamérica ----
  Brazil: ['Alisson', 'Danilo', 'Marquinhos', 'Gabriel Magalhães', 'Wendell', 'Bruno Guimarães', 'Lucas Paquetá', 'Raphinha', 'Rodrygo', 'Vinícius Júnior', 'Endrick', 'Savinho', 'João Gomes', 'Militão', 'Bremer', 'Martinelli', 'Antony', 'Gabriel Jesus', 'Ederson', 'Andreas Pereira'],
  Argentina: ['Emiliano Martínez', 'Molina', 'Romero', 'Otamendi', 'Tagliafico', 'De Paul', 'Mac Allister', 'Enzo Fernández', 'Messi', 'Julián Álvarez', 'Di María', 'Lautaro Martínez', 'Paredes', 'Lo Celso', 'Nico González', 'Almada', 'Garnacho', 'Acuña', 'Montiel', 'Dybala'],
  Uruguay: ['Rochet', 'Nández', 'Giménez', 'Araújo', 'Olivera', 'Valverde', 'Ugarte', 'Bentancur', 'De Arrascaeta', 'Núñez', 'Pellistri', 'Maxi Araújo', 'Suárez', 'Viña', 'Vecino', 'Cáceres', 'Canobbio', 'Brian Rodríguez', 'De la Cruz', 'Cavani'],
  Colombia: ['Vargas', 'Muñoz', 'Dávinson Sánchez', 'Lucumí', 'Mojica', 'Lerma', 'Uribe', 'James Rodríguez', 'Arias', 'Luis Díaz', 'Jhon Córdoba', 'Borré', 'Cuadrado', 'Sinisterra', 'Yerry Mina', 'Quintero', 'Richard Ríos', 'Carrascal', 'Borja', 'Cuesta'],
  Ecuador: ['Galíndez', 'Preciado', 'Torres', 'Hincapié', 'Estupiñán', 'Caicedo', 'Franco', 'Sarmiento', 'Páez', 'Enner Valencia', 'Plata', 'Gonzalo Plata', 'Mena', 'Cifuentes', 'Pacho', 'Yeboah', 'Mercado', 'Vite', 'Reasco', 'Arroyo'],
  Peru: ['Gallese', 'Advíncula', 'Zambrano', 'Callens', 'Trauco', 'Tapia', 'Yotún', 'Cueva', 'Flores', 'Lapadula', 'Carrillo', 'Peña', 'Aquino', 'Grimaldo', 'López', 'Polo', 'Reyna', 'Valera', 'Castillo', 'Quispe'],
  Chile: ['Bravo', 'Isla', 'Maripán', 'Medel', 'Suazo', 'Pulgar', 'Aránguiz', 'Vidal', 'Alexis Sánchez', 'Brereton Díaz', 'Eduardo Vargas', 'Osorio', 'Echeverría', 'Núñez', 'Marcelino Núñez', 'Assadi', 'Bolados', 'Cortés', 'Loyola', 'Dávila'],
  Paraguay: ['Coronel', 'Espínola', 'Gustavo Gómez', 'Alderete', 'Balbuena', 'Cubas', 'Villasanti', 'Almirón', 'Enciso', 'Sanabria', 'Ávalos', 'Bareiro', 'Sosa', 'Gamarra', 'Campuzano', 'Rojas', 'Morel', 'Giménez', 'Ramírez', 'Caballero'],

  // ---- Concacaf ----
  'United States': ['Turner', 'Dest', 'Richards', 'Antonee Robinson', 'Scally', 'Tyler Adams', 'McKennie', 'Musah', 'Pulisic', 'Weah', 'Reyna', 'Balogun', 'Aaronson', 'Pepi', 'Ferreira', 'Sargent', 'Tillman', 'Vázquez', 'Morris', 'Luna'],
  Mexico: ['Ochoa', 'Sánchez', 'Montes', 'Vásquez', 'Gallardo', 'Edson Álvarez', 'Chávez', 'Pineda', 'Lozano', 'Raúl Jiménez', 'Antuna', 'Lainez', 'Alexis Vega', 'Santiago Giménez', 'Romo', 'Rodríguez', 'Huerta', 'Arteaga', 'Córdova', 'Gutiérrez'],
  Canada: ['Crépeau', 'Johnston', 'Vitória', 'Miller', 'Davies', 'Eustáquio', 'Koné', 'Buchanan', 'David', 'Larin', 'Hoilett', 'Laryea', 'Osorio', 'Cavallini', 'Millar', 'Bombito', 'Ahmed', 'Adekugbe', 'Shaffelburg', 'Ugbo'],
  'Costa Rica': ['Navas', 'Fuller', 'Calvo', 'Waston', 'Oviedo', 'Borges', 'Tejeda', 'Aguilera', 'Joel Campbell', 'Contreras', 'Venegas', 'Zamora', 'Bryan Ruiz', 'Bennette', 'Vargas', 'Galo', 'Martínez', 'Mora', 'Salas', 'Wilson'],
  Panama: ['Mosquera', 'Murillo', 'Escobar', 'Córdoba', 'Davis', 'Carrasquilla', 'Godoy', 'Bárcenas', 'Fajardo', 'Waterman', 'Tanner', 'Quintero', 'Rodríguez', 'Martínez', 'Gómez', 'Andrade', 'Welch', 'Blackman', 'King', 'Yanis'],
  Jamaica: ['Blake', 'Lowe', 'Pinnock', 'Bell', 'Latibeaudiere', 'Decordova-Reid', 'Leon Bailey', 'Antonio', 'Demarai Gray', 'Nicholson', 'Morrison', 'Palmer', 'Williams', 'Hayes', 'Russell', 'Anderson', 'Richards', 'Leigh', 'De Cordova-Reid', 'Burke'],

  // ---- África ----
  Morocco: ['Bounou', 'Hakimi', 'Saïss', 'Aguerd', 'Mazraoui', 'Amrabat', 'Ounahi', 'Amallah', 'Ziyech', 'En-Nesyri', 'Boufal', 'Ezzalzouli', 'Sabiri', 'Harit', 'Chaibi', 'Igamane', 'Banoun', 'Hakim Ziyech', 'Brahim Díaz', 'Bilal El Khannouss'],
  Senegal: ['Édouard Mendy', 'Sabaly', 'Koulibaly', 'Abdou Diallo', 'Jakobs', 'Idrissa Gueye', 'Pape Matar Sarr', 'Mané', 'Boulaye Dia', 'Nicolas Jackson', 'Iliman Ndiaye', 'Pape Sané', 'Diatta', 'Ciss', 'Habib Diarra', 'Niakhaté', 'Lamine Camara', 'Faye', 'Mendy', 'Sarr'],
  Ghana: ['Ati-Zigi', 'Lamptey', 'Djiku', 'Salisu', 'Mensah', 'Partey', 'Kudus', 'Abdul Samed', 'Sulemana', 'Iñaki Williams', 'Semenyo', 'André Ayew', 'Jordan Ayew', 'Bukari', 'Fatawu', 'Nuamah', 'Aidoo', 'Kyereh', 'Owusu', 'Schlupp'],
  Nigeria: ['Nwabali', 'Aina', 'Bassey', 'Ekong', 'Sanusi', 'Ndidi', 'Onyeka', 'Iwobi', 'Chukwueze', 'Osimhen', 'Lookman', 'Moffi', 'Simon', 'Aribo', 'Onuachu', 'Boniface', 'Awoniyi', 'Iheanacho', 'Dele-Bashiru', 'Onyedika'],
  Cameroon: ['Onana', 'Fai', 'Castelletto', 'Wooh', 'Tolo', 'Anguissa', 'Hongla', 'Bryan Mbeumo', 'Choupo-Moting', 'Aboubakar', 'Toko Ekambi', 'Magri', 'Njie', 'Ngamaleu', 'Kunde', 'Etta Eyong', 'Marou', 'Mbekeli', 'Olinga', 'Atangana'],
  'Ivory Coast': ['Yahia Fofana', 'Singo', 'Ndicka', 'Boly', 'Aurier', 'Kessié', 'Seri', 'Sangaré', 'Pépé', 'Haller', 'Krasso', 'Adingra', 'Diakité', 'Kossounou', 'Gradel', 'Seko Fofana', 'Bailly', 'Diomandé', 'Kouamé', 'Sangaré'],
  Egypt: ['El Shenawy', 'Hamdi', 'Hegazi', 'Abdelmonem', 'Hamdy', 'Elneny', 'Fathi', 'Trezeguet', 'Salah', 'Mohamed', 'Marmoush', 'Sobhi', 'Zizo', 'Magdy', 'Ashour', 'El Solia', 'Hamada', 'Said', 'Faraj', 'Kahraba'],
  Tunisia: ['Dahmen', 'Talbi', 'Bronn', 'Meriah', 'Abdi', 'Skhiri', 'Laidouni', 'Msakni', 'Sassi', 'Khazri', 'Jaziri', 'Ben Slimane', 'Maaloul', 'Drager', 'Ben Romdhane', 'Mejbri', 'Achouri', 'Sliti', 'Khalifa', 'Jebali'],
  Algeria: ["M'Bolhi", 'Mandi', 'Bensebaini', 'Tougai', 'Atal', 'Bennacer', 'Zerrouki', 'Mahrez', 'Belaïli', 'Bounedjah', 'Slimani', 'Amoura', 'Gouiri', 'Brahimi', 'Aouar', 'Chaibi', 'Bentaleb', 'Boudaoui', 'Touba', 'Guendouz'],
  'Cape Verde': ['Vozinha', 'Ponck', 'Diney', 'Roberto Lopes', 'Stopira', 'Kevin Pina', 'Laros Duarte', 'Jamiro Monteiro', 'Garry Rodrigues', 'Bebé', 'Ryan Mendes', 'Júlio Tavares', 'Willy Semedo', 'Kenny Rocha', 'Gilson Tavares', 'Yannick Semedo', 'Dailon Livramento', 'Bryan Teixeira', 'Patrick Andrade', 'Telmo'],
  'South Africa': ['Williams', 'Mudau', 'Mvala', 'Xulu', 'Modiba', 'Mokoena', 'Zwane', 'Mofokeng', 'Percy Tau', 'Foster', 'Adams', 'Maart', 'Sithole', 'Mbule', 'Kekana', 'Makgopa', 'Du Preez', 'Morena', 'Ngezana', 'Appollis'],

  // ---- Asia / Oceanía ----
  Japan: ['Suzuki', 'Sugawara', 'Itakura', 'Tomiyasu', 'Nakayama', 'Endo', 'Morita', 'Kubo', 'Mitoma', 'Kamada', 'Ueda', 'Doan', 'Minamino', 'Asano', 'Ito', 'Maeda', 'Tanaka', 'Furuhashi', 'Machida', 'Hatate'],
  'South Korea': ['Kim Seung-gyu', 'Kim Moon-hwan', 'Kim Min-jae', 'Kim Young-gwon', 'Kim Jin-su', 'Hwang In-beom', 'Lee Jae-sung', 'Son Heung-min', 'Lee Kang-in', 'Hwang Hee-chan', 'Cho Gue-sung', 'Oh Hyeon-gyu', 'Hong Hyun-seok', 'Seol Young-woo', 'Park Yong-woo', 'Bae Jun-ho', 'Lee Dong-gyeong', 'Cho Yu-min', 'Jung Woo-young', 'Um Ji-sung'],
  Australia: ['Ryan', 'Atkinson', 'Souttar', 'Rowles', 'Behich', 'Irvine', 'Mooy', 'McGree', 'Goodwin', 'Duke', 'Boyle', 'Leckie', 'Hrustic', 'Baccus', 'Metcalfe', 'Bos', 'Tilio', 'Borrello', 'Yengi', 'Velupillay'],
  Iran: ['Beiranvand', 'Moharrami', 'Hosseini', 'Pouraliganji', 'Mohammadi', 'Ezatolahi', 'Noorollahi', 'Jahanbakhsh', 'Azmoun', 'Taremi', 'Ansarifard', 'Gholizadeh', 'Ghoddos', 'Karimi', 'Torabi', 'Mohebi', 'Cheshmi', 'Hajsafi', 'Sayyadmanesh', 'Asadi'],
  'Saudi Arabia': ['Al-Owais', 'Al-Ghannam', 'Al-Bulayhi', 'Al-Amri', 'Al-Shahrani', 'Kanno', 'Al-Faraj', 'Al-Dawsari', 'Al-Malki', 'Al-Shehri', 'Al-Brikan', 'Al-Najei', 'Al-Buraikan', 'Otayf', 'Al-Hamdan', 'Al-Khaibari', 'Tambakti', 'Radif', 'Al-Sahafi', 'Al-Aboud'],
  Qatar: ['Barsham', 'Pedro Miguel', 'Khoukhi', 'Hassan', 'Homam Ahmed', 'Hatem', 'Madibo', 'Boudiaf', 'Akram Afif', 'Almoez Ali', 'Al-Haydos', 'Muntari', 'Ahmed Alaaeldin', 'Mohammed Waad', 'Tarek Salman', 'Yusuf Abdurisag', 'Ismail Mohamad', 'Khaled Muneer', 'Edmilson', 'Ró-Ró'],
}

// Índice por nombre traducido (castellano) -> mismos jugadores.
const bySpanish: Record<string, string[]> = {}
for (const [en, players] of Object.entries(SQUADS)) {
  bySpanish[teamName(en)] = players
}

// Lista de jugadores sugeridos para una selección (acepta nombre en inglés
// o ya traducido). Vacío si no se conoce esa selección.
export function playersForTeam(name: string): string[] {
  return SQUADS[name] ?? bySpanish[name] ?? []
}

// Jugadores de los dos equipos de un partido, sin duplicados y ordenados.
export function playersForMatch(home: string, away: string): string[] {
  return [...new Set([...playersForTeam(home), ...playersForTeam(away)])].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
}
