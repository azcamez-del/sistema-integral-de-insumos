import React, { useState } from 'react';
import { User, Movimiento } from '../types';
import { formatearFecha } from '../utils';
import { RefreshCw, Download, Trash, Search } from 'lucide-react';

interface DatabaseTabProps {
  user: User;
  movimientos: Movimiento[];
  onDeleteMovimiento: (id: number) => void;
  onClearHistory: () => void;
  onSync: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export default function DatabaseTab({
  user,
  movimientos,
  onDeleteMovimiento,
  onClearHistory,
  onSync,
  showToast
}: DatabaseTabProps) {
  const [tipoFilter, setTipoFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaIni, setFechaIni] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const isRespSalidas = user.role === 'responsable_salidas';
  const isRespEntradas = user.role === 'responsable_entradas';
  const isAdmin = user.role === 'admin';
  const isSup = user.role === 'supervisor';

  // Perform advanced record filtering depending on search, dates, and role permissions
  const filteredMovs = movimientos.filter(m => {
    // Audit protection: normal users don't see deleted records to prevent UI clutter, admin/supervisor see deletions
    if (!isAdmin && !isSup && m.eliminado) return false;

    // Isolate activities for the logged-in field personnel to avoid overlapping logs
    if (isRespSalidas && (m.tipo !== 'SALIDA' || m.registradoPor !== user.name)) return false;
    if (isRespEntradas && (m.tipo !== 'ENTRADA' || m.registradoPor !== user.name)) return false;
    
    // Core filter dropdown
    if (!isRespSalidas && !isRespEntradas && tipoFilter && m.tipo !== tipoFilter) return false;

    // Date range filters
    if (fechaIni && m.fecha < fechaIni) return false;
    if (fechaFin && m.fecha > fechaFin) return false;

    // General string search (description, destinations, suppliers, invoices)
    if (searchTerm.trim() !== '') {
      const q = searchTerm.trim().toUpperCase();
      const matchDesc = m.descripcion.toUpperCase().includes(q);
      const matchArea = m.area.toUpperCase().includes(q);
      const matchProv = (m.prov || '').toUpperCase().includes(q);
      const matchFact = (m.fact || '').toUpperCase().includes(q);
      const matchUser = m.registradoPor.toUpperCase().includes(q);
      if (!matchDesc && !matchArea && !matchProv && !matchFact && !matchUser) return false;
    }

    return true;
  }).sort((a, b) => {
    // Sort primarily by date descending, and secondarily by ID/creation descending
    if (a.fecha === b.fecha) return b.id - a.id;
    return b.fecha.localeCompare(a.fecha);
  });

  const handleExportCSV = () => {
    const validMovs = movimientos.filter(m => !m.eliminado);
    if (validMovs.length === 0) {
      showToast('No se cuenta con transacciones vigentes para exportar', 'error');
      return;
    }
    
    const bom = '\uFEFF';
    let header = 'TIPO,FECHA,CANTIDAD,DESCRIPCIÓN,UNIDAD,ÁREA/ORIGEN,NOTAS,RESPONSABLE\n';
    if (user.module === 'COMPRAS') {
      header = 'TIPO,FECHA,CANTIDAD,DESCRIPCIÓN,UNIDAD,ÁREA/ORIGEN,PROVEEDOR,FACTURA,FECHA FACTURA,COSTO UNITARIO,COSTO TOTAL,N_AUTORIZACION,QUIEN_RECIBE,RESPONSABLE_AREA,NOTAS,RESPONSABLE_SISTEMA\n';
    }

    const rows = [...validMovs]
      .sort((a, b) => { 
        if (a.fecha === b.fecha) return b.id - a.id; 
        return b.fecha.localeCompare(a.fecha); 
      })
      .map(r => {
        if (user.module === 'COMPRAS') {
          return [
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
          ].join(',');
        }
        return [
          r.tipo,
          r.fecha,
          r.cantidad,
          `"${r.descripcion}"`,
          `"${r.unidad}"`,
          `"${r.area}"`,
          `"${r.notas || ''}"`,
          `"${r.registradoPor}"`
        ].join(',');
      })
      .join('\n');

    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `CCU_Bitacora_General_${user.module}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('Historial descargado correctamente', 'success');
  };

  const handleClearHistoryConfirm = () => {
    if (confirm("⚠️⚠️ ATENCIÓN CONFIDENCIAL: Se anulará y eliminará TODO el historial del módulo restaurando inventarios a 0.")) {
      const code = prompt("Escribe 'BORRAR' para certificar:");
      if (code && code.toUpperCase() === 'BORRAR') {
        onClearHistory();
        showToast('Base de datos y stocks restaurados a cero', 'info');
      } else {
        showToast('Confirmación incorrecta, acción cancelada', 'warn');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#ddd9d0] gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-sans text-gray-900">
            Historial de Movimientos
          </h2>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            Bitácora de todos los registros del almacén. Los administradores pueden auditar eliminaciones.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onSync}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} />
            Sincronizar
          </button>
          {isAdmin && (
            <>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={13} />
                Exportar Historial
              </button>
              <button
                onClick={handleClearHistoryConfirm}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 border border-red-200 text-red-650 hover:bg-red-100 text-red-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash size={13} />
                Borrar Historial
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 bg-white border border-[#ddd9d0] p-4 rounded-xl shadow-sm">
        {!isRespSalidas && !isRespEntradas ? (
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="w-full text-xs md:text-sm border border-[#ddd9d0] rounded-lg p-2 bg-white focus:border-blue-600 focus:outline-none transition-colors"
          >
            <option value="">Todos los movimientos</option>
            <option value="ENTRADA">Solo Entradas</option>
            <option value="SALIDA">Solo Salidas</option>
          </select>
        ) : (
          <div className="text-xs text-gray-600 bg-gray-100 font-bold tracking-wider px-3 py-2 rounded-lg flex items-center uppercase">
            🚀 {isRespSalidas ? 'FILTRADO: SOLO ENTREGAS' : 'FILTRADO: SOLO RECEPCIONES'}
          </div>
        )}

        <div className="relative col-span-1 sm:col-span-1 md:col-span-1 flex items-center border border-[#ddd9d0] rounded-lg px-2 bg-white focus-within:border-blue-600 transition-colors">
          <Search size={14} className="text-gray-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar..."
            className="w-full text-xs md:text-sm text-gray-900 bg-white focus:outline-none uppercase"
          />
        </div>

        <input
          type="date"
          value={fechaIni}
          onChange={(e) => setFechaIni(e.target.value)}
          title="Fecha de Inicio"
          className="w-full text-xs md:text-sm border border-[#ddd9d0] rounded-lg p-2 bg-white focus:border-blue-600 focus:outline-none"
        />

        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          title="Fecha de Fin"
          className="w-full text-xs md:text-sm border border-[#ddd9d0] rounded-lg p-2 bg-white focus:border-blue-600 focus:outline-none"
        />
      </div>

      {/* Database History Table Wrapping Card */}
      <div className="bg-white border border-[#ddd9d0] rounded-xl shadow-sm overflow-hidden">
        {filteredMovs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm md:text-base font-semibold">No se encontraron registros cargados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-[#ddd9d0] font-sans font-bold text-[10px] md:text-xs text-gray-500 tracking-wider uppercase">
                  <th className="px-4 py-3.5">F. Registro</th>
                  <th className="px-4 py-3.5">Tipo</th>
                  <th className="px-4 py-3.5">Cant.</th>
                  <th className="px-4 py-3.5">Descripción</th>
                  <th className="px-4 py-3.5">Unidad</th>
                  <th className="px-4 py-3.5">Área de Destino</th>
                  {user.module === 'COMPRAS' && (
                    <th className="px-4 py-3.5">Detalles Finanzas / Destinatario</th>
                  )}
                  <th className="px-4 py-3.5">Comentarios</th>
                  <th className="px-4 py-3.5">Usuario</th>
                  {(isAdmin || isSup) && <th className="px-4 py-3.5 text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ddd9d0] whitespace-nowrap">
                {filteredMovs.map((m) => {
                  const tagColor = m.tipo === 'ENTRADA' 
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-red-50 text-red-700 border-red-200';
                  
                  const isAdjustment = m.area === 'AJUSTE MANUAL';
                  const isRowDeleted = m.eliminado;

                  return (
                    <tr 
                      key={m.id} 
                      className={`hover:bg-gray-50 transition-colors ${isRowDeleted ? 'opacity-50 bg-red-50 text-red-800 line-through' : ''}`}
                    >
                      {/* Register Date */}
                      <td className="px-4 py-3.5 font-mono text-[11px] text-gray-600">
                        {formatearFecha(m.fecha)}
                      </td>

                      {/* Type Badge */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-block border px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${isAdjustment ? 'bg-purple-100 text-purple-700 border-purple-200' : tagColor}`}>
                          {m.tipo}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3.5 font-bold text-gray-900">
                        {m.cantidad}
                      </td>

                      {/* Item Description */}
                      <td className="px-4 py-3.5 font-semibold text-gray-800 font-mono text-[12px]">
                        {m.descripcion}
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-3.5">
                        <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {m.unidad}
                        </span>
                      </td>

                      {/* Destination Area */}
                      <td className="px-4 py-3.5 text-gray-600 font-medium">
                        {m.area}
                      </td>

                      {/* Financial/Purchases Details */}
                      {user.module === 'COMPRAS' && (
                        <td className="px-4 py-3.5 text-[11px] leading-relaxed text-gray-500 whitespace-normal min-w-[200px]">
                          {m.tipo === 'ENTRADA' && !isAdjustment ? (
                            <div>
                              <div><b>Proveedor:</b> {m.prov || '-'}</div>
                              <div><b>Factura/Rem:</b> {m.fact || '-'} {m.fechaFact ? `(${formatearFecha(m.fechaFact)})` : ''}</div>
                              <div><b>Costo U:</b> ${m.costoUnit || '0'} (Total: ${m.costoTotal || '0'})</div>
                              <div><b>N° Aut:</b> {m.aut || '-'}</div>
                            </div>
                          ) : m.tipo === 'SALIDA' && !isAdjustment ? (
                            <div>
                              <div><b>Recibe:</b> {m.recibe || '-'}</div>
                              <div><b>Resp. Área:</b> {m.resp || '-'}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      )}

                      {/* Comments / Notes */}
                      <td className="px-4 py-3.5 text-gray-500 max-w-[200px] truncate whitespace-normal">
                        {m.notas || ''}
                        {isRowDeleted && (
                          <div className="text-[10px] text-red-600 font-bold border-t border-red-200 pt-0.5 mt-1">
                            🗑️ Eliminado por: {m.eliminadoPor}
                          </div>
                        )}
                      </td>

                      {/* Responsible User */}
                      <td className="px-4 py-3.5 font-medium text-gray-600">
                        {m.registradoPor}
                      </td>

                      {/* Admin/Supervisor Delete Trigger */}
                      {(isAdmin || isSup) && (
                        <td className="px-4 py-3.5 text-center">
                          {!isRowDeleted ? (
                            <button
                              onClick={() => onDeleteMovimiento(m.id)}
                              title="Anular Movimiento"
                              className="inline-flex items-center justify-center w-7 h-7 rounded bg-red-50 hover:bg-red-100 text-red-600 hover:border-red-350 border border-red-100 transition-all cursor-pointer"
                            >
                              ✕
                            </button>
                          ) : (
                            <span className="text-xs font-mono text-red-500 font-bold uppercase">Anulado</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
