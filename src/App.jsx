import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  X,
  RefreshCw,
  Camera,
  Image as ImageIcon,
  Eye,
  EyeOff,
  ArrowUpDown,
  Tag,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";

export default function App() {
  // ==========================================
  // 1. STATE MANAGEMENT
  // ==========================================

  // State data utama dari Supabase
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // State filter, pencarian, dan pengurutan (sorting)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [sortBy, setSortBy] = useState("name-asc"); // Pilihan: name-asc, name-desc, price-asc, price-desc, out-of-stock, ready-first

  // State Autentikasi Admin
  const [session, setSession] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // Fitur intip password
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // State Kalkulator Belanja Cepat { [productId]: quantity }
  const [cart, setCart] = useState({});
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // State Modal Tambah/Edit Produk
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    unit: "pcs",
    is_available: true,
    image_url: "",
  });

  // State Manajemen Kategori (CRUD Kategori oleh Admin)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);

  // State Pop-up Modal Konfirmasi & Notifikasi Custom (Menggantikan alert/confirm bawaan browser)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
    isDanger: false,
  });

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    isSuccess: true,
  });

  // ==========================================
  // 2. SIKLUS HIDUP & PENGAMBILAN DATA
  // ==========================================

  useEffect(() => {
    // Pantau status login admin
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Ambil data pertama kali saat aplikasi dibuka
    loadInitialData();

    return () => subscription.unsubscribe();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchCategories(), fetchProducts()]);
    setLoading(false);
  };

  // Mengambil daftar kategori dinamis dari database
  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (!error && data) {
      setCategories(data);
      // Atur default kategori form jika belum terpilih
      if (data.length > 0 && !formData.category) {
        setFormData((prev) => ({ ...prev, category: data[0].name }));
      }
    }
  };

  // Mengambil daftar produk dari database
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (!error && data) {
      setProducts(data);
    }
  };

  // ==========================================
  // 3. LOGIKA AUTENTIKASI ADMIN
  // ==========================================

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      setAuthError("Email atau password tidak tepat.");
    } else {
      setIsAuthModalOpen(false);
      setAuthEmail("");
      setAuthPassword("");
      setShowPassword(false);
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ==========================================
  // 4. LOGIKA KALKULATOR BELANJA
  // ==========================================

  const addToCart = (productId) => {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      }
      return { ...prev, [productId]: next };
    });
  };

  // Membuka modal konfirmasi custom sebelum mereset hitungan
  const triggerResetCalculator = () => {
    setConfirmModal({
      isOpen: true,
      title: "Kosongkan Belanjaan?",
      message:
        "Semua daftar belanjaan yang sedang dihitung akan kembali ke Rp 0.",
      isDanger: true,
      onConfirm: () => {
        setCart({});
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Kalkulasi rincian barang belanjaan
  const calculatedItems = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const prod = products.find((p) => p.id.toString() === id);
        return {
          ...prod,
          qty,
          subtotal: prod ? prod.price * qty : 0,
        };
      })
      .filter((item) => item.name);
  }, [cart, products]);

  const totalBelanja = useMemo(() => {
    return calculatedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
  }, [calculatedItems]);

  const totalItemsCount = useMemo(() => {
    return Object.values(cart).reduce((acc, curr) => acc + curr, 0);
  }, [cart]);

  // Menyalin teks nota untuk WhatsApp
  const copyReceiptText = () => {
    let text = `*TOTAL BELANJA WARUNG*\n-----------------------------\n`;
    calculatedItems.forEach((item) => {
      text += `• ${item.name} (${item.qty}x) = Rp ${item.subtotal.toLocaleString("id-ID")}\n`;
    });
    text += `-----------------------------\n*Total: Rp ${totalBelanja.toLocaleString("id-ID")}*`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ==========================================
  // 5. PENCARIAN, FILTER, & PENGURUTAN
  // ==========================================

  const filteredAndSortedProducts = useMemo(() => {
    // Langkah 1: Filter pencarian & kategori
    let result = products.filter((p) => {
      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "Semua" ||
        p.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });

    // Langkah 2: Urutkan data berdasarkan pilihan user
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "price-asc": // Termurah
          return a.price - b.price;
        case "price-desc": // Termahal
          return b.price - a.price;
        case "name-asc": // A ke Z
          return a.name.localeCompare(b.name, "id", { sensitivity: "base" });
        case "name-desc": // Z ke A
          return b.name.localeCompare(a.name, "id", { sensitivity: "base" });
        case "out-of-stock": // Prioritaskan yang Habis di paling atas
          return a.is_available === b.is_available
            ? 0
            : a.is_available
              ? 1
              : -1;
        case "ready-first": // Prioritaskan yang Tersedia di paling atas
          return a.is_available === b.is_available
            ? 0
            : a.is_available
              ? -1
              : 1;
        default:
          return 0;
      }
    });
  }, [products, searchQuery, selectedCategory, sortBy]);

  // ==========================================
  // 6. UPLOAD FOTO & CRUD PRODUK
  // ==========================================

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setAlertModal({
        isOpen: true,
        title: "Ukuran Gambar Terlalu Besar",
        message: "Maksimal ukuran foto adalah 5 MB.",
        isSuccess: false,
      });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  //// Hapus foto: baik file lokal yang baru dipilih maupun file yang sudah tersimpan di Supabase
  const removeSelectedImage = async () => {
    // Jika gambar sudah tersimpan di Supabase (saat mode edit)
    if (formData.image_url) {
      await deleteImageFromStorage(formData.image_url);
    }

    // Bersihkan state preview dan file picker
    setSelectedFile(null);
    setPreviewUrl("");
    setFormData((prev) => ({ ...prev, image_url: "" }));
  };

  //start App3
  // Helper untuk mengambil path file di dalam bucket dari URL lengkap Supabase
  // Contoh URL: .../storage/v1/object/public/product-images/products/12345_abc.jpg
  // Yang diambil hanya: products/12345_abc.jpg
  const getStoragePathFromUrl = (url) => {
    if (!url) return null;
    const bucketIdentifier = "/product-images/";
    const index = url.indexOf(bucketIdentifier);
    if (index === -1) return null;
    return url.substring(index + bucketIdentifier.length);
  };

  // Helper untuk menghapus file fisik dari Storage Supabase
  const deleteImageFromStorage = async (imageUrl) => {
    const filePath = getStoragePathFromUrl(imageUrl);
    if (!filePath) return;

    const { error } = await supabase.storage
      .from("product-images")
      .remove([filePath]);

    if (error) {
      console.error("Gagal menghapus file foto dari storage:", error.message);
    }
  };
  //end App3

  const uploadImageToStorage = async (file) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(filePath);

    return publicUrl;
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setSelectedFile(null);
    setPreviewUrl("");
    setFormData({
      name: "",
      category: categories.length > 0 ? categories[0].name : "Sembako",
      price: "",
      unit: "pcs",
      is_available: true,
      image_url: "",
    });
    setIsProductModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setSelectedFile(null);
    setPreviewUrl(p.image_url || "");
    setFormData({
      name: p.name,
      category: p.category,
      price: p.price,
      unit: p.unit,
      is_available: p.is_available,
      image_url: p.image_url || "",
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setUploadingImage(true);

    try {
      let finalImageUrl = formData.image_url;

      // Jika ada file gambar baru yang dipilih
      if (selectedFile) {
        // Hapus file lama di storage jika sebelumnya produk sudah punya foto
        if (editingProduct && editingProduct.image_url) {
          await deleteImageFromStorage(editingProduct.image_url);
        }
        // Upload file gambar baru
        finalImageUrl = await uploadImageToStorage(selectedFile);
      }

      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        price: Number(formData.price),
        unit: formData.unit.trim(),
        is_available: formData.is_available,
        image_url: finalImageUrl || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert([payload]);
        if (error) throw error;
      }

      setIsProductModalOpen(false);
      fetchProducts();
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: "Gagal Menyimpan",
        message: err.message.includes("unique_product_name_lower")
          ? "Nama barang tersebut sudah ada di katalog!"
          : err.message,
        isSuccess: false,
      });
    } finally {
      setUploadingImage(false);
    }
  }; //end const handleSaveProduct

  // Konfirmasi hapus produk menggunakan modal kustom + bersihkan file gambarnya dari Storage
  const triggerDeleteProduct = (id, name) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Barang Ini?",
      message: `Barang "${name}" beserta fotonya akan dihapus permanen.`,
      isDanger: true,
      onConfirm: async () => {
        // 1. Cari data barang untuk cek apakah punya image_url
        const targetProduct = products.find((p) => p.id === id);
        if (targetProduct && targetProduct.image_url) {
          await deleteImageFromStorage(targetProduct.image_url);
        }

        // 2. Hapus baris data dari database
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (!error) {
          fetchProducts();
        } else {
          setAlertModal({
            isOpen: true,
            title: "Gagal Menghapus",
            message: error.message,
            isSuccess: false,
          });
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const toggleAvailability = async (p) => {
    const { error } = await supabase
      .from("products")
      .update({ is_available: !p.is_available })
      .eq("id", p.id);
    if (!error) fetchProducts();
  };

  // ==========================================
  // 7. MANAJEMEN KATEGORI DINAMIS
  // ==========================================

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setCategoryLoading(true);
    const { error } = await supabase
      .from("categories")
      .insert([{ name: newCategoryName.trim() }]);

    if (error) {
      setAlertModal({
        isOpen: true,
        title: "Gagal Menambah Kategori",
        message: error.message.includes("unique")
          ? "Kategori sudah ada!"
          : error.message,
        isSuccess: false,
      });
    } else {
      setNewCategoryName("");
      fetchCategories();
    }
    setCategoryLoading(false);
  };

  const handleDeleteCategory = async (catId, catName) => {
    // Cek apakah kategori masih dipakai barang
    const isUsed = products.some(
      (p) => p.category.toLowerCase() === catName.toLowerCase(),
    );
    if (isUsed) {
      setAlertModal({
        isOpen: true,
        title: "Tidak Bisa Dihapus",
        message: `Kategori "${catName}" masih digunakan oleh beberapa barang. Ubah kategori barang terlebih dahulu.`,
        isSuccess: false,
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Hapus Kategori?",
      message: `Hapus kategori "${catName}" dari daftar?`,
      isDanger: true,
      onConfirm: async () => {
        await supabase.from("categories").delete().eq("id", catId);
        fetchCategories();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // ==========================================
  // 8. IMPORT & EXPORT EXCEL (ANTI DUPLIKAT)
  // ==========================================

  const exportToExcel = () => {
    const dataToExport = products.map((p) => ({
      "Nama Barang": p.name,
      Kategori: p.category,
      "Harga (Rp)": p.price,
      Satuan: p.unit,
      Status: p.is_available ? "Tersedia" : "Habis",
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Katalog Warung");
    XLSX.writeFile(
      wb,
      `Katalog_Warung_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wsName]);

        if (rawData.length === 0) {
          setAlertModal({
            isOpen: true,
            title: "File Kosong",
            message: "Tidak ada data produk di dalam file Excel tersebut.",
            isSuccess: false,
          });
          return;
        }

        // 1. Validasi Kategori: Cek apakah ada kategori di Excel yang belum terdaftar di database
        const registeredCategoryNames = categories.map((c) =>
          c.name.toLowerCase().trim(),
        );
        const missingCategories = new Set();

        rawData.forEach((row) => {
          const rawCat = String(row["Kategori"] || row["kategori"] || "")
            .trim()
            .toLowerCase();
          if (rawCat && !registeredCategoryNames.includes(rawCat)) {
            missingCategories.add(
              String(row["Kategori"] || row["kategori"]).trim(),
            );
          }
        });

        // Jika ada kategori yang belum terdaftar, batalkan import dan tampilkan modal petunjuk
        if (missingCategories.size > 0) {
          const missingList = Array.from(missingCategories).join(", ");
          setAlertModal({
            isOpen: true,
            title: "Kategori Belum Terdaftar!",
            message: `Kategori "${missingList}" belum ada di database. Silakan klik tombol "Kelola Kategori" di toolbar admin untuk menambahkannya terlebih dahulu sebelum import.`,
            isSuccess: false,
          });
          return;
        }

        // 2. Logika Anti-Duplikasi (Smart Update / Upsert di sisi client)
        let newCount = 0;
        let updateCount = 0;

        for (const row of rawData) {
          const rawName = String(
            row["Nama Barang"] || row["nama"] || "",
          ).trim();
          const rawCat = String(
            row["Kategori"] || row["kategori"] || "",
          ).trim();
          const rawPrice = Number(
            row["Harga (Rp)"] || row["Harga"] || row["harga"] || 0,
          );
          const rawUnit = String(
            row["Satuan"] || row["satuan"] || "pcs",
          ).trim();
          const rawStatus =
            String(row["Status"] || "").toLowerCase() !== "habis";

          if (!rawName || rawPrice <= 0) continue;

          // Cocokkan nama kategori dengan format aslinya di database
          const matchedCategoryObj = categories.find(
            (c) => c.name.toLowerCase() === rawCat.toLowerCase(),
          );
          const finalCategory = matchedCategoryObj
            ? matchedCategoryObj.name
            : "Lainnya";

          // Periksa apakah produk sudah ada di database (Case-Insensitive)
          const existingProduct = products.find(
            (p) => p.name.trim().toLowerCase() === rawName.toLowerCase(),
          );

          if (existingProduct) {
            // Update barang yang sudah ada (tidak bikin baris baru)
            await supabase
              .from("products")
              .update({
                category: finalCategory,
                price: rawPrice,
                unit: rawUnit,
                is_available: rawStatus,
              })
              .eq("id", existingProduct.id);
            updateCount++;
          } else {
            // Tambah barang baru
            await supabase.from("products").insert([
              {
                name: rawName,
                category: finalCategory,
                price: rawPrice,
                unit: rawUnit,
                is_available: rawStatus,
              },
            ]);
            newCount++;
          }
        }

        fetchProducts();
        setAlertModal({
          isOpen: true,
          title: "Import Excel Berhasil!",
          message: `Berhasil memproses data: ${newCount} produk baru ditambahkan, dan ${updateCount} produk lama diperbarui harganya tanpa duplikat.`,
          isSuccess: true,
        });
      } catch (err) {
        setAlertModal({
          isOpen: true,
          title: "Gagal Membaca File",
          message:
            "Pastikan format kolom Excel: Nama Barang, Kategori, Harga (Rp), Satuan.",
          isSuccess: false,
        });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // Reset input file
  };

  // ==========================================
  // 9. RENDER ANTARMUKA (JSX)
  // ==========================================

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-30 bg-blue-800 text-white shadow-md">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight">
              Katalog Warung
            </h1>
            <p className="text-xs text-blue-200">
              Cek harga & hitung belanjaan cepat
            </p>
          </div>

          <div className="flex items-center gap-2">
            {session ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-2 rounded-xl font-bold transition"
              >
                <Unlock size={15} /> Keluar
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="p-2.5 text-blue-200 hover:text-white transition rounded-full hover:bg-blue-700"
                title="Login Pemilik Warung"
              >
                <Lock size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --- ADMIN TOOLBAR (Hanya muncul saat login) --- */}
      {session && (
        <div className="bg-blue-100 border-b border-blue-200 px-4 py-2.5">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openAddModal}
                className="flex items-center gap-1 bg-blue-800 text-white px-3 py-2 rounded-xl text-xs font-bold shrink-0 hover:bg-blue-900 shadow-sm"
              >
                <Plus size={16} /> Tambah Barang
              </button>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center gap-1 bg-white border border-blue-300 text-blue-800 px-3 py-2 rounded-xl text-xs font-bold shrink-0 hover:bg-blue-50 shadow-sm"
              >
                <Tag size={15} /> Kelola Kategori
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1 bg-white border border-blue-300 text-blue-800 px-2.5 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-blue-50 shadow-sm">
                <Upload size={14} /> Import Excel
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-1 bg-white border border-blue-300 text-blue-800 px-2.5 py-2 rounded-xl text-xs font-bold hover:bg-blue-50 shadow-sm"
              >
                <Download size={14} /> Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- KONTEN UTAMA --- */}
      <main className="max-w-xl mx-auto px-4 mt-3 space-y-3">
        {/* Search Bar & Pengurutan (Sorting) */}
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari telur, kopi, snack, beras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white pl-10 pr-10 py-3 rounded-xl border border-slate-300 shadow-sm text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-medium"
            />
            <Search
              className="absolute left-3.5 top-3.5 text-slate-400"
              size={20}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Tombol Pilihan Urutkan Data (Sorting) */}
          <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-1 font-semibold text-slate-700">
              <ArrowUpDown size={14} /> Urutkan:
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent font-bold text-blue-800 focus:outline-none cursor-pointer"
            >
              <option value="name-asc">Nama (A → Z)</option>
              <option value="name-desc">Nama (Z → A)</option>
              <option value="price-asc">Harga: Termurah</option>
              <option value="price-desc">Harga: Termahal</option>
              <option value="out-of-stock">Stok: Habis Dulu</option>
              <option value="ready-first">Stok: Ready Dulu</option>
            </select>
          </div>
        </div>

        {/* Filter Kategori Horizontal */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar text-sm">
          <button
            onClick={() => setSelectedCategory("Semua")}
            className={`px-4 py-2 rounded-full font-bold shrink-0 transition ${
              selectedCategory === "Semua"
                ? "bg-blue-800 text-white shadow"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Semua
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-4 py-2 rounded-full font-bold shrink-0 transition ${
                selectedCategory.toLowerCase() === cat.name.toLowerCase()
                  ? "bg-blue-800 text-white shadow"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Daftar Barang */}
        {loading ? (
          <div className="text-center py-16 text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="animate-spin text-blue-800" size={28} />
            <p className="text-sm font-medium">Memuat katalog warung...</p>
          </div>
        ) : filteredAndSortedProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-6">
            <p className="text-base font-bold text-slate-700">
              Barang Tidak Ditemukan
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Coba kata kunci lain atau ubah filter kategori.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredAndSortedProducts.map((product) => {
              const qtyInCart = cart[product.id] || 0;
              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-xl p-3 border shadow-sm transition flex flex-col gap-2 ${
                    !product.is_available
                      ? "opacity-70 bg-slate-50 border-slate-200"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3 items-center">
                      {/* Foto Barang */}
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0 bg-slate-100"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 text-slate-300">
                          <ImageIcon size={24} />
                        </div>
                      )}

                      {/* Info Detail Barang */}
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {product.category}
                        </span>
                        <h2 className="text-base font-bold text-slate-900 mt-0.5 leading-tight">
                          {product.name}
                        </h2>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-base font-black text-blue-900">
                            Rp {Number(product.price).toLocaleString("id-ID")}
                          </span>
                          <span className="text-xs text-slate-500 font-bold">
                            / {product.unit}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge Ketersediaan */}
                    <div>
                      {product.is_available ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 size={13} /> Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-full">
                          <XCircle size={13} /> Habis
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tombol Aksi Bawah Card */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                    {/* Aksi Khusus Admin */}
                    {session ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleAvailability(product)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold ${
                            product.is_available
                              ? "border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100"
                              : "border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                          }`}
                        >
                          {product.is_available ? "Set Habis" : "Set Ready"}
                        </button>
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1.5 text-slate-600 hover:text-blue-800 hover:bg-slate-100 rounded-lg"
                          title="Edit Barang"
                        >
                          <Edit3 size={17} />
                        </button>
                        <button
                          onClick={() =>
                            triggerDeleteProduct(product.id, product.name)
                          }
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Hapus Barang"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Tombol Kalkulator Hitung Cepat */}
                    <div>
                      {qtyInCart === 0 ? (
                        <button
                          onClick={() => addToCart(product.id)}
                          disabled={!product.is_available}
                          className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-black shadow-sm transition ${
                            product.is_available
                              ? "bg-orange-600 text-white hover:bg-orange-700 active:scale-95"
                              : "bg-slate-200 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          <Plus size={16} /> Hitung
                        </button>
                      ) : (
                        <div className="flex items-center bg-orange-50 border border-orange-300 rounded-xl p-0.5">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            className="w-9 h-9 flex items-center justify-center font-black text-orange-700 hover:bg-orange-200 rounded-lg text-lg"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-black text-sm text-orange-950">
                            {qtyInCart}
                          </span>
                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            className="w-9 h-9 flex items-center justify-center font-black text-orange-700 hover:bg-orange-200 rounded-lg text-lg"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* --- STICKY BOTTOM BAR (Kalkulator Melayang) --- */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-orange-500 shadow-2xl px-4 py-3">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500 font-semibold">
                Total Hitungan ({totalItemsCount} item):
              </p>
              <p className="text-xl font-black text-slate-900 leading-tight">
                Rp {totalBelanja.toLocaleString("id-ID")}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={triggerResetCalculator}
                className="p-2.5 text-slate-400 hover:text-red-600 rounded-xl border border-slate-200 hover:bg-red-50 transition"
                title="Reset Hitungan"
              >
                <RotateCcw size={19} />
              </button>
              <button
                onClick={() => setIsReceiptOpen(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-black text-sm px-4 py-2.5 rounded-xl shadow-md transition"
              >
                Rincian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL-MODAL DIALOG (Kustom & Bersih)
         ========================================== */}

      {/* --- MODAL 1: RINCIAN BELANJA --- */}
      {isReceiptOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-black text-slate-900">
                Rincian Hitungan Belanja
              </h2>
              <button
                onClick={() => setIsReceiptOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={22} />
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 py-3 flex-1">
              {calculatedItems.map((item) => (
                <div
                  key={item.id}
                  className="py-2 flex justify-between items-center"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-800">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      {item.qty} x Rp{" "}
                      {Number(item.price).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm text-slate-900">
                      Rp {item.subtotal.toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700">Total Akhir</span>
                <span className="text-2xl font-black text-blue-900">
                  Rp {totalBelanja.toLocaleString("id-ID")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={copyReceiptText}
                  className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-xs transition"
                >
                  {copied ? (
                    <Check size={16} className="text-emerald-600" />
                  ) : (
                    <Copy size={16} />
                  )}
                  {copied ? "Tersalin!" : "Salin Catatan"}
                </button>
                <button
                  onClick={() => {
                    setCart({});
                    setIsReceiptOpen(false);
                  }}
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl text-xs transition"
                >
                  Selesai & Bersihkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: LOGIN PEMILIK WARUNG (DENGAN INTIP PASSWORD) --- */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Lock size={18} className="text-blue-800" /> Login Pemilik
                Warung
              </h2>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {authError && (
              <div className="bg-red-50 text-red-700 text-xs p-3 rounded-xl mb-3 border border-red-200 font-bold">
                {authError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none font-medium"
                  placeholder="admin@warung.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 border rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none font-medium"
                    placeholder="••••••••"
                  />
                  {/* Tombol Intip Password Ramah Boomer */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    title={
                      showPassword ? "Sembunyikan password" : "Lihat password"
                    }
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-800 hover:bg-blue-900 text-white font-black py-3 rounded-xl text-sm transition mt-2 shadow"
              >
                {authLoading ? "Memeriksa..." : "Masuk Admin"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: TAMBAH / EDIT BARANG --- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h2 className="text-lg font-black text-slate-900">
                {editingProduct ? "Edit Data Barang" : "Tambah Barang Baru"}
              </h2>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Barang *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Cth: Telur Ayam Negeri, Permen Kopiko"
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none bg-white font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Harga (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    placeholder="20000"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Satuan Jual *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                    placeholder="kg, pcs, 3 pcs, ikat"
                    className="w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status Ketersediaan
                  </label>
                  <select
                    value={formData.is_available ? "true" : "false"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_available: e.target.value === "true",
                      })
                    }
                    className="w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-600 outline-none bg-white font-medium"
                  >
                    <option value="true">Tersedia (Ready)</option>
                    <option value="false">Habis (Kosong)</option>
                  </select>
                </div>
              </div>

              {/* Upload / Kamera Foto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Foto Produk (Opsional)
                </label>

                {previewUrl ? (
                  <div className="relative inline-block mt-1">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-24 h-24 object-cover rounded-xl border-2 border-blue-600 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={removeSelectedImage}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:bg-slate-50 transition bg-slate-50/50">
                    <Camera className="text-slate-400 mb-1" size={28} />
                    <span className="text-xs font-bold text-blue-800">
                      Ambil Foto / Pilih Gambar
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Bisa pakai kamera HP langsung
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => setIsProductModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl text-sm font-bold hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="flex-1 bg-blue-800 text-white py-3 rounded-xl text-sm font-black hover:bg-blue-900 shadow flex items-center justify-center gap-1.5"
                >
                  {uploadingImage ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />{" "}
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Barang"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: KELOLA KATEGORI (CRUD KATEGORI) --- */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3 mb-3">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                <Tag size={18} className="text-blue-800" /> Kelola Kategori
              </h2>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Tambah Kategori Baru */}
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nama kategori baru..."
                className="flex-1 px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none font-medium"
              />
              <button
                type="submit"
                disabled={categoryLoading}
                className="bg-blue-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-blue-900 shrink-0"
              >
                + Tambah
              </button>
            </form>

            {/* List Kategori Terdaftar */}
            <p className="text-xs font-bold text-slate-500 mb-2">
              Daftar Kategori Saat Ini:
            </p>
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border rounded-xl px-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-slate-800">{cat.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="text-slate-400 hover:text-red-600 p-1"
                    title="Hapus Kategori"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-200 mt-4"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL 5: POP-UP KONFIRMASI KUSTOM (Ganti confirm default browser) --- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-2xl p-5 shadow-2xl text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-black text-slate-900">
              {confirmModal.title}
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() =>
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`w-full py-2.5 rounded-xl text-xs font-black text-white ${
                  confirmModal.isDanger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-800 hover:bg-blue-900"
                }`}
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 6: POP-UP NOTIFIKASI KUSTOM (Ganti alert default browser) --- */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-2xl p-5 shadow-2xl text-center space-y-3">
            <div
              className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
                alertModal.isSuccess
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {alertModal.isSuccess ? (
                <CheckCircle2 size={26} />
              ) : (
                <AlertTriangle size={26} />
              )}
            </div>
            <h3 className="text-base font-black text-slate-900">
              {alertModal.title}
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {alertModal.message}
            </p>

            <button
              onClick={() =>
                setAlertModal((prev) => ({ ...prev, isOpen: false }))
              }
              className="w-full bg-blue-800 text-white py-2.5 rounded-xl text-xs font-black hover:bg-blue-900 pt-2"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
