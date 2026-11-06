import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

// Standard 32 Adult Teeth (FDI Numbering)
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

// Baby / Primary Teeth (FDI 20)
const BABY_UPPER_RIGHT = [55, 54, 53, 52, 51];
const BABY_UPPER_LEFT = [61, 62, 63, 64, 65];
const BABY_LOWER_RIGHT = [85, 84, 83, 82, 81];
const BABY_LOWER_LEFT = [71, 72, 73, 74, 75];

const ALL_ADULT_ORDER = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT, ...LOWER_LEFT];
const ALL_BABY_ORDER = [...BABY_UPPER_RIGHT, ...BABY_UPPER_LEFT, ...BABY_LOWER_RIGHT, ...BABY_LOWER_LEFT];

const SURFACE_NAMES = {
  B: 'Buccal (Top)',
  L: 'Lingual (Bottom)',
  D: 'Distal (Left)',
  M: 'Mesial (Right)',
  O: 'Occlusal (Center)',
};

// All 15 Existing Tools + 8 Planned Tools
const TOOLS = {
  // EXISTING TOOLS (15 Solid Pills)
  existing_caries: { id: 'existing_caries', category: 'existing', scope: 'surface', code: 'C', label: 'Caries', color: '#ef4444', fill: '#ef4444' },
  existing_missing: { id: 'existing_missing', category: 'existing', scope: 'whole', code: 'X', label: 'Missing', color: '#64748b', fill: '#94a3b8' },
  existing_impacted: { id: 'existing_impacted', category: 'existing', scope: 'whole', code: 'IM', label: 'Impacted', color: '#8b5cf6', fill: '#8b5cf6' },
  existing_root_fragment: { id: 'existing_root_fragment', category: 'existing', scope: 'whole', code: 'RF', label: 'Root fragment', color: '#d97706', fill: '#d97706' },
  existing_fractured: { id: 'existing_fractured', category: 'existing', scope: 'surface', code: 'FX', label: 'Fractured', color: '#ea580c', fill: '#ea580c' },
  existing_mobility: { id: 'existing_mobility', category: 'existing', scope: 'whole', code: 'MO', label: 'Mobility', color: '#eab308', fill: '#eab308' },
  existing_recession: { id: 'existing_recession', category: 'existing', scope: 'surface', code: 'R', label: 'Recession', color: '#e11d48', fill: '#e11d48' },
  existing_filling: { id: 'existing_filling', category: 'existing', scope: 'surface', code: 'F', label: 'Filling', color: '#0284c7', fill: '#0284c7' },
  existing_sealant: { id: 'existing_sealant', category: 'existing', scope: 'surface', code: 'S', label: 'Sealant', color: '#10b981', fill: '#10b981' },
  existing_crown: { id: 'existing_crown', category: 'existing', scope: 'whole', code: 'Cr', label: 'Crown', color: '#0d9488', fill: '#0d9488' },
  existing_veneer: { id: 'existing_veneer', category: 'existing', scope: 'surface', code: 'Ve', label: 'Veneer', color: '#84cc16', fill: '#84cc16' },
  existing_bridge: { id: 'existing_bridge', category: 'existing', scope: 'whole', code: 'Br', label: 'Bridge', color: '#0369a1', fill: '#0369a1' },
  existing_rct: { id: 'existing_rct', category: 'existing', scope: 'whole', code: 'RCT', label: 'Root canal', color: '#6366f1', fill: '#6366f1' },
  existing_extraction: { id: 'existing_extraction', category: 'existing', scope: 'whole', code: 'XT', label: 'Extraction', color: '#dc2626', fill: '#dc2626' },
  existing_implant: { id: 'existing_implant', category: 'existing', scope: 'whole', code: 'IMP', label: 'Implant', color: '#1e293b', fill: '#1e293b' },

  // PLANNED TOOLS (8 Striped Pills)
  planned_filling: { id: 'planned_filling', category: 'planned', scope: 'surface', code: 'F', label: 'Filling', color: '#0284c7', fill: 'url(#pat-stripe-sky)', stripeClass: 'stripe-pill-sky', doneToolId: 'existing_filling' },
  planned_sealant: { id: 'planned_sealant', category: 'planned', scope: 'surface', code: 'S', label: 'Sealant', color: '#10b981', fill: 'url(#pat-stripe-emerald)', stripeClass: 'stripe-pill-emerald', doneToolId: 'existing_sealant' },
  planned_crown: { id: 'planned_crown', category: 'planned', scope: 'whole', code: 'Cr', label: 'Crown', color: '#0d9488', fill: 'url(#pat-stripe-teal)', stripeClass: 'stripe-pill-teal', doneToolId: 'existing_crown' },
  planned_veneer: { id: 'planned_veneer', category: 'planned', scope: 'surface', code: 'Ve', label: 'Veneer', color: '#65a30d', fill: 'url(#pat-stripe-lime)', stripeClass: 'stripe-pill-lime', doneToolId: 'existing_veneer' },
  planned_bridge: { id: 'planned_bridge', category: 'planned', scope: 'whole', code: 'Br', label: 'Bridge', color: '#0369a1', fill: 'url(#pat-stripe-blue)', stripeClass: 'stripe-pill-blue', doneToolId: 'existing_bridge' },
  planned_rct: { id: 'planned_rct', category: 'planned', scope: 'whole', code: 'RCT', label: 'Root canal', color: '#6366f1', fill: 'url(#pat-stripe-indigo)', stripeClass: 'stripe-pill-indigo', doneToolId: 'existing_rct' },
  planned_extraction: { id: 'planned_extraction', category: 'planned', scope: 'whole', code: 'XT', label: 'Extraction', color: '#dc2626', fill: 'url(#pat-stripe-red)', stripeClass: 'stripe-pill-red', doneToolId: 'existing_extraction' },
  planned_implant: { id: 'planned_implant', category: 'planned', scope: 'whole', code: 'IMP', label: 'Implant', color: '#334155', fill: 'url(#pat-stripe-slate)', stripeClass: 'stripe-pill-slate', doneToolId: 'existing_implant' },

  // ERASER
  eraser: { id: 'eraser', category: 'utility', scope: 'whole', code: '⌫', label: 'Eraser', color: '#475569', fill: '#e2e8f0' },
};

const EXISTING_TRAY_ORDER = [
  'existing_caries', 'existing_missing', 'existing_impacted', 'existing_root_fragment',
  'existing_fractured', 'existing_mobility', 'existing_recession', 'existing_filling',
  'existing_sealant', 'existing_crown', 'existing_veneer', 'existing_bridge',
  'existing_rct', 'existing_extraction', 'existing_implant',
];

const PLANNED_TRAY_ORDER = [
  'planned_filling', 'planned_sealant', 'planned_crown', 'planned_veneer',
  'planned_bridge', 'planned_rct', 'planned_extraction', 'planned_implant',
];

// Helper to map DB row (procedure_name + status) back to our frontend tool ID
function resolveToolIdFromDb(procedureName, status) {
  const cleanName = String(procedureName || '').trim().toLowerCase();
  const targetCategory = status === 'Planned' ? 'planned' : 'existing';

  const match = Object.values(TOOLS).find(
    (t) => t.category === targetCategory && t.label.toLowerCase() === cleanName
  );
  if (match) return match.id;

  const fallback = Object.values(TOOLS).find((t) => t.label.toLowerCase() === cleanName);
  return fallback ? fallback.id : targetCategory === 'planned' ? 'planned_filling' : 'existing_caries';
}

const formatPeso = (num) =>
  '₱' +
  Number(num || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Reusable 5-Surface Circular SVG
function CircularToothSvg({
  toothState,
  showFilter = 'everything',
  size = 34,
  showSurfaceLetters = false,
  onZoneClick,
}) {
  const wholeId = toothState?.whole || null;
  const rawWholeTool = wholeId ? TOOLS[wholeId] : null;
  const rawSurfaces = toothState?.surfaces || {};

  const isToolVisible = (tool) => {
    if (!tool) return false;
    if (showFilter === 'findings') return tool.category === 'existing' && !toothState?.markedDone;
    if (showFilter === 'planned') return tool.category === 'planned';
    if (showFilter === 'done') return Boolean(toothState?.markedDone);
    return true;
  };

  const wholeTool = isToolVisible(rawWholeTool) ? rawWholeTool : null;

  const getZoneFill = (zone) => {
    if (wholeTool) return wholeTool.fill;
    const sId = rawSurfaces[zone];
    const sTool = sId ? TOOLS[sId] : null;
    if (sTool && isToolVisible(sTool)) return sTool.fill;
    return '#e2e8f0';
  };

  const isZonePainted = (zone) => {
    if (wholeTool) return true;
    const sId = rawSurfaces[zone];
    const sTool = sId ? TOOLS[sId] : null;
    return Boolean(sTool && isToolVisible(sTool));
  };

  const sectorPaths = {
    B: 'M 17.5 17.5 A 46 46 0 0 1 82.5 17.5 L 63.4 36.6 A 19 19 0 0 0 36.6 36.6 Z',
    M: 'M 82.5 17.5 A 46 46 0 0 1 82.5 82.5 L 63.4 63.4 A 19 19 0 0 0 63.4 36.6 Z',
    L: 'M 82.5 82.5 A 46 46 0 0 1 17.5 82.5 L 36.6 63.4 A 19 19 0 0 0 63.4 63.4 Z',
    D: 'M 17.5 82.5 A 46 46 0 0 1 17.5 17.5 L 36.6 36.6 A 19 19 0 0 0 36.6 63.4 Z',
  };

  const activeTools = [];
  if (wholeTool) {
    activeTools.push(wholeTool);
  } else {
    const seen = new Set();
    Object.values(rawSurfaces).forEach((id) => {
      const t = TOOLS[id];
      if (t && isToolVisible(t) && !seen.has(id)) {
        seen.add(id);
        activeTools.push(t);
      }
    });
  }

  const isMissing = wholeTool?.id === 'existing_missing';

  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: size, height: size }}
      className="overflow-visible select-none"
    >
      {['B', 'M', 'L', 'D'].map((zone) => (
        <path
          key={zone}
          d={sectorPaths[zone]}
          fill={getZoneFill(zone)}
          stroke="#ffffff"
          strokeWidth={showSurfaceLetters ? '2.8' : '3.2'}
          className="tooth-zone"
          onClick={(e) => {
            if (onZoneClick) {
              e.stopPropagation();
              onZoneClick(zone);
            }
          }}
        />
      ))}

      <circle
        cx="50"
        cy="50"
        r="18"
        fill={getZoneFill('O')}
        stroke="#ffffff"
        strokeWidth={showSurfaceLetters ? '2.8' : '3.2'}
        className="tooth-zone"
        onClick={(e) => {
          if (onZoneClick) {
            e.stopPropagation();
            onZoneClick('O');
          }
        }}
      />

      {showSurfaceLetters && (
        <g className="pointer-events-none font-bold" fontSize="12">
          <text x="50" y="18" textAnchor="middle" dominantBaseline="central" fill={isZonePainted('B') ? '#ffffff' : '#64748b'}>B</text>
          <text x="18" y="50" textAnchor="middle" dominantBaseline="central" fill={isZonePainted('D') ? '#ffffff' : '#64748b'}>D</text>
          <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill={isZonePainted('O') ? '#ffffff' : '#64748b'}>O</text>
          <text x="82" y="50" textAnchor="middle" dominantBaseline="central" fill={isZonePainted('M') ? '#ffffff' : '#64748b'}>M</text>
          <text x="50" y="82" textAnchor="middle" dominantBaseline="central" fill={isZonePainted('L') ? '#ffffff' : '#64748b'}>L</text>
        </g>
      )}

      {!showSurfaceLetters && activeTools.length > 0 && !isMissing && (
        <text
          x="50"
          y="51"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize="22"
          fontWeight="800"
          className="pointer-events-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]"
        >
          {activeTools[0].code}
        </text>
      )}

      {isMissing && (
        <g className="pointer-events-none stroke-slate-700" strokeWidth="7" strokeLinecap="round">
          <line x1="22" y1="22" x2="78" y2="78" />
          <line x1="78" y1="22" x2="22" y2="78" />
        </g>
      )}
    </svg>
  );
}

function ArchToothNode({
  number,
  toothState,
  selected,
  showFilter,
  expanded,
  onSelectTooth,
  onZoneClick,
}) {
  const wholeId = toothState?.whole || null;
  const wholeTool = wholeId ? TOOLS[wholeId] : null;
  const surfaces = toothState?.surfaces || {};

  const activeTools = [];
  if (wholeTool) activeTools.push(wholeTool);
  else {
    const seen = new Set();
    Object.values(surfaces).forEach((id) => {
      if (TOOLS[id] && !seen.has(id)) {
        seen.add(id);
        activeTools.push(TOOLS[id]);
      }
    });
  }

  const hasPlanned = activeTools.some((t) => t.category === 'planned');

  return (
    <div
      onClick={() => onSelectTooth(number)}
      className={`flex flex-col items-center cursor-pointer rounded-2xl px-1 py-1.5 transition-all select-none ${
        selected
          ? 'border-2 border-blue-600 bg-white shadow-sm'
          : 'border-2 border-transparent hover:bg-slate-200/50'
      }`}
    >
      <div className={`rounded-full p-0.5 ${hasPlanned ? 'border border-dashed border-teal-500' : ''}`}>
        <CircularToothSvg
          toothState={toothState}
          showFilter={showFilter}
          size={expanded ? 38 : 32}
          onZoneClick={(zone) => onZoneClick(number, zone)}
        />
      </div>

      <div className="mt-1 flex h-3.5 items-center justify-center gap-0.5">
        {activeTools.map((t) => (
          <span
            key={t.id}
            style={{
              borderColor: t.color,
              color: t.category === 'planned' ? t.color : '#ffffff',
              backgroundColor: t.category === 'planned' ? '#ffffff' : t.color,
            }}
            className={`rounded px-1 text-[8px] font-extrabold leading-none py-0.5 ${
              t.category === 'planned' ? 'border border-dashed' : ''
            }`}
          >
            {t.code}
          </span>
        ))}
      </div>

      <span className={`mt-0.5 text-[11px] ${selected ? 'font-extrabold text-slate-900' : 'font-medium text-slate-500'}`}>
        {number}
      </span>
    </div>
  );
}

export default function DentalChartTab({ patientId, onLedgerUpdated }) {
  const [chartData, setChartData] = useState({});
  const [loadingChart, setLoadingChart] = useState(true);
  const [savingChart, setSavingChart] = useState(false);
  const [markingDoneKey, setMarkingDoneKey] = useState(null);
  const [error, setError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');

  // Top Bar State
  const [showFilter, setShowFilter] = useState('everything');
  const [showBabyTeeth, setShowBabyTeeth] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Selected Tooth & Collapsible Tray State
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [activeToolId, setActiveToolId] = useState(null);

  // Editable Prices & DB IDs keyed by planned item key
  const [prices, setPrices] = useState({});
  const [dbTreatmentIds, setDbTreatmentIds] = useState({});

  const activeTool = activeToolId ? TOOLS[activeToolId] : null;

  // Load saved teeth from PostgreSQL on mount
  const loadSavedChart = async () => {
    if (!patientId) return;
    setLoadingChart(true);
    setError('');
    try {
      const rows = await api(`api/staff/patients/${patientId}/chart`);
      const nextChart = {};
      const nextPrices = {};
      const nextDbIds = {};

      (rows || []).forEach((row) => {
        const toothNum = Number(row.tooth_number);
        const toolId = resolveToolIdFromDb(row.procedure_name, row.status);
        const tool = TOOLS[toolId];
        if (!tool) return;

        if (!nextChart[toothNum]) {
          nextChart[toothNum] = { whole: null, surfaces: {}, markedDone: false };
        }

        if (row.status === 'Done') {
          nextChart[toothNum].markedDone = true;
        }

        const surfStr = String(row.surface || '').trim();
        if (!surfStr || surfStr === 'Whole' || tool.scope === 'whole') {
          nextChart[toothNum].whole = toolId;
          const itemKey = `${toothNum}-whole-${toolId}`;
          nextDbIds[itemKey] = row.id;
          if (Number(row.price) > 0) nextPrices[itemKey] = String(row.price);
        } else {
          const surfArr = surfStr
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          surfArr.forEach((s) => {
            nextChart[toothNum].surfaces[s] = toolId;
          });
          const itemKey = `${toothNum}-surface-${toolId}`;
          nextDbIds[itemKey] = row.id;
          if (Number(row.price) > 0) nextPrices[itemKey] = String(row.price);
        }
      });

      setChartData(nextChart);
      setPrices(nextPrices);
      setDbTreatmentIds(nextDbIds);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingChart(false);
    }
  };

  useEffect(() => {
    loadSavedChart();
  }, [patientId]);

  // Apply tool to a specific surface or whole tooth
  const applyToolToTooth = (toothNum, zone, forceWhole = false) => {
    if (!activeTool) return;
    setSavedNotice('');

    setChartData((prev) => {
      const next = { ...prev };
      const current = next[toothNum]
        ? {
            whole: next[toothNum].whole,
            surfaces: { ...(next[toothNum].surfaces || {}) },
            markedDone: next[toothNum].markedDone || false,
          }
        : { whole: null, surfaces: {}, markedDone: false };

      if (activeTool.id === 'eraser') {
        delete next[toothNum];
        return next;
      }

      if (activeTool.scope === 'whole' || forceWhole) {
        if (current.whole === activeTool.id) {
          delete next[toothNum];
        } else {
          next[toothNum] = {
            whole: activeTool.id,
            surfaces: {},
            markedDone: false,
          };
        }
        return next;
      }

      if (zone) {
        current.whole = null;
        current.markedDone = false;

        if (current.surfaces[zone] === activeTool.id) {
          delete current.surfaces[zone];
        } else {
          current.surfaces[zone] = activeTool.id;
        }

        if (!current.whole && Object.keys(current.surfaces).length === 0) {
          delete next[toothNum];
        } else {
          next[toothNum] = current;
        }
      }

      return next;
    });
  };

  const handleSelectTooth = (toothNum) => {
    setSelectedTooth(toothNum);
    if (trayOpen && activeTool && activeTool.scope === 'whole') {
      applyToolToTooth(toothNum, null, true);
    }
  };

  const handleArchZoneClick = (toothNum, zone) => {
    setSelectedTooth(toothNum);
    if (trayOpen && activeTool) {
      applyToolToTooth(toothNum, zone, false);
    }
  };

  const handleInspectorSurfaceClick = (zone) => {
    if (!selectedTooth) return;
    if (!trayOpen) {
      setTrayOpen(true);
      if (!activeToolId) setActiveToolId('existing_caries');
      return;
    }
    if (activeTool) {
      applyToolToTooth(selectedTooth, zone, false);
    }
  };

  const handleInspectorWholeToothClick = () => {
    if (!selectedTooth) return;
    if (!trayOpen) {
      setTrayOpen(true);
      if (!activeToolId) setActiveToolId('existing_caries');
      return;
    }
    if (activeTool) {
      applyToolToTooth(selectedTooth, null, true);
    }
  };

  const stepSelectedTooth = (dir) => {
    const order = showBabyTeeth ? [...ALL_ADULT_ORDER, ...ALL_BABY_ORDER] : ALL_ADULT_ORDER;
    const idx = order.indexOf(selectedTooth);
    const nextIdx = idx === -1 ? 0 : (idx + dir + order.length) % order.length;
    setSelectedTooth(order[nextIdx]);
  };

  // Auto-Sync Treatment Plan List whenever a "Planned" tool is painted
  const plannedList = useMemo(() => {
    const items = [];

    Object.entries(chartData).forEach(([toothStr, data]) => {
      const toothNum = Number(toothStr);

      if (data.whole && TOOLS[data.whole]?.category === 'planned') {
        const tool = TOOLS[data.whole];
        items.push({
          key: `${toothNum}-whole-${tool.id}`,
          toothNum,
          scope: 'whole',
          toolId: tool.id,
          label: tool.label,
          code: tool.code,
          color: tool.color,
          stripeClass: tool.stripeClass,
          surfaces: [],
        });
      }

      if (data.surfaces) {
        const grouped = {};
        Object.entries(data.surfaces).forEach(([surf, tId]) => {
          if (TOOLS[tId]?.category === 'planned') {
            if (!grouped[tId]) grouped[tId] = [];
            grouped[tId].push(surf);
          }
        });

        Object.entries(grouped).forEach(([tId, surfList]) => {
          const tool = TOOLS[tId];
          items.push({
            key: `${toothNum}-surface-${tId}`,
            toothNum,
            scope: 'surface',
            toolId: tId,
            label: tool.label,
            code: tool.code,
            color: tool.color,
            stripeClass: tool.stripeClass,
            surfaces: surfList,
          });
        });
      }
    });

    return items.sort((a, b) => a.toothNum - b.toothNum);
  }, [chartData]);

  // Build payload of all current Planned + Existing items for saving to DB
  const buildAllChartTreatmentsPayload = () => {
    const payload = [];

    Object.entries(chartData).forEach(([toothStr, data]) => {
      const toothNum = Number(toothStr);
      // Skip items that were already marked Done (those remain 'Done' in DB)
      if (data.markedDone) return;

      if (data.whole && TOOLS[data.whole]) {
        const tool = TOOLS[data.whole];
        const key = `${toothNum}-whole-${tool.id}`;
        payload.push({
          tooth_number: toothNum,
          procedure_name: tool.label,
          surface: 'Whole',
          status: tool.category === 'planned' ? 'Planned' : 'Existing',
          price: prices[key] ? parseFloat(prices[key]) : 0,
        });
      }

      if (data.surfaces) {
        const grouped = {};
        Object.entries(data.surfaces).forEach(([surf, tId]) => {
          if (TOOLS[tId]) {
            if (!grouped[tId]) grouped[tId] = [];
            grouped[tId].push(surf);
          }
        });

        Object.entries(grouped).forEach(([tId, surfList]) => {
          const tool = TOOLS[tId];
          const key = `${toothNum}-surface-${tId}`;
          payload.push({
            tooth_number: toothNum,
            procedure_name: tool.label,
            surface: surfList.join(', '),
            status: tool.category === 'planned' ? 'Planned' : 'Existing',
            price: prices[key] ? parseFloat(prices[key]) : 0,
          });
        });
      }
    });

    return payload;
  };

  // Save Chart button -> saves Planned & Existing teeth to PostgreSQL `patient_treatments`
  const handleSaveChart = async () => {
    if (!patientId) return;
    setSavingChart(true);
    setError('');
    setSavedNotice('');
    try {
      const treatmentsPayload = buildAllChartTreatmentsPayload();
      await api(`api/staff/patients/${patientId}/treatments`, {
        method: 'POST',
        body: {
          sync_chart: true,
          treatments: treatmentsPayload,
        },
      });
      await loadSavedChart();
      setSavedNotice('Chart and treatment plan saved to database!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingChart(false);
    }
  };

  // "Mark as Done" button -> Updates treatment status to "Done" in DB AND auto-creates a Charge in `patient_ledger`
  const handleMarkAsDone = async (item) => {
    if (!patientId) return;
    setMarkingDoneKey(item.key);
    setError('');
    setSavedNotice('');

    const itemPrice = prices[item.key] ? parseFloat(prices[item.key]) : 0;

    try {
      let treatmentId = dbTreatmentIds[item.key];

      // If the user painted a Planned item and clicked "Mark as Done" before clicking "Save Chart", create the row first
      if (!treatmentId) {
        const createRes = await api(`api/staff/patients/${patientId}/treatments`, {
          method: 'POST',
          body: {
            tooth_number: item.toothNum,
            procedure_name: item.label,
            surface: item.surfaces.length > 0 ? item.surfaces.join(', ') : 'Whole',
            status: 'Planned',
            price: itemPrice,
          },
        });
        treatmentId = createRes.treatments?.[0]?.id;
      }

      if (!treatmentId) {
        throw new Error('Could not resolve treatment record ID.');
      }

      // Call PUT to mark treatment "Done" and automatically insert Charge into patient_ledger
      await api(`api/staff/patients/${patientId}/treatments/${treatmentId}/done`, {
        method: 'PUT',
        body: { price: itemPrice },
      });

      await loadSavedChart();
      onLedgerUpdated?.();
      setSavedNotice(
        `Marked "${item.label} - Tooth ${item.toothNum}" as Done and added a ${formatPeso(
          itemPrice
        )} Charge to the Patient Ledger.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingDoneKey(null);
    }
  };

  const handlePriceChange = (itemKey, rawVal) => {
    if (rawVal === '' || /^\d*\.?\d{0,2}$/.test(rawVal)) {
      setPrices((prev) => ({
        ...prev,
        [itemKey]: rawVal,
      }));
    }
  };

  const totalEstimate = useMemo(() => {
    return plannedList.reduce((sum, item) => {
      const val = parseFloat(prices[item.key]);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [plannedList, prices]);

  const selectedToothState = selectedTooth ? chartData[selectedTooth] : null;

  return (
    <div className="space-y-4">
      <style>{`
        .stripe-pill-sky { background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 2.5px, #bae6fd 2.5px, #bae6fd 5px); }
        .stripe-pill-emerald { background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 2.5px, #a7f3d0 2.5px, #a7f3d0 5px); }
        .stripe-pill-teal { background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 2.5px, #99f6e4 2.5px, #99f6e4 5px); }
        .stripe-pill-lime { background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 2.5px, #d9f99d 2.5px, #d9f99d 5px); }
        .stripe-pill-blue { background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 2.5px, #bfdbfe 2.5px, #bfdbfe 5px); }
        .stripe-pill-indigo { background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 2.5px, #c7d2fe 2.5px, #c7d2fe 5px); }
        .stripe-pill-red { background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 2.5px, #fecaca 2.5px, #fecaca 5px); }
        .stripe-pill-slate { background: repeating-linear-gradient(-45deg, #ffffff, #ffffff 2.5px, #cbd5e1 2.5px, #cbd5e1 5px); }
        .tooth-zone {
          cursor: pointer;
          transition: opacity 0.12s ease;
        }
        .tooth-zone:hover {
          opacity: 0.72;
        }
      `}</style>

      {/* Hidden SVG Diagonal Stripe Patterns */}
      <svg className="absolute h-0 w-0 pointer-events-none" aria-hidden="true">
        <defs>
          <pattern id="pat-stripe-sky" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#e0f2fe" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#0284c7" strokeWidth="3.2" />
          </pattern>
          <pattern id="pat-stripe-emerald" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#d1fae5" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#10b981" strokeWidth="3.2" />
          </pattern>
          <pattern id="pat-stripe-teal" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#ccfbf1" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#0d9488" strokeWidth="3.2" />
          </pattern>
          <pattern id="pat-stripe-lime" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#ecfccb" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#65a30d" strokeWidth="3.2" />
          </pattern>
          <pattern id="pat-stripe-blue" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#dbeafe" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#0369a1" strokeWidth="3.2" />
          </pattern>
          <pattern id="pat-stripe-indigo" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#e0e7ff" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#6366f1" strokeWidth="3.2" />
          </pattern>
          <pattern id="pat-stripe-red" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#fee2e2" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#dc2626" strokeWidth="3.2" />
          </pattern>
          <pattern id="pat-stripe-slate" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#e2e8f0" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#334155" strokeWidth="3.2" />
          </pattern>
        </defs>
      </svg>

      {/* =================================================================== */}
      {/* 1. TOP FILTER BAR */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-slate-500">Show</span>
          {[
            { id: 'everything', label: 'Everything' },
            { id: 'findings', label: 'Findings' },
            { id: 'planned', label: 'Planned' },
            { id: 'done', label: 'Done' },
          ].map((tab) => {
            const active = showFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setShowFilter(tab.id)}
                className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition-all ${
                  active
                    ? 'border-blue-600 bg-blue-50/80 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}

          <div className="ml-2 inline-flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={showBabyTeeth}
              onClick={() => setShowBabyTeeth(!showBabyTeeth)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                showBabyTeeth ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  showBabyTeeth ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-xs font-medium text-slate-600">Baby teeth</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <span>⤢</span> {expanded ? 'Compact' : 'Expand'}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {savedNotice && (
        <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          {savedNotice}
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. THE 32-TOOTH ARCH */}
      {/* =================================================================== */}
      <div className="relative">
        <div className="overflow-x-auto rounded-2xl bg-[#f8fafc] px-3 py-5 border border-slate-200/70">
          {loadingChart ? (
            <p className="py-10 text-center text-xs font-medium text-slate-500">
              Loading saved dental chart...
            </p>
          ) : (
            <div className="min-w-[640px]">
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                UPPER
              </p>

              <div className="grid grid-cols-2">
                <div className="grid grid-cols-8 gap-0.5 border-r border-dashed border-slate-300 pr-2 justify-items-center">
                  {UPPER_RIGHT.map((num) => (
                    <ArchToothNode
                      key={num}
                      number={num}
                      toothState={chartData[num]}
                      selected={selectedTooth === num}
                      showFilter={showFilter}
                      expanded={expanded}
                      onSelectTooth={handleSelectTooth}
                      onZoneClick={handleArchZoneClick}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-8 gap-0.5 pl-2 justify-items-center">
                  {UPPER_LEFT.map((num) => (
                    <ArchToothNode
                      key={num}
                      number={num}
                      toothState={chartData[num]}
                      selected={selectedTooth === num}
                      showFilter={showFilter}
                      expanded={expanded}
                      onSelectTooth={handleSelectTooth}
                      onZoneClick={handleArchZoneClick}
                    />
                  ))}
                </div>
              </div>

              {showBabyTeeth && (
                <div className="mt-2 grid grid-cols-2">
                  <div className="flex justify-end border-r border-dashed border-slate-300 pr-4 gap-1">
                    {BABY_UPPER_RIGHT.map((num) => (
                      <ArchToothNode
                        key={num}
                        number={num}
                        toothState={chartData[num]}
                        selected={selectedTooth === num}
                        showFilter={showFilter}
                        expanded={expanded}
                        onSelectTooth={handleSelectTooth}
                        onZoneClick={handleArchZoneClick}
                      />
                    ))}
                  </div>
                  <div className="flex justify-start pl-4 gap-1">
                    {BABY_UPPER_LEFT.map((num) => (
                      <ArchToothNode
                        key={num}
                        number={num}
                        toothState={chartData[num]}
                        selected={selectedTooth === num}
                        showFilter={showFilter}
                        expanded={expanded}
                        onSelectTooth={handleSelectTooth}
                        onZoneClick={handleArchZoneClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="my-3 border-t border-slate-200/90" />

              {showBabyTeeth && (
                <div className="mb-2 grid grid-cols-2">
                  <div className="flex justify-end border-r border-dashed border-slate-300 pr-4 gap-1">
                    {BABY_LOWER_RIGHT.map((num) => (
                      <ArchToothNode
                        key={num}
                        number={num}
                        toothState={chartData[num]}
                        selected={selectedTooth === num}
                        showFilter={showFilter}
                        expanded={expanded}
                        onSelectTooth={handleSelectTooth}
                        onZoneClick={handleArchZoneClick}
                      />
                    ))}
                  </div>
                  <div className="flex justify-start pl-4 gap-1">
                    {BABY_LOWER_LEFT.map((num) => (
                      <ArchToothNode
                        key={num}
                        number={num}
                        toothState={chartData[num]}
                        selected={selectedTooth === num}
                        showFilter={showFilter}
                        expanded={expanded}
                        onSelectTooth={handleSelectTooth}
                        onZoneClick={handleArchZoneClick}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2">
                <div className="grid grid-cols-8 gap-0.5 border-r border-dashed border-slate-300 pr-2 justify-items-center">
                  {LOWER_RIGHT.map((num) => (
                    <ArchToothNode
                      key={num}
                      number={num}
                      toothState={chartData[num]}
                      selected={selectedTooth === num}
                      showFilter={showFilter}
                      expanded={expanded}
                      onSelectTooth={handleSelectTooth}
                      onZoneClick={handleArchZoneClick}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-8 gap-0.5 pl-2 justify-items-center">
                  {LOWER_LEFT.map((num) => (
                    <ArchToothNode
                      key={num}
                      number={num}
                      toothState={chartData[num]}
                      selected={selectedTooth === num}
                      showFilter={showFilter}
                      expanded={expanded}
                      onSelectTooth={handleSelectTooth}
                      onZoneClick={handleArchZoneClick}
                    />
                  ))}
                </div>
              </div>

              <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                LOWER
              </p>
            </div>
          )}
        </div>

        {!trayOpen && (
          <div className="-mt-5 flex justify-end pr-3">
            <button
              type="button"
              onClick={() => {
                setTrayOpen(true);
                if (!activeToolId) setActiveToolId('existing_caries');
              }}
              className="relative z-10 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-blue-700"
            >
              <span>✎</span> Chart
            </button>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 3. COLLAPSIBLE TOOL TRAY */}
      {/* =================================================================== */}
      {trayOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-500">EXISTING</span>
              {activeTool ? (
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activeTool.color }} />
                  Now marking: <strong className="text-slate-900">{activeTool.label}</strong>
                  {activeTool.category === 'planned' ? ' - planned' : ' - in the mouth'}
                </span>
              ) : (
                <span className="text-slate-400">Pick a finding, then tap a tooth</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveToolId('eraser')}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                  activeToolId === 'eraser'
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                ⌫ Eraser
              </button>
              <button
                type="button"
                onClick={() => setTrayOpen(false)}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Done
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {EXISTING_TRAY_ORDER.map((id) => {
              const tool = TOOLS[id];
              const selected = activeToolId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveToolId(id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                    selected
                      ? 'border-blue-600 bg-blue-50/60 text-slate-900 ring-2 ring-blue-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span
                    style={{ backgroundColor: tool.color }}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
                  >
                    {tool.code}
                  </span>
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl bg-[#f8fafc] p-3.5 space-y-2.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              PLANNED
            </span>
            <div className="flex flex-wrap gap-2">
              {PLANNED_TRAY_ORDER.map((id) => {
                const tool = TOOLS[id];
                const selected = activeToolId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveToolId(id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                      selected
                        ? 'border-blue-600 bg-white text-slate-900 ring-2 ring-blue-600/20 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      style={{ borderColor: tool.color, color: tool.color }}
                      className={`flex h-5 w-5 items-center justify-center rounded-full border border-dashed text-[9px] font-extrabold ${tool.stripeClass}`}
                    >
                      {tool.code}
                    </span>
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. KEY LEGEND */}
      {/* =================================================================== */}
      <div className="space-y-1.5 px-1 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-600">Key</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-slate-600" /> solid = in the mouth
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-slate-500 stripe-pill-slate" /> striped = planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-2 border-slate-500 bg-white" /> outlined = two findings, one spot
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
              ✓
            </span>{' '}
            = done
          </span>
        </div>

        {!selectedTooth && (
          <p className="pt-2 text-center text-xs text-slate-400">
            Click a tooth to edit it here, or paint directly on the chart.
          </p>
        )}
      </div>

      {/* =================================================================== */}
      {/* 5. SELECTED TOOTH BIG INSPECTOR CARD */}
      {/* =================================================================== */}
      {selectedTooth && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Tooth {selectedTooth}</h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => stepSelectedTooth(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                aria-label="Previous tooth"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => stepSelectedTooth(1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                aria-label="Next tooth"
              >
                ›
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-8 pt-1">
            <div className="flex flex-col items-center gap-2">
              <CircularToothSvg
                toothState={selectedToothState}
                showFilter="everything"
                size={120}
                showSurfaceLetters
                onZoneClick={handleInspectorSurfaceClick}
              />
              <span className="text-[11px] font-semibold text-slate-500">{selectedTooth}</span>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleInspectorWholeToothClick}
                className={`w-56 rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                  selectedToothState?.whole
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                Whole tooth
              </button>

              <div className="flex gap-2">
                {['M', 'O', 'D', 'B', 'L'].map((surf) => {
                  const isSurfActive = Boolean(selectedToothState?.surfaces?.[surf]);
                  return (
                    <button
                      key={surf}
                      type="button"
                      onClick={() => handleInspectorSurfaceClick(surf)}
                      className={`h-10 w-10 rounded-xl border text-xs font-semibold transition-all ${
                        isSurfActive
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      {surf}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            {trayOpen ? (
              'Pick a finding from the tray, then tap a surface.'
            ) : (
              <>
                Tap <strong className="font-bold text-slate-800">Chart</strong> to add findings to this tooth.
              </>
            )}
          </p>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. TREATMENT PLAN CARD & SAVE CHART BUTTON (Connected to PostgreSQL) */}
      {/* =================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Treatment Plan</h3>
            <p className="text-xs text-slate-500">
              Clicking "Mark as Done" updates the treatment status in PostgreSQL and automatically adds a Charge to the Patient Ledger.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {plannedList.length} {plannedList.length === 1 ? 'Item' : 'Items'}
          </span>
        </div>

        {plannedList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
            No planned treatments yet. Click <strong>✎ Chart</strong>, select a <strong>PLANNED</strong> tool, and paint a tooth above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="hidden sm:grid sm:grid-cols-[1.6fr_1.1fr_1.3fr_0.9fr_1.1fr] sm:items-center sm:gap-3 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span>Procedure Name</span>
              <span>Tooth Number</span>
              <span>Price (₱)</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>

            <div className="divide-y divide-slate-100">
              {plannedList.map((item) => {
                const rawPrice = prices[item.key] ?? '';
                const isBusy = markingDoneKey === item.key;

                return (
                  <div
                    key={item.key}
                    className="flex flex-col gap-3 py-3.5 sm:grid sm:grid-cols-[1.6fr_1.1fr_1.3fr_0.9fr_1.1fr] sm:items-center sm:gap-3"
                  >
                    {/* 1. Procedure Name */}
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-3.5 w-3.5 shrink-0 rounded-full ${item.stripeClass}`}
                        style={{ border: `1.5px solid ${item.color}` }}
                      />
                      <span className="text-sm font-bold text-slate-900">
                        {item.label}{' '}
                        <span className="text-xs font-semibold text-slate-500">
                          ({item.code})
                        </span>
                      </span>
                    </div>

                    {/* 2. Tooth Number */}
                    <div className="text-xs font-semibold text-slate-700">
                      <span className="text-slate-400 sm:hidden">Tooth: </span>
                      Tooth {item.toothNum}
                      {item.surfaces.length > 0 && (
                        <span className="ml-1 text-blue-700">
                          ({item.surfaces.join(', ')})
                        </span>
                      )}
                    </div>

                    {/* 3. Editable Price Input */}
                    <div className="relative max-w-[160px]">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                        ₱
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter price"
                        value={rawPrice}
                        onChange={(e) => handlePriceChange(item.key, e.target.value)}
                        aria-label={`Price for ${item.label} on Tooth ${item.toothNum}`}
                        className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-7 pr-3 text-right text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      />
                    </div>

                    {/* 4. Status Badge */}
                    <div>
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        Pending
                      </span>
                    </div>

                    {/* 5. "Mark as Done" Button */}
                    <div className="flex sm:justify-end">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleMarkAsDone(item)}
                        className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                      >
                        {isBusy ? 'Saving...' : 'Mark as Done'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Total Estimate Line */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 border border-slate-200/80">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Total Estimate
          </span>
          <span className="text-base font-extrabold text-blue-700">
            {formatPeso(totalEstimate)}
          </span>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            disabled={savingChart}
            onClick={handleSaveChart}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {savingChart ? 'Saving Chart...' : 'Save Chart'}
          </button>
        </div>
      </div>
    </div>
  );
}