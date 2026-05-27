export interface Movimiento {
  docId?: string;
  id: number;
  tipo: 'ENTRADA' | 'SALIDA';
  fecha: string;
  cantidad: number;
  descripcion: string;
  unidad: string;
  area: string;
  notas: string;
  registradoPor: string;
  eliminado: boolean;
  eliminadoPor?: string;
  prov?: string;
  fact?: string;
  fechaFact?: string;
  costoUnit?: number;
  costoTotal?: number;
  aut?: string;
  tipoCompra?: string;
  recibe?: string;
  resp?: string;
}

export interface CatalogoItem {
  descripcion: string;
  unidad: string;
  tipoCompra?: string;
}

export interface User {
  username: string;
  pass: string;
  role: 'admin' | 'supervisor' | 'responsable_salidas' | 'responsable_entradas';
  module: 'INSUMOS' | 'COMPRAS';
  name: string;
}

export const USERS: Record<string, Omit<User, 'username'>> = {
  // MÓDULO INSUMOS (Supplies)
  admin:          { pass: 'ccu2024',      role: 'admin',                module: 'INSUMOS', name: 'Administrador' },
  supervisor:     { pass: 'insumos2024',  role: 'supervisor',           module: 'INSUMOS', name: 'Supervisor' },
  responsable:    { pass: 'resp2024',     role: 'responsable_salidas',  module: 'INSUMOS', name: 'Resp. de Insumos' },
  
  // MÓDULO COMPRAS (Purchases)
  admin_compras:  { pass: 'compra2024',   role: 'admin',                module: 'COMPRAS', name: 'Admin. Compras' },
  sup_compras:    { pass: 'supcompra24',  role: 'supervisor',           module: 'COMPRAS', name: 'Sup. Compras' },
  resp_compras:   { pass: 'respcompra24', role: 'responsable_entradas', module: 'COMPRAS', name: 'Resp. Compras' },
  resp_entregas:  { pass: 'entrega2024',  role: 'responsable_salidas',  module: 'COMPRAS', name: 'Resp. Entregas' }
};

export const UNIDADES = [
  'GALÓN', 'LITRO', 'KG', 'PIEZA', 'CAJA', 'PAQUETE', 'PAR', 'BIDÓN 20 LITROS', 'ROLLO', 'OTRO'
];
