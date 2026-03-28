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
    name: "Lenovo V15 G5",
    sku: "IT-LNV15",
    description: "Portátil corporativo para altas, sustituciones y puestos de trabajo habituales.",
    highlight: "Equipo principal",
    displayOrder: 1,
    imagePath: "/products/portatiles.jpg",
  },
  {
    slug: "monitores",
    name: "Monitor Philips 24\"",
    sku: "IT-PH24",
    description: "Monitor profesional para puestos fijos, ampliaciones y configuraciones de escritorio.",
    highlight: "Puesto fijo",
    displayOrder: 2,
    imagePath: "/products/monitores.png",
  },
  {
    slug: "docks",
    name: "Docking I-TEC",
    sku: "IT-ITEC",
    description: "Dock vertical para ampliar puertos y conectar periféricos de forma inmediata.",
    highlight: "Conectividad",
    displayOrder: 3,
    imagePath: "/products/docks.png",
  },
  {
    slug: "teclados",
    name: "Pack Logitech MK270",
    sku: "IT-MK270",
    description: "Combo inalámbrico de teclado y ratón para nuevas incorporaciones y reposiciones.",
    highlight: "Combo inalámbrico",
    displayOrder: 4,
    imagePath: "/products/teclados-ratones.png",
  },
  {
    slug: "ratones",
    name: "Logitech M185",
    sku: "IT-M185",
    description: "Ratones Logitech M185 para onboarding y reposición inmediata.",
    highlight: "Consumible controlado",
    displayOrder: 5,
    imagePath: "/products/ratones.png",
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
