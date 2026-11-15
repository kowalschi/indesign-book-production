# navigare_v5.jsx – panoul de navigare pentru corecturile v5

Panou InDesign (fereastră *palette*) care te duce, una câte una, la corecturile din `corecturi_v5.csv`:
sare la pagina din `retetar-01-02.indd`, selectează textul greșit, arată corecția și observația
și deschide în Acrobat pagina corespunzătoare din originalul scanat (1962).
**Nu modifică textul** – corectura o faci tu, de mână; panoul doar te poartă prin listă și ține minte ce ai rezolvat.

```
corecturi_v5.csv ──► _lucru/verifica_v5.py           (control: se găsește fiecare text în PDF?)
        │
        └──────────► _lucru/genereaza_navigare_v5.py ──► indesign/v5_date.jsx ──► indesign/navigare_v5.jsx
                       ▲            ▲                                                 │        │
   retetar-01-02_v4.pdf (export)    _lucru/ocr*, date.js (originalul)           InDesign   Acrobat (COM)
```

---

## 1. Fișierele

| Fișier | Rol |
|---|---|
| `corecturi_v5.csv` | intrarea: lista de corecturi (în rădăcina proiectului) |
| `_work 2/retetar-01-02_v4.pdf` | PDF-ul exportat din `retetar-01-02.indd` pe care s-a făcut CSV-ul |
| `_lucru/ocr_firma/`, `_lucru/ocr/` | OCR-ul originalului scanat, câte un `pNNNN.json` pe pagină (1320 de pagini) |
| `_lucru/date.js` | datele lotului 1 – de aici se iau paginile din original ale rețetelor, pentru control |
| `_lucru/verifica_v5.py` | verifică textele din CSV în PDF (raport + `verifica_v5.json`) |
| `_lucru/genereaza_navigare_v5.py` | face `v5_date.jsx` |
| `indesign/v5_date.jsx` | datele pentru panou (generat – nu se editează de mână) |
| `indesign/navigare_v5.jsx` | panoul |
| `navigare_v5_config.txt` | (lângă script, creat singur) folderul cu `.indd` și folderul cu PDF-urile originalului |
| `navigare_v5_stare.txt` | (lângă script, creat singur) ID-urile bifate „rezolvat”, câte unul pe linie |

În folderul de scripturi al InDesign trebuie să stea împreună `navigare_v5.jsx` și `v5_date.jsx`
(scriptul face `#include 'v5_date.jsx'` din folderul lui).

---

## 2. CSV-ul de intrare

UTF-8, separator `;`, câmpuri între ghilimele. Antetul:

```
"ID";"Pagina";"Reteta";"Tip";"Text_cautat";"Context_inainte";"Context_dupa";"Corectie";"Observatii"
```

| Coloană | Ce conține | Folosit pentru |
|---|---|---|
| `ID` | cod unic (`v5-001`) | cheia stării „rezolvat” |
| `Pagina` | pagina din PDF = pagina tipărită = pagina din `.indd` | saltul în InDesign; maparea la original |
| `Reteta` | numărul rețetei (`113`, `1443/1`, `614 bis`), gol în afara rețetelor | alegerea apariției; pagina originalului |
| `Tip` | o valoare dintr-o listă fixă | filtrul din panou; reguli speciale la tabele |
| `Text_cautat` | textul greșit, copiat exact din PDF | textul selectat în InDesign |
| `Context_inainte` / `Context_dupa` | ~30 de caractere în jurul textului | departajarea aparițiilor |
| `Corectie` | forma corectă (poate lipsi) | afișare („Corect:”) |
| `Observatii` | explicația | afișare |

Condiția de bază: **pagina N din PDF trebuie să fie pagina N din `.indd`** (PDF-ul exportat integral, din prima pagină,
și fără pagini adăugate/scoase în document după export).

---

## 3. Verificarea (`verifica_v5.py`)

Pentru fiecare rând caută `Text_cautat` în textul paginii din `retetar-01-02_v4.pdf` (apoi pe paginile vecine) și raportează:
găsit pe pagină / pe o pagină vecină / negăsit, numărul de apariții și dacă numărul rețetei apare pe pagină.

Textul paginii e „curățat” înainte de căutare: se scot cratimele moi (U+00AD), caracterul `\x08` pe care InDesign îl pune
între titlul rețetei și număr devine spațiu, cuvintele despărțite la capăt de rând (`frămân-\ntă`) se lipesc,
spațiile multiple devin unul.

Ce nu se găsește se rezolvă în `genereaza_navigare_v5.py`, în dicționarele `CAUTA` (alt text de căutat) și `NOTA`
(explicația pusă în fața observației). La v5: `v5-024`, `v5-098`, `v5-122`.

---

## 4. Generarea datelor (`genereaza_navigare_v5.py` → `v5_date.jsx`)

```bash
cd "/d/work/retetar/proofing/_lucru" && python genereaza_navigare_v5.py
```

### 4.1 O intrare din `v5_date.jsx`

`v5_date.jsx` conține un singur tablou, `var RAMASE = [...]` (JSON, doar ASCII – diacriticele sunt scrise `\uXXXX`,
ca ExtendScript să-l citească fără probleme de codare). Câmpurile au aceleași nume ca în panoul vechi
(`navigare_ramase.jsx`), ca scriptul să rămână aproape identic:

| Câmp | Valoare | Din |
|---|---|---|
| `id` | `"v5-045"` | `ID` |
| `doc` | `0` (indice în `DOCUMENTE`; acum un singur document) | – |
| `dp`, `pag` | pagina în document | `Pagina` |
| `motiv` | tipul | `Tip` |
| `ret` | rețeta | `Reteta` |
| `c` / `r` | „Acum” / „Corect” | `Text_cautat` / `Corectie` |
| `com` | observația (cu `NOTA` în față, dacă e cazul) | `Observatii` |
| `gaseste` | textul căutat efectiv în InDesign | `Text_cautat` sau `CAUTA[id]` |
| `cb` / `ca` | ultimele 40 / primele 40 de caractere de context | `Context_inainte` / `Context_dupa` |
| `n` | câte apariții are `gaseste` pe pagină în PDF | calculat |
| `k` | a câta apariție (de la 0) e cea vizată; `-1` dacă e una singură | calculat |
| `orig` | pagina din originalul de 1320 de pagini; `0` = fără original | calculat |
| `parte` | fișierul OCR al originalului: 0, 1, 2; `-1` = fără original | `(orig-1) // 440` |
| `op` | pagina în acel fișier | `(orig-1) % 440 + 1` |

### 4.2 Alegerea apariției (`k`)

Când textul apare de mai multe ori pe pagină (de ex. „Sare” în două tabele), scriptul Python alege dinainte
apariția potrivită, pe textul din PDF. Fiecare apariție primește un scor:

- **+100** dacă e în rețeta din CSV – adică după antetul ei și înaintea antetului următor.
  Antetele se recunosc în textul PDF după tiparul `titlu\x08\nNUMĂR\n` (eventual `NUMĂR /1` sau `NUMĂR bis`);
  zona unei rețete începe de la titlu. Textul de la începutul paginii, de dinaintea primului antet, aparține rețetei
  de pe pagina anterioară;
- **−50** la tipurile „Tabel – …”, dacă apariția e în titlul rețetei (căutăm în tabel, nu în titlu);
- **+150** la „Tabel – celulă goală”, dacă după denumire rândul de tabel nu e complet
  (nu urmează *cantitate, unitate, cantitate*) – semnul cel mai sigur, mai puternic decât numărul rețetei;
- **+1 pentru fiecare caracter** de context care se potrivește (înainte și după).

Câștigă scorul cel mai mare; la egalitate, prima apariție. Rezultatul se scrie în `k`, iar numărul de apariții în `n`.

Căutarea respectă aceleași reguli ca în InDesign (funcția `regex()` din Python și `grep()` din JSX trebuie să numere la fel):
un număr se caută întreg (`5` nu se potrivește în `15` sau `5,5`), iar un cuvânt se caută până la capătul lui
(`Morcovi` nu se potrivește în `Morcovii`).

### 4.3 Pagina din original

Originalul scanat nu are text, dar are OCR (`_lucru/ocr_firma`, OCR-ul firmei, și `_lucru/ocr`, Windows OCR ro-RO).
Pagina din original se găsește **pe text**, nu pe numere:

1. textul fiecărei pagini OCR se normalizează și se taie în *shingles* (secvențe scurte de cuvinte consecutive –
   funcțiile `norm` și `shingles` din `potrivire.py`); se face un index *shingle → paginile originalului*;
2. pentru fiecare pagină din PDF-ul v4 se numără în ce pagină a originalului cad shingle-urile ei
   (doar cele rare – care apar în mai puțin de 5 pagini); dacă pagina câștigătoare are cel puțin 3 potriviri,
   ea devine o ancoră;
3. pagina originalului pentru o pagină v4 = mediana ancorelor din jur (3 înainte, 3 după) – asta netezește
   paginile cu puțin text sau numai cu tabele;
4. control: dacă rețeta e și în lotul 1 (`date.js`) și pagina găsită diferă cu peste 2 pagini de cea de acolo,
   se ia cea din `date.js` (la v5: un caz, `v5-154`).

Rândurile fără rețetă (titlu, prefață, cuprins) nu au corespondent în original: `orig = 0`, `parte = -1`.

Originalul e împărțit în 3 PDF-uri OCR de câte 440 de pagini
(`Pages from retetar_general_de_preparate_Partea_I/II/III_OCR.pdf`, în `pdf ocr original desparti in 3`),
de aici `parte` și `op`.

---

## 5. Panoul (`navigare_v5.jsx`)

### 5.1 Pornire

- `#targetengine 'navigareV5'` – scriptul rulează într-un engine persistent, deci fereastra *palette* rămâne deschisă
  și funcțională cât lucrezi în document;
- citește `navigare_v5_config.txt`. La prima rulare, dacă acesta lipsește, preia folderul PDF-urilor din
  `navigare_config.txt` (panoul vechi), apoi cere cu `Folder.selectDialog` ce lipsește și verifică dacă fișierele
  așteptate chiar sunt în folder;
- citește `navigare_v5_stare.txt` (ID-urile rezolvate);
- construiește lista de tipuri pentru filtru din câmpurile `motiv`.

### 5.2 La selectarea unei intrări (`lb.onChange`)

1. **`afiseaza(x)`** – scrie detaliile în casetă: ID, rețeta, tipul, pagina, pagina din original, Acum / Corect,
   observațiile și, dacă diferă de „Acum”, textul căutat efectiv;
2. **`du(x)`** – în InDesign:
   - deschide `retetar-01-02.indd` (sau îl refolosește, dacă e deschis – comparație pe calea completă),
     îl face activ, sare la pagina `dp`, zoom pe pagină;
   - **`gaseste(x, d, off)`** – caută textul cu GREP (`app.findGrepPreferences.findWhat = grep(x.gaseste)`)
     în cadrele de text ale paginii, ordonate de sus în jos și de la stânga la dreapta:
     1. dacă `n > 1`, `k >= 0` și pe pagină sunt **exact `n` apariții**, o ia pe a `k`-a
        (stare: „ales după rețetă”);
     2. altfel caută pe pagină și pe cele două vecine și alege după context (`cb`/`ca`, cu penalizare de 15
        pentru fiecare pagină de distanță) – stare: „ales după context”;
     3. dacă tot nu găsește, încearcă doar primul cuvânt („Găsit doar începutul”);
   - selectează textul găsit (`app.select`) și scrie rezultatul în bara de stare;
3. **`trimiteOriginal(x)`** – dacă e bifat „arată și originalul”, trimite Acrobat la pagina din original (vezi 6).

`grep()` transformă textul în expresie GREP InDesign: caracterele non-ASCII și ghilimelele devin `\x{XXXX}`,
caracterele speciale se escapează, spațiile devin `\s+` (după cratimă `\s*`), cratimele moi se ignoră,
plus regulile de număr întreg / cuvânt întreg de la 4.2.

### 5.3 Butoane

| Buton | Ce face |
|---|---|
| `< Inapoi` / `Inainte >` | intrarea anterioară / următoare din listă (declanșează `onChange`) |
| `Du-ma din nou` | repetă doar `du(x)` |
| `Original` | repetă `trimiteOriginal` și aduce fereastra Acrobat în față |
| `Foldere...` | alegi din nou folderele (se salvează în config) |
| `Rezolvat` / `Nerezolvat` | comută starea, o scrie imediat în `navigare_v5_stare.txt`; la „rezolvat” trece la următoarea |

Filtrul „doar nerezolvate” ascunde intrările bifate (păstrând-o pe cea curentă, ca să nu sară lista).

---

## 6. Comunicarea cu Adobe Acrobat

InDesign nu poate vorbi direct cu Acrobat din ExtendScript, așa că scriptul construiește un **VBScript**
și îl rulează cu `app.doScript(vbs, ScriptLanguage.VISUAL_BASIC)` (doar pe Windows). Valoarea din `returnValue`
ajunge înapoi în JSX ca rezultat al lui `doScript`.

**Cazul rapid – PDF-ul e deja deschis în Acrobat** (prin COM, interfața `AcroExch`, care există doar în Acrobat Pro,
nu în Reader):

```vb
Set acro = CreateObject("AcroExch.App")
For i = 0 To acro.GetNumAVDocs() - 1           ' documentele deschise
  Set av = acro.GetAVDoc(i)
  If StrComp(av.GetPDDoc().GetFileName(), "<numele fișierului>", 1) = 0 Then
    av.GetAVPageView().GoTo <op - 1>           ' paginile COM încep de la 0
    av.GetPDDoc().GetJSObject().bringToFront   ' face tabul activ
    av.BringToFront                            ' doar la butonul Original: fereastra în față
    gasit = True : Exit For
  End If
Next
If Not gasit Then <cazul lent>
returnValue = gasit
```

**Cazul lent – PDF-ul nu e deschis** (sau COM nu răspunde): pornește Acrobat din linia de comandă și **nu așteaptă**:

```vb
CreateObject("WScript.Shell").Run """C:\...\Acrobat.exe"" /A ""page=<op>"" ""<cale PDF>""", 1, False
```

Bara de stare spune atunci „se deschide în Acrobat, poate dura câteva minute; apoi apasă Original”.
De la a doua intrare încolo, PDF-ul e deja deschis și saltul e instantaneu.

Lucruri aflate pe parcurs (de ce e făcut așa):

- `AVDoc.GetTitle()` dă titlul ferestrei Acrobat (al tabului activ), **același pentru toate tab-urile** – de aceea
  documentul se recunoaște după `GetPDDoc().GetFileName()`;
- `AVDoc.BringToFront` nu schimbă tabul activ; `GetJSObject().bringToFront` da;
- **nu** se folosește `AVDoc.Open` pe PDF-urile originalului (~1 GB fiecare): blochează InDesign minute întregi
  și poate eșua; nici `FindText` (≈11 s pe căutare);
- calea spre Acrobat e fixă în script: `ACROBAT = 'C:/Program Files/Adobe/Acrobat Pro DC/Acrobat/Acrobat.exe'`.

---

## 7. Limite cunoscute

- Totul se bazează pe pagini: dacă documentul se repaginează după exportul PDF, saltul ajunge lângă greșeală
  (se caută și pe paginile vecine, dar nu mai departe). Soluția: reexport PDF, apoi
  `verifica_v5.py` + `genereaza_navigare_v5.py`.
- `k` e valabil doar dacă InDesign găsește pe pagină tot atâtea apariții ca PDF-ul; altfel decide contextul.
- Comunicarea cu Acrobat merge doar pe Windows, cu Acrobat Pro instalat.
- Numele fișierelor (document, PDF-uri OCR) și împărțirea originalului în 3 × 440 de pagini sunt fixe în script.

---

## 8. Spre un script general

Pentru varianta care se aplică pe **documentul curent**, cu **un CSV** și **PDF-ul original scanat** ca intrare,
ce e acum specific v5 trebuie scos din cod:

| Acum (v5) | General |
|---|---|
| `DOCUMENTE = ['retetar-01-02.indd']`, folder cerut | `app.activeDocument` |
| datele pregătite în Python (`v5_date.jsx`) | CSV-ul citit direct în JSX (`File.open`, parsare `;` + ghilimele) – sau Python păstrat ca pas opțional |
| `k` calculat pe PDF-ul exportat | calculat în InDesign, pe documentul însuși: antetele rețetelor căutate cu GREP / după stilul de paragraf al titlului |
| pagina originalului din OCR + shingles | o coloană în CSV (`Pagina_original`) sau o hartă *rețetă → pagină* dată o dată; OCR-ul rămâne un pas separat, făcut dinainte |
| originalul împărțit în 3 PDF-uri fixe | o listă de fișiere cu intervalul de pagini al fiecăruia (sau un singur PDF) |
| calea Acrobat fixă | detectată / aleasă o dată și ținută în config |
| stare în `navigare_v5_stare.txt` lângă script | stare per CSV (numele CSV-ului în numele fișierului de stare) |
| lista de tipuri din date | la fel – se construiește din coloana `Tip` |

Partea de Acrobat (secțiunea 6) și căutarea GREP (`grep()`, `gaseste()`) se pot păstra aproape neschimbate.
