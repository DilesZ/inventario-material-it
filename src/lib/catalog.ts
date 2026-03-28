export type CatalogProduct = {
  slug: string;
  name: string;
  sku: string;
  description: string;
  highlight: string;
  displayOrder: number;
};

export const DEFAULT_PRODUCTS: CatalogProduct[] = [
  {
    slug: "portatiles",
    name: "Portátiles corporativos",
    sku: "IT-LAP",
    description: "Equipos listos para altas, reposiciones y sustituciones.",
    highlight: "Reposición rápida",
    displayOrder: 1,
  },
  {
    slug: "monitores",
    name: "Monitores",
    sku: "IT-MON",
    description: "Pantallas para puestos fijos y ampliaciones de escritorio.",
    highlight: "Puestos híbridos",
    displayOrder: 2,
  },
  {
    slug: "docks",
    name: "Docking stations",
    sku: "IT-DCK",
    description: "Bases para conexión rápida en oficinas y salas.",
    highlight: "Conectividad",
    displayOrder: 3,
  },
  {
    slug: "teclados",
    name: "Teclados",
    sku: "IT-KEY",
    description: "Periféricos de sustitución y nuevos puestos de trabajo.",
    highlight: "Stock diario",
    displayOrder: 4,
  },
  {
    slug: "ratones",
    name: "Ratones",
    sku: "IT-MOU",
    description: "Ratones para onboarding y reposición inmediata.",
    highlight: "Consumible controlado",
    displayOrder: 5,
  },
  {
    slug: "auriculares",
    name: "Auriculares",
    sku: "IT-HSP",
    description: "Auriculares para reuniones y atención remota.",
    highlight: "Colaboración",
    displayOrder: 6,
  },
  {
    slug: "webcams",
    name: "Webcams",
    sku: "IT-WEB",
    description: "Cámaras para puestos de videollamada y salas ligeras.",
    highlight: "Videoconferencia",
    displayOrder: 7,
  },
];
