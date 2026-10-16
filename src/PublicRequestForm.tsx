import { useState } from "react";
import { supabase } from "./lib/supabase";

const trades = ["Malerarbeiten", "Gartenarbeiten", "Hausmeisterservice", "Reparaturarbeiten", "Renovierungsarbeiten", "Winterdienst", "Fahrzeugpflege", "Zubehörmontage", "Drohnenfotografie", "Reifenservice", "Sonstiges"];
const objects = ["Wohnhaus", "Wohnung", "Gewerbeobjekt", "Grundstück/Garten", "Fahrzeug", "Sonstiges"];

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "linear-gradient(145deg,#f4f5f7,#e9edf2)", padding: "24px 14px", color: "#20242b", fontFamily: "Arial,sans-serif" },
  card: { maxWidth: 760, margin: "0 auto", background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 14px 40px rgba(20,30,45,.12)" },
  hero: { padding: "26px 24px", background: "#20242b", color: "#fff", borderBottom: "4px solid #c6a04a" },
  form: { padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 7, fontSize: 14, fontWeight: 600 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #d4d9df", borderRadius: 9, padding: "12px 11px", fontSize: 16, background: "#fff", color: "#20242b" },
  full: { gridColumn: "1 / -1" },
  button: { gridColumn: "1 / -1", background: "#c6a04a", color: "#17191d", border: 0, borderRadius: 10, padding: "14px 18px", fontSize: 16, fontWeight: 700, cursor: "pointer" },
  hint: { color: "#65707d", fontSize: 13, fontWeight: 400, lineHeight: 1.5 },
};
export default function PublicRequestForm() {
  const [customerType, setCustomerType] = useState("private");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customerStreet, setCustomerStreet] = useState("");
  const [customerPostal, setCustomerPostal] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [objectType, setObjectType] = useState("Wohnhaus");
  const [objectStreet, setObjectStreet] = useState("");
  const [objectPostal, setObjectPostal] = useState("");
  const [objectCity, setObjectCity] = useState("");
  const [trade, setTrade] = useState("Malerarbeiten");
  const [description, setDescription] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [materials, setMaterials] = useState("");
  const [effort, setEffort] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!supabase) { setMessage("Das Anfrageformular ist derzeit nicht verfügbar. Bitte versuchen Sie es später erneut."); return; }
    if (!consent) { setMessage("Bitte stimmen Sie der Verarbeitung Ihrer Angaben zur Bearbeitung der Anfrage zu."); return; }
    if (photos.length > 5) { setMessage("Bitte laden Sie höchstens 5 Fotos hoch."); return; }
    if (photos.some(file => file.size > 4 * 1024 * 1024)) { setMessage("Jedes Foto darf höchstens 4 MB groß sein."); return; }
    setBusy(true);
    try {
      const photoFiles = await Promise.all(photos.map(async file => {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Ein Foto konnte nicht gelesen werden."));
          reader.readAsDataURL(file);
        });
        return { name: file.name, type: file.type, data: dataUrl.split(",")[1] || "" };
      }));
      const { data, error } = await supabase.functions.invoke("submit-public-object-request", {
        body: {
          customer_type: customerType, customer_name: customerName.trim(), customer_email: email.trim(),
          customer_phone: phone.trim(), customer_street: customerStreet.trim(), customer_postal_code: customerPostal.trim(),
          customer_city: customerCity.trim(), object_type: objectType, object_street: objectStreet.trim(),
          object_postal_code: objectPostal.trim(), object_city: objectCity.trim(), trade,
          work_description: description.trim(), dimensions_notes: dimensions.trim(), material_notes: materials.trim(),
          effort_notes: effort.trim(), photos: photoFiles, website: honeypot
        }
      });
      if (error) throw new Error(data?.error || error.message || "Die Anfrage konnte nicht übermittelt werden.");
      setSuccess(true);
      setMessage("Vielen Dank! Ihre Anfrage " + (data?.request_number ? "(" + data.request_number + ") " : "") + "wurde übermittelt. Wir prüfen die Angaben und melden uns bei Ihnen." + (data?.notification_sent === false ? " Die Anfrage ist gespeichert; die interne E-Mail-Benachrichtigung ist aktuell nicht verfügbar." : ""));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Die Anfrage konnte nicht übermittelt werden. Bitte versuchen Sie es erneut.");
    } finally { setBusy(false); }
  }

  if (success) return <main style={styles.page}><section style={styles.card}><header style={styles.hero}><strong style={{color:"#e0bd68",letterSpacing:1}}>T.S. SERVICELEISTUNGEN</strong><h1 style={{margin:"12px 0 4px",fontSize:27}}>Anfrage übermittelt</h1></header><div style={{padding:26}}><p>{message}</p><p style={styles.hint}>Sie können diese Seite jetzt schließen.</p></div></section></main>;

  return <main style={styles.page}><section style={styles.card}>
    <header style={styles.hero}><strong style={{color:"#e0bd68",letterSpacing:1}}>T.S. SERVICELEISTUNGEN</strong><h1 style={{margin:"12px 0 8px",fontSize:27}}>Unverbindliche Anfrage</h1><p style={{margin:0,color:"#d7dce2",lineHeight:1.5}}>Beschreiben Sie Ihr Vorhaben und laden Sie bei Bedarf Fotos hoch. Wir prüfen die Angaben und erstellen bei Interesse ein passendes Angebot.</p></header>
    <form style={styles.form} onSubmit={submit}>
      <div style={styles.field}><label htmlFor="customerType">Kundentyp</label><select id="customerType" style={styles.input} value={customerType} onChange={e=>setCustomerType(e.target.value)}><option value="private">Privatkunde</option><option value="business">Unternehmen</option></select></div>
      <div style={styles.field}><label htmlFor="customerName">{customerType==="business"?"Firmenname":"Vor- und Nachname"} *</label><input id="customerName" style={styles.input} required maxLength={160} value={customerName} onChange={e=>setCustomerName(e.target.value)} /></div>
      <div style={styles.field}><label htmlFor="email">E-Mail-Adresse *</label><input id="email" type="email" required maxLength={254} style={styles.input} value={email} onChange={e=>setEmail(e.target.value)} /></div>
      <div style={styles.field}><label htmlFor="phone">Telefonnummer</label><input id="phone" type="tel" maxLength={50} style={styles.input} value={phone} onChange={e=>setPhone(e.target.value)} /></div>
      <div style={styles.field}><label htmlFor="customerStreet">Ihre Straße / Hausnummer</label><input id="customerStreet" maxLength={180} style={styles.input} value={customerStreet} onChange={e=>setCustomerStreet(e.target.value)} /></div>
      <div style={styles.field}><label htmlFor="customerPostal">PLZ</label><input id="customerPostal" maxLength={20} style={styles.input} value={customerPostal} onChange={e=>setCustomerPostal(e.target.value)} /></div>
      <div style={styles.field}><label htmlFor="customerCity">Ort</label><input id="customerCity" maxLength={120} style={styles.input} value={customerCity} onChange={e=>setCustomerCity(e.target.value)} /></div>
      <div style={styles.field}><label htmlFor="trade">Gewünschtes Gewerk *</label><select id="trade" required style={styles.input} value={trade} onChange={e=>setTrade(e.target.value)}>{trades.map(t=><option key={t}>{t}</option>)}</select></div>
      <div style={styles.field}><label htmlFor="objectType">Objektart *</label><select id="objectType" required style={styles.input} value={objectType} onChange={e=>setObjectType(e.target.value)}>{objects.map(t=><option key={t}>{t}</option>)}</select></div>
      <div style={styles.field}><label htmlFor="objectStreet">Adresse des Objekts</label><input id="objectStreet" maxLength={180} style={styles.input} value={objectStreet} onChange={e=>setObjectStreet(e.target.value)} /></div>
      <div style={styles.field}><label htmlFor="objectPostal">PLZ des Objekts</label><input id="objectPostal" maxLength={20} style={styles.input} value={objectPostal} onChange={e=>setObjectPostal(e.target.value)} /></div>
      <div style={styles.field}><label htmlFor="objectCity">Ort des Objekts</label><input id="objectCity" maxLength={120} style={styles.input} value={objectCity} onChange={e=>setObjectCity(e.target.value)} /></div>
      <div style={{...styles.field,...styles.full}}><label htmlFor="description">Was soll gemacht werden? *</label><textarea id="description" required minLength={10} maxLength={5000} rows={4} style={styles.input} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Bitte beschreiben Sie die gewünschten Arbeiten möglichst genau." /></div>
      <div style={styles.field}><label htmlFor="dimensions">Maße / Größe</label><textarea id="dimensions" maxLength={1500} rows={3} style={styles.input} value={dimensions} onChange={e=>setDimensions(e.target.value)} /></div>
      <div style={styles.field}><label htmlFor="materials">Material / vorhandene Ausstattung</label><textarea id="materials" maxLength={1500} rows={3} style={styles.input} value={materials} onChange={e=>setMaterials(e.target.value)} /></div>
      <div style={{...styles.field,...styles.full}}><label htmlFor="effort">Zeitlicher Rahmen / Besonderheiten</label><textarea id="effort" maxLength={1500} rows={3} style={styles.input} value={effort} onChange={e=>setEffort(e.target.value)} /></div>
      <div style={{...styles.field,...styles.full}}><label htmlFor="photos">Fotos hinzufügen (optional, maximal 5 Bilder, je 4 MB)</label><input id="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" multiple style={styles.input} onChange={e=>setPhotos(Array.from(e.target.files||[]).slice(0,5))}/><span style={styles.hint}>{photos.length} Foto(s) ausgewählt. Fotos helfen uns bei der Einschätzung und Angebotserstellung.</span></div>
      <div aria-hidden="true" style={{position:"absolute",left:"-10000px",width:1,height:1,overflow:"hidden"}}><label htmlFor="website">Website</label><input id="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={e=>setHoneypot(e.target.value)}/></div>
      <label style={{...styles.field,...styles.full,display:"flex",flexDirection:"row",alignItems:"flex-start",fontWeight:400,lineHeight:1.5}}><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} style={{marginTop:4}}/><span>Ich bin damit einverstanden, dass meine Angaben und die hochgeladenen Fotos zur Bearbeitung dieser Anfrage verarbeitet werden. *</span></label>
      {message && <div role="alert" style={{...styles.full,padding:12,borderRadius:8,background:"#fff2e7",color:"#8b3c14",lineHeight:1.5}}>{message}</div>}
      <button type="submit" disabled={busy} style={{...styles.button,opacity:busy?.65:1}}>{busy?"Anfrage wird übermittelt …":"Anfrage verbindlich übermitteln"}</button>
      <p style={{...styles.hint,...styles.full,margin:0}}>Mit dem Absenden entsteht noch kein Auftrag und keine Zahlungsverpflichtung. Bitte übermitteln Sie keine sensiblen Dokumente oder Zahlungsdaten.</p>
    </form>
  </section></main>;
}
