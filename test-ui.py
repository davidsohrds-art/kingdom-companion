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
 b.close()
