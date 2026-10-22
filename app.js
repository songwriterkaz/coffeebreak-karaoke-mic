var $=function(s){return document.querySelector(s)};
var BASE=location.origin+location.pathname,q=new URLSearchParams(location.search);
function clean(n){return (n||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20)}
var me=clean(q.get('me'))||clean(localStorage.getItem('cbkm_me')),room=clean(q.get('mic'));
if(!me&&room)me='singer'+Math.random().toString(36).slice(2,6);
var role=room?'mic':'spk',ctx,live=false,ec=false,mics={},voices={},hpOn=false;
function st(t,ok){$('#st').textContent=t;$('#st').className=ok?'ok':''}
function AC(){if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'})}if(ctx.state=='suspended')ctx.resume();return ctx}
if(!me){$('#setup').classList.remove('hide');$('#nm').focus()}else go();
$('#start').onclick=function(){var n=clean($('#nm').value);if(!n){$('#nm').focus();return}me=n;go()};
$('#nm').onkeydown=function(e){if(e.key=='Enter')$('#start').click()};
function setRole(r){role=r;$('#rSpk').classList.toggle('on',r=='spk');$('#rMic').classList.toggle('on',r=='mic');$('#micUI').classList.toggle('hide',r!='mic');$('#spkUI').classList.toggle('hide',r!='spk');$('#lyrWrap').classList.toggle('hide',r!='spk');document.body.classList.toggle('spk',r=='spk');
 if(r=='spk'){st('Room ready',true);spkAudio()}else st(room?'Finding '+room+'…':'Type the room name')}
function go(){localStorage.setItem('cbkm_me',me);history.replaceState(null,'',BASE+'?me='+me+(room?'&mic='+room:''));
 $('#setup').classList.add('hide');$('#app').classList.remove('hide');
 new QRCode($('#qr'),{text:BASE+'?mic='+me,width:120,height:120,colorDark:'#6b1240'});
 CBLink.init({me:me,prefix:'cbkm-',stream:function(){return out?out.stream.getAudioTracks()[0]:null},
  onStatus:function(n,t,ok){if(role=='mic'&&n==room&&!ok)st(t)},
  onOpen:function(n,ms){window.KM.ms=ms;if(role=='mic'&&n==room){st('Connected to '+n,true);if(out)CBLink.setTrack(n,out.stream.getAudioTracks()[0]).catch(function(){})}else{mics[n]=1;cnt()}},
  onClose:function(n){if(mics[n]){delete mics[n];drop(n);cnt()}if(n==room)st('Reconnecting…')},
  onTrack:function(n,s){if(role=='spk')addVoice(n,s)}});
 if(room){$('#room').value=room;CBLink.want(room,true)}
 setRole(role);wake()}
$('#rSpk').onclick=function(){setRole('spk')};$('#rMic').onclick=function(){setRole('mic')};
$('#join').onclick=function(){var n=clean($('#room').value);if(!n||n==me)return;room=n;history.replaceState(null,'',BASE+'?me='+me+'&mic='+room);CBLink.want(room,true);st('Finding '+room+'…')};
// ---------- speaker ----------
var bus,an,sEl=$('#songEl');
function spkAudio(){AC();if(!bus){bus=ctx.createGain();bus.gain.value=+$('#vv').value;an=ctx.createAnalyser();an.fftSize=2048;bus.connect(an);bus.connect(ctx.destination)}
 if(ctx.state!='running'){$('#tap').classList.remove('hide')}}
$('#tap').onclick=function(){AC().resume().then(function(){$('#tap').classList.add('hide')});Object.keys(voices).forEach(function(n){voices[n].el.play().catch(function(){})})};
setInterval(function(){if(ctx&&ctx.state=='running')$('#tap').classList.add('hide')},1000);
function addVoice(n,s){spkAudio();drop(n);var el=new Audio();el.muted=true;el.srcObject=s;el.play().catch(function(){});var src=ctx.createMediaStreamSource(s),g=ctx.createGain();src.connect(g);g.connect(bus);voices[n]={el:el,src:src,g:g};guard()}
function drop(n){var v=voices[n];if(!v)return;try{v.src.disconnect();v.g.disconnect();v.el.srcObject=null}catch(e){}delete voices[n]}
function cnt(){var k=Object.keys(mics);$('#cnt').textContent=k.length?'Mics: '+k.join(', '):'No mics yet'}
$('#vv').oninput=function(){if(bus)bus.gain.value=+this.value};
// feedback guard: a mic on this same device gets muted here unless headphones are on
function guard(){var loc={};try{loc=JSON.parse(localStorage.getItem('cbkm_local')||'{}')}catch(e){}
 Object.keys(voices).forEach(function(n){var same=loc.n==n&&Date.now()-loc.t<5000;voices[n].g.gain.value=(same&&!hpOn)?0:1;voices[n].same=same})}
setInterval(guard,2000);
$('#hp').onclick=function(){hpOn=!hpOn;this.textContent='Headphones on this device: '+(hpOn?'yes':'no');this.classList.toggle('on',hpOn);guard()};
sEl.volume=0.7;$('#sgv').oninput=function(){sEl.volume=+this.value};
$('#song').onchange=function(){var f=this.files[0];if(f){sEl.src=URL.createObjectURL(f);sEl.play().catch(function(){})}};
$('#songGo').onclick=function(){var u=$('#songUrl').value.trim();if(u){sEl.src=u;sEl.play().catch(function(){})}};
// lyrics
var lrc=[],plain=false,lyr=$('#lyr');
function setLyrics(t){lyr.innerHTML='';lrc=[];var lines=t.split(/\r?\n/);
 lines.forEach(function(l){var m=l.match(/^((\[\d+:\d+(?:[.:]\d+)?\])+)(.*)$/);if(m){var txt=m[3].trim();m[1].match(/\[\d+:\d+(?:[.:]\d+)?\]/g).forEach(function(tag){var p=tag.slice(1,-1).split(':');lrc.push({t:+p[0]*60+parseFloat(p[1].replace(':','.')),x:txt})})}});
 if(lrc.length){plain=false;lrc.sort(function(a,b){return a.t-b.t})}else{plain=true;lrc=lines.filter(function(l){return l.trim()&&!/^\[[a-z]+:/i.test(l)}).map(function(x){return{x:x}})}
 lrc.forEach(function(r){var p=document.createElement('p');p.textContent=r.x||'…';r.p=p;lyr.appendChild(p)});lyr.scrollTop=0}
$('#lyrTxt').oninput=function(){setLyrics(this.value)};
$('#lrc').onchange=function(){var f=this.files[0];if(f)f.text().then(setLyrics)};
setInterval(function(){if(!lrc.length)return;if(plain){if(!sEl.paused||!sEl.src)lyr.scrollTop+=1;return}
 var t=sEl.currentTime,i=-1;lrc.forEach(function(r,k){if(r.t<=t)i=k});lrc.forEach(function(r,k){r.p.classList.toggle('now',k==i)});
 if(i>=0){var p=lrc[i].p;lyr.scrollTop=p.offsetTop-lyr.offsetTop-lyr.clientHeight/3}},80);
// ---------- mic ----------
var out,inG,fxIn,pitch,dry,dl,fb,dlWet,cv,cvWet,outG,micSrc,micStream,fxName='Normal';
function imp(sec,decay){var r=ctx.sampleRate,len=r*sec,b=ctx.createBuffer(2,len,r);for(var c=0;c<2;c++){var d=b.getChannelData(c);for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay)}return b}
var PW="class P extends AudioWorkletProcessor{static get parameterDescriptors(){return[{name:'ratio',defaultValue:1}]}constructor(){super();this.N=4096;this.b=new Float32Array(this.N);this.w=0;this.ph=0;this.win=1600}process(i,o,pr){var x=i[0]&&i[0][0],y=o[0][0],r=pr.ratio[0],N=this.N,b=this.b,W=this.win;if(!x){return true}for(var k=0;k<x.length;k++){b[this.w]=x[k];if(r==1){y[k]=x[k]}else{this.ph+=(1-r)/W;this.ph-=Math.floor(this.ph);var p2=(this.ph+.5)%1,s=0,ps=[this.ph,p2];for(var j=0;j<2;j++){var d=ps[j]*W+2,rp=this.w-d;rp=(rp%N+N)%N;var i0=Math.floor(rp),f=rp-i0,v=b[i0]*(1-f)+b[(i0+1)%N]*f,g=Math.sin(Math.PI*ps[j]);s+=v*g*g}y[k]=s}this.w=(this.w+1)%N}for(var c=1;c<o[0].length;c++)o[0][c].set(y);return true}}registerProcessor('km-pitch',P)";
function buildFx(){AC();if(out)return Promise.resolve();out=ctx.createMediaStreamDestination();inG=ctx.createGain();outG=ctx.createGain();outG.gain.value=0;dry=ctx.createGain();
 dl=ctx.createDelay(1);fb=ctx.createGain();dlWet=ctx.createGain();cv=ctx.createConvolver();cvWet=ctx.createGain();
 var mid=ctx.createGain();
 dry.connect(mid);dl.connect(fb);fb.connect(dl);dl.connect(dlWet);dlWet.connect(mid);cv.connect(cvWet);cvWet.connect(mid);mid.connect(outG);outG.connect(out);
 var hook=function(n){n.connect(dry);n.connect(dl);n.connect(cv)};
 var p=ctx.audioWorklet?ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([PW],{type:'application/javascript'}))).then(function(){pitch=new AudioWorkletNode(ctx,'km-pitch');inG.connect(pitch);hook(pitch)}).catch(function(){hook(inG)}):(hook(inG),Promise.resolve());
 return p.then(function(){setFx(fxName)})}
function setFx(n){fxName=n;if(!out)return;var r=+$('#rev').value,t=ctx.currentTime;
 var P={Normal:[1,0,0,1.2,2],Echo:[1,0.45,0.35,1.5,2],Hall:[1,0,0,3.5,2.5],Deep:[0.75,0,0,1.2,2],Chipmunk:[1.6,0,0,1.2,2]}[n]||[1,0,0,1.2,2];
 if(pitch)pitch.parameters.get('ratio').setValueAtTime(P[0],t);dl.delayTime.value=0.33;fb.gain.value=P[1]?0.4:0;dlWet.gain.value=P[1];
 cv.buffer=imp(P[3],P[4]);cvWet.gain.value=n=='Hall'?Math.max(r,0.6):r;dry.gain.value=1}
$('#fx').onchange=function(){setFx(this.value)};$('#rev').oninput=function(){setFx(fxName)};
$('#mv').oninput=function(){if(outG&&live)outG.gain.value=+this.value};
function getMic(){return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:ec,noiseSuppression:false,autoGainControl:false,channelCount:1}}).then(function(s){if(micStream)micStream.getTracks().forEach(function(t){t.stop()});if(micSrc)micSrc.disconnect();micStream=s;micSrc=ctx.createMediaStreamSource(s);micSrc.connect(inG)})}
$('#mic').onclick=function(){var b=this;if(live){live=false;outG.gain.value=0;b.classList.remove('on');b.innerHTML='MIC<br>OFF';return}
 buildFx().then(function(){return micStream?0:getMic()}).then(function(){live=true;outG.gain.value=+$('#mv').value;b.classList.add('on');b.innerHTML='MIC<br>ON';
  if(room)CBLink.setTrack(room,out.stream.getAudioTracks()[0]).catch(function(){})}).catch(function(){st('Mic not allowed')})};
$('#ec').onclick=function(){ec=!ec;this.textContent='Echo cancel: '+(ec?'on':'off');this.classList.toggle('on',ec);if(micStream)getMic()};
setInterval(function(){if(role=='mic'&&live&&room)localStorage.setItem('cbkm_local',JSON.stringify({n:me,t:Date.now()}))},1500);
// ---------- common ----------
$('#share').onclick=function(){var u=BASE+'?mic='+me;if(navigator.share)navigator.share({title:'Coffeebreak Karaoke Mic',text:'Sing with me',url:u}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(u).then(function(){$('#share').textContent='Link copied'})};
function wake(){try{if(navigator.wakeLock&&!document.hidden)navigator.wakeLock.request('screen').catch(function(){})}catch(e){}}
document.addEventListener('visibilitychange',function(){if(!document.hidden)wake()});
window.KM={level:function(){if(!an)return -1;var d=new Float32Array(2048);an.getFloatTimeDomainData(d);var m=0;for(var i=0;i<d.length;i++)m=Math.max(m,Math.abs(d[i]));return m},
 centroid:function(){if(!an)return 0;var f=new Float32Array(an.frequencyBinCount);an.getFloatFrequencyData(f);var s=0,w=0;for(var i=1;i<f.length;i++){var p=Math.pow(10,f[i]/10);s+=p*i;w+=p}return w?s/w*ctx.sampleRate/an.fftSize:0},
 song:function(){return{t:sEl.currentTime,paused:sEl.paused}},mics:function(){return Object.keys(mics)}};
