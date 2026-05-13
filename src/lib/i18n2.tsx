import { useI18n, type Lang } from "@/lib/i18n";

type Key =
  | "all" | "tower" | "compound" | "villa" | "commercial" | "mixed"
  | "apartment" | "shop" | "room"
  | "building_name" | "building_name_en" | "building_type" | "floors" | "address" | "city"
  | "save" | "cancel" | "delete" | "delete_confirm" | "delete_building_msg"
  | "add_unit" | "unit_number" | "unit_type" | "tenant_name" | "tenant_phone"
  | "rent_amount" | "rent_type" | "due_day" | "monthly" | "daily" | "yearly"
  | "occupancy" | "monthly_income" | "no_units" | "no_units_msg"
  | "details" | "maintenance" | "utilities" | "legal" | "photos"
  | "contract_end" | "last_payment" | "issue_receipt" | "register_payment"
  | "water" | "electric" | "gas" | "internet" | "active" | "inactive" | "account_number"
  | "no_legal_case" | "file_legal_case" | "case_number" | "court" | "lawyer" | "claim_amount" | "notes"
  | "no_photos" | "add_photo" | "back" | "search" | "no_tenants" | "no_payments"
  | "paid" | "late" | "soon" | "status" | "vacant" | "rented" | "occupancy_status" | "tenant_required"
  | "sort" | "sort_newest" | "sort_oldest" | "sort_name_az" | "sort_name_za" | "sort_units_high" | "sort_units_low"
  | "payments" | "receipts" | "all_payments" | "receipt_number" | "payment_date" | "amount" | "no_payments_msg" | "total" | "this_month" | "filter_all" | "filter_month" | "filter_year" | "print_receipt" | "delete_payment"
  | "rent_month"
  | "units_count" | "units_count_hint" | "edit_unit"
  | "arrears" | "arrears_amount" | "arrears_hint" | "record_payment_now"
  | "payment_summary" | "outstanding_balance" | "total_due" | "total_received"
  | "current_period_rent" | "remaining_after_payment"
  | "monthly_collection" | "paid_tenants" | "late_tenants"
  | "expected_total" | "collected_total" | "collection_rate"
  | "partial_payment" | "quick_collect";

const dict: Record<Key, Partial<Record<Lang, string>>> = {
  all: { ar: "الكل", en: "All", ur: "تمام", zh: "全部", hi: "सभी", bn: "সব", fr: "Tous", es: "Todos", tr: "Tümü" },
  tower: { ar: "برج", en: "Tower", ur: "ٹاور", zh: "塔楼", hi: "टॉवर", bn: "টাওয়ার", fr: "Tour", es: "Torre", tr: "Kule" },
  compound: { ar: "مجمع", en: "Compound", ur: "کمپاؤنڈ", zh: "园区", hi: "कंपाउंड", bn: "কম্পাউন্ড", fr: "Complexe", es: "Complejo", tr: "Site" },
  villa: { ar: "فيلا", en: "Villa", ur: "ولا", zh: "别墅", hi: "विला", bn: "ভিলা", fr: "Villa", es: "Villa", tr: "Villa" },
  commercial: { ar: "تجاري", en: "Commercial", ur: "تجارتی", zh: "商业", hi: "वाणिज्यिक", bn: "বাণিজ্যিক", fr: "Commercial", es: "Comercial", tr: "Ticari" },
  mixed: { ar: "مختلط", en: "Mixed", ur: "مخلوط", zh: "混合", hi: "मिश्रित", bn: "মিশ্র", fr: "Mixte", es: "Mixto", tr: "Karma" },
  apartment: { ar: "شقة", en: "Apartment", ur: "اپارٹمنٹ", zh: "公寓", hi: "अपार्टमेंट", bn: "অ্যাপার্টমেন্ট", fr: "Appart.", es: "Apto.", tr: "Daire" },
  shop: { ar: "محل", en: "Shop", ur: "دکان", zh: "店铺", hi: "दुकान", bn: "দোকান", fr: "Magasin", es: "Tienda", tr: "Dükkan" },
  room: { ar: "غرفة", en: "Room", ur: "کمرہ", zh: "房间", hi: "कमरा", bn: "ঘর", fr: "Chambre", es: "Habitación", tr: "Oda" },
  building_name: { ar: "اسم المبنى", en: "Building name", ur: "عمارت کا نام", zh: "建筑名称", hi: "इमारत का नाम", bn: "ভবনের নাম", fr: "Nom du bâtiment", es: "Nombre del edificio", tr: "Bina adı" },
  building_name_en: { ar: "الاسم بالإنجليزية", en: "Name (English)", ur: "نام (انگریزی)", zh: "英文名", hi: "नाम (अंग्रेज़ी)", bn: "নাম (ইংরেজি)", fr: "Nom (anglais)", es: "Nombre (inglés)", tr: "Ad (İng.)" },
  building_type: { ar: "النوع", en: "Type", ur: "قسم", zh: "类型", hi: "प्रकार", bn: "ধরন", fr: "Type", es: "Tipo", tr: "Tür" },
  floors: { ar: "عدد الطوابق", en: "Floors", ur: "منزلیں", zh: "楼层", hi: "मंज़िलें", bn: "তলা", fr: "Étages", es: "Pisos", tr: "Kat" },
  address: { ar: "العنوان", en: "Address", ur: "پتہ", zh: "地址", hi: "पता", bn: "ঠিকানা", fr: "Adresse", es: "Dirección", tr: "Adres" },
  city: { ar: "المدينة", en: "City", ur: "شہر", zh: "城市", hi: "शहर", bn: "শহর", fr: "Ville", es: "Ciudad", tr: "Şehir" },
  save: { ar: "حفظ", en: "Save", ur: "محفوظ", zh: "保存", hi: "सहेजें", bn: "সংরক্ষণ", fr: "Enregistrer", es: "Guardar", tr: "Kaydet" },
  cancel: { ar: "إلغاء", en: "Cancel", ur: "منسوخ", zh: "取消", hi: "रद्द", bn: "বাতিল", fr: "Annuler", es: "Cancelar", tr: "İptal" },
  delete: { ar: "حذف", en: "Delete", ur: "حذف", zh: "删除", hi: "हटाएं", bn: "মুছুন", fr: "Supprimer", es: "Eliminar", tr: "Sil" },
  delete_confirm: { ar: "هل أنت متأكد؟", en: "Are you sure?", ur: "کیا آپ کو یقین ہے؟", zh: "您确定吗？", hi: "क्या आप निश्चित हैं?", bn: "আপনি কি নিশ্চিত?", fr: "Êtes-vous sûr ?", es: "¿Está seguro?", tr: "Emin misiniz?" },
  delete_building_msg: { ar: "سيتم حذف المبنى وجميع وحداته نهائياً", en: "Building and all its units will be permanently deleted", ur: "عمارت اور تمام یونٹس مستقل طور پر حذف ہو جائیں گے", zh: "将永久删除建筑及其所有单元", hi: "इमारत और सभी इकाइयाँ स्थायी रूप से हटा दी जाएँगी", bn: "ভবন ও সব ইউনিট স্থায়ীভাবে মুছে যাবে", fr: "Le bâtiment et toutes ses unités seront supprimés", es: "El edificio y todas sus unidades serán eliminados", tr: "Bina ve tüm birimleri kalıcı olarak silinecek" },
  add_unit: { ar: "إضافة وحدة", en: "Add unit", ur: "یونٹ شامل کریں", zh: "添加单元", hi: "इकाई जोड़ें", bn: "ইউনিট যোগ", fr: "Ajouter une unité", es: "Agregar unidad", tr: "Birim ekle" },
  unit_number: { ar: "رقم الوحدة", en: "Unit number", ur: "یونٹ نمبر", zh: "单元号", hi: "इकाई संख्या", bn: "ইউনিট নম্বর", fr: "N° d'unité", es: "Nº unidad", tr: "Birim no" },
  unit_type: { ar: "نوع الوحدة", en: "Unit type", ur: "قسم", zh: "类型", hi: "प्रकार", bn: "ধরন", fr: "Type", es: "Tipo", tr: "Tür" },
  tenant_name: { ar: "اسم المستأجر", en: "Tenant name", ur: "کرایہ دار کا نام", zh: "租户姓名", hi: "किरायेदार का नाम", bn: "ভাড়াটের নাম", fr: "Locataire", es: "Inquilino", tr: "Kiracı adı" },
  tenant_phone: { ar: "هاتف المستأجر", en: "Tenant phone", ur: "فون", zh: "电话", hi: "फ़ोन", bn: "ফোন", fr: "Téléphone", es: "Teléfono", tr: "Telefon" },
  rent_amount: { ar: "قيمة الإيجار", en: "Rent amount", ur: "کرایہ", zh: "租金", hi: "किराया राशि", bn: "ভাড়া", fr: "Loyer", es: "Renta", tr: "Kira" },
  rent_type: { ar: "نوع الإيجار", en: "Rent type", ur: "کرایہ کی قسم", zh: "周期", hi: "किराया प्रकार", bn: "ভাড়ার ধরন", fr: "Périodicité", es: "Periodicidad", tr: "Kira tipi" },
  due_day: { ar: "يوم الاستحقاق", en: "Due day", ur: "ادائیگی کا دن", zh: "付款日", hi: "देय दिन", bn: "দেয় দিন", fr: "Jour dû", es: "Día venc.", tr: "Vade günü" },
  monthly: { ar: "شهري", en: "Monthly", ur: "ماہانہ", zh: "月", hi: "मासिक", bn: "মাসিক", fr: "Mensuel", es: "Mensual", tr: "Aylık" },
  daily: { ar: "يومي", en: "Daily", ur: "روزانہ", zh: "日", hi: "दैनिक", bn: "দৈনিক", fr: "Quotidien", es: "Diario", tr: "Günlük" },
  yearly: { ar: "سنوي", en: "Yearly", ur: "سالانہ", zh: "年", hi: "वार्षिक", bn: "বার্ষিক", fr: "Annuel", es: "Anual", tr: "Yıllık" },
  occupancy: { ar: "الإشغال", en: "Occupancy", ur: "قبضہ", zh: "入住率", hi: "अधिभोग", bn: "দখল", fr: "Occupation", es: "Ocupación", tr: "Doluluk" },
  monthly_income: { ar: "الدخل الشهري", en: "Monthly income", ur: "ماہانہ آمدنی", zh: "月收入", hi: "मासिक आय", bn: "মাসিক আয়", fr: "Revenu mensuel", es: "Ingreso mensual", tr: "Aylık gelir" },
  no_units: { ar: "لا توجد وحدات بعد", en: "No units yet", ur: "ابھی کوئی یونٹ نہیں", zh: "暂无单元", hi: "अभी कोई इकाई नहीं", bn: "এখনো ইউনিট নেই", fr: "Aucune unité", es: "Sin unidades", tr: "Henüz birim yok" },
  no_units_msg: { ar: "أضف أول وحدة في هذا المبنى", en: "Add the first unit in this building", ur: "اس عمارت میں پہلا یونٹ شامل کریں", zh: "在此建筑添加第一个单元", hi: "इस इमारत में पहली इकाई जोड़ें", bn: "এই ভবনে প্রথম ইউনিট যোগ করুন", fr: "Ajoutez la première unité", es: "Agrega la primera unidad", tr: "İlk birimi ekleyin" },
  details: { ar: "التفاصيل", en: "Details", ur: "تفصیلات", zh: "详情", hi: "विवरण", bn: "বিস্তারিত", fr: "Détails", es: "Detalles", tr: "Detaylar" },
  maintenance: { ar: "الصيانة", en: "Maintenance", ur: "دیکھ بھال", zh: "维护", hi: "रखरखाव", bn: "রক্ষণাবেক্ষণ", fr: "Maintenance", es: "Mantenim.", tr: "Bakım" },
  utilities: { ar: "المرافق", en: "Utilities", ur: "سہولیات", zh: "公用事业", hi: "उपयोगिता", bn: "ইউটিলিটি", fr: "Services", es: "Servicios", tr: "Hizmetler" },
  legal: { ar: "قانوني", en: "Legal", ur: "قانونی", zh: "法律", hi: "कानूनी", bn: "আইনি", fr: "Légal", es: "Legal", tr: "Hukuki" },
  photos: { ar: "الصور", en: "Photos", ur: "تصاویر", zh: "照片", hi: "तस्वीरें", bn: "ছবি", fr: "Photos", es: "Fotos", tr: "Fotoğraflar" },
  contract_end: { ar: "نهاية العقد", en: "Contract end", ur: "معاہدہ ختم", zh: "合同到期", hi: "अनुबंध समाप्ति", bn: "চুক্তি শেষ", fr: "Fin contrat", es: "Fin contrato", tr: "Sözl. bitişi" },
  last_payment: { ar: "آخر دفعة", en: "Last payment", ur: "آخری ادائیگی", zh: "最后付款", hi: "अंतिम भुगतान", bn: "শেষ পেমেন্ট", fr: "Dernier paiement", es: "Último pago", tr: "Son ödeme" },
  issue_receipt: { ar: "إصدار إيصال", en: "Issue receipt", ur: "رسید جاری کریں", zh: "开收据", hi: "रसीद जारी करें", bn: "রসিদ ইস্যু", fr: "Émettre reçu", es: "Emitir recibo", tr: "Makbuz oluştur" },
  register_payment: { ar: "تسجيل دفعة", en: "Register payment", ur: "ادائیگی درج کریں", zh: "登记付款", hi: "भुगतान दर्ज करें", bn: "পেমেন্ট নথিভুক্ত", fr: "Enregistrer paiement", es: "Registrar pago", tr: "Ödeme kaydet" },
  rent_month: { ar: "شهر الإيجار", en: "Rent month", ur: "کرایہ کا مہینہ", zh: "租金月份", hi: "किराए का महीना", bn: "ভাড়ার মাস", fr: "Mois du loyer", es: "Mes de renta", tr: "Kira ayı" },
  water: { ar: "ماء", en: "Water", ur: "پانی", zh: "水", hi: "पानी", bn: "পানি", fr: "Eau", es: "Agua", tr: "Su" },
  electric: { ar: "كهرباء", en: "Electric", ur: "بجلی", zh: "电", hi: "बिजली", bn: "বিদ্যুৎ", fr: "Électricité", es: "Electricidad", tr: "Elektrik" },
  gas: { ar: "غاز", en: "Gas", ur: "گیس", zh: "燃气", hi: "गैस", bn: "গ্যাস", fr: "Gaz", es: "Gas", tr: "Gaz" },
  internet: { ar: "إنترنت", en: "Internet", ur: "انٹرنیٹ", zh: "网络", hi: "इंटरनेट", bn: "ইন্টারনেট", fr: "Internet", es: "Internet", tr: "İnternet" },
  active: { ar: "مفعّل", en: "Active", ur: "فعال", zh: "已启用", hi: "सक्रिय", bn: "সক্রিয়", fr: "Actif", es: "Activo", tr: "Aktif" },
  inactive: { ar: "معطّل", en: "Inactive", ur: "غیر فعال", zh: "未启用", hi: "निष्क्रिय", bn: "নিষ্ক্রিয়", fr: "Inactif", es: "Inactivo", tr: "Pasif" },
  account_number: { ar: "رقم الحساب", en: "Account number", ur: "اکاؤنٹ نمبر", zh: "账号", hi: "खाता संख्या", bn: "অ্যাকাউন্ট নং", fr: "N° compte", es: "Nº cuenta", tr: "Hesap no" },
  no_legal_case: { ar: "لا توجد قضية", en: "No legal case", ur: "کوئی مقدمہ نہیں", zh: "无法律案件", hi: "कोई मामला नहीं", bn: "কোনো মামলা নেই", fr: "Aucune affaire", es: "Sin caso", tr: "Dava yok" },
  file_legal_case: { ar: "رفع قضية", en: "File legal case", ur: "مقدمہ دائر کریں", zh: "提起诉讼", hi: "मामला दर्ज करें", bn: "মামলা দাখিল", fr: "Déposer une plainte", es: "Presentar caso", tr: "Dava aç" },
  case_number: { ar: "رقم القضية", en: "Case number", ur: "مقدمہ نمبر", zh: "案件号", hi: "केस नंबर", bn: "মামলা নং", fr: "N° dossier", es: "Nº caso", tr: "Dava no" },
  court: { ar: "المحكمة", en: "Court", ur: "عدالت", zh: "法院", hi: "न्यायालय", bn: "আদালত", fr: "Tribunal", es: "Tribunal", tr: "Mahkeme" },
  lawyer: { ar: "المحامي", en: "Lawyer", ur: "وکیل", zh: "律师", hi: "वकील", bn: "আইনজীবী", fr: "Avocat", es: "Abogado", tr: "Avukat" },
  claim_amount: { ar: "قيمة المطالبة", en: "Claim amount", ur: "دعوی رقم", zh: "索赔金额", hi: "दावा राशि", bn: "দাবি পরিমাণ", fr: "Montant", es: "Monto", tr: "Talep tutarı" },
  notes: { ar: "ملاحظات", en: "Notes", ur: "نوٹس", zh: "备注", hi: "टिप्पणियाँ", bn: "নোট", fr: "Notes", es: "Notas", tr: "Notlar" },
  no_photos: { ar: "لا توجد صور", en: "No photos", ur: "تصاویر نہیں", zh: "无照片", hi: "कोई फ़ोटो नहीं", bn: "ছবি নেই", fr: "Pas de photos", es: "Sin fotos", tr: "Fotoğraf yok" },
  add_photo: { ar: "إضافة صورة", en: "Add photo", ur: "تصویر شامل کریں", zh: "添加照片", hi: "फ़ोटो जोड़ें", bn: "ছবি যোগ", fr: "Ajouter photo", es: "Agregar foto", tr: "Fotoğraf ekle" },
  back: { ar: "رجوع", en: "Back", ur: "واپس", zh: "返回", hi: "वापस", bn: "ফিরুন", fr: "Retour", es: "Volver", tr: "Geri" },
  search: { ar: "بحث", en: "Search", ur: "تلاش", zh: "搜索", hi: "खोजें", bn: "অনুসন্ধান", fr: "Rechercher", es: "Buscar", tr: "Ara" },
  no_tenants: { ar: "لا يوجد مستأجرون", en: "No tenants yet", ur: "کوئی کرایہ دار نہیں", zh: "暂无租户", hi: "कोई किरायेदार नहीं", bn: "ভাড়াটে নেই", fr: "Aucun locataire", es: "Sin inquilinos", tr: "Kiracı yok" },
  no_payments: { ar: "لا توجد مدفوعات", en: "No payments", ur: "کوئی ادائیگی نہیں", zh: "无付款", hi: "कोई भुगतान नहीं", bn: "কোনো পেমেন্ট নেই", fr: "Aucun paiement", es: "Sin pagos", tr: "Ödeme yok" },
  paid: { ar: "مدفوع", en: "Paid", ur: "ادا شدہ", zh: "已付", hi: "भुगतान", bn: "প্রদত্ত", fr: "Payé", es: "Pagado", tr: "Ödendi" },
  late: { ar: "متأخر", en: "Late", ur: "تاخیر", zh: "逾期", hi: "देर", bn: "বিলম্বিত", fr: "Retard", es: "Atrasado", tr: "Gecikmiş" },
  soon: { ar: "قريباً", en: "Soon", ur: "جلد", zh: "即将", hi: "जल्द", bn: "শীঘ্রই", fr: "Bientôt", es: "Pronto", tr: "Yakında" },
  status: { ar: "الحالة", en: "Status", ur: "حالت", zh: "状态", hi: "स्थिति", bn: "অবস্থা", fr: "Statut", es: "Estado", tr: "Durum" },
  vacant: { ar: "شاغرة", en: "Vacant", ur: "خالی", zh: "空置", hi: "खाली", bn: "খালি", fr: "Vacant", es: "Vacante", tr: "Boş" },
  rented: { ar: "مؤجّرة", en: "Rented", ur: "کرایہ پر", zh: "已租", hi: "किराये पर", bn: "ভাড়া দেওয়া", fr: "Louée", es: "Alquilada", tr: "Kirada" },
  occupancy_status: { ar: "حالة الإشغال", en: "Occupancy", ur: "حالت", zh: "入住状态", hi: "स्थिति", bn: "অবস্থা", fr: "Occupation", es: "Ocupación", tr: "Doluluk" },
  tenant_required: { ar: "بيانات المستأجر مطلوبة", en: "Tenant info required", ur: "کرایہ دار کی معلومات لازمی", zh: "需要租户信息", hi: "किरायेदार जानकारी अनिवार्य", bn: "ভাড়াটে তথ্য প্রয়োজন", fr: "Infos locataire requises", es: "Datos del inquilino requeridos", tr: "Kiracı bilgisi gerekli" },
  sort: { ar: "ترتيب", en: "Sort", ur: "ترتیب", zh: "排序", hi: "क्रम", bn: "ক্রম", fr: "Trier", es: "Ordenar", tr: "Sırala" },
  sort_newest: { ar: "الأحدث", en: "Newest", ur: "تازہ ترین", zh: "最新", hi: "नवीनतम", bn: "নতুন", fr: "Plus récent", es: "Más reciente", tr: "En yeni" },
  sort_oldest: { ar: "الأقدم", en: "Oldest", ur: "پرانا", zh: "最旧", hi: "सबसे पुराना", bn: "পুরাতন", fr: "Plus ancien", es: "Más antiguo", tr: "En eski" },
  sort_name_az: { ar: "الاسم (أ-ي)", en: "Name (A-Z)", ur: "نام (A-Z)", zh: "名称 A-Z", hi: "नाम A-Z", bn: "নাম A-Z", fr: "Nom (A-Z)", es: "Nombre (A-Z)", tr: "Ad (A-Z)" },
  sort_name_za: { ar: "الاسم (ي-أ)", en: "Name (Z-A)", ur: "نام (Z-A)", zh: "名称 Z-A", hi: "नाम Z-A", bn: "নাম Z-A", fr: "Nom (Z-A)", es: "Nombre (Z-A)", tr: "Ad (Z-A)" },
  sort_units_high: { ar: "الأكثر وحدات", en: "Most units", ur: "زیادہ یونٹ", zh: "单元最多", hi: "अधिक इकाइयाँ", bn: "বেশি ইউনিট", fr: "Plus d'unités", es: "Más unidades", tr: "En çok birim" },
  sort_units_low: { ar: "الأقل وحدات", en: "Fewest units", ur: "کم یونٹ", zh: "单元最少", hi: "कम इकाइयाँ", bn: "কম ইউনিট", fr: "Moins d'unités", es: "Menos unidades", tr: "En az birim" },
  payments: { ar: "المدفوعات", en: "Payments", ur: "ادائیگیاں", zh: "付款", hi: "भुगतान", bn: "পেমেন্ট", fr: "Paiements", es: "Pagos", tr: "Ödemeler" },
  receipts: { ar: "الإيصالات", en: "Receipts", ur: "رسیدیں", zh: "收据", hi: "रसीदें", bn: "রসিদ", fr: "Reçus", es: "Recibos", tr: "Makbuzlar" },
  all_payments: { ar: "كل المدفوعات", en: "All payments", ur: "تمام ادائیگیاں", zh: "所有付款", hi: "सभी भुगतान", bn: "সব পেমেন্ট", fr: "Tous les paiements", es: "Todos los pagos", tr: "Tüm ödemeler" },
  receipt_number: { ar: "رقم الإيصال", en: "Receipt #", ur: "رسید نمبر", zh: "收据号", hi: "रसीद नंबर", bn: "রসিদ নং", fr: "N° reçu", es: "Nº recibo", tr: "Makbuz No" },
  payment_date: { ar: "تاريخ الدفع", en: "Payment date", ur: "تاریخ", zh: "日期", hi: "तारीख़", bn: "তারিখ", fr: "Date", es: "Fecha", tr: "Tarih" },
  amount: { ar: "المبلغ", en: "Amount", ur: "رقم", zh: "金额", hi: "राशि", bn: "পরিমাণ", fr: "Montant", es: "Monto", tr: "Tutar" },
  no_payments_msg: { ar: "لم يتم تسجيل أي مدفوعات بعد", en: "No payments recorded yet", ur: "ابھی کوئی ادائیگی نہیں", zh: "暂无付款记录", hi: "अभी कोई भुगतान नहीं", bn: "এখনো কোনো পেমেন্ট নেই", fr: "Aucun paiement", es: "Sin pagos", tr: "Henüz ödeme yok" },
  total: { ar: "الإجمالي", en: "Total", ur: "کل", zh: "总计", hi: "कुल", bn: "মোট", fr: "Total", es: "Total", tr: "Toplam" },
  this_month: { ar: "هذا الشهر", en: "This month", ur: "اس ماہ", zh: "本月", hi: "इस महीने", bn: "এই মাস", fr: "Ce mois", es: "Este mes", tr: "Bu ay" },
  filter_all: { ar: "الكل", en: "All", ur: "تمام", zh: "全部", hi: "सभी", bn: "সব", fr: "Tout", es: "Todo", tr: "Tümü" },
  filter_month: { ar: "شهر", en: "Month", ur: "ماہ", zh: "月", hi: "महीना", bn: "মাস", fr: "Mois", es: "Mes", tr: "Ay" },
  filter_year: { ar: "سنة", en: "Year", ur: "سال", zh: "年", hi: "साल", bn: "বছর", fr: "Année", es: "Año", tr: "Yıl" },
  print_receipt: { ar: "طباعة", en: "Print", ur: "پرنٹ", zh: "打印", hi: "प्रिंट", bn: "প্রিন্ট", fr: "Imprimer", es: "Imprimir", tr: "Yazdır" },
  delete_payment: { ar: "حذف الدفعة", en: "Delete payment", ur: "حذف کریں", zh: "删除付款", hi: "भुगतान हटाएं", bn: "পেমেন্ট মুছুন", fr: "Supprimer", es: "Eliminar pago", tr: "Ödemeyi sil" },
  units_count: { ar: "عدد الوحدات", en: "Number of units", ur: "یونٹس کی تعداد", zh: "单元数量", hi: "इकाइयों की संख्या", bn: "ইউনিট সংখ্যা", fr: "Nombre d'unités", es: "Número de unidades", tr: "Birim sayısı" },
  units_count_hint: { ar: "سيتم إنشاء وحدات شاغرة مرقّمة تلقائياً يمكن تعديلها لاحقاً", en: "Vacant numbered units will be auto-created; edit them later individually", ur: "خالی نمبر والے یونٹ خودکار بنائیں گے، بعد میں ترمیم کریں", zh: "将自动创建空置编号单元，稍后可单独编辑", hi: "स्वतः खाली क्रमांकित इकाइयाँ बनेंगी; बाद में अलग से संपादित करें", bn: "স্বয়ংক্রিয় খালি ইউনিট তৈরি হবে; পরে পৃথক সম্পাদনা করুন", fr: "Des unités vacantes numérotées seront créées; modifiez-les ensuite individuellement", es: "Se crearán unidades vacantes numeradas; edítalas después individualmente", tr: "Numaralı boş birimler oluşturulur; sonra tek tek düzenleyin" },
  edit_unit: { ar: "تعديل الوحدة", en: "Edit unit", ur: "یونٹ ترمیم", zh: "编辑单元", hi: "इकाई संपादित", bn: "ইউনিট সম্পাদনা", fr: "Modifier l'unité", es: "Editar unidad", tr: "Birimi düzenle" },
  arrears: { ar: "متأخرات", en: "Arrears" },
  arrears_amount: { ar: "مبلغ المتأخرات", en: "Arrears amount" },
  arrears_hint: { ar: "إيجارات سابقة لم تُسدَّد عند تسجيل المستأجر", en: "Previous unpaid rent at registration time" },
  record_payment_now: { ar: "تسجيل دفعة الآن", en: "Record a payment now" },
  payment_summary: { ar: "ملخص الحساب", en: "Account summary" },
  outstanding_balance: { ar: "الرصيد المستحق", en: "Outstanding balance" },
  total_due: { ar: "إجمالي المستحق", en: "Total due" },
  total_received: { ar: "إجمالي المستلم", en: "Total received" },
  current_period_rent: { ar: "إيجار الفترة الحالية", en: "Current period rent" },
  remaining_after_payment: { ar: "المتبقي بعد الدفع", en: "Remaining after payment" },
};

export function useT2() {
  const { lang } = useI18n();
  return (k: Key) => dict[k]?.[lang] ?? dict[k]?.en ?? k;
}
