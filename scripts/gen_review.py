#!/usr/bin/env python3
"""Gera review.html: galeria de revisão (imagem + código + nome + specs + flag)."""
import json, os, html, collections
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data=json.load(open(os.path.join(BASE,"data","geomaq_parts.json"),encoding="utf-8"))

por_linha=collections.Counter(r["linha"] for r in data)
rev=collections.Counter(r["linha"] for r in data if r.get("revisar")=="sim")

cards=[]
for i,r in enumerate(data):
    flag = r.get("revisar")=="sim"
    badge = f'<span class="badge rev">revisar: {html.escape(r.get("revisar_motivo",""))}</span>' if flag else '<span class="badge ok">ok</span>'
    src   = html.escape(r.get("fonte",""))
    conf  = r.get("ocr_conf","")
    cards.append(f'''
    <div class="card{' flagged' if flag else ''}" data-linha="{html.escape(r['linha'])}" data-rev="{1 if flag else 0}">
      <div class="imgwrap"><img loading="lazy" src="{html.escape(r['imagem'])}" alt=""></div>
      <div class="info">
        <div class="code">{html.escape(r['codigo'])}</div>
        <div class="name">{html.escape(r['nome'] or '—')}</div>
        <div class="meta">{html.escape(r['linha'])} · p.{r['pagina']} · {src}{' '+str(conf) if conf else ''}</div>
        <div class="meta">{html.escape(r.get('familia') or '')} {('· '+html.escape(r['specs'])) if r.get('specs') else ''}</div>
        {badge}
      </div>
    </div>''')

resumo=" · ".join(f"{l}: {por_linha[l]} ({rev[l]} p/ revisar)" for l in sorted(por_linha))
htmldoc=f'''<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revisão de peças — Geomaq</title>
<style>
 body{{font-family:system-ui,Segoe UI,Roboto,sans-serif;margin:0;background:#f4f5f7;color:#1a1a1a}}
 header{{position:sticky;top:0;background:#0b6b3a;color:#fff;padding:14px 20px;box-shadow:0 2px 6px rgba(0,0,0,.15);z-index:10}}
 header h1{{margin:0 0 4px;font-size:18px}} header .sub{{font-size:12px;opacity:.9}}
 .controls{{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap}}
 .controls button,.controls select{{border:0;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer}}
 .controls button{{background:#fff;color:#0b6b3a;font-weight:600}}
 .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:18px}}
 .card{{background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12);display:flex;flex-direction:column}}
 .card.flagged{{outline:2px solid #e0a800}}
 .imgwrap{{background:#eceef0;aspect-ratio:3/4;display:flex;align-items:center;justify-content:center}}
 .imgwrap img{{max-width:100%;max-height:100%;object-fit:contain}}
 .info{{padding:10px}}
 .code{{font-weight:700;font-size:15px}}
 .name{{font-size:13px;margin:2px 0;min-height:32px}}
 .meta{{font-size:11px;color:#666}}
 .badge{{display:inline-block;margin-top:6px;font-size:10px;padding:2px 6px;border-radius:10px}}
 .badge.ok{{background:#e6f4ea;color:#0b6b3a}} .badge.rev{{background:#fff3cd;color:#8a6d00}}
</style></head><body>
<header>
  <h1>Revisão de peças — Geomaq (Fase 1)</h1>
  <div class="sub">{len(data)} peças · {resumo}</div>
  <div class="controls">
    <select id="linha" onchange="apply()"><option value="">Todas as linhas</option>
      {''.join(f'<option>{html.escape(l)}</option>' for l in sorted(por_linha))}</select>
    <button onclick="toggleRev()" id="revbtn">Mostrar só p/ revisar</button>
    <input id="q" placeholder="buscar código/nome" oninput="apply()" style="border:0;border-radius:6px;padding:6px 10px;font-size:13px">
  </div>
</header>
<div class="grid" id="grid">{''.join(cards)}</div>
<script>
let onlyRev=false;
function toggleRev(){{onlyRev=!onlyRev;document.getElementById('revbtn').textContent=onlyRev?'Mostrar todas':'Mostrar só p/ revisar';apply();}}
function apply(){{
  const l=document.getElementById('linha').value.toLowerCase();
  const q=document.getElementById('q').value.toLowerCase();
  document.querySelectorAll('.card').forEach(c=>{{
    const okL=!l||c.dataset.linha.toLowerCase()===l;
    const okR=!onlyRev||c.dataset.rev==='1';
    const okQ=!q||c.textContent.toLowerCase().includes(q);
    c.style.display=(okL&&okR&&okQ)?'':'none';
  }});
}}
</script></body></html>'''
open(os.path.join(BASE,"review.html"),"w",encoding="utf-8").write(htmldoc)
print("review.html gerado")
