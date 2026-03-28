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
  serialNumber: string;
  partnerName: string;
  movementDate: string;
  createdAt: string;
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"in" | "out">("in");
  const [inForm, setInForm] = useState({ quantity: "1", provider: "", movementDate: today(), serialsText: "" });
  const [outForm, setOutForm] = useState({ quantity: "1", recipient: "", movementDate: today(), serialsText: "" });

  const selectedProduct = useMemo(
    () => products.find((product) => product.slug === activeSlug) ?? null,
    [products, activeSlug]
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

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (isAuthenticated && activeSlug) {
      void loadDetail(activeSlug);
    }
  }, [activeSlug, isAuthenticated, loadDetail]);

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
      await loadProducts(activeSlug);
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
    setActiveSlug(null);
    setMessage("");
    setError("");
    setLoginError("");
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
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/92 shadow-2xl shadow-slate-950/30">
        <header className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <Image src="/logo.svg" alt="Logo" width={96} height={72} priority className="h-auto w-20 rounded-3xl bg-slate-50 p-2" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">Gestión de material IT</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Stock visible y movimientos por serie</h1>
              <p className="mt-2 text-sm text-slate-500">DB {databaseMode === "remote" ? "remota" : "local"} - {products.length} productos visibles</p>
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
                <p className="text-sm text-slate-500">Haz click en cualquier tarjeta para registrar entradas o salidas.</p>
              </div>
              {loadingProducts ? <span className="text-sm text-brand-blue">Actualizando...</span> : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const isActive = product.slug === activeSlug;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setActiveSlug(product.slug)}
                    className={`rounded-[1.75rem] border p-5 text-left transition ${isActive ? "border-brand-blue bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-900 hover:border-brand-blue/30 hover:bg-white"}`}
                  >
                    <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${isActive ? "text-cyan-300" : "text-brand-blue"}`}>{product.sku}</p>
                    <h3 className="mt-2 text-xl font-semibold">{product.name}</h3>
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
                    <p className={`mt-4 text-xs ${isActive ? "text-slate-300" : "text-slate-400"}`}>Ultimo movimiento: {formatDate(product.lastMovementAt)}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 shadow-inner shadow-white">
            {selectedProduct ? (
              <>
                <h2 className="text-2xl font-bold text-slate-950">{selectedProduct.name}</h2>
                <p className="mt-2 text-sm text-slate-500">{selectedProduct.description}</p>
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
                          <div key={unit.serialNumber} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                            <p className="font-semibold text-slate-900">{unit.serialNumber}</p>
                            <p className="mt-1 text-xs text-slate-500">Proveedor: {unit.provider || "Sin dato"}</p>
                            <p className="mt-1 text-xs text-slate-500">Entrada: {formatDate(unit.receivedDate)}</p>
                          </div>
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
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Ultimos movimientos</h3>
                  {loadingDetail ? <p className="text-sm text-slate-500">Cargando detalle...</p> : null}
                  {!loadingDetail && detail?.recentMovements.length ? (
                    <div className="space-y-3">
                      {detail.recentMovements.map((movement) => (
                        <div key={movement.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">{movement.type === "in" ? "Entrada" : "Salida"} - {movement.serialNumber}</p>
                          <p className="mt-1 text-xs text-slate-500">{movement.partnerName}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(movement.movementDate)}</p>
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
      </div>
    </div>
  );
}
