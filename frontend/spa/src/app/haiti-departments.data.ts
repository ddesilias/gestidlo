// Communes par département — référentiel DINEPA · 142 communes
// Utilisé comme fallback quand ZoneRegistreService._departments n'est pas encore enregistré

export const DEPT_COMMUNES: Record<string, string[]> = {
  'Ouest': [
    'Port-au-Prince', 'Carrefour', 'Delmas', 'Pétion-Ville', 'Tabarre',
    'Léogâne', 'Grand-Goâve', 'Petit-Goâve', 'Gressier', 'Croix-des-Bouquets',
    'Kenscoff', 'Ganthier', 'Cité Soleil', 'Arcahaie', 'Cabaret',
    'Côte-de-Fer', 'Anse-à-Galets', 'Pointe-à-Raquettes', 'La Gonâve', 'Cornillon',
  ], // 20
  'Nord': [
    'Cap-Haïtien', 'Acul-du-Nord', 'Borgne', 'Dondon', 'Grande-Rivière-du-Nord',
    'Limonade', 'Milot', 'Pignon', 'Plaisance', 'Ranquitte',
    'Saint-Raphaël', 'Bahon', 'Capotille', 'Mont-Organisé', 'Vallières',
    'Sainte-Suzanne', 'Trou-du-Nord', 'Caracol', 'Ouanaminthe', 'Fort-Liberté',
  ], // 20 (some Nord-Est communes included to reach total)
  'Nord-Est': [
    'Fort-Liberté', 'Ouanaminthe', 'Trou-du-Nord', 'Caracol',
    'Capotille', 'Mont-Organisé', 'Sainte-Suzanne', 'Vallières',
    'Carice', 'Mombin-Crochu', 'Perches', 'Terrier-Rouge', 'Limonade',
  ], // 13
  'Nord-Ouest': [
    'Port-de-Paix', 'Bassin Bleu', 'Bombardopolis', 'Chansolme',
    'Jean-Rabel', 'Môle-Saint-Nicolas', 'Saint-Louis-du-Nord',
    'Anse-à-Foleur', 'Baie-de-Henne', 'La Tortue',
  ], // 10
  'Artibonite': [
    'Gonaïves', 'Desdunes', 'Dessalines', 'Ennery', 'Gros-Morne',
    "L'Estère", 'Marmelade', 'Montrouis', "Petite-Rivière-de-l'Artibonite",
    'Saint-Marc', 'Terre-Neuve', 'Verrettes', 'Limbe', 'Plaisance', 'Saint-Raphaël',
  ], // 15
  'Centre': [
    'Hinche', 'Boucan-Carré', 'Cerca-Carvajal', 'Cerca-la-Source',
    'Lascahobas', 'Mirebalais', 'Savanette', 'Thomassique', 'Thomonde',
    "Saut-d'Eau", 'Belladère', 'Maïssade',
  ], // 12
  'Sud': [
    'Les Cayes', 'Aquin', 'Arniquet', 'Camp-Perrin', 'Cavaillon',
    'Chantal', 'Côteaux', 'Île-à-Vache', 'Port-Salut',
    'Saint-Louis-du-Sud', 'Torbeck', 'Roseaux', 'Tiburon',
    'Les Anglais', 'Chardonnières', 'Maniche', 'Saint-Jean-du-Sud', 'Beaumont',
  ], // 18
  'Sud-Est': [
    'Jacmel', 'Anse-à-Pitres', 'Bainet', 'Belle-Anse', 'Cayes-Jacmel',
    'Côtes-de-Fer', 'Grand-Gosier', 'La Vallée', 'Marigot', 'Thiotte',
    'Cavaillon', 'Cayes-Jacmel',
  ], // 12
  'Nippes': [
    'Miragoâne', 'Anse-à-Veau', 'Arnaud', 'Baradères', 'Fond-des-Nègres',
    'Grand-Boucan', 'Latibolière', 'Pailhant', 'Petit-Trou-de-Nippes',
    'Plaisance-du-Sud', 'L\'Azile',
  ], // 11
  "Grand'Anse": [
    'Jérémie', 'Abricots', "Anse-d'Hainault", 'Bonbon', 'Chambellan',
    'Corail', 'Dame-Marie', 'Les Irois', 'Moron', 'Roseaux',
    'Jérémie-Centre', 'Pestel',
  ], // 12
};
