# Verifiering av steg A

Genomfört lokalt 2026-09-30 med Node 24.21.0 och Next.js 16.3.8.

## Automatiska kontroller

- `npm run lint`: godkänd.
- `npm run typecheck`: godkänd.
- `npm run build`: godkänd; samtliga sidor byggdes.

Den byggda appen provades med lokalt installerad Playwright/Chromium mot
`http://127.0.0.1:3100`. Inga nya testberoenden installerades i projektet.
Kontrollskript och skärmbilder låg i den ignorerade byggmappen `.next/qa`.

## Kontrollerat i webbläsare

- Startsidan omdirigerar till rapportörens översikt.
- Genvägen för kompletteringar öppnar rätt statusvy.
- Statusval ändrar URL och aktiv markering. Valet överlever omladdning och bakåtnavigation.
- Ny rapport visar TMA/SOS som kommande, utan inmatning som riskerar att gå förlorad.
- Växling till administratörsvyn, granskningsstatus och faktureringsstatus fungerar.
- Okända och upprepade statusparametrar faller tillbaka till standardvyn.
- Svenska anges som sidans språk. Varje vy har ett huvudinnehåll och en huvudrubrik.
- Tab följt av Enter på ”Hoppa till innehållet” flyttar fokus till huvudinnehållet.
- Alla fem vyer ger HTTP 200 och ryms utan horisontell sidscroll vid 320, 390, 768
  och 1440 px bredd (20 kombinationer).
- En okänd adress ger HTTP 404 och den svenska felsidan.
- Inga JavaScript-fel rapporterades från webbläsaren under kontrollerna.
- Skärmbilder av rapportörens mobilvy och administratörens datorvy granskades visuellt.

## Kvar att verifiera senare

Fysisk telefon, fullständig skärmläsargranskning och andra webbläsare är inte testade.
Inloggning, företagsseparering och rapportflöde går inte att testa ännu eftersom de
byggs i kommande steg. Denna kontroll visar att projektgrunden fungerar; den styrker
inte någon datasäkerhet för en färdig tjänst.
