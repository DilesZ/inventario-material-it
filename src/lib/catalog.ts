export type CatalogProduct = {
  slug: string;
  name: string;
  sku: string;
  description: string;
  highlight: string;
  displayOrder: number;
  imagePath: string;
};

export const DEFAULT_PRODUCTS: CatalogProduct[] = [
  {
    slug: "portatiles",
    name: "Portátiles corporativos",
    sku: "IT-LAP",
    description: "Equipos listos para altas, reposiciones y sustituciones.",
    highlight: "Reposición rápida",
    displayOrder: 1,
    imagePath: "/products/portatiles.svg",
  },
  {
    slug: "monitores",
    name: "Monitores",
    sku: "IT-MON",
    description: "Pantallas para puestos fijos y ampliaciones de escritorio.",
    highlight: "Puestos híbridos",
    displayOrder: 2,
    imagePath: "/products/monitores.svg",
  },
  {
    slug: "docks",
    name: "Docking stations",
    sku: "IT-DCK",
    description: "Bases para conexión rápida en oficinas y salas.",
    highlight: "Conectividad",
    displayOrder: 3,
    imagePath: "/products/docks.svg",
  },
  {
    slug: "teclados",
    name: "Teclados",
    sku: "IT-KEY",
    description: "Periféricos de sustitución y nuevos puestos de trabajo.",
    highlight: "Stock diario",
    displayOrder: 4,
    imagePath: "/products/teclados.svg",
  },
  {
    slug: "ratones",
    name: "Ratones",
    sku: "IT-MOU",
    description: "Ratones para onboarding y reposición inmediata.",
    highlight: "Consumible controlado",
    displayOrder: 5,
    imagePath: "/products/ratones.svg",
  },
  {
    slug: "auriculares",
    name: "Auriculares",
    sku: "IT-HSP",
    description: "Auriculares para reuniones y atención remota.",
    highlight: "Colaboración",
    displayOrder: 6,
    imagePath: "/products/auriculares.svg",
  },
  {
    slug: "webcams",
    name: "Webcams",
    sku: "IT-WEB",
    description: "Cámaras para puestos de videollamada y salas ligeras.",
    highlight: "Videoconferencia",
    displayOrder: 7,
    imagePath: "/products/webcams.svg",
  },
];
