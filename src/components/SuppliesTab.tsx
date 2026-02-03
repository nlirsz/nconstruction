
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, UserProfile, SupplyOrder, SupplyItem, SupplyStatus, SupplyPriority, SupplyComment } from '../types';
import { Package, Plus, Search, Filter, Clock, AlertTriangle, CheckCircle2, Truck, ShoppingCart, ChevronRight, X, Trash2, Save, Send, MessageSquare, MoreHorizontal, User, Building2, Store, Loader2, List, LayoutGrid, Download, FileSpreadsheet, Calendar, UploadCloud, FileText, Code2, Edit2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface SuppliesTabProps {
  project: Project;
  currentUser: any;
  userProfile?: UserProfile | null;
}

interface OrderCardProps {
    order: SupplyOrder;
    onClick: () => void;
    display: { name: string; avatar: string };
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onClick, display }) => {
    return (
        <div onClick={onClick} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${order.priority === 'high' ? 'bg-red-50 text-red-700 border-red-100' : order.priority === 'medium' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                    {order.priority === 'high' ? 'Alta' : order.priority === 'medium' ? 'Média' : 'Baixa'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{new Date(order.created_at).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}</span>
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1 line-clamp-2">{order.title}</h4>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                        {display.avatar ? <img src={display.avatar} className="w-full h-full object-cover" /> : <User size={10} className="m-auto mt-0.5 text-slate-400" />}
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 truncate max-w-[80px]">{display.name}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded">
                    <ShoppingCart size={10} /> {order.items.length}
                </div>
            </div>
        </div>
    );
};

const EmptyState = ({ text }: { text: string }) => (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-lg bg-slate-50/50">
        <Package size={24} className="mb-2 opacity-20" />
        <p className="text-xs italic">{text}</p>
    </div>
);

export const SuppliesTab: React.FC<SuppliesTabProps> = ({ project, currentUser, userProfile }) => {
  const [orders, setOrders] = useState<SupplyOrder[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false); 
  const [selectedOrder, setSelectedOrder] = useState<SupplyOrder | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [newOrderTitle, setNewOrderTitle] = useState('');
  const [newOrderPriority, setNewOrderPriority] = useState<SupplyPriority>('medium');
  const [newItems, setNewItems] = useState<SupplyItem[]>([{ id: '1', name: '', quantity: 1, unit: 'un', checked: false }]);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<SupplyItem[]>([]);
  const [importOrderTitle, setImportOrderTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [chatText, setChatText] = useState('');

  useEffect(() => {
    Promise.all([fetchOrders(), fetchMembers()]).then(() => setLoading(false));
  }, [project.id]);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('project_members')
      .select('*, profiles:user_id(*)')
      .eq('project_id', project.id);
    if (data) setProjectMembers(data);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('supply_orders')
      .select('*, supply_comments(*)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (data && !error) {
        const formattedData = data.map((order: any) => ({
            ...order,
            supply_comments: order.supply_comments?.sort((a: any, b: any) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ) || []
        }));
        setOrders(formattedData);
    }
  };

  // Mapa de perfis para busca rápida por e-mail
  const profileMap = useMemo(() => {
    const map: Record<string, { name: string, avatar: string }> = {};
    projectMembers.forEach(m => {
        if (m.profiles?.email || m.profiles?.id) {
            const key = m.profiles.email || m.profiles.id;
            map[key] = {
                name: m.profiles.full_name,
                avatar: m.profiles.avatar_url
            };
        }
    });
    if (currentUser?.email && userProfile) {
        map[currentUser.email] = {
            name: userProfile.full_name,
            avatar: userProfile.avatar_url
        };
    }
    return map;
  }, [projectMembers, currentUser, userProfile]);

  const getUserDisplay = (email: string) => {
    const profile = profileMap[email];
    if (profile) return profile;
    return { name: email.split('@')[0], avatar: '' };
  };

  const resetForm = () => {
      setNewOrderTitle('');
      setNewOrderPriority('medium');
      setNewItems([{ id: '1', name: '', quantity: 1, unit: 'un', checked: false }]);
      setIsEditing(false);
  };

  const handleOpenCreate = () => {
      resetForm();
      setIsCreateOpen(true);
  };

  const handleOpenEdit = () => {
      if (!selectedOrder) return;
      setNewOrderTitle(selectedOrder.title);
      setNewOrderPriority(selectedOrder.priority);
      // Deep copy items so we don't mutate selectedOrder directly while editing form
      setNewItems(selectedOrder.items.map(i => ({...i})));
      setIsEditing(true);
      setIsCreateOpen(true);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderTitle.trim() || newItems.length === 0) return;
    
    setSubmitLoading(true);
    const validItems = newItems.filter(i => i.name.trim() !== '');
    
    const { error } = await supabase.from('supply_orders').insert({
        project_id: project.id,
        title: newOrderTitle,
        priority: newOrderPriority,
        items: validItems,
        status: 'requested',
        created_by: currentUser.email
    });

    if (!error) {
        setIsCreateOpen(false);
        resetForm();
        fetchOrders();
    }
    setSubmitLoading(false);
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedOrder || !newOrderTitle.trim() || newItems.length === 0) return;

      setSubmitLoading(true);
      const validItems = newItems.filter(i => i.name.trim() !== '');

      const { error } = await supabase.from('supply_orders').update({
          title: newOrderTitle,
          priority: newOrderPriority,
          items: validItems,
      }).eq('id', selectedOrder.id);

      if (!error) {
          // Atualiza lista local
          const updatedOrder = { ...selectedOrder, title: newOrderTitle, priority: newOrderPriority, items: validItems };
          setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updatedOrder : o));
          setSelectedOrder(updatedOrder); // Atualiza painel aberto
          
          setIsCreateOpen(false);
          resetForm();
      } else {
          alert('Erro ao atualizar pedido: ' + error.message);
      }
      setSubmitLoading(false);
  };

  // --- INTELLIGENT CSV IMPORT LOGIC ---
  
  // Lê o arquivo tentando detectar se é UTF-8 ou ANSI (Windows-1252)
  const readFileContent = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              const buffer = e.target?.result as ArrayBuffer;
              
              // 1. Tenta decodificar como UTF-8 estrito
              try {
                  const decoder = new TextDecoder('utf-8', { fatal: true });
                  const text = decoder.decode(buffer);
                  resolve(text);
              } catch (e) {
                  // 2. Se falhar (caracteres inválidos/acento quebrado), assume Windows-1252 (Padrão Excel Brasil)
                  try {
                      const decoder = new TextDecoder('windows-1252');
                      const text = decoder.decode(buffer);
                      resolve(text);
                  } catch (err) {
                      // Fallback final
                      const decoder = new TextDecoder('iso-8859-1');
                      resolve(decoder.decode(buffer));
                  }
              }
          };
          reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
          reader.readAsArrayBuffer(file);
      });
  };

  const parseCSVLocally = (text: string): SupplyItem[] => {
    const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];

    const items: SupplyItem[] = [];
    
    // Detecção Automática de Separador (, ou ;)
    const firstLine = lines.find(l => l.length > 5) || lines[0];
    const semiCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const separator = semiCount >= commaCount ? ';' : ',';
    
    // Regex para splitar CSV ignorando separador dentro de aspas
    const splitRegex = separator === ';' 
        ? /;(?=(?:(?:[^"]*"){2})*[^"]*$)/ 
        : /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    // Mapeamento dinâmico de colunas
    let headerMap: { name: number, qty: number, dim: number, unit: number } | null = null;

    // Helper para identificar tipos de dados em colunas
    const isQty = (str: string) => {
        // Aceita 10, 10.5, 10,5
        return /^\d+([.,]\d+)?$/.test(str.trim());
    };
    const isUnit = (str: string) => {
        const units = ['un', 'pç', 'pc', 'm', 'm2', 'm3', 'kg', 'l', 'cx', 'sc', 'br', 'rl', 'ml'];
        return units.includes(str.trim().toLowerCase().replace('.', ''));
    };

    for (const line of lines) {
        const cols = line.split(splitRegex).map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        
        // 1. Tentar detectar cabeçalho (ignorando case)
        const lowerCols = cols.map(c => c.toLowerCase());
        const nameIdx = lowerCols.findIndex(c => c.includes('descri') || c.includes('material') || c.includes('produto') || c.includes('item'));
        const qtyIdx = lowerCols.findIndex(c => c.includes('quant') || c.includes('qtd') || c.includes('total'));
        
        // Se acharmos colunas de Nome e Quantidade na mesma linha, definimos o mapa de cabeçalho
        if (nameIdx !== -1 && qtyIdx !== -1) {
            const dimIdx = lowerCols.findIndex(c => c.includes('dimen') || c.includes('medida'));
            const unitIdx = lowerCols.findIndex(c => c.includes('unid') || c.includes('un.'));
            
            headerMap = { name: nameIdx, qty: qtyIdx, dim: dimIdx, unit: unitIdx };
            continue; // Pula a linha do cabeçalho
        }

        // 2. Processar Dados
        let name = '';
        let quantity = 0;
        let unit = 'un';
        let found = false;

        if (headerMap) {
            // Se já temos cabeçalho, usamos os índices exatos
            if (cols[headerMap.qty]) {
                const qStr = cols[headerMap.qty].replace(',', '.'); // Normaliza float
                const q = parseFloat(qStr);
                
                if (!isNaN(q) && q > 0) {
                    quantity = q;
                    name = cols[headerMap.name] || 'Sem nome';
                    
                    // Mescla dimensão ao nome se existir
                    if (headerMap.dim > -1 && cols[headerMap.dim]) {
                        name += ` ${cols[headerMap.dim]}`;
                    }
                    
                    if (headerMap.unit > -1 && cols[headerMap.unit]) {
                        unit = cols[headerMap.unit];
                    }
                    found = true;
                }
            }
        } else {
            // Heurística (Adivinhação) para CSV sem cabeçalho claro ou antes de achar o cabeçalho
            let bestQtyIdx = -1;
            let bestUnitIdx = -1;
            let bestNameIdx = -1;
            let maxLength = 0;

            cols.forEach((col, idx) => {
                if (!col) return;
                
                // Se parece número e ainda não achamos a qtd
                if (isQty(col) && bestQtyIdx === -1) {
                    bestQtyIdx = idx;
                } 
                // Se parece unidade
                else if (isUnit(col) && bestUnitIdx === -1) {
                    bestUnitIdx = idx;
                } 
                // O texto mais longo provavelmente é o nome
                else if (col.length > maxLength) {
                    maxLength = col.length;
                    bestNameIdx = idx;
                }
            });

            if (bestQtyIdx !== -1 && bestNameIdx !== -1) {
                const q = parseFloat(cols[bestQtyIdx].replace(',', '.'));
                if (!isNaN(q) && q > 0) {
                    quantity = q;
                    name = cols[bestNameIdx];
                    if (bestUnitIdx !== -1) unit = cols[bestUnitIdx];
                    found = true;
                }
            }
        }

        if (found && name.length > 2) {
             items.push({
                id: `imp-${Math.random().toString(36).substr(2,9)}`,
                name: name.replace(/\s+/g, ' ').trim(), // Remove espaços duplos
                quantity,
                unit: unit.toLowerCase().replace('.', ''), // Limpa unidade (un. -> un)
                checked: false
            });
        }
    }
    return items;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setImportFile(e.target.files[0]);
          setParsedItems([]); // Reset preview
      }
  };

  const handleParseCSV = async () => {
      if (!importFile) return;
      setIsParsing(true);
      try {
          // Usa o leitor inteligente de encoding
          const text = await readFileContent(importFile);
          // Usa o parser local robusto
          const items = parseCSVLocally(text);
          setParsedItems(items);
          setImportOrderTitle(`Importação ${importFile.name.split('.')[0]} - ${new Date().toLocaleDateString('pt-BR')}`);
      } catch (err) {
          console.error(err);
          alert("Erro ao ler arquivo. Verifique se é um texto/CSV válido.");
      } finally {
          setIsParsing(false);
      }
  };

  const handleConfirmImport = async () => {
      if (parsedItems.length === 0 || !importOrderTitle.trim()) return;
      setSubmitLoading(true);
      
      const { error } = await supabase.from('supply_orders').insert({
          project_id: project.id,
          title: importOrderTitle,
          priority: 'medium',
          items: parsedItems,
          status: 'requested',
          created_by: currentUser.email
      });

      if (!error) {
          setIsImportOpen(false);
          setParsedItems([]);
          setImportFile(null);
          setImportOrderTitle('');
          fetchOrders();
      } else {
          alert("Erro ao salvar importação.");
      }
      setSubmitLoading(false);
  };
  // ------------------------

  const updateOrderStatus = async (id: string, newStatus: SupplyStatus) => {
      const { error } = await supabase.from('supply_orders').update({ status: newStatus }).eq('id', id);
      if (!error) {
          setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
          if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
          
          let msg = '';
          if (newStatus === 'approved') msg = 'Pedido aprovado. Iniciando separação.';
          if (newStatus === 'separating') msg = 'Loja iniciou a separação dos itens.';
          if (newStatus === 'delivering') msg = 'Materiais enviados para o canteiro.';
          if (newStatus === 'delivered') msg = 'Recebimento confirmado na obra.';
          if (msg) addComment(id, msg, true);
      }
  };

  const toggleItemCheck = async (orderId: string, itemIdx: number) => {
      if (!selectedOrder) return;
      const updatedItems = [...selectedOrder.items];
      updatedItems[itemIdx].checked = !updatedItems[itemIdx].checked;
      setSelectedOrder({ ...selectedOrder, items: updatedItems });
      await supabase.from('supply_orders').update({ items: updatedItems }).eq('id', orderId);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, items: updatedItems } : o));
  };

  const addComment = async (orderId: string, text: string, isSystem = false) => {
      if (!text.trim()) return;
      const { data, error } = await supabase.from('supply_comments').insert({
          order_id: orderId,
          content: text,
          created_by: isSystem ? 'Sistema' : currentUser.email
      }).select().single();

      if (data && !error) {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, supply_comments: [...(o.supply_comments || []), data] } : o));
          if (selectedOrder?.id === orderId) {
              setSelectedOrder(prev => prev ? { ...prev, supply_comments: [...(prev.supply_comments || []), data] } : null);
          }
          setChatText('');
      }
  };

  const handleExportCSV = () => {
      if (orders.length === 0) return;
      
      const headers = ["ID Pedido", "Titulo", "Status", "Prioridade", "Solicitante", "Data", "Item", "Quantidade", "Unidade", "Verificado"];
      const csvRows = [headers.join(",")];
      
      orders.forEach(o => {
          const requester = getUserDisplay(o.created_by).name;
          const status = getStatusLabel(o.status);
          const date = new Date(o.created_at).toLocaleDateString('pt-BR');
          
          o.items.forEach(item => {
              const row = [
                  o.id,
                  `"${o.title.replace(/"/g, '""')}"`,
                  `"${status}"`,
                  `"${o.priority}"`,
                  `"${requester}"`,
                  `"${date}"`,
                  `"${item.name.replace(/"/g, '""')}"`, 
                  item.quantity,                        
                  `"${item.unit}"`,                     
                  item.checked ? "Sim" : "Não"          
              ];
              csvRows.push(row.join(","));
          });
      });
      
      const csvContent = "\ufeff" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `suprimentos_detalhado_${project.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const getStatusLabel = (status: SupplyStatus) => {
      const map: Record<string, string> = { requested: 'Solicitado', approved: 'Aprovado', separating: 'Em Separação', delivering: 'Em Trânsito', delivered: 'Entregue', cancelled: 'Cancelado' };
      return map[status] || status;
  };

  const getStatusColor = (status: SupplyStatus) => {
      const map: Record<string, string> = { requested: 'bg-slate-100 text-slate-700', approved: 'bg-blue-50 text-blue-700', separating: 'bg-orange-50 text-orange-700', delivering: 'bg-purple-50 text-purple-700', delivered: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-red-50 text-red-700' };
      return map[status] || 'bg-slate-100';
  };

  if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;

  const filteredOrders = orders.filter(o => o.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const todoOrders = filteredOrders.filter(o => o.status === 'requested');
  const processingOrders = filteredOrders.filter(o => o.status === 'approved' || o.status === 'separating');
  const doneOrders = filteredOrders.filter(o => o.status === 'delivering' || o.status === 'delivered');

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 px-1">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Package className="text-blue-600" size={24} /> Suprimentos
            </h2>
            <p className="text-slate-500 mt-1">Solicitações e logística de materiais.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
            <button 
                onClick={handleExportCSV}
                className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
                <FileSpreadsheet size={18} /> CSV
            </button>
            <button 
                onClick={() => setIsImportOpen(true)}
                className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-blue-200 text-blue-600 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
                <UploadCloud size={18} /> Importar Lista
            </button>
            <button onClick={handleOpenCreate} className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-md flex items-center justify-center gap-2 transition-all"><Plus size={18} /> Nova Solicitação</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setViewMode('kanban')} 
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                    title="Visão em Colunas"
                  >
                    <LayoutGrid size={18}/>
                  </button>
                  <button 
                    onClick={() => setViewMode('list')} 
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                    title="Visão em Lista"
                  >
                    <List size={18}/>
                  </button>
              </div>
              <div className="h-6 w-px bg-slate-200 mx-1"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Visualização</span>
          </div>
          <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Pesquisar pedidos..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-slate-700" 
              />
          </div>
      </div>

      {viewMode === 'kanban' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
              <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-slate-200">
                      <h3 className="font-bold text-slate-700">Solicitações</h3>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{todoOrders.length}</span>
                  </div>
                  {todoOrders.map(order => <OrderCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} display={getUserDisplay(order.created_by)} />)}
                  {todoOrders.length === 0 && <EmptyState text="Nenhuma solicitação pendente." />}
              </div>

              <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-orange-200">
                      <h3 className="font-bold text-slate-700">Loja / Separação</h3>
                      <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">{processingOrders.length}</span>
                  </div>
                  {processingOrders.map(order => <OrderCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} display={getUserDisplay(order.created_by)} />)}
                  {processingOrders.length === 0 && <EmptyState text="Nenhum pedido em processamento." />}
              </div>

              <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-200">
                      <h3 className="font-bold text-slate-700">Logística</h3>
                      <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-xs font-bold">{doneOrders.length}</span>
                  </div>
                  {doneOrders.map(order => <OrderCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} display={getUserDisplay(order.created_by)} />)}
                  {doneOrders.length === 0 && <EmptyState text="Nenhum pedido em trânsito/entregue." />}
              </div>
          </div>
      ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedido</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Solicitante</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Itens</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredOrders.length === 0 ? (
                              <tr>
                                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Nenhum pedido encontrado com estes critérios.</td>
                              </tr>
                          ) : (
                              filteredOrders.map(o => {
                                  const display = getUserDisplay(o.created_by);
                                  return (
                                      <tr key={o.id} className="hover:bg-slate-50 transition-colors group">
                                          <td className="px-6 py-4">
                                              <div className="flex items-center gap-3">
                                                  <div className={`p-2 rounded-lg ${o.priority === 'high' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                      <Package size={18} />
                                                  </div>
                                                  <div>
                                                      <p className="font-bold text-slate-800 text-sm">{o.title}</p>
                                                      <p className="text-[10px] text-slate-400 font-mono">ID: {o.id.substring(0,8)}</p>
                                                  </div>
                                              </div>
                                          </td>
                                          <td className="px-6 py-4">
                                              <div className="flex items-center gap-2">
                                                  <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                                                      {display.avatar ? <img src={display.avatar} className="w-full h-full object-cover" /> : <User size={12} className="m-auto mt-1 text-slate-400" />}
                                                  </div>
                                                  <span className="text-xs font-medium text-slate-600">{display.name}</span>
                                              </div>
                                          </td>
                                          <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                              {new Date(o.created_at).toLocaleDateString('pt-BR')}
                                          </td>
                                          <td className="px-6 py-4">
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusColor(o.status)}`}>
                                                  {getStatusLabel(o.status)}
                                              </span>
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-full">{o.items.length}</span>
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                              <button 
                                                onClick={() => setSelectedOrder(o)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                              >
                                                  <ChevronRight size={18} />
                                              </button>
                                          </td>
                                      </tr>
                                  );
                              })
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* CSV IMPORT MODAL */}
      {isImportOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 flex flex-col max-h-[90vh]">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl shrink-0">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <UploadCloud size={20} className="text-blue-600" /> 
                          Importar Lista Inteligente
                      </h3>
                      <button onClick={() => { setIsImportOpen(false); setParsedItems([]); setImportFile(null); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {!parsedItems.length ? (
                          <div className="flex flex-col items-center justify-center space-y-4 py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                              <FileText size={48} className="text-slate-300" />
                              <div className="text-center">
                                  <p className="font-bold text-slate-700">Carregar arquivo CSV ou Texto</p>
                                  <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
                                      O algoritmo inteligente identifica automaticamente colunas de Item, Quantidade e Unidade, mesmo em arquivos desorganizados.
                                  </p>
                              </div>
                              
                              <input 
                                  type="file" 
                                  accept=".csv,.txt" 
                                  className="hidden" 
                                  ref={fileInputRef}
                                  onChange={handleFileChange}
                              />
                              
                              <div className="flex gap-2">
                                  <button 
                                      onClick={() => fileInputRef.current?.click()}
                                      className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                  >
                                      Selecionar Arquivo
                                  </button>
                                  {importFile && (
                                      <button 
                                          onClick={handleParseCSV}
                                          disabled={isParsing}
                                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
                                      >
                                          {isParsing ? <Loader2 size={16} className="animate-spin"/> : <Code2 size={16}/>}
                                          Processar Arquivo
                                      </button>
                                  )}
                              </div>
                              {importFile && <p className="text-xs font-bold text-slate-600 bg-slate-200 px-2 py-1 rounded">{importFile.name}</p>}
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <div className="flex justify-between items-end">
                                  <div className="flex-1 mr-4">
                                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título do Pedido</label>
                                      <input 
                                          type="text" 
                                          value={importOrderTitle} 
                                          onChange={e => setImportOrderTitle(e.target.value)}
                                          className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-slate-50"
                                      />
                                  </div>
                                  <div className="text-right">
                                      <p className="text-2xl font-black text-blue-600">{parsedItems.length}</p>
                                      <p className="text-xs text-slate-500 uppercase font-bold">Itens Identificados</p>
                                  </div>
                              </div>

                              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                                  <table className="w-full text-left text-sm">
                                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                          <tr>
                                              <th className="px-4 py-2 font-bold text-slate-500">Item</th>
                                              <th className="px-4 py-2 font-bold text-slate-500 text-center w-20">Qtd</th>
                                              <th className="px-4 py-2 font-bold text-slate-500 text-center w-20">Un</th>
                                              <th className="px-4 py-2 w-10"></th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {parsedItems.map((item, idx) => (
                                              <tr key={idx} className="group hover:bg-slate-50">
                                                  <td className="px-4 py-2">
                                                      <input 
                                                          type="text" 
                                                          value={item.name} 
                                                          onChange={e => {
                                                              const newList = [...parsedItems];
                                                              newList[idx].name = e.target.value;
                                                              setParsedItems(newList);
                                                          }}
                                                          className="w-full bg-transparent outline-none font-medium text-slate-900 focus:text-blue-600"
                                                      />
                                                  </td>
                                                  <td className="px-4 py-2 text-center">
                                                      <input 
                                                          type="number" 
                                                          value={item.quantity} 
                                                          onChange={e => {
                                                              const newList = [...parsedItems];
                                                              newList[idx].quantity = Number(e.target.value);
                                                              setParsedItems(newList);
                                                          }}
                                                          className="w-full bg-transparent outline-none text-center font-bold text-slate-900 focus:text-blue-600"
                                                      />
                                                  </td>
                                                  <td className="px-4 py-2 text-center text-slate-500 text-xs font-bold uppercase">{item.unit}</td>
                                                  <td className="px-4 py-2 text-right">
                                                      <button 
                                                          onClick={() => setParsedItems(prev => prev.filter((_, i) => i !== idx))}
                                                          className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                      >
                                                          <Trash2 size={16} />
                                                      </button>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
                      <button onClick={() => { setIsImportOpen(false); setParsedItems([]); }} className="px-4 py-2 text-slate-600 font-bold text-sm">Cancelar</button>
                      <button 
                          onClick={handleConfirmImport} 
                          disabled={parsedItems.length === 0 || submitLoading} 
                          className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg text-sm disabled:opacity-70 flex items-center gap-2"
                      >
                          {submitLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          Confirmar Importação
                      </button>
                  </div>
              </div>
          </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl shrink-0">
                    <h3 className="font-bold text-slate-800">{isEditing ? 'Editar Solicitação' : 'Nova Solicitação Manual'}</h3>
                    <button onClick={() => { setIsCreateOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <form onSubmit={isEditing ? handleUpdateOrder : handleCreateOrder} className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Título</label>
                        <input required autoFocus type="text" placeholder="Ex: Cimento para Pav. 3" value={newOrderTitle} onChange={e => setNewOrderTitle(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-slate-50" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Prioridade</label>
                        <div className="flex gap-2">
                            {['low', 'medium', 'high'].map((p) => (
                                <button 
                                    key={p} 
                                    type="button" 
                                    onClick={() => setNewOrderPriority(p as SupplyPriority)}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${newOrderPriority === p ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}
                                >
                                    {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-2">Materiais</label>
                        <div className="space-y-2">
                            {newItems.map((item, idx) => (
                                <div key={item.id} className="flex gap-2">
                                    <input type="text" placeholder="Item" value={item.name} onChange={e => { const list = [...newItems]; list[idx].name = e.target.value; setNewItems(list); }} className="flex-[2] px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-slate-50" />
                                    <input type="number" placeholder="Qtd" value={item.quantity} onChange={e => { const list = [...newItems]; list[idx].quantity = Number(e.target.value); setNewItems(list); }} className="w-16 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-slate-50" />
                                    <input type="text" placeholder="Un" value={item.unit} onChange={e => { const list = [...newItems]; list[idx].unit = e.target.value; setNewItems(list); }} className="w-16 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-slate-50" />
                                    <button type="button" onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={() => setNewItems([...newItems, { id: Date.now().toString(), name: '', quantity: 1, unit: 'un', checked: false }])} className="mt-3 text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700"><Plus size={14} /> Adicionar Item</button>
                    </div>
                </form>
                <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
                    <button onClick={() => { setIsCreateOpen(false); resetForm(); }} className="px-4 py-2 text-slate-600 font-bold text-sm">Cancelar</button>
                    <button onClick={isEditing ? handleUpdateOrder : handleCreateOrder} disabled={submitLoading} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg text-sm disabled:opacity-70">{submitLoading ? 'Salvando...' : (isEditing ? 'Atualizar Pedido' : 'Enviar Solicitação')}</button>
                </div>
            </div>
        </div>
      )}

      {selectedOrder && (
          <div className="fixed inset-0 z-[210] flex justify-end">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
              <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                  <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-start shrink-0">
                      <div>
                          <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusColor(selectedOrder.status)}`}>{getStatusLabel(selectedOrder.status)}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${selectedOrder.priority === 'high' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>Prioridade {selectedOrder.priority === 'high' ? 'Alta' : selectedOrder.priority === 'medium' ? 'Média' : 'Baixa'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <h2 className="text-xl font-bold text-slate-800">{selectedOrder.title}</h2>
                              <button onClick={handleOpenEdit} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors" title="Editar Pedido">
                                  <Edit2 size={16} />
                              </button>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                                    {getUserDisplay(selectedOrder.created_by).avatar ? <img src={getUserDisplay(selectedOrder.created_by).avatar} className="w-full h-full object-cover" /> : <User size={12} className="m-auto mt-1 text-slate-400" />}
                                </div>
                                <span className="text-xs text-slate-600">Solicitado por <span className="font-bold">{getUserDisplay(selectedOrder.created_by).name}</span> em {new Date(selectedOrder.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                      </div>
                      <button onClick={() => setSelectedOrder(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X size={24} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/30">
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Fluxo de Aprovação e Logística</h4>
                          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                              {selectedOrder.status === 'requested' && (
                                  <>
                                      <button onClick={() => updateOrderStatus(selectedOrder.id, 'approved')} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors">Aprovar Pedido</button>
                                      <button onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')} className="flex-shrink-0 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg font-bold text-sm hover:bg-red-50 transition-colors">Cancelar</button>
                                  </>
                              )}
                              {(selectedOrder.status === 'approved' || selectedOrder.status === 'separating') && (
                                  <>
                                    {selectedOrder.status === 'approved' && <button onClick={() => updateOrderStatus(selectedOrder.id, 'separating')} className="flex-shrink-0 px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-sm hover:bg-orange-600 transition-colors">Iniciar Separação</button>}
                                    <button onClick={() => updateOrderStatus(selectedOrder.id, 'delivering')} className="flex-shrink-0 px-4 py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition-colors">Enviar para Obra</button>
                                  </>
                              )}
                              {selectedOrder.status === 'delivering' && <button onClick={() => updateOrderStatus(selectedOrder.id, 'delivered')} className="flex-shrink-0 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors">Confirmar Recebimento</button>}
                              {selectedOrder.status === 'delivered' && (
                                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
                                      <CheckCircle2 size={18} /> Pedido Finalizado
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className="space-y-3">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><ShoppingCart size={16} className="text-blue-600" /> Itens ({selectedOrder.items.length})</h4>
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                              {selectedOrder.items.map((item, idx) => (
                                  <div key={item.id || idx} className="p-3 flex items-center gap-3">
                                      <button onClick={() => toggleItemCheck(selectedOrder.id, idx)} className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-blue-400'}`}>{item.checked && <CheckCircle2 size={14} />}</button>
                                      <span className={`text-sm flex-1 ${item.checked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>{item.name}</span>
                                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{item.quantity} {item.unit}</span>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><MessageSquare size={16} className="text-blue-600" /> Conversa</h4>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Histórico de Eventos</span>
                          </div>
                          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-4">
                              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                  {selectedOrder.supply_comments?.length === 0 ? (
                                      <div className="text-center py-6 text-slate-400 text-xs italic">Nenhuma mensagem neste pedido.</div>
                                  ) : (
                                      selectedOrder.supply_comments?.map(comment => {
                                          const isSystem = comment.created_by === 'Sistema';
                                          const display = getUserDisplay(comment.created_by);
                                          return (
                                              <div key={comment.id} className={`flex gap-3 ${isSystem ? 'justify-center' : ''}`}>
                                                  {!isSystem && (
                                                      <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                                          {display.avatar ? <img src={display.avatar} className="w-full h-full object-cover" /> : <User size={14} className="m-auto mt-1.5 text-slate-400" />}
                                                      </div>
                                                  )}
                                                  <div className={`${isSystem ? 'bg-slate-50 text-slate-500 text-[10px] px-3 py-1 rounded-full border border-slate-100' : 'bg-slate-50 p-3 rounded-lg flex-1 border border-slate-100'}`}>
                                                      {!isSystem && (
                                                          <div className="flex justify-between items-center mb-1">
                                                              <span className="text-xs font-bold text-slate-700">{display.name}</span>
                                                              <span className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                                          </div>
                                                      )}
                                                      <p className="text-sm text-slate-700 leading-relaxed">{comment.content}</p>
                                                  </div>
                                              </div>
                                          );
                                      })
                                  )}
                              </div>
                              <div className="relative mt-2">
                                  <input 
                                    type="text" 
                                    placeholder="Escrever mensagem..." 
                                    value={chatText} 
                                    onChange={e => setChatText(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && addComment(selectedOrder.id, chatText)} 
                                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all text-slate-800" 
                                  />
                                  <button onClick={() => addComment(selectedOrder.id, chatText)} className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors"><Send size={14} /></button>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
