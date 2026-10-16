import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, ChevronDown, CircleHelp, Download, FileCheck2,
  FilePlus2, FileText, Filter, LayoutDashboard, LogOut, Menu, MoreHorizontal,
  Plus, ReceiptText, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Users, Trash2, Eye,
  Wallet, X
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Tab = "Dashboard" | "Kunden" | "Angebote" | "Rechnungen" | "Berechnung" | "Ausgaben" | "Einstellungen";
type Customer = { id: string; name: string; email?: string; city?: string; customer_number: string };
type Doc = { id: string; number: string; customer: string; customerId?: string; date: string; amount: number; status: string; kind: "Angebot" | "Rechnung" };
type DraftItem = { description: string; quantity: string; unit: string; unit_price: string };
type Expense = { id: string; expense_date: string; description: string; category: string; amount: number; tax_amount: number; notes?: string; receipt_path?: string };

const money = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const dateFmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("de-DE");
const statusLabel = (status: string) => {
  const labels: Record<string, string> = { draft: "Entwurf", open: "Offen", accepted: "Angenommen", rejected: "Abgelehnt", expired: "Abgelaufen", converted: "Umgewandelt", cancelled: "Storniert", partially_paid: "Teilweise bezahlt", paid: "Bezahlt", overdue: "Überfällig" };
  return labels[status] ?? (status || "Entwurf");
};
const demoCustomers: Customer[] = [
  { id: "c1", customer_number: "KD-1001", name: "Müller GmbH", email: "mueller@example.com", city: "Cham" },
  { id: "c2", customer_number: "KD-1002", name: "Schmidt Bau", email: "schmidt@example.com", city: "Furth im Wald" },
  { id: "c3", customer_number: "KD-1003", name: "AutoClean Service", email: "autoclean@example.com", city: "Bad Kötzting" }
];
const demoDocs: Doc[] = [
  { id: "d1", number: "RE-2026-001", customer: "Müller GmbH", date: "2026-10-02", amount: 1250, status: "Bezahlt", kind: "Rechnung" },
  { id: "d2", number: "RE-2026-002", customer: "Schmidt Bau", date: "2026-10-06", amount: 750, status: "Offen", kind: "Rechnung" },
  { id: "d3", number: "RE-2026-003", customer: "AutoClean Service", date: "2026-10-09", amount: 480, status: "Offen", kind: "Rechnung" },
  { id: "d4", number: "AN-2026-001", customer: "Müller GmbH", date: "2026-10-01", amount: 1250, status: "Angenommen", kind: "Angebot" },
  { id: "d5", number: "AN-2026-002", customer: "Schmidt Bau", date: "2026-10-05", amount: 2480, status: "Offen", kind: "Angebot" },
  { id: "d6", number: "AN-2026-003", customer: "AutoClean Service", date: "2026-10-08", amount: 890, status: "Offen", kind: "Angebot" }
];

export default function App() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>(demoCustomers);
  const [docs, setDocs] = useState<Doc[]>(demoDocs);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0,10));
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Betriebsausgabe");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseTax, setExpenseTax] = useState("0");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [receiptReading, setReceiptReading] = useState(false);
  const [receiptReadError, setReceiptReadError] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [showDocForm, setShowDocForm] = useState<"Angebot" | "Rechnung" | null>(null);
  const [docCustomer, setDocCustomer] = useState(demoCustomers[0].id);
  const [docDescription, setDocDescription] = useState("Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot.");
  const [docItems, setDocItems] = useState<DraftItem[]>([{ description: "Arbeitsleistung", quantity: "1", unit: "Stunde", unit_price: "250" }]);
  const [notice, setNotice] = useState("");
  const [liveData, setLiveData] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [documentDeleting, setDocumentDeleting] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLoggedIn(true);
        setUserEmail(data.session.user.email ?? "");
        void loadLiveData();
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
      setUserEmail(session?.user.email ?? "");
      if (session) void loadLiveData();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadLiveData() {
    if (!supabase) return;
    const { data: companyRows, error: companyError } = await supabase
      .from("companies").select("id,name").eq("name", "T.S. Serviceleistungen: Digitale Lösungen").limit(1);
    if (companyError || !companyRows?.length) {
      setNotice("Login aktiv, aber Demo-Unternehmen nicht gefunden oder nicht berechtigt.");
      return;
    }
    const currentCompanyId = companyRows[0].id;
    setCompanyId(currentCompanyId);
    const [customerResult, invoiceResult, offerResult, expenseResult] = await Promise.all([
      supabase.from("customers").select("id,customer_number,name,email,city").eq("company_id", currentCompanyId).order("customer_number"),
      supabase.from("invoices").select("id,company_id,customer_id,invoice_number,customer_name,issue_date,total_amount,status").eq("company_id", currentCompanyId).order("issue_date", { ascending: false }),
      supabase.from("offers").select("id,company_id,customer_id,offer_number,customer_name,issue_date,total_amount,status").eq("company_id", currentCompanyId).order("issue_date", { ascending: false }),
      supabase.from("expenses").select("id,expense_date,description,category,amount,tax_amount,notes,receipt_path").eq("company_id", currentCompanyId).order("expense_date", { ascending: false })
    ]);
    if (customerResult.error || invoiceResult.error || offerResult.error || expenseResult.error) {
      setNotice("Daten konnten nicht vollständig geladen werden. Bitte RLS und Unternehmensmitgliedschaft prüfen.");
      return;
    }
    setCustomers((customerResult.data ?? []).map((c) => ({ id: c.id, customer_number: c.customer_number, name: c.name, email: c.email ?? "", city: c.city ?? "" })));
    if (customerResult.data?.length && !customerResult.data.some((c) => c.id === docCustomer)) setDocCustomer(customerResult.data[0].id);
    const invoiceDocs: Doc[] = (invoiceResult.data ?? []).map((d) => ({ id: d.id, number: d.invoice_number, customer: d.customer_name, customerId: d.customer_id, date: d.issue_date, amount: Number(d.total_amount), status: statusLabel(d.status), kind: "Rechnung" }));
    const offerDocs: Doc[] = (offerResult.data ?? []).map((d) => ({ id: d.id, number: d.offer_number, customer: d.customer_name, customerId: d.customer_id, date: d.issue_date, amount: Number(d.total_amount), status: statusLabel(d.status), kind: "Angebot" }));
    setDocs([...invoiceDocs, ...offerDocs]);
    setExpenses((expenseResult.data ?? []).map((e) => ({ id:e.id, expense_date:e.expense_date, description:e.description, category:e.category ?? "Betriebsausgabe", amount:Number(e.amount), tax_amount:Number(e.tax_amount ?? 0), notes:e.notes ?? "", receipt_path:e.receipt_path ?? "" })));
    setLiveData(true);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    if (!supabase) {
      setLoginError("Supabase ist noch nicht konfiguriert. Für die lokale Vorschau kannst du den Demo-Zugang verwenden.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError("Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
  }

  async function deleteDocument(doc: Doc) {
    if (!supabase || !companyId || !liveData) {
      setNotice("Löschen nicht möglich: Keine aktive Supabase-Verbindung.");
      return;
    }
    const confirmed = window.confirm(`Soll ${doc.kind.toLowerCase()} ${doc.number} wirklich dauerhaft gelöscht werden?`);
    if (!confirmed) return;
    setDocumentDeleting(true);
    setNotice("");
    try {
      const table = doc.kind === "Rechnung" ? "invoices" : "offers";
      const { error } = await supabase.from(table).delete().eq("id", doc.id).eq("company_id", companyId);
      if (error) throw error;
      setSelectedDoc(current => current?.id === doc.id ? null : current);
      await loadLiveData();
      setNotice(`${doc.kind} ${doc.number} wurde gelöscht.`);
    } catch (error) {
      console.error("Document delete failed:", error);
      const message = error instanceof Error ? error.message : "Unbekannter Datenbankfehler";
      setNotice(`${doc.kind} konnte nicht gelöscht werden: ${message}`);
    } finally {
      setDocumentDeleting(false);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setLoggedIn(false);
    setLiveData(false);
  }

  const filteredCustomers = useMemo(() => customers.filter(c => `${c.name} ${c.email} ${c.customer_number} ${c.city}`.toLowerCase().includes(search.toLowerCase())), [customers, search]);
  const filteredDocs = useMemo(() => docs.filter(d => `${d.number} ${d.customer} ${d.status} ${d.kind}`.toLowerCase().includes(search.toLowerCase())), [docs, search]);
  const invoices = docs.filter(d => d.kind === "Rechnung");
  const offers = docs.filter(d => d.kind === "Angebot");
  const totalInvoiced = invoices.reduce((sum, d) => sum + d.amount, 0);
  const outstanding = invoices.filter(d => d.status !== "Bezahlt").reduce((sum, d) => sum + d.amount, 0);
  const offerVolume = offers.filter(d => d.status === "Offen").reduce((sum, d) => sum + d.amount, 0);

  if (!loggedIn) return <Login email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSubmit={signIn} error={loginError} configured={isSupabaseConfigured} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">TS<span>•</span></div>
          <div><strong>T.S. Serviceleistungen</strong><small>Digitale Lösungen</small></div>
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(false)} aria-label="Menü schließen"><X size={18}/></button>
        </div>
        <div className="workspace-label">ARBEITSBEREICH</div>
        <nav>
          {([
            ["Dashboard", LayoutDashboard], ["Kunden", Users], ["Angebote", FileText],
            ["Rechnungen", ReceiptText], ["Berechnung", Activity], ["Ausgaben", Wallet], ["Einstellungen", Settings]
          ] as const).map(([name, Icon]) => (
            <button key={name} className={`nav-item ${tab === name ? "active" : ""}`} onClick={() => { setTab(name); setMenuOpen(false); }}>
              <Icon size={18}/><span>{name}</span>
              {name === "Rechnungen" && <span className="nav-count">{invoices.filter(d => d.status !== "Bezahlt").length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card"><Sparkles size={17}/><div><strong>Demo-Modus</strong><small>{liveData ? "Supabase verbunden" : "Beispieldaten"}</small></div></div>
          <button className="nav-item" onClick={() => setNotice("Die Hilfe für die Demo wird im nächsten Ausbauschritt ergänzt.")}><CircleHelp size={18}/><span>Hilfe & Support</span></button>
          <button className="nav-item" onClick={signOut}><LogOut size={18}/><span>Abmelden</span></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(true)} aria-label="Menü öffnen"><Menu size={20}/></button>
          <div className="breadcrumbs">T.S. Serviceleistungen <span>/</span> <strong>{tab}</strong></div>
          <div className="top-actions">
            <label className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen …"/></label>
            <button className="icon-btn" onClick={() => setNotice("Du bist auf dem aktuellen Demo-Stand.")} aria-label="Benachrichtigungen"><Bell size={18}/></button>
            <div className="user-chip"><div className="avatar">TS</div><div><strong>{userEmail || "Administrator"}</strong><small>Administrator</small></div><ChevronDown size={15}/></div>
          </div>
        </header>

        {notice && <div className="notice"><span>{notice}</span><button className="icon-btn" onClick={() => setNotice("")} aria-label="Meldung schließen"><X size={16}/></button></div>}

        <section className="page">
          <div className="page-heading">
            <div><div className="eyebrow"><span className="gold-dot"/> UNTERNEHMENSÜBERSICHT</div><h1>{tab === "Dashboard" ? "Guten Tag!" : tab}</h1><p>{tab === "Dashboard" ? "Hier ist die aktuelle Übersicht deiner digitalen Geschäftsabläufe." : `Verwalte ${tab.toLowerCase()} zentral an einem Ort.`}</p></div>
            <div className="heading-actions"><button className="btn btn-light" onClick={() => { setDocs(demoDocs); setCustomers(demoCustomers); setLiveData(false); setNotice("Lokale Demo-Ansicht wurde zurückgesetzt. Supabase-Daten wurden nicht verändert."); }}><RefreshCw size={16}/> Demo zurücksetzen</button><button className="btn btn-gold" onClick={() => setShowDocForm("Rechnung")}><Plus size={17}/> Neue Rechnung</button></div>
          </div>

          {tab === "Dashboard" && <Dashboard invoices={invoices} offers={offers} customers={customers} totalInvoiced={totalInvoiced} outstanding={outstanding} offerVolume={offerVolume} onNewOffer={() => setShowDocForm("Angebot")} onNewInvoice={() => setShowDocForm("Rechnung")} onOpenDoc={setSelectedDoc} onDeleteDoc={deleteDocument} />}
          {tab === "Kunden" && <Customers customers={filteredCustomers} onAdd={() => setShowCustomerForm(true)} docs={docs} onOpenDoc={setSelectedDoc} onDeleteDoc={deleteDocument} />}
          {tab === "Angebote" && <Documents docs={filteredDocs.filter(d => d.kind === "Angebot")} kind="Angebot" onNew={() => setShowDocForm("Angebot")} onOpen={setSelectedDoc} onDelete={deleteDocument} />}
          {tab === "Rechnungen" && <Documents docs={filteredDocs.filter(d => d.kind === "Rechnung")} kind="Rechnung" onNew={() => setShowDocForm("Rechnung")} onOpen={setSelectedDoc} onDelete={deleteDocument} />}
          {tab === "Berechnung" && <Calculation docs={invoices} expenses={expenses} onAddExpense={() => setShowExpenseForm(true)} />}
          {tab === "Ausgaben" && <Expenses expenses={expenses} onAdd={() => setShowExpenseForm(true)} onAddPhoto={() => setShowExpenseForm(true)} /> }
          {tab === "Einstellungen" && <SettingsPage configured={isSupabaseConfigured} liveData={liveData} />}

          <footer>© 2026 T.S. Serviceleistungen · Digitale Lösungen <span>•</span> Demo-Version – Musterwerte, keine produktive Buchhaltungssoftware</footer>
        </section>
      </main>

      {selectedDoc && <Modal title={`${selectedDoc.kind} ${selectedDoc.number}`} className="modal-preview" onClose={() => setSelectedDoc(null)}>
        <DocumentPreview doc={selectedDoc} companyId={companyId} onClose={() => setSelectedDoc(null)} onDelete={() => void deleteDocument(selectedDoc)} deleting={documentDeleting} />
      </Modal>}

      {showExpenseForm && <Modal title="Ausgabe mit Beleg erfassen" onClose={() => { if (!expenseSaving && !receiptReading) { setShowExpenseForm(false); setReceiptPreview(""); setReceiptFile(null); } }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (!supabase || !companyId || !liveData) { setNotice("Ausgabe kann nur mit aktiver Supabase-Verbindung gespeichert werden."); return; }
          const amount = Number(expenseAmount); const taxAmount = Number(expenseTax) || 0;
          if (!expenseDescription.trim() || !Number.isFinite(amount) || amount < 0 || taxAmount < 0) return;
          setExpenseSaving(true); setNotice("");
          try {
            let receiptPath: string | null = null;
            if (receiptFile) {
              const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
              receiptPath = `${companyId}/${Date.now()}-${safeName}`;
              const { error: uploadError } = await supabase.storage.from("expense-receipts").upload(receiptPath, receiptFile, { upsert: false, contentType: receiptFile.type || "application/octet-stream" });
              if (uploadError) throw new Error("Belegfoto konnte nicht archiviert werden: " + uploadError.message);
            }
            const { error } = await supabase.from("expenses").insert({ company_id: companyId, expense_date: expenseDate, description: expenseDescription.trim(), category: expenseCategory, amount, tax_amount: taxAmount, notes: expenseNotes.trim() || null, receipt_path: receiptPath });
            if (error) throw error;
            setExpenseDescription(""); setExpenseAmount(""); setExpenseTax("0"); setExpenseNotes(""); setReceiptFile(null); setReceiptPreview(""); setShowExpenseForm(false);
            await loadLiveData(); setNotice("Ausgabe wurde gespeichert. Der Beleg ist im geschützten Belegarchiv abgelegt.");
          } catch (err) { setNotice("Ausgabe konnte nicht gespeichert werden: " + (err instanceof Error ? err.message : "Datenbankfehler")); }
          finally { setExpenseSaving(false); }
        }}>
          <div className="receipt-capture">
            <div><strong>Beleg fotografieren oder hochladen</strong><p>Foto direkt mit der Handykamera aufnehmen. Die KI liest anschließend Datum, Händler und Beträge aus.</p></div>
            <label className="btn btn-light receipt-pick"><FilePlus2 size={16}/> Foto / Datei auswählen
              <input className="receipt-file-input" type="file" accept="image/*,application/pdf" capture="environment" onChange={async e => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                setReceiptFile(file); setReceiptReadError(""); setReceiptPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
                if (file.type === "application/pdf") { setReceiptReadError("PDF ausgewählt. Die automatische KI-Auslesung ist aktuell für Fotos vorgesehen; bitte fotografiere oder lade den Beleg als Bild hoch."); return; }
                if (!file.type.startsWith("image/")) { setReceiptReadError("Bitte wähle ein Foto oder eine Bilddatei aus."); return; }
                setReceiptReading(true);
                try {
                  const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = () => reject(new Error("Foto konnte nicht gelesen werden."));
                    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
                    reader.readAsDataURL(file);
                  });
                  const { data, error } = await supabase!.functions.invoke("extract-expense-receipt", { body: { image_base64: base64, mime_type: file.type } });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  if (data?.expense_date) setExpenseDate(data.expense_date);
                  if (data?.description) setExpenseDescription(data.description);
                  if (data?.category) setExpenseCategory(data.category);
                  if (data?.amount !== undefined && data?.amount !== null) setExpenseAmount(String(data.amount));
                  if (data?.tax_amount !== undefined && data?.tax_amount !== null) setExpenseTax(String(data.tax_amount));
                  if (data?.notes) setExpenseNotes(data.notes);
                  setNotice("KI-Auslesung abgeschlossen. Bitte prüfe Datum und Beträge vor dem Speichern.");
                } catch (err) {
                  setReceiptReadError("KI-Auslesung nicht möglich: " + (err instanceof Error ? err.message : "Unbekannter Fehler") + ". Du kannst die Felder weiterhin manuell ausfüllen.");
                } finally { setReceiptReading(false); }
              }} />
            </label>
            {receiptPreview && <img className="receipt-preview" src={receiptPreview} alt="Vorschau des Belegfotos" />}
            {receiptFile && <span className="receipt-file-name">{receiptFile.name}</span>}
            {receiptReading && <p className="receipt-status"><Sparkles size={16}/> KI liest den Beleg aus …</p>}
            {receiptReadError && <p className="receipt-error">{receiptReadError}</p>}
          </div>
          <label>Datum<input type="date" required value={expenseDate} onChange={e=>setExpenseDate(e.target.value)} /></label>
          <label>Bezeichnung / Händler<input required value={expenseDescription} onChange={e=>setExpenseDescription(e.target.value)} placeholder="z. B. Baumarkt / Materialeinkauf" /></label>
          <label>Kategorie<select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)}><option>Betriebsausgabe</option><option>Material</option><option>Fahrzeug</option><option>Werkzeug</option><option>Software / Telefon</option><option>Versicherung</option><option>Fahrtkosten</option><option>Sonstiges</option></select></label>
          <label>Bruttobetrag (€)<input type="number" min="0" step="0.01" required value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)} placeholder="0,00" /></label>
          <label>Enthaltene MwSt. (€)<input type="number" min="0" step="0.01" value={expenseTax} onChange={e=>setExpenseTax(e.target.value)} /></label>
          <label>Notiz / Belegnummer<textarea rows={2} value={expenseNotes} onChange={e=>setExpenseNotes(e.target.value)} /></label>
          <p className="form-note">Wichtig: KI-Ergebnisse vor dem Speichern prüfen. Der Bruttobetrag ist maßgeblich. Das Originalfoto wird beim Speichern geschützt archiviert.</p>
          <div className="modal-actions"><button type="button" className="btn btn-light" onClick={()=>{setShowExpenseForm(false);setReceiptPreview("");setReceiptFile(null);}} disabled={expenseSaving || receiptReading}>Abbrechen</button><button className="btn btn-gold" type="submit" disabled={expenseSaving || receiptReading}>{expenseSaving?"Speichert …":"Ausgabe speichern"}</button></div>
        </form>
      </Modal>}
      {showCustomerForm && <Modal title="Neuen Kunden anlegen" onClose={() => { if (!customerSaving) setShowCustomerForm(false); }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (customerSaving) return;
          if (!supabase || !companyId || !liveData) {
            setNotice("Kunde wurde nicht gespeichert: Es besteht keine aktive Supabase-Verbindung zum Unternehmen. Bitte neu anmelden und erneut versuchen.");
            return;
          }
          setCustomerSaving(true);
          setNotice("");
          try {
            const { data: existingRows, error: numberError } = await supabase
              .from("customers")
              .select("customer_number")
              .eq("company_id", companyId);
            if (numberError) throw numberError;
            const maxNumber = (existingRows ?? []).reduce((max, row) => {
              const match = /^KD-(\d+)$/.exec(String(row.customer_number ?? ""));
              return match ? Math.max(max, Number(match[1])) : max;
            }, 1000);
            const customerNumber = `KD-${String(maxNumber + 1).padStart(4, "0")}`;
            const { data: savedCustomer, error: insertError } = await supabase
              .from("customers")
              .insert({
                company_id: companyId,
                customer_number: customerNumber,
                customer_type: "business",
                name: newCustomerName.trim(),
                email: newCustomerEmail.trim() || null,
                city: null,
                country: "Deutschland"
              })
              .select("id,customer_number,name,email,city")
              .single();
            if (insertError) throw insertError;
            const customer: Customer = {
              id: savedCustomer.id,
              customer_number: savedCustomer.customer_number,
              name: savedCustomer.name,
              email: savedCustomer.email ?? "",
              city: savedCustomer.city ?? ""
            };
            setCustomers(old => [...old, customer].sort((a, b) => a.customer_number.localeCompare(b.customer_number, "de")));
            setNewCustomerName("");
            setNewCustomerEmail("");
            setShowCustomerForm(false);
            setNotice(`Kunde ${customer.customer_number} wurde in Supabase gespeichert.`);
          } catch (error) {
            console.error("Customer save failed:", error);
            const message = error instanceof Error ? error.message : "Unbekannter Datenbankfehler";
            setNotice(`Kunde konnte nicht gespeichert werden: ${message}`);
          } finally {
            setCustomerSaving(false);
          }
        }}>
          <label>Firmen- oder Kundenname<input required value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Musterfirma GmbH" disabled={customerSaving}/></label>
          <label>E-Mail-Adresse<input type="email" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} placeholder="kontakt@example.de" disabled={customerSaving}/></label>
          <div className="modal-actions"><button type="button" className="btn btn-light" onClick={() => setShowCustomerForm(false)} disabled={customerSaving}>Abbrechen</button><button className="btn btn-gold" type="submit" disabled={customerSaving}>{customerSaving ? "Wird gespeichert …" : "Kunde anlegen"}</button></div>
        </form>
      </Modal>}

      {showDocForm && <Modal title={`Neues ${showDocForm}`} className="modal-document" onClose={() => { if (!documentSaving) setShowDocForm(null); }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (documentSaving) return;
          const customer = customers.find(c => c.id === docCustomer);
          if (!supabase || !companyId || !liveData || !customer) {
            setNotice(`Speichern nicht möglich: Bitte melde dich erneut an und prüfe die Supabase-Verbindung sowie den ausgewählten Kunden.`);
            return;
          }
          const kind = showDocForm;
          const validItems = docItems.map(item => ({ description: item.description.trim(), quantity: Number(item.quantity), unit: item.unit.trim() || "Stück", unit_price: Number(item.unit_price) }))
            .filter(item => item.description && item.quantity > 0 && item.unit_price >= 0);
          if (!validItems.length) { setNotice("Bitte mindestens eine vollständige Leistungsposition mit Menge und Preis eintragen."); return; }
          const amount = validItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
          const vatRate = 19;
          const taxAmount = Math.round(amount * vatRate) / 100;
          const grossAmount = Math.round((amount + taxAmount) * 100) / 100;
          const issueDate = new Date().toISOString().slice(0, 10);
          setDocumentSaving(true);
          setNotice("");
          try {
            let documentNumber = "";
            if (kind === "Rechnung") {
              const { data: existingRows, error: listError } = await supabase
                .from("invoices").select("invoice_number").eq("company_id", companyId);
              if (listError) throw listError;
              const currentYear = new Date().getFullYear();
              const maxNumber = (existingRows ?? []).reduce((max, row) => {
                const value = String(row.invoice_number ?? "");
                const match = new RegExp(`^RE-(?:${currentYear}-|DEMO-)?(\\d+)import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, ChevronDown, CircleHelp, Download, FileCheck2,
  FilePlus2, FileText, Filter, LayoutDashboard, LogOut, Menu, MoreHorizontal,
  Plus, ReceiptText, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Users, Trash2, Eye,
  Wallet, X
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Tab = "Dashboard" | "Kunden" | "Angebote" | "Rechnungen" | "Berechnung" | "Ausgaben" | "Einstellungen";
type Customer = { id: string; name: string; email?: string; city?: string; customer_number: string };
type Doc = { id: string; number: string; customer: string; customerId?: string; date: string; amount: number; status: string; kind: "Angebot" | "Rechnung" };
type DraftItem = { description: string; quantity: string; unit: string; unit_price: string };
type Expense = { id: string; expense_date: string; description: string; category: string; amount: number; tax_amount: number; notes?: string; receipt_path?: string };

const money = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const dateFmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("de-DE");
const statusLabel = (status: string) => {
  const labels: Record<string, string> = { draft: "Entwurf", open: "Offen", accepted: "Angenommen", rejected: "Abgelehnt", expired: "Abgelaufen", converted: "Umgewandelt", cancelled: "Storniert", partially_paid: "Teilweise bezahlt", paid: "Bezahlt", overdue: "Überfällig" };
  return labels[status] ?? (status || "Entwurf");
};
const demoCustomers: Customer[] = [
  { id: "c1", customer_number: "KD-1001", name: "Müller GmbH", email: "mueller@example.com", city: "Cham" },
  { id: "c2", customer_number: "KD-1002", name: "Schmidt Bau", email: "schmidt@example.com", city: "Furth im Wald" },
  { id: "c3", customer_number: "KD-1003", name: "AutoClean Service", email: "autoclean@example.com", city: "Bad Kötzting" }
];
const demoDocs: Doc[] = [
  { id: "d1", number: "RE-2026-001", customer: "Müller GmbH", date: "2026-10-02", amount: 1250, status: "Bezahlt", kind: "Rechnung" },
  { id: "d2", number: "RE-2026-002", customer: "Schmidt Bau", date: "2026-10-06", amount: 750, status: "Offen", kind: "Rechnung" },
  { id: "d3", number: "RE-2026-003", customer: "AutoClean Service", date: "2026-10-09", amount: 480, status: "Offen", kind: "Rechnung" },
  { id: "d4", number: "AN-2026-001", customer: "Müller GmbH", date: "2026-10-01", amount: 1250, status: "Angenommen", kind: "Angebot" },
  { id: "d5", number: "AN-2026-002", customer: "Schmidt Bau", date: "2026-10-05", amount: 2480, status: "Offen", kind: "Angebot" },
  { id: "d6", number: "AN-2026-003", customer: "AutoClean Service", date: "2026-10-08", amount: 890, status: "Offen", kind: "Angebot" }
];

export default function App() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>(demoCustomers);
  const [docs, setDocs] = useState<Doc[]>(demoDocs);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0,10));
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Betriebsausgabe");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseTax, setExpenseTax] = useState("0");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [receiptReading, setReceiptReading] = useState(false);
  const [receiptReadError, setReceiptReadError] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [showDocForm, setShowDocForm] = useState<"Angebot" | "Rechnung" | null>(null);
  const [docCustomer, setDocCustomer] = useState(demoCustomers[0].id);
  const [docDescription, setDocDescription] = useState("Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot.");
  const [docItems, setDocItems] = useState<DraftItem[]>([{ description: "Arbeitsleistung", quantity: "1", unit: "Stunde", unit_price: "250" }]);
  const [notice, setNotice] = useState("");
  const [liveData, setLiveData] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [documentDeleting, setDocumentDeleting] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLoggedIn(true);
        setUserEmail(data.session.user.email ?? "");
        void loadLiveData();
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
      setUserEmail(session?.user.email ?? "");
      if (session) void loadLiveData();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadLiveData() {
    if (!supabase) return;
    const { data: companyRows, error: companyError } = await supabase
      .from("companies").select("id,name").eq("name", "T.S. Serviceleistungen: Digitale Lösungen").limit(1);
    if (companyError || !companyRows?.length) {
      setNotice("Login aktiv, aber Demo-Unternehmen nicht gefunden oder nicht berechtigt.");
      return;
    }
    const currentCompanyId = companyRows[0].id;
    setCompanyId(currentCompanyId);
    const [customerResult, invoiceResult, offerResult, expenseResult] = await Promise.all([
      supabase.from("customers").select("id,customer_number,name,email,city").eq("company_id", currentCompanyId).order("customer_number"),
      supabase.from("invoices").select("id,company_id,customer_id,invoice_number,customer_name,issue_date,total_amount,status").eq("company_id", currentCompanyId).order("issue_date", { ascending: false }),
      supabase.from("offers").select("id,company_id,customer_id,offer_number,customer_name,issue_date,total_amount,status").eq("company_id", currentCompanyId).order("issue_date", { ascending: false }),
      supabase.from("expenses").select("id,expense_date,description,category,amount,tax_amount,notes,receipt_path").eq("company_id", currentCompanyId).order("expense_date", { ascending: false })
    ]);
    if (customerResult.error || invoiceResult.error || offerResult.error || expenseResult.error) {
      setNotice("Daten konnten nicht vollständig geladen werden. Bitte RLS und Unternehmensmitgliedschaft prüfen.");
      return;
    }
    setCustomers((customerResult.data ?? []).map((c) => ({ id: c.id, customer_number: c.customer_number, name: c.name, email: c.email ?? "", city: c.city ?? "" })));
    if (customerResult.data?.length && !customerResult.data.some((c) => c.id === docCustomer)) setDocCustomer(customerResult.data[0].id);
    const invoiceDocs: Doc[] = (invoiceResult.data ?? []).map((d) => ({ id: d.id, number: d.invoice_number, customer: d.customer_name, customerId: d.customer_id, date: d.issue_date, amount: Number(d.total_amount), status: statusLabel(d.status), kind: "Rechnung" }));
    const offerDocs: Doc[] = (offerResult.data ?? []).map((d) => ({ id: d.id, number: d.offer_number, customer: d.customer_name, customerId: d.customer_id, date: d.issue_date, amount: Number(d.total_amount), status: statusLabel(d.status), kind: "Angebot" }));
    setDocs([...invoiceDocs, ...offerDocs]);
    setExpenses((expenseResult.data ?? []).map((e) => ({ id:e.id, expense_date:e.expense_date, description:e.description, category:e.category ?? "Betriebsausgabe", amount:Number(e.amount), tax_amount:Number(e.tax_amount ?? 0), notes:e.notes ?? "", receipt_path:e.receipt_path ?? "" })));
    setLiveData(true);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    if (!supabase) {
      setLoginError("Supabase ist noch nicht konfiguriert. Für die lokale Vorschau kannst du den Demo-Zugang verwenden.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError("Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
  }

  async function deleteDocument(doc: Doc) {
    if (!supabase || !companyId || !liveData) {
      setNotice("Löschen nicht möglich: Keine aktive Supabase-Verbindung.");
      return;
    }
    const confirmed = window.confirm(`Soll ${doc.kind.toLowerCase()} ${doc.number} wirklich dauerhaft gelöscht werden?`);
    if (!confirmed) return;
    setDocumentDeleting(true);
    setNotice("");
    try {
      const table = doc.kind === "Rechnung" ? "invoices" : "offers";
      const { error } = await supabase.from(table).delete().eq("id", doc.id).eq("company_id", companyId);
      if (error) throw error;
      setSelectedDoc(current => current?.id === doc.id ? null : current);
      await loadLiveData();
      setNotice(`${doc.kind} ${doc.number} wurde gelöscht.`);
    } catch (error) {
      console.error("Document delete failed:", error);
      const message = error instanceof Error ? error.message : "Unbekannter Datenbankfehler";
      setNotice(`${doc.kind} konnte nicht gelöscht werden: ${message}`);
    } finally {
      setDocumentDeleting(false);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setLoggedIn(false);
    setLiveData(false);
  }

  const filteredCustomers = useMemo(() => customers.filter(c => `${c.name} ${c.email} ${c.customer_number} ${c.city}`.toLowerCase().includes(search.toLowerCase())), [customers, search]);
  const filteredDocs = useMemo(() => docs.filter(d => `${d.number} ${d.customer} ${d.status} ${d.kind}`.toLowerCase().includes(search.toLowerCase())), [docs, search]);
  const invoices = docs.filter(d => d.kind === "Rechnung");
  const offers = docs.filter(d => d.kind === "Angebot");
  const totalInvoiced = invoices.reduce((sum, d) => sum + d.amount, 0);
  const outstanding = invoices.filter(d => d.status !== "Bezahlt").reduce((sum, d) => sum + d.amount, 0);
  const offerVolume = offers.filter(d => d.status === "Offen").reduce((sum, d) => sum + d.amount, 0);

  if (!loggedIn) return <Login email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSubmit={signIn} error={loginError} configured={isSupabaseConfigured} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">TS<span>•</span></div>
          <div><strong>T.S. Serviceleistungen</strong><small>Digitale Lösungen</small></div>
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(false)} aria-label="Menü schließen"><X size={18}/></button>
        </div>
        <div className="workspace-label">ARBEITSBEREICH</div>
        <nav>
          {([
            ["Dashboard", LayoutDashboard], ["Kunden", Users], ["Angebote", FileText],
            ["Rechnungen", ReceiptText], ["Berechnung", Activity], ["Ausgaben", Wallet], ["Einstellungen", Settings]
          ] as const).map(([name, Icon]) => (
            <button key={name} className={`nav-item ${tab === name ? "active" : ""}`} onClick={() => { setTab(name); setMenuOpen(false); }}>
              <Icon size={18}/><span>{name}</span>
              {name === "Rechnungen" && <span className="nav-count">{invoices.filter(d => d.status !== "Bezahlt").length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card"><Sparkles size={17}/><div><strong>Demo-Modus</strong><small>{liveData ? "Supabase verbunden" : "Beispieldaten"}</small></div></div>
          <button className="nav-item" onClick={() => setNotice("Die Hilfe für die Demo wird im nächsten Ausbauschritt ergänzt.")}><CircleHelp size={18}/><span>Hilfe & Support</span></button>
          <button className="nav-item" onClick={signOut}><LogOut size={18}/><span>Abmelden</span></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(true)} aria-label="Menü öffnen"><Menu size={20}/></button>
          <div className="breadcrumbs">T.S. Serviceleistungen <span>/</span> <strong>{tab}</strong></div>
          <div className="top-actions">
            <label className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen …"/></label>
            <button className="icon-btn" onClick={() => setNotice("Du bist auf dem aktuellen Demo-Stand.")} aria-label="Benachrichtigungen"><Bell size={18}/></button>
            <div className="user-chip"><div className="avatar">TS</div><div><strong>{userEmail || "Administrator"}</strong><small>Administrator</small></div><ChevronDown size={15}/></div>
          </div>
        </header>

        {notice && <div className="notice"><span>{notice}</span><button className="icon-btn" onClick={() => setNotice("")} aria-label="Meldung schließen"><X size={16}/></button></div>}

        <section className="page">
          <div className="page-heading">
            <div><div className="eyebrow"><span className="gold-dot"/> UNTERNEHMENSÜBERSICHT</div><h1>{tab === "Dashboard" ? "Guten Tag!" : tab}</h1><p>{tab === "Dashboard" ? "Hier ist die aktuelle Übersicht deiner digitalen Geschäftsabläufe." : `Verwalte ${tab.toLowerCase()} zentral an einem Ort.`}</p></div>
            <div className="heading-actions"><button className="btn btn-light" onClick={() => { setDocs(demoDocs); setCustomers(demoCustomers); setLiveData(false); setNotice("Lokale Demo-Ansicht wurde zurückgesetzt. Supabase-Daten wurden nicht verändert."); }}><RefreshCw size={16}/> Demo zurücksetzen</button><button className="btn btn-gold" onClick={() => setShowDocForm("Rechnung")}><Plus size={17}/> Neue Rechnung</button></div>
          </div>

          {tab === "Dashboard" && <Dashboard invoices={invoices} offers={offers} customers={customers} totalInvoiced={totalInvoiced} outstanding={outstanding} offerVolume={offerVolume} onNewOffer={() => setShowDocForm("Angebot")} onNewInvoice={() => setShowDocForm("Rechnung")} onOpenDoc={setSelectedDoc} onDeleteDoc={deleteDocument} />}
          {tab === "Kunden" && <Customers customers={filteredCustomers} onAdd={() => setShowCustomerForm(true)} docs={docs} onOpenDoc={setSelectedDoc} onDeleteDoc={deleteDocument} />}
          {tab === "Angebote" && <Documents docs={filteredDocs.filter(d => d.kind === "Angebot")} kind="Angebot" onNew={() => setShowDocForm("Angebot")} onOpen={setSelectedDoc} onDelete={deleteDocument} />}
          {tab === "Rechnungen" && <Documents docs={filteredDocs.filter(d => d.kind === "Rechnung")} kind="Rechnung" onNew={() => setShowDocForm("Rechnung")} onOpen={setSelectedDoc} onDelete={deleteDocument} />}
          {tab === "Berechnung" && <Calculation docs={invoices} expenses={expenses} onAddExpense={() => setShowExpenseForm(true)} />}
          {tab === "Ausgaben" && <Expenses expenses={expenses} onAdd={() => setShowExpenseForm(true)} onAddPhoto={() => setShowExpenseForm(true)} /> }
          {tab === "Einstellungen" && <SettingsPage configured={isSupabaseConfigured} liveData={liveData} />}

          <footer>© 2026 T.S. Serviceleistungen · Digitale Lösungen <span>•</span> Demo-Version – Musterwerte, keine produktive Buchhaltungssoftware</footer>
        </section>
      </main>

      {selectedDoc && <Modal title={`${selectedDoc.kind} ${selectedDoc.number}`} className="modal-preview" onClose={() => setSelectedDoc(null)}>
        <DocumentPreview doc={selectedDoc} companyId={companyId} onClose={() => setSelectedDoc(null)} onDelete={() => void deleteDocument(selectedDoc)} deleting={documentDeleting} />
      </Modal>}

      {showExpenseForm && <Modal title="Ausgabe mit Beleg erfassen" onClose={() => { if (!expenseSaving && !receiptReading) { setShowExpenseForm(false); setReceiptPreview(""); setReceiptFile(null); } }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (!supabase || !companyId || !liveData) { setNotice("Ausgabe kann nur mit aktiver Supabase-Verbindung gespeichert werden."); return; }
          const amount = Number(expenseAmount); const taxAmount = Number(expenseTax) || 0;
          if (!expenseDescription.trim() || !Number.isFinite(amount) || amount < 0 || taxAmount < 0) return;
          setExpenseSaving(true); setNotice("");
          try {
            let receiptPath: string | null = null;
            if (receiptFile) {
              const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
              receiptPath = `${companyId}/${Date.now()}-${safeName}`;
              const { error: uploadError } = await supabase.storage.from("expense-receipts").upload(receiptPath, receiptFile, { upsert: false, contentType: receiptFile.type || "application/octet-stream" });
              if (uploadError) throw new Error("Belegfoto konnte nicht archiviert werden: " + uploadError.message);
            }
            const { error } = await supabase.from("expenses").insert({ company_id: companyId, expense_date: expenseDate, description: expenseDescription.trim(), category: expenseCategory, amount, tax_amount: taxAmount, notes: expenseNotes.trim() || null, receipt_path: receiptPath });
            if (error) throw error;
            setExpenseDescription(""); setExpenseAmount(""); setExpenseTax("0"); setExpenseNotes(""); setReceiptFile(null); setReceiptPreview(""); setShowExpenseForm(false);
            await loadLiveData(); setNotice("Ausgabe wurde gespeichert. Der Beleg ist im geschützten Belegarchiv abgelegt.");
          } catch (err) { setNotice("Ausgabe konnte nicht gespeichert werden: " + (err instanceof Error ? err.message : "Datenbankfehler")); }
          finally { setExpenseSaving(false); }
        }}>
          <div className="receipt-capture">
            <div><strong>Beleg fotografieren oder hochladen</strong><p>Foto direkt mit der Handykamera aufnehmen. Die KI liest anschließend Datum, Händler und Beträge aus.</p></div>
            <label className="btn btn-light receipt-pick"><FilePlus2 size={16}/> Foto / Datei auswählen
              <input className="receipt-file-input" type="file" accept="image/*,application/pdf" capture="environment" onChange={async e => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                setReceiptFile(file); setReceiptReadError(""); setReceiptPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
                if (file.type === "application/pdf") { setReceiptReadError("PDF ausgewählt. Die automatische KI-Auslesung ist aktuell für Fotos vorgesehen; bitte fotografiere oder lade den Beleg als Bild hoch."); return; }
                if (!file.type.startsWith("image/")) { setReceiptReadError("Bitte wähle ein Foto oder eine Bilddatei aus."); return; }
                setReceiptReading(true);
                try {
                  const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = () => reject(new Error("Foto konnte nicht gelesen werden."));
                    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
                    reader.readAsDataURL(file);
                  });
                  const { data, error } = await supabase!.functions.invoke("extract-expense-receipt", { body: { image_base64: base64, mime_type: file.type } });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  if (data?.expense_date) setExpenseDate(data.expense_date);
                  if (data?.description) setExpenseDescription(data.description);
                  if (data?.category) setExpenseCategory(data.category);
                  if (data?.amount !== undefined && data?.amount !== null) setExpenseAmount(String(data.amount));
                  if (data?.tax_amount !== undefined && data?.tax_amount !== null) setExpenseTax(String(data.tax_amount));
                  if (data?.notes) setExpenseNotes(data.notes);
                  setNotice("KI-Auslesung abgeschlossen. Bitte prüfe Datum und Beträge vor dem Speichern.");
                } catch (err) {
                  setReceiptReadError("KI-Auslesung nicht möglich: " + (err instanceof Error ? err.message : "Unbekannter Fehler") + ". Du kannst die Felder weiterhin manuell ausfüllen.");
                } finally { setReceiptReading(false); }
              }} />
            </label>
            {receiptPreview && <img className="receipt-preview" src={receiptPreview} alt="Vorschau des Belegfotos" />}
            {receiptFile && <span className="receipt-file-name">{receiptFile.name}</span>}
            {receiptReading && <p className="receipt-status"><Sparkles size={16}/> KI liest den Beleg aus …</p>}
            {receiptReadError && <p className="receipt-error">{receiptReadError}</p>}
          </div>
          <label>Datum<input type="date" required value={expenseDate} onChange={e=>setExpenseDate(e.target.value)} /></label>
          <label>Bezeichnung / Händler<input required value={expenseDescription} onChange={e=>setExpenseDescription(e.target.value)} placeholder="z. B. Baumarkt / Materialeinkauf" /></label>
          <label>Kategorie<select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)}><option>Betriebsausgabe</option><option>Material</option><option>Fahrzeug</option><option>Werkzeug</option><option>Software / Telefon</option><option>Versicherung</option><option>Fahrtkosten</option><option>Sonstiges</option></select></label>
          <label>Bruttobetrag (€)<input type="number" min="0" step="0.01" required value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)} placeholder="0,00" /></label>
          <label>Enthaltene MwSt. (€)<input type="number" min="0" step="0.01" value={expenseTax} onChange={e=>setExpenseTax(e.target.value)} /></label>
          <label>Notiz / Belegnummer<textarea rows={2} value={expenseNotes} onChange={e=>setExpenseNotes(e.target.value)} /></label>
          <p className="form-note">Wichtig: KI-Ergebnisse vor dem Speichern prüfen. Der Bruttobetrag ist maßgeblich. Das Originalfoto wird beim Speichern geschützt archiviert.</p>
          <div className="modal-actions"><button type="button" className="btn btn-light" onClick={()=>{setShowExpenseForm(false);setReceiptPreview("");setReceiptFile(null);}} disabled={expenseSaving || receiptReading}>Abbrechen</button><button className="btn btn-gold" type="submit" disabled={expenseSaving || receiptReading}>{expenseSaving?"Speichert …":"Ausgabe speichern"}</button></div>
        </form>
      </Modal>}
      {showCustomerForm && <Modal title="Neuen Kunden anlegen" onClose={() => { if (!customerSaving) setShowCustomerForm(false); }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (customerSaving) return;
          if (!supabase || !companyId || !liveData) {
            setNotice("Kunde wurde nicht gespeichert: Es besteht keine aktive Supabase-Verbindung zum Unternehmen. Bitte neu anmelden und erneut versuchen.");
            return;
          }
          setCustomerSaving(true);
          setNotice("");
          try {
            const { data: existingRows, error: numberError } = await supabase
              .from("customers")
              .select("customer_number")
              .eq("company_id", companyId);
            if (numberError) throw numberError;
            const maxNumber = (existingRows ?? []).reduce((max, row) => {
              const match = /^KD-(\d+)$/.exec(String(row.customer_number ?? ""));
              return match ? Math.max(max, Number(match[1])) : max;
            }, 1000);
            const customerNumber = `KD-${String(maxNumber + 1).padStart(4, "0")}`;
            const { data: savedCustomer, error: insertError } = await supabase
              .from("customers")
              .insert({
                company_id: companyId,
                customer_number: customerNumber,
                customer_type: "business",
                name: newCustomerName.trim(),
                email: newCustomerEmail.trim() || null,
                city: null,
                country: "Deutschland"
              })
              .select("id,customer_number,name,email,city")
              .single();
            if (insertError) throw insertError;
            const customer: Customer = {
              id: savedCustomer.id,
              customer_number: savedCustomer.customer_number,
              name: savedCustomer.name,
              email: savedCustomer.email ?? "",
              city: savedCustomer.city ?? ""
            };
            setCustomers(old => [...old, customer].sort((a, b) => a.customer_number.localeCompare(b.customer_number, "de")));
            setNewCustomerName("");
            setNewCustomerEmail("");
            setShowCustomerForm(false);
            setNotice(`Kunde ${customer.customer_number} wurde in Supabase gespeichert.`);
          } catch (error) {
            console.error("Customer save failed:", error);
            const message = error instanceof Error ? error.message : "Unbekannter Datenbankfehler";
            setNotice(`Kunde konnte nicht gespeichert werden: ${message}`);
          } finally {
            setCustomerSaving(false);
          }
        }}>
          <label>Firmen- oder Kundenname<input required value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Musterfirma GmbH" disabled={customerSaving}/></label>
          <label>E-Mail-Adresse<input type="email" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} placeholder="kontakt@example.de" disabled={customerSaving}/></label>
          <div className="modal-actions"><button type="button" className="btn btn-light" onClick={() => setShowCustomerForm(false)} disabled={customerSaving}>Abbrechen</button><button className="btn btn-gold" type="submit" disabled={customerSaving}>{customerSaving ? "Wird gespeichert …" : "Kunde anlegen"}</button></div>
        </form>
      </Modal>}

      {showDocForm && <Modal title={`Neues ${showDocForm}`} className="modal-document" onClose={() => { if (!documentSaving) setShowDocForm(null); }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (documentSaving) return;
          const customer = customers.find(c => c.id === docCustomer);
          if (!supabase || !companyId || !liveData || !customer) {
            setNotice(`Speichern nicht möglich: Bitte melde dich erneut an und prüfe die Supabase-Verbindung sowie den ausgewählten Kunden.`);
            return;
          }
          const kind = showDocForm;
          const validItems = docItems.map(item => ({ description: item.description.trim(), quantity: Number(item.quantity), unit: item.unit.trim() || "Stück", unit_price: Number(item.unit_price) }))
            .filter(item => item.description && item.quantity > 0 && item.unit_price >= 0);
          if (!validItems.length) { setNotice("Bitte mindestens eine vollständige Leistungsposition mit Menge und Preis eintragen."); return; }
          const amount = validItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
          const vatRate = 19;
          const taxAmount = Math.round(amount * vatRate) / 100;
          const grossAmount = Math.round((amount + taxAmount) * 100) / 100;
          const issueDate = new Date().toISOString().slice(0, 10);
          setDocumentSaving(true);
          setNotice("");
          try {
            let documentNumber = "";
            if (kind === "Rechnung") {
              const { data: existingRows, error: listError } = await supabase
                .from("invoices").select("invoice_number").eq("company_id", companyId);
              if (listError) throw listError;
              ).exec(value);
                return match ? Math.max(max, Number(match[1])) : max;
              }, 0);
              documentNumber = `RE-${currentYear}-${String(maxNumber + 1).padStart(3, "0")}`;
              const { data: savedInvoice, error } = await supabase.from("invoices").insert({
                company_id: companyId,
                customer_id: customer.id,
                invoice_number: documentNumber,
                customer_name: customer.name,
                issue_date: issueDate,
                status: "draft",
                currency: "EUR",
                notes: docDescription.trim(),
                subtotal: amount,
                tax_amount: taxAmount,
                total_amount: grossAmount,
                created_by: (await supabase.auth.getUser()).data.user?.id ?? null
              }).select("id").single();
              if (error) throw error;
              const { error: itemError } = await supabase.from("invoice_items").insert(validItems.map((item, index) => ({
                company_id: companyId, invoice_id: savedInvoice.id, position: index + 1,
                description: item.description, quantity: item.quantity, unit: item.unit,
                unit_price: item.unit_price, discount_percent: 0, tax_rate: vatRate,
                line_total: Math.round(item.quantity * item.unit_price * 100) / 100
              })));
              if (itemError) throw itemError;
            } else {
              const { data: existingRows, error: listError } = await supabase
                .from("offers").select("offer_number").eq("company_id", companyId);
              if (listError) throw listError;
              const currentYear = new Date().getFullYear();
              const maxNumber = (existingRows ?? []).reduce((max, row) => {
                const value = String(row.offer_number ?? "");
                const match = new RegExp(`^AN-(?:${currentYear}-|DEMO-)?(\\d+)import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, ChevronDown, CircleHelp, Download, FileCheck2,
  FilePlus2, FileText, Filter, LayoutDashboard, LogOut, Menu, MoreHorizontal,
  Plus, ReceiptText, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Users, Trash2, Eye,
  Wallet, X
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Tab = "Dashboard" | "Kunden" | "Angebote" | "Rechnungen" | "Berechnung" | "Ausgaben" | "Einstellungen";
type Customer = { id: string; name: string; email?: string; city?: string; customer_number: string };
type Doc = { id: string; number: string; customer: string; customerId?: string; date: string; amount: number; status: string; kind: "Angebot" | "Rechnung" };
type DraftItem = { description: string; quantity: string; unit: string; unit_price: string };
type Expense = { id: string; expense_date: string; description: string; category: string; amount: number; tax_amount: number; notes?: string; receipt_path?: string };

const money = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const dateFmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("de-DE");
const statusLabel = (status: string) => {
  const labels: Record<string, string> = { draft: "Entwurf", open: "Offen", accepted: "Angenommen", rejected: "Abgelehnt", expired: "Abgelaufen", converted: "Umgewandelt", cancelled: "Storniert", partially_paid: "Teilweise bezahlt", paid: "Bezahlt", overdue: "Überfällig" };
  return labels[status] ?? (status || "Entwurf");
};
const demoCustomers: Customer[] = [
  { id: "c1", customer_number: "KD-1001", name: "Müller GmbH", email: "mueller@example.com", city: "Cham" },
  { id: "c2", customer_number: "KD-1002", name: "Schmidt Bau", email: "schmidt@example.com", city: "Furth im Wald" },
  { id: "c3", customer_number: "KD-1003", name: "AutoClean Service", email: "autoclean@example.com", city: "Bad Kötzting" }
];
const demoDocs: Doc[] = [
  { id: "d1", number: "RE-2026-001", customer: "Müller GmbH", date: "2026-10-02", amount: 1250, status: "Bezahlt", kind: "Rechnung" },
  { id: "d2", number: "RE-2026-002", customer: "Schmidt Bau", date: "2026-10-06", amount: 750, status: "Offen", kind: "Rechnung" },
  { id: "d3", number: "RE-2026-003", customer: "AutoClean Service", date: "2026-10-09", amount: 480, status: "Offen", kind: "Rechnung" },
  { id: "d4", number: "AN-2026-001", customer: "Müller GmbH", date: "2026-10-01", amount: 1250, status: "Angenommen", kind: "Angebot" },
  { id: "d5", number: "AN-2026-002", customer: "Schmidt Bau", date: "2026-10-05", amount: 2480, status: "Offen", kind: "Angebot" },
  { id: "d6", number: "AN-2026-003", customer: "AutoClean Service", date: "2026-10-08", amount: 890, status: "Offen", kind: "Angebot" }
];

export default function App() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>(demoCustomers);
  const [docs, setDocs] = useState<Doc[]>(demoDocs);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0,10));
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Betriebsausgabe");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseTax, setExpenseTax] = useState("0");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [receiptReading, setReceiptReading] = useState(false);
  const [receiptReadError, setReceiptReadError] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [showDocForm, setShowDocForm] = useState<"Angebot" | "Rechnung" | null>(null);
  const [docCustomer, setDocCustomer] = useState(demoCustomers[0].id);
  const [docDescription, setDocDescription] = useState("Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot.");
  const [docItems, setDocItems] = useState<DraftItem[]>([{ description: "Arbeitsleistung", quantity: "1", unit: "Stunde", unit_price: "250" }]);
  const [notice, setNotice] = useState("");
  const [liveData, setLiveData] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [documentDeleting, setDocumentDeleting] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLoggedIn(true);
        setUserEmail(data.session.user.email ?? "");
        void loadLiveData();
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
      setUserEmail(session?.user.email ?? "");
      if (session) void loadLiveData();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadLiveData() {
    if (!supabase) return;
    const { data: companyRows, error: companyError } = await supabase
      .from("companies").select("id,name").eq("name", "T.S. Serviceleistungen: Digitale Lösungen").limit(1);
    if (companyError || !companyRows?.length) {
      setNotice("Login aktiv, aber Demo-Unternehmen nicht gefunden oder nicht berechtigt.");
      return;
    }
    const currentCompanyId = companyRows[0].id;
    setCompanyId(currentCompanyId);
    const [customerResult, invoiceResult, offerResult, expenseResult] = await Promise.all([
      supabase.from("customers").select("id,customer_number,name,email,city").eq("company_id", currentCompanyId).order("customer_number"),
      supabase.from("invoices").select("id,company_id,customer_id,invoice_number,customer_name,issue_date,total_amount,status").eq("company_id", currentCompanyId).order("issue_date", { ascending: false }),
      supabase.from("offers").select("id,company_id,customer_id,offer_number,customer_name,issue_date,total_amount,status").eq("company_id", currentCompanyId).order("issue_date", { ascending: false }),
      supabase.from("expenses").select("id,expense_date,description,category,amount,tax_amount,notes,receipt_path").eq("company_id", currentCompanyId).order("expense_date", { ascending: false })
    ]);
    if (customerResult.error || invoiceResult.error || offerResult.error || expenseResult.error) {
      setNotice("Daten konnten nicht vollständig geladen werden. Bitte RLS und Unternehmensmitgliedschaft prüfen.");
      return;
    }
    setCustomers((customerResult.data ?? []).map((c) => ({ id: c.id, customer_number: c.customer_number, name: c.name, email: c.email ?? "", city: c.city ?? "" })));
    if (customerResult.data?.length && !customerResult.data.some((c) => c.id === docCustomer)) setDocCustomer(customerResult.data[0].id);
    const invoiceDocs: Doc[] = (invoiceResult.data ?? []).map((d) => ({ id: d.id, number: d.invoice_number, customer: d.customer_name, customerId: d.customer_id, date: d.issue_date, amount: Number(d.total_amount), status: statusLabel(d.status), kind: "Rechnung" }));
    const offerDocs: Doc[] = (offerResult.data ?? []).map((d) => ({ id: d.id, number: d.offer_number, customer: d.customer_name, customerId: d.customer_id, date: d.issue_date, amount: Number(d.total_amount), status: statusLabel(d.status), kind: "Angebot" }));
    setDocs([...invoiceDocs, ...offerDocs]);
    setExpenses((expenseResult.data ?? []).map((e) => ({ id:e.id, expense_date:e.expense_date, description:e.description, category:e.category ?? "Betriebsausgabe", amount:Number(e.amount), tax_amount:Number(e.tax_amount ?? 0), notes:e.notes ?? "", receipt_path:e.receipt_path ?? "" })));
    setLiveData(true);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    if (!supabase) {
      setLoginError("Supabase ist noch nicht konfiguriert. Für die lokale Vorschau kannst du den Demo-Zugang verwenden.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError("Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
  }

  async function deleteDocument(doc: Doc) {
    if (!supabase || !companyId || !liveData) {
      setNotice("Löschen nicht möglich: Keine aktive Supabase-Verbindung.");
      return;
    }
    const confirmed = window.confirm(`Soll ${doc.kind.toLowerCase()} ${doc.number} wirklich dauerhaft gelöscht werden?`);
    if (!confirmed) return;
    setDocumentDeleting(true);
    setNotice("");
    try {
      const table = doc.kind === "Rechnung" ? "invoices" : "offers";
      const { error } = await supabase.from(table).delete().eq("id", doc.id).eq("company_id", companyId);
      if (error) throw error;
      setSelectedDoc(current => current?.id === doc.id ? null : current);
      await loadLiveData();
      setNotice(`${doc.kind} ${doc.number} wurde gelöscht.`);
    } catch (error) {
      console.error("Document delete failed:", error);
      const message = error instanceof Error ? error.message : "Unbekannter Datenbankfehler";
      setNotice(`${doc.kind} konnte nicht gelöscht werden: ${message}`);
    } finally {
      setDocumentDeleting(false);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setLoggedIn(false);
    setLiveData(false);
  }

  const filteredCustomers = useMemo(() => customers.filter(c => `${c.name} ${c.email} ${c.customer_number} ${c.city}`.toLowerCase().includes(search.toLowerCase())), [customers, search]);
  const filteredDocs = useMemo(() => docs.filter(d => `${d.number} ${d.customer} ${d.status} ${d.kind}`.toLowerCase().includes(search.toLowerCase())), [docs, search]);
  const invoices = docs.filter(d => d.kind === "Rechnung");
  const offers = docs.filter(d => d.kind === "Angebot");
  const totalInvoiced = invoices.reduce((sum, d) => sum + d.amount, 0);
  const outstanding = invoices.filter(d => d.status !== "Bezahlt").reduce((sum, d) => sum + d.amount, 0);
  const offerVolume = offers.filter(d => d.status === "Offen").reduce((sum, d) => sum + d.amount, 0);

  if (!loggedIn) return <Login email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSubmit={signIn} error={loginError} configured={isSupabaseConfigured} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">TS<span>•</span></div>
          <div><strong>T.S. Serviceleistungen</strong><small>Digitale Lösungen</small></div>
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(false)} aria-label="Menü schließen"><X size={18}/></button>
        </div>
        <div className="workspace-label">ARBEITSBEREICH</div>
        <nav>
          {([
            ["Dashboard", LayoutDashboard], ["Kunden", Users], ["Angebote", FileText],
            ["Rechnungen", ReceiptText], ["Berechnung", Activity], ["Ausgaben", Wallet], ["Einstellungen", Settings]
          ] as const).map(([name, Icon]) => (
            <button key={name} className={`nav-item ${tab === name ? "active" : ""}`} onClick={() => { setTab(name); setMenuOpen(false); }}>
              <Icon size={18}/><span>{name}</span>
              {name === "Rechnungen" && <span className="nav-count">{invoices.filter(d => d.status !== "Bezahlt").length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card"><Sparkles size={17}/><div><strong>Demo-Modus</strong><small>{liveData ? "Supabase verbunden" : "Beispieldaten"}</small></div></div>
          <button className="nav-item" onClick={() => setNotice("Die Hilfe für die Demo wird im nächsten Ausbauschritt ergänzt.")}><CircleHelp size={18}/><span>Hilfe & Support</span></button>
          <button className="nav-item" onClick={signOut}><LogOut size={18}/><span>Abmelden</span></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(true)} aria-label="Menü öffnen"><Menu size={20}/></button>
          <div className="breadcrumbs">T.S. Serviceleistungen <span>/</span> <strong>{tab}</strong></div>
          <div className="top-actions">
            <label className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen …"/></label>
            <button className="icon-btn" onClick={() => setNotice("Du bist auf dem aktuellen Demo-Stand.")} aria-label="Benachrichtigungen"><Bell size={18}/></button>
            <div className="user-chip"><div className="avatar">TS</div><div><strong>{userEmail || "Administrator"}</strong><small>Administrator</small></div><ChevronDown size={15}/></div>
          </div>
        </header>

        {notice && <div className="notice"><span>{notice}</span><button className="icon-btn" onClick={() => setNotice("")} aria-label="Meldung schließen"><X size={16}/></button></div>}

        <section className="page">
          <div className="page-heading">
            <div><div className="eyebrow"><span className="gold-dot"/> UNTERNEHMENSÜBERSICHT</div><h1>{tab === "Dashboard" ? "Guten Tag!" : tab}</h1><p>{tab === "Dashboard" ? "Hier ist die aktuelle Übersicht deiner digitalen Geschäftsabläufe." : `Verwalte ${tab.toLowerCase()} zentral an einem Ort.`}</p></div>
            <div className="heading-actions"><button className="btn btn-light" onClick={() => { setDocs(demoDocs); setCustomers(demoCustomers); setLiveData(false); setNotice("Lokale Demo-Ansicht wurde zurückgesetzt. Supabase-Daten wurden nicht verändert."); }}><RefreshCw size={16}/> Demo zurücksetzen</button><button className="btn btn-gold" onClick={() => setShowDocForm("Rechnung")}><Plus size={17}/> Neue Rechnung</button></div>
          </div>

          {tab === "Dashboard" && <Dashboard invoices={invoices} offers={offers} customers={customers} totalInvoiced={totalInvoiced} outstanding={outstanding} offerVolume={offerVolume} onNewOffer={() => setShowDocForm("Angebot")} onNewInvoice={() => setShowDocForm("Rechnung")} onOpenDoc={setSelectedDoc} onDeleteDoc={deleteDocument} />}
          {tab === "Kunden" && <Customers customers={filteredCustomers} onAdd={() => setShowCustomerForm(true)} docs={docs} onOpenDoc={setSelectedDoc} onDeleteDoc={deleteDocument} />}
          {tab === "Angebote" && <Documents docs={filteredDocs.filter(d => d.kind === "Angebot")} kind="Angebot" onNew={() => setShowDocForm("Angebot")} onOpen={setSelectedDoc} onDelete={deleteDocument} />}
          {tab === "Rechnungen" && <Documents docs={filteredDocs.filter(d => d.kind === "Rechnung")} kind="Rechnung" onNew={() => setShowDocForm("Rechnung")} onOpen={setSelectedDoc} onDelete={deleteDocument} />}
          {tab === "Berechnung" && <Calculation docs={invoices} expenses={expenses} onAddExpense={() => setShowExpenseForm(true)} />}
          {tab === "Ausgaben" && <Expenses expenses={expenses} onAdd={() => setShowExpenseForm(true)} onAddPhoto={() => setShowExpenseForm(true)} /> }
          {tab === "Einstellungen" && <SettingsPage configured={isSupabaseConfigured} liveData={liveData} />}

          <footer>© 2026 T.S. Serviceleistungen · Digitale Lösungen <span>•</span> Demo-Version – Musterwerte, keine produktive Buchhaltungssoftware</footer>
        </section>
      </main>

      {selectedDoc && <Modal title={`${selectedDoc.kind} ${selectedDoc.number}`} className="modal-preview" onClose={() => setSelectedDoc(null)}>
        <DocumentPreview doc={selectedDoc} companyId={companyId} onClose={() => setSelectedDoc(null)} onDelete={() => void deleteDocument(selectedDoc)} deleting={documentDeleting} />
      </Modal>}

      {showExpenseForm && <Modal title="Ausgabe mit Beleg erfassen" onClose={() => { if (!expenseSaving && !receiptReading) { setShowExpenseForm(false); setReceiptPreview(""); setReceiptFile(null); } }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (!supabase || !companyId || !liveData) { setNotice("Ausgabe kann nur mit aktiver Supabase-Verbindung gespeichert werden."); return; }
          const amount = Number(expenseAmount); const taxAmount = Number(expenseTax) || 0;
          if (!expenseDescription.trim() || !Number.isFinite(amount) || amount < 0 || taxAmount < 0) return;
          setExpenseSaving(true); setNotice("");
          try {
            let receiptPath: string | null = null;
            if (receiptFile) {
              const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
              receiptPath = `${companyId}/${Date.now()}-${safeName}`;
              const { error: uploadError } = await supabase.storage.from("expense-receipts").upload(receiptPath, receiptFile, { upsert: false, contentType: receiptFile.type || "application/octet-stream" });
              if (uploadError) throw new Error("Belegfoto konnte nicht archiviert werden: " + uploadError.message);
            }
            const { error } = await supabase.from("expenses").insert({ company_id: companyId, expense_date: expenseDate, description: expenseDescription.trim(), category: expenseCategory, amount, tax_amount: taxAmount, notes: expenseNotes.trim() || null, receipt_path: receiptPath });
            if (error) throw error;
            setExpenseDescription(""); setExpenseAmount(""); setExpenseTax("0"); setExpenseNotes(""); setReceiptFile(null); setReceiptPreview(""); setShowExpenseForm(false);
            await loadLiveData(); setNotice("Ausgabe wurde gespeichert. Der Beleg ist im geschützten Belegarchiv abgelegt.");
          } catch (err) { setNotice("Ausgabe konnte nicht gespeichert werden: " + (err instanceof Error ? err.message : "Datenbankfehler")); }
          finally { setExpenseSaving(false); }
        }}>
          <div className="receipt-capture">
            <div><strong>Beleg fotografieren oder hochladen</strong><p>Foto direkt mit der Handykamera aufnehmen. Die KI liest anschließend Datum, Händler und Beträge aus.</p></div>
            <label className="btn btn-light receipt-pick"><FilePlus2 size={16}/> Foto / Datei auswählen
              <input className="receipt-file-input" type="file" accept="image/*,application/pdf" capture="environment" onChange={async e => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                setReceiptFile(file); setReceiptReadError(""); setReceiptPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
                if (file.type === "application/pdf") { setReceiptReadError("PDF ausgewählt. Die automatische KI-Auslesung ist aktuell für Fotos vorgesehen; bitte fotografiere oder lade den Beleg als Bild hoch."); return; }
                if (!file.type.startsWith("image/")) { setReceiptReadError("Bitte wähle ein Foto oder eine Bilddatei aus."); return; }
                setReceiptReading(true);
                try {
                  const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = () => reject(new Error("Foto konnte nicht gelesen werden."));
                    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
                    reader.readAsDataURL(file);
                  });
                  const { data, error } = await supabase!.functions.invoke("extract-expense-receipt", { body: { image_base64: base64, mime_type: file.type } });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  if (data?.expense_date) setExpenseDate(data.expense_date);
                  if (data?.description) setExpenseDescription(data.description);
                  if (data?.category) setExpenseCategory(data.category);
                  if (data?.amount !== undefined && data?.amount !== null) setExpenseAmount(String(data.amount));
                  if (data?.tax_amount !== undefined && data?.tax_amount !== null) setExpenseTax(String(data.tax_amount));
                  if (data?.notes) setExpenseNotes(data.notes);
                  setNotice("KI-Auslesung abgeschlossen. Bitte prüfe Datum und Beträge vor dem Speichern.");
                } catch (err) {
                  setReceiptReadError("KI-Auslesung nicht möglich: " + (err instanceof Error ? err.message : "Unbekannter Fehler") + ". Du kannst die Felder weiterhin manuell ausfüllen.");
                } finally { setReceiptReading(false); }
              }} />
            </label>
            {receiptPreview && <img className="receipt-preview" src={receiptPreview} alt="Vorschau des Belegfotos" />}
            {receiptFile && <span className="receipt-file-name">{receiptFile.name}</span>}
            {receiptReading && <p className="receipt-status"><Sparkles size={16}/> KI liest den Beleg aus …</p>}
            {receiptReadError && <p className="receipt-error">{receiptReadError}</p>}
          </div>
          <label>Datum<input type="date" required value={expenseDate} onChange={e=>setExpenseDate(e.target.value)} /></label>
          <label>Bezeichnung / Händler<input required value={expenseDescription} onChange={e=>setExpenseDescription(e.target.value)} placeholder="z. B. Baumarkt / Materialeinkauf" /></label>
          <label>Kategorie<select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)}><option>Betriebsausgabe</option><option>Material</option><option>Fahrzeug</option><option>Werkzeug</option><option>Software / Telefon</option><option>Versicherung</option><option>Fahrtkosten</option><option>Sonstiges</option></select></label>
          <label>Bruttobetrag (€)<input type="number" min="0" step="0.01" required value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)} placeholder="0,00" /></label>
          <label>Enthaltene MwSt. (€)<input type="number" min="0" step="0.01" value={expenseTax} onChange={e=>setExpenseTax(e.target.value)} /></label>
          <label>Notiz / Belegnummer<textarea rows={2} value={expenseNotes} onChange={e=>setExpenseNotes(e.target.value)} /></label>
          <p className="form-note">Wichtig: KI-Ergebnisse vor dem Speichern prüfen. Der Bruttobetrag ist maßgeblich. Das Originalfoto wird beim Speichern geschützt archiviert.</p>
          <div className="modal-actions"><button type="button" className="btn btn-light" onClick={()=>{setShowExpenseForm(false);setReceiptPreview("");setReceiptFile(null);}} disabled={expenseSaving || receiptReading}>Abbrechen</button><button className="btn btn-gold" type="submit" disabled={expenseSaving || receiptReading}>{expenseSaving?"Speichert …":"Ausgabe speichern"}</button></div>
        </form>
      </Modal>}
      {showCustomerForm && <Modal title="Neuen Kunden anlegen" onClose={() => { if (!customerSaving) setShowCustomerForm(false); }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (customerSaving) return;
          if (!supabase || !companyId || !liveData) {
            setNotice("Kunde wurde nicht gespeichert: Es besteht keine aktive Supabase-Verbindung zum Unternehmen. Bitte neu anmelden und erneut versuchen.");
            return;
          }
          setCustomerSaving(true);
          setNotice("");
          try {
            const { data: existingRows, error: numberError } = await supabase
              .from("customers")
              .select("customer_number")
              .eq("company_id", companyId);
            if (numberError) throw numberError;
            const maxNumber = (existingRows ?? []).reduce((max, row) => {
              const match = /^KD-(\d+)$/.exec(String(row.customer_number ?? ""));
              return match ? Math.max(max, Number(match[1])) : max;
            }, 1000);
            const customerNumber = `KD-${String(maxNumber + 1).padStart(4, "0")}`;
            const { data: savedCustomer, error: insertError } = await supabase
              .from("customers")
              .insert({
                company_id: companyId,
                customer_number: customerNumber,
                customer_type: "business",
                name: newCustomerName.trim(),
                email: newCustomerEmail.trim() || null,
                city: null,
                country: "Deutschland"
              })
              .select("id,customer_number,name,email,city")
              .single();
            if (insertError) throw insertError;
            const customer: Customer = {
              id: savedCustomer.id,
              customer_number: savedCustomer.customer_number,
              name: savedCustomer.name,
              email: savedCustomer.email ?? "",
              city: savedCustomer.city ?? ""
            };
            setCustomers(old => [...old, customer].sort((a, b) => a.customer_number.localeCompare(b.customer_number, "de")));
            setNewCustomerName("");
            setNewCustomerEmail("");
            setShowCustomerForm(false);
            setNotice(`Kunde ${customer.customer_number} wurde in Supabase gespeichert.`);
          } catch (error) {
            console.error("Customer save failed:", error);
            const message = error instanceof Error ? error.message : "Unbekannter Datenbankfehler";
            setNotice(`Kunde konnte nicht gespeichert werden: ${message}`);
          } finally {
            setCustomerSaving(false);
          }
        }}>
          <label>Firmen- oder Kundenname<input required value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Musterfirma GmbH" disabled={customerSaving}/></label>
          <label>E-Mail-Adresse<input type="email" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} placeholder="kontakt@example.de" disabled={customerSaving}/></label>
          <div className="modal-actions"><button type="button" className="btn btn-light" onClick={() => setShowCustomerForm(false)} disabled={customerSaving}>Abbrechen</button><button className="btn btn-gold" type="submit" disabled={customerSaving}>{customerSaving ? "Wird gespeichert …" : "Kunde anlegen"}</button></div>
        </form>
      </Modal>}

      {showDocForm && <Modal title={`Neues ${showDocForm}`} className="modal-document" onClose={() => { if (!documentSaving) setShowDocForm(null); }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (documentSaving) return;
          const customer = customers.find(c => c.id === docCustomer);
          if (!supabase || !companyId || !liveData || !customer) {
            setNotice(`Speichern nicht möglich: Bitte melde dich erneut an und prüfe die Supabase-Verbindung sowie den ausgewählten Kunden.`);
            return;
          }
          const kind = showDocForm;
          const validItems = docItems.map(item => ({ description: item.description.trim(), quantity: Number(item.quantity), unit: item.unit.trim() || "Stück", unit_price: Number(item.unit_price) }))
            .filter(item => item.description && item.quantity > 0 && item.unit_price >= 0);
          if (!validItems.length) { setNotice("Bitte mindestens eine vollständige Leistungsposition mit Menge und Preis eintragen."); return; }
          const amount = validItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
          const vatRate = 19;
          const taxAmount = Math.round(amount * vatRate) / 100;
          const grossAmount = Math.round((amount + taxAmount) * 100) / 100;
          const issueDate = new Date().toISOString().slice(0, 10);
          setDocumentSaving(true);
          setNotice("");
          try {
            let documentNumber = "";
            if (kind === "Rechnung") {
              const { data: existingRows, error: listError } = await supabase
                .from("invoices").select("invoice_number").eq("company_id", companyId);
              if (listError) throw listError;
              const currentYear = new Date().getFullYear();
              const maxNumber = (existingRows ?? []).reduce((max, row) => {
                const value = String(row.invoice_number ?? "");
                const match = new RegExp(`^RE-(?:${currentYear}-|DEMO-)?(\\d+)import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, ChevronDown, CircleHelp, Download, FileCheck2,
  FilePlus2, FileText, Filter, LayoutDashboard, LogOut, Menu, MoreHorizontal,
  Plus, ReceiptText, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Users, Trash2, Eye,
  Wallet, X
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Tab = "Dashboard" | "Kunden" | "Angebote" | "Rechnungen" | "Berechnung" | "Ausgaben" | "Einstellungen";
type Customer = { id: string; name: string; email?: string; city?: string; customer_number: string };
type Doc = { id: string; number: string; customer: string; customerId?: string; date: string; amount: number; status: string; kind: "Angebot" | "Rechnung" };
type DraftItem = { description: string; quantity: string; unit: string; unit_price: string };
type Expense = { id: string; expense_date: string; description: string; category: string; amount: number; tax_amount: number; notes?: string; receipt_path?: string };

const money = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
const dateFmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("de-DE");
const statusLabel = (status: string) => {
  const labels: Record<string, string> = { draft: "Entwurf", open: "Offen", accepted: "Angenommen", rejected: "Abgelehnt", expired: "Abgelaufen", converted: "Umgewandelt", cancelled: "Storniert", partially_paid: "Teilweise bezahlt", paid: "Bezahlt", overdue: "Überfällig" };
  return labels[status] ?? (status || "Entwurf");
};
const demoCustomers: Customer[] = [
  { id: "c1", customer_number: "KD-1001", name: "Müller GmbH", email: "mueller@example.com", city: "Cham" },
  { id: "c2", customer_number: "KD-1002", name: "Schmidt Bau", email: "schmidt@example.com", city: "Furth im Wald" },
  { id: "c3", customer_number: "KD-1003", name: "AutoClean Service", email: "autoclean@example.com", city: "Bad Kötzting" }
];
const demoDocs: Doc[] = [
  { id: "d1", number: "RE-2026-001", customer: "Müller GmbH", date: "2026-10-02", amount: 1250, status: "Bezahlt", kind: "Rechnung" },
  { id: "d2", number: "RE-2026-002", customer: "Schmidt Bau", date: "2026-10-06", amount: 750, status: "Offen", kind: "Rechnung" },
  { id: "d3", number: "RE-2026-003", customer: "AutoClean Service", date: "2026-10-09", amount: 480, status: "Offen", kind: "Rechnung" },
  { id: "d4", number: "AN-2026-001", customer: "Müller GmbH", date: "2026-10-01", amount: 1250, status: "Angenommen", kind: "Angebot" },
  { id: "d5", number: "AN-2026-002", customer: "Schmidt Bau", date: "2026-10-05", amount: 2480, status: "Offen", kind: "Angebot" },
  { id: "d6", number: "AN-2026-003", customer: "AutoClean Service", date: "2026-10-08", amount: 890, status: "Offen", kind: "Angebot" }
];

export default function App() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>(demoCustomers);
  const [docs, setDocs] = useState<Doc[]>(demoDocs);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0,10));
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Betriebsausgabe");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseTax, setExpenseTax] = useState("0");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [receiptReading, setReceiptReading] = useState(false);
  const [receiptReadError, setReceiptReadError] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [showDocForm, setShowDocForm] = useState<"Angebot" | "Rechnung" | null>(null);
  const [docCustomer, setDocCustomer] = useState(demoCustomers[0].id);
  const [docDescription, setDocDescription] = useState("Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot.");
  const [docItems, setDocItems] = useState<DraftItem[]>([{ description: "Arbeitsleistung", quantity: "1", unit: "Stunde", unit_price: "250" }]);
  const [notice, setNotice] = useState("");
  const [liveData, setLiveData] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [documentDeleting, setDocumentDeleting] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLoggedIn(true);
        setUserEmail(data.session.user.email ?? "");
        void loadLiveData();
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
      setUserEmail(session?.user.email ?? "");
      if (session) void loadLiveData();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadLiveData() {
    if (!supabase) return;
    const { data: companyRows, error: companyError } = await supabase
      .from("companies").select("id,name").eq("name", "T.S. Serviceleistungen: Digitale Lösungen").limit(1);
    if (companyError || !companyRows?.length) {
      setNotice("Login aktiv, aber Demo-Unternehmen nicht gefunden oder nicht berechtigt.");
      return;
    }
    const currentCompanyId = companyRows[0].id;
    setCompanyId(currentCompanyId);
    const [customerResult, invoiceResult, offerResult, expenseResult] = await Promise.all([
      supabase.from("customers").select("id,customer_number,name,email,city").eq("company_id", currentCompanyId).order("customer_number"),
      supabase.from("invoices").select("id,company_id,customer_id,invoice_number,customer_name,issue_date,total_amount,status").eq("company_id", currentCompanyId).order("issue_date", { ascending: false }),
      supabase.from("offers").select("id,company_id,customer_id,offer_number,customer_name,issue_date,total_amount,status").eq("company_id", currentCompanyId).order("issue_date", { ascending: false }),
      supabase.from("expenses").select("id,expense_date,description,category,amount,tax_amount,notes,receipt_path").eq("company_id", currentCompanyId).order("expense_date", { ascending: false })
    ]);
    if (customerResult.error || invoiceResult.error || offerResult.error || expenseResult.error) {
      setNotice("Daten konnten nicht vollständig geladen werden. Bitte RLS und Unternehmensmitgliedschaft prüfen.");
      return;
    }
    setCustomers((customerResult.data ?? []).map((c) => ({ id: c.id, customer_number: c.customer_number, name: c.name, email: c.email ?? "", city: c.city ?? "" })));
    if (customerResult.data?.length && !customerResult.data.some((c) => c.id === docCustomer)) setDocCustomer(customerResult.data[0].id);
    const invoiceDocs: Doc[] = (invoiceResult.data ?? []).map((d) => ({ id: d.id, number: d.invoice_number, customer: d.customer_name, customerId: d.customer_id, date: d.issue_date, amount: Number(d.total_amount), status: statusLabel(d.status), kind: "Rechnung" }));
    const offerDocs: Doc[] = (offerResult.data ?? []).map((d) => ({ id: d.id, number: d.offer_number, customer: d.customer_name, customerId: d.customer_id, date: d.issue_date, amount: Number(d.total_amount), status: statusLabel(d.status), kind: "Angebot" }));
    setDocs([...invoiceDocs, ...offerDocs]);
    setExpenses((expenseResult.data ?? []).map((e) => ({ id:e.id, expense_date:e.expense_date, description:e.description, category:e.category ?? "Betriebsausgabe", amount:Number(e.amount), tax_amount:Number(e.tax_amount ?? 0), notes:e.notes ?? "", receipt_path:e.receipt_path ?? "" })));
    setLiveData(true);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    if (!supabase) {
      setLoginError("Supabase ist noch nicht konfiguriert. Für die lokale Vorschau kannst du den Demo-Zugang verwenden.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError("Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
  }

  async function deleteDocument(doc: Doc) {
    if (!supabase || !companyId || !liveData) {
      setNotice("Löschen nicht möglich: Keine aktive Supabase-Verbindung.");
      return;
    }
    const confirmed = window.confirm(`Soll ${doc.kind.toLowerCase()} ${doc.number} wirklich dauerhaft gelöscht werden?`);
    if (!confirmed) return;
    setDocumentDeleting(true);
    setNotice("");
    try {
      const table = doc.kind === "Rechnung" ? "invoices" : "offers";
      const { error } = await supabase.from(table).delete().eq("id", doc.id).eq("company_id", companyId);
      if (error) throw error;
      setSelectedDoc(current => current?.id === doc.id ? null : current);
      await loadLiveData();
      setNotice(`${doc.kind} ${doc.number} wurde gelöscht.`);
    } catch (error) {
      console.error("Document delete failed:", error);
      const message = error instanceof Error ? error.message : "Unbekannter Datenbankfehler";
      setNotice(`${doc.kind} konnte nicht gelöscht werden: ${message}`);
    } finally {
      setDocumentDeleting(false);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setLoggedIn(false);
    setLiveData(false);
  }

  const filteredCustomers = useMemo(() => customers.filter(c => `${c.name} ${c.email} ${c.customer_number} ${c.city}`.toLowerCase().includes(search.toLowerCase())), [customers, search]);
  const filteredDocs = useMemo(() => docs.filter(d => `${d.number} ${d.customer} ${d.status} ${d.kind}`.toLowerCase().includes(search.toLowerCase())), [docs, search]);
  const invoices = docs.filter(d => d.kind === "Rechnung");
  const offers = docs.filter(d => d.kind === "Angebot");
  const totalInvoiced = invoices.reduce((sum, d) => sum + d.amount, 0);
  const outstanding = invoices.filter(d => d.status !== "Bezahlt").reduce((sum, d) => sum + d.amount, 0);
  const offerVolume = offers.filter(d => d.status === "Offen").reduce((sum, d) => sum + d.amount, 0);

  if (!loggedIn) return <Login email={email} setEmail={setEmail} password={password} setPassword={setPassword} onSubmit={signIn} error={loginError} configured={isSupabaseConfigured} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">TS<span>•</span></div>
          <div><strong>T.S. Serviceleistungen</strong><small>Digitale Lösungen</small></div>
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(false)} aria-label="Menü schließen"><X size={18}/></button>
        </div>
        <div className="workspace-label">ARBEITSBEREICH</div>
        <nav>
          {([
            ["Dashboard", LayoutDashboard], ["Kunden", Users], ["Angebote", FileText],
            ["Rechnungen", ReceiptText], ["Berechnung", Activity], ["Ausgaben", Wallet], ["Einstellungen", Settings]
          ] as const).map(([name, Icon]) => (
            <button key={name} className={`nav-item ${tab === name ? "active" : ""}`} onClick={() => { setTab(name); setMenuOpen(false); }}>
              <Icon size={18}/><span>{name}</span>
              {name === "Rechnungen" && <span className="nav-count">{invoices.filter(d => d.status !== "Bezahlt").length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card"><Sparkles size={17}/><div><strong>Demo-Modus</strong><small>{liveData ? "Supabase verbunden" : "Beispieldaten"}</small></div></div>
          <button className="nav-item" onClick={() => setNotice("Die Hilfe für die Demo wird im nächsten Ausbauschritt ergänzt.")}><CircleHelp size={18}/><span>Hilfe & Support</span></button>
          <button className="nav-item" onClick={signOut}><LogOut size={18}/><span>Abmelden</span></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(true)} aria-label="Menü öffnen"><Menu size={20}/></button>
          <div className="breadcrumbs">T.S. Serviceleistungen <span>/</span> <strong>{tab}</strong></div>
          <div className="top-actions">
            <label className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen …"/></label>
            <button className="icon-btn" onClick={() => setNotice("Du bist auf dem aktuellen Demo-Stand.")} aria-label="Benachrichtigungen"><Bell size={18}/></button>
            <div className="user-chip"><div className="avatar">TS</div><div><strong>{userEmail || "Administrator"}</strong><small>Administrator</small></div><ChevronDown size={15}/></div>
          </div>
        </header>

        {notice && <div className="notice"><span>{notice}</span><button className="icon-btn" onClick={() => setNotice("")} aria-label="Meldung schließen"><X size={16}/></button></div>}

        <section className="page">
          <div className="page-heading">
            <div><div className="eyebrow"><span className="gold-dot"/> UNTERNEHMENSÜBERSICHT</div><h1>{tab === "Dashboard" ? "Guten Tag!" : tab}</h1><p>{tab === "Dashboard" ? "Hier ist die aktuelle Übersicht deiner digitalen Geschäftsabläufe." : `Verwalte ${tab.toLowerCase()} zentral an einem Ort.`}</p></div>
            <div className="heading-actions"><button className="btn btn-light" onClick={() => { setDocs(demoDocs); setCustomers(demoCustomers); setLiveData(false); setNotice("Lokale Demo-Ansicht wurde zurückgesetzt. Supabase-Daten wurden nicht verändert."); }}><RefreshCw size={16}/> Demo zurücksetzen</button><button className="btn btn-gold" onClick={() => setShowDocForm("Rechnung")}><Plus size={17}/> Neue Rechnung</button></div>
          </div>

          {tab === "Dashboard" && <Dashboard invoices={invoices} offers={offers} customers={customers} totalInvoiced={totalInvoiced} outstanding={outstanding} offerVolume={offerVolume} onNewOffer={() => setShowDocForm("Angebot")} onNewInvoice={() => setShowDocForm("Rechnung")} onOpenDoc={setSelectedDoc} onDeleteDoc={deleteDocument} />}
          {tab === "Kunden" && <Customers customers={filteredCustomers} onAdd={() => setShowCustomerForm(true)} docs={docs} onOpenDoc={setSelectedDoc} onDeleteDoc={deleteDocument} />}
          {tab === "Angebote" && <Documents docs={filteredDocs.filter(d => d.kind === "Angebot")} kind="Angebot" onNew={() => setShowDocForm("Angebot")} onOpen={setSelectedDoc} onDelete={deleteDocument} />}
          {tab === "Rechnungen" && <Documents docs={filteredDocs.filter(d => d.kind === "Rechnung")} kind="Rechnung" onNew={() => setShowDocForm("Rechnung")} onOpen={setSelectedDoc} onDelete={deleteDocument} />}
          {tab === "Berechnung" && <Calculation docs={invoices} expenses={expenses} onAddExpense={() => setShowExpenseForm(true)} />}
          {tab === "Ausgaben" && <Expenses expenses={expenses} onAdd={() => setShowExpenseForm(true)} onAddPhoto={() => setShowExpenseForm(true)} /> }
          {tab === "Einstellungen" && <SettingsPage configured={isSupabaseConfigured} liveData={liveData} />}

          <footer>© 2026 T.S. Serviceleistungen · Digitale Lösungen <span>•</span> Demo-Version – Musterwerte, keine produktive Buchhaltungssoftware</footer>
        </section>
      </main>

      {selectedDoc && <Modal title={`${selectedDoc.kind} ${selectedDoc.number}`} className="modal-preview" onClose={() => setSelectedDoc(null)}>
        <DocumentPreview doc={selectedDoc} companyId={companyId} onClose={() => setSelectedDoc(null)} onDelete={() => void deleteDocument(selectedDoc)} deleting={documentDeleting} />
      </Modal>}

      {showExpenseForm && <Modal title="Ausgabe mit Beleg erfassen" onClose={() => { if (!expenseSaving && !receiptReading) { setShowExpenseForm(false); setReceiptPreview(""); setReceiptFile(null); } }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (!supabase || !companyId || !liveData) { setNotice("Ausgabe kann nur mit aktiver Supabase-Verbindung gespeichert werden."); return; }
          const amount = Number(expenseAmount); const taxAmount = Number(expenseTax) || 0;
          if (!expenseDescription.trim() || !Number.isFinite(amount) || amount < 0 || taxAmount < 0) return;
          setExpenseSaving(true); setNotice("");
          try {
            let receiptPath: string | null = null;
            if (receiptFile) {
              const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
              receiptPath = `${companyId}/${Date.now()}-${safeName}`;
              const { error: uploadError } = await supabase.storage.from("expense-receipts").upload(receiptPath, receiptFile, { upsert: false, contentType: receiptFile.type || "application/octet-stream" });
              if (uploadError) throw new Error("Belegfoto konnte nicht archiviert werden: " + uploadError.message);
            }
            const { error } = await supabase.from("expenses").insert({ company_id: companyId, expense_date: expenseDate, description: expenseDescription.trim(), category: expenseCategory, amount, tax_amount: taxAmount, notes: expenseNotes.trim() || null, receipt_path: receiptPath });
            if (error) throw error;
            setExpenseDescription(""); setExpenseAmount(""); setExpenseTax("0"); setExpenseNotes(""); setReceiptFile(null); setReceiptPreview(""); setShowExpenseForm(false);
            await loadLiveData(); setNotice("Ausgabe wurde gespeichert. Der Beleg ist im geschützten Belegarchiv abgelegt.");
          } catch (err) { setNotice("Ausgabe konnte nicht gespeichert werden: " + (err instanceof Error ? err.message : "Datenbankfehler")); }
          finally { setExpenseSaving(false); }
        }}>
          <div className="receipt-capture">
            <div><strong>Beleg fotografieren oder hochladen</strong><p>Foto direkt mit der Handykamera aufnehmen. Die KI liest anschließend Datum, Händler und Beträge aus.</p></div>
            <label className="btn btn-light receipt-pick"><FilePlus2 size={16}/> Foto / Datei auswählen
              <input className="receipt-file-input" type="file" accept="image/*,application/pdf" capture="environment" onChange={async e => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                setReceiptFile(file); setReceiptReadError(""); setReceiptPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
                if (file.type === "application/pdf") { setReceiptReadError("PDF ausgewählt. Die automatische KI-Auslesung ist aktuell für Fotos vorgesehen; bitte fotografiere oder lade den Beleg als Bild hoch."); return; }
                if (!file.type.startsWith("image/")) { setReceiptReadError("Bitte wähle ein Foto oder eine Bilddatei aus."); return; }
                setReceiptReading(true);
                try {
                  const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = () => reject(new Error("Foto konnte nicht gelesen werden."));
                    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
                    reader.readAsDataURL(file);
                  });
                  const { data, error } = await supabase!.functions.invoke("extract-expense-receipt", { body: { image_base64: base64, mime_type: file.type } });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  if (data?.expense_date) setExpenseDate(data.expense_date);
                  if (data?.description) setExpenseDescription(data.description);
                  if (data?.category) setExpenseCategory(data.category);
                  if (data?.amount !== undefined && data?.amount !== null) setExpenseAmount(String(data.amount));
                  if (data?.tax_amount !== undefined && data?.tax_amount !== null) setExpenseTax(String(data.tax_amount));
                  if (data?.notes) setExpenseNotes(data.notes);
                  setNotice("KI-Auslesung abgeschlossen. Bitte prüfe Datum und Beträge vor dem Speichern.");
                } catch (err) {
                  setReceiptReadError("KI-Auslesung nicht möglich: " + (err instanceof Error ? err.message : "Unbekannter Fehler") + ". Du kannst die Felder weiterhin manuell ausfüllen.");
                } finally { setReceiptReading(false); }
              }} />
            </label>
            {receiptPreview && <img className="receipt-preview" src={receiptPreview} alt="Vorschau des Belegfotos" />}
            {receiptFile && <span className="receipt-file-name">{receiptFile.name}</span>}
            {receiptReading && <p className="receipt-status"><Sparkles size={16}/> KI liest den Beleg aus …</p>}
            {receiptReadError && <p className="receipt-error">{receiptReadError}</p>}
          </div>
          <label>Datum<input type="date" required value={expenseDate} onChange={e=>setExpenseDate(e.target.value)} /></label>
          <label>Bezeichnung / Händler<input required value={expenseDescription} onChange={e=>setExpenseDescription(e.target.value)} placeholder="z. B. Baumarkt / Materialeinkauf" /></label>
          <label>Kategorie<select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)}><option>Betriebsausgabe</option><option>Material</option><option>Fahrzeug</option><option>Werkzeug</option><option>Software / Telefon</option><option>Versicherung</option><option>Fahrtkosten</option><option>Sonstiges</option></select></label>
          <label>Bruttobetrag (€)<input type="number" min="0" step="0.01" required value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)} placeholder="0,00" /></label>
          <label>Enthaltene MwSt. (€)<input type="number" min="0" step="0.01" value={expenseTax} onChange={e=>setExpenseTax(e.target.value)} /></label>
          <label>Notiz / Belegnummer<textarea rows={2} value={expenseNotes} onChange={e=>setExpenseNotes(e.target.value)} /></label>
          <p className="form-note">Wichtig: KI-Ergebnisse vor dem Speichern prüfen. Der Bruttobetrag ist maßgeblich. Das Originalfoto wird beim Speichern geschützt archiviert.</p>
          <div className="modal-actions"><button type="button" className="btn btn-light" onClick={()=>{setShowExpenseForm(false);setReceiptPreview("");setReceiptFile(null);}} disabled={expenseSaving || receiptReading}>Abbrechen</button><button className="btn btn-gold" type="submit" disabled={expenseSaving || receiptReading}>{expenseSaving?"Speichert …":"Ausgabe speichern"}</button></div>
        </form>
      </Modal>}
      {showCustomerForm && <Modal title="Neuen Kunden anlegen" onClose={() => { if (!customerSaving) setShowCustomerForm(false); }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (customerSaving) return;
          if (!supabase || !companyId || !liveData) {
            setNotice("Kunde wurde nicht gespeichert: Es besteht keine aktive Supabase-Verbindung zum Unternehmen. Bitte neu anmelden und erneut versuchen.");
            return;
          }
          setCustomerSaving(true);
          setNotice("");
          try {
            const { data: existingRows, error: numberError } = await supabase
              .from("customers")
              .select("customer_number")
              .eq("company_id", companyId);
            if (numberError) throw numberError;
            const maxNumber = (existingRows ?? []).reduce((max, row) => {
              const match = /^KD-(\d+)$/.exec(String(row.customer_number ?? ""));
              return match ? Math.max(max, Number(match[1])) : max;
            }, 1000);
            const customerNumber = `KD-${String(maxNumber + 1).padStart(4, "0")}`;
            const { data: savedCustomer, error: insertError } = await supabase
              .from("customers")
              .insert({
                company_id: companyId,
                customer_number: customerNumber,
                customer_type: "business",
                name: newCustomerName.trim(),
                email: newCustomerEmail.trim() || null,
                city: null,
                country: "Deutschland"
              })
              .select("id,customer_number,name,email,city")
              .single();
            if (insertError) throw insertError;
            const customer: Customer = {
              id: savedCustomer.id,
              customer_number: savedCustomer.customer_number,
              name: savedCustomer.name,
              email: savedCustomer.email ?? "",
              city: savedCustomer.city ?? ""
            };
            setCustomers(old => [...old, customer].sort((a, b) => a.customer_number.localeCompare(b.customer_number, "de")));
            setNewCustomerName("");
            setNewCustomerEmail("");
            setShowCustomerForm(false);
            setNotice(`Kunde ${customer.customer_number} wurde in Supabase gespeichert.`);
          } catch (error) {
            console.error("Customer save failed:", error);
            const message = error instanceof Error ? error.message : "Unbekannter Datenbankfehler";
            setNotice(`Kunde konnte nicht gespeichert werden: ${message}`);
          } finally {
            setCustomerSaving(false);
          }
        }}>
          <label>Firmen- oder Kundenname<input required value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Musterfirma GmbH" disabled={customerSaving}/></label>
          <label>E-Mail-Adresse<input type="email" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} placeholder="kontakt@example.de" disabled={customerSaving}/></label>
          <div className="modal-actions"><button type="button" className="btn btn-light" onClick={() => setShowCustomerForm(false)} disabled={customerSaving}>Abbrechen</button><button className="btn btn-gold" type="submit" disabled={customerSaving}>{customerSaving ? "Wird gespeichert …" : "Kunde anlegen"}</button></div>
        </form>
      </Modal>}

      {showDocForm && <Modal title={`Neues ${showDocForm}`} className="modal-document" onClose={() => { if (!documentSaving) setShowDocForm(null); }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (documentSaving) return;
          const customer = customers.find(c => c.id === docCustomer);
          if (!supabase || !companyId || !liveData || !customer) {
            setNotice(`Speichern nicht möglich: Bitte melde dich erneut an und prüfe die Supabase-Verbindung sowie den ausgewählten Kunden.`);
            return;
          }
          const kind = showDocForm;
          const validItems = docItems.map(item => ({ description: item.description.trim(), quantity: Number(item.quantity), unit: item.unit.trim() || "Stück", unit_price: Number(item.unit_price) }))
            .filter(item => item.description && item.quantity > 0 && item.unit_price >= 0);
          if (!validItems.length) { setNotice("Bitte mindestens eine vollständige Leistungsposition mit Menge und Preis eintragen."); return; }
          const amount = validItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
          const vatRate = 19;
          const taxAmount = Math.round(amount * vatRate) / 100;
          const grossAmount = Math.round((amount + taxAmount) * 100) / 100;
          const issueDate = new Date().toISOString().slice(0, 10);
          setDocumentSaving(true);
          setNotice("");
          try {
            let documentNumber = "";
            if (kind === "Rechnung") {
              const { data: existingRows, error: listError } = await supabase
                .from("invoices").select("invoice_number").eq("company_id", companyId);
              if (listError) throw listError;
              ).exec(value);
                return match ? Math.max(max, Number(match[1])) : max;
              }, 0);
              documentNumber = `RE-${currentYear}-${String(maxNumber + 1).padStart(3, "0")}`;
              const { data: savedInvoice, error } = await supabase.from("invoices").insert({
                company_id: companyId,
                customer_id: customer.id,
                invoice_number: documentNumber,
                customer_name: customer.name,
                issue_date: issueDate,
                status: "draft",
                currency: "EUR",
                notes: docDescription.trim(),
                subtotal: amount,
                tax_amount: taxAmount,
                total_amount: grossAmount,
                created_by: (await supabase.auth.getUser()).data.user?.id ?? null
              }).select("id").single();
              if (error) throw error;
              const { error: itemError } = await supabase.from("invoice_items").insert(validItems.map((item, index) => ({
                company_id: companyId, invoice_id: savedInvoice.id, position: index + 1,
                description: item.description, quantity: item.quantity, unit: item.unit,
                unit_price: item.unit_price, discount_percent: 0, tax_rate: vatRate,
                line_total: Math.round(item.quantity * item.unit_price * 100) / 100
              })));
              if (itemError) throw itemError;
            } else {
              const { data: existingRows, error: listError } = await supabase
                .from("offers").select("offer_number").eq("company_id", companyId);
              if (listError) throw listError;
              ).exec(value);
                return match ? Math.max(max, Number(match[1])) : max;
              }, 0);
              documentNumber = `AN-${currentYear}-${String(maxNumber + 1).padStart(3, "0")}`;
              const validUntil = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
              const { data: savedOffer, error } = await supabase.from("offers").insert({
                company_id: companyId,
                customer_id: customer.id,
                offer_number: documentNumber,
                issue_date: issueDate,
                valid_until: validUntil,
                customer_name: customer.name,
                customer_street: null,
                customer_postal_code: null,
                customer_city: customer.city || null,
                customer_country: "Deutschland",
                status: "draft",
                currency: "EUR",
                notes: docDescription.trim(),
                terms: "Dieses Angebot ist 14 Tage gültig. Die Abrechnung erfolgt nach den aufgeführten Positionen.",
                subtotal: amount,
                discount_amount: 0,
                tax_amount: taxAmount,
                total_amount: grossAmount,
                created_by: (await supabase.auth.getUser()).data.user?.id ?? null
              }).select("id").single();
              if (error) throw error;
              const { error: itemError } = await supabase.from("offer_items").insert(validItems.map((item, index) => ({
                company_id: companyId, offer_id: savedOffer.id, position: index + 1,
                description: item.description, quantity: item.quantity, unit: item.unit,
                unit_price: item.unit_price, discount_percent: 0, tax_rate: vatRate,
                line_total: Math.round(item.quantity * item.unit_price * 100) / 100
              })));
              if (itemError) throw itemError;
            }
            setShowDocForm(null);
            setNotice(`${kind} ${documentNumber} wurde in Supabase gespeichert.`);
            await loadLiveData();
          } catch (error) {
            console.error("Document save failed:", error);
            const message = error instanceof Error ? error.message : "Unbekannter Datenbankfehler";
            setNotice(`${kind} konnte nicht gespeichert werden: ${message}`);
          } finally {
            setDocumentSaving(false);
          }
        }}>
          <label>Kunde<select value={docCustomer} onChange={e => setDocCustomer(e.target.value)} disabled={documentSaving}>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Einleitung / Beschreibung<textarea required value={docDescription} onChange={e => setDocDescription(e.target.value)} disabled={documentSaving} rows={3}/></label>
          <div className="line-items-editor">
            <div className="line-items-heading"><strong>Leistungen und Artikel</strong><button type="button" className="text-btn" disabled={documentSaving} onClick={() => setDocItems(items => [...items, { description: "", quantity: "1", unit: "Stück", unit_price: "0" }])}><Plus size={15}/> Position hinzufügen</button></div>
            {docItems.map((item, index) => <div className="line-item-edit" key={index}>
              <label>Leistung / Artikel<input required value={item.description} disabled={documentSaving} onChange={e => setDocItems(items => items.map((row, i) => i === index ? {...row, description:e.target.value} : row))}/></label>
              <label>Menge<input type="number" min="0.01" step="0.01" required value={item.quantity} disabled={documentSaving} onChange={e => setDocItems(items => items.map((row, i) => i === index ? {...row, quantity:e.target.value} : row))}/></label>
              <label>Einheit<input required value={item.unit} disabled={documentSaving} onChange={e => setDocItems(items => items.map((row, i) => i === index ? {...row, unit:e.target.value} : row))}/></label>
              <label>Einzelpreis (€)<input type="number" min="0" step="0.01" required value={item.unit_price} disabled={documentSaving} onChange={e => setDocItems(items => items.map((row, i) => i === index ? {...row, unit_price:e.target.value} : row))}/></label>
              <div className="line-item-total"><span>Gesamt</span><strong>{money(Math.max(0,Number(item.quantity)||0)*Math.max(0,Number(item.unit_price)||0))}</strong>{docItems.length > 1 && <button type="button" className="text-btn" aria-label="Position entfernen" disabled={documentSaving} onClick={() => setDocItems(items => items.filter((_,i)=>i!==index))}><Trash2 size={14}/> Entfernen</button>}</div>
            </div>)}
            <div className="line-items-sum"><span>Zwischensumme (netto)</span><strong>{money(docItems.reduce((sum,item)=>sum + Math.max(0,Number(item.quantity)||0)*Math.max(0,Number(item.unit_price)||0),0))}</strong></div><div className="line-items-sum"><span>19 % MwSt.</span><strong>{money(docItems.reduce((sum,item)=>sum + Math.max(0,Number(item.quantity)||0)*Math.max(0,Number(item.unit_price)||0),0)*0.19)}</strong></div><div className="line-items-sum"><span>Gesamtbetrag (brutto)</span><strong>{money(docItems.reduce((sum,item)=>sum + Math.max(0,Number(item.quantity)||0)*Math.max(0,Number(item.unit_price)||0),0)*1.19)}</strong></div>
          </div>
          <p className="form-note">{kindLabel(showDocForm)} wird mit Einzelpositionen und 19 % MwSt. gespeichert. Dies ist eine Demo-Voreinstellung; prüfe vor produktiver Nutzung, ob der Steuersatz für den konkreten Vorgang gilt.</p>
          <div className="modal-actions"><button type="button" className="btn btn-light" onClick={() => setShowDocForm(null)} disabled={documentSaving}>Abbrechen</button><button className="btn btn-gold" type="submit" disabled={documentSaving}>{documentSaving ? "Wird gespeichert …" : "Entwurf speichern"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}

function kindLabel(kind: "Angebot" | "Rechnung") { return kind === "Angebot" ? "Das Angebot" : "Die Rechnung"; }

function Login({ email, setEmail, password, setPassword, onSubmit, error, configured }: {
  email: string; setEmail: (v: string) => void; password: string; setPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void; error: string; configured: boolean;
}) {
  const [preview, setPreview] = useState(false);
  return <div className="login-shell">
    <div className="login-card">
      <div className="brand login-brand"><div className="brand-mark">TS<span>•</span></div><div><strong>T.S. Serviceleistungen</strong><small>Digitale Lösungen</small></div></div>
      <div className="login-icon"><ShieldCheck size={25}/></div>
      <div className="eyebrow"><span className="gold-dot"/> GESCHÜTZTER BEREICH</div>
      <h1>Willkommen zurück.</h1><p>Melde dich an, um deine Unternehmensübersicht zu öffnen.</p>
      <form onSubmit={onSubmit} className="form-grid">
        <label>E-Mail-Adresse<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@unternehmen.de"/></label>
        <label>Passwort<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Dein Passwort"/></label>
        {error && <div className="error-message">{error}</div>}
        <button className="btn btn-gold btn-full" type="submit">Sicher anmelden <ShieldCheck size={17}/></button>
      </form>
      {!configured && <button className="preview-link" onClick={() => setPreview(true)}>Designvorschau ohne Anmeldung ansehen</button>}
      {preview && <div className="preview-note"><p>Vorschau ist vorbereitet. Für den vollständigen Demo-Zugang müssen zuerst die Supabase-Umgebungsvariablen eingerichtet werden.</p><button className="btn btn-light" onClick={() => setPreview(false)}>Schließen</button></div>}
      <div className="login-foot"><ShieldCheck size={14}/> Geschützte Anmeldung · Demo-Umgebung</div>
    </div>
    <div className="login-side"><div className="side-glow"/><div className="side-content"><div className="side-emblem">TS</div><div className="eyebrow">DIGITAL. EINFACH. ÜBERSICHTLICH.</div><h2>Dein Betrieb.<br/>Alles im Blick.</h2><p>Kunden, Angebote, Rechnungen und Auswertungen – an einem zentralen Ort.</p><div className="side-pills"><span><Users size={15}/> Kunden</span><span><FileCheck2 size={15}/> Angebote</span><span><ReceiptText size={15}/> Rechnungen</span></div></div></div>
  </div>;
}

function Dashboard({ invoices, offers, customers, totalInvoiced, outstanding, offerVolume, onNewOffer, onNewInvoice, onOpenDoc, onDeleteDoc }: {
  invoices: Doc[]; offers: Doc[]; customers: Customer[]; totalInvoiced: number; outstanding: number; offerVolume: number;
  onNewOffer: () => void; onNewInvoice: () => void; onOpenDoc: (doc: Doc) => void; onDeleteDoc: (doc: Doc) => void;
}) {
  const months = ["Mai", "Jun", "Jul", "Aug", "Sep", "Okt"];
  const monthly = [4200, 6100, 5400, 7900, 6800, totalInvoiced || 2480];
  const max = Math.max(...monthly, 1);
  return <>
    <div className="quick-actions">
      <button onClick={onNewOffer}><span className="quick-icon gold"><FilePlus2 size={19}/></span><span><strong>Angebot erstellen</strong><small>Neues Kundenangebot</small></span><Plus size={17}/></button>
      <button onClick={onNewInvoice}><span className="quick-icon silver"><ReceiptText size={19}/></span><span><strong>Rechnung schreiben</strong><small>Neue Rechnung anlegen</small></span><Plus size={17}/></button>
      <button onClick={() => window.print()}><span className="quick-icon gray"><Download size={19}/></span><span><strong>Übersicht drucken</strong><small>Dashboard exportieren</small></span><Download size={17}/></button>
    </div>
    <div className="metric-grid">
      <Metric title="Rechnungsvolumen" value={money(totalInvoiced)} change="Summe der Demo-Rechnungen" icon={<ReceiptText size={18}/>} tone="gold"/>
      <Metric title="Offene Forderungen" value={money(outstanding)} change="Noch nicht als bezahlt markiert" icon={<Wallet size={18}/>} tone="silver"/>
      <Metric title="Offene Angebote" value={money(offerVolume)} change={`${offers.filter(o => o.status === "Offen").length} offene Angebote`} icon={<FileText size={18}/>} tone="gray"/>
      <Metric title="Kunden" value={String(customers.length)} change="Im aktuellen Datenbestand" icon={<Users size={18}/>} tone="gold"/>
    </div>
    <div className="content-grid">
      <section className="panel revenue-panel"><div className="panel-head"><div><h2>Umsatzentwicklung</h2><p>Illustrative Monatswerte für die Designvorschau</p></div><button className="select-pill">Letzte 6 Monate <ChevronDown size={14}/></button></div>
        <div className="chart-legend"><span><i className="legend-gold"/> Umsatz</span><span><i className="legend-silver"/> Vergleich</span></div>
        <div className="bar-chart">{months.map((m,i) => <div className="bar-group" key={m}><div className="bars"><div className="bar previous" style={{height: `${Math.max(7, [3000,4300,4900,6200,5800,6100][i]/max*150)}px`}}/><div className="bar current" style={{height: `${Math.max(7, monthly[i]/max*150)}px`}}/></div><small>{m}</small></div>)}</div>
      </section>
      <section className="panel"><div className="panel-head"><div><h2>Dokumentenstatus</h2><p>Aktueller Demo-Bestand</p></div><MoreHorizontal size={20}/></div>
        <div className="status-list"><StatusRow label="Rechnungen bezahlt" value={invoices.filter(i=>i.status==="Bezahlt").length} total={Math.max(1,invoices.length)} tone="gold"/><StatusRow label="Rechnungen offen" value={invoices.filter(i=>i.status!=="Bezahlt").length} total={Math.max(1,invoices.length)} tone="silver"/><StatusRow label="Angebote offen" value={offers.filter(i=>i.status==="Offen").length} total={Math.max(1,offers.length)} tone="gray"/></div>
        <div className="panel-note"><Activity size={16}/> Status basiert auf den sichtbaren Demo-Datensätzen.</div>
      </section>
    </div>
    <section className="panel table-panel"><div className="panel-head"><div><h2>Zuletzt bearbeitete Dokumente</h2><p>Rechnungen und Angebote im Überblick</p></div><span className="table-count">{invoices.length+offers.length} Dokumente</span></div><DocumentTable docs={[...invoices,...offers].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6)} onOpen={onOpenDoc} onDelete={onDeleteDoc}/></section>
  </>;
}

type DocumentLine = { description: string; quantity: number; unit: string; unit_price: number; line_total: number; tax_rate: number };
type BusinessProfile = { name: string; street?: string; postal_code?: string; city?: string; country?: string; email?: string; phone?: string; tax_number?: string; vat_id?: string; iban?: string; bic?: string };
type CustomerAddress = { name: string; customer_number?: string; street?: string; postal_code?: string; city?: string; country?: string; email?: string };
function DocumentPreview({ doc, companyId, onClose, onDelete, deleting }: { doc: Doc; companyId: string | null; onClose: () => void; onDelete: () => void; deleting: boolean }) {
  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [customer, setCustomer] = useState<CustomerAddress | null>(null);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailNotice, setEmailNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase || !companyId) { setLoading(false); return; }
      setLoading(true); setLoadError("");
      try {
        const table = doc.kind === "Angebot" ? "offers" : "invoices";
        const itemTable = doc.kind === "Angebot" ? "offer_items" : "invoice_items";
        const fk = doc.kind === "Angebot" ? "offer_id" : "invoice_id";
        const [companyResult, docResult, itemResult] = await Promise.all([
          supabase.from("companies").select("name,street,postal_code,city,country,email,phone,tax_number,vat_id,iban,bic").eq("id", companyId).single(),
          supabase.from(table).select("*").eq("id", doc.id).eq("company_id", companyId).single(),
          supabase.from(itemTable).select("description,quantity,unit,unit_price,line_total,tax_rate,position").eq(fk, doc.id).eq("company_id", companyId).order("position")
        ]);
        if (companyResult.error) throw companyResult.error;
        if (docResult.error) throw docResult.error;
        if (itemResult.error) throw itemResult.error;
        let customerResult: any = null;
        if (docResult.data.customer_id) {
          const result = await supabase.from("customers").select("name,customer_number,street,postal_code,city,country,email").eq("id", docResult.data.customer_id).eq("company_id", companyId).maybeSingle();
          customerResult = result.data;
        }
        if (cancelled) return;
        setBusiness(companyResult.data as BusinessProfile);
        setCustomer((customerResult ?? { name: doc.customer, email: "" }) as CustomerAddress);
        setLines((itemResult.data ?? []).map((line: any) => ({ description: line.description, quantity: Number(line.quantity), unit: line.unit, unit_price: Number(line.unit_price), line_total: Number(line.line_total), tax_rate: Number(line.tax_rate) })));
        setValidUntil(docResult.data.valid_until ?? "");
        setNotes(docResult.data.notes ?? "");
        setTerms(docResult.data.terms ?? docResult.data.payment_terms ?? "");
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Dokumentdetails konnten nicht geladen werden.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [doc.id, doc.kind, companyId]);
  const subtotal = lines.reduce((sum, line) => sum + line.line_total, 0);
  const tax = lines.reduce((sum, line) => sum + line.line_total * line.tax_rate / 100, 0);
  return <div className="document-preview-shell">
    {loading && <p className="form-note">Dokumentdetails werden geladen …</p>}
    {loadError && <p className="error-message">Details konnten nicht geladen werden: {loadError}</p>}
    <article className="customer-document">
      <header className="customer-document-brand"><div className="document-logo-mark"><Sparkles size={22}/><span>TS</span></div><div className="document-brand-copy"><strong>{business?.name || "T.S. Serviceleistungen: Digitale Lösungen"}</strong><small>{[business?.street, [business?.postal_code, business?.city].filter(Boolean).join(" "), business?.country].filter(Boolean).join(" · ") || "Digitale Lösungen · Deutschland"}</small><small>{[business?.email, business?.phone].filter(Boolean).join(" · ") || "Kunden · Angebote · Rechnungen"}</small></div><div className="document-brand-label">SERVICE<br/>DIGITAL</div></header>
      <div className="customer-document-title"><div><span className="eyebrow">{doc.kind === "Angebot" ? "ANGEBOT" : "RECHNUNG"}</span><h2>{doc.number}</h2></div><div className="document-date"><span>Datum</span><strong>{dateFmt(doc.date)}</strong>{doc.kind === "Angebot" && validUntil && <><span>Gültig bis</span><strong>{dateFmt(validUntil)}</strong></>}</div></div>
      <div className="document-sender-line">{business?.name || "T.S. Serviceleistungen"} · {[business?.street, [business?.postal_code, business?.city].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</div>
      <div className="document-address-meta">
        <div className="document-recipient"><span>{doc.kind === "Angebot" ? "ANGEBOT FÜR" : "RECHNUNGSEMPFÄNGER"}</span><strong>{customer?.name || doc.customer}</strong>{customer?.street && <span>{customer.street}</span>}{[customer?.postal_code, customer?.city].filter(Boolean).length > 0 && <span>{[customer?.postal_code, customer?.city].filter(Boolean).join(" ")}</span>}<span>{customer?.country || "Deutschland"}</span>{customer?.email && <span>{customer.email}</span>}</div>
        <div className="document-meta-list"><div><span>{doc.kind === "Angebot" ? "Angebotsnummer" : "Rechnungsnummer"}</span><strong>{doc.number}</strong></div><div><span>Datum</span><strong>{dateFmt(doc.date)}</strong></div>{doc.kind === "Angebot" && validUntil && <div><span>Gültig bis</span><strong>{dateFmt(validUntil)}</strong></div>}{customer?.customer_number && <div><span>Ihre Kundennummer</span><strong>{customer.customer_number}</strong></div>}<div><span>Ihr Ansprechpartner</span><strong>Thomas Schwetz</strong></div></div>
      </div>
      <p className="document-intro">{notes || (doc.kind === "Angebot" ? "Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes freibleibendes Angebot:" : "Vielen Dank für Ihren Auftrag und das damit verbundene Vertrauen. Hiermit stelle ich Ihnen die folgenden Leistungen in Rechnung:")}</p>
      <div className="document-items-table"><table><thead><tr><th>Pos.</th><th>Leistung / Artikel</th><th className="align-right">Menge</th><th>Einheit</th><th className="align-right">Einzelpreis</th><th className="align-right">Gesamt</th></tr></thead><tbody>{lines.map((line,index)=><tr key={index}><td>{index+1}</td><td>{line.description}</td><td className="align-right">{new Intl.NumberFormat("de-DE",{maximumFractionDigits:2}).format(line.quantity)}</td><td>{line.unit}</td><td className="align-right">{money(line.unit_price)}</td><td className="align-right">{money(line.line_total)}</td></tr>)}</tbody></table></div>
      <div className="document-bottom-grid">
        <div className="document-terms"><strong>{doc.kind === "Angebot" ? "Hinweise und Angebotsbedingungen" : "Zahlungsbedingungen"}</strong><p>{terms || (doc.kind === "Angebot" ? "Dieses Angebot ist 14 Tage gültig. Bitte prüfen Sie die aufgeführten Leistungen und Mengen. Bei Rückfragen sprechen Sie uns gerne an." : "Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer innerhalb von 14 Tagen ohne Abzüge.")}</p>{doc.kind === "Angebot" && <p>Wir bedanken uns für Ihr Interesse und freuen uns auf Ihren Auftrag.</p>}</div>
        <div className="document-totals"><div><span>Summe Positionen (netto)</span><strong>{money(subtotal)}</strong></div>{tax > 0 && <div><span>MwSt. ({lines.length ? `${lines[0].tax_rate}%` : "19%"})</span><strong>{money(tax)}</strong></div>}{tax === 0 && <div><span>Umsatzsteuer</span><strong>0,00 €</strong></div>}<div className="document-total"><span>Gesamtbetrag {tax > 0 ? "(brutto)" : ""}</span><strong>{money(subtotal + tax)}</strong></div><small>Demo-Dokument – Steuerangaben vor produktiver Verwendung prüfen.</small></div>
      </div>
      <footer className="customer-document-footer"><div><strong>{business?.name || "T.S. Serviceleistungen"}</strong> · {[business?.street, [business?.postal_code, business?.city].filter(Boolean).join(" "), business?.country].filter(Boolean).join(", ")}</div><div>{[business?.phone && `Tel. ${business.phone}`, business?.email && `E-Mail ${business.email}`, business?.tax_number && `Steuernr. ${business.tax_number}`, business?.vat_id && `USt-IdNr. ${business.vat_id}`, business?.iban && `IBAN ${business.iban}`, business?.bic && `BIC ${business.bic}`].filter(Boolean).join(" · ")}</div></footer>
    </article>
    {emailNotice && <p className={emailNotice.startsWith("E-Mail versendet") ? "form-note" : "error-message"}>{emailNotice}</p>}
    <div className="modal-actions no-print"><button type="button" className="btn btn-light" onClick={onClose}>Schließen</button><button type="button" className="btn btn-light" disabled={deleting} onClick={onDelete}><Trash2 size={16}/>{deleting ? "Wird gelöscht …" : "Dokument löschen"}</button><button type="button" className="btn btn-light" disabled={emailSending || loading || !customer?.email} title={!customer?.email ? "Beim Kunden muss eine E-Mail-Adresse hinterlegt sein" : "Dokument per E-Mail senden"} onClick={async () => {
      if (!supabase || !companyId || !customer?.email) return;
      setEmailSending(true); setEmailNotice("");
      try {
        const { data, error } = await supabase.functions.invoke("send-document-email", { body: { document_id: doc.id, document_kind: doc.kind, recipient_email: customer.email } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setEmailNotice(`E-Mail versendet an ${customer.email}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unbekannter Fehler";
        setEmailNotice(`E-Mail konnte nicht versendet werden: ${message}. Prüfe die E-Mail-Funktion und deren Versandkonfiguration.`);
      } finally { setEmailSending(false); }
    }}><FileText size={16}/>{emailSending ? "Wird gesendet …" : "Per E-Mail senden"}</button><button type="button" className="btn btn-gold" onClick={() => window.print()}><Download size={16}/> PDF / Drucken</button></div>
  </div>;
}

function Metric({ title, value, change, icon, tone }: { title: string; value: string; change: string; icon: React.ReactNode; tone: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-foot"><span className="trend"><ArrowUpRight size={14}/></span>{change}</div></div>;
}
function StatusRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  return <div className="status-row"><div className="status-label"><span>{label}</span><strong>{value}</strong></div><div className="progress"><span className={tone} style={{width: `${Math.min(100, value/total*100)}%`}}/></div></div>;
}
function DocumentTable({ docs, onOpen, onDelete }: { docs: Doc[]; onOpen?: (doc: Doc) => void; onDelete?: (doc: Doc) => void }) {
  if (!docs.length) return <div className="empty">Noch keine Dokumente vorhanden.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Dokument</th><th>Kunde</th><th>Datum</th><th>Status</th><th className="align-right">Betrag</th><th>Aktionen</th></tr></thead><tbody>{docs.map(d=><tr key={d.id}><td><span className={`doc-icon ${d.kind==="Rechnung"?"invoice":"offer"}`}>{d.kind==="Rechnung"?<ReceiptText size={16}/>:<FileText size={16}/>}</span><span className="doc-name"><strong>{d.number}</strong><small>{d.kind}</small></span></td><td>{d.customer}</td><td>{dateFmt(d.date)}</td><td><span className={`status-badge ${d.status==="Bezahlt"||d.status==="Angenommen"?"success":d.status==="Offen"?"pending":"neutral"}`}><i/>{d.status}</span></td><td className="align-right amount">{money(d.amount)}</td><td><div className="row-actions">{onOpen && <button type="button" className="text-btn" onClick={() => onOpen(d)} aria-label={`${d.number} öffnen`}><Eye size={15}/> Öffnen</button>}{onDelete && <button type="button" className="text-btn" onClick={() => onDelete(d)} aria-label={`${d.number} löschen`}><Trash2 size={15}/> Löschen</button>}</div></td></tr>)}</tbody></table></div>;
}
function Customers({ customers, onAdd, docs, onOpenDoc, onDeleteDoc }: { customers: Customer[]; onAdd: () => void; docs: Doc[]; onOpenDoc: (doc: Doc) => void; onDeleteDoc: (doc: Doc) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const customer = customers.find(c=>c.id===selected);
  return <div className="panel table-panel"><div className="panel-head"><div><h2>Kunden</h2><p>Kundenstammdaten und zugehörige Dokumente</p></div><button className="btn btn-gold" onClick={onAdd}><Plus size={16}/> Neuer Kunde</button></div>
    <div className="table-wrap"><table><thead><tr><th>Kundennummer</th><th>Name</th><th>E-Mail</th><th>Ort</th><th></th></tr></thead><tbody>{customers.map(c=><tr key={c.id}><td>{c.customer_number}</td><td><strong>{c.name}</strong></td><td>{c.email||"—"}</td><td>{c.city||"—"}</td><td><button className="text-btn" onClick={()=>setSelected(selected===c.id?null:c.id)}>{selected===c.id?"Schließen":"Kundenakte öffnen"}</button></td></tr>)}</tbody></table></div>
    {customer && <div className="customer-detail"><div><span className="eyebrow">KUNDENAKTE</span><h3>{customer.name}</h3><p>{customer.customer_number} · {customer.email||"Keine E-Mail hinterlegt"}</p></div><div className="customer-docs"><h4>Zugehörige Angebote und Rechnungen</h4><DocumentTable docs={docs.filter(d=>d.customer===customer.name)} onOpen={onOpenDoc} onDelete={onDeleteDoc}/></div></div>}
  </div>;
}
function Documents({ docs, kind, onNew, onOpen, onDelete }: { docs: Doc[]; kind: "Angebot"|"Rechnung"; onNew: () => void; onOpen: (doc: Doc) => void; onDelete: (doc: Doc) => void }) {
  return <section className="panel table-panel"><div className="panel-head"><div><h2>{kind} verwalten</h2><p>Dokumente, Status und Beträge</p></div><button className="btn btn-gold" onClick={onNew}><Plus size={16}/> {kind} erstellen</button></div><div className="filter-strip"><span><Filter size={15}/> Alle Dokumente</span><span>{docs.length} Einträge</span></div><DocumentTable docs={docs} onOpen={onOpen} onDelete={onDelete}/></section>;
}
function Calculation({ docs, expenses, onAddExpense }: { docs: Doc[]; expenses: Expense[]; onAddExpense: () => void }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const years = Array.from(new Set([String(new Date().getFullYear()), ...docs.map(d=>d.date.slice(0,4)), ...expenses.map(e=>e.expense_date.slice(0,4))])).sort((a,b)=>Number(b)-Number(a));
  const yearDocs = docs.filter(d=>d.date.startsWith(year)); const yearExpenses = expenses.filter(e=>e.expense_date.startsWith(year));
  const income = yearDocs.reduce((sum,d)=>sum+d.amount,0); const costs = yearExpenses.reduce((sum,e)=>sum+e.amount,0); const profit = income-costs;
  const months = Array.from({length:12},(_,i)=>{const key=`${year}-${String(i+1).padStart(2,"0")}`;const mi=yearDocs.filter(d=>d.date.startsWith(key)).reduce((s,d)=>s+d.amount,0);const me=yearExpenses.filter(e=>e.expense_date.startsWith(key)).reduce((s,e)=>s+e.amount,0);return {key,label:new Date(Number(year),i,1).toLocaleDateString("de-DE",{month:"long"}),income:mi,costs:me,profit:mi-me};});
  return <div className="calculation-page">
    <div className="calculation-toolbar"><div><h2>Gewinn- und Jahresübersicht</h2><p>Rechnungen und Betriebsausgaben nach Monat ausgewertet</p></div><div className="calculation-actions"><label>Geschäftsjahr<select value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label><button className="btn btn-gold" onClick={onAddExpense}><Plus size={16}/> Ausgabe erfassen</button></div></div>
    <div className="calculation-warning"><ShieldCheck size={17}/><span>Demo-Auswertung anhand gespeicherter Rechnungsbeträge und Ausgaben. Der Überschuss ist eine vereinfachte Brutto-Berechnung, keine steuerliche Gewinnermittlung.</span></div>
    <div className="metric-grid calculation-metrics"><Metric title="Rechnungen / Einnahmen" value={money(income)} change={`${yearDocs.length} Rechnungen im Jahr ${year}`} icon={<ReceiptText size={18}/>} tone="gold"/><Metric title="Erfasste Ausgaben" value={money(costs)} change={`${yearExpenses.length} Ausgaben im Jahr ${year}`} icon={<Wallet size={18}/>} tone="silver"/><Metric title="Überschuss vor Steuern" value={money(profit)} change="Einnahmen minus Ausgaben" icon={<Activity size={18}/>} tone={profit>=0?"gold":"gray"}/></div>
    <section className="panel table-panel"><div className="panel-head"><div><h2>Monatliche Auswertung {year}</h2><p>Jeder Monat mit Einnahmen, Ausgaben und Ergebnis</p></div></div><div className="table-wrap"><table><thead><tr><th>Monat</th><th className="numeric">Einnahmen</th><th className="numeric">Ausgaben</th><th className="numeric">Überschuss</th></tr></thead><tbody>{months.map(m=><tr key={m.key}><td><strong>{m.label}</strong></td><td className="numeric">{money(m.income)}</td><td className="numeric">{money(m.costs)}</td><td className={`numeric ${m.profit<0?"text-warn":"text-green"}`}><strong>{money(m.profit)}</strong></td></tr>)}</tbody><tfoot><tr><th>Jahressumme</th><th className="numeric">{money(income)}</th><th className="numeric">{money(costs)}</th><th className="numeric">{money(profit)}</th></tr></tfoot></table></div></section>
    <section className="panel table-panel"><div className="panel-head"><div><h2>Alle Rechnungen {year}</h2><p>Einzelne Einnahmen, nach Datum sortiert</p></div><span className="table-count">{yearDocs.length} Einträge</span></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Rechnungsnummer</th><th>Kunde</th><th className="numeric">Betrag</th><th>Status</th></tr></thead><tbody>{[...yearDocs].sort((a,b)=>b.date.localeCompare(a.date)).map(d=><tr key={d.id}><td>{dateFmt(d.date)}</td><td>{d.number}</td><td>{d.customer}</td><td className="numeric">{money(d.amount)}</td><td><span className="status-badge neutral">{d.status}</span></td></tr>)}{!yearDocs.length&&<tr><td colSpan={5}>Für dieses Jahr sind keine Rechnungen vorhanden.</td></tr>}</tbody></table></div></section>
    <section className="panel table-panel"><div className="panel-head"><div><h2>Alle Ausgaben {year}</h2><p>Erfasste Betriebsausgaben im Jahresverlauf</p></div><span className="table-count">{yearExpenses.length} Einträge</span></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Bezeichnung</th><th>Kategorie</th><th className="numeric">Betrag</th></tr></thead><tbody>{[...yearExpenses].sort((a,b)=>b.expense_date.localeCompare(a.expense_date)).map(e=><tr key={e.id}><td>{dateFmt(e.expense_date)}</td><td><strong>{e.description}</strong>{e.notes&&<small className="expense-note">{e.notes}</small>}</td><td>{e.category}</td><td className="numeric">{money(e.amount)}</td></tr>)}{!yearExpenses.length&&<tr><td colSpan={4}>Noch keine Ausgaben erfasst. Nutze „Ausgabe erfassen“.</td></tr>}</tbody></table></div></section>
  </div>;
}
function Expenses({ expenses, onAdd, onAddPhoto }: { expenses: Expense[]; onAdd: () => void; onAddPhoto: () => void }) {
  return <section className="panel table-panel"><div className="panel-head"><div><h2>Ausgabenverwaltung</h2><p>Belege fotografieren, automatisch auslesen und im Archiv speichern</p></div><div className="expense-header-actions"><button className="btn btn-light" onClick={onAddPhoto}><FilePlus2 size={16}/> Beleg fotografieren</button><button className="btn btn-gold" onClick={onAdd}><Plus size={16}/> Manuell erfassen</button></div></div><div className="receipt-info-strip"><Sparkles size={17}/><span><strong>KI-Belegerkennung</strong> – Foto aufnehmen, Felder automatisch ausfüllen lassen und vor dem Speichern prüfen.</span></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Bezeichnung</th><th>Kategorie</th><th>Beleg</th><th className="numeric">Bruttobetrag</th></tr></thead><tbody>{expenses.map(e=><tr key={e.id}><td>{dateFmt(e.expense_date)}</td><td>{e.description}</td><td>{e.category}</td><td>{e.receipt_path ? <span className="receipt-archived"><FileCheck2 size={15}/> Archiviert</span> : "Kein Foto"}</td><td className="numeric">{money(e.amount)}</td></tr>)}{!expenses.length&&<tr><td colSpan={5}>Noch keine Ausgaben gespeichert. Fotografiere deinen ersten Beleg mit dem Handy.</td></tr>}</tbody></table></div></section>;
}
function SettingsPage({ configured, liveData }: { configured: boolean; liveData: boolean }) {
  return <div className="settings-grid"><div className="panel settings-panel"><h2>Unternehmensprofil</h2><p>Angaben für spätere Angebots- und Rechnungsvorlagen.</p><div className="setting-line"><span>Firmenname</span><strong>T.S. Serviceleistungen</strong></div><div className="setting-line"><span>Bereich</span><strong>Digitale Lösungen</strong></div><div className="setting-line"><span>Design</span><strong>Silber · Weiß · Gold</strong></div></div><div className="panel settings-panel"><h2>Systemstatus</h2><div className="setting-line"><span>Supabase-Variablen</span><strong className={configured?"text-green":"text-warn"}>{configured?"Konfiguriert":"Noch nicht gesetzt"}</strong></div><div className="setting-line"><span>Datenquelle</span><strong>{liveData?"Supabase":"Lokale Demo"}</strong></div><div className="setting-line"><span>PDF-Erstellung</span><strong>Geplant</strong></div><div className="setting-line"><span>Demo-Reset</span><strong>Nur lokale Vorschau</strong></div></div></div>;
}
function Modal({ title, children, onClose, className = "" }: { title: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Schließen"><X size={18}/></button></div>{children}</section></div>;
}
