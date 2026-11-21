import os, base64
O='/home/claude/hefta/dp8/out/'
def b64(p): return 'data:image/png;base64,'+base64.b64encode(open(O+p,'rb').read()).decode()
def b64s(p): return 'data:image/svg+xml;base64,'+base64.b64encode(open(O+p,'rb').read()).decode()
fg,bg,mo=b64s('android/ic_launcher_foreground.svg'),b64s('android/ic_launcher_background.svg'),b64s('android/ic_launcher_monochrome.svg')
def adaptiv(maske,px=144,mono=False,tint=('#d6e3ff','#1f3b6e')):
    # 108 dp Fläche, sichtbar 72 dp: Bild auf 150 % skalieren und mittig zuschneiden
    r={'kreis':'50%','squircle':'32%','rund':'18%','tropfen':'50% 50% 50% 12%'}[maske]
    if mono:
        lay=f'<div style="position:absolute;inset:0;background:{tint[0]}"></div><div style="position:absolute;left:-25%;top:-25%;width:150%;height:150%;background:{tint[1]};-webkit-mask:url({mo}) center/100% 100%"></div>'
    else:
        lay=f'<img src="{bg}" style="position:absolute;left:-25%;top:-25%;width:150%;height:150%"><img src="{fg}" style="position:absolute;left:-25%;top:-25%;width:150%;height:150%">'
    return f'<div style="position:relative;width:{px}px;height:{px}px;border-radius:{r};overflow:hidden;display:inline-block">{lay}</div>'
def zelle(t,inhalt,bgc='#fff',col='#26221e'): return f'<div class="z" style="background:{bgc};color:{col}"><div class="t">{t}</div>{inhalt}</div>'
H=['<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#e8e2d8;font-family:system-ui;color:#26221e}h2{font-size:18px;margin:22px 0 10px}.r{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}.z{padding:12px;border-radius:12px}.t{font-size:12px;opacity:.7;margin-bottom:8px}.px{image-rendering:pixelated}</style><body>']
H.append('<h2>Flach (App Store, Grundlage) und Landingpage</h2><div class="r">')
H.append(zelle('flach 1024, hier 200',f'<img src="{b64("flach/hefta-icon-flach-1024.png")}" width="200">'))
H.append(zelle('Landingpage, abgerundet 512 → 200',f'<img src="{b64("web/hefta-icon-512.png")}" width="200">'))
H.append(zelle('Landingpage dunkel',f'<img src="{b64("web/hefta-icon-512.png")}" width="200">','#1b1814','#f3ede4'))
H.append(zelle('apple-touch-icon 180 (iOS rundet)',f'<img src="{b64("web/apple-touch-icon.png")}" width="120" style="border-radius:27px">'))
H.append(zelle('maskable 512, Kreis',f'<img src="{b64("web/hefta-icon-maskable-512.png")}" width="140" style="border-radius:50%">'))
H.append(zelle('Kopf der Website (Logo bleibt)','<div style="display:flex;align-items:center;gap:8px;font:700 22px system-ui"><svg width="26" height="26" viewBox="0 1.5 32 32"><path d="M20.6 22.2V17.2L16 13.2l-4.6 4v7.4c0 3.6 3 5 7 5s7-1.4 7-5V13.6L16 5.4 6.5 13.6v9.2" fill="none" stroke="#26221e" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>hefta</div>'))
H.append('</div><h2>Favicon: echte Größe im Tab und achtfach vergrößert</h2><div class="r">')
for bgc,col,name in (('#dee1e6','#202124','Tab hell'),('#35363a','#e8eaed','Tab dunkel')):
    tab=f'<div style="display:flex;align-items:center;gap:8px;background:{"#fff" if bgc=="#dee1e6" else "#202124"};padding:8px 12px;border-radius:8px 8px 0 0;width:220px;font-size:13px"><img src="{b64("favicon/favicon-16.png")}" width="16" height="16">Hefta · eure Mappe</div>'
    H.append(zelle(name+' (16 px)',tab,bgc,col))
H.append(zelle('16 px ×8',f'<img class="px" src="{b64("favicon/favicon-16.png")}" width="128">'))
H.append(zelle('32 px ×4',f'<img class="px" src="{b64("favicon/favicon-32.png")}" width="128">'))
H.append(zelle('32 px echt',f'<img src="{b64("favicon/favicon-32.png")}" width="32">'))
H.append('</div><h2>Android: adaptiv in vier Masken, einfarbig (Thema), Symbol der Erinnerungen</h2><div class="r">')
for m in ('kreis','squircle','rund','tropfen'): H.append(zelle(m,adaptiv(m),'#f1f0f4'))
H.append(zelle('Thema hell (Android 13+)',adaptiv('kreis',mono=True),'#f1f0f4'))
H.append(zelle('Thema dunkel',adaptiv('kreis',mono=True,tint=('#1f3b6e','#d6e3ff')),'#121212','#eee'))
H.append(zelle('48 dp, Kreis',adaptiv('kreis',48),'#f1f0f4'))
stat=f'<div style="background:#1c1b1f;color:#fff;padding:6px 10px;border-radius:8px;display:flex;gap:8px;align-items:center;font-size:13px"><span>9:41</span><img src="{b64("android/png/drawable-xxhdpi/ic_stat_hefta.png")}" width="24" height="24"><span style="opacity:.6">…</span></div>'
H.append(zelle('Statusleiste (24 dp)',stat,'#1c1b1f','#ddd'))
H.append(zelle('Erinnerung, Kopf',f'<div style="background:#2b2930;color:#e6e1e5;padding:10px;border-radius:14px;width:260px;font-size:13px"><div style="display:flex;gap:6px;align-items:center;opacity:.8"><img src="{b64("android/png/drawable-xxhdpi/ic_stat_hefta.png")}" width="16">Hefta · jetzt</div><b>Besichtigung heute, 17:30</b><br>Lindenallee 3, um 17:30.</div>','#1c1b1f','#ddd'))
H.append(zelle('Symbol ×4',f'<img class="px" src="{b64("android/png/drawable-mdpi/ic_stat_hefta.png")}" width="96" style="background:#555">','#555','#fff'))
H.append('</div>')
open('/home/claude/hefta/dp8/pruef.html','w').write(''.join(H))
