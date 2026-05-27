import React, { useState, useEffect } from 'react';
import { User, Movimiento, CatalogoItem, UNIDADES } from './types';
import { getInventarioActual, InventoryItem } from './utils';
import { db, auth, ensureClientSession, OperationType, handleFirestoreError } from './firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// Import our modular pages/tabs components
import LoginScreen from './components/LoginScreen';
import MovementCapture from './components/MovementCapture';
import InventoryTab from './components/InventoryTab';
import DatabaseTab from './components/DatabaseTab';
import AreasTab from './components/AreasTab';
import ReportTab from './components/ReportTab';

import { LogOut, Package, Database, ShieldAlert, History, MapPin, BarChart3, Scale } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'captura' | 'entradas' | 'inventario' | 'basedatos' | 'areas' | 'reportes'>('basedatos');

  // Core database states
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [catalogoMaestro, setCatalogoMaestro] = useState<CatalogoItem[]>([]);
  const [areasMaestras, setAreasMaestras] = useState<string[]>([]);
  const [proveedoresMaestros, setProveedoresMaestros] = useState<string[]>([]);

  // Toast notification state
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warn' | 'info' | '' } | null>(null);

  // Stock Manual Adjustment Modal State
  const [adjustmentModal, setAdjustmentModal] = useState<{
    isOpen: boolean;
    descripcion: string;
    unidad: string;
    cantidad: string;
    tipo: 'ENTRADA' | 'SALIDA';
    fecha: string;
    notas: string;
  }>({
    isOpen: false,
    descripcion: '',
    unidad: '',
    cantidad: '',
    tipo: 'ENTRADA',
    fecha: '',
    notas: ''
  });

  // Synchronous cloud database syncing and module separation
  useEffect(() => {
    if (!currentUser) return;

    ensureClientSession();

    const moduleId = currentUser.module;

    // Real-time synchronization of physical movements
    const qMovs = query(collection(db, 'modules', moduleId, 'movimientos'));
    const unsubMovs = onSnapshot(qMovs, (snapshot) => {
      const list: Movimiento[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        list.push({
          docId: doc.id,
          id: d.id,
          tipo: d.tipo,
          fecha: d.fecha,
          cantidad: Math.floor(Number(d.cantidad) || 0),
          descripcion: d.descripcion,
          unidad: d.unidad,
          area: d.area,
          notas: d.notas || '',
          registradoPor: d.registradoPor || '',
          eliminado: !!d.eliminado,
          eliminadoPor: d.eliminadoPor || undefined,
          prov: d.prov || undefined,
          fact: d.fact || undefined,
          fechaFact: d.fechaFact || undefined,
          costoUnit: d.costoUnit !== undefined ? Number(d.costoUnit) : undefined,
          costoTotal: d.costoTotal !== undefined ? Number(d.costoTotal) : undefined,
          aut: d.aut || undefined,
          tipoCompra: d.tipoCompra || undefined,
          recibe: d.recibe || undefined,
          resp: d.resp || undefined
        });
      });
      // Sort descending by movement timestamp or logical ID
      list.sort((a, b) => b.id - a.id);
      setMovimientos(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `modules/${moduleId}/movimientos`);
    });

    // Real-time synchronization of master product catalogue
    const qCat = query(collection(db, 'modules', moduleId, 'catalogo'));
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      const list: CatalogoItem[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        list.push({
          descripcion: d.descripcion,
          unidad: d.unidad,
          tipoCompra: d.tipoCompra || undefined
        });
      });
      setCatalogoMaestro(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `modules/${moduleId}/catalogo`);
    });

    // Real-time synchronization of department areas
    const qAreas = query(collection(db, 'modules', moduleId, 'areas'));
    const unsubAreas = onSnapshot(qAreas, (snapshot) => {
      const list: string[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        if (d.name) {
          list.push(d.name);
        }
      });
      if (list.length === 0) {
        seedDefaultAreas(moduleId);
      } else {
        setAreasMaestras(list);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `modules/${moduleId}/areas`);
    });

    // Real-time synchronization of suppliers
    const qProvs = query(collection(db, 'modules', moduleId, 'proveedores'));
    const unsubProvs = onSnapshot(qProvs, (snapshot) => {
      const list: string[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        if (d.name) {
          list.push(d.name);
        }
      });
      if (list.length === 0 && moduleId === 'COMPRAS') {
        seedDefaultProveedores(moduleId);
      } else {
        setProveedoresMaestros(list);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `modules/${moduleId}/proveedores`);
    });

    return () => {
      unsubMovs();
      unsubCat();
      unsubAreas();
      unsubProvs();
    };
  }, [currentUser]);

  const seedDefaultAreas = async (moduleId: string) => {
    const defaultAreas = moduleId === 'INSUMOS'
      ? [
          'GENERAL TURNO MATUTINO',
          'GENERAL TURNO VESPERTINO',
          'LANDING',
          'COMPAÑÍAS ARTÍSTICAS',
          'DIRECCIÓN CCU',
          'MANTENIMIENTO',
          'BAÑOS CONVENCIÓN',
          'BAÑOS DE LANDING',
          'GENERAL'
        ]
      : ['GENERAL', 'DIRECCIÓN CCU', 'OFICINAS ADMINISTRATIVAS', 'TEATRO', 'AUDITORIO'];

    for (const name of defaultAreas) {
      const slug = name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
      try {
        await setDoc(doc(db, 'modules', moduleId, 'areas', slug), { name });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `modules/${moduleId}/areas/${slug}`);
      }
    }
  };

  const seedDefaultProveedores = async (moduleId: string) => {
    const defaultProvs = ['OFFICE DEPOT', 'HOME DEPOT', 'AMAZON', 'MERCADO LIBRE'];
    for (const name of defaultProvs) {
      const slug = name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
      try {
        await setDoc(doc(db, 'modules', moduleId, 'proveedores', slug), { name });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `modules/${moduleId}/proveedores/${slug}`);
      }
    }
  };

  const showToast = (msg: string, type: 'success' | 'error' | 'warn' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleLoginSuccess = (userObj: User) => {
    setCurrentUser(userObj);

    // Default starting tab based on roles
    if (userObj.role === 'responsable_salidas') {
      setActiveTab('captura');
    } else if (userObj.role === 'responsable_entradas') {
      setActiveTab('entradas');
    } else {
      setActiveTab('basedatos');
    }

    showToast(`Bienvenido al sistema, ${userObj.name}`, 'success');
  };

  const handleLogout = () => {
    // Purge memory references to avoid context leak
    setCurrentUser(null);
    setMovimientos([]);
    setCatalogoMaestro([]);
    setAreasMaestras([]);
    setProveedoresMaestros([]);
    showToast('Sesión cerrada con éxito', 'info');
  };

  const syncData = () => {
    if (!currentUser) return;
    showToast('Datos sincronizados en tiempo real con la nube', 'success');
  };

  // Capture submit action
  const handleSaveMovement = async (
    items: {
      cantidad: number;
      descripcion: string;
      unidad: string;
      area: string;
      notas: string;
      prov?: string;
      fact?: string;
      shadowUnit?: string;
      fechaFact?: string;
      costoUnit?: number;
      costoTotal?: number;
      aut?: string;
      tipoCompra?: string;
      recibe?: string;
      resp?: string;
    }[],
    catalogsToInsert: CatalogoItem[]
  ) => {
    if (!currentUser) return;
    const moduleId = currentUser.module;

    // 1. Core Master Catalogo items update
    for (const cand of catalogsToInsert) {
      const cleanDesc = cand.descripcion.trim().toUpperCase();
      const cleanUnit = cand.unidad.trim().toUpperCase();
      const docId = `${cleanDesc}___${cleanUnit}`.replace(/[^a-zA-Z0-9]/g, '_');

      try {
        await setDoc(doc(db, 'modules', moduleId, 'catalogo', docId), {
          descripcion: cleanDesc,
          unidad: cleanUnit,
          tipoCompra: cand.tipoCompra || 'RESURTIBLE'
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `modules/${moduleId}/catalogo/${docId}`);
      }
    }

    // 2. Generate and push movements
    const timestamp = Date.now();
    for (let index = 0; index < items.length; index++) {
      const i = items[index];
      const movIdStr = `${timestamp}_${index}_${Math.floor(Math.random() * 1000)}`;

      const dataToSave: any = {
        id: timestamp + index + Math.random(),
        tipo: activeTab === 'captura' ? 'SALIDA' : 'ENTRADA',
        fecha: new Date().toISOString().split('T')[0], // Enforces current local date
        cantidad: Math.floor(Number(i.cantidad) || 0),
        descripcion: i.descripcion.trim().toUpperCase(),
        unidad: i.unidad.trim().toUpperCase(),
        area: i.area.trim().toUpperCase(),
        notas: i.notas ? i.notas.trim().toUpperCase() : '',
        registradoPor: currentUser.name,
        eliminado: false,
        timestamp: timestamp
      };

      if (i.prov) dataToSave.prov = i.prov.trim().toUpperCase();
      if (i.fact) dataToSave.fact = i.fact.trim().toUpperCase();
      if (i.fechaFact) dataToSave.fechaFact = i.fechaFact;
      if (i.costoUnit !== undefined) dataToSave.costoUnit = Number(i.costoUnit);
      if (i.costoTotal !== undefined) dataToSave.costoTotal = Number(i.costoTotal);
      if (i.aut) dataToSave.aut = i.aut.trim().toUpperCase();
      if (i.tipoCompra) dataToSave.tipoCompra = i.tipoCompra.trim().toUpperCase();
      if (i.recibe) dataToSave.recibe = i.recibe.trim().toUpperCase();
      if (i.resp) dataToSave.resp = i.resp.trim().toUpperCase();

      try {
        await setDoc(doc(db, 'modules', moduleId, 'movimientos', movIdStr), dataToSave);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `modules/${moduleId}/movimientos/${movIdStr}`);
      }
    }

    showToast('Movimientos registrados y guardados en la nube', 'success');
  };

  // Admin audit: cancel transaction
  const handleDeleteMovimiento = async (id: number) => {
    if (!currentUser) return;
    const targetMov = movimientos.find(m => m.id === id);
    if (!targetMov || !targetMov.docId) {
      showToast('No se encontró el identificador de documento en la nube', 'error');
      return;
    }

    if (confirm("⚠️ ¿Deseas anular este movimiento? Se ajustará el inventario inmediatamente, conservando la trazabilidad de auditoría.")) {
      try {
        await setDoc(doc(db, 'modules', currentUser.module, 'movimientos', targetMov.docId), {
          eliminado: true,
          eliminadoPor: currentUser.name
        }, { merge: true });
        showToast('Movimiento cancelado por auditoría', 'warn');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `modules/${currentUser.module}/movimientos/${targetMov.docId}`);
      }
    }
  };

  // Admin audit: clear module history database reset
  const handleClearHistory = async () => {
    if (!currentUser) return;
    if (confirm("⚠️ ¿Estás seguro de que deseas vaciar por completo el historial de movimientos de este módulo de la nube? Esta acción no se puede deshacer.")) {
      const moduleId = currentUser.module;
      for (const m of movimientos) {
        if (m.docId) {
          try {
            await deleteDoc(doc(db, 'modules', moduleId, 'movimientos', m.docId));
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `modules/${moduleId}/movimientos/${m.docId}`);
          }
        }
      }
      showToast('Se eliminaron todos los movimientos de la nube', 'info');
    }
  };

  // Add areas or suppliers to active module
  const handleAddArea = async (area: string) => {
    if (!currentUser) return;
    const cleanArea = area.trim().toUpperCase();
    const slug = cleanArea.replace(/[^a-zA-Z0-9]/g, '_');
    try {
      await setDoc(doc(db, 'modules', currentUser.module, 'areas', slug), { name: cleanArea });
      showToast(`Área ${cleanArea} agregada con éxito`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `modules/${currentUser.module}/areas/${slug}`);
    }
  };

  const handleRemoveArea = async (area: string) => {
    if (!currentUser) return;
    const cleanArea = area.trim().toUpperCase();
    const slug = cleanArea.replace(/[^a-zA-Z0-9]/g, '_');
    try {
      await deleteDoc(doc(db, 'modules', currentUser.module, 'areas', slug));
      showToast(`Área ${cleanArea} eliminada`, 'warn');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `modules/${currentUser.module}/areas/${slug}`);
    }
  };

  const handleAddProv = async (prov: string) => {
    if (!currentUser) return;
    const cleanProv = prov.trim().toUpperCase();
    const slug = cleanProv.replace(/[^a-zA-Z0-9]/g, '_');
    try {
      await setDoc(doc(db, 'modules', currentUser.module, 'proveedores', slug), { name: cleanProv });
      showToast(`Proveedor ${cleanProv} agregado con éxito`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `modules/${currentUser.module}/proveedores/${slug}`);
    }
  };

  const handleRemoveProv = async (prov: string) => {
    if (!currentUser) return;
    const cleanProv = prov.trim().toUpperCase();
    const slug = cleanProv.replace(/[^a-zA-Z0-9]/g, '_');
    try {
      await deleteDoc(doc(db, 'modules', currentUser.module, 'proveedores', slug));
      showToast(`Proveedor ${cleanProv} eliminado`, 'warn');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `modules/${currentUser.module}/proveedores/${slug}`);
    }
  };

  // Adjustments Modal Controls
  const openAdjustmentModal = (item: { descripcion: string; unidad: string }) => {
    setAdjustmentModal({
      isOpen: true,
      descripcion: item.descripcion,
      unidad: item.unidad,
      cantidad: '',
      tipo: 'ENTRADA',
      fecha: new Date().toISOString().split('T')[0],
      notas: ''
    });
  };

  const closeAdjustmentModal = () => {
    setAdjustmentModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleSaveAdjustment = async () => {
    if (!currentUser) return;
    const qty = Math.max(1, Math.floor(Number(adjustmentModal.cantidad) || 0));
    const desc = adjustmentModal.descripcion.trim().toUpperCase();
    const unit = adjustmentModal.unidad.trim().toUpperCase();
    const notes = adjustmentModal.notas.trim().toUpperCase();
    const dateStr = adjustmentModal.fecha;

    if (!dateStr) {
      showToast('Por favor, defina la fecha de corrección', 'error');
      return;
    }
    if (qty <= 0) {
      showToast('La cantidad física debe ser mayor a 0', 'error');
      return;
    }
    if (!notes) {
      showToast('El motivo de auditoría es totalmente obligatorio', 'error');
      return;
    }

    if (adjustmentModal.tipo === 'SALIDA') {
      const activeInventory = getInventarioActual(movimientos, catalogoMaestro);
      const prod = activeInventory.find(i => i.descripcion === desc && i.unidad === unit);
      if (!prod || prod.actual < qty) {
        showToast('No puede retirar más mercancía de la que reside actualmente en stock.', 'error');
        return;
      }
    }

    const moduleId = currentUser.module;
    const timestamp = Date.now();
    const movIdStr = `${timestamp}_adjust_${Math.floor(Math.random() * 1000)}`;

    const adjustmentMov = {
      id: timestamp + Math.random(),
      tipo: adjustmentModal.tipo,
      fecha: dateStr,
      cantidad: qty,
      descripcion: desc,
      unidad: unit,
      area: 'AJUSTE MANUAL',
      notas: `[AUDITORÍA]: ${notes}`,
      registradoPor: currentUser.name,
      eliminado: false,
      timestamp: timestamp
    };

    try {
      await setDoc(doc(db, 'modules', moduleId, 'movimientos', movIdStr), adjustmentMov);
      closeAdjustmentModal();
      showToast('Ajuste de inventario guardado en bitácora de auditoría', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `modules/${moduleId}/movimientos/${movIdStr}`);
    }
  };

  // Calculate isolated stocks on module load
  const currentInventory = getInventarioActual(movimientos, catalogoMaestro);

  // If user is not logged in, render only Login screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Calculate customized visual styles
  const isCompras = currentUser.module === 'COMPRAS';
  const isRespSalidas = currentUser.role === 'responsable_salidas';
  const isRespEntradas = currentUser.role === 'responsable_entradas';
  const isAdmin = currentUser.role === 'admin';
  const isSup = currentUser.role === 'supervisor';

  let roleLabel = currentUser.role.toUpperCase().replace('_', ' ');
  if (roleLabel === 'RESPONSABLE SALIDAS') roleLabel = 'ENTREGAS';
  if (roleLabel === 'RESPONSABLE ENTRADAS') roleLabel = 'RECEPCIÓN';

  const userDotColor = isAdmin
    ? 'bg-purple-400'
    : isSup
      ? 'bg-sky-400'
      : 'bg-emerald-400';

  return (
    <div id="app" className="min-h-screen flex flex-col bg-[#f5f3ee] text-[#1a1814] font-sans">
      
      {/* Dynamic Navigation Header */}
      <header className="bg-[#1a1814] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="header-left flex items-center gap-4">
          <span className="header-logo font-mono text-xs md:text-sm tracking-[2px] font-bold uppercase">
            CCU · <span className="text-sky-400">{currentUser.module}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="user-chip flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs uppercase tracking-wider font-semibold">
            <span className={`w-2.5 h-2.5 rounded-full ${userDotColor}`} />
            <span id="user-name-display">{currentUser.name}</span>
            <span className="text-white/45 text-[10px] md:inline hidden">({roleLabel})</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white py-1.5 px-3 border border-white/25 rounded-md text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            Salir
          </button>
        </div>
      </header>

      {/* Tabs Layout Navigation */}
      <nav id="main-nav" className="bg-white border-b border-[#ddd9d0] px-6 py-0 flex gap-1.5 overflow-x-auto scrollbar-none print:hidden">
        {(isAdmin || isSup || isRespSalidas) && (
          <button
            onClick={() => setActiveTab('captura')}
            className={`nav-btn py-4 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'captura' ? 'border-blue-650 text-blue-601 font-bold border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            {isCompras ? <Package size={15} /> : <Database size={15} />}
            {isCompras ? 'Entregas (Salidas)' : 'Salidas (Despacho)'}
          </button>
        )}

        {(isAdmin || isSup || isRespEntradas) && (
          <button
            onClick={() => setActiveTab('entradas')}
            className={`nav-btn py-4 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'entradas' ? 'border-blue-650 text-blue-601 font-bold border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <ShieldAlert size={15} />
            Ingreso de Entradas
          </button>
        )}

        {(isAdmin || isSup) && (
          <button
            onClick={() => setActiveTab('inventario')}
            className={`nav-btn py-4 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'inventario' ? 'border-blue-650 text-blue-601 font-bold border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <Package size={15} />
            Inventario Actual
          </button>
        )}

        <button
          onClick={() => setActiveTab('basedatos')}
          className={`nav-btn py-4 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'basedatos' ? 'border-blue-650 text-blue-610 font-bold border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
        >
          <History size={15} />
          Historial
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('areas')}
            className={`nav-btn py-4 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'areas' ? 'border-blue-650 text-blue-601 font-bold border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <MapPin size={15} />
            {isCompras ? 'Áreas / Proveedores' : 'Áreas'}
          </button>
        )}

        {(isAdmin || isSup) && (
          <button
            onClick={() => setActiveTab('reportes')}
            className={`nav-btn py-4 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'reportes' ? 'border-blue-650 text-blue-601 font-bold border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <BarChart3 size={15} />
            Reportes y Analíticas
          </button>
        )}
      </nav>

      {/* Main Tab Panel Screen Container */}
      <main className="flex-1 py-8 px-6 max-w-7xl mx-auto w-full">
        {activeTab === 'captura' && (isAdmin || isSup || isRespSalidas) && (
          <MovementCapture
            user={currentUser}
            onSave={handleSaveMovement}
            inventory={currentInventory}
            areas={areasMaestras}
            proveedores={proveedoresMaestros}
            type="salida"
            showToast={showToast}
          />
        )}

        {activeTab === 'entradas' && (isAdmin || isSup || isRespEntradas) && (
          <MovementCapture
            user={currentUser}
            onSave={handleSaveMovement}
            inventory={currentInventory}
            areas={areasMaestras}
            proveedores={proveedoresMaestros}
            type="entrada"
            showToast={showToast}
          />
        )}

        {activeTab === 'inventario' && (isAdmin || isSup) && (
          <InventoryTab
            user={currentUser}
            inventory={currentInventory}
            onOpenAdjustment={openAdjustmentModal}
            showToast={showToast}
          />
        )}

        {activeTab === 'basedatos' && (
          <DatabaseTab
            user={currentUser}
            movimientos={movimientos}
            onDeleteMovimiento={handleDeleteMovimiento}
            onClearHistory={handleClearHistory}
            onSync={syncData}
            showToast={showToast}
          />
        )}

        {activeTab === 'areas' && isAdmin && (
          <AreasTab
            user={currentUser}
            areas={areasMaestras}
            proveedores={proveedoresMaestros}
            onAddArea={handleAddArea}
            onRemoveArea={handleRemoveArea}
            onAddProv={handleAddProv}
            onRemoveProv={handleRemoveProv}
            showToast={showToast}
          />
        )}

        {activeTab === 'reportes' && (isAdmin || isSup) && (
          <ReportTab
            user={currentUser}
            movimientos={movimientos}
            showToast={showToast}
          />
        )}
      </main>

      {/* Manual Audit Adjustment Modal Popup */}
      {adjustmentModal.isOpen && (
        <div className="fixed inset-0 bg-[#1a1814]/60 backdrop-blur-xs flex items-center justify-center p-4 z-100 transition-opacity">
          <div className="bg-white rounded-xl max-w-[500px] w-full p-6 shadow-2xl border border-[#ddd9d0] space-y-4">
            <h3 className="text-sm md:text-base font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
              <Scale size={18} className="text-blue-600" />
              Ajuste Manual de Auditoría
            </h3>
            <p className="text-[11.5px] leading-relaxed text-gray-500">
              Este registro quedará en la bitácora de auditoría para justificar mermas, conteos físicos o errores manuales.
            </p>

            <div className="form-group">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Producto seleccionado</label>
              <input
                type="text"
                readOnly
                value={`${adjustmentModal.descripcion} (${adjustmentModal.unidad})`}
                className="w-full text-xs border border-[#ddd9d0] rounded-lg px-3 py-2 bg-gray-50 text-gray-500 uppercase font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="form-group pb-0">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Operación</label>
                <select
                  value={adjustmentModal.tipo}
                  onChange={(e) => setAdjustmentModal(prev => ({ ...prev, tipo: e.target.value as any }))}
                  className="w-full text-xs border border-[#ddd9d0] rounded-lg p-2 bg-white focus:outline-none"
                >
                  <option value="ENTRADA">Sumar (+) Conteo / Ajuste</option>
                  <option value="SALIDA">Restar (-) Mermas / Deterioro</option>
                </select>
              </div>

              <div className="form-group pb-0">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Cantidad total (Física)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={adjustmentModal.cantidad}
                  onChange={(e) => setAdjustmentModal(prev => ({ ...prev, cantidad: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="Ej. 10"
                  className="w-full text-xs border border-[#ddd9d0] rounded-lg px-2.5 py-2 focus:border-blue-600 focus:outline-none font-bold"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Fecha de Ajuste</label>
              <input
                type="date"
                value={adjustmentModal.fecha}
                onChange={(e) => setAdjustmentModal(prev => ({ ...prev, fecha: e.target.value }))}
                className="w-full text-xs border border-[#ddd9d0] rounded-lg px-3 py-2 bg-white"
              />
            </div>

            <div className="form-group">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Motivo del Ajuste (Obligatorio)</label>
              <input
                type="text"
                placeholder="Ej. MERMA DETECTADA, ERROR DE RECEPCION"
                value={adjustmentModal.notas}
                onChange={(e) => setAdjustmentModal(prev => ({ ...prev, notas: e.target.value }))}
                className="w-full text-xs border border-[#ddd9d0] rounded-lg px-3 py-2 uppercase"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-150">
              <button
                onClick={closeAdjustmentModal}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-750 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAdjustment}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md transition-colors cursor-pointer"
              >
                Guardar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Modal alerts banner */}
      {toast && (
        <div
          id="toast"
          className={`fixed bottom-6 right-6 z-100 border p-3.5 rounded-lg text-xs md:text-sm font-semibold shadow-xl transition-all duration-300 flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : toast.type === 'error'
                ? 'bg-red-650 text-white border-red-500 bg-red-600'
                : toast.type === 'warn'
                  ? 'bg-amber-500 text-white border-amber-400'
                  : 'bg-zinc-900 text-white border-zinc-800'
          }`}
        >
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
