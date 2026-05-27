import React, { useState } from 'react';
import { User } from '../types';
import { Search, Plus, Trash2 } from 'lucide-react';

interface AreasTabProps {
  user: User;
  areas: string[];
  proveedores: string[];
  onAddArea: (area: string) => void;
  onRemoveArea: (area: string) => void;
  onAddProv: (prov: string) => void;
  onRemoveProv: (prov: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export default function AreasTab({
  user,
  areas,
  proveedores,
  onAddArea,
  onRemoveArea,
  onAddProv,
  onRemoveProv,
  showToast
}: AreasTabProps) {
  const [newArea, setNewArea] = useState('');
  const [newProv, setNewProv] = useState('');
  const [searchArea, setSearchArea] = useState('');
  const [searchProv, setSearchProv] = useState('');

  const isCompras = user.module === 'COMPRAS';

  // Area Catalogs Logic
  const handleAddAreaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newArea.trim().toUpperCase();
    if (!val) return;

    if (areas.includes(val)) {
      showToast('Esa área ya se encuentra registrada', 'warn');
      return;
    }

    onAddArea(val);
    setNewArea('');
    showToast('Área ingresada al catálogo correctamente', 'success');
  };

  const handleAddProvSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newProv.trim().toUpperCase();
    if (!val) return;

    if (proveedores.includes(val)) {
      showToast('El proveedor ya existe', 'warn');
      return;
    }

    onAddProv(val);
    setNewProv('');
    showToast('Proveedor ingresado', 'success');
  };

  const filteredAreas = areas
    .filter(a => a.toUpperCase().includes(searchArea.trim().toUpperCase()))
    .sort();

  const filteredProvs = proveedores
    .filter(p => p.toUpperCase().includes(searchProv.trim().toUpperCase()))
    .sort();

  return (
    <div className="space-y-6">
      <div className="page-header pb-4 border-b border-[#ddd9d0]">
        <h2 className="text-xl md:text-2xl font-bold font-sans text-gray-900">
          {isCompras ? 'Gestión de Catálogos (Áreas y Proveedores)' : 'Gestión de Catálogo de Áreas'}
        </h2>
        <p className="text-xs md:text-sm text-gray-500 mt-1">
          Administre los catálogos base para autocompletar rápidamente los formularios de registro
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${isCompras ? 'md:grid-cols-2' : ''}`}>
        {/* Areas List Box Card */}
        <div className="bg-white border border-[#ddd9d0] rounded-xl p-5 md:p-6 shadow-sm space-y-4">
          <h3 className="text-sm md:text-base font-bold text-gray-800 tracking-wide uppercase border-b border-gray-100 pb-2">
            Catálogo Oficial de Áreas (CCU)
          </h3>

          <form onSubmit={handleAddAreaSubmit} className="flex gap-2">
            <input
              type="text"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              placeholder="Ej. DIRECCIÓN CCU"
              className="flex-1 border-1.5 border-[#ddd9d0] rounded-lg px-3 py-2 text-xs md:text-sm focus:border-blue-600 focus:outline-none uppercase"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 hover:-translate-y-0.5 active:translate-y-0 shadow transition-all cursor-pointer"
            >
              <Plus size={14} />
              Agregar
            </button>
          </form>

          {/* Search areas */}
          <div className="relative flex items-center border border-[#ddd9d0] rounded-lg px-2 py-1.5 bg-gray-50 focus-within:bg-white focus-within:border-blue-600 transition-colors">
            <Search size={14} className="text-gray-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={searchArea}
              onChange={(e) => setSearchArea(e.target.value)}
              placeholder="Buscar Área..."
              className="w-full text-xs text-gray-900 bg-transparent focus:outline-none uppercase"
            />
          </div>

          <div className="max-h-80 overflow-y-auto border border-[#ddd9d0] rounded-lg">
            {filteredAreas.length === 0 ? (
              <p className="text-xs text-center text-gray-500 p-4 font-medium">No se encontraron áreas asociadas.</p>
            ) : (
              <table className="w-full border-collapse text-left text-xs md:text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#ddd9d0] text-[9.5px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    <th className="px-4 py-2">Área / Departamento Registrado</th>
                    <th className="px-4 py-2 text-center w-20">Eliminar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {filteredAreas.map((area) => (
                    <tr key={area} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-gray-800 uppercase">{area}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => {
                            if (confirm(`¿Retirar "${area}" del catálogo?`)) {
                              onRemoveArea(area);
                              showToast('Área retirada del catálogo', 'warn');
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-650 hover:bg-red-50 text-red-600 rounded cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Suppliers List Card: ONLY displayed under COMPRAS */}
        {isCompras && (
          <div className="bg-white border border-[#ddd9d0] rounded-xl p-5 md:p-6 shadow-sm space-y-4">
            <h3 className="text-sm md:text-base font-bold text-gray-800 tracking-wide uppercase border-b border-gray-100 pb-2">
              Catálogo Oficial de Proveedores
            </h3>

            <form onSubmit={handleAddProvSubmit} className="flex gap-2">
              <input
                type="text"
                value={newProv}
                onChange={(e) => setNewProv(e.target.value)}
                placeholder="Ej. OFFICE DEPOT"
                className="flex-1 border-1.5 border-[#ddd9d0] rounded-lg px-3 py-2 text-xs md:text-sm focus:border-blue-600 focus:outline-none uppercase"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 hover:-translate-y-0.5 active:translate-y-0 shadow transition-all cursor-pointer"
              >
                <Plus size={14} />
                Agregar
              </button>
            </form>

            {/* Search Suppliers */}
            <div className="relative flex items-center border border-[#ddd9d0] rounded-lg px-2 py-1.5 bg-gray-50 focus-within:bg-white focus-within:border-blue-600 transition-colors">
              <Search size={14} className="text-gray-400 mr-2 flex-shrink-0" />
              <input
                type="text"
                value={searchProv}
                onChange={(e) => setSearchProv(e.target.value)}
                placeholder="Buscar Proveedor..."
                className="w-full text-xs text-gray-900 bg-transparent focus:outline-none uppercase"
              />
            </div>

            <div className="max-h-80 overflow-y-auto border border-[#ddd9d0] rounded-lg">
              {filteredProvs.length === 0 ? (
                <p className="text-xs text-center text-gray-500 p-4 font-medium">No se encontraron proveedores.</p>
              ) : (
                <table className="w-full border-collapse text-left text-xs md:text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#ddd9d0] text-[9.5px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                      <th className="px-4 py-2">Proveedor Registrado</th>
                      <th className="px-4 py-2 text-center w-20">Eliminar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {filteredProvs.map((prov) => (
                      <tr key={prov} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-gray-800 uppercase">{prov}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => {
                              if (confirm(`¿Retirar "${prov}" del catálogo de proveedores?`)) {
                                onRemoveProv(prov);
                                showToast('Proveedor retirado del catálogo', 'warn');
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-650 hover:bg-red-50 text-red-600 rounded cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
