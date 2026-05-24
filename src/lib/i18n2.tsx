import { useI18n, type Lang } from "@/lib/i18n";

type Key =
  | "all" | "tower" | "compound" | "villa" | "commercial" | "mixed"
  | "apartment" | "shop" | "room"
  | "building_name" | "building_name_en" | "building_type" | "floors" | "address" | "city"
  | "save" | "cancel" | "delete" | "delete_confirm" | "delete_building_msg"
  | "add_unit" | "unit_number" | "unit_type" | "tenant_name" | "tenant_phone"
  | "rent_amount" | "rent_type" | "due_day" | "monthly" | "daily" | "yearly" | "rent_timing" | "rent_timing_advance" | "rent_timing_arrears" | "rent_timing_advance_hint" | "rent_timing_arrears_hint"
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
  | "partial_payment" | "quick_collect"
  | "due_day_of_month" | "next_due" | "days_left" | "days_overdue" | "due_today" | "select_month"
  | "remember_me" | "password_english_only"
  | "forgot_password" | "reset_password" | "send_reset_link" | "reset_email_sent"
  | "new_password" | "confirm_password" | "passwords_dont_match" | "password_updated"
  | "end_tenancy" | "new_tenant" | "vacant_unit" | "vacant_unit_msg" | "add_tenant"
  | "end_date" | "end_reason" | "deposit_outcome" | "deposit_full_refund" | "deposit_partial" | "deposit_kept"
  | "refund_amount" | "outstanding_at_end" | "settle_debt" | "carry_debt"
  | "previous_tenant_arrears" | "tenancy_ended_ok" | "tenancy_started_ok"
  | "contract_start_date" | "vacancy" | "expected_month"
  | "landlord_name" | "landlord_name_hint" | "tenant_statement" | "download_receipt"
  | "landlord_name_en" | "tenant_name_en"
  | "maintenance_requests" | "new_request" | "request_title" | "request_description"
  | "priority" | "priority_low" | "priority_normal" | "priority_high" | "priority_urgent"
  | "status_open" | "status_in_progress" | "status_done" | "status_cancelled"
  | "no_maintenance" | "no_maintenance_msg" | "cost" | "vendor"
  | "recent_activity" | "view_all" | "no_activity" | "no_activity_msg" | "activity_log"
  | "act_created" | "act_updated" | "act_deleted" | "act_restored" | "act_paid" | "act_ended"
  | "ent_building" | "ent_unit" | "ent_tenant" | "ent_payment" | "ent_expense" | "ent_maintenance" | "ent_settings"
  | "filter_action" | "filter_entity";

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
  tenant_name: { ar: "اسم المستأجر (عربي)", en: "Tenant name (Arabic)", ur: "کرایہ دار کا نام", zh: "租户姓名", hi: "किरायेदार का नाम", bn: "ভাড়াটের নাম", fr: "Locataire", es: "Inquilino", tr: "Kiracı adı" },
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
  monthly_collection: { ar: "التحصيل الشهري", en: "Monthly collection" },
  paid_tenants: { ar: "المسدِّدون", en: "Paid tenants" },
  late_tenants: { ar: "المتأخرون عن السداد", en: "Late tenants" },
  expected_total: { ar: "إجمالي المستحق", en: "Expected total" },
  collected_total: { ar: "إجمالي المستلم", en: "Collected total" },
  collection_rate: { ar: "نسبة التحصيل", en: "Collection rate" },
  partial_payment: { ar: "سداد جزئي", en: "Partial payment" },
  quick_collect: { ar: "تحصيل سريع", en: "Quick collect" },
  due_day_of_month: { ar: "اليوم {n} من كل شهر", en: "Day {n} of each month", ur: "ہر ماہ کا دن {n}", zh: "每月{n}日", hi: "हर माह का {n} दिन", bn: "প্রতি মাসের {n} তারিখ", fr: "Le {n} de chaque mois", es: "Día {n} de cada mes", tr: "Her ayın {n}. günü" },
  next_due: { ar: "الاستحقاق القادم", en: "Next due", ur: "اگلی ادائیگی", zh: "下次到期", hi: "अगली देय", bn: "পরবর্তী দেয়", fr: "Prochaine échéance", es: "Próximo venc.", tr: "Sonraki vade" },
  days_left: { ar: "متبقي {n} يوم", en: "{n} days left", ur: "{n} دن باقی", zh: "剩 {n} 天", hi: "{n} दिन बाकी", bn: "{n} দিন বাকি", fr: "{n} j restants", es: "{n} días", tr: "{n} gün kaldı" },
  days_overdue: { ar: "متأخر {n} يوم", en: "{n} days overdue", ur: "{n} دن تاخیر", zh: "逾期 {n} 天", hi: "{n} दिन विलंब", bn: "{n} দিন বিলম্ব", fr: "{n} j de retard", es: "{n} días atraso", tr: "{n} gün gecikme" },
  due_today: { ar: "مستحق اليوم", en: "Due today", ur: "آج واجب", zh: "今日到期", hi: "आज देय", bn: "আজ দেয়", fr: "Dû aujourd'hui", es: "Vence hoy", tr: "Bugün vade" },
  select_month: { ar: "اختر الشهر", en: "Select month", ur: "ماہ منتخب کریں", zh: "选择月份", hi: "महीना चुनें", bn: "মাস নির্বাচন", fr: "Choisir le mois", es: "Elegir mes", tr: "Ay seç" },
  remember_me: { ar: "تذكرني", en: "Remember me", ur: "مجھے یاد رکھیں", zh: "记住我", hi: "मुझे याद रखें", bn: "আমাকে মনে রাখো", fr: "Se souvenir de moi", es: "Recuérdame", tr: "Beni hatırla" },
  password_english_only: { ar: "كلمة المرور بالأحرف الإنجليزية فقط", en: "Password must be in English only", ur: "پاس ورڈ صرف انگریزی میں", zh: "密码仅限英文", hi: "पासवर्ड केवल अंग्रेज़ी में", bn: "পাসওয়ার্ড শুধু ইংরেজিতে", fr: "Mot de passe en anglais uniquement", es: "Contraseña solo en inglés", tr: "Şifre yalnızca İngilizce" },
  forgot_password: { ar: "نسيت كلمة المرور؟", en: "Forgot password?", ur: "پاس ورڈ بھول گئے؟", zh: "忘记密码？", hi: "पासवर्ड भूल गए?", bn: "পাসওয়ার্ড ভুলে গেছেন?", fr: "Mot de passe oublié ?", es: "¿Olvidó su contraseña?", tr: "Şifremi unuttum" },
  reset_password: { ar: "إعادة تعيين كلمة المرور", en: "Reset password", ur: "پاس ورڈ ری سیٹ کریں", zh: "重置密码", hi: "पासवर्ड रीसेट करें", bn: "পাসওয়ার্ড রিসেট", fr: "Réinitialiser le mot de passe", es: "Restablecer contraseña", tr: "Şifreyi sıfırla" },
  send_reset_link: { ar: "إرسال رابط الاستعادة", en: "Send reset link", ur: "ری سیٹ لنک بھیجیں", zh: "发送重置链接", hi: "रीसेट लिंक भेजें", bn: "রিসেট লিঙ্ক পাঠান", fr: "Envoyer le lien", es: "Enviar enlace", tr: "Bağlantıyı gönder" },
  reset_email_sent: { ar: "تحقق من بريدك الإلكتروني لإعادة التعيين", en: "Check your email to reset your password", ur: "ای میل چیک کریں", zh: "请查收您的邮件", hi: "अपना ईमेल देखें", bn: "ইমেইল চেক করুন", fr: "Vérifiez votre e-mail", es: "Revise su correo", tr: "E-postanızı kontrol edin" },
  new_password: { ar: "كلمة مرور جديدة", en: "New password", ur: "نیا پاس ورڈ", zh: "新密码", hi: "नया पासवर्ड", bn: "নতুন পাসওয়ার্ড", fr: "Nouveau mot de passe", es: "Nueva contraseña", tr: "Yeni şifre" },
  confirm_password: { ar: "تأكيد كلمة المرور", en: "Confirm password", ur: "پاس ورڈ کی تصدیق", zh: "确认密码", hi: "पासवर्ड पुष्टि करें", bn: "পাসওয়ার্ড নিশ্চিত করুন", fr: "Confirmer le mot de passe", es: "Confirmar contraseña", tr: "Şifreyi onayla" },
  passwords_dont_match: { ar: "كلمتا المرور غير متطابقتين", en: "Passwords don't match", ur: "پاس ورڈز مماثل نہیں", zh: "密码不匹配", hi: "पासवर्ड मेल नहीं खाते", bn: "পাসওয়ার্ড মিলছে না", fr: "Les mots de passe ne correspondent pas", es: "Las contraseñas no coinciden", tr: "Şifreler eşleşmiyor" },
  password_updated: { ar: "تم تحديث كلمة المرور", en: "Password updated", ur: "پاس ورڈ اپ ڈیٹ ہو گیا", zh: "密码已更新", hi: "पासवर्ड अपडेट हो गया", bn: "পাসওয়ার্ড আপডেট হয়েছে", fr: "Mot de passe mis à jour", es: "Contraseña actualizada", tr: "Şifre güncellendi" },
  end_tenancy: { ar: "إخلاء المستأجر", en: "End tenancy", ur: "کرایہ داری ختم کریں", zh: "结束租约", hi: "किरायेदारी समाप्त करें", bn: "ভাড়াটিয়া অপসারণ", fr: "Mettre fin au bail", es: "Finalizar arrendamiento", tr: "Kiracılığı bitir" },
  new_tenant: { ar: "مستأجر جديد", en: "New tenant", ur: "نیا کرایہ دار", zh: "新租户", hi: "नया किरायेदार", bn: "নতুন ভাড়াটিয়া", fr: "Nouveau locataire", es: "Nuevo inquilino", tr: "Yeni kiracı" },
  add_tenant: { ar: "إضافة مستأجر", en: "Add tenant", ur: "کرایہ دار شامل کریں", zh: "添加租户", hi: "किरायेदार जोड़ें", bn: "ভাড়াটিয়া যোগ করুন", fr: "Ajouter un locataire", es: "Añadir inquilino", tr: "Kiracı ekle" },
  vacant_unit: { ar: "وحدة شاغرة", en: "Vacant unit", ur: "خالی یونٹ", zh: "空置单元", hi: "खाली इकाई", bn: "খালি ইউনিট", fr: "Logement vacant", es: "Unidad vacante", tr: "Boş daire" },
  vacant_unit_msg: { ar: "لا يوجد مستأجر حالياً. يمكنك إضافة مستأجر جديد.", en: "No active tenant. You can add a new tenant.", ur: "کوئی فعال کرایہ دار نہیں", zh: "暂无租户", hi: "कोई किरायेदार नहीं", bn: "কোনো ভাড়াটিয়া নেই", fr: "Aucun locataire actif", es: "Sin inquilino activo", tr: "Aktif kiracı yok" },
  end_date: { ar: "تاريخ الإخلاء", en: "End date", ur: "اختتامی تاریخ", zh: "结束日期", hi: "अंतिम तिथि", bn: "শেষ তারিখ", fr: "Date de fin", es: "Fecha de fin", tr: "Bitiş tarihi" },
  end_reason: { ar: "سبب الإخلاء", en: "Reason", ur: "وجہ", zh: "原因", hi: "कारण", bn: "কারণ", fr: "Motif", es: "Motivo", tr: "Sebep" },
  deposit_outcome: { ar: "مصير التأمين", en: "Deposit outcome", ur: "ضمانت کا فیصلہ", zh: "押金处理", hi: "जमा का निपटान", bn: "জামানতের ফলাফল", fr: "Caution", es: "Depósito", tr: "Depozito" },
  deposit_full_refund: { ar: "مُعاد بالكامل", en: "Refund in full", ur: "مکمل واپسی", zh: "全额退还", hi: "पूर्ण वापसी", bn: "সম্পূর্ণ ফেরত", fr: "Remboursé intégralement", es: "Devolución total", tr: "Tamamen iade" },
  deposit_partial: { ar: "مُحتجز جزئياً", en: "Partial refund", ur: "جزوی واپسی", zh: "部分退还", hi: "आंशिक वापसी", bn: "আংশিক ফেরত", fr: "Remboursement partiel", es: "Devolución parcial", tr: "Kısmi iade" },
  deposit_kept: { ar: "مُحتجز بالكامل", en: "Kept in full", ur: "مکمل ضبط", zh: "全额扣留", hi: "पूरा रखा", bn: "সম্পূর্ণ আটক", fr: "Conservée en totalité", es: "Retenido completo", tr: "Tamamen tutuldu" },
  refund_amount: { ar: "مبلغ الاسترداد", en: "Refund amount", ur: "واپسی کی رقم", zh: "退款金额", hi: "वापसी राशि", bn: "ফেরত পরিমাণ", fr: "Montant remboursé", es: "Importe devuelto", tr: "İade tutarı" },
  outstanding_at_end: { ar: "الرصيد عند الإغلاق", en: "Closing balance", ur: "اختتامی بیلنس", zh: "结余", hi: "समापन शेष", bn: "চূড়ান্ত ব্যালেন্স", fr: "Solde de clôture", es: "Saldo de cierre", tr: "Kapanış bakiyesi" },
  settle_debt: { ar: "تسوية الدين (لا متابعة)", en: "Settle debt (no follow-up)", ur: "قرض طے کریں", zh: "结清", hi: "ऋण निपटान", bn: "ঋণ নিষ্পত্তি", fr: "Solder la dette", es: "Liquidar deuda", tr: "Borcu kapat" },
  carry_debt: { ar: "ترحيل الدين على المستأجر السابق", en: "Carry debt to previous tenant", ur: "قرض منتقل کریں", zh: "结转债务", hi: "ऋण अग्रेषित", bn: "বকেয়া বহন", fr: "Reporter la dette", es: "Trasladar deuda", tr: "Borcu devret" },
  previous_tenant_arrears: { ar: "مستأجر سابق عليه مستحقات", en: "Previous tenant has dues", ur: "سابقہ کرایہ دار", zh: "前租户欠款", hi: "पिछले किरायेदार बकाया", bn: "পূর্ববর্তী ভাড়াটিয়া বকেয়া", fr: "Ancien locataire avec dette", es: "Inquilino anterior con deuda", tr: "Önceki kiracı borçlu" },
  tenancy_ended_ok: { ar: "تم إنهاء العقد بنجاح", en: "Tenancy ended", ur: "ختم", zh: "已结束", hi: "समाप्त", bn: "শেষ", fr: "Bail terminé", es: "Arrendamiento finalizado", tr: "Sözleşme bitti" },
  tenancy_started_ok: { ar: "تم تسجيل المستأجر الجديد", en: "New tenant added", ur: "نیا کرایہ دار شامل", zh: "新租户已添加", hi: "नया किरायेदार जोड़ा", bn: "নতুন ভাড়াটিয়া যোগ", fr: "Nouveau locataire ajouté", es: "Inquilino añadido", tr: "Yeni kiracı eklendi" },
  contract_start_date: { ar: "بداية العقد", en: "Contract start", ur: "معاہدہ آغاز", zh: "合同开始", hi: "अनुबंध शुरू", bn: "চুক্তি শুরু", fr: "Début du bail", es: "Inicio de contrato", tr: "Sözleşme başlangıcı" },
  vacancy: { ar: "الشواغر", en: "Vacancy", ur: "خالی", zh: "空置率", hi: "रिक्ति", bn: "শূন্যতা", fr: "Vacance", es: "Vacancia", tr: "Boşluk" },
  expected_month: { ar: "إيجارات الشهر", en: "Month rents", ur: "ماہ کا کرایہ", zh: "本月租金", hi: "माह का किराया", bn: "মাসের ভাড়া", fr: "Loyers du mois", es: "Rentas del mes", tr: "Ay kirası" },
  landlord_name: { ar: "اسم المؤجِّر (عربي)", en: "Landlord name (Arabic)", ur: "مالک کا نام", zh: "房东姓名", hi: "मकान मालिक का नाम", bn: "মালিকের নাম", fr: "Nom du bailleur", es: "Nombre del arrendador", tr: "Mal sahibi adı" },
  landlord_name_en: { ar: "اسم المؤجِّر (إنجليزي)", en: "Landlord name (English)", ur: "مالک کا نام (انگریزی)", zh: "房东英文名", hi: "नाम (अंग्रेज़ी)", bn: "নাম (ইংরেজি)", fr: "Nom (anglais)", es: "Nombre (inglés)", tr: "Mal sahibi (İng.)" },
  tenant_name_en: { ar: "اسم المستأجر (إنجليزي)", en: "Tenant name (English)", ur: "کرایہ دار کا نام (انگریزی)", zh: "租户英文名", hi: "किरायेदार (अंग्रेज़ी)", bn: "ভাড়াটে (ইংরেজি)", fr: "Locataire (anglais)", es: "Inquilino (inglés)", tr: "Kiracı (İng.)" },
  landlord_name_hint: { ar: "اختياري — يظهر على الإيصالات والعقود", en: "Optional — appears on receipts and contracts", ur: "اختیاری", zh: "可选 — 显示在收据和合同上", hi: "वैकल्पिक", bn: "ঐচ্ছিক", fr: "Facultatif", es: "Opcional", tr: "İsteğe bağlı" },
  tenant_statement: { ar: "كشف حساب المستأجر", en: "Tenant statement", ur: "کرایہ دار کا حساب", zh: "租户对账单", hi: "किरायेदार विवरण", bn: "ভাড়াটিয়ার হিসাব", fr: "Relevé du locataire", es: "Estado del inquilino", tr: "Kiracı ekstresi" },
  download_receipt: { ar: "تنزيل الإيصال", en: "Download receipt", ur: "رسید ڈاؤن لوڈ", zh: "下载收据", hi: "रसीद डाउनलोड", bn: "রসিদ ডাউনলোড", fr: "Télécharger le reçu", es: "Descargar recibo", tr: "Makbuzu indir" },
  maintenance_requests: { ar: "طلبات الصيانة", en: "Maintenance requests", ur: "دیکھ بھال کی درخواستیں", zh: "维护请求", hi: "रखरखाव अनुरोध", bn: "রক্ষণাবেক্ষণ অনুরোধ", fr: "Demandes de maintenance", es: "Solicitudes de mantenimiento", tr: "Bakım talepleri" },
  new_request: { ar: "طلب جديد", en: "New request", ur: "نئی درخواست", zh: "新请求", hi: "नया अनुरोध", bn: "নতুন অনুরোধ", fr: "Nouvelle demande", es: "Nueva solicitud", tr: "Yeni talep" },
  request_title: { ar: "عنوان الطلب", en: "Request title", ur: "عنوان", zh: "标题", hi: "शीर्षक", bn: "শিরোনাম", fr: "Titre", es: "Título", tr: "Başlık" },
  request_description: { ar: "تفاصيل الطلب", en: "Description", ur: "تفصیل", zh: "描述", hi: "विवरण", bn: "বিবরণ", fr: "Description", es: "Descripción", tr: "Açıklama" },
  priority: { ar: "الأولوية", en: "Priority", ur: "ترجیح", zh: "优先级", hi: "प्राथमिकता", bn: "অগ্রাধিকার", fr: "Priorité", es: "Prioridad", tr: "Öncelik" },
  priority_low: { ar: "منخفضة", en: "Low", ur: "کم", zh: "低", hi: "कम", bn: "কম", fr: "Faible", es: "Baja", tr: "Düşük" },
  priority_normal: { ar: "عادية", en: "Normal", ur: "عام", zh: "正常", hi: "सामान्य", bn: "স্বাভাবিক", fr: "Normale", es: "Normal", tr: "Normal" },
  priority_high: { ar: "عالية", en: "High", ur: "زیادہ", zh: "高", hi: "उच्च", bn: "বেশি", fr: "Haute", es: "Alta", tr: "Yüksek" },
  priority_urgent: { ar: "عاجلة", en: "Urgent", ur: "فوری", zh: "紧急", hi: "तत्काल", bn: "জরুরি", fr: "Urgente", es: "Urgente", tr: "Acil" },
  status_open: { ar: "مفتوح", en: "Open", ur: "کھلا", zh: "未处理", hi: "खुला", bn: "খোলা", fr: "Ouvert", es: "Abierto", tr: "Açık" },
  status_in_progress: { ar: "قيد التنفيذ", en: "In progress", ur: "جاری", zh: "进行中", hi: "प्रगति पर", bn: "চলমান", fr: "En cours", es: "En curso", tr: "Devam ediyor" },
  status_done: { ar: "مكتمل", en: "Done", ur: "مکمل", zh: "已完成", hi: "पूर्ण", bn: "সম্পন্ন", fr: "Terminé", es: "Hecho", tr: "Tamam" },
  status_cancelled: { ar: "ملغي", en: "Cancelled", ur: "منسوخ", zh: "已取消", hi: "रद्द", bn: "বাতিল", fr: "Annulé", es: "Cancelado", tr: "İptal" },
  no_maintenance: { ar: "لا توجد طلبات صيانة", en: "No maintenance requests", ur: "کوئی درخواست نہیں", zh: "暂无请求", hi: "कोई अनुरोध नहीं", bn: "কোনো অনুরোধ নেই", fr: "Aucune demande", es: "Sin solicitudes", tr: "Talep yok" },
  no_maintenance_msg: { ar: "أضف أول طلب صيانة لتتبع الأعطال والإصلاحات", en: "Add your first maintenance request to track issues and repairs", ur: "پہلی درخواست شامل کریں", zh: "添加第一个请求", hi: "पहला अनुरोध जोड़ें", bn: "প্রথম অনুরোধ যোগ করুন", fr: "Ajoutez la première demande", es: "Agrega la primera solicitud", tr: "İlk talebi ekleyin" },
  cost: { ar: "التكلفة", en: "Cost", ur: "لاگت", zh: "费用", hi: "लागत", bn: "খরচ", fr: "Coût", es: "Costo", tr: "Maliyet" },
  vendor: { ar: "المُورِّد", en: "Vendor", ur: "وینڈر", zh: "供应商", hi: "विक्रेता", bn: "ভেন্ডর", fr: "Fournisseur", es: "Proveedor", tr: "Tedarikçi" },
  recent_activity: { ar: "آخر النشاطات", en: "Recent activity", ur: "حالیہ سرگرمی", zh: "最近活动", hi: "हाल की गतिविधि", bn: "সাম্প্রতিক কার্যকলাপ", fr: "Activité récente", es: "Actividad reciente", tr: "Son etkinlik" },
  view_all: { ar: "عرض الكل", en: "View all", ur: "سب دیکھیں", zh: "查看全部", hi: "सभी देखें", bn: "সব দেখুন", fr: "Voir tout", es: "Ver todo", tr: "Tümünü gör" },
  no_activity: { ar: "لا توجد نشاطات بعد", en: "No activity yet", ur: "ابھی کوئی سرگرمی نہیں", zh: "暂无活动", hi: "अभी कोई गतिविधि नहीं", bn: "কোনো কার্যকলাপ নেই", fr: "Aucune activité", es: "Sin actividad", tr: "Henüz etkinlik yok" },
  no_activity_msg: { ar: "ستظهر هنا جميع التغييرات في النظام لحظة حدوثها", en: "Every system change will appear here in real time", ur: "تمام تبدیلیاں یہاں ظاہر ہوں گی", zh: "所有更改将显示在此处", hi: "सभी बदलाव यहाँ दिखेंगे", bn: "সব পরিবর্তন এখানে দেখা যাবে", fr: "Tous les changements apparaîtront ici", es: "Todos los cambios aparecerán aquí", tr: "Tüm değişiklikler burada görünür" },
  activity_log: { ar: "سجل النشاطات", en: "Activity log", ur: "سرگرمی لاگ", zh: "活动日志", hi: "गतिविधि लॉग", bn: "কার্যকলাপ লগ", fr: "Journal d'activité", es: "Registro de actividad", tr: "Etkinlik kaydı" },
  act_created: { ar: "إضافة", en: "Created", ur: "بنایا", zh: "新建", hi: "बनाया", bn: "তৈরি", fr: "Créé", es: "Creado", tr: "Oluşturuldu" },
  act_updated: { ar: "تعديل", en: "Updated", ur: "اپ ڈیٹ", zh: "更新", hi: "अद्यतन", bn: "হালনাগাদ", fr: "Mis à jour", es: "Actualizado", tr: "Güncellendi" },
  act_deleted: { ar: "حذف", en: "Deleted", ur: "حذف", zh: "删除", hi: "हटाया", bn: "মুছে ফেলা", fr: "Supprimé", es: "Eliminado", tr: "Silindi" },
  act_restored: { ar: "استرجاع", en: "Restored", ur: "بحال", zh: "恢复", hi: "बहाल", bn: "পুনরুদ্ধার", fr: "Restauré", es: "Restaurado", tr: "Geri yüklendi" },
  act_paid: { ar: "تحصيل", en: "Payment", ur: "ادائیگی", zh: "收款", hi: "भुगतान", bn: "পেমেন্ট", fr: "Paiement", es: "Pago", tr: "Ödeme" },
  act_ended: { ar: "إنهاء", en: "Ended", ur: "ختم", zh: "结束", hi: "समाप्त", bn: "শেষ", fr: "Terminé", es: "Finalizado", tr: "Sonlandı" },
  ent_building: { ar: "مبنى", en: "Building", ur: "عمارت", zh: "建筑", hi: "इमारत", bn: "ভবন", fr: "Bâtiment", es: "Edificio", tr: "Bina" },
  ent_unit: { ar: "وحدة", en: "Unit", ur: "یونٹ", zh: "单元", hi: "इकाई", bn: "ইউনিট", fr: "Unité", es: "Unidad", tr: "Birim" },
  ent_tenant: { ar: "مستأجر", en: "Tenant", ur: "کرایہ دار", zh: "租户", hi: "किरायेदार", bn: "ভাড়াটে", fr: "Locataire", es: "Inquilino", tr: "Kiracı" },
  ent_payment: { ar: "دفعة", en: "Payment", ur: "ادائیگی", zh: "付款", hi: "भुगतान", bn: "পেমেন্ট", fr: "Paiement", es: "Pago", tr: "Ödeme" },
  ent_expense: { ar: "مصروف", en: "Expense", ur: "خرچ", zh: "支出", hi: "खर्च", bn: "ব্যয়", fr: "Dépense", es: "Gasto", tr: "Gider" },
  ent_maintenance: { ar: "صيانة", en: "Maintenance", ur: "دیکھ بھال", zh: "维护", hi: "रखरखाव", bn: "রক্ষণাবেক্ষণ", fr: "Maintenance", es: "Mantenim.", tr: "Bakım" },
  ent_settings: { ar: "إعدادات", en: "Settings", ur: "سیٹنگز", zh: "设置", hi: "सेटिंग्स", bn: "সেটিংস", fr: "Réglages", es: "Ajustes", tr: "Ayarlar" },
  filter_action: { ar: "نوع الإجراء", en: "Action", ur: "عمل", zh: "操作", hi: "क्रिया", bn: "ক্রিয়া", fr: "Action", es: "Acción", tr: "İşlem" },
  filter_entity: { ar: "النوع", en: "Type", ur: "قسم", zh: "类型", hi: "प्रकार", bn: "ধরন", fr: "Type", es: "Tipo", tr: "Tür" },
};

export function useT2() {
  const { lang } = useI18n();
  return (k: Key) => dict[k]?.[lang] ?? dict[k]?.en ?? k;
}
