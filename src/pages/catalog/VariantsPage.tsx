import { useState } from "react";
import {
  Plus, Edit2, Trash2, X, CheckCircle, RefreshCw, AlertTriangle,
  Search, Package, ToggleLeft, ToggleRight,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import {
  getAdminVariants, createAdminVariant, updateAdminVariant, deleteAdminVariant,
  getAdminShopProducts, getProductTypes as getAdminProductTypes,
} from "../../api/admin";

const CS = { border: "1px solid rgba(197,206,255,0.52)", boxShadow: "0 12px 30px rgba(15,23,42,0.08)" };

type VForm = {
  productId: string;        // Required
  productTypeId: string;    // Optional but recommended
  name: string;            // Required
  sku: string;             // Required
  price: string;           // Required
  mrp: string;             // Optional
  isActive: boolean;
  specifications: { key: string; value: string }[];  // Renamed from attributes
};

const emptyForm = (): VForm => ({
  productId: "", productTypeId: "", name: "", sku: "", price: "", mrp: "",
  isActive: true,
  specifications: [{ key: "", value: "" }],
});

export default function VariantsPage() {
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ msg: "", type: "success" as "success" | "error" });

  const { data: variantsData, loading, refetch } = useAsync(
    () => getAdminVariants({ limit: 200 }),
    {}, []
  );
  const { data: productsData } = useAsync(() => getAdminShopProducts({ limit: 200 }), {}, []);
  const { data: productTypesData } = useAsync(() => getAdminProductTypes(), {}, []);

  const variants: any[] = (() => {
    const d = variantsData as any;
    if (!d) return [];
    if (Array.isArray(d?.variants)) return d.variants;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d)) return d;
    return [];
  })();

  const products: any[] = (() => {
    const d = productsData as any;
    if (!d) return [];
    if (Array.isArray(d?.products)) return d.products;
    if (Array.isArray(d?.data?.products)) return d.data.products;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d)) return d;
    return [];
  })();

  const productTypes: any[] = (() => {
    const d = productTypesData as any;
    if (!d) return [];
    if (Array.isArray(d?.productTypes)) return d.productTypes;
    if (Array.isArray(d?.data?.productTypes)) return d.data.productTypes;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d)) return d;
    return [];
  })();

  const filtered = variants.filter(v => {
    const matchSearch = !search ||
      v.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.sku?.toLowerCase().includes(search.toLowerCase());
    const vProductId = v.product?._id || v.product?.id || v.product || v.productId;
    const matchProduct = productFilter === "all" || vProductId === productFilter;
    return matchSearch && matchProduct;
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(t => ({ ...t, msg: "" })), 3000);
  };

  const specsToObj = (specs: { key: string; value: string }[]) =>
    specs.reduce((acc, { key, value }) => {
      if (key.trim()) acc[key.trim()] = value;
      return acc;
    }, {} as Record<string, string>);

  const objToSpecs = (obj: Record<string, string> = {}): { key: string; value: string }[] => {
    const entries = Object.entries(obj).map(([key, value]) => ({ key, value }));
    return entries.length ? entries : [{ key: "", value: "" }];
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setFormError("");
    setSaved(false);
    setShowForm(true);
  };

  const openEdit = (v: any) => {
    setEditId(v._id || v.id);
    setForm({
      productId: v.productId || v.product?._id || v.product?.id || v.product || "",
      productTypeId: v.productTypeId || v.productType?._id || v.productType?.id || "",
      name: v.name || "",
      price: String(v.price || ""),
      mrp: String(v.mrp || ""),
      sku: v.sku || "",
      isActive: v.isActive !== false,
      specifications: objToSpecs(v.specifications || {}),
    });
    setFormError("");
    setSaved(false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.productId) { setFormError("Product is required."); return; }
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (!form.sku.trim()) { setFormError("SKU is required."); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setFormError("Valid price is required."); return; }

    const payload: Record<string, unknown> = {
      product: form.productId,        // Send as 'product' field
      name: form.name,
      sku: form.sku,
      price,
      isActive: form.isActive,
    };
    if (form.productTypeId) payload.productTypeId = form.productTypeId;
    if (form.mrp) {
      const mrp = parseFloat(form.mrp);
      if (!isNaN(mrp) && mrp > 0) payload.mrp = mrp;
    }
    const specs = specsToObj(form.specifications);
    if (Object.keys(specs).length > 0) payload.specifications = specs;

    setSaving(true);
    setFormError("");
    try {
      if (editId) {
        await updateAdminVariant(editId, payload);
        showToast("Variant updated.");
      } else {
        await createAdminVariant(payload as any);
        showToast("Variant created.");
      }
      setSaved(true);
      setTimeout(() => { setShowForm(false); setSaved(false); refetch(); }, 1000);
    } catch (err: any) {
      setFormError(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteAdminVariant(id);
      showToast("Variant deleted.");
      setDeleteId(null);
      refetch();
    } catch (err: any) {
      showToast(err?.message || "Failed to delete.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (v: any) => {
    try {
      await updateAdminVariant(v._id || v.id, { isActive: !v.isActive });
      showToast(`${v.name} ${!v.isActive ? "activated" : "deactivated"}.`);
      refetch();
    } catch (err: any) {
      showToast(err?.message || "Failed.", "error");
    }
  };

  const setSpec = (i: number, field: "key" | "value", val: string) => {
    setForm(f => {
      const specifications = [...f.specifications];
      specifications[i] = { ...specifications[i], [field]: val };
      return { ...f, specifications };
    });
  };

  const addSpec = () => setForm(f => ({ ...f, specifications: [...f.specifications, { key: "", value: "" }] }));
  const removeSpec = (i: number) => setForm(f => ({ ...f, specifications: f.specifications.filter((_, idx) => idx !== i) }));

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-900 transition";
  const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="space-y-5">
      {toast.msg && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.type === "success" ? "bg-emerald-600" : "bg-red-500"}`}>
          {toast.type === "success" ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-4">
        {[
          { label: "Total Variants", value: variants.length, dark: true },
          { label: "Active", value: variants.filter(v => v.isActive !== false).length, color: "#10b981" },
          { label: "Inactive", value: variants.filter(v => v.isActive === false).length, color: "#94a3b8" },
        ].map((s, i) => (
          <div key={s.label} className="rounded-xl p-5 flex-1"
            style={i === 0
              ? { background: "linear-gradient(135deg,#1e293b,#0f172a)", boxShadow: "0 12px 28px rgba(15,23,42,0.3)", position: "relative", overflow: "hidden" }
              : { ...CS, backgroundColor: "#fff" }}>
            {i === 0 && <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 1px 1px,rgba(255,255,255,0.4) 1px,transparent 0)", backgroundSize: "14px 14px" }} />}
            <p className={`relative text-2xl font-black ${i === 0 ? "text-white" : ""}`} style={i !== 0 ? { color: s.color } : {}}>{s.value}</p>
            <p className={`relative text-xs font-semibold mt-1 ${i === 0 ? "text-white/70" : "text-gray-500"}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search variants or SKU..."
            className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none" />
        </div>
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none">
          <option value="all">All Products</option>
          {products.map((p: any) => (
            <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>
          ))}
        </select>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:border-gray-900 transition">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
        <button onClick={openCreate} className="ml-auto flex items-center gap-1.5 px-4 py-2 text-white text-sm font-bold rounded-xl" style={{ backgroundColor: "#334155" }}>
          <Plus size={14} /> Add Variant
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden" style={CS}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(197,206,255,0.3)", backgroundColor: "rgba(248,249,255,0.78)" }}>
                {["Variant", "SKU", "Product", "Price", "Specifications", "Status", ""].map((h, idx) => (
                  <th key={h} className={`text-xs font-bold text-gray-400 uppercase tracking-wide px-4 py-3 ${idx === 6 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map((v: any, i: number) => {
                const attrs = v.specifications || {};
                const attrPills = Object.entries(attrs).slice(0, 3);
                const productName = v.product?.name ||
                  products.find(p => (p._id || p.id) === (v.product?._id || v.product?.id || v.product || v.productId))?.name ||
                  "—";
                return (
                  <tr key={v._id || v.id} className="hover:bg-gray-50 transition"
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(197,206,255,0.2)" : "none" }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-gray-900">{v.name}</p>
                      <p className="text-xs text-gray-400">{v._id || v.id}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">{v.sku || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Package size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-600">{productName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">
                      ₹{v.price}{v.mrp && v.mrp > v.price && <span className="ml-2 text-xs text-gray-400 line-through">₹{v.mrp}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {attrPills.map(([k, val]) => (
                          <span key={k} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                            {k}: {String(val)}
                          </span>
                        ))}
                        {Object.keys(attrs).length > 3 && (
                          <span className="text-[10px] text-gray-400">+{Object.keys(attrs).length - 3}</span>
                        )}
                        {Object.keys(attrs).length === 0 && <span className="text-xs text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(v)} className="flex items-center gap-1 text-xs font-semibold">
                        {v.isActive !== false
                          ? <><ToggleRight size={16} className="text-emerald-500" /><span className="text-emerald-600">Active</span></>
                          : <><ToggleLeft size={16} className="text-gray-400" /><span className="text-gray-400">Inactive</span></>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteId(v._id || v.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-sm text-gray-400">
                  {loading ? "Loading..." : "No variants found."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">{editId ? "Edit Variant" : "New Variant"}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>

            {saved ? (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 border border-green-100">
                <CheckCircle size={16} className="text-green-600" />
                <p className="text-sm font-bold text-green-800">Saved successfully.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Product + Product Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Product *</label>
                    <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                      className={inputCls}>
                      <option value="">Select product</option>
                      {products.map((p: any) => (
                        <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Product Type</label>
                    <select value={form.productTypeId} onChange={e => setForm(f => ({ ...f, productTypeId: e.target.value }))}
                      className={inputCls}>
                      <option value="">Select type (optional)</option>
                      {productTypes.map((pt: any) => (
                        <option key={pt._id || pt.id} value={pt._id || pt.id}>{pt.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Variant Name *</label>
                    <input value={form.name} placeholder="e.g. 12x8 Rectangle 3mm"
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>SKU *</label>
                    <input value={form.sku} placeholder="e.g. SKU123"
                      onChange={e => setForm(f => ({ ...f, sku: e.target.value.toUpperCase() }))}
                      className={`${inputCls} font-mono`} />
                  </div>
                </div>

                {/* Price + MRP */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Price (₹) *</label>
                    <input type="number" min="0" value={form.price} placeholder="e.g. 850"
                      onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>MRP (₹)</label>
                    <input type="number" min="0" value={form.mrp} placeholder="e.g. 1000"
                      onChange={e => setForm(f => ({ ...f, mrp: e.target.value }))}
                      className={inputCls} />
                  </div>
                </div>

                {/* Specifications */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls}>Specifications</label>
                    <button onClick={addSpec} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.specifications.map((spec, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={spec.key} placeholder="key (e.g. size)"
                          onChange={e => setSpec(i, "key", e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono focus:outline-none focus:border-gray-900 transition" />
                        <input value={spec.value} placeholder="value (e.g. 12x8)"
                          onChange={e => setSpec(i, "value", e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-gray-900 transition" />
                        {form.specifications.length > 1 && (
                          <button onClick={() => removeSpec(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <span className="text-sm font-semibold text-gray-700">Active</span>
                  <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}>
                    {form.isActive
                      ? <ToggleRight size={26} className="text-emerald-500" />
                      : <ToggleLeft size={26} className="text-gray-400" />}
                  </button>
                </div>

                {formError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs font-semibold text-red-600">{formError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-white text-sm font-bold rounded-xl transition disabled:opacity-50" style={{ backgroundColor: "#334155" }}>
                    {saving ? "Saving..." : editId ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-50"><Trash2 size={20} className="text-red-500" /></div>
              <div>
                <h2 className="font-bold text-gray-900">Delete Variant</h2>
                <p className="text-xs text-gray-500">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting} className="flex-1 py-2.5 text-white text-sm font-bold rounded-xl bg-red-500 hover:bg-red-600 transition disabled:opacity-50">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
