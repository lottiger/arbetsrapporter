# Arkitektur och nästa byggsteg

## Läget efter inloggningssteget

Det öppna huvudprojektet används: Next.js 16.3.8, React 19.2.8, TypeScript,
Tailwind CSS 4 och App Router under `src/app`. Zip-prototypen är inte importerad.

Implementerat: separata layouter för rapportör och administratör, navigation,
statusval i webbadressen, tomma listvyer, svensk metadata, tangentbordsfokus och
responsiv layout. Gemensamma komponenter ligger i `src/components`.
Sidorna är Server Components; bara aktiv huvudnavigation behöver klientkod.
Systemets lokala typsnitt används så att bygget inte behöver hämta Google Fonts.

Better Auth-inloggning och MongoDB-lagring för konton, sessioner, företag och
medlemskap är nu implementerade. Arbetsytorna kontrollerar aktivt medlemskap och
roller på servern. Den gamla växlingen i förhandsvisningen är ersatt av kontonavigation.
Företagsnamn kan sparas av företagsadministratören med en historikhändelse i samma
transaktion. Företagsval och företags-API är testade med två separata testföretag.
Se [verifieringen av inloggningssteget](verifiering-steg-b.md) för vad som faktiskt testats.

2026-10-02: Mallarna **Underlag TMA** och **Bärgningsbesked/underlag** är inlagda utifrån
originalblanketterna. Malldefinitionerna ligger i `src/domain/templates/` och är deklarativa:
sektioner, fält med typ och krav samt tre regeltyper (tidsspann, villkorat krav och minst ett
av flera fält). `npm run templates:publish` publicerar dem per företag till `templates` och
`templateVersions`; en ändrad definition ger en ny version och publicerade versioner ändras
aldrig. Rapportören ser företagets mallar under Ny rapport och kan fylla i och kontrollera
formuläret; administratören ser fält och regler under Mallar. Arbetad tid beräknas även över
midnatt och visas bredvid debiterbara timmar.

2026-10-19: Utkast och direkt inskick finns för båda mallarna. Rapportören kan skicka in
direkt eller spara ofullständiga utkast för att fortsätta senare. Inskick kontrolleras på servern mot rapportens
ursprungliga mallversion och skapar en oföränderlig version med mall, svar, företagsnamn,
verifierad aktör, tid, beräkningar och varningar. Status, version och historikhändelse sparas
i samma transaktion. Versionsräknaren `revision` hindrar att samtidiga ändringar skriver
över varandra. Upprepad skapning med samma ID skriver inte över befintliga svar.

Rapportörens listor avgränsas till eget konto och valt företag. Granskaren ser endast
inskickade rapporter i sitt företag och kan läsa dem. API och sidor kontrollerar session,
aktivt medlemskap, roll och ägarskap. Inskickade rapporter kan inte redigeras.
Kundregister och bilder återstår. Komplettering och godkännande tillkom 2026-10-19, se nedan.
Se [rapportflödets verifiering](verifiering-steg-c.md).

2026-10-18: Enligt användarens ändrade önskemål fylls tidsfältet nu i automatiskt
från mallens tidsregel (inklusive eventuell rast). Användaren kan skriva över värdet
och välja **Använd beräknad tid** för att återgå till automatisk beräkning. Valet sparas
som `automaticTimeFields` tillsammans med utkastet och den inskickade versionen.
Servern räknar om fält som står i automatiskt läge före sparande och inskick. Äldre
utkast med ett ifyllt tidsfält behåller sitt värde som manuellt tills användaren väljer
automatik. Publicerade mallar och tidigare inskickade rapporter ändras inte.

2026-10-19: Komplettering, nya inskickade versioner och godkännande är implementerade.
En begäran om komplettering kräver en trimmad kommentar på högst 2000 tecken. Rapportören
kan spara ändringar och skicka in igen; granskaren ser den tidigare inskickade versionen
tills det nya inskicket är klart. Beslut kräver både aktuell `revision` och exakt
`versionId`. Beslut, status och historikhändelse sparas i samma transaktion.

Användaren har beslutat att en företagsadministratör **får godkänna egna rapporter**.
Enbart rapportörs- eller faktureringsrollen räcker inte. Godkännande sparar aktör,
tid och versionsreferens och sätter faktureringsstatus till `ready`. Faktureringsansvarig
kan läsa godkända versioner; administratören kan även granska och läsa tidigare versioner.

2026-10-19: Användaren vill avvakta med PDF och kunna markera **Helt klar**, som betyder
administrerad i bokföringssystemet. Knappen **Markera som inlagd** finns för administratör
och faktureringsansvarig på godkända kort och på detaljsidan. Kortet blir grönt med
texten **Inlagd / helt klar** och visas i **Alla** och **Helt klara**. `billingHandled` sparar verifierad
användare, tid och godkänd version. Händelsen `billing_handled` sparas i samma transaktion.

Efter användarens förenkling finns en gemensam menyflik och arbetsyta, **Fakturaunderlag**,
på `/admin/fakturaunderlag`. De tidigare sidorna för granskning och faktureringsunderlag
är borttagna; gamla länkar omdirigeras, inklusive versionsparametrar. Listan har tre filter:
**Alla**, **Att hantera** och **Helt klara**. Förklaringsrutan och checkbox-steget är borttagna.
Administratören ser inskickade rapporter, begärda kompletteringar och godkända rapporter.
Faktureringsrollen ser endast godkända rapporter och kan klarmarkera dem. Serverns separata
behörighetskontroller för granskning och fakturering används av den gemensamma vyn.

## Verifierade krav från briefen

- Flera företag ska vara åtskilda även vid direkta serveranrop och ändrade ID:n.
- Rapportören arbetar med egna rapporter; administratören granskar företagets.
- Inskickad rapport är låst. Komplettering kräver en kommentar och öppnar rapporten
  för rapportören. Nytt inskick går tillbaka till granskning.
- Tidigare versioner och kommentarer bevaras med vem och när.
- Faktureringsstatus hålls separat från rapportstatus.
- Mallar tillhör företag och versionsstyrs. Gamla rapporter behåller sin mallversion.
- TMA ska kunna hantera tid över midnatt. Beräknad tid får inte tyst ersätta angiven
  debiterbar tid.
- PDF ska använda en sparad, godkänd version. Fortnox-integration kommer senare.

2026-10-20: Synliga mall- och rapportversionsnummer har tagits bort. Historiken visar
inskick med datum, tid och rapportör; tidigare inskick går fortfarande att öppna.
Godkännandeknappen heter **Godkänn rapport**. Tekniska publiceringsinstruktioner visas
enbart i utvecklardokumentationen och Next.js utvecklingsindikator är avstängd.

## Val av inloggning och lagring i steg B

2026-10-02: Better Auth är valt och en ny, separat testdatabas i MongoDB Atlas är
beslutad. Better Auth 1.7.7, dess MongoDB-adapter 1.7.7 och MongoDB-drivrutinen 7.7.0
är installerade. Auth-API, inloggning/utloggning, företagsval, serverkontroller och
databasanslutning är inkopplade. `npm run admin:create` skapar ett nytt företag och
dess första administratör från den lokala operatörsterminalen.
Se [integrationsguiden](integration-guide.md) för nästa steg.

Inloggningen använder e-post/lösenord med databaslagrade sessioner.
Biblioteket hanterar lösenord och sessioner. Företagsmedlemskap och roller hanteras
i appens serverkod. Atlas-testdatabasen är ansluten; ingen produktionsmiljö används.
Better Auths globala administratörsplugin används endast i lokalt provisioneringskommando
och är inte monterad i webb-API:t. Företagsadministratörer får företagsbundna roller.

Better Auth beskriver [e-post/lösenord](https://better-auth.com/docs/authentication/email-password)
och sin [MongoDB-adapter](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/adapters/mongo.mdx).
Next.js rekommenderar att behörighetskontroller samlas nära dataåtkomsten i sin
[guide om autentisering](https://nextjs.org/docs/app/guides/authentication).
Paketversionernas kompatibilitet och adapterkonfigurationen har verifierats mot Atlas.

- Konton provisioneras av behörig administratör. Ingen öppen självregistrering.
- Sessionen verifieras på servern. Cookies hanteras av authbiblioteket med HttpOnly,
  SameSite och Secure i HTTPS-miljö. Inloggning ska ha begränsning av upprepade försök.
- Ett aktivt företag måste motsvara ett aktivt medlemskap. Ett företags-ID från
  URL eller formulär är aldrig bevis på behörighet.
- Rollerna är `reporter`, `company_admin` och `billing`. En person kan ha flera roller.
  `system_admin` är en separat systembehörighet för anslutning och mallkonfiguration,
  utan automatisk åtkomst till alla företagsrapporter.
- Bestäm kontoprovisionering, återställning och eventuell befintlig Microsoft-inloggning
  med första företaget innan inloggningslösningen låses för pilot.
- Session, medlemskap och roll kontrolleras vid varje skyddad operation. En spärrad
  användare får inte fortsatt åtkomst via en äldre sessionscookie.

## Förslag: MongoDB och företagets datagräns

Använd en databas med företagsbundna samlingar. Företagskopplingen är obligatorisk i
varje affärsdokument. Inloggningsbibliotekets användare och sessioner är globala;
åtkomst till affärsdata kräver dessutom medlemskap.

| Samling | Innehåll och avgränsning |
| --- | --- |
| `organizations` | Företagets identitet och inställningar. |
| `memberships` | `organizationId`, `userId`, roller, aktiv/spärrad. Unikt par företag + användare. |
| `customers` | `organizationId`, kunduppgifter, valfritt framtida `fortnoxCustomerId`. |
| `templates` | `organizationId`, rapporttyp och referens till publicerad mallversion. |
| `templateVersions` | `organizationId`, `templateId`, versionsnummer, fält, regler och beräkningsversion. Publicerade versioner ändras inte. |
| `reports` | `organizationId`, skapare, kundreferens, mallversionsreferens, utkast, rapportstatus, låsversion, referens till inskickad/godkänd version, separat faktureringsstatus. |
| `reportVersions` | `organizationId`, `reportId`, versionsnummer, sparade svar, mallversion och snapshot av företag/kund, aktör och tid. Oföränderliga inskickade versioner. |
| `reportEvents` | `organizationId`, `reportId`, händelse, version, aktör, tid och eventuell kommentar. Händelser läggs till; tidigare händelser skrivs inte över. |

Förslag på serverstruktur för steg B och C:

```text
src/server/auth/         session och behörighetskontext
src/server/db/           anslutning och index
src/server/repositories/ alla företagsavgränsade databasfrågor
src/server/reports/      validering och statusövergångar
src/domain/             domäntyper utan databas- eller klientberoende
```

Servermoduler markeras `server-only`. Varje repository får ett serververifierat
sammanhang med användare, företag och roller, aldrig bara ett fritt företags-ID.
Läsning och ändring av rapport använder både `_id` och `organizationId` i frågan.
Rapportören avgränsas dessutom till `createdBy = currentUserId`.
Kund-, mall- och versionsreferenser kontrolleras mot samma företag.
Listor, historik, summeringar och PDF följer samma datagräns.
Server Actions och Route Handlers kontrollerar identitet, medlemskap, roll och
indata; en skyddad layout eller dolda knappar räcker inte.

Index börjar med `organizationId` där frågan är företagsbunden. Unika index för
mall- och rapportversioner inkluderar företag och versionsnummer. Kontrollerad
versionsräknare används vid ändringar för att upptäcka samtidig redigering.
Ingen gemensam cache för företagsdata införs i första flödet.

Status, ny rapportversion och historikhändelse ska sparas atomiskt i en transaktion.
Den föreslagna lagringen kräver därför MongoDB med stöd för transaktioner, även lokalt
(exempelvis en lokal replica set; se [MongoDB:s transaktionskrav](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)). Vi går igenom databasval och konfiguration innan
någon anslutning görs. Saknad konfiguration ska stoppa skyddade operationer tydligt;
den får aldrig ge en tyst reservlösning med demoidentitet eller publik data.

## Statusövergångar

Alla rapportövergångar i tabellen nedan är implementerade. Faktureringsstatus är
`not_ready` före godkännande och ändras till `ready` vid godkännande.

Behåll briefens fyra rapportstatusar. Spara varje inskick som en oföränderlig version.
Vid komplettering utgår ett redigerbart utkast från föregående version, som bevaras.

| Från | Händelse | Till | Serverkrav |
| --- | --- | --- | --- |
| Ny rapport | Skicka in direkt | `submitted` | Rapportör; aktuell publicerad mall i rätt företag; full validering. Rapport, version 1 och inskickshändelse skapas i samma transaktion. |
| `draft` | Spara utkast | `draft` | Rapportens ägare; rätt företag. Partiellt ifyllda svar tillåts. |
| `draft` | Skicka in | `submitted` | Ägare; validering mot rapportens publicerade mallversion; ny snapshot. |
| `submitted` | Begär komplettering | `needs_completion` | Företagsadministratör; kommentar med innehåll efter trimning; referens till granskad version. |
| `needs_completion` | Spara komplettering | `needs_completion` | Ägare; tidigare versioner och kommentarer bevaras. |
| `needs_completion` | Skicka in igen | `submitted` | Ägare; ny validering och ny snapshot; nytt inskick loggas. |
| `submitted` | Godkänn | `approved` | Företagsadministratör; precis den inskickade version som granskats. |

Direkt inskick använder `POST /api/foretag/[id]/rapporter/skicka-in`. Ogiltiga uppgifter
skapar inga dokument. Klientens stabila rapport-ID gör återförsök säkra: ett befintligt
utkast eller inskick skrivs aldrig över av upprepad skapning. Svaret anger `created: false`
och aktuell status; formuläret behåller lokala ändringar och erbjuder att öppna rapporten.

Andra övergångar avslås. `submitted` och `approved` kan inte redigeras normalt.
Vid samtidig ändring ska anropet misslyckas med konflikt så att granskaren får läsa
den aktuella versionen. Dubbelklick får inte skapa dubbla versioner eller händelser.
Eventuell rättelse efter godkännande kräver ett separat beslut och flöde senare.

### Separat faktureringsstatus

Implementerat: `not_ready` före godkännande, `ready` vid godkännande och `handled`
när faktureringsansvarig eller administratör markerar underlaget som helt klart i
bokföringssystemet. Rapportstatus förblir `approved`. API:t kräver `confirmed: true`,
aktuell `revision` och referens till godkänd version. Endast övergången `ready` till
`handled` tillåts. Aktör, tid och version sparas med en historikhändelse i samma
transaktion. Upprepade eller samtidiga anrop kan inte ändra den första markeringen.
En återställning eller referens till bokföringssystemet är inte implementerad.
PDF-hämtning ska inte ändra faktureringsstatus. En framtida export behöver dessutom
en unik exportnyckel så att upprepade försök inte ger dubbla överföringar.

## Mallarna och vad som återstår att verifiera

Fältuppsättningen följer originalblanketterna. Så här är de tolkade i version 1:

| Underlag | Beslut i version 1 |
| --- | --- |
| TMA | Regnr TMA-bil, datum, kund, märkning, vägnummer, arbetsplats, start- och sluttid, rast i minuter, debiterbara timmar, kontroll före avfärd (ja/nej), arbetsuppgifter, avvikelser, tillbud (ja/nej) med obligatorisk beskrivning vid ja, samt namn. Pappersunderskriften ersätts av den inloggade rapportören vid inskick. |
| TMA-tid | Klockslag utan datum; sluttid före starttid tolkas som nästa dygn. Arbetad tid = spann minus rast, avrundad till högst två decimaler. Lika start- och sluttid ger en varning. Debiterbara timmar fylls automatiskt i och kan ändras manuellt. Avvikelse mot arbetad tid ger en varning men blockerar inte. |
| Bärgning | Kund, förare, telefon, person-/orgnr, körkort 4d, försäkringsbolag, självrisk, skadenummer, fakturamail, regnr bil och/eller släp, objekt/märke, fordonstyp, last i ton, bruttovikt, mätarställning, olycksplats, bärgad till/KPP, datum, förare bärgaren, extra man, tiderna start, ankomst, lastad, utfört/KPP och åter station, använd tid, total körsträcka, orsak (flerval, annan orsak kräver text), uppdrag (flerval) och övrig information. |

| Underlag | Behöver fortfarande verifieras |
| --- | --- |
| TMA-tid | Om avvikelse mellan arbetad och debiterbar tid ska kräva en förklaring för att kunna skickas in, samt jobb längre än ett dygn (hanteras i dag som högst 24 timmar). |
| Bärgning | Enheten för bärgad bruttovikt (sparas som text tills vidare), baksidan för utlandskund, och om bilder ska vara obligatoriska. |
| Bärgning-belopp | Uppställningsdygn, transport, kranbil och skrotning skrivs i dag i övrig information som på pappret. Strukturerade kostnadsrader kräver verifierade prisregler, valuta, moms och avrundning. |

Mallar ska först konfigureras internt med sektioner, fälttyper, etiketter, obligatoriska
fält och tillåtna validerings-/beräkningsregler. Publicering valideras på servern.
Ingen godtycklig JavaScript från en mall får köras. Belopp ska hanteras som exakta
decimaler eller heltal i minsta valutaenhet efter att pris- och momsregler verifierats.
Originalens namn, registreringsnummer och priser ska inte användas som produktdata.

## Genomfört och nästa vertikala steg

1. Atlas-testdatabasen är ansluten och inloggning, kontoprovisionering och medlemskap finns.
2. Befintliga arbetsytor och företagsoperationer har serverkontroller.
3. Två fiktiva företag har använts för att testa ändrade ID:n, direkta API-anrop,
   otillåten roll, saknad session och spärrat/borttaget medlemskap. Testdata är rensad.
4. Första administratörskontot är skapat lokalt. Mallarna för TMA och bärgning är publicerade
   för företaget och formuläret kan fyllas i och kontrolleras; se verifieringen nedan.
5. Användar-/rolladministration på webben och återställning av lösenord återstår i steg B.
6. Utkast, inskick, komplettering med kommentar, versionshistorik, godkännande och
   läsvy för faktureringsunderlag är byggda och testade med ändrade ID:n, olika roller
   i samma företag och separata företag. Administratörer får godkänna egna rapporter.
7. Klarmarkering efter administration i bokföringssystemet är implementerad och testad.
   PDF avvaktar enligt användarens beslut.

Verifierat 2026-10-02 för mallsteget: `npm run test:templates` (sex tester, bland annat
22:30–00:30 = 2 h över midnatt och att avvikande debiterbara timmar behålls med varning),
`npm run typecheck`, `npm run lint` och `npm run build`. Mot den lokala dev-servern och
Atlas-testdatabasen verifierades med ett tillfälligt företag att publicering ger version 1,
att ompublicering utan ändring lämnar mallarna orörda, att Ny rapport listar båda mallarna,
att formulären renderar 16 respektive 33 fält, att okänd mall ger 404, att Mallar visas för
företagsadministratör, att anonym åtkomst omdirigeras och att ett främmande företags-ID
nekas. Testföretaget och dess mallar rensades efteråt.

Databasuppgifter sparas lokalt i `.env`/`.env.local`, aldrig i klientkod, chattexempel
eller Git. `.env.example` innehåller platshållare och ofarliga lokala standardvärden.
Ingen publicering har gjorts. Atlas-behörigheten bör begränsas till appdatabasen före pilot.
