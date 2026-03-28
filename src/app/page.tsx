"use client";

import Image from "next/image";
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
  const [mode, setMode] = useState<"in" | "out">("in");
  const [inForm, setInForm] = useState({ quantity: "1", provider: "", movementDate: today(), serialsText: "" });
  const [outForm, setOutForm] = useState({ quantity: "1", recipient: "", movementDate: today(), serialsText: "" });

  const selectedProduct = useMemo(
    () => products.find((product) => product.slug === activeSlug) ?? null,
    [products, activeSlug]
  );

  const inSerialCount = useMemo(() => parseSerials(inForm.serialsText).length, [inForm.serialsText]);
  const outSerialCount = useMemo(() => parseSerials(outForm.serialsText).length, [outForm.serialsText]);

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
    }
  };

  const appendOutgoingSerial = (serialNumber: string) => {
    setMode("out");
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md rounded-[2rem] border border-slate-100 bg-white p-8 shadow-2xl shadow-slate-200/80">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <Image src="/logo.svg" alt="Logo" width={180} height={100} priority className="h-auto w-44" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Acceso restringido</h1>
            <p className="mt-2 text-sm text-slate-500">Introduce tus credenciales para continuar</p>
          </div>
          <form onSubmit={submitLogin} className="space-y-5">
            <input value={loginUser} onChange={(event) => setLoginUser(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" placeholder="Usuario" required />
            <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" placeholder="Contraseña" required />
            {loginError ? <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">{loginError}</div> : null}
            <button type="submit" disabled={submitting} className="w-full rounded-2xl bg-brand-blue px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-blue/20 disabled:opacity-60">Iniciar sesión</button>
          </form>
          <p className="mt-8 text-center text-xs text-slate-400">Dept. Sistemas 2026</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,193,222,0.24),_transparent_32%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/92 shadow-2xl shadow-slate-950/30">
        <header className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <Image src="/logo.svg" alt="Logo" width={96} height={72} priority className="h-auto w-20 rounded-3xl bg-slate-50 p-2" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">Gestión de material IT</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Stock visible, fotos y registro completo</h1>
              <p className="mt-2 text-sm text-slate-500">DB {databaseMode === "remote" ? "remota" : "local"} - {products.length} productos visibles - {movements.length} movimientos registrados</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Cerrar sesion</button>
        </header>
        {message ? <div className="mx-6 mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 lg:mx-8">{message}</div> : null}
        {error ? <div className="mx-6 mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 lg:mx-8">{error}</div> : null}

        <main className="grid gap-8 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-8">
          <section>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Catalogo operativo</h2>
                <p className="text-sm text-slate-500">Cada producto incluye su imagen, stock visible y accesos rápidos para sumar o restar unidades.</p>
              </div>
              {loadingProducts ? <span className="text-sm text-brand-blue">Actualizando...</span> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const isActive = product.slug === activeSlug;
                return (
                  <article
                    key={product.id}
                    onClick={() => activateProduct(product.slug)}
                    className={`cursor-pointer rounded-[1.75rem] border p-5 text-left transition ${isActive ? "border-brand-blue bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900 hover:border-brand-blue/30 hover:bg-white"}`}
                  >
                    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10">
                      <div className={`absolute inset-x-0 top-0 h-16 ${isActive ? "bg-cyan-300/20" : "bg-brand-blue/10"}`} />
                      <Image
                        src={product.imagePath}
                        alt={product.name}
                        width={480}
                        height={280}
                        className="h-44 w-full object-cover"
                      />
                    </div>
                    <div className="mt-4 flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${isActive ? "text-cyan-300" : "text-brand-blue"}`}>{product.sku}</p>
                        <h3 className="mt-2 text-xl font-semibold">{product.name}</h3>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${isActive ? "bg-white/10 text-cyan-200" : "bg-brand-blue/10 text-brand-blue"}`}>{product.highlight}</span>
                    </div>
                    <p className={`mt-2 text-sm ${isActive ? "text-slate-300" : "text-slate-500"}`}>{product.description}</p>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div className={`rounded-2xl px-3 py-3 ${isActive ? "bg-white/10" : "bg-white"}`}>
                        <p className={`text-xs uppercase tracking-[0.2em] ${isActive ? "text-slate-300" : "text-slate-400"}`}>Disponibles</p>
                        <p className="mt-2 text-3xl font-bold">{product.availableUnits}</p>
                      </div>
                      <div className={`rounded-2xl px-3 py-3 ${isActive ? "bg-white/10" : "bg-white"}`}>
                        <p className={`text-xs uppercase tracking-[0.2em] ${isActive ? "text-slate-300" : "text-slate-400"}`}>Asignadas</p>
                        <p className="mt-2 text-3xl font-bold">{product.assignedUnits}</p>
                      </div>
                      <div className={`rounded-2xl px-3 py-3 ${isActive ? "bg-white/10" : "bg-white"}`}>
                        <p className={`text-xs uppercase tracking-[0.2em] ${isActive ? "text-slate-300" : "text-slate-400"}`}>Total</p>
                        <p className="mt-2 text-3xl font-bold">{product.totalUnits}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          activateProduct(product.slug, "in");
                        }}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold ${isActive ? "bg-cyan-300 text-slate-950" : "bg-brand-blue text-white"}`}
                      >
                        Añadir unidades
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          activateProduct(product.slug, "out");
                        }}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold ${isActive ? "bg-white text-slate-950" : "bg-slate-950 text-white"}`}
                      >
                        Restar unidades
                      </button>
                    </div>
                    <p className={`mt-4 text-xs ${isActive ? "text-slate-300" : "text-slate-400"}`}>Ultimo movimiento: {formatDate(product.lastMovementAt)}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 shadow-inner shadow-white">
            {selectedProduct ? (
              <>
                <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm">
                  <Image
                    src={selectedProduct.imagePath}
                    alt={selectedProduct.name}
                    width={900}
                    height={420}
                    className="h-56 w-full object-cover"
                  />
                </div>
                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">{selectedProduct.sku}</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-950">{selectedProduct.name}</h2>
                    <p className="mt-2 text-sm text-slate-500">{selectedProduct.description}</p>
                  </div>
                  <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-blue">{selectedProduct.highlight}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white px-4 py-4 shadow-sm"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Disponibles</p><p className="mt-2 text-3xl font-bold text-slate-950">{detail?.availableSerials.length ?? selectedProduct.availableUnits}</p></div>
                  <div className="rounded-2xl bg-white px-4 py-4 shadow-sm"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Asignadas</p><p className="mt-2 text-3xl font-bold text-slate-950">{detail?.assignedSerials.length ?? selectedProduct.assignedUnits}</p></div>
                  <div className="rounded-2xl bg-white px-4 py-4 shadow-sm"><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total</p><p className="mt-2 text-3xl font-bold text-slate-950">{detail?.totalUnits ?? selectedProduct.totalUnits}</p></div>
                </div>

                <div className="mt-5 flex rounded-2xl border border-slate-200 bg-white p-1">
                  <button type="button" onClick={() => setMode("in")} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ${mode === "in" ? "bg-brand-blue text-white" : "text-slate-600"}`}>Anadir unidades</button>
                  <button type="button" onClick={() => setMode("out")} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ${mode === "out" ? "bg-slate-950 text-white" : "text-slate-600"}`}>Restar unidades</button>
                </div>

                {mode === "in" ? (
                  <div className="mt-5 space-y-4 rounded-[1.5rem] bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-brand-blue/5 px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">Entrada de stock</p>
                        <p className="mt-1 text-sm text-slate-500">Añade unidades disponibles con proveedor, fecha y números de serie.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Series cargadas</p>
                        <p className="mt-1 text-2xl font-bold text-brand-blue">{inSerialCount}</p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input type="number" min="1" value={inForm.quantity} onChange={(event) => setInForm((current) => ({ ...current, quantity: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" placeholder="Cantidad" />
                      <input type="date" value={inForm.movementDate} onChange={(event) => setInForm((current) => ({ ...current, movementDate: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" />
                    </div>
                    <input value={inForm.provider} onChange={(event) => setInForm((current) => ({ ...current, provider: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" placeholder="Proveedor" />
                    <textarea value={inForm.serialsText} onChange={(event) => setInForm((current) => ({ ...current, serialsText: event.target.value }))} rows={5} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10" placeholder="Un numero de serie por linea o separados por coma" />
                    <button type="button" onClick={() => void submitMovement("in")} disabled={submitting} className="w-full rounded-2xl bg-brand-blue px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60">Guardar entrada</button>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4 rounded-[1.5rem] bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-950/5 px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-950">Salida de stock</p>
                        <p className="mt-1 text-sm text-slate-500">Resta unidades disponibles indicando destinatario y las series a entregar.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Series preparadas</p>
                        <p className="mt-1 text-2xl font-bold text-slate-950">{outSerialCount}</p>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input type="number" min="1" value={outForm.quantity} onChange={(event) => setOutForm((current) => ({ ...current, quantity: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10" placeholder="Cantidad" />
                      <input type="date" value={outForm.movementDate} onChange={(event) => setOutForm((current) => ({ ...current, movementDate: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10" />
                    </div>
                    <input value={outForm.recipient} onChange={(event) => setOutForm((current) => ({ ...current, recipient: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10" placeholder="Destinatario" />
                    <textarea value={outForm.serialsText} onChange={(event) => setOutForm((current) => ({ ...current, serialsText: event.target.value }))} rows={5} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10" placeholder="Series disponibles para salida" />
                    <button type="button" onClick={() => void submitMovement("out")} disabled={submitting} className="w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60">Guardar salida</button>
                  </div>
                )}

                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Series disponibles</h3>
                    {loadingDetail ? <p className="text-sm text-slate-500">Cargando detalle...</p> : null}
                    {!loadingDetail && detail?.availableSerials.length ? (
                      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                        {detail.availableSerials.map((unit) => (
                          <button
                            key={unit.serialNumber}
                            type="button"
                            onClick={() => appendOutgoingSerial(unit.serialNumber)}
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-slate-900">{unit.serialNumber}</p>
                              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">Preparar salida</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">Proveedor: {unit.provider || "Sin dato"}</p>
                            <p className="mt-1 text-xs text-slate-500">Entrada: {formatDate(unit.receivedDate)}</p>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {!loadingDetail && !detail?.availableSerials.length ? <p className="text-sm text-slate-500">No hay unidades disponibles.</p> : null}
                  </div>

                  <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Series asignadas</h3>
                    {loadingDetail ? <p className="text-sm text-slate-500">Cargando detalle...</p> : null}
                    {!loadingDetail && detail?.assignedSerials.length ? (
                      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                        {detail.assignedSerials.map((unit) => (
                          <div key={unit.serialNumber} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                            <p className="font-semibold text-slate-900">{unit.serialNumber}</p>
                            <p className="mt-1 text-xs text-slate-500">Destinatario: {unit.recipient || "Sin dato"}</p>
                            <p className="mt-1 text-xs text-slate-500">Envio: {formatDate(unit.shippedDate)}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!loadingDetail && !detail?.assignedSerials.length ? <p className="text-sm text-slate-500">No hay unidades asignadas.</p> : null}
                  </div>
                </div>

                <div className="mt-6 rounded-[1.5rem] bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Ultimos movimientos del producto</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{detail?.recentMovements.length ?? 0} registros</span>
                  </div>
                  {loadingDetail ? <p className="text-sm text-slate-500">Cargando detalle...</p> : null}
                  {!loadingDetail && detail?.recentMovements.length ? (
                    <div className="space-y-3">
                      {detail.recentMovements.map((movement) => (
                        <div key={movement.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">{movement.type === "in" ? "Entrada" : "Salida"} - {movement.serialNumber}</p>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${movement.type === "in" ? "bg-brand-blue/10 text-brand-blue" : "bg-slate-900 text-white"}`}>{movement.unitStatus === "available" ? "Disponible" : "Asignada"}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{movement.partnerName}</p>
                          <p className="mt-1 text-xs text-slate-500">Fecha movimiento: {formatDate(movement.movementDate)}</p>
                          <p className="mt-1 text-xs text-slate-500">Registro: {formatDateTime(movement.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!loadingDetail && !detail?.recentMovements.length ? <p className="text-sm text-slate-500">Aun no hay movimientos para este producto.</p> : null}
                </div>
              </>
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-white text-sm text-slate-500">
                Selecciona un producto para ver sus existencias y sus movimientos.
              </div>
            )}
          </aside>
        </main>

        <section className="border-t border-slate-200 bg-slate-950 px-6 py-6 text-white lg:px-8 lg:py-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Registro horizontal</p>
              <h2 className="mt-2 text-2xl font-bold">Historial completo de movimientos</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">Cada operación queda reflejada abajo con producto, SKU, tipo, serie, proveedor o destinatario, fecha del movimiento, momento de registro y estado actual.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              {loadingMovements ? "Actualizando historial..." : `${movements.length} movimientos visibles`}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-900/80">
            {loadingMovements ? <div className="px-5 py-6 text-sm text-slate-300">Cargando historial de movimientos...</div> : null}
            {!loadingMovements && movements.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-300">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Fecha mov.</th>
                      <th className="px-4 py-4 font-semibold">Registro</th>
                      <th className="px-4 py-4 font-semibold">Producto</th>
                      <th className="px-4 py-4 font-semibold">SKU</th>
                      <th className="px-4 py-4 font-semibold">Tipo</th>
                      <th className="px-4 py-4 font-semibold">Serie</th>
                      <th className="px-4 py-4 font-semibold">Proveedor / destinatario</th>
                      <th className="px-4 py-4 font-semibold">Estado actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => (
                      <tr key={movement.id} className="border-t border-white/8 text-slate-100">
                        <td className="px-4 py-4 whitespace-nowrap">{formatDate(movement.movementDate)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-300">{formatDateTime(movement.createdAt)}</td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => activateProduct(movement.productSlug, movement.type)}
                            className="rounded-xl bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                          >
                            <span className="block font-semibold text-white">{movement.productName}</span>
                            <span className="mt-1 block text-xs text-slate-300">Abrir producto</span>
                          </button>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-300">{movement.productSku}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${movement.type === "in" ? "bg-cyan-300 text-slate-950" : "bg-white text-slate-950"}`}>
                            {movement.type === "in" ? "Entrada" : "Salida"}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold whitespace-nowrap">{movement.serialNumber}</td>
                        <td className="px-4 py-4">{movement.partnerName}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${movement.unitStatus === "available" ? "bg-emerald-400/20 text-emerald-200" : "bg-amber-400/20 text-amber-200"}`}>
                            {movement.unitStatus === "available" ? "Disponible" : "Asignada"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {!loadingMovements && !movements.length ? <div className="px-5 py-6 text-sm text-slate-300">Todavía no hay movimientos registrados.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
