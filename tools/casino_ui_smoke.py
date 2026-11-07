#!/usr/bin/env python3
"""Local-only browser regression for Golden Doubloon UI. Never calls a live casino.
Run: python3 -m http.server 8847 --bind 127.0.0.1
     python3 tools/casino_ui_smoke.py --out /workspace/casinoui-shots
Requires Playwright and Chrome; the route fixture uses the real UI with mocked replies.
"""
import argparse
import json
import shutil
from urllib.parse import urlparse
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:8847')
parser.add_argument('--out',default='/workspace/casinoui-shots')
args=parser.parse_args()
assert urlparse(args.url).hostname in ('localhost','127.0.0.1'), 'QA must stay local'
OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)
FIXTURE='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local casino UI QA</title>\n<style>html,body{margin:0;background:#0b201c;height:100%;font-family:system-ui}</style>\n<script type="module">\nimport {createCasinoUi} from \'./js/casino/ui.js\';\nwindow.calls=[];window.sounds=[];window.balance=1000;window.reply={};\nwindow.ui=createCasinoUi({qa:false,ownKeys:true,getGold:()=>balance,setGold:g=>balance=g,sfx:k=>sounds.push(k),pvp:()=>({inv:{call:async(action,body)=>{calls.push({action,body});await new Promise(r=>setTimeout(r,40));return {ok:true,gold:balance+(reply.delta||0),...reply};}}})});\nwindow.ui.open(\'blackjack\');\nwindow.ready=true;\n</script>\n'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/_casino_ui_qa.html',lambda route:route.fulfill(content_type='text/html',body=FIXTURE))
    page.goto(args.url.rstrip('/')+'/_casino_ui_qa.html')
    page.wait_for_function('window.ready === true')
    # Blackjack: actual UI request with a deterministic local response, never a production call.
    page.evaluate("reply={delta:75,outcome:'blackjack',bet:50,finished:true,player:['AS','KH'],dealer:['10S','9D']}")
    page.locator('[data-a=deal]').click()
    page.wait_for_selector('.cas-res.win')
    page.wait_for_timeout(750)
    assert page.locator('[data-k=stake]').inner_text()=='50 GOLD'
    assert page.locator('[data-k=payout]').inner_text()=='125 GOLD'
    assert page.locator('[data-k=net]').inner_text()=='+75 GOLD'
    assert page.locator('[data-k=gold]').inner_text()=='1,075 GOLD'
    page.screenshot(path=str(OUT/'blackjack-desktop.png'))
    page.evaluate("ui.show('roulette')")
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUT/'roulette-desktop.png'))
    page.evaluate("reply={delta:50,outcome:'win',number:3}")
    page.locator('[data-a=spin]').click()
    page.wait_for_selector('.cas-res.win')
    assert page.locator('[data-k=payout]').inner_text()=='100 GOLD'
    assert page.locator('[data-k=pocket]').inner_text()=='3 RED'
    page.evaluate("ui.show('slots');reply={delta:175,outcome:'win',reels:['doubloon','doubloon','doubloon']}")
    page.locator('[data-a=spin]').click()
    page.wait_for_selector('.cas-res.win')
    page.wait_for_timeout(750)
    assert page.locator('[data-k=payout]').inner_text()=='200 GOLD'
    page.screenshot(path=str(OUT/'slots-desktop.png'))
    # Phone portrait, all four screens: outer panel must not overflow horizontally.
    measurements=[]
    for w,h in [(390,844),(360,800),(320,740),(844,390)]:
        page.set_viewport_size({'width':w,'height':h})
        for game in ['blackjack','roulette','dice','slots']:
            page.evaluate('(g)=>{ui.state.bj=null;ui.show(g);document.querySelector(".cas-box").scrollTop=0}',game)
            page.wait_for_timeout(150)
            dims=page.evaluate('''()=>{let b=document.querySelector('.cas-box');return {w:b.clientWidth,sw:b.scrollWidth,game:ui.game,buttons:[...b.querySelectorAll('button:not([hidden])')].filter(x=>!x.disabled).map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))}}''')
            assert dims['sw']<=dims['w']+1, (w,h,game,dims)
            measurements.append({'viewport':[w,h],**dims})
            if w==390 or (w==844 and game=='dice'):
                page.screenshot(path=str(OUT/f'{game}-{w}x{h}.png'))
    # Win -> loss -> push receipt must stay exact; reduced motion suppresses particles.
    page.set_viewport_size({'width':390,'height':844})
    page.emulate_media(reduced_motion='reduce')
    page.evaluate("ui.show('dice');reply={delta:-50,outcome:'lose',dice:[6,6]}")
    page.locator('[data-a=roll]').click()
    page.wait_for_selector('.cas-res.lose')
    assert page.locator('[data-k=payout]').inner_text()=='0 GOLD'
    assert page.locator('[data-k=net]').inner_text()=='−50 GOLD'
    page.screenshot(path=str(OUT/'dice-loss-phone.png'))
    page.evaluate("reply={delta:50,outcome:'win',dice:[3,3]}")
    page.locator('[data-a=roll]').click()
    page.wait_for_selector('.cas-res.win')
    assert page.locator('.cas-coins').count()==0
    assert page.locator('[data-k=payout]').inner_text()=='100 GOLD'
    assert page.locator('[data-k=net]').inner_text()=='+50 GOLD'
    page.screenshot(path=str(OUT/'dice-win-phone.png'))
    # Repeated activation during pending/spinning is gated as before.
    before=page.evaluate('calls.length')
    page.evaluate("reply={delta:0,outcome:'push',dice:[3,4]};document.querySelector('[data-a=roll]').click();document.querySelector('[data-a=roll]').click()")
    page.wait_for_selector('.cas-res.push')
    assert page.evaluate('calls.length')==before+1
    assert page.locator('[data-k=payout]').inner_text()=='50 GOLD'
    # Actual controller integration: simulated standard pad drives the existing navigation.
    page.set_viewport_size({'width':1440,'height':1000})
    page.evaluate('''async()=>{
      window.gp={id:'Xbox Controller',index:0,connected:true,mapping:'standard',buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};
      Object.defineProperty(navigator,'getGamepads',{value:()=>[gp],configurable:true});
      const {initGamepad}=await import('/js/gamepad.js');window.pad=initGamepad();
      window.pressPad=(i)=>{gp.buttons[i]={pressed:true,value:1};pad.tick();gp.buttons[i]={pressed:false,value:0};pad.tick()};
      ui.show('dice');pressPad(13);
    }''')
    assert page.locator('.pad-focus').count()==1
    initial=page.evaluate('document.activeElement.outerHTML')
    page.evaluate('pressPad(12)')
    assert page.evaluate('document.activeElement.outerHTML')!=initial
    page.evaluate('pressPad(1)')
    assert not page.evaluate('ui.isOpen')
    page.wait_for_timeout(160)
    page.evaluate('pad.tick()')
    page.evaluate("ui.open('slots');reply={delta:-25,outcome:'lose',reels:['skull','anchor','ruby']}")
    page.wait_for_timeout(250)
    page.evaluate('pressPad(0)')
    page.wait_for_selector('.cas-res.lose')
    assert page.locator('[data-k=payout]').inner_text()=='0 GOLD'
    page.screenshot(path=str(OUT/'slots-controller.png'))
    # Keyboard focus trapping + Escape still work.
    page.keyboard.press('Tab')
    assert page.evaluate("ui.el.contains(document.activeElement)")
    page.keyboard.press('Escape')
    assert not page.evaluate('ui.isOpen')
    assert not errors,errors
    (OUT/'qa.json').write_text(json.dumps({'errors':errors,'measurements':measurements,'calls':page.evaluate('calls'),'sounds':page.evaluate('sounds')},indent=2))
    browser.close()
print('PASS: all four games at desktop, 390/360/320 portrait, 844 landscape; exact settlement receipts, reduced motion, duplicate gate, keyboard and simulated controller.')
