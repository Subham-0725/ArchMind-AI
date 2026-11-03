// client/src/components/project/api/ApiExplorerTab.jsx
//
// Root coordinator tab for API Route Explorer, Route Details, and Sequence Diagrams.
// Manages server-side filtering, debouncing, monotonic request race condition guards,
// analysis versioning, and line-level code citations.

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  fetchProjectApiRoutes,
  fetchProjectApiRouteDetail,
  fetchRouteSequenceDiagram,
} from "../../../services/projectService";
import RouteSummaryBar from "./RouteSummaryBar";
import RouteFilters from "./RouteFilters";
import RouteList from "./RouteList";
import RouteDetailCard from "./RouteDetailCard";
import SequenceDiagramViewer from "./SequenceDiagramViewer";

export default function ApiExplorerTab({ project }) {
  const { getToken } = useAuth();
  const projectId = project?.id || project?._id;
  const analysisVersion = project?.analysisVersion || 1;

  // Route List & Summary State
  const [routes, setRoutes] = useState([]);
  const [summary, setSummary] = useState({});
  const [frameworks, setFrameworks] = useState([]);
  const [totalRoutes, setTotalRoutes] = useState(0);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [routesError, setRoutesError] = useState(null);

  // Filter State
  const [filters, setFilters] = useState({
    method: "ALL",
    framework: "ALL",
    auth: "ALL",
    search: "",
  });

  // Selected Route & View Mode State
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [activeView, setActiveView] = useState("details"); // "details" | "sequence"

  // Route Detail State
  const [routeDetail, setRouteDetail] = useState(null);
  const [detailCitation, setDetailCitation] = useState(null);
  const [isDetailValid, setIsDetailValid] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Sequence Diagram State
  const [sequenceData, setSequenceData] = useState(null);
  const [isLoadingSequence, setIsLoadingSequence] = useState(false);
  const [sequenceError, setSequenceError] = useState(null);

  // Monotonic race condition guards
  const activeDetailRouteIdRef = useRef(null);
  const activeSequenceRouteIdRef = useRef(null);
  const routesAbortRef = useRef(null);
  const detailAbortRef = useRef(null);
  const sequenceAbortRef = useRef(null);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      routesAbortRef.current?.abort();
      detailAbortRef.current?.abort();
      sequenceAbortRef.current?.abort();
    };
  }, []);

  // Retry triggers
  const [routesRetry, setRoutesRetry] = useState(0);
  const [sequenceRetry, setSequenceRetry] = useState(0);

  // ── 1. Fetch Route List based on filters ─────────────────────────────────
  useEffect(() => {
    if (!projectId) return;

    routesAbortRef.current?.abort();
    const controller = new AbortController();
    routesAbortRef.current = controller;
    let isCancelled = false;

    async function fetchRoutes() {
      try {
        const token = await getToken();
        if (!token || isCancelled) return;

        setIsLoadingRoutes(true);
        setRoutesError(null);

        // Build query params
        const params = {};
        if (filters.method && filters.method !== "ALL") params.method = filters.method;
        if (filters.framework && filters.framework !== "ALL") params.framework = filters.framework;
        if (filters.auth && filters.auth !== "ALL") params.auth = filters.auth;
        if (filters.search && filters.search.trim()) params.search = filters.search.trim();

        const data = await fetchProjectApiRoutes(token, projectId, params, controller.signal);

        if (!isCancelled) {
          const fetchedRoutes = data?.routes || [];
          setRoutes(fetchedRoutes);
          setSummary(data?.summary || {});
          setFrameworks(data?.frameworks || []);
          setTotalRoutes(data?.totalRoutes ?? fetchedRoutes.length);

          // Auto-select first route if current selection is invalid or null
          if (fetchedRoutes.length > 0) {
            setSelectedRouteId((curr) => {
              const stillExists = fetchedRoutes.some((r) => r.routeId === curr);
              return stillExists ? curr : fetchedRoutes[0].routeId;
            });
          } else {
            setSelectedRouteId(null);
          }
        }
      } catch (err) {
        if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
        if (!isCancelled) {
          console.error("[ApiExplorerTab] Failed to fetch routes:", err);
          setRoutesError(err.response?.data?.error || err.message || "Failed to load API routes.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingRoutes(false);
        }
      }
    }

    fetchRoutes();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [projectId, filters, analysisVersion, routesRetry, getToken]);

  // ── 2. Fetch Selected Route Details & Sequence Diagram ───────────────────
  useEffect(() => {
    if (!projectId || !selectedRouteId) {
      return;
    }

    detailAbortRef.current?.abort();
    const detailController = new AbortController();
    detailAbortRef.current = detailController;
    const targetRouteId = selectedRouteId;
    activeDetailRouteIdRef.current = targetRouteId;

    let isCancelled = false;

    async function fetchDetail() {
      try {
        const token = await getToken();
        if (!token || isCancelled) return;

        setIsLoadingDetail(true);
        setDetailError(null);

        const data = await fetchProjectApiRouteDetail(token, projectId, targetRouteId, detailController.signal);

        if (!isCancelled && activeDetailRouteIdRef.current === targetRouteId) {
          setRouteDetail(data?.route || null);
          setDetailCitation(data?.citation || null);
          setIsDetailValid(data?.isValid ?? true);
        }
      } catch (err) {
        if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
        if (!isCancelled && activeDetailRouteIdRef.current === targetRouteId) {
          console.error("[ApiExplorerTab] Failed to fetch route detail:", err);
          setDetailError(err.response?.data?.error || err.message || "Failed to load route details.");
        }
      } finally {
        if (!isCancelled && activeDetailRouteIdRef.current === targetRouteId) {
          setIsLoadingDetail(false);
        }
      }
    }

    fetchDetail();

    // Sequence Diagram (Fetch on-demand when activeView is 'sequence')
    if (activeView === "sequence") {
      sequenceAbortRef.current?.abort();
      const seqController = new AbortController();
      sequenceAbortRef.current = seqController;
      activeSequenceRouteIdRef.current = targetRouteId;

      async function fetchSequence() {
        try {
          const token = await getToken();
          if (!token || isCancelled) return;

          setIsLoadingSequence(true);
          setSequenceError(null);

          const data = await fetchRouteSequenceDiagram(token, projectId, targetRouteId, seqController.signal);

          if (!isCancelled && activeSequenceRouteIdRef.current === targetRouteId) {
            setSequenceData(data || null);
          }
        } catch (err) {
          if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
          if (!isCancelled && activeSequenceRouteIdRef.current === targetRouteId) {
            console.error("[ApiExplorerTab] Failed to load sequence diagram:", err);
            setSequenceError(
              err.response?.data?.error || err.message || "Failed to generate sequence diagram."
            );
          }
        } finally {
          if (!isCancelled && activeSequenceRouteIdRef.current === targetRouteId) {
            setIsLoadingSequence(false);
          }
        }
      }

      fetchSequence();
    }

    return () => {
      isCancelled = true;
      detailController.abort();
      sequenceAbortRef.current?.abort();
    };
  }, [projectId, selectedRouteId, activeView, sequenceRetry, getToken]);

  // Handler for route selection
  const handleSelectRoute = (routeId) => {
    setSelectedRouteId(routeId);
  };

  // Handler to switch to sequence view
  const handleViewSequence = () => {
    setActiveView("sequence");
  };

  // Handler to reset all filters
  const handleResetFilters = () => {
    setFilters({
      method: "ALL",
      framework: "ALL",
      auth: "ALL",
      search: "",
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 p-4 sm:p-6 rounded-xl border border-white/[0.08] bg-[#070c16]/80 backdrop-blur-md min-h-[600px]">
      {/* ── Summary Metrics Bar ────────────────────────────────────────────── */}
      <RouteSummaryBar
        summary={summary}
        frameworks={frameworks}
        totalRoutes={totalRoutes}
      />

      {/* ── Main Two-Column Split (Route List + Filters / Detail View) ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-start">
        {/* Left Column: Filters + Route List (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <RouteFilters
            filters={filters}
            frameworks={frameworks}
            onFilterChange={setFilters}
            onResetFilters={handleResetFilters}
            resultCount={routes.length}
            totalCount={totalRoutes}
          />

          {isLoadingRoutes ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-white/[0.06] bg-white/[0.01] min-h-[250px] text-center">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin mb-3" />
              <p className="text-xs font-mono text-cyan-300">Retrieving API endpoints...</p>
            </div>
          ) : routesError ? (
            <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-red-500/20 bg-red-500/[0.03] text-center">
              <span className="text-red-400 text-lg mb-2">✕</span>
              <p className="text-xs font-mono text-red-400">{routesError}</p>
              <button
                type="button"
                onClick={() => setRoutesRetry((c) => c + 1)}
                className="mt-3 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/25 text-xs font-mono text-red-300 hover:bg-red-500/20 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <RouteList
              routes={routes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={handleSelectRoute}
              onResetFilters={handleResetFilters}
              totalRoutes={totalRoutes}
            />
          )}
        </div>

        {/* Right Column: Route Details OR Sequence Diagram (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col">
          {activeView === "sequence" ? (
            <SequenceDiagramViewer
              diagramData={sequenceData}
              isLoading={isLoadingSequence}
              error={sequenceError}
              onBackToDetails={() => setActiveView("details")}
              onRetry={() => setSequenceRetry((c) => c + 1)}
            />
          ) : (
            <RouteDetailCard
              route={routeDetail}
              citation={detailCitation}
              isValid={isDetailValid}
              isLoading={isLoadingDetail}
              error={detailError}
              onViewSequence={handleViewSequence}
              hasSequence={Boolean(selectedRouteId)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
