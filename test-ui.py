from playwright.sync_api import sync_playwright
from pathlib import Path
s=Path(__file__).resolve().parent.joinpath('public/index.html').read_text()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':390,'height':844}); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 # Inline preview with simulated storage, force standalone file mode by using actual file navigation if allowed
 try: page.goto(Path(__file__).resolve().parent.joinpath('public/index.html').as_uri(),timeout=5000)
 except Exception as e:
  print('file navigation:',str(e)[:220]);page=b.new_page(viewport={'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)));page.evaluate('''() => { const data = {}; for(const key of ['localStorage','sessionStorage']) Object.defineProperty(window,key,{value:{getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>delete data[k]}}); }''');page.set_content(s)
 if not page.locator('#heroGeneration').count(): raise RuntimeError('missing generator '+str(errors))
 names=page.locator('#eventPicker button').all_text_contents();print('eventPicker',names)
 # actual picker ID from JS
 print(page.evaluate('pick.id'))
 picker='#'+page.evaluate('pick.id')+' button'; count=page.locator(picker).count();assert count==9,count
 for n in range(1,11):
  page.locator('#heroGeneration').select_option(str(n))
  for i in range(count):
   page.locator(picker).nth(i).click();assert page.locator('[aria-label="Editierbarer Einsatzplan"]').input_value().strip(); assert page.locator('[aria-label="Editierbarer Einsatzplan"]').input_value().startswith('GEN ')
 print('90 event-generation combinations')
 page.locator(picker).first.click(); page.locator('#heroGeneration').select_option('1');assert page.get_by_label('Skillstufe Margot').count()==0
 page.get_by_label('Skillstufe Chenko').select_option('5');page.get_by_label('Skillstufe Amane').select_option('4');page.get_by_role('button',name='Meine verfügbaren Helden in Plan ergänzen').click();assert 'Chenko (Skill 5)' in page.get_by_label('Editierbarer Einsatzplan').input_value()
 page.get_by_label('Editierbarer Einsatzplan').fill('Falle 1 eigener Plan');page.get_by_label('Bärenfalle wählen').select_option('2');assert 'BÄRENFALLE 2' in page.get_by_label('Editierbarer Einsatzplan').input_value();page.get_by_label('Editierbarer Einsatzplan').fill('Falle 2 eigener Plan');page.get_by_label('Bärenfalle wählen').select_option('1');assert page.get_by_label('Editierbarer Einsatzplan').input_value()=='Falle 1 eigener Plan'
 page.locator(picker).nth(1).click();page.get_by_role('button',name='Welle 20',exact=True).click();assert page.get_by_text('Welle 20 · HQ',exact=True).count()==1
 assert not errors, errors
 print('personal skills, generation filter, trap separation, wave 20: OK; no page errors')
 page.locator('[data-tab="lab"]').click();page.get_by_label('Labor-Staffel').select_option('1');assert page.get_by_label('Besitz Margot').count()==0
 page.get_by_label('Besitz Howard').check();page.get_by_label('Sterne Howard').select_option('4');page.get_by_label('Besitz Jabel').check();page.get_by_label('Besitz Quinn').check();assert 'Howard (Referenzkandidat)' in page.locator('#labContent').inner_text()
 page.get_by_label('Einsatzrolle').select_option('bearJoin');assert 'Chenko (Skill 5)' in page.locator('#labContent').inner_text()
 page.locator('[data-tab="history"]').click();page.get_by_label('Schaden oder Punkte').fill('1000');page.get_by_role('button',name='Ergebnis speichern').click();page.get_by_label('Schaden oder Punkte').fill('1500');page.get_by_role('button',name='Ergebnis speichern').click();assert page.get_by_label('Vergleich A').count()==1
 page.locator('[data-tab="coordlab"]').click();page.locator('#coordContent').get_by_label('Labor-Staffel').select_option('1');page.get_by_label('Spielername',exact=True).last.fill('Testspieler');page.get_by_label('Teilnehmerheld').select_option('Chenko');page.get_by_label('Teilnehmer-Skill').select_option('5');page.get_by_role('button',name='Teilnehmer hinzufügen').click();assert 'Aktiver Bonus-Kandidat' in page.locator('#coordContent').inner_text();page.get_by_label('Sprache',exact=True).select_option('en');assert 'Slot 1: use agreed' in page.get_by_label('Mehrsprachiger Einsatzplan').input_value()
 assert not errors,errors
 print('roster, history, A/B, assignments, translation: OK')
 page.locator('[data-tab="brief"]').click(); page.get_by_label('Briefing-Staffel').select_option('1')
 page.get_by_label('Briefing-Ziel').fill('100 Mio.');page.get_by_label('Briefing-Termin').fill('2026-12-01T19:00');page.get_by_label('Rally-Leitung',exact=True).fill('Alpha');page.get_by_label('Briefing-Aufgabe 1').check()
 page.get_by_role('button',name='Marsch hinzufügen').click();page.get_by_label('Marschheld 1').select_option('Chenko');page.get_by_label('Marschskill 1').select_option('5');page.get_by_role('button',name='Marsch hinzufügen').click();page.get_by_label('Marschheld 2').select_option('Chenko');assert 'doppelt oder reserviert' in page.locator('#briefContent').inner_text()
 page.get_by_label('Marschheld 2').select_option('Amane');assert 'Keine doppelte Heldenzuweisung' in page.locator('#briefContent').inner_text();page.get_by_label('Reservierte Leiterhelden').fill('Amane');assert 'doppelt oder reserviert' in page.locator('#briefContent').inner_text();page.get_by_label('Reservierte Leiterhelden').fill('')
 page.get_by_label('Briefing-Event').select_option('bear2');assert page.get_by_label('Briefing-Ziel').input_value()=='';page.get_by_label('Briefing-Event').select_option('bear1');assert page.get_by_label('Briefing-Ziel').input_value()=='100 Mio.';assert page.get_by_label('Briefing-Aufgabe 1').is_checked();assert 'Alpha' in page.get_by_label('Briefing-Anweisung').input_value();assert 'UTC' in page.get_by_label('Briefing-Anweisung').input_value()
 for n in range(1,11):
  page.get_by_label('Briefing-Staffel').select_option(str(n))
  for ev in ['bear1','bear2','viking','castle','kvk','sword','champ','mobil','brawl','hall']:
   page.get_by_label('Briefing-Event').select_option(ev);assert page.get_by_label('Briefing-Anweisung').input_value().strip()
 page.get_by_label('Briefing-Event').select_option('castle');assert '5 Stunden' in page.locator('#briefContent').inner_text();assert 'höchsten Stat-Boni' in page.locator('#briefContent').inner_text()
 page.get_by_label('Briefing-Event').select_option('kvk');assert 'fünfstündiges' in page.locator('#briefContent').inner_text()
 page.get_by_label('Briefing-Event').select_option('bear1');page.get_by_label('Briefing-Staffel').select_option('5');page.get_by_role('button',name='Handbuch öffnen').click();assert page.locator('#tactics').is_visible();assert page.get_by_label('Bärenfalle wählen').input_value()=='1'
 assert not errors,errors
 print('100 briefing combinations, role/goal/date, UTC, separate traps, duplicate/reserved hero warnings, guide link: OK')
 page.locator('[data-tab="brief"]').click();page.locator('#briefContent').scroll_into_view_if_needed();page.evaluate('window.scrollTo(0, document.querySelector("#briefContent").getBoundingClientRect().top + window.scrollY - 75)');page.screenshot(path='/mnt/data/Kingdom-Companion-v0.8-Testansicht.png',full_page=False)
 b.close()
