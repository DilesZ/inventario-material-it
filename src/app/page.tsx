"use client";

import Image from "next/image";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Clock3,
  Filter,
  LayoutGrid,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type ProductSummary = {
  id: number;
  slug: string;
  name: string;
  sku: string;
  description: string;
  highlight: string;
  displayOrder: number;
  totalUnits: number;
  availableUnits: number;
  assignedUnits: number;
  lastMovementAt: string | null;
  imagePath: string;
};

type ProductUnit = {
  serialNumber: string;
  status: "available" | "assigned";
  provider: string | null;
  recipient: string | null;
  receivedDate: string | null;
  shippedDate: string | null;
};

type MovementRecord = {
  id: number;
  type: "in" | "out";
  productSlug: string;
  productName: string;
  productSku: string;
  serialNumber: string;
  partnerName: string;
  movementDate: string;
  createdAt: string;
  unitStatus: "available" | "assigned";
};

type ProductDetail = ProductSummary & {
  availableSerials: ProductUnit[];
  assignedSerials: ProductUnit[];
  recentMovements: MovementRecord[];
};

type ProductsResponse = {
  products: ProductSummary[];
  databaseMode: "local" | "remote";
  error?: string;
};

type ProductResponse = {
  product?: ProductDetail;
  error?: string;
};

type MovementsResponse = {
  movements: MovementRecord[];
  error?: string;
};

type ApiResponse = {
  message?: string;
  error?: string;
};

const parseSerials = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const formatDate = (value: string | null) => {
  if (!value) {
    return "Sin movimientos";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Sin registro";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const today = () => new Date().toISOString().slice(0, 10);
const formatCompactNumber = (value: number) => new Intl.NumberFormat("es-ES").format(value);
const getAvailabilityPercentage = (availableUnits: number, totalUnits: number) =>
  totalUnits > 0 ? Math.round((availableUnits / totalUnits) * 100) : 0;
const getAssignmentPercentage = (assignedUnits: number, totalUnits: number) =>
  totalUnits > 0 ? Math.round((assignedUnits / totalUnits) * 100) : 0;

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [databaseMode, setDatabaseMode] = useState<"local" | "remote">("local");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"in" | "out" | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementFilter, setMovementFilter] = useState<"all" | "in" | "out">("all");
  const [inForm, setInForm] = useState({ quantity: "1", provider: "", movementDate: today(), serialsText: "" });
  const [outForm, setOutForm] = useState({ quantity: "1", recipient: "", movementDate: today(), serialsText: "" });

  const selectedProduct = useMemo(
    () => products.find((product) => product.slug === activeSlug) ?? null,
    [products, activeSlug]
  );

  const inSerialCount = useMemo(() => parseSerials(inForm.serialsText).length, [inForm.serialsText]);
  const outSerialCount = useMemo(() => parseSerials(outForm.serialsText).length, [outForm.serialsText]);
  const dashboardStats = useMemo(
    () =>
      products.reduce(
        (summary, product) => ({
          totalProducts: summary.totalProducts + 1,
          availableUnits: summary.availableUnits + product.availableUnits,
          assignedUnits: summary.assignedUnits + product.assignedUnits,
          totalUnits: summary.totalUnits + product.totalUnits,
        }),
        { totalProducts: 0, availableUnits: 0, assignedUnits: 0, totalUnits: 0 }
      ),
    [products]
  );
  
  const filteredProducts = useMemo(() => {
    const searchTerm = productSearch.trim().toLowerCase();
    if (!searchTerm) {
      return products;
    }

    return products.filter((product) =>
      [product.name, product.sku, product.description, product.highlight].some((value) => value.toLowerCase().includes(searchTerm))
    );
  }, [products, productSearch]);
  const filteredMovements = useMemo(() => {
    const searchTerm = movementSearch.trim().toLowerCase();

    return movements.filter((movement) => {
      const matchesType = movementFilter === "all" || movement.type === movementFilter;
      const matchesSearch =
        !searchTerm ||
        [
          movement.productName,
          movement.productSku,
          movement.serialNumber,
          movement.partnerName,
          movement.unitStatus,
        ].some((value) => value.toLowerCase().includes(searchTerm));

      return matchesType && matchesSearch;
    });
  }, [movementFilter, movementSearch, movements]);
  const filteredMovementStats = useMemo(
    () =>
      filteredMovements.reduce(
        (summary, movement) => ({
          entries: summary.entries + (movement.type === "in" ? 1 : 0),
          exits: summary.exits + (movement.type === "out" ? 1 : 0),
          available: summary.available + (movement.unitStatus === "available" ? 1 : 0),
        }),
        { entries: 0, exits: 0, available: 0 }
      ),
    [filteredMovements]
  );

  const loadProducts = useCallback(async (preferredSlug?: string | null) => {
    setLoadingProducts(true);
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      if (response.status === 401) {
        setIsAuthenticated(false);
        setProducts([]);
        setDetail(null);
        setActiveSlug(null);
        return null;
      }

      const payload = (await response.json()) as ProductsResponse;
      if (!response.ok) {
        throw new Error(payload.error || "No se pudieron cargar los productos.");
      }

      setIsAuthenticated(true);
      setProducts(payload.products);
      setDatabaseMode(payload.databaseMode);
      const nextSlug =
        (preferredSlug && payload.products.some((product) => product.slug === preferredSlug) && preferredSlug) ||
        payload.products[0]?.slug ||
        null;
      setActiveSlug(nextSlug);
      return nextSlug;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los productos.");
      return null;
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadDetail = useCallback(async (slug: string) => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/products/${slug}`, { cache: "no-store" });
      if (response.status === 401) {
        setIsAuthenticated(false);
        setProducts([]);
        setDetail(null);
        return;
      }

      const payload = (await response.json()) as ProductResponse;
      if (!response.ok || !payload.product) {
        throw new Error(payload.error || "No se pudo cargar el detalle del producto.");
      }

      setDetail(payload.product);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el detalle del producto.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const loadMovementTimeline = useCallback(async () => {
    setLoadingMovements(true);
    try {
      const response = await fetch("/api/movements", { cache: "no-store" });
      if (response.status === 401) {
        setIsAuthenticated(false);
        setMovements([]);
        return;
      }

      const payload = (await response.json()) as MovementsResponse;
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo cargar el historial de movimientos.");
      }

      setMovements(payload.movements);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el historial de movimientos.");
    } finally {
      setLoadingMovements(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (isAuthenticated && activeSlug) {
      void loadDetail(activeSlug);
    }
  }, [activeSlug, isAuthenticated, loadDetail]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadMovementTimeline();
    }
  }, [isAuthenticated, loadMovementTimeline]);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPassword }),
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo iniciar sesión.");
      }

      setLoginUser("");
      setLoginPassword("");
      setIsAuthenticated(true);
      setMessage("Sesión iniciada correctamente.");
      await Promise.all([loadProducts(activeSlug), loadMovementTimeline()]);
    } catch (loginRequestError) {
      setLoginError(loginRequestError instanceof Error ? loginRequestError.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
    setProducts([]);
    setDetail(null);
    setMovements([]);
    setActiveSlug(null);
    setMessage("");
    setError("");
    setLoginError("");
  };

  const activateProduct = (slug: string, nextMode?: "in" | "out") => {
    setActiveSlug(slug);
    if (nextMode) {
      setMode(nextMode);
    } else {
      setMode(null);
    }
  };

  const appendOutgoingSerial = (serialNumber: string) => {
    setOutForm((current) => {
      const serials = parseSerials(current.serialsText);
      if (serials.includes(serialNumber)) {
        return current;
      }

      const nextSerials = [...serials, serialNumber];
      return {
        ...current,
        quantity: String(nextSerials.length),
        serialsText: nextSerials.join("\n"),
      };
    });
  };

  const submitMovement = async (movementMode: "in" | "out") => {
    if (!activeSlug) {
      return;
    }

    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(movementMode === "in" ? "/api/movements/in" : "/api/movements/out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          movementMode === "in"
            ? {
                slug: activeSlug,
                quantity: Number(inForm.quantity),
                provider: inForm.provider,
                movementDate: inForm.movementDate,
                serialNumbers: parseSerials(inForm.serialsText),
              }
            : {
                slug: activeSlug,
                quantity: Number(outForm.quantity),
                recipient: outForm.recipient,
                movementDate: outForm.movementDate,
                serialNumbers: parseSerials(outForm.serialsText),
              }
        ),
      });

      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo guardar el movimiento.");
      }

      if (movementMode === "in") {
        setInForm({ quantity: "1", provider: "", movementDate: today(), serialsText: "" });
      } else {
        setOutForm({ quantity: "1", recipient: "", movementDate: today(), serialsText: "" });
      }

      setMessage(payload.message || "Movimiento guardado correctamente.");
      setMode(null);
      const nextSlug = await loadProducts(activeSlug);
      await loadMovementTimeline();
      if (nextSlug) {
        await loadDetail(nextSlug);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el movimiento.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isAuthenticated === null) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Cargando inventario...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,193,222,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(5,13,158,0.26),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 py-10">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/8 p-8 text-white shadow-2xl shadow-slate-950/40 backdrop-blur-xl lg:p-10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-brand-blue to-cyan-300" />
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Plataforma interna IT
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="rounded-3xl bg-white/10 p-4">
                <Image src="/logo.svg" alt="Logo" width={112} height={84} priority className="h-auto w-20" />
              </div>
              <div>
                <p className="text-sm font-medium text-cyan-100">Gestión premium de inventario</p>
                <h1 className="mt-2 text-4xl font-bold tracking-tight">Material IT listo para operar</h1>
              </div>
            </div>
            <p className="mt-8 max-w-2xl text-base leading-7 text-slate-200">
              Unifica stock, movimientos, Nº de Serie y trazabilidad en una interfaz más clara, rápida y cómoda para el equipo de sistemas.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
                <ShieldCheck className="h-5 w-5 text-cyan-200" />
                <p className="mt-4 text-sm font-semibold">Acceso seguro</p>
                <p className="mt-2 text-sm text-slate-300">Sesión privada para operaciones internas.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
                <PackageCheck className="h-5 w-5 text-cyan-200" />
                <p className="mt-4 text-sm font-semibold">Stock visible</p>
                <p className="mt-2 text-sm text-slate-300">Disponibles, asignadas y totales en un vistazo.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
                <Clock3 className="h-5 w-5 text-cyan-200" />
                <p className="mt-4 text-sm font-semibold">Trazabilidad total</p>
                <p className="mt-2 text-sm text-slate-300">Cada movimiento queda registrado al instante.</p>
              </div>
            </div>
          </div>

          <div className="w-full rounded-[2rem] border border-slate-200/70 bg-white/95 p-8 shadow-2xl shadow-slate-950/15 backdrop-blur lg:p-10">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-blue/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">
                <ScanSearch className="h-3.5 w-3.5" />
                Acceso restringido
              </div>
              <h2 className="mt-4 text-3xl font-bold text-slate-950">Entra al panel de inventario</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Identifícate para gestionar productos, salidas, entradas y movimientos históricos.</p>
            </div>
            <form onSubmit={submitLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Usuario</label>
                <input value={loginUser} onChange={(event) => setLoginUser(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" placeholder="Introduce tu usuario" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Contraseña</label>
                <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" placeholder="Introduce tu contraseña" required />
              </div>
              {loginError ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">{loginError}</div> : null}
              <button type="submit" disabled={submitting} className="w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:bg-brand-blue disabled:opacity-60">Iniciar sesión</button>
            </form>
            <div className="mt-8 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Entorno</p>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>Panel de Sistemas 2026</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">Operativo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,193,222,0.20),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(5,13,158,0.22),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/8 text-white shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
          <div className="grid gap-8 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                Inventario premium
              </div>
              <div className="mt-6 flex items-start gap-4">
                <div className="rounded-[1.75rem] bg-white/10 p-3">
                  <Image src="/logo.svg" alt="Logo" width={110} height={78} priority className="h-auto w-20" />
                </div>
                <div>
                  <p className="text-sm font-medium text-cyan-100">Gestión de material IT</p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Visual, profesional y lista para el trabajo diario</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                    Controla entradas, salidas, fotos, Nº de Serie y trazabilidad completa desde una interfaz más clara, más rápida y más cómoda para operaciones reales.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.18em]">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-cyan-100">DB {databaseMode === "remote" ? "remota" : "local"}</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-cyan-100">{formatCompactNumber(products.length)} productos</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-cyan-100">{formatCompactNumber(movements.length)} movimientos</span>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
                <LayoutGrid className="h-5 w-5 text-cyan-200" />
                <p className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-300">Productos</p>
                <p className="mt-2 text-3xl font-bold">{formatCompactNumber(dashboardStats.totalProducts)}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
                <Boxes className="h-5 w-5 text-cyan-200" />
                <p className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-300">Unidades totales</p>
                <p className="mt-2 text-3xl font-bold">{formatCompactNumber(dashboardStats.totalUnits)}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
                <PackageCheck className="h-5 w-5 text-cyan-200" />
                <p className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-300">Disponibles</p>
                <p className="mt-2 text-3xl font-bold">{formatCompactNumber(dashboardStats.availableUnits)}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5">
                <PackageMinus className="h-5 w-5 text-cyan-200" />
                <p className="mt-5 text-xs uppercase tracking-[0.18em] text-slate-300">Asignadas</p>
                <p className="mt-2 text-3xl font-bold">{formatCompactNumber(dashboardStats.assignedUnits)}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/92 shadow-2xl shadow-slate-950/30">
          <header className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">Panel operativo</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-950">Inventario activo con trazabilidad</h2>
              <p className="mt-2 text-sm text-slate-500">Gestiona unidades directamente desde las tarjetas y revisa el stock en tiempo real.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={logout} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue">Cerrar sesión</button>
            </div>
          </header>
          {message ? <div className="mx-6 mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 lg:mx-8">{message}</div> : null}
          {error ? <div className="mx-6 mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:mx-8">{error}</div> : null}

          <main className="px-6 py-6 lg:px-8 lg:py-8">
            <section className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Disponibles</p>
                    <PackageCheck className="h-4 w-4 text-brand-blue" />
                  </div>
                  <p className="mt-3 text-3xl font-bold text-slate-950">{formatCompactNumber(dashboardStats.availableUnits)}</p>
                  <p className="mt-2 text-sm text-slate-500">Unidades listas para asignar o entregar.</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Asignadas</p>
                    <PackageMinus className="h-4 w-4 text-slate-950" />
                  </div>
                  <p className="mt-3 text-3xl font-bold text-slate-950">{formatCompactNumber(dashboardStats.assignedUnits)}</p>
                  <p className="mt-2 text-sm text-slate-500">Material actualmente entregado o en uso.</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Actividad</p>
                    <Activity className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="mt-3 text-3xl font-bold text-slate-950">{formatCompactNumber(movements.length)}</p>
                  <p className="mt-2 text-sm text-slate-500">Movimientos totales registrados.</p>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">Catálogo operativo</h3>
                    <p className="text-sm text-slate-500">Usa los botones de las tarjetas para añadir o restar unidades rápidamente.</p>
                  </div>
                  {loadingProducts ? <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-sm font-semibold text-brand-blue">Actualizando...</span> : null}
                </div>
                <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder="Buscar por producto, SKU, descripción o etiqueta"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    <Filter className="h-4 w-4 text-brand-blue" />
                    {filteredProducts.length} de {products.length} productos
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredProducts.map((product) => {
                    const isActive = product.slug === activeSlug;
                    const isEditing = isActive && mode !== null;
                    return (
                      <article
                        key={product.id}
                        onClick={() => {
                          if (!isEditing) {
                            activateProduct(product.slug);
                          }
                        }}
                        className={`group relative flex flex-col overflow-hidden rounded-[1.75rem] border transition-all duration-300 ${isActive ? "border-brand-blue ring-4 ring-brand-blue/5 shadow-xl shadow-brand-blue/5" : "border-slate-200 hover:border-brand-blue/30 hover:shadow-xl hover:shadow-slate-200/50"} bg-white`}
                      >
                        <div className={`relative aspect-[16/10] overflow-hidden ${isActive ? "bg-slate-950/5" : "bg-slate-50"}`}>
                          <Image
                            src={product.imagePath}
                            alt={product.name}
                            fill
                            className={`object-contain p-6 transition duration-500 ${!isEditing && "group-hover:scale-110"}`}
                          />
                          <div className="absolute left-3 top-3 flex items-center gap-1.5">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isActive ? "bg-brand-blue text-white shadow-sm" : "bg-white text-brand-blue shadow-sm"}`}>{product.sku}</span>
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col p-5">
                          <div className="mb-4">
                            <h4 className="text-lg font-bold text-slate-950">{product.name}</h4>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{product.description}</p>
                          </div>

                          <div className="mb-5 grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-slate-50 p-2 text-center">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Disp.</p>
                              <p className="text-lg font-bold text-slate-950">{product.availableUnits}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2 text-center">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Asign.</p>
                              <p className="text-lg font-bold text-slate-950">{product.assignedUnits}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-2 text-center">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
                              <p className="text-lg font-bold text-slate-950">{product.totalUnits}</p>
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="mt-auto space-y-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 shadow-inner">
                              <div className="flex items-center justify-between">
                                <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${mode === "in" ? "text-emerald-600" : "text-amber-600"}`}>
                                  {mode === "in" ? <PackagePlus className="h-3.5 w-3.5" /> : <PackageMinus className="h-3.5 w-3.5" />}
                                  {mode === "in" ? "Nueva entrada" : "Nueva salida"}
                                </span>
                                <button onClick={(e) => { e.stopPropagation(); setMode(null); }} className="text-[10px] font-bold uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
                              </div>

                              {mode === "in" ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Cant.</label>
                                      <input type="number" min="1" value={inForm.quantity} onChange={(e) => setInForm(prev => ({ ...prev, quantity: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20" />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Fecha</label>
                                      <input type="date" value={inForm.movementDate} onChange={(e) => setInForm(prev => ({ ...prev, movementDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-blue/20" />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Proveedor</label>
                                    <input value={inForm.provider} onChange={(e) => setInForm(prev => ({ ...prev, provider: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20" placeholder="Nombre del proveedor" />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center ml-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Nº de Serie</label>
                                      <span className="text-[10px] font-bold text-brand-blue">{inSerialCount} / {inForm.quantity}</span>
                                    </div>
                                    <textarea value={inForm.serialsText} onChange={(e) => setInForm(prev => ({ ...prev, serialsText: e.target.value }))} rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20" placeholder="Un Nº de Serie por línea" />
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); void submitMovement("in"); }} disabled={submitting} className="w-full rounded-xl bg-brand-blue py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-blue/20 hover:bg-brand-blue/90 disabled:opacity-50">Confirmar entrada</button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Cant.</label>
                                      <input type="number" min="1" value={outForm.quantity} onChange={(e) => setOutForm(prev => ({ ...prev, quantity: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20" />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Fecha</label>
                                      <input type="date" value={outForm.movementDate} onChange={(e) => setOutForm(prev => ({ ...prev, movementDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-slate-900/20" />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Destinatario</label>
                                    <input value={outForm.recipient} onChange={(e) => setOutForm(prev => ({ ...prev, recipient: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20" placeholder="Persona o equipo" />
                                  </div>
                                  
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center ml-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Seleccionar Nº de Serie</label>
                                      <span className="text-[10px] font-bold text-amber-600">{outSerialCount} / {outForm.quantity}</span>
                                    </div>
                                    <textarea value={outForm.serialsText} onChange={(e) => setOutForm(prev => ({ ...prev, serialsText: e.target.value }))} rows={2} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20" placeholder="Nº de Serie seleccionado" />
                                    
                                    {detail?.availableSerials.length ? (
                                      <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-white p-2 ring-1 ring-slate-200 mt-1">
                                        {detail.availableSerials.map(unit => (
                                          <button
                                            key={unit.serialNumber}
                                            onClick={(e) => { e.stopPropagation(); appendOutgoingSerial(unit.serialNumber); }}
                                            className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${outForm.serialsText.includes(unit.serialNumber) ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                          >
                                            {unit.serialNumber}
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-slate-400 text-center py-2">No hay Nº de Serie disponibles</p>
                                    )}
                                  </div>

                                  <button onClick={(e) => { e.stopPropagation(); void submitMovement("out"); }} disabled={submitting} className="w-full rounded-xl bg-slate-950 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-950/20 hover:bg-slate-800 disabled:opacity-50">Confirmar salida</button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                              <button
                                onClick={(e) => { e.stopPropagation(); activateProduct(product.slug, "in"); }}
                                className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue/10 py-2.5 text-xs font-bold text-brand-blue transition hover:bg-brand-blue hover:text-white shadow-sm"
                              >
                                <PackagePlus className="h-3.5 w-3.5" />
                                Añadir
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); activateProduct(product.slug, "out"); }}
                                className="flex items-center justify-center gap-2 rounded-xl bg-slate-950/5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-950 hover:text-white shadow-sm"
                              >
                                <PackageMinus className="h-3.5 w-3.5" />
                                Restar
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!filteredProducts.length ? (
                  <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
                    <p className="text-base font-semibold text-slate-900">No hay productos que coincidan con la búsqueda</p>
                    <p className="mt-2 text-sm text-slate-500">Prueba con otro nombre, SKU o etiqueta para localizar el producto más rápido.</p>
                  </div>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-[1.75rem] bg-slate-950 text-white shadow-2xl shadow-slate-950/30">
                <div className="border-b border-white/10 px-5 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Histórico global</p>
                      <h3 className="mt-2 text-2xl font-bold">Movimientos recientes</h3>
                      <p className="mt-2 text-sm text-slate-300">Recupera el histórico inferior con filtros por tipo, búsqueda y acceso directo al producto.</p>
                    </div>
                    {loadingMovements ? (
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
                        Actualizando...
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        value={movementSearch}
                        onChange={(event) => setMovementSearch(event.target.value)}
                        placeholder="Buscar por producto, SKU, Nº de Serie, contacto o estado"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-4 focus:ring-cyan-300/10"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: "all", label: "Todo" },
                        { value: "in", label: "Entradas" },
                        { value: "out", label: "Salidas" },
                      ] as const).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setMovementFilter(option.value)}
                          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                            movementFilter === option.value
                              ? "bg-white text-slate-950"
                              : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Entradas visibles</p>
                      <p className="mt-2 text-2xl font-bold text-white">{filteredMovementStats.entries}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Salidas visibles</p>
                      <p className="mt-2 text-2xl font-bold text-white">{filteredMovementStats.exits}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Con estado disponible</p>
                      <p className="mt-2 text-2xl font-bold text-white">{filteredMovementStats.available}</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden">
                  {loadingMovements ? <div className="px-5 py-6 text-sm text-slate-300">Cargando historial de movimientos...</div> : null}
                  {!loadingMovements && filteredMovements.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-[1180px] text-left text-sm">
                        <thead className="bg-slate-900 text-xs uppercase tracking-[0.18em] text-slate-300">
                          <tr>
                            <th className="sticky left-0 z-10 bg-slate-900 px-4 py-4 font-semibold">Fecha mov.</th>
                            <th className="px-4 py-4 font-semibold">Registro</th>
                            <th className="px-4 py-4 font-semibold">Producto</th>
                            <th className="px-4 py-4 font-semibold">SKU</th>
                            <th className="px-4 py-4 font-semibold">Tipo</th>
                            <th className="px-4 py-4 font-semibold">Nº de Serie</th>
                            <th className="px-4 py-4 font-semibold">Proveedor / destinatario</th>
                            <th className="px-4 py-4 font-semibold">Estado actual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMovements.map((movement) => (
                            <tr
                              key={movement.id}
                              className="border-t border-white/8 text-slate-100 odd:bg-white/[0.02] even:bg-transparent hover:bg-white/[0.05]"
                            >
                              <td className="sticky left-0 z-[1] bg-slate-950 px-4 py-4 whitespace-nowrap font-semibold">
                                {formatDate(movement.movementDate)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-slate-300">{formatDateTime(movement.createdAt)}</td>
                              <td className="px-4 py-4">
                                <button
                                  type="button"
                                  onClick={() => activateProduct(movement.productSlug, movement.type)}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                                >
                                  <span className="block font-semibold text-white">{movement.productName}</span>
                                  <span className="mt-1 block text-xs text-slate-300">Abrir producto</span>
                                </button>
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-slate-300">{movement.productSku}</td>
                              <td className="whitespace-nowrap px-4 py-4">
                                <span
                                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                    movement.type === "in" ? "bg-cyan-300 text-slate-950" : "bg-white text-slate-950"
                                  }`}
                                >
                                  {movement.type === "in" ? "Entrada" : "Salida"}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 font-semibold text-white">{movement.serialNumber}</td>
                              <td className="px-4 py-4 text-slate-300">{movement.partnerName}</td>
                              <td className="whitespace-nowrap px-4 py-4">
                                <span
                                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                    movement.unitStatus === "available"
                                      ? "bg-emerald-400/20 text-emerald-200"
                                      : "bg-amber-400/20 text-amber-200"
                                  }`}
                                >
                                  {movement.unitStatus === "available" ? "Disponible" : "Asignada"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {!loadingMovements && !filteredMovements.length ? (
                    <div className="px-5 py-10 text-center">
                      <p className="text-base font-semibold text-white">No hay movimientos para los filtros actuales</p>
                      <p className="mt-2 text-sm text-slate-300">Ajusta la búsqueda o cambia el filtro para recuperar registros del histórico.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
