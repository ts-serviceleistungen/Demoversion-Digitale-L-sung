import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Bell, ChevronDown, CircleHelp, Download, FileCheck2,
  FilePlus2, FileText, Filter, LayoutDashboard, LogOut, Menu, MoreHorizontal,
  Plus, ReceiptText, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Users, Trash2, Eye,
  Wallet, X
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Tab = "Dashboard" | "Kunden" | "Angebote" | "Rechnungen" | "Ausgaben" | "Einstellungen";
type Customer = { id: string; name: string; email?: string; city?: string; customer_number: string };
type Doc = { id: string; number: string; customer: string; date: string; amount: number; status: string; kind: "Angebot" | "Rechnung" };

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
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [showDocForm, setShowDocForm] = useState<"Angebot" | "Rechnung" | null>(null);
  const [docCustomer, setDocCustomer] = useState(demoCustomers[0].id);
  const [docAmount, setDocAmount] = useState("250");
  const [docDescription, setDocDescription] = useState("Dienstleistung");
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
    const [customerResult, invoiceResult, offerResult] = await Promise.all([
      supabase.from("customers").select("id,customer_number,name,email,city").eq("company_id", currentCompanyId).order("customer_number"),
      supabase.from("invoices").select("id,company_id,customer_id,invoice_number,customer_name,issue_date,total_amount,status").eq("company_id", currentCompanyId).order("issue_date", { ascending: false }),
      supabase.from("offers").select("id,company_id,customer_id,offer_number,customer_name,issue_date,total_amount,status").eq("company_id", currentCompanyId).order("issue_date", { ascending: false })
    ]);
    if (customerResult.error || invoiceResult.error || offerResult.error) {
      setNotice("Daten konnten nicht vollständig geladen werden. Bitte RLS und Unternehmensmitgliedschaft prüfen.");
      return;
    }
    setCustomers((customerResult.data ?? []).map((c) => ({ id: c.id, customer_number: c.customer_number, name: c.name, email: c.email ?? "", city: c.city ?? "" })));
    if (customerResult.data?.length && !customerResult.data.some((c) => c.id === docCustomer)) setDocCustomer(customerResult.data[0].id);
    const invoiceDocs: Doc[] = (invoiceResult.data ?? []).map((d) => ({ id: d.id, number: d.invoice_number, customer: d.customer_name, date: d.issue_date, amount: Number(d.total_amount), status: statusLabel(d.status), kind: "Rechnung" }));
    const offerDocs: Doc[] = (offerResult.data ?? []).map((d) => ({ id: d.id, number: d.offer_number, customer: d.customer_name, date: d.issue_date, amount: Number(d.total_amount), status: statusLabel(d.status), kind: "Angebot" }));
    setDocs([...invoiceDocs, ...offerDocs]);
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
            ["Rechnungen", ReceiptText], ["Ausgaben", Wallet], ["Einstellungen", Settings]
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
          {tab === "Ausgaben" && <Expenses />}
          {tab === "Einstellungen" && <SettingsPage configured={isSupabaseConfigured} liveData={liveData} />}

          <footer>© 2026 T.S. Serviceleistungen · Digitale Lösungen <span>•</span> Demo-Version – Musterwerte, keine produktive Buchhaltungssoftware</footer>
        </section>
      </main>

      {selectedDoc && <Modal title={`${selectedDoc.kind} ${selectedDoc.number}`} onClose={() => setSelectedDoc(null)}>
        <div className="form-grid">
          <div className="setting-line"><span>Kunde</span><strong>{selectedDoc.customer}</strong></div>
          <div className="setting-line"><span>Datum</span><strong>{dateFmt(selectedDoc.date)}</strong></div>
          <div className="setting-line"><span>Status</span><strong>{selectedDoc.status}</strong></div>
          <div className="setting-line"><span>Betrag</span><strong>{money(selectedDoc.amount)}</strong></div>
          <p className="form-note">Dies ist die gespeicherte Dokumentübersicht. Bearbeiten und PDF-Erstellung sind noch nicht verfügbar.</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-light" onClick={() => setSelectedDoc(null)}>Schließen</button>
            <button type="button" className="btn btn-light" disabled={documentDeleting} onClick={() => void deleteDocument(selectedDoc)}><Trash2 size={16}/> {documentDeleting ? "Wird gelöscht …" : "Dokument löschen"}</button>
          </div>
        </div>
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

      {showDocForm && <Modal title={`Neues ${showDocForm}`} onClose={() => { if (!documentSaving) setShowDocForm(null); }}>
        <form className="form-grid" onSubmit={async e => {
          e.preventDefault();
          if (documentSaving) return;
          const customer = customers.find(c => c.id === docCustomer);
          if (!supabase || !companyId || !liveData || !customer) {
            setNotice(`Speichern nicht möglich: Bitte melde dich erneut an und prüfe die Supabase-Verbindung sowie den ausgewählten Kunden.`);
            return;
          }
          const kind = showDocForm;
          const amount = Math.max(0, Number(docAmount) || 0);
          const issueDate = new Date().toISOString().slice(0, 10);
          setDocumentSaving(true);
          setNotice("");
          try {
            let documentNumber = "";
            if (kind === "Rechnung") {
              const { data: existingRows, error: listError } = await supabase
                .from("invoices").select("invoice_number").eq("company_id", companyId);
              if (listError) throw listError;
              const maxNumber = (existingRows ?? []).reduce((max, row) => {
                const match = /^RE-DEMO-(\d+)$/.exec(String(row.invoice_number ?? ""));
                return match ? Math.max(max, Number(match[1])) : max;
              }, 0);
              documentNumber = `RE-DEMO-${String(maxNumber + 1).padStart(3, "0")}`;
              const { error } = await supabase.from("invoices").insert({
                company_id: companyId,
                customer_id: customer.id,
                invoice_number: documentNumber,
                customer_name: customer.name,
                issue_date: issueDate,
                status: "draft",
                currency: "EUR",
                notes: docDescription.trim(),
                subtotal: amount,
                total_amount: amount,
                created_by: (await supabase.auth.getUser()).data.user?.id ?? null
              });
              if (error) throw error;
            } else {
              const { data: existingRows, error: listError } = await supabase
                .from("offers").select("offer_number").eq("company_id", companyId);
              if (listError) throw listError;
              const maxNumber = (existingRows ?? []).reduce((max, row) => {
                const match = /^AN-DEMO-(\d+)$/.exec(String(row.offer_number ?? ""));
                return match ? Math.max(max, Number(match[1])) : max;
              }, 0);
              documentNumber = `AN-DEMO-${String(maxNumber + 1).padStart(3, "0")}`;
              const { error } = await supabase.from("offers").insert({
                company_id: companyId,
                customer_id: customer.id,
                offer_number: documentNumber,
                issue_date: issueDate,
                customer_name: customer.name,
                status: "draft",
                currency: "EUR",
                notes: docDescription.trim(),
                subtotal: amount,
                total_amount: amount,
                created_by: (await supabase.auth.getUser()).data.user?.id ?? null
              });
              if (error) throw error;
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
          <label>Leistungsbeschreibung<input required value={docDescription} onChange={e => setDocDescription(e.target.value)} disabled={documentSaving}/></label>
          <label>Betrag in Euro<input type="number" min="0" step="0.01" required value={docAmount} onChange={e => setDocAmount(e.target.value)} disabled={documentSaving}/></label>
          <p className="form-note">Demo-Entwurf. Noch keine rechtsverbindliche Rechnung; Steuerberechnung, Positionenspeicherung und PDF-Ausgabe werden später ergänzt.</p>
          <div className="modal-actions"><button type="button" className="btn btn-light" onClick={() => setShowDocForm(null)} disabled={documentSaving}>Abbrechen</button><button className="btn btn-gold" type="submit" disabled={documentSaving}>{documentSaving ? "Wird gespeichert …" : "Entwurf speichern"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}

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
function Expenses() {
  return <div className="panel empty-panel"><div className="empty-icon"><Wallet size={24}/></div><h2>Ausgabenverwaltung</h2><p>Die Datenbank ist vorbereitet. Eingabeformular, Belegupload und Auswertungen werden im nächsten Ausbauschritt ergänzt.</p><span className="status-badge neutral">In Vorbereitung</span></div>;
}
function SettingsPage({ configured, liveData }: { configured: boolean; liveData: boolean }) {
  return <div className="settings-grid"><div className="panel settings-panel"><h2>Unternehmensprofil</h2><p>Angaben für spätere Angebots- und Rechnungsvorlagen.</p><div className="setting-line"><span>Firmenname</span><strong>T.S. Serviceleistungen</strong></div><div className="setting-line"><span>Bereich</span><strong>Digitale Lösungen</strong></div><div className="setting-line"><span>Design</span><strong>Silber · Weiß · Gold</strong></div></div><div className="panel settings-panel"><h2>Systemstatus</h2><div className="setting-line"><span>Supabase-Variablen</span><strong className={configured?"text-green":"text-warn"}>{configured?"Konfiguriert":"Noch nicht gesetzt"}</strong></div><div className="setting-line"><span>Datenquelle</span><strong>{liveData?"Supabase":"Lokale Demo"}</strong></div><div className="setting-line"><span>PDF-Erstellung</span><strong>Geplant</strong></div><div className="setting-line"><span>Demo-Reset</span><strong>Nur lokale Vorschau</strong></div></div></div>;
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Schließen"><X size={18}/></button></div>{children}</section></div>;
}
