import { Movimiento, CatalogoItem } from './types';

export interface InventoryItem {
  descripcion: string;
  unidad: string;
  entradas: number;
  salidas: number;
  actual: number;
  tipoCompra: string;
}

export function getInventarioActual(movimientos: Movimiento[], catalogoMaestro: CatalogoItem[]): InventoryItem[] {
  const stock: Record<string, InventoryItem> = {};
  
  // Fill from base catalog
  catalogoMaestro.forEach(c => {
    const desc = c.descripcion.trim().toUpperCase();
    const unit = c.unidad.trim().toUpperCase();
    const key = `${desc}|${unit}`;
    stock[key] = {
      descripcion: desc,
      unidad: unit,
      entradas: 0,
      salidas: 0,
      actual: 0,
      tipoCompra: c.tipoCompra || 'RESURTIBLE'
    };
  });

  // Operate all valid movements
  movimientos.forEach(m => {
    if (m.eliminado) return; 
    
    const desc = m.descripcion.trim().toUpperCase();
    const unit = m.unidad.trim().toUpperCase();
    const key = `${desc}|${unit}`;
    
    if (!stock[key]) {
      stock[key] = {
        descripcion: desc,
        unidad: unit,
        entradas: 0,
        salidas: 0,
        actual: 0,
        tipoCompra: m.tipoCompra || 'RESURTIBLE'
      };
    }
    
    const qty = Math.floor(Number(m.cantidad) || 0);
    if (m.tipo === 'ENTRADA') {
      stock[key].entradas += qty;
    } else if (m.tipo === 'SALIDA') {
      stock[key].salidas += qty;
    }
  });

  const resultado: InventoryItem[] = [];
  for (const key in stock) {
    const item = stock[key];
    item.actual = item.entradas - item.salidas;
    if (item.actual < 0) item.actual = 0; 
    resultado.push(item);
  }
  
  return resultado.sort((a, b) => a.descripcion.localeCompare(b.descripcion));
}

export function formatearFecha(fechaStr: string): string {
  if (!fechaStr) return '—';
  const partes = fechaStr.split('-');
  if (partes.length !== 3) return fechaStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}
