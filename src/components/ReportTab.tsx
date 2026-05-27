import React, { useState, useEffect } from 'react';
import { User, Movimiento } from '../types';
import { formatearFecha } from '../utils';
import { BarChart3, Download, Printer, Percent } from 'lucide-react';

interface ReportTabProps {
  user: User;
  movimientos: Movimiento[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export default function ReportTab({ user, movimientos, showToast }: ReportTabProps) {
  const [repTipo, setRepTipo] = useState<'SALIDA' | 'ENTRADA' | 'AJUSTE'>('SALIDA');
  const [fechaIni, setFechaIni] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const [hasData, setHasData] = useState(false);
  const [totalFilteredQty, setTotalFilteredQty] = useState(0);
  const [reportAreas, setReportAreas] = useState<[string, number][]>([]);
  const [reportProducts, setReportProducts] = useState<[string, number][]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Movimiento[]>([]);

  // Calculate and generate report analytics
  const runReport = () => {
    let movsReporte: Movimiento[] = [];

    if (repTipo === 'SALIDA') {
      movsReporte = movimientos.filter(m => 
        !m.eliminado && 
        m.tipo === 'SALIDA' && 
        m.area !== 'AJUSTE MANUAL' && 
        (!fechaIni || m.fecha >= fechaIni) && 
        (!fechaFin || m.fecha <= fechaFin)
      );
    } else if (repTipo === 'ENTRADA') {
      movsReporte = movimientos.filter(m => 
        !m.eliminado && 
        m.tipo === 'ENTRADA' && 
        m.area !== 'AJUSTE MANUAL' && 
        (!fechaIni || m.fecha >= fechaIni) && 
        (!fechaFin || m.fecha <= fechaFin)
      );
    } else if (repTipo === 'AJUSTE') {
      movsReporte = movimientos.filter(m => 
        !m.eliminado && 
        m.area === 'AJUSTE MANUAL' && 
        (!fechaIni || m.fecha >= fechaIni) && 
        (!fechaFin || m.fecha <= fechaFin)
      );
    }

    if (movsReporte.length === 0) {
      setHasData(false);
      setTotalFilteredQty(0);
      setReportAreas([]);
      setReportProducts([]);
      setFilteredTransactions([]);
      return;
    }

    // Chart 1: Group by Area or Supplier
    const byArea: Record<string, number> = {};
    movsReporte.forEach(r => {
      let groupKey = r.area;
      if (repTipo === 'AJUSTE') {
        groupKey = r.tipo === 'ENTRADA' ? 'SUMAS (+) AJUSTE/CONTEO' : 'RESTAS (-) MERMAS FISICAS';
      } else if (repTipo === 'ENTRADA' && user.module === 'COMPRAS') {
        groupKey = r.prov || r.area;
      }
      byArea[groupKey] = (byArea[groupKey] || 0) + r.cantidad;
    });
    const sortedAreas = Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Chart 2: Group by Product Description
    const byProduct: Record<string, number> = {};
    movsReporte.forEach(r => {
      byProduct[r.descripcion] = (byProduct[r.descripcion] || 0) + r.cantidad;
    });
    const sortedProducts = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Sort transactions chronologically secondary
    const sortedTx = [...movsReporte].sort((a, b) => {
      if (a.fecha === b.fecha) return b.id - a.id;
      return b.fecha.localeCompare(a.fecha);
    });

    const sumQty = movsReporte.reduce((sum, item) => sum + item.cantidad, 0);

    setTotalFilteredQty(sumQty);
    setReportAreas(sortedAreas);
    setReportProducts(sortedProducts);
    setFilteredTransactions(sortedTx);
    setHasData(true);
  };

  useEffect(() => {
    runReport();
  }, [repTipo, movimientos]);

  const handleExportCSVReport = () => {
    if (filteredTransactions.length === 0) {
      showToast('Es necesario generar un reporte filtrado primero', 'error');
      return;
    }

    const bom = '\uFEFF';
    let csv = bom + `REPORTE OFICIAL DE ${repTipo}S (${user.module})\n\n`;
    
    if (user.module === 'COMPRAS') {
      csv += 'TIPO,FECHA,CANTIDAD,DESCRIPCIÓN,UNIDAD,ÁREA/ORIGEN,PROVEEDOR,FACTURA,FECHA FACTURA,COSTO UNITARIO,COSTO TOTAL,N_AUTORIZACION,QUIEN_RECIBE,RESPONSABLE_AREA,NOTAS,RESPONSABLE_SISTEMA\n';
    } else {
      csv += 'TIPO,FECHA,CANTIDAD,DESCRIPCIÓN,UNIDAD,ÁREA/ORIGEN,NOTAS,RESPONSABLE\n';
    }

    filteredTransactions.forEach(r => {
      if (user.module === 'COMPRAS') {
        csv += [
          r.tipo,
          formatearFecha(r.fecha),
          r.cantidad,
          `"${r.descripcion}"`,
          `"${r.unidad}"`,
          `"${r.area}"`,
          `"${r.prov || ''}"`,
          `"${r.fact || ''}"`,
          `"${r.fechaFact ? formatearFecha(r.fechaFact) : ''}"`,
          r.costoUnit || '',
          r.costoTotal || '',
          `"${r.aut || ''}"`,
          `"${r.recibe || ''}"`,
          `"${r.resp || ''}"`,
          `"${r.notas || ''}"`,
          `"${r.registradoPor}"`
        ].join(',') + '\n';
      } else {
        csv += [
          r.tipo,
          r.fecha,
          r.cantidad,
          `"${r.descripcion}"`,
          `"${r.unidad}"`,
          `"${r.area}"`,
          `"${r.notas || ''}"`,
          `"${r.registradoPor}"`
        ].join(',') + '\n';
      }
    });

    csv += '\n\n--- RESUMEN TOP 10 ---\n\nTOP 10 ÁREAS/ORÍGENES (O TIPO DE AJUSTE),CANTIDAD TOTAL\n';
    reportAreas.forEach(([area, cant]) => { csv += `"${area}",${cant}\n`; });
    csv += '\nTOP 10 PRODUCTOS,CANTIDAD TOTAL\n';
    reportProducts.forEach(([prod, cant]) => { csv += `"${prod}",${cant}\n`; });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CCU_Reporte_Analitico_${repTipo}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('Reporte exportado correctamente a un archivo CSV/Excel', 'success');
  };

  const chartColors = [
    'bg-blue-600', 'bg-cyan-600', 'bg-emerald-600', 'bg-amber-600',
    'bg-purple-600', 'bg-red-600', 'bg-orange-600', 'bg-teal-600',
    'bg-indigo-600', 'bg-pink-600'
  ];

  return (
    <div className="space-y-6">
      <div className="page-header pb-4 border-b border-[#ddd9d0]">
        <h2 className="text-xl md:text-2xl font-bold font-sans text-gray-900">
          Reportes y Analíticas
        </h2>
        <p className="text-xs md:text-sm text-gray-500 mt-1">
          Visualice los productos más solicitados, ingresos de remisiones y balances del almacén
        </p>
      </div>

      {/* Analytics Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center bg-white border border-[#ddd9d0] p-4 rounded-xl shadow-sm gap-3 print:hidden">
        <select
          value={repTipo}
          onChange={(e) => setRepTipo(e.target.value as any)}
          className="flex-1 text-xs md:text-sm border border-[#ddd9d0] rounded-lg p-2.5 bg-white focus:border-blue-600 focus:outline-none transition-colors min-w-[250px]"
        >
          <option value="SALIDA">Reporte de Salidas (Consumo Real)</option>
          <option value="ENTRADA">Reporte de Entradas (Ingresos Registrados)</option>
          <option value="AJUSTE">Reporte de Ajustes Manuales (Mermas vs Devoluciones)</option>
        </select>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          <input
            type="date"
            value={fechaIni}
            onChange={(e) => setFechaIni(e.target.value)}
            title="Desde"
            className="w-full sm:w-auto text-xs md:text-sm border border-[#ddd9d0] rounded-lg p-2 bg-white focus:outline-none"
          />
          <span className="text-gray-400 text-xs hidden sm:inline">a</span>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            title="Hasta"
            className="w-full sm:w-auto text-xs md:text-sm border border-[#ddd9d0] rounded-lg p-2 bg-white focus:outline-none"
          />
        </div>

        <button
          onClick={runReport}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <BarChart3 size={14} />
          Generar Reporte
        </button>

        {hasData && (
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-1 cursor-pointer"
            >
              <Printer size={13} />
              Imprimir
            </button>
            <button
              onClick={handleExportCSVReport}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-1 cursor-pointer"
            >
              <Download size={13} />
              Excel
            </button>
          </div>
        )}
      </div>

      {hasData && (
        <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl text-sky-850 flex items-center gap-2.5">
          <Percent size={18} className="text-sky-600" />
          <span className="text-xs md:text-sm font-semibold">
            <b>Volumen Total Procesado:</b> {totalFilteredQty} U. (acumuladas para los filtros activos)
          </span>
        </div>
      )}

      {!hasData ? (
        <div className="text-center py-20 bg-white border border-[#ddd9d0] rounded-xl text-gray-400 shadow-sm">
          <p className="text-sm md:text-base font-semibold">Sin transferencias o registros cargados para el periodo.</p>
          <p className="text-xs md:text-sm mt-1">Modifique los filtros de fechas u operaciones arriba.</p>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-200">
            {/* Chart 1 */}
            <div className="bg-white border border-[#ddd9d0] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs md:text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                {repTipo === 'SALIDA' ? (
                  <><span>🏢</span>Destinos (Áreas de Consumo Real)</>
                ) : repTipo === 'ENTRADA' ? (
                  <><span>🏬</span>Orígenes / Proveedores Registrados</>
                ) : (
                  <><span>⚖️</span>Balance General de Modificaciones</>
                )}
              </h3>
              <p className="text-[10px] md:text-xs text-gray-500">
                {repTipo === 'SALIDA' 
                  ? 'Artículos transferidos por departamento (excluye auditorías)' 
                  : repTipo === 'ENTRADA' 
                    ? 'Ingresos directos aportados al inventario' 
                    : 'Comparativa de correcciones positivas (+) frente a mermas físicas (-)'}
              </p>

              <div className="space-y-3.5 pr-1 pt-2">
                {reportAreas.map(([area, qty], i) => {
                  const maxQty = reportAreas[0]?.[1] || 1;
                  const ratio = Math.max(2, Math.round((qty / maxQty) * 100));
                  let barColor = chartColors[i % chartColors.length];
                  if (repTipo === 'AJUSTE') {
                    barColor = area.includes('SUMAS') ? 'bg-emerald-600' : 'bg-red-600';
                  }

                  return (
                    <div key={area} className="flex items-center gap-3 text-xs md:text-sm">
                      <div className="w-40 flex-shrink-0 font-medium text-gray-600 truncate uppercase" title={area}>
                        {area}
                      </div>
                      <div className="flex-1 h-5.5 bg-gray-100 rounded-md overflow-hidden relative border border-gray-200/50">
                        <div 
                          className={`h-full ${barColor} rounded-md transition-all duration-500 ease-out`} 
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                      <div className="w-14 text-right font-bold text-gray-700 font-mono text-xs">
                        {qty} U.
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 2 */}
            <div className="bg-white border border-[#ddd9d0] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs md:text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                {repTipo === 'SALIDA' ? (
                  <><span>📦</span>Insumos de Mayor Rotación</>
                ) : repTipo === 'ENTRADA' ? (
                  <><span>📦</span>Insumos de Mayor Abasto</>
                ) : (
                  <><span>📦</span>Insumos Modificados por Conteo</>
                )}
              </h3>
              <p className="text-[10px] md:text-xs text-gray-500">
                {repTipo === 'SALIDA' 
                  ? 'Consumo acumulado de piezas por artículo' 
                  : repTipo === 'ENTRADA' 
                    ? 'Volumen total de mercancías ingresadas' 
                    : 'Artículos con más incidencias de ajuste manual'}
              </p>

              <div className="space-y-3.5 pr-1 pt-2">
                {reportProducts.map(([product, qty], i) => {
                  const maxQty = reportProducts[0]?.[1] || 1;
                  const ratio = Math.max(2, Math.round((qty / maxQty) * 100));
                  const barColor = chartColors[(i + 3) % chartColors.length];

                  return (
                    <div key={product} className="flex items-center gap-3 text-xs md:text-sm">
                      <div className="w-40 flex-shrink-0 font-medium text-gray-600 truncate uppercase" title={product}>
                        {product}
                      </div>
                      <div className="flex-1 h-5.5 bg-gray-100 rounded-md overflow-hidden relative border border-gray-200/50">
                        <div 
                          className={`h-full ${barColor} rounded-md transition-all duration-500 ease-out`} 
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                      <div className="w-14 text-right font-bold text-gray-700 font-mono text-xs">
                        {qty} U.
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-white border border-[#ddd9d0] rounded-xl shadow-sm overflow-hidden p-5">
            <h3 className="text-xs md:text-sm font-bold text-gray-800 uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <span>📋</span>Detalle de Transacciones del Periodo
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs md:text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#ddd9d0] font-sans font-bold text-[10px] md:text-xs text-gray-500 tracking-wider uppercase">
                    <th className="px-4 py-3">F. Grabado</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Cant.</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Unidad</th>
                    <th className="px-4 py-3">Destino/Procedencia</th>
                    {user.module === 'COMPRAS' && (
                      <th className="px-4 py-3">Detalle Proveedor / Compras</th>
                    )}
                    <th className="px-4 py-3">Notas</th>
                    <th className="px-4 py-3">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ddd9d0] whitespace-nowrap">
                  {filteredTransactions.map((m) => {
                    const tagColor = m.tipo === 'ENTRADA' 
                      ? 'bg-green-50 text-green-700' 
                      : 'bg-red-50 text-red-700';

                    return (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-[11px] text-gray-500">
                          {formatearFecha(m.fecha)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${m.area === 'AJUSTE MANUAL' ? 'bg-purple-100 text-purple-700' : tagColor}`}>
                            {m.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-gray-900">
                          {m.cantidad}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-gray-800">
                          {m.descripcion}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-block bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            {m.unidad}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 font-medium">
                          {m.area}
                        </td>
                        {user.module === 'COMPRAS' && (
                          <td className="px-4 py-3.5 text-[11px] text-gray-500 leading-normal">
                            {m.tipo === 'ENTRADA' && m.area !== 'AJUSTE MANUAL' ? (
                              <div>
                                <b>Prov:</b> {m.prov || '-'} | <b>Fact/Rem:</b> {m.fact || '-'}
                                <br />
                                <b>Costo U:</b> ${m.costoUnit || '0'} (Total: ${m.costoTotal || '0'})
                              </div>
                            ) : m.tipo === 'SALIDA' && m.area !== 'AJUSTE MANUAL' ? (
                              <div>
                                <b>Recibe:</b> {m.recibe || '-'} | <b>Resp. Área:</b> {m.resp || '-'}
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-gray-500 truncate max-w-[200px]">
                          {m.notas || ''}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-gray-600">
                          {m.registradoPor}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
