// ⚠️ LEGACY — dataset patrimonial riche (rivières/lacs/aquifères/zones humides réelles d'Haïti).
// Anciennement servi par un ResourcesStore non câblé (code mort). Parqué ici lors de
// l'unification du module Ressources : la source de vérité active est désormais
// ResourcesStore (NatResource) dans resources.store.ts, alimenté par NAT_DATA.
// Conservé pour pouvoir replier ces entrées dans le modèle actif plus tard.
// Non importé par l'application — aucune suppression de données.

export type ResourceType       = 'river' | 'spring' | 'lake' | 'wetland' | 'aquifer' | 'watershed';
export type VerificationStatus = 'imported' | 'pending' | 'verified' | 'corrected' | 'rejected' | 'archived';
export type Availability       = 'high' | 'medium' | 'low' | 'unknown';

export interface NaturalResource {
  id: string;
  name: string;
  type: ResourceType;
  category: 'surface' | 'underground';
  department: string;
  communes: string[];
  sectionCommunale?: string;
  watershed?: string;
  exutoire?: 'atlantique' | 'gonave' | 'caraibes' | 'transborder';
  frontiere?: boolean;
  dataSource: string;
  verificationStatus: VerificationStatus;
  availability: Availability;
  lat?: number;
  lon?: number;
  description?: string;
  regime?: 'permanent' | 'seasonal' | 'intermittent';
  length?: string;
  tributaries?: string[];
  basinArea?: string;
  drySeasonVulnerability?: 'low' | 'medium' | 'high';
  urbanPressure?: 'low' | 'medium' | 'high';
  pollutionRisk?: 'low' | 'medium' | 'high';
  erosionRisk?: 'low' | 'medium' | 'high';
  floodRisk?: 'low' | 'medium' | 'high';
  vegetationCover?: 'good' | 'degraded' | 'critical';
  aepPotential?: 'exploitable' | 'to-study' | 'not-recommended';
  linkedInfrastructure?: string[];
  precision?: 'high' | 'medium' | 'low';
  lastUpdated?: string;
}

export const LEGACY_NATURAL_RESOURCES: NaturalResource[] = [
  {
    id:'river-artibonite',name:'Rivière Artibonite',type:'river',category:'surface',
    department:'Artibonite',communes:['Gonaïves','Desdunes','Saint-Marc',"Petite-Rivière-de-l'Artibonite"],
    watershed:'Artibonite',exutoire:'gonave',frontiere:true,
    dataSource:'Haiti GeoPortal / CNIGS',verificationStatus:'verified',availability:'high',
    lat:19.10,lon:-72.50,description:"Principal fleuve d'Haïti. Prend sa source en République Dominicaine et se jette dans le golfe de la Gonâve après un parcours d'environ 280 km. Partagé avec la République Dominicaine (Guayamouc / Libón côté dominicain).",
    regime:'permanent',length:'~280 km',basinArea:'~9 000 km²',tributaries:['Rivière Guayamouc','Rivière Estère','Rivière Thomonde'],
    drySeasonVulnerability:'low',urbanPressure:'medium',pollutionRisk:'high',erosionRisk:'high',floodRisk:'high',vegetationCover:'degraded',
    aepPotential:'to-study',linkedInfrastructure:['Station de pompage Gonaïves','Captage Petite-Rivière'],
    precision:'high',lastUpdated:'2026-01-15'
  },
  {
    id:'river-grise',name:'Rivière Grise',type:'river',category:'surface',
    department:'Ouest',communes:['Tabarre','Croix-des-Bouquets','Port-au-Prince'],
    watershed:'Plaine du Cul-de-Sac',exutoire:'gonave',
    dataSource:'Haiti GeoPortal / CNIGS',verificationStatus:'pending',availability:'medium',
    lat:18.62,lon:-72.22,description:'La Rivière Grise prend sa source dans les hauteurs de Kenscoff et traverse plusieurs communes avant de se jeter dans la baie de Port-au-Prince.',
    regime:'seasonal',length:'~45 km',drySeasonVulnerability:'high',
    urbanPressure:'high',pollutionRisk:'high',erosionRisk:'medium',floodRisk:'high',vegetationCover:'degraded',
    aepPotential:'to-study',precision:'medium',lastUpdated:'2025-11-03'
  },
  {
    id:'river-bocozelle',name:'Rivière Bocozelle',type:'river',category:'surface',
    department:'Ouest',communes:['Croix-des-Bouquets'],
    watershed:'Plaine du Cul-de-Sac',dataSource:'Haiti GeoPortal / CNIGS',verificationStatus:'verified',availability:'medium',
    lat:18.65,lon:-72.20,regime:'seasonal',
    urbanPressure:'medium',pollutionRisk:'medium',erosionRisk:'medium',floodRisk:'medium',vegetationCover:'degraded',
    aepPotential:'to-study',precision:'medium',lastUpdated:'2025-09-20'
  },
  {
    id:'spring-morne-bleu',name:'Source Morne Bleu',type:'spring',category:'surface',
    department:'Ouest',communes:['Kenscoff'],dataSource:'Relevé terrain',verificationStatus:'verified',availability:'high',
    lat:18.42,lon:-72.39,description:"Source naturelle d'altitude dans les montagnes de Kenscoff. Eau de haute qualité, potentiellement exploitable pour l'AEP.",
    regime:'permanent',drySeasonVulnerability:'low',
    urbanPressure:'low',pollutionRisk:'low',erosionRisk:'low',floodRisk:'low',vegetationCover:'good',
    aepPotential:'exploitable',precision:'high',lastUpdated:'2026-02-10'
  },
  {
    id:'lake-azuei',name:'Lac Azuei (Étang Saumâtre)',type:'lake',category:'surface',
    department:'Ouest',communes:['Ganthier'],watershed:'Plaine du Cul-de-Sac',
    dataSource:'SIG Haïti',verificationStatus:'verified',availability:'medium',
    lat:18.55,lon:-71.98,basinArea:'~170 km²',description:"Grand lac saumâtre situé à la frontière avec la République Dominicaine. Habitat d'espèces protégées.",
    drySeasonVulnerability:'medium',urbanPressure:'low',pollutionRisk:'medium',floodRisk:'low',vegetationCover:'good',
    aepPotential:'not-recommended',precision:'high',lastUpdated:'2025-08-07'
  },
  {
    id:'lake-peligre',name:'Lac de Péligre',type:'lake',category:'surface',
    department:'Centre',communes:['Thomonde'],watershed:'Artibonite',
    dataSource:'SIG Haïti',verificationStatus:'verified',availability:'high',
    lat:19.05,lon:-72.00,basinArea:'~160 km²',description:"Principal plan d'eau douce d'Haïti. Alimenté par l'Artibonite, il constitue une réserve stratégique.",
    drySeasonVulnerability:'low',urbanPressure:'low',pollutionRisk:'medium',erosionRisk:'medium',vegetationCover:'good',
    aepPotential:'exploitable',precision:'high',lastUpdated:'2026-03-01'
  },
  {
    id:'aquifer-cul-de-sac',name:'Aquifère Plaine du Cul-de-Sac',type:'aquifer',category:'underground',
    department:'Ouest',communes:['Port-au-Prince','Tabarre','Croix-des-Bouquets','Cité Soleil'],
    watershed:'Plaine du Cul-de-Sac',dataSource:'CNIGS / Données hydrogéologiques',verificationStatus:'imported',availability:'medium',
    lat:18.58,lon:-72.25,description:'Nappe souterraine alluviale sous la plaine du Cul-de-Sac. Fortement sollicitée par les forages urbains.',
    drySeasonVulnerability:'high',urbanPressure:'high',pollutionRisk:'high',vegetationCover:'degraded',
    aepPotential:'to-study',linkedInfrastructure:['Forage F-01','Forage F-07','Puits P-12'],
    precision:'low',lastUpdated:'2024-06-15'
  },
  {
    id:'river-limbe',name:'Rivière Limbé',type:'river',category:'surface',
    department:'Nord',communes:['Limbé','Cap-Haïtien'],dataSource:'Haiti GeoPortal / CNIGS',verificationStatus:'verified',availability:'high',
    exutoire:'atlantique',lat:19.70,lon:-72.39,regime:'permanent',length:'~60 km',
    drySeasonVulnerability:'medium',urbanPressure:'medium',pollutionRisk:'medium',erosionRisk:'high',floodRisk:'high',vegetationCover:'degraded',
    aepPotential:'exploitable',precision:'medium',lastUpdated:'2025-12-01'
  },
  {
    id:'spring-thomas',name:'Source Saint-Thomas',type:'spring',category:'surface',
    department:'Nord',communes:['Saint-Raphaël'],dataSource:'Relevé terrain',verificationStatus:'pending',availability:'medium',
    lat:19.75,lon:-72.25,regime:'permanent',
    drySeasonVulnerability:'medium',urbanPressure:'low',pollutionRisk:'low',erosionRisk:'medium',vegetationCover:'good',
    aepPotential:'exploitable',precision:'low',lastUpdated:'2025-07-12'
  },
  {
    id:'river-trois-rivieres',name:'Rivière des Trois-Rivières',type:'river',category:'surface',
    department:'Artibonite',communes:['Gonaïves','Ennery'],dataSource:'Haiti GeoPortal / CNIGS',verificationStatus:'verified',availability:'medium',
    exutoire:'gonave',lat:19.45,lon:-72.68,regime:'seasonal',length:'~90 km',
    drySeasonVulnerability:'high',urbanPressure:'medium',pollutionRisk:'medium',erosionRisk:'high',floodRisk:'high',vegetationCover:'degraded',
    aepPotential:'to-study',precision:'medium',lastUpdated:'2025-10-22'
  },
  {
    id:'river-massacre',name:'Rivière du Massacre',type:'river',category:'surface',
    department:'Nord-Est',communes:['Ouanaminthe'],dataSource:'Haiti GeoPortal / CNIGS',verificationStatus:'verified',availability:'high',
    exutoire:'atlantique',frontiere:true,
    lat:19.55,lon:-71.75,regime:'permanent',length:'~65 km',
    description:"Rivière frontalière entre Haïti et la République Dominicaine. Se jette dans l'Océan Atlantique au niveau de Ouanaminthe / Dajabón.",
    drySeasonVulnerability:'low',urbanPressure:'medium',pollutionRisk:'medium',erosionRisk:'medium',floodRisk:'high',vegetationCover:'degraded',
    aepPotential:'exploitable',precision:'high',lastUpdated:'2026-01-08'
  },
  {
    id:'aquifer-cayes',name:'Aquifère Plaine des Cayes',type:'aquifer',category:'underground',
    department:'Sud',communes:['Les Cayes','Torbeck','Chantal'],dataSource:'CNIGS / Données hydrogéologiques',verificationStatus:'imported',availability:'medium',
    lat:18.20,lon:-73.75,drySeasonVulnerability:'medium',urbanPressure:'medium',pollutionRisk:'medium',
    aepPotential:'exploitable',precision:'low',lastUpdated:'2024-09-30'
  },
  {
    id:'wetland-baie-pap',name:'Zone humide Baie de Port-au-Prince',type:'wetland',category:'surface',
    department:'Ouest',communes:['Port-au-Prince','Cité Soleil'],dataSource:'SIG Haïti',verificationStatus:'imported',availability:'unknown',
    lat:18.60,lon:-72.35,description:"Zone de mangroves et marais côtiers en bordure de la baie. Très dégradée par l'urbanisation.",
    urbanPressure:'high',pollutionRisk:'high',vegetationCover:'critical',
    aepPotential:'not-recommended',precision:'medium',lastUpdated:'2025-03-14'
  },
  {
    id:'river-momance',name:'Rivière Momance',type:'river',category:'surface',
    department:'Ouest',communes:['Léogâne','Grand-Goâve'],dataSource:'Haiti GeoPortal / CNIGS',verificationStatus:'verified',availability:'medium',
    exutoire:'gonave',lat:18.47,lon:-72.75,regime:'seasonal',length:'~40 km',
    drySeasonVulnerability:'high',urbanPressure:'low',pollutionRisk:'low',erosionRisk:'medium',vegetationCover:'degraded',
    aepPotential:'to-study',precision:'medium',lastUpdated:'2025-11-18'
  },
  {
    id:'watershed-artibonite',name:"Bassin versant de l'Artibonite",type:'watershed',category:'surface',
    department:'Artibonite',communes:['Gonaïves','Saint-Marc','Desdunes'],watershed:'Artibonite',
    dataSource:'ArcGIS Hub / Haiti Watersheds',verificationStatus:'imported',availability:'high',
    lat:19.15,lon:-72.30,basinArea:'~9 000 km²',description:"Plus grand bassin hydrographique d'Haïti, couvrant environ 25 % du territoire national.",
    drySeasonVulnerability:'low',urbanPressure:'medium',erosionRisk:'high',
    aepPotential:'exploitable',precision:'medium',lastUpdated:'2025-06-01'
  },
  {
    id:'river-grande-riviere-nord',name:'Grande Rivière du Nord',type:'river',category:'surface',
    department:'Nord',communes:['Cap-Haïtien','Grande-Rivière-du-Nord','Dondon'],dataSource:'Haiti GeoPortal / CNIGS',verificationStatus:'verified',availability:'high',
    exutoire:'atlantique',lat:19.78,lon:-72.20,regime:'permanent',length:'~85 km',
    drySeasonVulnerability:'low',urbanPressure:'medium',pollutionRisk:'medium',erosionRisk:'high',floodRisk:'high',vegetationCover:'degraded',
    aepPotential:'exploitable',precision:'high',lastUpdated:'2026-02-28'
  },
  {
    id:'lake-miragoane',name:'Lac Miragoâne',type:'lake',category:'surface',
    department:'Nippes',communes:['Miragoâne'],dataSource:'SIG Haïti',verificationStatus:'verified',availability:'high',
    lat:18.44,lon:-73.09,basinArea:'~60 km²',description:"Lac naturel d'eau douce parmi les plus importants d'Haïti, potentiellement exploitable pour l'AEP régionale.",
    drySeasonVulnerability:'low',urbanPressure:'low',pollutionRisk:'low',vegetationCover:'good',
    aepPotential:'exploitable',precision:'high',lastUpdated:'2026-01-20'
  },
  {
    id:'spring-jacmel',name:'Source Jacmel',type:'spring',category:'surface',
    department:'Sud-Est',communes:['Jacmel'],dataSource:'Relevé terrain',verificationStatus:'verified',availability:'high',
    lat:18.23,lon:-72.53,regime:'permanent',
    drySeasonVulnerability:'low',urbanPressure:'low',pollutionRisk:'low',vegetationCover:'good',
    aepPotential:'exploitable',precision:'high',lastUpdated:'2026-03-05'
  },
  {
    id:'spring-cayes-jacot',name:'Source Cayes-Jacot',type:'spring',category:'surface',
    department:"Grand'Anse",communes:['Jérémie'],dataSource:'Relevé terrain',verificationStatus:'imported',availability:'unknown',
    lat:18.65,lon:-74.11,regime:'permanent',
    urbanPressure:'low',pollutionRisk:'low',vegetationCover:'good',
    aepPotential:'to-study',precision:'low',lastUpdated:'2024-11-22'
  },
  {
    id:'aquifer-nippes',name:'Aquifère Plaine de Nippes',type:'aquifer',category:'underground',
    department:'Nippes',communes:['Miragoâne','Baradères'],dataSource:'CNIGS / Données hydrogéologiques',verificationStatus:'imported',availability:'low',
    lat:18.38,lon:-73.20,drySeasonVulnerability:'high',urbanPressure:'low',pollutionRisk:'low',
    aepPotential:'to-study',precision:'low',lastUpdated:'2024-08-10'
  },
  {
    id:'wetland-mangrove-leogane',name:'Mangrove de Léogâne',type:'wetland',category:'surface',
    department:'Ouest',communes:['Léogâne'],dataSource:'SIG Haïti',verificationStatus:'imported',availability:'unknown',
    lat:18.51,lon:-72.63,description:"Zone de mangroves côtières au fond du golfe de la Gonâve. Importante pour la protection des ressources souterraines locales.",
    urbanPressure:'medium',pollutionRisk:'medium',vegetationCover:'degraded',
    aepPotential:'not-recommended',precision:'medium',lastUpdated:'2025-04-02'
  },
  {
    id:'river-grande-riviere-nippes',name:'Grande Rivière de Nippes',type:'river',category:'surface',
    department:'Nippes',communes:['Baradères','Miragoâne'],dataSource:'Haiti GeoPortal / CNIGS',verificationStatus:'pending',availability:'medium',
    exutoire:'caraibes',lat:18.50,lon:-73.55,regime:'seasonal',length:'~50 km',
    drySeasonVulnerability:'high',urbanPressure:'low',pollutionRisk:'low',erosionRisk:'medium',vegetationCover:'degraded',
    aepPotential:'to-study',precision:'medium',lastUpdated:'2025-08-30'
  },
  {
    id:'watershed-grand-anse',name:"Bassin versant Grand'Anse",type:'watershed',category:'surface',
    department:"Grand'Anse",communes:['Jérémie',"Anse-d'Hainault"],watershed:"Grand'Anse",
    dataSource:'ArcGIS Hub / Haiti Watersheds',verificationStatus:'imported',availability:'high',
    lat:18.62,lon:-74.00,basinArea:'~1 600 km²',description:"Bassin versant très arrosé couvrant le département de la Grand'Anse. Ressources en eau abondantes mais peu valorisées.",
    drySeasonVulnerability:'low',erosionRisk:'high',vegetationCover:'good',
    aepPotential:'exploitable',precision:'medium',lastUpdated:'2025-05-19'
  },
  {
    id:'spring-source-chaude-jacmel',name:'Source Chaude de Jacmel',type:'spring',category:'surface',
    department:'Sud-Est',communes:['Jacmel','Cayes-Jacmel'],dataSource:'Relevé terrain',verificationStatus:'corrected',availability:'high',
    lat:18.20,lon:-72.50,regime:'permanent',
    drySeasonVulnerability:'low',urbanPressure:'low',pollutionRisk:'low',vegetationCover:'good',
    aepPotential:'exploitable',precision:'high',lastUpdated:'2026-02-14'
  },
  {
    id:'river-plaisance',name:'Rivière de la Plaisance',type:'river',category:'surface',
    department:'Nord',communes:['Plaisance','Pilate'],dataSource:'Haiti GeoPortal / CNIGS',verificationStatus:'pending',availability:'medium',
    exutoire:'atlantique',lat:19.60,lon:-72.47,regime:'seasonal',length:'~35 km',
    drySeasonVulnerability:'high',urbanPressure:'low',pollutionRisk:'low',erosionRisk:'high',vegetationCover:'degraded',
    aepPotential:'to-study',precision:'medium',lastUpdated:'2025-09-05'
  },
  { id:'river-cavaillon',name:'Rivière Cavaillon',type:'river',category:'surface',
    department:'Sud',communes:['Les Cayes','Aquin'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    description:'Se jette dans la Mer des Caraïbes. Géométrie à compléter.',precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-grande-anse',name:'Rivière Grande-Anse',type:'river',category:'surface',
    department:"Grand'Anse",communes:['Jérémie'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    description:"Principal cours d'eau du département de la Grand'Anse, se jette dans la Mer des Caraïbes.",precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-guayamouc',name:'Rivière Guayamouc',type:'river',category:'surface',
    department:'Centre',communes:['Hinche'],exutoire:'gonave',frontiere:false,watershed:'Artibonite',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    description:"Affluent de l'Artibonite. Prend sa source dans le plateau central.",precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-estere',name:'Rivière Estère',type:'river',category:'surface',
    department:'Artibonite',communes:['Gonaïves',"L'Estère"],exutoire:'gonave',watershed:'Artibonite',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    description:"Affluent de l'Artibonite avant son embouchure dans le golfe de la Gonâve.",precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-capotille',name:'Rivière Capotille',type:'river',category:'surface',
    department:'Nord-Est',communes:['Capotille'],exutoire:'atlantique',frontiere:true,
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    description:"Cours d'eau frontalier se jetant dans l'Océan Atlantique.",precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-thomonde',name:'Rivière Thomonde',type:'river',category:'surface',
    department:'Centre',communes:['Thomonde'],exutoire:'gonave',watershed:'Artibonite',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-grande-riviere-jacmel',name:'Grande Rivière de Jacmel',type:'river',category:'surface',
    department:'Sud-Est',communes:['Jacmel'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    description:"Principal cours d'eau de la région de Jacmel, se jette dans la Mer des Caraïbes.",precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-voldrogue',name:'Rivière Voldrogue',type:'river',category:'surface',
    department:'Nord-Ouest',communes:['Port-de-Paix'],exutoire:'atlantique',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-grande-riviere-saint-marc',name:'Grande Rivière de Saint-Marc',type:'river',category:'surface',
    department:'Artibonite',communes:['Saint-Marc'],exutoire:'gonave',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-gosseline',name:'Rivière La Gosseline',type:'river',category:'surface',
    department:'Sud',communes:['Côteaux'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-ravine-du-sud',name:'Ravine du Sud',type:'river',category:'surface',
    department:'Sud',communes:['Les Cayes','Torbeck'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    description:'Ravine importante dans la plaine des Cayes.',precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-torbeck',name:'Rivière Torbeck',type:'river',category:'surface',
    department:'Sud',communes:['Torbeck'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-soliette',name:'Rivière Soliette',type:'river',category:'surface',
    department:'Ouest',communes:['Léogâne','Gressier'],exutoire:'gonave',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-boucan-carre',name:'Rivière Boucan Carré',type:'river',category:'surface',
    department:'Centre',communes:['Boucan-Carré'],exutoire:'gonave',watershed:'Artibonite',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-petite-riviere-jacmel',name:'Petite Rivière de Jacmel',type:'river',category:'surface',
    department:'Sud-Est',communes:['Jacmel'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-montrouis',name:'Rivière de Montrouis',type:'river',category:'surface',
    department:'Artibonite',communes:['Saint-Marc'],exutoire:'gonave',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-gauche',name:'Rivière Gauche',type:'river',category:'surface',
    department:'Centre',communes:['Lascahobas'],exutoire:'gonave',frontiere:true,
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    description:"Cours d'eau de la région centre, potentiellement frontalier.",precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-haut-du-cap',name:'Rivière du Haut-du-Cap',type:'river',category:'surface',
    department:'Nord',communes:['Cap-Haïtien'],exutoire:'atlantique',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-moustiques',name:'Rivière des Moustiques',type:'river',category:'surface',
    department:'Nord-Ouest',communes:['Port-de-Paix','Môle-Saint-Nicolas'],exutoire:'atlantique',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-froide',name:'Rivière Froide',type:'river',category:'surface',
    department:'Ouest',communes:['Pétion-Ville','Port-au-Prince'],exutoire:'gonave',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-pedernales',name:'Rivière Pédernales',type:'river',category:'surface',
    department:'Sud',communes:['Côteaux'],exutoire:'caraibes',frontiere:true,
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    description:'Rivière frontalière entre Haïti et la République Dominicaine dans le Sud. Se jette dans la Mer des Caraïbes.',precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-acul-du-sud',name:"Rivière de l'Acul du Sud",type:'river',category:'surface',
    department:'Sud',communes:['Aquin'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-marigot',name:'Rivière Marigot',type:'river',category:'surface',
    department:'Sud-Est',communes:['Marigot'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-canot',name:'Rivière Canot',type:'river',category:'surface',
    department:"Grand'Anse",communes:['Jérémie'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-marion',name:'Rivière Marion',type:'river',category:'surface',
    department:'Sud-Est',communes:['Jacmel'],exutoire:'caraibes',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
  { id:'river-orangers',name:'Rivière des Orangers',type:'river',category:'surface',
    department:'Nord-Ouest',communes:['Jean-Rabel'],exutoire:'atlantique',
    dataSource:"Wikipédia — Cours d'eau d'Haïti",verificationStatus:'imported',availability:'unknown',
    precision:'low',lastUpdated:'2026-04-29' },
];

