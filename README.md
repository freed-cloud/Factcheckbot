# Factcheckbot

**Een Nederlandstalige WhatsApp-bot die berichten op juistheid controleert.**

> Status: in ontwikkeling. Deze repository bevat het plan; de code volgt stap voor stap.

## Het idee
In familie- en vriendengroepen gaan veel berichten rond die niet kloppen: nepnieuws, oude foto's in een nieuwe context, verzonnen cijfers. De meeste mensen hebben geen tijd of zin om dat uit te zoeken. Met de Factcheckbot stuur je zo'n bericht door naar één WhatsApp-nummer en krijg je binnen korte tijd een kort, eerlijk antwoord in gewoon Nederlands, met de bronnen erbij.

## Hoe het gaat werken
1. Je stuurt een bericht of bewering door naar de bot.
2. De bot haalt de controleerbare beweringen uit het bericht.
3. Per bewering zoekt de bot naar betrouwbare bronnen en factchecks.
4. Je krijgt een antwoord: *klopt*, *klopt niet*, *misleidend* of *niet te controleren*, met een korte uitleg en links naar de bronnen.

## Geplande techniek
- WhatsApp Business Cloud API (webhook voor inkomende berichten)
- Een kleine server die de webhook afhandelt
- Een taalmodel (AI) om beweringen te herkennen en het antwoord te formuleren
- Gebouwd met hulp van Claude Code

## Beveiliging en privacy (vanaf het begin)
- **Geen geheimen in de code:** API-sleutels en tokens staan alleen in omgevingsvariabelen, nooit in deze repository. `.gitignore` blokkeert `.env`-bestanden.
- **Echte berichten van WhatsApp:** elke inkomende webhook wordt gecontroleerd met de handtekening (`X-Hub-Signature-256`). Nep-verzoeken worden geweigerd.
- **Zo min mogelijk bewaren:** berichten worden alleen verwerkt om het antwoord te maken en daarna niet opgeslagen. Telefoonnummers komen niet in logbestanden.
- **Misbruik beperken:** een limiet op het aantal berichten per nummer per uur.
- **Eerlijk over onzekerheid:** de bot zegt het als iets niet te controleren is, in plaats van een antwoord te verzinnen.

Zie ook [SECURITY.md](SECURITY.md).

## Roadmap
- [ ] Webhook opzetten en echtheid van berichten controleren
- [ ] Beweringen herkennen in een doorgestuurd bericht
- [ ] Bronnen zoeken en beoordelen
- [ ] Antwoord in eenvoudig Nederlands met bronnen
- [ ] Limiet per gebruiker
- [ ] Testen met een kleine groep

Gemaakt door Freddy den Haan – [portfolio](https://freed-cloud.github.io/)
