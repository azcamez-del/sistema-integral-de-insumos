import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { User, Movimiento, CatalogoItem, UNIDADES } from '../types';
import { InventoryItem } from '../utils';
import AutocompleteInput from './AutocompleteInput';
import { PlusCircle, Trash, Upload, CheckCircle2, RefreshCw } from 'lucide-react';

interface MovementCaptureProps {
  user: User;
  onSave: (
    items: {
      cantidad: number;
      descripcion: string;
      unidad: string;
      area: string;
      notas: string;
      prov?: string;
      fact?: string;
      fechaFact?: string;
      costoUnit?: number;
      costoTotal?: number;
      aut?: string;
      tipoCompra?: string;
      recibe?: string;
      resp?: string;
    }[],
    catalogsToInsert: CatalogoItem[]
  ) => void;
  inventory: InventoryItem[];
  areas: string[];
  proveedores: string[];
  type: 'salida' | 'entrada';
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

interface CaptureRow {
  id: string;
  cantidad: string;
  descripcion: string;
  unidad: string;
  area: string;
  notas: string;
  prov: string;
  fact: string;
  fechaFact: string;
  costoUnit: string;
  aut: string;
  tipoCompra: string;
  recibe: string;
  resp: string;
}

export default function MovementCapture({
  user,
  onSave,
  inventory,
  areas,
  proveedores,
  type,
  showToast
}: MovementCaptureProps) {
  const isSalida = type === 'salida';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [fechaDisplay, setFechaDisplay] = useState('');
  const [rows, setRows] = useState<CaptureRow[]>([]);

  // Initialize form with 3 empty rows
  const generateId = () => 'row-' + Math.random().toString(36).substr(2, 9);
  
  const createEmptyRow = (): CaptureRow => ({
    id: generateId(),
    cantidad: '',
    descripcion: '',
    unidad: '',
    area: user.module === 'INSUMOS' ? '' : 'GENERAL',
    notas: '',
    prov: '',
    fact: '',
    fechaFact: '',
    costoUnit: '',
    aut: '',
    tipoCompra: 'RESURTIBLE',
    recibe: '',
    resp: ''
  });

  const resetForm = () => {
    setRows([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  };

  useEffect(() => {
    resetForm();
  }, [type, user.module]);

  useEffect(() => {
    if (!fecha) {
      setFechaDisplay('—');
      return;
    }
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    try {
      setFechaDisplay(new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', opts).toUpperCase());
    } catch {
      setFechaDisplay(fecha);
    }
  }, [fecha]);

  const addLine = () => {
    setRows(prev => [...prev, createEmptyRow()]);
  };

  const removeLine = (id: string) => {
    if (rows.length <= 1) {
      showToast('Debe haber al menos una línea en el registro', 'warn');
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const updateRowField = (id: string, field: keyof CaptureRow, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const selectAutocompleteItem = (id: string, item: { descripcion: string; unidad: string; actual?: number }) => {
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        return {
          ...r,
          descripcion: item.descripcion,
          unidad: item.unidad
        };
      }
      return r;
    }));
  };

  const validateAndSave = () => {
    if (!fecha) {
      showToast('Por favor, selecciona una fecha válida', 'error');
      return;
    }

    const itemsToSave: any[] = [];
    const catalogsToInsert: CatalogoItem[] = [];
    let hasError = false;

    for (const row of rows) {
      const qVal = row.cantidad.trim();
      const desc = row.descripcion.trim().toUpperCase();
      const unit = row.unidad.trim().toUpperCase();

      if (!qVal && !desc) continue; // Skip completely empty lines

      if (!qVal || !desc) {
        showToast('Cada fila debe tener cantidad y nombre de producto', 'error');
        hasError = true;
        break;
      }

      const qty = Math.max(0, Math.floor(Number(qVal) || 0));
      if (qty <= 0) {
        showToast(`La cantidad debe ser mayor a 0 en: "${desc}"`, 'error');
        hasError = true;
        break;
      }

      if (!unit) {
        showToast(`Asigne el tipo de unidad para: "${desc}"`, 'error');
        hasError = true;
        break;
      }

      // Check fields specific to configuration
      let targetArea = isSalida ? row.area.trim().toUpperCase() : 'ALMACÉN / EXTERNO';
      let rRecibe = row.recibe.trim().toUpperCase();
      let rResp = row.resp.trim().toUpperCase();
      let rProv = row.prov.trim().toUpperCase();
      let rFact = row.fact.trim().toUpperCase();
      let rCostoUnit = parseFloat(row.costoUnit) || 0;
      let rAut = row.aut.trim().toUpperCase();
      let rTipoCompra = row.tipoCompra;

      if (user.module === 'COMPRAS') {
        if (isSalida) {
          if (!targetArea || !rRecibe || !rResp) {
            showToast(`Completa los datos de departamento de destino y responsables en "${desc}"`, 'error');
            hasError = true;
            break;
          }
        } else {
          if (!rProv || !rFact || !rAut) {
            showToast(`Faltan datos financieros de compra (Prov/Fact/Aut) en "${desc}"`, 'error');
            hasError = true;
            break;
          }
        }
      } else {
        if (isSalida && !targetArea) {
          showToast(`Defina un destino válido para el artículo "${desc}".`, 'error');
          hasError = true;
          break;
        }
      }

      // If salida, enforce stock availability
      if (isSalida) {
        const prodData = inventory.find(i => i.descripcion.toUpperCase() === desc && i.unidad.toUpperCase() === unit);
        if (!prodData) {
          showToast(`El artículo "${desc} (${unit})" no existe en almacén.`, 'error');
          hasError = true;
          break;
        } else if (prodData.actual < qty) {
          showToast(`No hay suficiente stock físico de "${desc} (${unit})". Disponible: ${prodData.actual}, Solicitado: ${qty}.`, 'error');
          hasError = true;
          break;
        }
      }

      itemsToSave.push({
        cantidad: qty,
        descripcion: desc,
        unidad: unit,
        area: targetArea || 'ALMACÉN / EXTERNO',
        notas: row.notes || row.notas.trim().toUpperCase() || '',
        prov: rProv,
        fact: rFact,
        fechaFact: row.fechaFact,
        costoUnit: rCostoUnit,
        costoTotal: rCostoUnit * qty,
        aut: rAut,
        tipoCompra: rTipoCompra,
        recibe: rRecibe,
        resp: rResp
      });

      if (!isSalida) {
        catalogsToInsert.push({
          descripcion: desc,
          unidad: unit,
          tipoCompra: rTipoCompra || 'RESURTIBLE'
        });
      }
    }

    if (hasError) return;
    if (itemsToSave.length === 0) {
      showToast('Registre al menos un producto con descripción y cantidad', 'error');
      return;
    }

    onSave(itemsToSave, catalogsToInsert);
    showToast(`✅ Se guardaron (${itemsToSave.length}) movimientos de forma correcta`, 'success');
    resetForm();
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[0]]);
        
        let addedCount = 0;
        const importedRows: CaptureRow[] = [];

        json.forEach(row => {
          const keys = Object.keys(row);
          const cantKey = keys.find(k => k.toUpperCase().includes('CANTIDAD') || k.toUpperCase() === 'CANT');
          const descKey = keys.find(k => k.toUpperCase().includes('DESCRIPCI') || k.toUpperCase() === 'PRODUCTO' || k.toUpperCase() === 'ARTICULO');
          const unidKey = keys.find(k => k.toUpperCase().includes('UNIDAD') || k.toUpperCase().includes('MEDIDA') || k.toUpperCase() === 'UM');
          
          const provKey = keys.find(k => k.toUpperCase().includes('PROVEEDOR') || k.toUpperCase() === 'PROV');
          const factKey = keys.find(k => k.toUpperCase().includes('FACTURA') || k.toUpperCase() === 'REMISION');
          const costoKey = keys.find(k => k.toUpperCase().includes('COSTO') || k.toUpperCase().includes('PRECIO'));
          const autKey = keys.find(k => k.toUpperCase().includes('AUTORIZ') || k.toUpperCase() === 'AUT');

          if (cantKey && descKey && unidKey) {
            const qtyStr = String(row[cantKey] || '');
            const descStr = String(row[descKey] || '').trim().toUpperCase();
            const unidStr = String(row[unidKey] || '').trim().toUpperCase();

            if (qtyStr && descStr && unidStr) {
              const cUnitStr = costoKey ? String(row[costoKey] || '0') : '0';
              const pStr = provKey ? String(row[provKey] || '').trim().toUpperCase() : 'EXCEL IMPORT';
              const fStr = factKey ? String(row[factKey] || '').trim().toUpperCase() : 'S/F';
              const aStr = autKey ? String(row[autKey] || '').trim().toUpperCase() : user.name;

              importedRows.push({
                id: generateId(),
                cantidad: qtyStr,
                descripcion: descStr,
                unidad: unidStr,
                area: 'ALMACÉN / EXTERNO',
                notas: 'CARGA EXCEL PROVEEDOR',
                prov: pStr,
                fact: fStr,
                fechaFact: '',
                costoUnit: cUnitStr,
                aut: aStr,
                tipoCompra: 'RESURTIBLE',
                recibe: '',
                resp: ''
              });
              addedCount++;
            }
          }
        });

        if (addedCount > 0) {
          // Replace rows with imported data
          setRows(importedRows);
          showToast(`📊 Se pre-cargaron (${addedCount}) remisiones del Excel. Revisa y haz clic en "Guardar" para conservarlos.`, 'success');
        } else {
          showToast(`No se encontraron columnas requeridas (Cantidad, Descripción, Unidad) en el documento.`, 'warn');
        }
      } catch (err) {
        showToast(`Error de procesamiento al leer el archivo Excel.`, 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#ddd9d0] gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-sans text-gray-900">
            {user.module === 'COMPRAS' 
              ? (isSalida ? 'Registro de Entregas' : 'Ingreso de Entradas') 
              : (isSalida ? 'Captura de Salidas' : 'Ingreso de Entradas')}
          </h2>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            {user.module === 'COMPRAS'
              ? (isSalida ? 'Salida de las compras autorizadas a sus respectivos departamentos y personal' : 'Registro de mercancía nueva al almacén por parte de proveedores')
              : (isSalida ? 'Registro de insumos entregados a las áreas' : 'Registro de mercancía nueva al almacén')}
          </p>
        </div>
        {!isSalida && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleExcelUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
            >
              <Upload size={14} />
              Cargar Excel de Proveedores
            </button>
          </div>
        )}
      </div>

      <div className="captura-card bg-white rounded-xl border border-[#ddd9d0] shadow-sm overflow-hidden">
        {/* Banner header change color according to movement type */}
        <div className={`p-5 text-white ${isSalida ? 'bg-gradient-to-r from-gray-900 to-amber-950' : 'bg-gradient-to-r from-emerald-600 to-green-800'}`}>
          <h3 className="text-sm md:text-base font-bold tracking-wider uppercase">
            {isSalida 
              ? (user.module === 'COMPRAS' ? 'CONTROL DE ENTREGAS' : 'REGISTRO DE SALIDA DE ALMACÉN') 
              : 'REGISTRO DE ENTRADA A INVENTARIO'}
          </h3>
          <p className="text-xs text-white/80 mt-0.5">
            Complete los datos del día y agregue los artículos asignados
          </p>
          <div className="text-xl md:text-2xl font-mono text-sky-200 mt-3 font-semibold">
            {fechaDisplay || '—'}
          </div>
        </div>

        <div className="p-5 md:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group pb-0">
              <label className="block text-xs font-bold text-gray-700 mb-1">Fecha del Movimiento</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-3 py-1.8 text-xs md:text-sm text-gray-900 bg-white focus:border-blue-600 focus:outline-none transition-colors"
              />
            </div>
            <div className="form-group pb-0">
              <label className="block text-xs font-bold text-gray-700 mb-1">Registrado por</label>
              <input
                type="text"
                value={user.name}
                readOnly
                className="w-full border border-[#ddd9d0] rounded-lg px-3 py-1.8 text-xs md:text-sm text-gray-500 bg-gray-50 cursor-not-allowed uppercase"
              />
            </div>
          </div>

          {/* Form Rows Container */}
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[850px] space-y-2">
              {/* Table Header Row */}
              <div className="grid gap-2 font-sans font-bold text-[10px] md:text-xs text-gray-500 tracking-wider bg-gray-50 uppercase py-2.5 px-3 rounded-lg border border-[#ddd9d0] align-middle"
                style={{
                  gridTemplateColumns: user.module === 'INSUMOS'
                    ? (isSalida ? '80px 1.8fr 110px 1.5fr 1.5fr 40px' : '80px 1.8fr 110px 2fr 40px')
                    : (isSalida ? '70px 1.5fr 90px 1.2fr 1.2fr 1.2fr 1.5fr 40px' : '60px 1.5fr 80px 1.2fr 90px 110px 80px 90px 90px 1.2fr 35px')
                }}
              >
                <div>Cantidad</div>
                <div>{isSalida ? (user.module === 'COMPRAS' ? 'Producto Comprado' : 'Producto en Almacén') : 'Descripción Artículo'}</div>
                <div>Unidad</div>
                
                {user.module === 'INSUMOS' ? (
                  isSalida ? (
                    <>
                      <div>Área de Destino</div>
                      <div>Observaciones</div>
                    </>
                  ) : (
                    <div>Proveedor / Detalle adicional</div>
                  )
                ) : (
                  isSalida ? (
                    <>
                      <div>Departamento</div>
                      <div>Recibido por</div>
                      <div>Responsable Área</div>
                      <div>Notas</div>
                    </>
                  ) : (
                    <>
                      <div>Proveedor</div>
                      <div>Factura</div>
                      <div>F. Factura</div>
                      <div>Costo U.$</div>
                      <div>N° Autoriza</div>
                      <div>Tipo</div>
                      <div>Comentarios</div>
                    </>
                  )
                )}
                <div className="text-center"></div>
              </div>

              {/* Rows List */}
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid gap-2 border border-[#ddd9d0] bg-white rounded-lg p-2 md:p-3 items-center"
                  style={{
                    gridTemplateColumns: user.module === 'INSUMOS'
                      ? (isSalida ? '80px 1.8fr 110px 1.5fr 1.5fr 40px' : '80px 1.8fr 110px 2fr 40px')
                      : (isSalida ? '70px 1.5fr 90px 1.2fr 1.2fr 1.2fr 1.5fr 40px' : '60px 1.5fr 80px 1.2fr 90px 110px 80px 90px 90px 1.2fr 35px')
                  }}
                >
                  {/* Cantidad */}
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={row.cantidad}
                    onChange={(e) => updateRowField(row.id, 'cantidad', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-2 py-1.5 text-xs text-gray-900 font-bold text-center focus:border-blue-600 focus:outline-none transition-all"
                  />

                  {/* Autocomplete Producto */}
                  <AutocompleteInput
                    value={row.descripcion}
                    onChange={(val) => updateRowField(row.id, 'descripcion', val)}
                    onSelect={(item) => selectAutocompleteItem(row.id, item)}
                    suggestions={inventory}
                    placeholder={isSalida ? "Buscar existencia..." : "Artículo..."}
                    isSalida={isSalida}
                  />

                  {/* Unidad Dropdown: disabled in salida to prevent mismatch */}
                  <select
                    value={row.unidad}
                    onChange={(e) => updateRowField(row.id, 'unidad', e.target.value)}
                    disabled={isSalida}
                    className={`w-full border-1.5 border-[#ddd9d0] rounded-lg px-1.5 py-1.5 text-xs font-semibold focus:border-blue-600 focus:outline-none transition-all ${isSalida ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-800'}`}
                  >
                    <option value="">MEDIDA...</option>
                    {UNIDADES.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>

                  {/* INSUMOS Module Fields */}
                  {user.module === 'INSUMOS' && (
                    isSalida ? (
                      <>
                        {/* Área de Destino */}
                        <select
                          value={row.area}
                          onChange={(e) => updateRowField(row.id, 'area', e.target.value)}
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-2 py-1.5 text-xs bg-white focus:border-blue-600 focus:outline-none transition-all"
                        >
                          <option value="">SELECCIONE ÁREA...</option>
                          {areas.map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                        {/* Observaciones */}
                        <input
                          type="text"
                          value={row.notas}
                          onChange={(e) => updateRowField(row.id, 'notas', e.target.value)}
                          placeholder="Comentarios..."
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none transition-all uppercase"
                        />
                      </>
                    ) : (
                      /* Proveedor u observaciones */
                      <input
                        type="text"
                        value={row.notas}
                        onChange={(e) => updateRowField(row.id, 'notas', e.target.value)}
                        placeholder="Proveedor u observaciones..."
                        className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none transition-all uppercase"
                      />
                    )
                  )}

                  {/* COMPRAS Module Fields */}
                  {user.module === 'COMPRAS' && (
                    isSalida ? (
                      <>
                        {/* Departamento / Area */}
                        <select
                          value={row.area}
                          onChange={(e) => updateRowField(row.id, 'area', e.target.value)}
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-2 py-1.5 text-xs bg-white focus:border-blue-600 focus:outline-none transition-all"
                        >
                          <option value="">ASIGNAR DEPTO...</option>
                          {areas.map(a => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                        {/* Recibido por */}
                        <input
                          type="text"
                          value={row.recibe}
                          onChange={(e) => updateRowField(row.id, 'recibe', e.target.value)}
                          placeholder="Recibido por"
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none transition-all uppercase"
                        />
                        {/* Responsable de Área */}
                        <input
                          type="text"
                          value={row.resp}
                          onChange={(e) => updateRowField(row.id, 'resp', e.target.value)}
                          placeholder="Responsable Area"
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none transition-all uppercase"
                        />
                        {/* Notas */}
                        <input
                          type="text"
                          value={row.notas}
                          onChange={(e) => updateRowField(row.id, 'notas', e.target.value)}
                          placeholder="Observaciones..."
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none transition-all uppercase"
                        />
                      </>
                    ) : (
                      <>
                        {/* Proveedor */}
                        <select
                          value={row.prov}
                          onChange={(e) => updateRowField(row.id, 'prov', e.target.value)}
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-1 py-1.5 text-xs bg-white focus:border-blue-600 focus:outline-none transition-all"
                        >
                          <option value="">PROVEEDOR...</option>
                          {proveedores.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        {/* Factura */}
                        <input
                          type="text"
                          value={row.fact}
                          onChange={(e) => updateRowField(row.id, 'fact', e.target.value)}
                          placeholder="Factura"
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-1.5 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none transition-all uppercase"
                        />
                        {/* Fecha Factura */}
                        <input
                          type="date"
                          value={row.fechaFact}
                          onChange={(e) => updateRowField(row.id, 'fechaFact', e.target.value)}
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-1.5 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:border-blue-600"
                        />
                        {/* Costo */}
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.costoUnit}
                          onChange={(e) => updateRowField(row.id, 'costoUnit', e.target.value)}
                          placeholder="Cost.$"
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-1.5 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none transition-all"
                        />
                        {/* N° Autorizacion */}
                        <input
                          type="text"
                          value={row.aut}
                          onChange={(e) => updateRowField(row.id, 'aut', e.target.value)}
                          placeholder="N° Aut"
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-1.5 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none transition-all uppercase"
                        />
                        {/* Tipo de Compra */}
                        <select
                          value={row.tipoCompra}
                          onChange={(e) => updateRowField(row.id, 'tipoCompra', e.target.value)}
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-1 py-1.5 text-xs bg-white focus:border-blue-600"
                        >
                          <option value="RESURTIBLE">RESURTIBLE</option>
                          <option value="UNICA">COMPRA ÚNICA</option>
                        </select>
                        {/* Comentarios */}
                        <input
                          type="text"
                          value={row.notas}
                          onChange={(e) => updateRowField(row.id, 'notas', e.target.value)}
                          placeholder="Detalles..."
                          className="w-full border-1.5 border-[#ddd9d0] rounded-lg px-1.5 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none transition-all uppercase"
                        />
                      </>
                    )
                  )}

                  {/* Remove Button */}
                  <div className="text-center">
                    <button
                      onClick={() => removeLine(row.id)}
                      className="inline-flex justify-center items-center w-8 h-8 rounded-lg border-1.5 border-[#ddd9d0] text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-[#ddd9d0]">
            <button
              onClick={addLine}
              className="px-4 py-2 text-xs md:text-sm font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle size={14} />
              + Agregar línea
            </button>
            <button
              onClick={validateAndSave}
              className={`px-5 py-2 text-xs md:text-sm font-bold rounded-lg text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${isSalida ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/10' : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/10'}`}
            >
              <CheckCircle2 size={15} />
              {isSalida ? (user.module === 'COMPRAS' ? '💾 Guardar entregas' : '💾 Guardar salidas') : '💾 Guardar entradas'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-xs md:text-sm font-semibold rounded-lg bg-gray-50 text-gray-500 border border-[#ddd9d0] hover:bg-gray-100 transition-all flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} />
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
