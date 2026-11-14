# Beveiliging

## Uitgangspunten
- Geheimen (API-sleutels, tokens, telefoonnummers) komen nooit in deze repository. Ze staan alleen in omgevingsvariabelen op de server.
- Inkomende webhooks worden gecontroleerd op de handtekening van WhatsApp voordat er iets mee gebeurt.
- Inhoud van berichten wordt niet bewaard en niet gelogd.
- Afhankelijkheden worden actueel gehouden.

## Per ongeluk een geheim gepubliceerd?
Trek de sleutel direct in en maak een nieuwe aan. Een geheim verwijderen uit de code is niet genoeg: het blijft in de geschiedenis van Git staan.

## Een kwetsbaarheid melden
Meld beveiligingsproblemen via een [privé security-advies op GitHub](https://github.com/freed-cloud/Factcheckbot/security/advisories/new), niet in een openbaar issue.
