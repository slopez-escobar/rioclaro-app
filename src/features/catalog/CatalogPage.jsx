import { useEffect, useMemo, useState } from "react";
import { useDocumentTitle } from "../../shared/hooks/useDocumentTitle.js";
import { useSearchParams } from "react-router-dom";
import Layout from "../../shared/ui/Layout.jsx";
import { formatMXN } from "../../shared/utils/format.js";
import { listExistencias } from "../../data/repositories/existenciasRepository.js";
import { getProducto } from "../../data/repositories/catalogoRepository.js";
import { listSucursales } from "../../data/repositories/sucursalesRepository.js";
import {
  getUnificacion,
  searchUnificacionProducts,
} from "../../data/repositories/unificacionRepository.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { AfterTable, BeforeTable, ReviewTable } from "./components/CatalogTables.jsx";
import "./catalog-page.css";

const INITIAL_PRODUCT = "CLO-1L";

export default function CatalogPage() {
  useDocumentTitle("Catálogo");
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const queryKey = searchParams.get("clave");
  const [report, setReport] = useState(null);
  const [branchNames, setBranchNames] = useState({});
  const [selectedKey, setSelectedKey] = useState(INITIAL_PRODUCT);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [visibleStock, setVisibleStock] = useState([]);
  const [searchText, setSearchText] = useState("Cloro 1 litro");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!queryKey) {
      setSelectedKey(INITIAL_PRODUCT);
      setSearchText("Cloro 1 litro");
      return () => { active = false; };
    }
    getProducto(queryKey).then((product) => {
      if (!active) return;
      if (product) {
        setSelectedKey(product.claveProducto);
        setSearchText(product.nombre);
      } else {
        setSelectedKey(INITIAL_PRODUCT);
        setSearchText("Cloro 1 litro");
      }
    }).catch((loadError) => {
      if (active) setError("No se pudo seleccionar el producto.");
    });
    return () => { active = false; };
  }, [queryKey]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getUnificacion(session),
      listSucursales(),
    ]).then(([unification, branches]) => {
      if (!active) return;
      setReport(unification);
      setBranchNames(Object.fromEntries(branches.map((branch) => [branch.id, branch.nombre])));
    }).catch((loadError) => {
      if (active) setError("No se pudo cargar la unificación del catálogo.");
    });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    let active = true;
    if (!session) return () => { active = false; };
    listExistencias(session, { claveProducto: selectedKey }).then((stock) => {
      if (active) setVisibleStock(stock);
    }).catch((loadError) => {
      if (active) setError("No se pudieron cargar las existencias.");
    });
    getProducto(selectedKey).then((product) => {
      if (active) setSelectedProduct(product);
    }).catch((loadError) => {
      if (active) setError("No se pudo cargar el producto.");
    });
    return () => { active = false; };
  }, [selectedKey, session]);

  useEffect(() => {
    let active = true;
    searchUnificacionProducts(searchText, session).then((matches) => {
      if (active) setSuggestions(matches);
    }).catch((loadError) => {
      if (active) setError("No se pudo buscar en la unificación.");
    });
    return () => { active = false; };
  }, [searchText, session]);

  const selectedRecord = useMemo(
    () => report?.productos.find((product) => product.claveProducto === selectedKey) || null,
    [report, selectedKey],
  );
  const summary = report?.resumen;

  function chooseProduct(product) {
    setSelectedKey(product.claveProducto);
    setSearchText(product.nombreCatalogo);
    setShowSuggestions(false);
  }

  return (
    <Layout titulo="Catálogo unificado">
      <div className="catalog-page">
        {error ? <p className="catalog-error" role="alert">{error}</p> : null}
        {!report || !selectedRecord || !selectedProduct ? (
          <p className="catalog-loading" role="status">Cargando catálogo y existencias…</p>
        ) : (
          <>
            <section className="catalog-summary" aria-label="Resumen de la unificación">
              <article className="catalog-metric">
                <span>Filas leídas</span>
                <strong>{summary.filasTotales}</strong>
              </article>
              <article className="catalog-metric">
                <span>Resueltas automáticamente</span>
                <strong>{summary.porcentajeResueltas}%</strong>
              </article>
              <article className="catalog-metric">
                <span>En revisión</span>
                <strong>{summary.enRevision}</strong>
              </article>
              <article className="catalog-metric">
                <span>Productos con 2+ nombres</span>
                <strong>{summary.productosConAlMenos2Nombres}</strong>
              </article>
              <article className="catalog-metric">
                <span>Productos con precios distintos</span>
                <strong>{summary.productosConPreciosPublicadosDistintos}</strong>
              </article>
            </section>

            <section className="catalog-panel" aria-labelledby="catalog-product-heading">
              <h2 id="catalog-product-heading">Seleccionar producto</h2>
              <label htmlFor="catalog-search">Buscar por clave o nombre publicado</label>
              <input
                id="catalog-search"
                type="search"
                value={searchText}
                autoComplete="off"
                aria-controls="catalog-suggestions"
                aria-expanded={showSuggestions}
                onFocus={() => setShowSuggestions(true)}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setShowSuggestions(true);
                }}
              />
              {showSuggestions ? (
                <ul id="catalog-suggestions" className="catalog-suggestions" aria-label="Productos coincidentes">
                  {suggestions.length ? suggestions.map((product) => (
                    <li key={product.claveProducto} className={product.claveProducto === selectedKey ? "catalog-current-result" : ""}>
                      <button type="button" onClick={() => chooseProduct(product)}>
                        <strong>{product.nombreCatalogo}</strong>
                        <span>{product.claveProducto}</span>
                      </button>
                    </li>
                  )) : <li className="catalog-no-results">No hay productos coincidentes.</li>}
                </ul>
              ) : null}
              <div className="catalog-selected" aria-live="polite">
                <strong>{selectedProduct.nombre}</strong>
                <span>{selectedProduct.claveProducto}</span>
                <span>Precio de lista sin IVA: {formatMXN(selectedProduct.precioListaMXN)}</span>
              </div>
            </section>

            <section className="catalog-panel">
              <BeforeTable
                report={report}
                product={selectedRecord}
                branchNames={branchNames}
              />
            </section>

            <section className="catalog-panel">
              <AfterTable
                existencias={visibleStock}
                branchNames={branchNames}
                product={selectedProduct}
              />
            </section>

            {report.puedeVerRevision ? (
              <section className="catalog-panel">
                <ReviewTable rows={report.revision} branchNames={branchNames} />
              </section>
            ) : null}
          </>
        )}
      </div>
    </Layout>
  );
}
