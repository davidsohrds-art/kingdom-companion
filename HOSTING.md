# Hosting – Kingdom Companion 0.8

Dieses Paket ist für eine einzelne Node.js-Instanz mit persistentem Speicher vorbereitet. Es ist keine bereits veröffentlichte App.

1. Die Dateien aus diesem Ordner als Projektquellcode in Railway bereitstellen (Dockerfile im Stammverzeichnis).
2. Vor dem Start ein dauerhaftes Volume unter `/data` einbinden. `DATA_FILE=/data/rooms.json` setzen. Ohne Volume können Chat, Konten und Allianz-Daten bei einem Neustart verloren gehen. Keine zweite Replik starten: JSON-Dateien sind nicht für parallele Instanzen vorgesehen.
3. Über die Hosting-Einstellungen eine HTTPS-Domain generieren; die Plattform stellt TLS bereit. `/healthz` liefert HTTP 200, wenn der Prozess läuft. Der Endpunkt prüft nicht die dauerhafte Speicherbarkeit.
4. Zunächst nur mit einer kleinen, eingeladenen Gruppe unter Zugriffsschutz testen. Mit zwei verschiedenen Konten Chat, Servertrennung, Allianzrechte, Neustart und Datenerhalt prüfen.
5. Vor offener Registrierung: Kontolöschung, Wiederherstellung, Moderation, Missbrauchsschutz, Datenschutz/Impressum, Backup und Sicherheitsprüfung ergänzen. Die vorhandene Anmeldung ist ein Prototyp; Spielidentitäten sind nicht verifiziert. Kosten des Hostings/Volumes vor Buchung prüfen.

Lokal: `npm test`, `npm start`. Es werden keine npm-Abhängigkeiten benötigt. Die Docker-Konfiguration wurde vorbereitet, aber kein Cloud-Deployment oder Docker-Build durchgeführt.
