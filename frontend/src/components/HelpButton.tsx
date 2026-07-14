import { useState } from "react";
import { useTranslation } from "react-i18next";

const HELP_TEXT = `
**Willkommen bei deinem Grow & Seed Tracker!**

Um die App effizient zu nutzen, folge dieser Reihenfolge:

**1. Strain anlegen**
Lege zuerst alle Cannabissorten (Strains) an.
Trage Name, Breeder, Genetik, Effekte, Aroma, THC/CBD-Gehalt und Blütedauer ein.
→ Gehe zu Strains > "+ Anlegen"

**2. Samen eintragen**
Hinterlege zu jedem Strain die vorhandenen Samen mit Menge und Quelle.
→ Gehe zu Samen > Strain auswählen > "+ Hinzufügen"

**3. Grow anlegen & dokumentieren**
Starte einen neuen Grow mit Strain, Namen und Startdatum.
Dokumentiere Woche für Woche mit Notizen, Dünger, Gießverhalten, Licht und Temperatur.
Füge Bilder hinzu und erfasst am Ende die Ernte mit Gewicht.
→ Gehe zu Grows > "+ Anlegen"

---

**Suche**

Nur das Suchfeld auf dem Dashboard durchsucht alle Textfelder vollständig:
\u2022 Strains: Name, Breeder, Genetik, Genetic Origin, Effekte, Aroma, Beschreibung
\u2022 Grows: Name, Notizen, Medium, Beleuchtung, Nährstoffe, Datum

Gib einfach einen Begriff ein - die Ergebnisse erscheinen sofort.
`;

export default function HelpButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="help-btn" onClick={() => setOpen(true)} title={t("nav.help")}>?</button>
      {open && (
        <div className="help-overlay" onClick={() => setOpen(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <button className="help-close" onClick={() => setOpen(false)}>&times;</button>
            <div className="help-content">
              {HELP_TEXT.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <h2 key={i}>{line.slice(2, -2)}</h2>;
                }
                if (line.startsWith("- ")) {
                  return <li key={i} style={{ marginLeft: 20 }}>{line.slice(2)}</li>;
                }
                if (line.trim() === "") return <br key={i} />;
                return <p key={i}>{line}</p>;
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
